import { readFileSync } from "node:fs";
import {
  basename,
  commandFromPayload,
  isShellCommandFlag,
  type JsonObject,
  SHELLS,
  type ShellWord,
  tokenize,
  unwrap,
} from "./shell-command.ts";

type BlockMatch = {
  argument: string;
  detail: string;
};

const HOOK_NAME = "block-agent-force-push";
const HOOK_EVENT = "PreToolUse";
const DESCRIPTION =
  "Blocks agent shell commands that force-push Git history. Automated upstream reconciliation must use additive merge commits and ordinary pushes.";
function forcePushMatch(words: ShellWord[]): BlockMatch | undefined {
  const { words: unwrapped, splitCommand } = unwrap(words);
  if (splitCommand?.dynamic) {
    return {
      argument: splitCommand.value || "<dynamic split command>",
      detail:
        "A dynamic env split-string command could conceal a force-push operation.",
    };
  }
  if (splitCommand) return findForcePush(splitCommand.value);
  if (unwrapped.length === 0) return undefined;

  const executable = basename(unwrapped[0].value);
  if (SHELLS.has(executable)) {
    const commandIndex = unwrapped.findIndex((word) =>
      isShellCommandFlag(word.value),
    );
    const nested = commandIndex >= 0 ? unwrapped[commandIndex + 1] : undefined;
    if (nested) return findForcePush(nested.value);
    return undefined;
  }
  const stackIndex =
    executable === "glab"
      ? unwrapped.findIndex(
          (word, index) => index > 0 && word.value === "stack",
        )
      : -1;
  if (
    stackIndex >= 0 &&
    (unwrapped[stackIndex + 1]?.value === "sync" ||
      unwrapped[stackIndex + 1]?.dynamic)
  ) {
    return {
      argument: unwrapped[stackIndex + 1].value || "<dynamic stack action>",
      detail:
        "glab stack sync can force-push amended branches and rebase descendants.",
    };
  }
  if (executable !== "git") return undefined;

  const pushIndex = unwrapped.findIndex(
    (word, index) => index > 0 && word.value === "push",
  );
  if (pushIndex < 0) return undefined;

  for (const word of unwrapped.slice(pushIndex + 1)) {
    if (word.dynamic) {
      return {
        argument: word.value || "<dynamic argument>",
        detail:
          "A dynamic git-push argument could conceal a force option or force refspec.",
      };
    }
    if (
      word.value === "--force" ||
      word.value.startsWith("--force=") ||
      word.value === "--force-with-lease" ||
      word.value.startsWith("--force-with-lease=") ||
      word.value === "--mirror" ||
      /^-[^-]*f/u.test(word.value)
    ) {
      return {
        argument: word.value,
        detail: "Force options rewrite the published branch history.",
      };
    }
    if (word.value.startsWith("+") && word.value.length > 1) {
      return {
        argument: word.value,
        detail: "A leading-plus push refspec forces the remote ref update.",
      };
    }
  }
  return undefined;
}

function findForcePush(command: string): BlockMatch | undefined {
  for (const words of tokenize(command)) {
    const match = forcePushMatch(words);
    if (match) return match;
  }
  return undefined;
}

function deny(match: BlockMatch, command: string): void {
  const reason = [
    "Blocked an agent force-push attempt.",
    `Matched argument: ${match.argument}.`,
    match.detail,
    `Blocked command: ${command.trim().replace(/\s+/g, " ").slice(0, 180) || "<empty command>"}.`,
    "Automated upstream reconciliation must fetch the target branch, merge it into the feature branch, resolve conflicts, commit normally, and push without force.",
    "If additive reconciliation is genuinely insufficient, stop and report the repository, feature branch or detached state, matching PR/MR, target branch, local head, remote head, and the reason a human-owned rewrite is required.",
    "Do not search for another force-push syntax or provider-side bypass.",
  ].join(" ");

  process.stdout.write(
    `${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: HOOK_EVENT,
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    })}\n`,
  );
}

function writeDiagnostic(message: string): void {
  process.stderr.write(`[${HOOK_NAME}] ${message}\n`);
}

function printDiscovery(): void {
  process.stdout.write(
    `${JSON.stringify({
      name: HOOK_NAME,
      type: "codex-pre-tool-use",
      event: HOOK_EVENT,
      matcher: "^Bash$",
      runner: "pnpm exec tsx",
      command: "pnpm exec tsx ~/.agents/hooks/block-agent-force-push.ts",
      description: DESCRIPTION,
      purpose:
        "Preserve agent implementation and repair history by making rewritten-history publication human-only.",
      flags: ["--agent-discovery", "--hook-info", "--help"],
      blocks: [
        "git push --force",
        "git push -f",
        "git push --force-with-lease",
        "git push --mirror",
        "git push <remote> +<source>:<target>",
        "git push with dynamic arguments",
        "glab stack sync",
      ],
      allows: [
        "git fetch",
        "git merge",
        "git push",
        "git push --force-if-includes (without a force option)",
      ],
      failureBehavior:
        "Malformed, missing, or unsupported payloads write diagnostics to stderr and do not block the command.",
    })}\n`,
  );
}

function printHelp(): void {
  process.stdout.write(
    `${HOOK_NAME}\n\n${DESCRIPTION}\n\nUsage:\n  pnpm exec tsx ~/.agents/hooks/block-agent-force-push.ts\n  pnpm exec tsx ~/.agents/hooks/block-agent-force-push.ts --agent-discovery\n  pnpm exec tsx ~/.agents/hooks/block-agent-force-push.ts --help\n`,
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
    writeDiagnostic(
      `Could not read agent hook payload from stdin: ${(error as Error).message}`,
    );
    return;
  }
  if (!rawPayload.trim()) {
    writeDiagnostic("No stdin payload received.");
    return;
  }

  let payload: JsonObject;
  try {
    payload = JSON.parse(rawPayload) as JsonObject;
  } catch (error) {
    writeDiagnostic(
      `Could not parse agent hook payload as JSON: ${(error as Error).message}`,
    );
    return;
  }

  const lookup = commandFromPayload(payload);
  if (!lookup) {
    writeDiagnostic("No shell command found in supported payload fields.");
    return;
  }
  const match = findForcePush(lookup.command);
  if (match) deny(match, lookup.command);
}

main();
