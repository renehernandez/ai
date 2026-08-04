import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";

import {
  gitDirtyPaths,
  inspectOpenSpec,
  type OpenSpecConfig,
  openspecPaths,
  parseGitPorcelainZ,
  syncOpenSpec,
  validateOpenSpec,
} from "../../scripts/ax/openspec-sync.ts";
import {
  ABSENT_HASH,
  HASH_VERSION,
  hashPath,
  sha256Bytes,
} from "../../scripts/ax/source-snapshot.ts";
import {
  applyTransaction,
  inspectTransactions,
  RECOVERY_SCHEMA_VERSION,
  TransactionInterruption,
} from "../../scripts/ax/transaction-engine.ts";

const workflows = ["propose", "explore", "apply", "archive"];
const skillNames = [
  "openspec-apply-change",
  "openspec-archive-change",
  "openspec-explore",
  "openspec-propose",
];
const commandNames = ["apply.md", "archive.md", "explore.md", "propose.md"];
const lifecycleOverlays = {
  "openspec-apply-change": [
    "Execute",
    "after the OpenSpec proposal and POC checkpoint are accepted",
  ],
  "openspec-archive-change": [
    "Execute",
    "Incomplete artifacts or tasks hard-block archival",
  ],
  "openspec-explore": [
    "Explore",
    "It is read-only and must not create or update OpenSpec artifacts",
  ],
  "openspec-propose": [
    "Plan",
    "It may create the selected OpenSpec planning artifacts",
  ],
} as const;

const defaultConfig: OpenSpecConfig = {
  tools: ["codex", "claude"],
  schema: "spec-driven",
  profile: "custom",
  delivery: "both",
  workflows,
  canonicalSkillsDir: ".agents/skills",
  canonicalCommandsDir: ".agents/commands",
  skillTargets: {
    codex: ".codex/skills",
    claude: ".claude/skills",
  },
  commandTargets: { claude: ".claude/commands" },
};

function withRepository(callback: (root: string) => void): void {
  const root = createRepository();
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function createRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "openspec-sync-safety-"));
  git(root, ["init"]);
  return root;
}

function git(root: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function writeProjectConfig(
  root: string,
  content = "schema: spec-driven\n",
): void {
  mkdirSync(join(root, "openspec"), { recursive: true });
  writeFileSync(join(root, "openspec", "config.yaml"), content, "utf-8");
}

function writeConfiguredInventory(root: string): void {
  writeProjectConfig(root);
  const canonicalSkills = join(root, ".agents", "skills");
  for (const name of skillNames) {
    const skillRoot = join(canonicalSkills, name);
    mkdirSync(skillRoot, { recursive: true });
    writeFileSync(
      join(skillRoot, "SKILL.md"),
      managedContent(
        `---\nname: ${name}\ndescription: Explicit-only developer command. Invoke only when the user explicitly names this OpenSpec adapter or its /opsx command.\n---\n# ${name}\n\n## Explicit Invocation Boundary\n\nDo not infer this adapter from ordinary language. Route ordinary work through the owning lifecycle mode.\n\n<!-- ax-openspec-skill: ${name}; explicit-only -->\n\n${lifecycleOverlay(name)}\n`,
      ),
      "utf-8",
    );
    for (const target of [".codex/skills", ".claude/skills"]) {
      const linkPath = join(root, target, name);
      mkdirSync(dirname(linkPath), { recursive: true });
      symlinkSync(relative(dirname(linkPath), skillRoot), linkPath);
    }
  }
  const canonicalCommands = join(root, ".agents", "commands", "opsx");
  mkdirSync(canonicalCommands, { recursive: true });
  for (const name of commandNames) {
    const command = name.replace(/\.md$/, "");
    writeFileSync(
      join(canonicalCommands, name),
      managedContent(
        `# ${name}\n\n<!-- ax-openspec-command: ${name}; explicit-only -->\n<!-- Invoke only as /opsx:${command}; do not infer from ordinary language. -->\n\n${lifecycleOverlay(name)}\n`,
      ),
      "utf-8",
    );
  }
  const commandLink = join(root, ".claude", "commands", "opsx");
  mkdirSync(dirname(commandLink), { recursive: true });
  symlinkSync(relative(dirname(commandLink), canonicalCommands), commandLink);
}

function lifecycleOverlay(assetName: string): string {
  const skillName = assetName.endsWith(".md")
    ? `openspec-${assetName.replace(/\.md$/, "")}${assetName === "apply.md" || assetName === "archive.md" ? "-change" : ""}`
    : assetName;
  const [mode, requiredText] =
    lifecycleOverlays[skillName as keyof typeof lifecycleOverlays];
  const completeText = {
    "openspec-apply-change": `${requiredText}. Preserve one repository writer, implement final units independently from POC commits, and return provider or terminal actions to Finish.`,
    "openspec-archive-change": `${requiredText}. Synchronize delta specs into canonical specs before moving the verified change to the dated archive; Finish does not perform archival as cleanup.`,
    "openspec-explore": `${requiredText}, repository files, trackers, or providers. Return evidence and route any durable artifact to Plan.`,
    "openspec-propose": `${requiredText}, but it does not implement, publish, merge, deploy, or clean up.`,
  }[skillName];
  const prefix =
    skillName === "openspec-explore"
      ? "This adapter runs only inside Explore."
      : skillName === "openspec-propose"
        ? "This adapter runs only inside Plan."
        : skillName === "openspec-archive-change"
          ? "This adapter runs only in the last final Execute unit."
          : "This adapter runs only inside Execute";
  return `## AX Lifecycle Overlay\n\n${prefix} ${completeText}\n\n<!-- ax-openspec-lifecycle: ${mode} -->`;
}

function managedContent(content: string): string {
  const base = `${content.trimEnd()}\n`;
  return `${base}\n<!-- ax-openspec-content-sha256: ${sha256Bytes(base)} -->\n`;
}

test("classifies missing, configured, and partial OpenSpec setup exactly", () => {
  withRepository((root) => {
    mkdirSync(join(root, "openspec"));
    assert.equal(
      inspectOpenSpec({ targetRoot: root, config: defaultConfig }).state,
      "missing",
    );

    writeConfiguredInventory(root);
    const configured = inspectOpenSpec({
      targetRoot: root,
      config: defaultConfig,
    });
    assert.equal(
      configured.state,
      "configured",
      configured.findings.join("\n"),
    );

    rmSync(join(root, ".agents", "skills", "openspec-archive-change"), {
      recursive: true,
    });
    const incomplete = inspectOpenSpec({
      targetRoot: root,
      config: defaultConfig,
    });
    assert.equal(incomplete.state, "partial_repairable");
    assert.match(
      incomplete.findings.join("\n"),
      /openspec_skill_missing:.*openspec-archive-change/,
    );
  });
});

test("requires context for generated inventory without valid config", () => {
  withRepository((root) => {
    mkdirSync(join(root, ".agents", "skills", "openspec-apply-change"), {
      recursive: true,
    });
    const report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_context_required");
    assert.match(report.findings.join("\n"), /missing_openspec_config/);
  });
});

test("reports stale content and harness links as repairable partial state", () => {
  withRepository((root) => {
    writeConfiguredInventory(root);
    const skillRoot = join(root, ".agents", "skills", "openspec-apply-change");
    writeFileSync(
      join(skillRoot, "SKILL.md"),
      "---\nname: openspec-apply-change\ndescription: stale\n---\n",
      "utf-8",
    );
    const codexLink = join(root, ".codex", "skills", "openspec-archive-change");
    rmSync(codexLink);
    mkdirSync(codexLink);

    const report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_repairable");
    assert.match(
      report.findings.join("\n"),
      /openspec_adapter_not_explicit_only:.*openspec-apply-change/,
    );
    assert.match(
      report.findings.join("\n"),
      /openspec_link_not_symlink:.*openspec-archive-change/,
    );
  });
});

test("rejects unknown project schemas and artifact rules", () => {
  withRepository((root) => {
    writeProjectConfig(root, "schema: future-driven\n");
    let report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_context_required");
    assert.match(
      report.findings.join("\n"),
      /openspec_config_unknown_schema: future-driven/,
    );

    writeProjectConfig(
      root,
      "schema: spec-driven\nrules:\n  deployment:\n    - Require rollback\n",
    );
    report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_context_required");
    assert.match(
      report.findings.join("\n"),
      /openspec_config_unknown_rule_artifact: deployment/,
    );
  });
});

test("accepts the documented fail-closed YAML subset", () => {
  withRepository((root) => {
    writeProjectConfig(
      root,
      `"schema": "spec-driven"
'context': >-
  First context line
  continues here
"rules": {}
`,
    );
    let report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_repairable");
    assert.doesNotMatch(
      report.findings.join("\n"),
      /openspec_config_(?:invalid|unknown_field)/,
    );

    writeProjectConfig(
      root,
      `schema: spec-driven
rules:
  "proposal":
    - "Keep the proposal concise"
`,
    );
    report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.doesNotMatch(
      report.findings.join("\n"),
      /openspec_config_(?:invalid|unknown_rule_artifact)/,
    );
  });
});

test("interactive setup previews every resolved configuration field", () => {
  withRepository((root) => {
    const fakeRoot = mkdtempSync(join(tmpdir(), "openspec-preview-bin-"));
    const fakeOpenSpec = join(fakeRoot, "openspec");
    writeFileSync(
      fakeOpenSpec,
      '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "openspec-test 1.0"; fi\n',
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeRoot}:/usr/bin:/bin`;
    let preview = "";
    try {
      assert.throws(
        () =>
          syncOpenSpec({
            targetRoot: root,
            config: defaultConfig,
            interactive: true,
            confirm: (message) => {
              preview = message;
              return false;
            },
          }),
        /openspec_context_not_confirmed/,
      );
      assert.match(preview, /tools: codex, claude/);
      assert.match(preview, /schema: spec-driven/);
      assert.match(preview, /workflow profile: custom/);
      assert.match(preview, /delivery: both/);
      assert.match(preview, /workflows: propose, explore, apply, archive/);
      assert.match(preview, /project context:/);
      assert.equal(existsSync(join(root, "openspec")), false);
    } finally {
      process.env.PATH = previousPath;
      rmSync(fakeRoot, { force: true, recursive: true });
    }
  });
});

test("config review preserves project context and rules unless explicitly changed", () => {
  withRepository((root) => {
    writeConfiguredInventory(root);
    const configPath = join(root, "openspec", "config.yaml");
    const current = `schema: spec-driven
context: |
  Existing project context
rules:
  proposal:
    - "Keep the proposal concise"
`;
    writeFileSync(configPath, current, "utf-8");
    git(root, ["add", "."]);
    git(root, [
      "-c",
      "user.name=AX Test",
      "-c",
      "user.email=ax@example.test",
      "commit",
      "-m",
      "fixture",
    ]);
    const fakeRoot = mkdtempSync(join(tmpdir(), "openspec-review-bin-"));
    const fakeOpenSpec = join(fakeRoot, "openspec");
    writeFileSync(
      fakeOpenSpec,
      '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "openspec-test 1.0"; fi\nexit 0\n',
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeRoot}:/usr/bin:/bin`;
    try {
      syncOpenSpec({
        targetRoot: root,
        config: defaultConfig,
        reviewConfig: true,
        acceptConfigChanges: true,
        interactive: false,
      });
      assert.equal(readFileSync(configPath, "utf-8"), current);

      const preview = syncOpenSpec({
        targetRoot: root,
        config: { ...defaultConfig, context: "Reviewed project context" },
        reviewConfig: true,
        interactive: false,
      });
      assert.equal(preview.configReview?.applied, false);
      assert.match(
        preview.configReview?.proposed ?? "",
        /Reviewed project context/,
      );
      assert.match(preview.configReview?.proposed ?? "", /proposal:/);
      assert.equal(readFileSync(configPath, "utf-8"), current);

      const applied = syncOpenSpec({
        targetRoot: root,
        config: { ...defaultConfig, context: "Reviewed project context" },
        reviewConfig: true,
        acceptConfigChanges: true,
        interactive: false,
      });
      assert.equal(applied.configReview?.applied, true);
      const reviewed = readFileSync(configPath, "utf-8");
      assert.match(reviewed, /Reviewed project context/);
      assert.match(reviewed, /proposal:/);
      assert.match(reviewed, /Keep the proposal concise/);
    } finally {
      process.env.PATH = previousPath;
      rmSync(fakeRoot, { force: true, recursive: true });
    }
  });
});

test("detects altered generated bodies and contradictory trigger metadata", () => {
  const root = createRepository();
  try {
    writeConfiguredInventory(root);
    const exploreSkillPath = join(
      root,
      ".agents",
      "skills",
      "openspec-explore",
      "SKILL.md",
    );
    const exploreSkill = readFileSync(exploreSkillPath, "utf-8").replace(
      /\n?<!-- ax-openspec-content-sha256: sha256:[a-f0-9]{64} -->\s*$/,
      "\nUse this flow when the explicitly invoked adapter needs exploration.\n",
    );
    writeFileSync(exploreSkillPath, managedContent(exploreSkill), "utf-8");
    assert.equal(
      inspectOpenSpec({ targetRoot: root, config: defaultConfig }).state,
      "configured",
    );

    const commandPath = join(root, ".agents", "commands", "opsx", "apply.md");
    writeFileSync(
      commandPath,
      readFileSync(commandPath, "utf-8").replace("# apply.md", "# altered"),
      "utf-8",
    );
    let report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_repairable");
    assert.match(
      report.findings.join("\n"),
      /openspec_generated_content_stale:.*apply\.md/,
    );

    const skillPath = join(
      root,
      ".agents",
      "skills",
      "openspec-apply-change",
      "SKILL.md",
    );
    const skill = readFileSync(skillPath, "utf-8")
      .replace(
        /\n?<!-- ax-openspec-content-sha256: sha256:[a-f0-9]{64} -->\s*$/,
        "",
      )
      .replace("description:", "triggers: ordinary language\ndescription:");
    writeFileSync(skillPath, managedContent(skill), "utf-8");
    report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.match(
      report.findings.join("\n"),
      /openspec_adapter_contradictory_trigger:.*openspec-apply-change/,
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("generated lifecycle overlays converge twice and hard-block archive bypasses", () => {
  const root = createRepository();
  try {
    writeConfiguredInventory(root);
    git(root, ["add", "."]);
    git(root, [
      "-c",
      "user.name=AX Test",
      "-c",
      "user.email=ax@example.test",
      "commit",
      "-m",
      "fixture",
    ]);
    const bin = join(root, "bin");
    mkdirSync(bin);
    const fakeOpenSpec = join(bin, "openspec");
    writeFileSync(
      fakeOpenSpec,
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "openspec-test 1.0"; exit 0; fi
for root in .agents/skills/openspec-archive-change .agents/skills/openspec-explore; do mkdir -p "$root"; done
cat > .agents/skills/openspec-archive-change/SKILL.md <<'EOF'
---
name: openspec-archive-change
description: upstream archive
---
Proceed if user confirms
Archive without syncing
Don't block archive on warnings - just inform and confirm
EOF
cat > .agents/skills/openspec-explore/SKILL.md <<'EOF'
---
name: openspec-explore
description: upstream explore
---
You MAY create OpenSpec artifacts because that's capturing thinking, not implementing.
EOF
exit 0
`,
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    try {
      const first = syncOpenSpec({ targetRoot: root, config: defaultConfig });
      assert.equal(first.status, "synchronized");
      for (const [name, [mode, requiredText]] of Object.entries(
        lifecycleOverlays,
      )) {
        const content = readFileSync(
          join(root, ".agents", "skills", name, "SKILL.md"),
          "utf-8",
        );
        assert.match(content, new RegExp(`ax-openspec-lifecycle: ${mode}`));
        assert.ok(content.includes(requiredText));
      }
      const archive = readFileSync(
        join(root, ".agents", "skills", "openspec-archive-change", "SKILL.md"),
        "utf-8",
      );
      assert.doesNotMatch(
        archive,
        /confirm user wants to proceed|Proceed if user confirms|Archive without syncing|Don't block archive on warnings|Sync skipped|without an override/,
      );
      assert.match(archive, /\n {3}- STOP; incomplete work blocks archival\n/);
      assert.doesNotMatch(
        archive,
        /\n- STOP; incomplete work blocks archival\n/,
      );
      const second = syncOpenSpec({ targetRoot: root, config: defaultConfig });
      assert.equal(second.status, "current");
      assert.deepEqual(second.changedPaths, []);
      assert.equal(
        validateOpenSpec({ targetRoot: root, config: defaultConfig }).state,
        "configured",
      );
    } finally {
      process.env.PATH = previousPath;
    }
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("rejects unsupported AX tools, delivery, and workflows", () => {
  withRepository((root) => {
    const cases: Array<[OpenSpecConfig, RegExp]> = [
      [{ ...defaultConfig, tools: ["unknown"] }, /unknown_tool: unknown/],
      [{ ...defaultConfig, delivery: "remote" }, /unknown_delivery: remote/],
      [
        { ...defaultConfig, workflows: ["teleport"] },
        /unknown_workflow: teleport/,
      ],
    ];
    for (const [config, expected] of cases) {
      const report = inspectOpenSpec({ targetRoot: root, config });
      assert.equal(report.state, "partial_context_required");
      assert.match(report.findings.join("\n"), expected);
    }
  });
});

test("rejects configured path escapes and symlink-parent escapes", () => {
  withRepository((root) => {
    const escapedConfigs: OpenSpecConfig[] = [
      { ...defaultConfig, canonicalSkillsDir: "../outside" },
      { ...defaultConfig, canonicalCommandsDir: "../outside" },
      {
        ...defaultConfig,
        skillTargets: { ...defaultConfig.skillTargets, codex: "../outside" },
      },
      {
        ...defaultConfig,
        commandTargets: {
          ...defaultConfig.commandTargets,
          claude: "../outside",
        },
      },
    ];
    for (const config of escapedConfigs) {
      const escaped = inspectOpenSpec({ targetRoot: root, config });
      assert.equal(escaped.state, "partial_context_required");
      assert.match(escaped.findings.join("\n"), /openspec_path_escape/);
    }
    const rootTarget = inspectOpenSpec({
      targetRoot: root,
      config: { ...defaultConfig, canonicalSkillsDir: "." },
    });
    assert.match(rootTarget.findings.join("\n"), /openspec_path_invalid/);
    const collision = inspectOpenSpec({
      targetRoot: root,
      config: {
        ...defaultConfig,
        skillTargets: {
          ...defaultConfig.skillTargets,
          codex: ".agents/skills",
        },
      },
    });
    assert.match(collision.findings.join("\n"), /openspec_path_collision/);

    const outside = mkdtempSync(join(tmpdir(), "openspec-outside-"));
    try {
      symlinkSync(outside, join(root, ".agents"));
      const linked = inspectOpenSpec({
        targetRoot: root,
        config: defaultConfig,
      });
      assert.equal(linked.state, "partial_context_required");
      assert.match(
        linked.findings.join("\n"),
        /openspec_symlink_parent_escape/,
      );
    } finally {
      rmSync(outside, { force: true, recursive: true });
    }
  });
});

test("rejects unsafe OpenSpec config parents and non-regular config nodes", () => {
  withRepository((root) => {
    const outside = mkdtempSync(join(tmpdir(), "openspec-config-outside-"));
    try {
      writeFileSync(
        join(outside, "config.yaml"),
        "schema: spec-driven\ncontext: external\n",
        "utf-8",
      );
      symlinkSync(outside, join(root, "openspec"));
      let report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
      assert.equal(report.state, "partial_context_required");
      assert.match(report.findings.join("\n"), /openspec_path_parent_symlink/);
      assert.throws(
        () => syncOpenSpec({ targetRoot: root, config: defaultConfig }),
        /openspec_project_paths_invalid/,
      );
      assert.match(
        readFileSync(join(outside, "config.yaml"), "utf-8"),
        /context: external/,
      );

      rmSync(join(root, "openspec"));
      mkdirSync(join(root, "openspec"));
      symlinkSync(
        join(outside, "config.yaml"),
        join(root, "openspec", "config.yaml"),
      );
      report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
      assert.match(report.findings.join("\n"), /openspec_path_config_symlink/);

      rmSync(join(root, "openspec", "config.yaml"));
      mkdirSync(join(root, "openspec", "config.yaml"));
      report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
      assert.match(
        report.findings.join("\n"),
        /openspec_path_config_not_regular_file/,
      );
    } finally {
      rmSync(outside, { force: true, recursive: true });
    }
  });
});

test("status and validate locate OpenSpec without executing it", () => {
  withRepository((root) => {
    writeConfiguredInventory(root);
    const bin = join(root, "bin");
    const invocationLog = join(root, "openspec-invocations.log");
    mkdirSync(bin);
    const fakeOpenSpec = join(bin, "openspec");
    writeFileSync(
      fakeOpenSpec,
      `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(invocationLog)}
if [ "$1" = "--version" ]; then echo "openspec-test 1.0"; fi
exit 0
`,
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    try {
      const status = inspectOpenSpec({
        targetRoot: root,
        config: defaultConfig,
      });
      assert.equal(status.cli.path, fakeOpenSpec);
      assert.equal(status.cli.version, undefined);
      validateOpenSpec({ targetRoot: root, config: defaultConfig });
      assert.equal(existsSync(invocationLog), false);

      const synchronized = syncOpenSpec({
        targetRoot: root,
        config: defaultConfig,
      });
      assert.equal(synchronized.cliVersion, "openspec-test 1.0");
      assert.match(readFileSync(invocationLog, "utf-8"), /^--version$/m);
    } finally {
      process.env.PATH = previousPath;
    }
  });
});

test("OpenSpec planning refuses a touched-path edit before transaction preparation", () => {
  withRepository((root) => {
    writeConfiguredInventory(root);
    git(root, ["add", "."]);
    git(root, [
      "-c",
      "user.name=AX Test",
      "-c",
      "user.email=ax@example.test",
      "commit",
      "-m",
      "fixture",
    ]);
    const fakeRoot = mkdtempSync(join(tmpdir(), "openspec-concurrent-bin-"));
    const fakeOpenSpec = join(fakeRoot, "openspec");
    writeFileSync(
      fakeOpenSpec,
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "openspec-test 1.0"; exit 0; fi
cat > .agents/skills/openspec-apply-change/SKILL.md <<'EOF'
---
name: openspec-apply-change
description: Changed upstream adapter
---
# Changed upstream apply adapter
EOF
exit 0
`,
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const target = join(
      root,
      ".agents",
      "skills",
      "openspec-apply-change",
      "SKILL.md",
    );
    const concurrentContent = "concurrent user edit\n";
    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeRoot}:/usr/bin:/bin`;
    try {
      assert.throws(
        () =>
          syncOpenSpec({
            targetRoot: root,
            config: defaultConfig,
            beforeTransactionApply: () => {
              writeFileSync(target, concurrentContent, "utf-8");
            },
          }),
        /transaction_previous_hash_mismatch/,
      );
      assert.equal(readFileSync(target, "utf-8"), concurrentContent);
    } finally {
      process.env.PATH = previousPath;
      rmSync(fakeRoot, { force: true, recursive: true });
    }
  });
});

test("OpenSpec recovery preserves unmanaged drift and later status reports it", () => {
  withRepository((root) => {
    writeConfiguredInventory(root);
    const paths = openspecPaths(root);
    const target = join(
      root,
      ".agents",
      "skills",
      "openspec-apply-change",
      "SKILL.md",
    );
    const candidate = join(root, "candidate-skill.md");
    writeFileSync(
      candidate,
      managedContent("# transaction candidate\n"),
      "utf-8",
    );
    assert.throws(
      () =>
        applyTransaction({
          domain: `openspec:${resolve(root)}`,
          root,
          lockPath: paths.lockPath,
          transactionsRoot: paths.transactionsRoot,
          backupsRoot: paths.backupsRoot,
          targetRoots: [root],
          operations: [
            {
              path: target,
              asset: "openspec/apply-skill",
              candidatePath: candidate,
            },
          ],
          fault: (point) => {
            if (point.startsWith("after-target:")) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    const unmanagedContent = "external noncanonical content\n";
    writeFileSync(target, unmanagedContent, "utf-8");
    const [transaction] = inspectTransactions(paths.transactionsRoot);
    assert.ok(transaction);
    const recoveryFile = join(root, "openspec-recovery.json");
    writeFileSync(
      recoveryFile,
      `${JSON.stringify({
        schemaVersion: RECOVERY_SCHEMA_VERSION,
        hashVersion: HASH_VERSION,
        transactionId: transaction.transactionId,
        domain: transaction.domain,
        currentManifestHash: ABSENT_HASH,
        currentTargetHashes: { [target]: hashPath(target) },
        actions: { [target]: "preserve-unmanaged" },
      })}\n`,
      "utf-8",
    );

    const recovered = syncOpenSpec({
      targetRoot: root,
      config: defaultConfig,
      recoveryFile,
    });
    assert.equal(recovered.status, "recovered");
    assert.equal(readFileSync(target, "utf-8"), unmanagedContent);
    assert.deepEqual(inspectTransactions(paths.transactionsRoot), []);
    const report = inspectOpenSpec({ targetRoot: root, config: defaultConfig });
    assert.equal(report.state, "partial_repairable");
    assert.match(
      report.findings.join("\n"),
      /openspec_adapter_not_explicit_only/,
    );
  });
});

test("fails closed outside Git and parses porcelain-z paths literally", () => {
  const plain = mkdtempSync(join(tmpdir(), "openspec-non-git-"));
  try {
    assert.throws(
      () => openspecPaths(plain),
      /openspec_git_identity_unavailable/,
    );
  } finally {
    rmSync(plain, { force: true, recursive: true });
  }

  withRepository((root) => {
    const unusual = "notes -> retained\nname.md";
    writeFileSync(join(root, unusual), "dirty\n", "utf-8");
    assert.deepEqual(gitDirtyPaths(root), [unusual]);
    assert.deepEqual(
      parseGitPorcelainZ("R  destination -> literal\nname\0source name\0"),
      ["destination -> literal\nname", "source name"],
    );
  });
});

test("sync refuses to overwrite a dirty managed OpenSpec path", () => {
  withRepository((root) => {
    writeConfiguredInventory(root);
    git(root, ["add", "."]);
    git(root, [
      "-c",
      "user.name=AX Test",
      "-c",
      "user.email=ax@example.test",
      "commit",
      "-m",
      "fixture",
    ]);

    const dirtySkill = join(
      root,
      ".agents",
      "skills",
      "openspec-apply-change",
      "SKILL.md",
    );
    const dirtyContent = `${readFileSync(dirtySkill, "utf-8")}\nLocal edit\n`;
    writeFileSync(dirtySkill, dirtyContent, "utf-8");

    const bin = join(root, "bin");
    mkdirSync(bin);
    const fakeOpenSpec = join(bin, "openspec");
    writeFileSync(
      fakeOpenSpec,
      `#!/bin/sh
if [ "$1" = "--version" ]; then echo "openspec-test 1.0"; exit 0; fi
cat > .agents/skills/openspec-apply-change/SKILL.md <<'EOF'
---
name: openspec-apply-change
description: Upstream generated content
---
# Apply changed by generator
EOF
exit 0
`,
      "utf-8",
    );
    chmodSync(fakeOpenSpec, 0o755);
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:/usr/bin:/bin`;
    try {
      assert.throws(
        () => syncOpenSpec({ targetRoot: root, config: defaultConfig }),
        /openspec_dirty_path:.*openspec-apply-change/,
      );
    } finally {
      process.env.PATH = previousPath;
    }
    assert.equal(readFileSync(dirtySkill, "utf-8"), dirtyContent);
  });
});

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}
