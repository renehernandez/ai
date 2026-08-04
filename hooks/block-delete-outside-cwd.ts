import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";

type JsonObject = Record<string, unknown>;

type CommandLookup = {
  command: string;
  path: string[];
};

type ShellWord = {
  value: string;
  dynamic: boolean;
  redirection?: boolean;
};

type BlockReason = {
  operation: string;
  target: string;
  detail: string;
};

const HOOK_NAME = "block-delete-outside-cwd";
const HOOK_EVENT = "PreToolUse";
const DESCRIPTION =
  "Blocks supported shell deletion commands unless every target can be proven to stay inside the hook payload cwd.";
const SHELLS = new Set(["bash", "dash", "sh", "zsh"]);
const WRAPPERS = new Set([
  "command",
  "env",
  "nice",
  "nohup",
  "setsid",
  "sudo",
  "timeout",
]);
const DELETE_COMMANDS = new Set(["rm", "rmdir", "unlink"]);
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

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function getNested(payload: JsonObject, path: string[]): unknown {
  let current: unknown = payload;
  for (const key of path) {
    const object = asObject(current);
    if (!object) return undefined;
    current = object[key];
  }
  return current;
}

function commandFromPayload(payload: JsonObject): CommandLookup | undefined {
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

function cwdFromPayload(payload: JsonObject): string | undefined {
  for (const path of [["cwd"], ["tool_input", "cwd"], ["input", "cwd"]]) {
    const value = getNested(payload, path);
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function stringFieldFromMalformedJson(
  payload: string,
  names: string[],
): string | undefined {
  const alternatives = names.map((name) => name.replace(/[^A-Za-z0-9_]/gu, ""));
  const match = new RegExp(
    `"(?:${alternatives.join("|")})"\\s*:\\s*("(?:\\\\.|[^"\\\\])*")`,
    "u",
  ).exec(payload);
  if (!match) return undefined;
  try {
    const value = JSON.parse(match[1]);
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

function tokenize(command: string): ShellWord[][] {
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

function basename(command: string): string {
  return command.slice(command.lastIndexOf("/") + 1);
}

function unwrap(words: ShellWord[]): {
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

function pathWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return (
    rel === "" ||
    (rel !== ".." &&
      !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}

function existingAncestor(path: string): string {
  let cursor = path;
  while (!existsSync(cursor)) {
    const parent = dirname(cursor);
    if (parent === cursor) return cursor;
    cursor = parent;
  }
  return cursor;
}

function targetBlockReason(
  operation: string,
  target: ShellWord,
  cwd: string,
): BlockReason | undefined {
  if (
    target.dynamic ||
    target.value.startsWith("~") ||
    /[*?[\]{}]/u.test(target.value)
  ) {
    return {
      operation,
      target: target.value || "<dynamic>",
      detail: "the target uses dynamic expansion or globbing",
    };
  }
  const root = resolve(cwd);
  const absolute = isAbsolute(target.value)
    ? resolve(target.value)
    : resolve(root, target.value);
  if (!pathWithin(absolute, root)) {
    return {
      operation,
      target: target.value,
      detail: "the target resolves outside cwd",
    };
  }
  const physicalRoot = existsSync(root) ? realpathSync(root) : root;
  const parent = absolute === root ? root : dirname(absolute);
  const ancestor = existingAncestor(parent);
  const physicalParent = existsSync(ancestor)
    ? realpathSync(ancestor)
    : ancestor;
  if (!pathWithin(physicalParent, physicalRoot)) {
    return {
      operation,
      target: target.value,
      detail: "an existing parent resolves through a symlink outside cwd",
    };
  }
  return undefined;
}

function traversalRootBlockReason(
  operation: string,
  target: ShellWord,
  cwd: string,
): BlockReason | undefined {
  const targetReason = targetBlockReason(operation, target, cwd);
  if (targetReason) return targetReason;
  const root = resolve(cwd);
  const absolute = isAbsolute(target.value)
    ? resolve(target.value)
    : resolve(root, target.value);
  const existing = existingAncestor(absolute);
  const physicalRoot = existsSync(root) ? realpathSync(root) : root;
  const physicalTarget = existsSync(existing)
    ? realpathSync(existing)
    : existing;
  if (!pathWithin(physicalTarget, physicalRoot)) {
    return {
      operation,
      target: target.value,
      detail: "the traversal root resolves through a symlink outside cwd",
    };
  }
  return undefined;
}

function directDeleteReason(
  operation: string,
  args: ShellWord[],
  cwd: string,
): BlockReason | undefined {
  let operands = false;
  for (const argument of args) {
    if (!operands && argument.value === "--") {
      operands = true;
      continue;
    }
    if (!operands && argument.value.startsWith("-")) continue;
    const reason = targetBlockReason(operation, argument, cwd);
    if (reason) return reason;
  }
  return undefined;
}

function findDeleteReason(
  words: ShellWord[],
  cwd: string,
): BlockReason | undefined {
  const deleteIndex = words.findIndex((word) => word.value === "-delete");
  if (deleteIndex === -1) return undefined;
  const args = words.slice(1, deleteIndex);
  if (
    args.some(
      (word) =>
        word.dynamic ||
        word.value === "-L" ||
        word.value === "-H" ||
        word.value === "-follow",
    )
  ) {
    return {
      operation: "find -delete",
      target: "<find expression>",
      detail: "the find traversal is dynamic or follows symlinks",
    };
  }
  let index = 0;
  while (index < args.length) {
    const option = args[index].value;
    if (option === "-P" || /^-O\d+$/u.test(option)) {
      index += 1;
      continue;
    }
    if (option === "-D") {
      index += 2;
      continue;
    }
    if (option === "--") {
      index += 1;
      break;
    }
    if (option === "-files0-from") {
      return {
        operation: "find -delete",
        target: option,
        detail: "file-provided traversal roots prevent containment proof",
      };
    }
    if (option.startsWith("-")) {
      return {
        operation: "find -delete",
        target: option,
        detail: "an unsupported leading find option prevents containment proof",
      };
    }
    break;
  }
  const targets: ShellWord[] = [];
  while (index < args.length) {
    const word = args[index];
    if (
      word.value.startsWith("-") ||
      word.value === "(" ||
      word.value === "!"
    ) {
      break;
    }
    targets.push(word);
    index += 1;
  }
  for (const target of targets.length > 0
    ? targets
    : [{ value: ".", dynamic: false }]) {
    const reason = traversalRootBlockReason("find -delete", target, cwd);
    if (reason) return reason;
  }
  return undefined;
}

function gitCleanReason(
  words: ShellWord[],
  cwd: string,
): BlockReason | undefined {
  let index = 1;
  let effectiveCwd = cwd;
  while (index < words.length && words[index].value !== "clean") {
    const word = words[index];
    if (word.dynamic)
      return {
        operation: "git clean",
        target: "<git options>",
        detail: "the git invocation is dynamic",
      };
    if (word.value === "-C") {
      const directory = words[index + 1];
      if (!directory)
        return {
          operation: "git clean",
          target: "<missing -C directory>",
          detail: "the alternate directory is missing",
        };
      const reason = traversalRootBlockReason("git clean", directory, cwd);
      if (reason) return reason;
      effectiveCwd = resolve(cwd, directory.value);
      index += 2;
      continue;
    }
    if (word.value.startsWith("-C") && word.value.length > 2) {
      const directory = { ...word, value: word.value.slice(2) };
      const reason = traversalRootBlockReason("git clean", directory, cwd);
      if (reason) return reason;
      effectiveCwd = resolve(cwd, directory.value);
      index += 1;
      continue;
    }
    if (word.value === "-c" || word.value.startsWith("--config-env")) {
      return {
        operation: "git clean",
        target: word.value,
        detail: "runtime Git configuration prevents containment proof",
      };
    }
    if (
      word.value.startsWith("--work-tree") ||
      word.value.startsWith("--git-dir")
    ) {
      return {
        operation: "git clean",
        target: word.value,
        detail: "an alternate Git work tree prevents containment proof",
      };
    }
    index += 1;
  }
  if (words[index]?.value !== "clean") return undefined;
  const pathspecs: ShellWord[] = [];
  let operands = false;
  for (const word of words.slice(index + 1)) {
    if (!operands && word.value === "--") {
      operands = true;
      continue;
    }
    if (!operands && word.value.startsWith("-")) continue;
    pathspecs.push(word);
  }
  for (const pathspec of pathspecs.length > 0
    ? pathspecs
    : [{ value: ".", dynamic: false }]) {
    if (pathspec.value.startsWith(":")) {
      return {
        operation: "git clean",
        target: pathspec.value,
        detail: "Git pathspec magic prevents containment proof",
      };
    }
    const reason = targetBlockReason("git clean", pathspec, effectiveCwd);
    if (reason) return reason;
  }
  return undefined;
}

function commandReason(
  words: ShellWord[],
  cwd: string,
  cwdChanged: boolean,
): BlockReason | undefined {
  const unwrapped = unwrap(words);
  if (unwrapped.splitCommand) {
    if (
      unwrapped.splitCommand.dynamic &&
      textContainsDeletion(unwrapped.splitCommand.value)
    ) {
      return {
        operation: "env split-string",
        target: unwrapped.splitCommand.value,
        detail: "the split command is dynamic",
      };
    }
    return evaluateCommand(unwrapped.splitCommand.value, cwd);
  }
  if (unwrapped.words.length === 0) return undefined;
  const executable = basename(unwrapped.words[0].value);
  const deletionBearing =
    DELETE_COMMANDS.has(executable) ||
    executable === "find" ||
    (executable === "git" &&
      unwrapped.words.some((word) => word.value === "clean"));
  if (!deletionBearing) {
    const substitution = unwrapped.words.find(
      (word) => word.dynamic && substitutionContainsDeletion(word.value),
    );
    if (substitution) {
      return {
        operation: "command substitution",
        target: substitution.value,
        detail: "a nested deletion command is dynamic",
      };
    }
    if (SHELLS.has(executable)) {
      const commandIndex = unwrapped.words.findIndex((word) =>
        /^-[A-Za-z]*c[A-Za-z]*$/u.test(word.value),
      );
      const nested =
        commandIndex === -1 ? undefined : unwrapped.words[commandIndex + 1];
      if (nested && !nested.dynamic) return evaluateCommand(nested.value, cwd);
      if (
        nested?.dynamic &&
        /\b(rm|rmdir|unlink|find|git)\b/u.test(nested.value)
      ) {
        return {
          operation: `${executable} -c`,
          target: "<dynamic command>",
          detail: "the nested shell command is dynamic",
        };
      }
    }
    return undefined;
  }
  if (unwrapped.ambiguous || cwdChanged) {
    return {
      operation: executable,
      target: "<command context>",
      detail:
        "a wrapper or working-directory change prevents containment proof",
    };
  }
  if (DELETE_COMMANDS.has(executable))
    return directDeleteReason(executable, unwrapped.words.slice(1), cwd);
  if (executable === "find") return findDeleteReason(unwrapped.words, cwd);
  return gitCleanReason(unwrapped.words, cwd);
}

export function evaluateCommand(
  command: string,
  cwd: string,
): BlockReason | undefined {
  let cwdChanged = false;
  for (const words of tokenize(command)) {
    const executable = basename(unwrap(words).words[0]?.value ?? "");
    if (
      executable === "cd" ||
      executable === "pushd" ||
      executable === "popd"
    ) {
      cwdChanged = true;
      continue;
    }
    const reason = commandReason(words, cwd, cwdChanged);
    if (reason) return reason;
  }
  return undefined;
}

function containsDeletionCommand(command: string): boolean {
  for (const words of tokenize(command)) {
    const unwrapped = unwrap(words).words;
    const executable = basename(unwrapped[0]?.value ?? "");
    if (
      DELETE_COMMANDS.has(executable) ||
      (executable === "find" &&
        unwrapped.some((word) => word.value === "-delete")) ||
      (executable === "git" && unwrapped.some((word) => word.value === "clean"))
    ) {
      return true;
    }
    if (
      SHELLS.has(executable) &&
      unwrapped.some((word) =>
        word.value.includes(" ") ? containsDeletionCommand(word.value) : false,
      )
    ) {
      return true;
    }
  }
  return false;
}

function textContainsDeletion(value: string): boolean {
  return (
    /\b(?:rm|rmdir|unlink)\b/u.test(value) ||
    /\bfind\b[^)`]*\s-delete\b/u.test(value) ||
    /\bgit\b[^)`]*\sclean\b/u.test(value)
  );
}

function substitutionContainsDeletion(value: string): boolean {
  for (const match of value.matchAll(/\$\(([^()]*)\)/gu)) {
    if (containsDeletionCommand(match[1])) return true;
  }
  for (const match of value.matchAll(/`([^`]*)`/gu)) {
    if (containsDeletionCommand(match[1])) return true;
  }
  return false;
}

function writeJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function deny(reason: BlockReason, command: string, cwd: string): void {
  writeJson({
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT,
      permissionDecision: "deny",
      permissionDecisionReason: [
        `Blocked ${reason.operation} because ${reason.detail}.`,
        `Protected cwd: ${cwd}.`,
        `Rejected target: ${reason.target}.`,
        `Blocked command: ${command.trim().replace(/\s+/g, " ").slice(0, 180) || "<empty command>"}.`,
        "Delete only paths that can be statically proven to stay inside the current working directory.",
      ].join(" "),
    },
  });
}

function writeDiagnostic(message: string): void {
  process.stderr.write(`[${HOOK_NAME}] ${message}\n`);
}

function printDiscovery(): void {
  writeJson({
    name: HOOK_NAME,
    type: "codex-pre-tool-use",
    event: HOOK_EVENT,
    matcher: "^Bash$",
    runner: "pnpm exec tsx",
    command: "pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts",
    description: DESCRIPTION,
    purpose:
      "Keep supported shell deletion targets contained by the session working directory.",
    flags: ["--agent-discovery", "--hook-info", "--help"],
    blocks: [
      "rm, rmdir, or unlink outside cwd",
      "find -delete outside cwd",
      "git clean outside cwd",
      "ambiguous deletion targets",
    ],
    failureBehavior:
      "Identifiable deletion commands fail closed when cwd, targets, wrappers, or shell structure cannot be proven safe; unrelated commands only emit diagnostics.",
  });
}

function printHelp(): void {
  process.stdout.write(
    `${HOOK_NAME}\n\n${DESCRIPTION}\n\nUsage:\n  pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts\n  pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts --agent-discovery\n  pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts --help\n`,
  );
}

function main(): void {
  if (
    process.argv.includes("--agent-discovery") ||
    process.argv.includes("--hook-info")
  ) {
    printDiscovery();
    return;
  }
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }
  let rawPayload = "";
  try {
    rawPayload = readFileSync(0, "utf8");
  } catch (error) {
    writeDiagnostic(`Could not read hook payload: ${(error as Error).message}`);
    return;
  }
  let payload: JsonObject;
  try {
    payload = JSON.parse(rawPayload) as JsonObject;
  } catch (error) {
    const command = stringFieldFromMalformedJson(rawPayload, [
      "command",
      "cmd",
    ]);
    if (command && containsDeletionCommand(command)) {
      deny(
        {
          operation: "deletion",
          target: "<untrusted malformed payload>",
          detail: "the hook payload is malformed",
        },
        command,
        stringFieldFromMalformedJson(rawPayload, ["cwd"]) ?? "<unknown>",
      );
      return;
    }
    writeDiagnostic(
      `Could not parse hook payload as JSON: ${(error as Error).message}`,
    );
    return;
  }
  const lookup = commandFromPayload(payload);
  if (!lookup) {
    writeDiagnostic(
      "No supported command field was present in the hook payload.",
    );
    return;
  }
  const cwd = cwdFromPayload(payload);
  if (!cwd) {
    if (containsDeletionCommand(lookup.command))
      deny(
        {
          operation: "deletion",
          target: "<unknown>",
          detail: "the hook payload has no valid cwd",
        },
        lookup.command,
        "<missing>",
      );
    else writeDiagnostic("No valid cwd was present for an unrelated command.");
    return;
  }
  const reason = evaluateCommand(lookup.command, cwd);
  if (reason) deny(reason, lookup.command, resolve(cwd));
}

main();
