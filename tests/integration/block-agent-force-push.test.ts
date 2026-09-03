// charter-contracts: hook-registration
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const hookPath = join(repoRoot, "hooks", "block-agent-force-push.ts");
const tsxLoader = pathToFileURL(
  join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;

function runHook(command: string): {
  denied: boolean;
  reason?: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath],
    {
      cwd: repoRoot,
      encoding: "utf-8",
      input: JSON.stringify({ tool_input: { command } }),
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  if (!result.stdout.trim()) {
    return { denied: false, stderr: result.stderr };
  }
  const output = JSON.parse(result.stdout) as {
    hookSpecificOutput?: {
      permissionDecision?: string;
      permissionDecisionReason?: string;
    };
  };
  return {
    denied: output.hookSpecificOutput?.permissionDecision === "deny",
    reason: output.hookSpecificOutput?.permissionDecisionReason,
    stderr: result.stderr,
  };
}

function runRawHook(payload: string): { denied: boolean; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath],
    { cwd: repoRoot, encoding: "utf-8", input: payload },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return {
    denied: result.stdout.includes('"permissionDecision":"deny"'),
    stderr: result.stderr,
  };
}

test("RED hook-registration: denies direct force-push options and force refspecs", () => {
  for (const command of [
    "git push --force origin HEAD",
    "git push origin HEAD --force=true",
    "git push -f origin branch",
    "git push -uf origin branch",
    "git push --force-with-lease origin branch",
    "git push --force-with-lease=refs/heads/branch:abc origin HEAD:branch",
    "git push --mirror origin",
    "git push origin +HEAD:refs/heads/branch",
    "/usr/bin/git -C repo push origin +main:main",
  ]) {
    const result = runHook(command);
    assert.equal(result.denied, true, command);
    assert.match(result.reason ?? "", /Blocked an agent force-push attempt/u);
    assert.match(result.reason ?? "", /merge it into the feature branch/u);
    assert.match(result.reason ?? "", /human-owned rewrite/u);
  }
});

test("denies glab stack sync because it can force-push managed branches", () => {
  for (const command of [
    "glab stack sync",
    "glab stack sync --update-base",
    "glab --repo rene.hernandez/ai stack sync",
    "env TRACE=1 glab stack sync --skip-mr-creation",
    "glab stack $ACTION",
  ]) {
    const result = runHook(command);
    assert.equal(result.denied, true, command);
    assert.match(result.reason ?? "", /glab stack sync can force-push/u);
  }
});

test("denies wrapped, chained, and literal nested-shell force pushes", () => {
  for (const command of [
    "command git push --force origin branch",
    "env TRACE=1 git push --force-with-lease origin branch",
    "env -S 'git push --force origin branch'",
    "env --split-string='git push --force origin branch'",
    "env -S'git push -f origin branch'",
    "sudo -- git push -f origin branch",
    "nice git push origin +HEAD:branch",
    "setsid git push --force origin branch",
    "timeout 5 git push --force origin branch",
    "timeout --kill-after 2s 5s git push --force origin branch",
    "timeout -s TERM 5s git push --force origin branch",
    "git status && git push --force origin branch",
    "sh -c 'git push --force origin branch'",
    "sh -cx 'git push --force origin branch'",
    'bash -lc "git push origin +HEAD:branch"',
  ]) {
    assert.equal(runHook(command).denied, true, command);
  }
});

test("denies dynamic git-push arguments that could conceal force publication", () => {
  for (const command of [
    "git push $PUSH_ARGS",
    'git push origin "$REFSPEC"',
    "git push origin $(resolve-ref)",
    "git push origin `resolve-ref`",
  ]) {
    const result = runHook(command);
    assert.equal(result.denied, true, command);
    assert.match(result.reason ?? "", /dynamic git-push argument/u);
  }
});

test("GREEN hook-registration: allows additive reconciliation and ordinary Git operations", () => {
  for (const command of [
    "git fetch origin main",
    "git merge origin/main",
    "git status",
    "git push origin HEAD:branch",
    "git push --set-upstream origin branch",
    "git push --force-if-includes origin branch",
    "printf '%s' 'git push --force origin branch'",
    "echo git push --force",
  ]) {
    assert.equal(runHook(command).denied, false, command);
  }
});

test("allows malformed or unsupported hook payloads with diagnostics", () => {
  const malformed = runRawHook('{"tool_input":{"command":"git push --force"}');
  assert.equal(malformed.denied, false);
  assert.match(malformed.stderr, /Could not parse/u);

  const unsupported = runRawHook('{"tool_input":{"path":"file"}}');
  assert.equal(unsupported.denied, false);
  assert.match(unsupported.stderr, /No shell command/u);
});

test("publishes discovery metadata and help", () => {
  for (const flag of ["--agent-discovery", "--hook-info"]) {
    const result = spawnSync(
      process.execPath,
      ["--import", tsxLoader, hookPath, flag],
      { cwd: repoRoot, encoding: "utf-8" },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const output = JSON.parse(result.stdout) as Record<string, unknown>;
    assert.equal(output.name, "block-agent-force-push");
    assert.equal(output.event, "PreToolUse");
    assert.match(String(output.purpose), /human-only/u);
  }

  const help = spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath, "--help"],
    { cwd: repoRoot, encoding: "utf-8" },
  );
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /block-agent-force-push/u);
  assert.match(help.stdout, /additive merge commits/u);
});
