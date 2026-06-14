import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  lstatIfExists,
  replaceSafeSymlink,
  validateSafeSymlinkTargets,
} from "../../scripts/agent-runtime.ts";

function withTempDir(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "agent-runtime-symlink-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

test("replaceSafeSymlink creates file symlinks", () => {
  withTempDir((directory) => {
    const target = join(directory, "target.md");
    const linkPath = join(directory, "link.md");
    writeFileSync(target, "content\n", "utf-8");

    replaceSafeSymlink(target, linkPath);

    assert.equal(lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(readlinkSync(linkPath), target);
  });
});

test("replaceSafeSymlink refuses to replace non-symlink files", () => {
  withTempDir((directory) => {
    const target = join(directory, "target.md");
    const linkPath = join(directory, "existing.md");
    writeFileSync(target, "target\n", "utf-8");
    writeFileSync(linkPath, "existing\n", "utf-8");

    assert.throws(
      () => replaceSafeSymlink(target, linkPath),
      /Refusing to replace non-symlink target/,
    );
  });
});

test("replaceSafeSymlink accepts paths already managed by a parent symlink", () => {
  withTempDir((directory) => {
    const sourceRoot = join(directory, "source");
    const runtimeRoot = join(directory, "runtime");
    mkdirSync(sourceRoot);
    writeFileSync(join(sourceRoot, "rule.md"), "content\n", "utf-8");
    symlinkSync(sourceRoot, runtimeRoot, "dir");

    replaceSafeSymlink(
      join(sourceRoot, "rule.md"),
      join(runtimeRoot, "rule.md"),
    );

    assert.equal(lstatSync(runtimeRoot).isSymbolicLink(), true);
    assert.equal(readlinkSync(runtimeRoot), sourceRoot);
  });
});

test("replaceSafeSymlink replaces dangling symlinks", () => {
  withTempDir((directory) => {
    const target = join(directory, "target.md");
    const missingTarget = join(directory, "missing.md");
    const linkPath = join(directory, "link.md");
    writeFileSync(target, "target\n", "utf-8");
    symlinkSync(missingTarget, linkPath, "file");

    assert.equal(existsSync(linkPath), false);
    assert.equal(lstatIfExists(linkPath)?.isSymbolicLink(), true);

    replaceSafeSymlink(target, linkPath);

    assert.equal(lstatSync(linkPath).isSymbolicLink(), true);
    assert.equal(readlinkSync(linkPath), target);
  });
});

test("validateSafeSymlinkTargets rejects non-symlink files", () => {
  withTempDir((directory) => {
    const linkPath = join(directory, "existing.md");
    writeFileSync(linkPath, "existing\n", "utf-8");

    assert.throws(
      () => validateSafeSymlinkTargets([linkPath]),
      /Refusing to replace non-symlink target/,
    );
  });
});

test("validateSafeSymlinkTargets accepts paths already managed by a parent symlink", () => {
  withTempDir((directory) => {
    const sourceRoot = join(directory, "source");
    const runtimeRoot = join(directory, "runtime");
    mkdirSync(sourceRoot);
    writeFileSync(join(sourceRoot, "rule.md"), "content\n", "utf-8");
    symlinkSync(sourceRoot, runtimeRoot, "dir");

    validateSafeSymlinkTargets([
      {
        linkPath: join(runtimeRoot, "rule.md"),
        target: join(sourceRoot, "rule.md"),
      },
    ]);
  });
});
