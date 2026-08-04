// charter-contracts: charter-gate, hook-entrypoint
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  validateCharterFixture,
  validateCharterRepository,
} from "../../scripts/charter-validate.ts";
import {
  isPotentialBehaviorSurface,
  validateBehaviorContractCoverage,
} from "../../scripts/charter-validator-contracts.ts";
import { read } from "../../scripts/charter-validator-reader.ts";

const root = process.cwd();

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_PREFIX;
  delete env.GIT_QUARANTINE_PATH;
  delete env.GIT_WORK_TREE;
  return env;
}

const canonicalScenarioFixture =
  'import assert from "node:assert/strict";\nimport { validateCharterFixture } from "../../scripts/charter-validate.ts";\nimport { read } from "../../scripts/charter-validator-reader.ts";\ntest("RED canonical-ownership: rejects a bypass", () => {\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors.includes("bypass"));\n});\ntest("GREEN canonical-ownership: keeps one owner", () => {\nconst validator = read("scripts/charter-validate.ts");\nassert.match(validator, /canonical owner/);\n});\ntest("RED progressive-disclosure: rejects a parallel entrypoint", () => {\nassert.deepEqual(validateCharterFixture(root, fixture), ["unclassified"]);\n});\ntest("GREEN progressive-disclosure: routes through the charter", () => {\nassert.deepEqual(validateCharterFixture(root, fixture), []);\n});\n';

const semanticScenarioFixture =
  'import assert from "node:assert/strict";\nimport { read } from "../../scripts/charter-validator-reader.ts";\ntest("RED authority: rejects unauthorized disposal", () => {\nconst rule = read("rules/git-and-review.md");\nassert.doesNotMatch(rule, /automatic close/);\n});\ntest("GREEN authority: preserves user closure authority", () => {\nconst rule = read("rules/git-and-review.md");\nassert.match(rule, /explicit authority/);\n});\ntest("RED semantic-delivery: rejects obsolete stack propagation", () => {\nconst skill = read("skills/glab-stacked-diffs/SKILL.md");\nassert.doesNotMatch(skill, /restack every descendant/);\n});\ntest("GREEN semantic-delivery: preserves promotion-only restacking", () => {\nconst skill = read("skills/glab-stacked-diffs/SKILL.md");\nassert.match(skill, /promotion-only/);\n});\n';

test("the universal charter governs every shared behavior surface", () => {
  const charter = read("rules/agent-development-workflow-charter.md");
  const repoInstructions = read("AGENTS.md");
  const portableInstructions = read("instructions/AGENTS.md");
  const config = JSON.parse(read("ax.config.json")) as {
    profiles: Record<
      string,
      { include: string[]; paths: Array<string | object> }
    >;
  };

  assert.match(charter, /^# Agent development workflow charter$/m);
  assert.match(charter, /applies to every kind of work/i);
  assert.match(charter, /progressive disclosure/i);
  assert.match(charter, /one canonical owner/i);
  assert.match(charter, /expressive interfaces/i);
  assert.match(charter, /roughly 400 lines/i);
  assert.match(charter, /500 lines/i);
  assert.match(charter, /enabling refactor/i);
  assert.match(
    charter,
    /instructions, rules, skills, agent definitions, hooks, validators,\s+and automation prompts/i,
  );
  assert.match(charter, /clean-context RED\/GREEN pressure scenarios/i);
  assert.match(repoInstructions, /agent-development-workflow-charter\.md/);
  assert.match(portableInstructions, /agent-development-workflow-charter\.md/);

  for (const [name, profile] of Object.entries(config.profiles)) {
    assert.ok(
      profile.paths.includes("rules/agent-development-workflow-charter.md"),
      `${name} must install the charter beside the portable entrypoint`,
    );
  }
});

test("GREEN canonical-ownership: the charter validation gate runs from the native behavior hook", () => {
  const packageJson = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
  };
  const hook = read("lefthook.yml");
  const validator = read("scripts/charter-validate.ts");
  const contracts = read("scripts/charter-validator-contracts.ts");

  assert.equal(
    packageJson.scripts["charter:validate"],
    "tsx scripts/charter-validate.ts",
  );
  assert.equal(
    packageJson.scripts["skills:corpus-report"],
    "tsx scripts/skill-corpus-report.ts",
  );
  assert.equal(
    packageJson.scripts["eval:skills-rules"],
    "vitest --config vitest.evals.config.ts run",
  );
  assert.match(hook, /charter-validate:\s*\n\s+run: pnpm charter:validate/);
  assert.match(validator, /agent-behavior surface/i);
  assert.match(validator, /canonical owner/i);
  assert.match(contracts, /principles:/);
  assert.match(contracts, /contract-specific pressure scenario/i);
  assert.match(contracts, /complete-explanations/);
  assert.match(contracts, /const minimalReaderBinding =/);
  assert.match(
    contracts,
    /linear-breakdown\|linear-project-overview\|linearis/,
  );
  assert.match(
    contracts,
    /agent-surface-routing\|ci-infra-and-cloudflare\|command-and-tools\|docs-and-specs\|git-and-review/,
  );
  assert.doesNotMatch(
    contracts,
    /const (?:changeRequest|simplification)ReaderBinding =/,
  );
});

test("RED charter-gate: contract-free staged behavior changes fail closed", () => {
  assert.match(
    read("scripts/charter-validator-contracts.ts"),
    /simulatedCoverageGap/,
  );
  const invalidScenario =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: no-op", () => {\nassert.ok(true);\n});\ntest("GREEN charter-gate: no-op", () => {\nassert.ok(true);\n});\n';
  assert.deepEqual(
    validateCharterFixture(
      root,
      {
        "scripts/charter-validate.ts": "canonical owner charter validation\n",
        "tests/unit/agent-workflow-charter.test.ts": invalidScenario,
      },
      true,
    ),
    [
      "scripts/charter-validate.ts: contract charter-gate requires staged executable RED and GREEN scenarios in tests/unit/agent-workflow-charter.test.ts",
    ],
  );

  const authorityErrors = validateCharterFixture(
    root,
    {
      "rules/agent-development-workflow-charter.md":
        "Authority follows the accepted outcome and action path.\n",
      "tests/unit/agent-workflow-charter.test.ts": invalidScenario,
    },
    true,
  );

  assert.deepEqual(authorityErrors, [
    "rules/agent-development-workflow-charter.md: contract skill-rule-evals requires staged executable RED and GREEN scenarios in tests/unit/skill-rule-eval-contract.test.ts",
    "rules/agent-development-workflow-charter.md: contract charter-gate requires staged executable RED and GREEN scenarios in tests/unit/agent-workflow-charter.test.ts",
  ]);
});

test("GREEN charter-gate: repository validation executes exact staged, profile, and source-propagated behavior contracts", () => {
  assert.match(
    read("scripts/charter-validator-contracts.ts"),
    /currentManagedSkillCoverageGaps/,
  );
  assert.deepEqual(validateCharterRepository(root), []);
});

test("charter gate routes skill changes to global and specialist contracts", () => {
  const skill = read("skills/code-simplifier/SKILL.md");
  const scenario = read("tests/unit/code-simplifier-skill.test.ts");
  const evalScenario = readFileSync(
    "tests/unit/skill-rule-eval-contract.test.ts",
    "utf8",
  );

  assert.deepEqual(
    validateCharterFixture(
      root,
      {
        "skills/code-simplifier/SKILL.md": skill,
        "tests/unit/code-simplifier-skill.test.ts": scenario,
        "tests/unit/skill-rule-eval-contract.test.ts": evalScenario,
      },
      true,
    ),
    [],
  );
});

test("GREEN progressive-disclosure: ordinary product scripts remain outside the agent-behavior gate", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ax-charter-product-green-"));

  try {
    mkdirSync(join(fixtureRoot, "rules"));
    mkdirSync(join(fixtureRoot, "instructions"));
    writeFileSync(
      join(fixtureRoot, "rules/agent-development-workflow-charter.md"),
      "# Agent development workflow charter\nThis charter applies to every kind of work.\nPrefer one canonical owner.\nUse clean-context RED/GREEN pressure scenarios.\n",
    );
    writeFileSync(
      join(fixtureRoot, "AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );
    writeFileSync(
      join(fixtureRoot, "instructions/AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );

    assert.deepEqual(
      validateCharterFixture(fixtureRoot, {
        "scripts/product-helper.ts": "export const value = 1;\n",
        "scripts/validate-data.ts": "export const validateData = true;\n",
      }),
      [],
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("atomic plans remain governed artifacts rather than reusable behavior surfaces", () => {
  assert.equal(
    isPotentialBehaviorSurface(".agents/plans/intent-based-authority.md"),
    false,
  );
  assert.equal(isPotentialBehaviorSurface(".agents/commands/review.md"), true);
});

test("removal-only policy remains structurally bound to exact-head review evidence", () => {
  for (const path of [
    "rules/agent-development-workflow-charter.md",
    "rules/investigation-and-implementation.md",
  ]) {
    const policy = read(path);
    assert.match(policy, /removal-only MR/);
    assert.match(policy, /target-base-to-\s*source-head Git\s+diff/);
    assert.match(policy, /exact-head\s+`diff-review`/);
  }
});

test("exact-head-only removal policy changes route to the removal evidence contract", () => {
  const change = {
    path: "rules/investigation-and-implementation.md",
    content: "exact-head `diff-review`",
    additions: "exact-head `diff-review`",
  };
  const errors: string[] = [];

  validateBehaviorContractCoverage([change], [change], errors);

  assert.ok(
    errors.some((error) => error.includes("contract removal-only-evidence")),
  );
});

test("future validators and agent prompts require explicit owners", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ax-charter-future-red-"));

  try {
    mkdirSync(join(fixtureRoot, "rules"));
    mkdirSync(join(fixtureRoot, "instructions"));
    writeFileSync(
      join(fixtureRoot, "rules/agent-development-workflow-charter.md"),
      "# Agent development workflow charter\nThis charter applies to every kind of work.\nPrefer one canonical owner.\nUse clean-context RED/GREEN pressure scenarios.\n",
    );
    writeFileSync(
      join(fixtureRoot, "AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );
    writeFileSync(
      join(fixtureRoot, "instructions/AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );

    const errors = validateCharterFixture(fixtureRoot, {
      "scripts/future-agent-validator.ts": "export const validate = true;\n",
      "templates/future-review-prompt.md": "Review everything automatically.\n",
      "tests/unit/agent-workflow-charter.test.ts": canonicalScenarioFixture,
      "tests/unit/agent-workflow-lifecycle.test.ts": semanticScenarioFixture,
    });
    assert.ok(
      errors.some((error) =>
        error.includes(
          "scripts/future-agent-validator.ts: unclassified agent-behavior surface",
        ),
      ),
    );
    assert.ok(
      errors.some((error) =>
        error.includes(
          "templates/future-review-prompt.md: canonical owner templates/future-review-prompt.md does not exist",
        ),
      ),
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("RED canonical-ownership: the charter gate rejects a contradictory rule fixture", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ax-charter-red-"));

  try {
    mkdirSync(join(fixtureRoot, "rules"));
    mkdirSync(join(fixtureRoot, "instructions"));
    mkdirSync(join(fixtureRoot, "tests/unit"), { recursive: true });
    writeFileSync(
      join(fixtureRoot, "rules/agent-development-workflow-charter.md"),
      [
        "# Agent development workflow charter",
        "This charter applies to every kind of work.",
        "Prefer one canonical owner.",
        "Use clean-context RED/GREEN pressure scenarios.",
      ].join("\n"),
    );
    writeFileSync(
      join(fixtureRoot, "AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );
    writeFileSync(
      join(fixtureRoot, "instructions/AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );
    writeFileSync(
      join(fixtureRoot, "rules/git-and-review.md"),
      "Use `glab-mr-create` directly when the user names GitLab.\n",
    );
    writeFileSync(
      join(fixtureRoot, "tests/unit/charter-pressure.test.ts"),
      "// charter-scenarios: canonical-ownership, semantic-delivery\n",
    );

    const errors = validateCharterFixture(fixtureRoot, {
      "rules/git-and-review.md":
        "Use `glab-mr-create` directly when the user names GitLab.\n",
      "tests/unit/agent-workflow-charter.test.ts": canonicalScenarioFixture,
      "tests/unit/agent-workflow-lifecycle.test.ts": semanticScenarioFixture,
    });
    assert.ok(
      errors.includes(
        "rules/git-and-review.md: standalone provider creation adapters must not be selectable behavior",
      ),
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("RED progressive-disclosure: the charter gate rejects an unclassified behavior surface", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ax-charter-owner-red-"));

  try {
    mkdirSync(join(fixtureRoot, "rules"));
    mkdirSync(join(fixtureRoot, "instructions"));
    writeFileSync(
      join(fixtureRoot, "rules/agent-development-workflow-charter.md"),
      [
        "# Agent development workflow charter",
        "This charter applies to every kind of work.",
        "Prefer one canonical owner.",
        "Use clean-context RED/GREEN pressure scenarios.",
      ].join("\n"),
    );
    writeFileSync(
      join(fixtureRoot, "AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );
    writeFileSync(
      join(fixtureRoot, "instructions/AGENTS.md"),
      "See agent-development-workflow-charter.md.\n",
    );

    assert.deepEqual(
      validateCharterFixture(fixtureRoot, {
        ".agents/unknown/bypass.md":
          "Route this review prompt through a new adapter.\n",
        "tests/unit/agent-workflow-charter.test.ts": canonicalScenarioFixture,
        "tests/unit/agent-workflow-lifecycle.test.ts": semanticScenarioFixture,
      }),
      [
        ".agents/unknown/bypass.md: unclassified agent-behavior surface has no canonical owner",
      ],
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test("RED canonical-ownership: alternate commit indexes cannot be masked by worktree repairs", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ax-charter-index-red-"));
  const goodEntrypoint = "See agent-development-workflow-charter.md.\n";

  try {
    mkdirSync(join(fixtureRoot, "rules"));
    mkdirSync(join(fixtureRoot, "instructions"));
    writeFileSync(
      join(fixtureRoot, "rules/agent-development-workflow-charter.md"),
      [
        "# Agent development workflow charter",
        "This charter applies to every kind of work.",
        "Prefer one canonical owner.",
        "Use clean-context RED/GREEN pressure scenarios.",
      ].join("\n"),
    );
    writeFileSync(join(fixtureRoot, "AGENTS.md"), goodEntrypoint);
    writeFileSync(join(fixtureRoot, "instructions/AGENTS.md"), goodEntrypoint);
    const gitEnv = withoutGitRepositoryEnv();
    execFileSync("git", ["init"], { cwd: fixtureRoot, env: gitEnv });
    execFileSync("git", ["add", "."], { cwd: fixtureRoot, env: gitEnv });
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Charter Test",
        "-c",
        "user.email=charter@example.test",
        "commit",
        "-m",
        "baseline",
      ],
      { cwd: fixtureRoot, env: gitEnv },
    );

    const alternateIndex = join(fixtureRoot, ".git", "charter-next-index");
    copyFileSync(join(fixtureRoot, ".git", "index"), alternateIndex);
    const alternateGitEnv = {
      ...gitEnv,
      GIT_INDEX_FILE: alternateIndex,
    };
    writeFileSync(
      join(fixtureRoot, "AGENTS.md"),
      "Use a provider adapter directly.\n",
    );
    execFileSync("git", ["add", "AGENTS.md"], {
      cwd: fixtureRoot,
      env: alternateGitEnv,
    });
    writeFileSync(join(fixtureRoot, "AGENTS.md"), goodEntrypoint);

    const errors = validateCharterRepository(fixtureRoot, alternateIndex);
    assert.ok(
      errors.includes(
        "AGENTS.md: missing charter contract agent-development-workflow-charter\\.md",
      ),
      errors.join("\n"),
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
