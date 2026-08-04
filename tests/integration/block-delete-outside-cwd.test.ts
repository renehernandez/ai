import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const hookPath = join(repoRoot, "hooks", "block-delete-outside-cwd.ts");
const tsxLoader = pathToFileURL(
  join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "block-delete-outside-cwd-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function runHook(
  command: string,
  cwd?: string,
): {
  denied: boolean;
  reason?: string;
  stderr: string;
} {
  const payload: Record<string, unknown> = { tool_input: { command } };
  if (cwd !== undefined) payload.cwd = cwd;
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath],
    {
      cwd: repoRoot,
      encoding: "utf-8",
      input: JSON.stringify(payload),
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

test("allows static deletion targets inside cwd", () => {
  withTempDir((root) => {
    const cwd = join(root, "workspace");
    mkdirSync(join(cwd, "nested"), { recursive: true });
    for (const command of [
      "rm -rf nested/file",
      "rmdir nested",
      "unlink ./file",
      "find . -delete",
      "git clean -fd -- nested",
      "env FOO=bar rm nested/file",
      "{ rm nested/file; }",
    ]) {
      assert.equal(runHook(command, cwd).denied, false, command);
    }
  });
});

test("denies direct, wrapped, piped, and nested-shell deletion outside cwd", () => {
  withTempDir((root) => {
    const cwd = join(root, "workspace");
    const outside = join(root, "outside");
    mkdirSync(cwd);
    mkdirSync(outside);
    for (const command of [
      "rm -rf ../outside",
      `unlink ${join(outside, "file")}`,
      "command rm ../outside",
      "env FOO=bar rm ../outside",
      "sudo -- rm ../outside",
      "sudo -D /tmp rm nested/file",
      "sudo -D/tmp rm nested/file",
      "sudo -R /tmp rm nested/file",
      "sudo -R/tmp rm nested/file",
      "sudo --chdir=/tmp rm nested/file",
      "sudo --chroot=/tmp rm nested/file",
      "sudo -i rm ../outside",
      "sudo -T 1 rm ../outside",
      "true | rm ../outside",
      "sh -c 'rm ../outside'",
      'bash -xc "rm ../outside"',
      "cd nested && rm file",
      "if true; then rm ../outside; fi",
      "FOO=bar rm ../outside",
      "> command.log rm ../outside",
      'printf "%s" "$(rm ../outside)"',
      'env -S "rm ../outside"',
      'env -S"rm ../outside"',
      "env -C/tmp rm nested/file",
      "nice rm ../outside",
      "nice -n10 rm ../outside",
      "nohup rm ../outside",
      "timeout 1 rm ../outside",
    ]) {
      const result = runHook(command, cwd);
      assert.equal(result.denied, true, command);
      assert.match(result.reason ?? "", /Protected cwd/u, command);
    }
  });
});

test("fails closed for ambiguous deletion targets and traversal", () => {
  withTempDir((root) => {
    const cwd = join(root, "workspace");
    mkdirSync(cwd);
    for (const command of [
      "rm $TARGET",
      "rm *.tmp",
      "rm {../outside,inside}",
      "find -L . -delete",
      "find . -follow -delete",
      "find -P ../outside -delete",
      "find -- ../outside -delete",
      "find -O3 ../outside -delete",
      "find -E ../outside -delete",
      "find -x ../outside -delete",
      "find -files0-from roots.txt -delete",
      "git --work-tree=../outside clean -fd",
      "git -C../outside clean -fd",
      "git -c core.worktree=../outside clean -fd",
      "git clean -fd -- :/",
      "env -C nested rm file",
    ]) {
      assert.equal(runHook(command, cwd).denied, true, command);
    }
    assert.equal(runHook("rm inside", undefined).denied, true);
    assert.equal(runHook("echo rm", undefined).denied, false);
    assert.equal(runHook("find . -name file", undefined).denied, false);
    assert.equal(
      runRawHook(
        '{"cwd":"/tmp/workspace","tool_input":{"command":"rm ../outside"}',
      ).denied,
      true,
    );
    assert.equal(
      runRawHook('{"tool_input":{"command":"echo rm"}').denied,
      false,
    );
  });
});

test("allows deleting an in-root symlink but denies deleting through it", () => {
  withTempDir((root) => {
    const cwd = join(root, "workspace");
    const outside = join(root, "outside");
    mkdirSync(cwd);
    mkdirSync(outside);
    symlinkSync(outside, join(cwd, "external-link"));

    assert.equal(runHook("rm external-link", cwd).denied, false);
    assert.equal(runHook("rm external-link/file", cwd).denied, true);
    assert.equal(runHook("git -C external-link clean -fd", cwd).denied, true);
    assert.equal(runHook("find external-link -delete", cwd).denied, true);
  });
});

test("leaves unrelated commands unaffected", () => {
  withTempDir((root) => {
    const cwd = join(root, "workspace");
    mkdirSync(cwd);
    assert.equal(runHook("printf 'rm ../outside'", cwd).denied, false);
    assert.equal(runHook("git status", cwd).denied, false);
    assert.equal(runHook("find . -name '*.tmp'", cwd).denied, false);
    assert.equal(runHook('printf "$(printf rm)"', cwd).denied, false);
    assert.equal(
      runHook('printf "%s" "$(find . -name file)"', cwd).denied,
      false,
    );
  });
});
