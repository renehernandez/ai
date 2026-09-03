export type JsonObject = Record<string, unknown>;

export type CommandLookup = {
  command: string;
  path: string[];
};

export type ShellWord = {
  value: string;
  dynamic: boolean;
  redirection?: boolean;
};

export const SHELLS = new Set(["bash", "dash", "sh", "zsh"]);
const WRAPPERS = new Set([
  "command",
  "env",
  "nice",
  "nohup",
  "setsid",
  "sudo",
  "timeout",
]);
const COMMAND_PREFIXES = new Set([
  "!",
  "{",
  "do",
  "elif",
  "else",
  "exec",
  "if",
  "then",
  "time",
  "until",
  "while",
]);

export function isShellCommandFlag(value: string): boolean {
  return /^-[A-Za-z]*c[A-Za-z]*$/u.test(value);
}

export function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

export function getNested(payload: JsonObject, path: string[]): unknown {
  let current: unknown = payload;
  for (const key of path) {
    const object = asObject(current);
    if (!object) return undefined;
    current = object[key];
  }
  return current;
}

export function commandFromPayload(
  payload: JsonObject,
): CommandLookup | undefined {
  const candidates = [
    ["tool_input", "command"],
    ["tool_input", "cmd"],
    ["input", "command"],
    ["input", "cmd"],
    ["arguments", "command"],
    ["arguments", "cmd"],
  ];
  for (const path of candidates) {
    const value = getNested(payload, path);
    if (typeof value === "string") return { command: value, path };
  }
  return undefined;
}

export function tokenize(command: string): ShellWord[][] {
  const commands: ShellWord[][] = [];
  let words: ShellWord[] = [];
  let value = "";
  let dynamic = false;
  let quote: "single" | "double" | undefined;

  const pushWord = (): void => {
    if (value || dynamic) words.push({ value, dynamic });
    value = "";
    dynamic = false;
  };
  const pushCommand = (): void => {
    pushWord();
    if (words.length > 0) commands.push(words);
    words = [];
  };

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];
    if (quote === "single") {
      if (character === "'") quote = undefined;
      else value += character;
      continue;
    }
    if (character === "\\") {
      index += 1;
      if (index >= command.length) {
        dynamic = true;
        break;
      }
      value += command[index];
      continue;
    }
    if (character === "'") {
      quote = "single";
      continue;
    }
    if (character === '"') {
      quote = quote === "double" ? undefined : "double";
      continue;
    }
    if (character === "$" || character === "`") dynamic = true;
    if (!quote && /\s/u.test(character)) {
      if (character === "\n") pushCommand();
      else pushWord();
      continue;
    }
    if (!quote && "<>".includes(character)) {
      pushWord();
      let operator = character;
      if (command[index + 1] === character || command[index + 1] === "&") {
        operator += command[index + 1];
        index += 1;
      }
      words.push({ value: operator, dynamic: false, redirection: true });
      continue;
    }
    if (!quote && ";|&()".includes(character)) {
      pushCommand();
      continue;
    }
    value += character;
  }
  if (quote) dynamic = true;
  pushCommand();
  return commands;
}

export function basename(command: string): string {
  return command.slice(command.lastIndexOf("/") + 1);
}

export function unwrap(words: ShellWord[]): {
  words: ShellWord[];
  ambiguous: boolean;
  splitCommand?: ShellWord;
} {
  const withoutRedirections: ShellWord[] = [];
  let ambiguous = false;
  for (let index = 0; index < words.length; index += 1) {
    if (!words[index].redirection) {
      withoutRedirections.push(words[index]);
      continue;
    }
    if (!words[index + 1]) ambiguous = true;
    index += 1;
  }
  let remaining = withoutRedirections;
  while (
    remaining.length > 0 &&
    (COMMAND_PREFIXES.has(remaining[0].value) ||
      /^[A-Za-z_][A-Za-z0-9_]*=/u.test(remaining[0].value))
  ) {
    if (remaining[0].dynamic) ambiguous = true;
    remaining = remaining.slice(1);
  }
  while (remaining.length > 0 && WRAPPERS.has(basename(remaining[0].value))) {
    const wrapper = basename(remaining[0].value);
    let index = 1;
    if (wrapper === "command") {
      while (remaining[index]?.value.startsWith("-")) index += 1;
    } else if (wrapper === "env") {
      while (index < remaining.length) {
        const word = remaining[index];
        if (word.dynamic) ambiguous = true;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(word.value)) {
          index += 1;
          continue;
        }
        if (word.value === "-C" || word.value === "--chdir") {
          ambiguous = true;
          index += 2;
          continue;
        }
        if (/^-C.+/u.test(word.value)) {
          ambiguous = true;
          index += 1;
          continue;
        }
        if (word.value === "-S" || word.value === "--split-string") {
          return {
            words: [],
            ambiguous,
            splitCommand: remaining[index + 1],
          };
        }
        if (/^-S.+/u.test(word.value)) {
          return {
            words: [],
            ambiguous,
            splitCommand: {
              value: word.value.slice(2),
              dynamic: word.dynamic,
            },
          };
        }
        if (word.value.startsWith("--split-string=")) {
          return {
            words: [],
            ambiguous,
            splitCommand: {
              value: word.value.slice("--split-string=".length),
              dynamic: word.dynamic,
            },
          };
        }
        if (word.value.startsWith("--chdir=")) {
          ambiguous = true;
          index += 1;
          continue;
        }
        if (word.value === "-u" || word.value === "--unset") {
          index += 2;
          continue;
        }
        if (word.value === "--" || word.value.startsWith("-")) {
          index += 1;
          continue;
        }
        break;
      }
    } else if (wrapper === "sudo") {
      const optionsWithValues = new Set([
        "-C",
        "-D",
        "-g",
        "-h",
        "-p",
        "-R",
        "-r",
        "-T",
        "-t",
        "-u",
        "--chdir",
        "--chroot",
        "--close-from",
        "--command-timeout",
        "--group",
        "--host",
        "--prompt",
        "--role",
        "--type",
        "--user",
      ]);
      while (index < remaining.length) {
        const word = remaining[index];
        if (word.value === "--") {
          index += 1;
          break;
        }
        if (!word.value.startsWith("-")) break;
        if (
          [
            "-D",
            "-R",
            "-i",
            "-s",
            "--chdir",
            "--chroot",
            "--login",
            "--shell",
          ].includes(word.value) ||
          /^(?:--chdir|--chroot)=/u.test(word.value) ||
          /^-[DR].+/u.test(word.value)
        ) {
          ambiguous = true;
        }
        if (optionsWithValues.has(word.value)) index += 2;
        else index += 1;
      }
    } else if (wrapper === "nice") {
      while (index < remaining.length) {
        const word = remaining[index];
        if (word.value === "-n" || word.value === "--adjustment") index += 2;
        else if (/^(?:-\d+|-n[+-]?\d+|--adjustment=)/u.test(word.value))
          index += 1;
        else break;
      }
    } else if (wrapper === "nohup" || wrapper === "setsid") {
      while (remaining[index]?.value.startsWith("-")) index += 1;
    } else if (wrapper === "timeout") {
      while (index < remaining.length) {
        const word = remaining[index];
        if (["-k", "--kill-after", "-s", "--signal"].includes(word.value)) {
          index += 2;
        } else if (word.value.startsWith("-")) index += 1;
        else break;
      }
      index += 1;
    } else {
      while (index < remaining.length) {
        const word = remaining[index];
        if (word.dynamic) ambiguous = true;
        if (word.value === "--") {
          index += 1;
          break;
        }
        if (!word.value.startsWith("-")) break;
        if (["-u", "-g", "-h", "-p", "-r", "-t", "-C"].includes(word.value)) {
          index += 2;
        } else index += 1;
      }
    }
    remaining = remaining.slice(index);
  }
  return { words: remaining, ambiguous };
}
