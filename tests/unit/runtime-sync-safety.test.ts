import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  manifestHash,
  readManagedRuntimeManifest,
  writeManagedRuntimeManifestAtomic,
} from "../../scripts/ax/runtime-state.ts";
import {
  type AxRuntimeConfig,
  runtimePaths,
  syncRuntime,
} from "../../scripts/ax/runtime-sync.ts";
import { hashPath } from "../../scripts/ax/source-snapshot.ts";
import {
  applyTransaction,
  inspectTransactions,
  TransactionInterruption,
} from "../../scripts/ax/transaction-engine.ts";

type RuntimeFixture = {
  sourceRoot: string;
  runtimeRoot: string;
  installRoot: string;
  config: AxRuntimeConfig;
};

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "runtime-sync-safety-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function createFixture(root: string): RuntimeFixture {
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const installRoot = join(root, "installed");
  for (const name of ["explore", "plan", "execute", "review", "finish"]) {
    const skill = join(sourceRoot, "skills", name);
    mkdirSync(skill, { recursive: true });
    writeFileSync(
      join(skill, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name}\n---\n# ${name}\n`,
      "utf-8",
    );
  }
  mkdirSync(join(sourceRoot, "instructions"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "instructions", "AGENTS.md"),
    "# Agents\n",
    "utf-8",
  );
  mkdirSync(join(sourceRoot, "rules"), { recursive: true });
  writeFileSync(join(sourceRoot, "rules", "base.md"), "# Rule\n", "utf-8");
  mkdirSync(join(sourceRoot, "hooks"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "hooks", "startup.ts"),
    "export const version = 1;\n",
    "utf-8",
  );

  const config: AxRuntimeConfig = {
    version: 1,
    runtime: {
      canonicalSkillsDir: join(installRoot, "agents", "skills"),
      skillSymlinkTargets: [
        join(installRoot, "codex", "skills"),
        join(installRoot, "claude", "skills"),
      ],
      instructionSymlinkTargets: {
        agents: join(installRoot, "agents"),
        codex: join(installRoot, "codex"),
        claude: join(installRoot, "claude"),
      },
      hooks: {
        sourceDir: "hooks",
        canonicalDir: join(installRoot, "agents", "hooks"),
        targets: {
          codex: join(installRoot, "codex", "hooks"),
          claude: join(installRoot, "claude", "hooks"),
        },
      },
    },
    profiles: {
      personal: {
        include: ["modes"],
        paths: [
          { sourcePath: "instructions/AGENTS.md", targetPath: "AGENTS.md" },
          "rules/base.md",
        ],
      },
    },
    blocks: {
      modes: {
        skills: [
          {
            localPath: "skills",
            names: ["explore", "plan", "execute", "review", "finish"],
          },
        ],
      },
    },
  };
  return { sourceRoot, runtimeRoot, installRoot, config };
}

function initialize(fixture: RuntimeFixture): void {
  syncRuntime({
    ...fixture,
    profiles: ["personal"],
    policyProfile: "personal",
    interactive: false,
  });
}

function createInterruptedRuntimeTransaction(
  fixture: RuntimeFixture,
  root: string,
  paths: ReturnType<typeof runtimePaths>,
): string {
  const target = join(fixture.installRoot, "agents", "skills", "explore");
  const candidate = join(root, "candidate-explore");
  mkdirSync(target, { recursive: true });
  mkdirSync(candidate, { recursive: true });
  writeFileSync(join(target, "SKILL.md"), "# Previous\n", "utf-8");
  writeFileSync(join(candidate, "SKILL.md"), "# Candidate\n", "utf-8");
  const previousHash = hashPath(target);
  const candidateHash = hashPath(candidate);
  if (previousHash === "absent" || candidateHash === "absent") {
    throw new Error("recovery fixture payloads must exist");
  }
  writeManagedRuntimeManifestAtomic(paths.manifestPath, {
    schemaVersion: 1,
    hashVersion: "sha256-tree-v1",
    installedProfiles: ["personal"],
    policyProfile: "personal",
    ownedPaths: { [target]: previousHash },
  });
  const candidateManifest = join(root, "candidate-manifest.json");
  writeManagedRuntimeManifestAtomic(candidateManifest, {
    schemaVersion: 1,
    hashVersion: "sha256-tree-v1",
    installedProfiles: ["personal"],
    policyProfile: "personal",
    ownedPaths: { [target]: candidateHash },
  });
  assert.throws(
    () =>
      applyTransaction({
        domain: "runtime",
        root: paths.runtimeRoot,
        lockPath: paths.lockPath,
        transactionsRoot: paths.transactionsRoot,
        backupsRoot: paths.backupsRoot,
        targetRoots: [],
        directChildTargetRoots: [],
        exactTargetPaths: [target, paths.manifestPath],
        operations: [
          {
            path: target,
            asset: "skills/explore",
            candidatePath: candidate,
            previousOwnership: { hash: previousHash },
            candidateOwnership: { hash: candidateHash },
          },
        ],
        manifestPath: paths.manifestPath,
        candidateManifestPath: candidateManifest,
        metadata: {
          previousProfiles: ["personal"],
          previousPolicyProfile: "personal",
          candidateProfiles: ["personal"],
          candidatePolicyProfile: "personal",
          previousInventory: { personal: [target] },
          candidateInventory: { personal: [target] },
        },
        fault: (point) => {
          if (point.startsWith("after-target:")) {
            throw new TransactionInterruption();
          }
        },
      }),
    TransactionInterruption,
  );
  return target;
}

test("first interactive sync selects installed and policy profiles", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    const confirmations: string[] = [];
    const result = syncRuntime({
      ...fixture,
      interactive: true,
      selectProfileSelection: (input) => {
        assert.deepEqual(input.availableProfiles, ["personal"]);
        assert.deepEqual(input.requestedProfiles, []);
        return {
          installedProfiles: ["personal"],
          policyProfile: "personal",
        };
      },
      confirm: (message) => {
        confirmations.push(message);
        return true;
      },
    });

    assert.equal(result.status, "synchronized");
    assert.deepEqual(result.installedProfiles, ["personal"]);
    assert.equal(result.policyProfile, "personal");
    assert.match(confirmations[0] ?? "", /Initialize runtime profiles/);
  });
});

test("shared profile assets use distinct staging entries before deduplication", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    fixture.config.profiles.work = {
      include: ["modes"],
      paths: [...fixture.config.profiles.personal.paths],
    };

    const result = syncRuntime({
      ...fixture,
      allProfiles: true,
      policyProfile: "work",
      interactive: false,
    });

    assert.deepEqual(result.installedProfiles, ["personal", "work"]);
    assert.equal(result.policyProfile, "work");
    assert.ok(readManagedRuntimeManifest(result.manifestPath));
  });
});

test("runtime planning rejects an external edit before transaction retention", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    const target = join(fixture.installRoot, "agents", "skills", "explore");
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "SKILL.md"), "# Legacy\n", "utf-8");
    let edited = false;

    assert.throws(
      () =>
        syncRuntime({
          ...fixture,
          profiles: ["personal"],
          policyProfile: "personal",
          interactive: true,
          confirm: (message) => {
            if (message.startsWith(`replace-managed ${target} `)) {
              writeFileSync(
                join(target, "SKILL.md"),
                "# Concurrent edit\n",
                "utf-8",
              );
              edited = true;
            }
            return true;
          },
        }),
      /transaction_previous_hash_mismatch/,
    );
    assert.equal(edited, true);
    assert.equal(
      readFileSync(join(target, "SKILL.md"), "utf-8"),
      "# Concurrent edit\n",
    );
    const paths = runtimePaths(fixture.runtimeRoot);
    assert.equal(existsSync(paths.manifestPath), false);
    assert.deepEqual(inspectTransactions(paths.transactionsRoot), []);
  });
});

test("scoped hooks and instructions sync neither fetch nor prune other surfaces", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    initialize(fixture);
    const skillPath = join(fixture.installRoot, "agents", "skills", "explore");
    const instructionPath = join(
      fixture.installRoot,
      "agents",
      "rules",
      "base.md",
    );
    const hooksPath = join(fixture.installRoot, "agents", "hooks");
    const initialSkillHash = hashPath(skillPath);
    const initialInstructionHash = hashPath(instructionPath);

    fixture.config.blocks.unavailable = {
      skills: [
        {
          url: join(root, "unavailable.git"),
          ref: "main",
          basePath: "skills",
          names: ["unavailable-skill"],
        },
      ],
    };
    fixture.config.profiles.personal.include.push("unavailable");
    writeFileSync(
      join(fixture.sourceRoot, "hooks", "startup.ts"),
      "export const version = 2;\n",
      "utf-8",
    );

    const hooks = syncRuntime({
      ...fixture,
      surface: "hooks",
      interactive: false,
    });
    assert.equal(hooks.status, "synchronized");
    assert.equal(hashPath(skillPath), initialSkillHash);
    assert.equal(hashPath(instructionPath), initialInstructionHash);

    writeFileSync(
      join(fixture.sourceRoot, "rules", "base.md"),
      "# Updated rule\n",
      "utf-8",
    );
    const instructions = syncRuntime({
      ...fixture,
      surface: "instructions",
      interactive: false,
    });
    assert.equal(instructions.status, "synchronized");
    assert.equal(hashPath(skillPath), initialSkillHash);
    assert.notEqual(hashPath(instructionPath), initialInstructionHash);
    assert.match(
      readFileSync(join(hooksPath, "startup.ts"), "utf-8"),
      /version = 2/,
    );

    const manifest = readManagedRuntimeManifest(
      join(fixture.runtimeRoot, "managed-runtime.json"),
    );
    assert.ok(manifest?.ownedPaths[skillPath]);
    assert.ok(manifest?.ownedPaths[hooksPath]);
  });
});

test("non-skill scoped sync leaves unmanaged retired lifecycle content alone", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    initialize(fixture);
    const retiredPath = join(
      fixture.installRoot,
      "agents",
      "skills",
      "brainstorming",
    );
    mkdirSync(retiredPath, { recursive: true });
    writeFileSync(join(retiredPath, "SKILL.md"), "# Retired\n", "utf-8");

    assert.doesNotThrow(() =>
      syncRuntime({
        ...fixture,
        surface: "hooks",
        interactive: false,
      }),
    );
    assert.equal(existsSync(retiredPath), true);
    assert.throws(
      () =>
        syncRuntime({
          ...fixture,
          surface: "skills",
          interactive: false,
        }),
      /adoption_required: remove/,
    );
  });
});

test("profile migration derives previous inventory from manifest ownership", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    initialize(fixture);
    const manifestPath = join(fixture.runtimeRoot, "managed-runtime.json");
    const manifest = readManagedRuntimeManifest(manifestPath);
    assert.ok(manifest);
    fixture.config.profiles.work = {
      include: [...fixture.config.profiles.personal.include],
      paths: [...fixture.config.profiles.personal.paths],
    };
    delete fixture.config.profiles.personal;
    const selectionFile = join(root, "profile-selection.json");
    writeFileSync(
      selectionFile,
      `${JSON.stringify({
        schemaVersion: 1,
        hashVersion: "sha256-tree-v1",
        currentManifestHash: manifestHash(manifest),
        installedProfiles: ["work"],
        policyProfile: "work",
      })}\n`,
      "utf-8",
    );

    const result = syncRuntime({
      ...fixture,
      profileSelectionFile: selectionFile,
      interactive: false,
    });
    assert.deepEqual(result.installedProfiles, ["work"]);
    assert.equal(result.policyProfile, "work");
  });
});

test("recovery can restore a previously owned path removed from current config", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    const paths = runtimePaths(fixture.runtimeRoot);
    const target = join(fixture.installRoot, "agents", "rules", "base.md");
    mkdirSync(join(fixture.installRoot, "agents", "rules"), {
      recursive: true,
    });
    writeFileSync(target, "# Previous rule\n", "utf-8");
    const previousHash = hashPath(target);
    if (previousHash === "absent") {
      throw new Error("recovery fixture target must exist");
    }
    writeManagedRuntimeManifestAtomic(paths.manifestPath, {
      schemaVersion: 1,
      hashVersion: "sha256-tree-v1",
      installedProfiles: ["personal"],
      policyProfile: "personal",
      ownedPaths: { [target]: previousHash },
    });
    const candidateManifest = join(root, "candidate-manifest.json");
    writeManagedRuntimeManifestAtomic(candidateManifest, {
      schemaVersion: 1,
      hashVersion: "sha256-tree-v1",
      installedProfiles: ["personal"],
      policyProfile: "personal",
      ownedPaths: {},
    });
    assert.throws(
      () =>
        applyTransaction({
          domain: "runtime",
          root: paths.runtimeRoot,
          lockPath: paths.lockPath,
          transactionsRoot: paths.transactionsRoot,
          backupsRoot: paths.backupsRoot,
          targetRoots: [],
          directChildTargetRoots: [],
          exactTargetPaths: [target, paths.manifestPath],
          operations: [
            {
              path: target,
              asset: "managed-prune",
              delete: true,
              previousOwnership: { hash: previousHash },
              candidateOwnership: null,
            },
          ],
          manifestPath: paths.manifestPath,
          candidateManifestPath: candidateManifest,
          metadata: {
            previousProfiles: ["personal"],
            previousPolicyProfile: "personal",
            candidateProfiles: ["personal"],
            candidatePolicyProfile: "personal",
            previousInventory: { personal: [target] },
            candidateInventory: { personal: [] },
          },
          fault: (point) => {
            if (point === "after-manifest") {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    writeFileSync(target, "# External rule\n", "utf-8");
    const [transaction] = inspectTransactions(paths.transactionsRoot);
    assert.ok(transaction);
    const recoveryFile = join(root, "removed-path-recovery.json");
    writeFileSync(
      recoveryFile,
      `${JSON.stringify({
        schemaVersion: 1,
        hashVersion: "sha256-tree-v1",
        transactionId: transaction.transactionId,
        domain: "runtime",
        currentManifestHash: hashPath(paths.manifestPath),
        currentTargetHashes: { [target]: hashPath(target) },
        actions: { [target]: "restore-previous" },
      })}\n`,
      "utf-8",
    );
    fixture.config.profiles.personal.paths = [];

    const result = syncRuntime({
      ...fixture,
      recoveryFile,
      interactive: false,
    });
    assert.equal(result.status, "recovered");
    assert.equal(readFileSync(target, "utf-8"), "# Previous rule\n");
    const recovered = readManagedRuntimeManifest(paths.manifestPath);
    assert.equal(recovered?.ownedPaths[target], previousHash);
  });
});

test("runtime configuration rejects path escapes and overlapping roots", () => {
  const cases: Array<{
    name: string;
    mutate: (fixture: RuntimeFixture, root: string) => void;
    expected: RegExp;
  }> = [
    {
      name: "skill name",
      mutate: (fixture) => {
        const source = fixture.config.blocks.modes.skills?.[0];
        if (source) {
          source.names = ["../escape"];
        }
      },
      expected: /skill_name_invalid/,
    },
    {
      name: "remote base path",
      mutate: (fixture, root) => {
        fixture.config.blocks.remote = {
          skills: [
            {
              url: join(root, "remote.git"),
              ref: "main",
              basePath: "../skills",
              names: ["remote-skill"],
            },
          ],
        };
        fixture.config.profiles.personal.include.push("remote");
      },
      expected: /remote_base_path_invalid/,
    },
    {
      name: "instruction target",
      mutate: (fixture) => {
        fixture.config.profiles.personal.paths = [
          {
            sourcePath: "instructions/AGENTS.md",
            targetPath: "../AGENTS.md",
          },
        ];
      },
      expected: /instruction_target_path_invalid/,
    },
    {
      name: "symlink parent",
      mutate: (fixture, root) => {
        const agentsRoot = join(fixture.installRoot, "agents");
        const outside = join(root, "outside");
        mkdirSync(agentsRoot, { recursive: true });
        mkdirSync(outside, { recursive: true });
        symlinkSync(outside, join(agentsRoot, "rules"));
      },
      expected: /runtime_target_escape/,
    },
    {
      name: "symlink parent crosses managed surfaces",
      mutate: (fixture) => {
        const agentsRoot = join(fixture.installRoot, "agents");
        const skillsRoot = join(agentsRoot, "skills");
        mkdirSync(skillsRoot, { recursive: true });
        symlinkSync("skills", join(agentsRoot, "rules"));
      },
      expected: /instruction_target_surface_conflict/,
    },
    {
      name: "overlapping skill roots",
      mutate: (fixture) => {
        fixture.config.runtime.skillSymlinkTargets = [
          fixture.config.runtime.canonicalSkillsDir,
        ];
      },
      expected: /runtime_root_overlap/,
    },
  ];

  for (const scenario of cases) {
    withTempDir((root) => {
      const fixture = createFixture(root);
      scenario.mutate(fixture, root);
      assert.throws(
        () =>
          syncRuntime({
            ...fixture,
            profiles: ["personal"],
            policyProfile: "personal",
            interactive: false,
          }),
        scenario.expected,
        scenario.name,
      );
    });
  }
});

test("runtime recovery uses retained payloads before live-source verification", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    const home = join(root, "home");
    mkdirSync(home, { recursive: true });
    const previousHome = process.env.HOME;
    const previousIsolation = process.env.AX_ISOLATED_RUNTIME;
    process.env.HOME = home;
    delete process.env.AX_ISOLATED_RUNTIME;
    try {
      const paths = runtimePaths();
      const target = join(fixture.installRoot, "agents", "skills", "explore");
      const candidate = join(root, "candidate-explore");
      mkdirSync(target, { recursive: true });
      mkdirSync(candidate, { recursive: true });
      writeFileSync(join(target, "SKILL.md"), "# Previous\n", "utf-8");
      writeFileSync(join(candidate, "SKILL.md"), "# Candidate\n", "utf-8");
      const previousHash = hashPath(target);
      const candidateHash = hashPath(candidate);
      if (previousHash === "absent" || candidateHash === "absent") {
        throw new Error("recovery fixture payloads must exist");
      }
      writeManagedRuntimeManifestAtomic(paths.manifestPath, {
        schemaVersion: 1,
        hashVersion: "sha256-tree-v1",
        installedProfiles: ["personal"],
        policyProfile: "personal",
        ownedPaths: { [target]: previousHash },
      });
      const candidateManifest = join(root, "candidate-manifest.json");
      writeManagedRuntimeManifestAtomic(candidateManifest, {
        schemaVersion: 1,
        hashVersion: "sha256-tree-v1",
        installedProfiles: ["personal"],
        policyProfile: "personal",
        ownedPaths: { [target]: candidateHash },
      });
      assert.throws(
        () =>
          applyTransaction({
            domain: "runtime",
            root: paths.runtimeRoot,
            lockPath: paths.lockPath,
            transactionsRoot: paths.transactionsRoot,
            backupsRoot: paths.backupsRoot,
            targetRoots: [],
            directChildTargetRoots: [],
            exactTargetPaths: [target, paths.manifestPath],
            operations: [
              {
                path: target,
                asset: "skills/explore",
                candidatePath: candidate,
                previousOwnership: { hash: previousHash },
                candidateOwnership: { hash: candidateHash },
              },
            ],
            manifestPath: paths.manifestPath,
            candidateManifestPath: candidateManifest,
            metadata: {
              previousProfiles: ["personal"],
              previousPolicyProfile: "personal",
              candidateProfiles: ["personal"],
              candidatePolicyProfile: "personal",
              previousInventory: { personal: [target] },
              candidateInventory: { personal: [target] },
            },
            fault: (point) => {
              if (point.startsWith("after-target:")) {
                throw new TransactionInterruption();
              }
            },
          }),
        TransactionInterruption,
      );
      const [transaction] = inspectTransactions(paths.transactionsRoot);
      assert.ok(transaction);
      const recoveryFile = join(root, "recovery.json");
      writeFileSync(
        recoveryFile,
        `${JSON.stringify({
          schemaVersion: 1,
          hashVersion: "sha256-tree-v1",
          transactionId: transaction.transactionId,
          domain: "runtime",
          currentManifestHash: hashPath(paths.manifestPath),
          currentTargetHashes: { [target]: hashPath(target) },
          actions: { [target]: "restore-previous" },
        })}\n`,
        "utf-8",
      );

      git(fixture.sourceRoot, ["init"]);
      git(fixture.sourceRoot, ["config", "user.email", "ax@example.com"]);
      git(fixture.sourceRoot, ["config", "user.name", "AX Test"]);
      git(fixture.sourceRoot, ["add", "."]);
      git(fixture.sourceRoot, ["commit", "-m", "fixture"]);
      git(fixture.sourceRoot, ["checkout", "-b", "feature"]);
      writeFileSync(
        join(fixture.sourceRoot, "dirty.txt"),
        "dirty source\n",
        "utf-8",
      );

      const result = syncRuntime({
        sourceRoot: fixture.sourceRoot,
        config: fixture.config,
        recoveryFile,
        interactive: false,
      });
      assert.equal(result.status, "recovered");
      assert.match(readFileSync(join(target, "SKILL.md"), "utf-8"), /Previous/);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousIsolation === undefined) {
        delete process.env.AX_ISOLATED_RUNTIME;
      } else {
        process.env.AX_ISOLATED_RUNTIME = previousIsolation;
      }
    }
  });
});

test("automatic runtime recovery completes before live-source verification", () => {
  withTempDir((root) => {
    const fixture = createFixture(root);
    const home = join(root, "home");
    mkdirSync(home, { recursive: true });
    const previousHome = process.env.HOME;
    const previousIsolation = process.env.AX_ISOLATED_RUNTIME;
    process.env.HOME = home;
    delete process.env.AX_ISOLATED_RUNTIME;
    try {
      const paths = runtimePaths();
      const target = createInterruptedRuntimeTransaction(fixture, root, paths);
      git(fixture.sourceRoot, ["init"]);
      git(fixture.sourceRoot, ["config", "user.email", "ax@example.com"]);
      git(fixture.sourceRoot, ["config", "user.name", "AX Test"]);
      git(fixture.sourceRoot, ["add", "."]);
      git(fixture.sourceRoot, ["commit", "-m", "fixture"]);
      git(fixture.sourceRoot, ["checkout", "-b", "feature"]);
      writeFileSync(
        join(fixture.sourceRoot, "dirty.txt"),
        "dirty source\n",
        "utf-8",
      );

      assert.throws(
        () =>
          syncRuntime({
            sourceRoot: fixture.sourceRoot,
            config: fixture.config,
            interactive: false,
          }),
        /unverified_live_source/,
      );
      assert.match(readFileSync(join(target, "SKILL.md"), "utf-8"), /Previous/);
      assert.deepEqual(inspectTransactions(paths.transactionsRoot), []);
    } finally {
      if (previousHome === undefined) {
        delete process.env.HOME;
      } else {
        process.env.HOME = previousHome;
      }
      if (previousIsolation === undefined) {
        delete process.env.AX_ISOLATED_RUNTIME;
      } else {
        process.env.AX_ISOLATED_RUNTIME = previousIsolation;
      }
    }
  });
});

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}
