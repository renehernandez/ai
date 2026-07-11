import assert from "node:assert/strict";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import {
  type AxRuntimeConfig,
  inspectRuntime,
  syncRuntime,
  validateRuntime,
} from "../../scripts/ax/runtime-sync.ts";

function withFixture(
  callback: (input: {
    root: string;
    sourceRoot: string;
    runtimeRoot: string;
    config: AxRuntimeConfig;
    delivery: string;
    operations: string;
  }) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), "coordinator-sync-"));
  try {
    const sourceRoot = join(root, "source");
    cpSync(resolve("agents"), join(sourceRoot, "agents"), { recursive: true });
    cpSync(
      resolve("coordinator-projects"),
      join(sourceRoot, "coordinator-projects"),
      { recursive: true },
    );
    const config = JSON.parse(
      readFileSync("ax.config.json", "utf-8"),
    ) as AxRuntimeConfig;
    config.runtime.canonicalSkillsDir = join(root, "assets", "skills");
    config.runtime.skillSymlinkTargets = [join(root, "codex", "skills")];
    config.runtime.instructionSymlinkTargets = {
      agents: join(root, "instructions", "agents"),
      codex: join(root, "instructions", "codex"),
    };
    config.runtime.hooks = {
      sourceDir: "hooks",
      canonicalDir: join(root, "assets", "hooks"),
      targets: { codex: join(root, "codex", "hooks") },
    };
    config.runtime.agents = {
      sourceDir: "agents",
      canonicalDir: join(root, "assets", "agents"),
      targets: { codex: join(root, "codex", "agents") },
    };
    const delivery = join(root, "agent-control", "delivery");
    const operations = join(root, "agent-control", "operations");
    config.runtime.coordinatorProjects = {
      sourceDir: "coordinator-projects",
      targets: { delivery, operations },
    };
    callback({
      root,
      sourceRoot,
      runtimeRoot: join(root, "runtime"),
      config,
      delivery,
      operations,
    });
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("coordinator sync owns only exact children and refuses unmanaged content", () => {
  withFixture(
    ({ root, sourceRoot, runtimeRoot, config, delivery, operations }) => {
      const sibling = join(root, "agent-control", "notes.md");
      mkdirSync(dirname(sibling), { recursive: true });
      writeFileSync(sibling, "preserve me\n", "utf-8");
      const options = {
        sourceRoot,
        config,
        runtimeRoot,
        surface: "coordinators" as const,
      };
      const first = syncRuntime(options);
      assert.deepEqual(first.changedPaths, [delivery, operations]);
      assert.equal(readFileSync(sibling, "utf-8"), "preserve me\n");
      assert.equal(inspectRuntime(options).ok, true);
      assert.doesNotThrow(() => validateRuntime(options));
      assert.doesNotThrow(() => syncRuntime(options));

      const unmanaged = join(delivery, "local-notes.md");
      writeFileSync(unmanaged, "do not erase\n", "utf-8");
      assert.throws(
        () => syncRuntime(options),
        /unmanaged_coordinator_target:.*content differs/,
      );
      assert.equal(readFileSync(unmanaged, "utf-8"), "do not erase\n");
      assert.equal(readFileSync(sibling, "utf-8"), "preserve me\n");
      assert.equal(existsSync(operations), true);
    },
  );
});

test("coordinator sync refuses a pre-existing unowned target", () => {
  withFixture(({ sourceRoot, runtimeRoot, config, delivery }) => {
    mkdirSync(dirname(delivery), { recursive: true });
    writeFileSync(delivery, "unowned file\n", "utf-8");
    assert.throws(
      () =>
        syncRuntime({
          sourceRoot,
          config,
          runtimeRoot,
          surface: "coordinators",
        }),
      /unmanaged_coordinator_target/,
    );
    assert.equal(readFileSync(delivery, "utf-8"), "unowned file\n");
  });
});

test("coordinator sync refuses a pre-existing unowned directory", () => {
  withFixture(({ sourceRoot, runtimeRoot, config, delivery }) => {
    mkdirSync(delivery, { recursive: true });
    writeFileSync(join(delivery, "notes.md"), "unowned directory\n", "utf-8");
    assert.throws(
      () =>
        syncRuntime({
          sourceRoot,
          config,
          runtimeRoot,
          surface: "coordinators",
        }),
      /unmanaged_coordinator_target/,
    );
    assert.equal(
      readFileSync(join(delivery, "notes.md"), "utf-8"),
      "unowned directory\n",
    );
  });
});

test("coordinator sync refuses a pre-existing link target", () => {
  withFixture(({ root, sourceRoot, runtimeRoot, config, delivery }) => {
    mkdirSync(dirname(delivery), { recursive: true });
    const elsewhere = join(root, "elsewhere");
    mkdirSync(elsewhere, { recursive: true });
    symlinkSync(elsewhere, delivery);
    assert.throws(
      () =>
        syncRuntime({
          sourceRoot,
          config,
          runtimeRoot,
          surface: "coordinators",
        }),
      /unmanaged_coordinator_target:.*link/,
    );
    assert.equal(existsSync(elsewhere), true);
  });
});
