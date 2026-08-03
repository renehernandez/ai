import {
  hasBoundEvidence,
  scenarioSyntax,
} from "./charter-validator-evidence.ts";

const charterPath = "rules/agent-development-workflow-charter.md";
const contractHeaderPattern = /^\/\/ charter-contracts: (.+)$/m;
const lifecycleReaderBinding = {
  allowedModules: [
    "node:assert/strict",
    "node:fs",
    "node:path",
    "node:test",
    "../../scripts/charter-validator-reader.ts",
  ],
  forbidDynamicModuleAccess: true,
  kind: "import",
  module: "../../scripts/charter-validator-reader.ts",
  name: "read",
} as const;
const minimalReaderBinding = {
  allowedModules: [
    "node:assert/strict",
    "node:test",
    "../../scripts/charter-validator-reader.ts",
  ],
  forbidDynamicModuleAccess: true,
  kind: "import",
  module: "../../scripts/charter-validator-reader.ts",
  name: "read",
} as const;
const communicationReaderBinding = {
  allowedModules: [
    "node:assert/strict",
    "node:fs",
    "node:test",
    "../../scripts/charter-validator-reader.ts",
  ],
  forbidDynamicModuleAccess: true,
  kind: "import",
  module: "../../scripts/charter-validator-reader.ts",
  name: "read",
} as const;
const charterReaderBinding = {
  allowedModules: [
    "node:assert/strict",
    "node:child_process",
    "node:fs",
    "node:os",
    "node:path",
    "node:test",
    "../../scripts/charter-validate.ts",
    "../../scripts/charter-validator-reader.ts",
  ],
  forbidDynamicModuleAccess: true,
  kind: "import",
  module: "../../scripts/charter-validator-reader.ts",
  name: "read",
} as const;
const canonicalRuleOwners = new Set([
  "rules/agent-development-workflow-charter.md",
  "rules/agent-surface-routing.md",
  "rules/ci-infra-and-cloudflare.md",
  "rules/command-and-tools.md",
  "rules/communication.md",
  "rules/confidence.md",
  "rules/dependency-security.md",
  "rules/docs-and-specs.md",
  "rules/fullscript/nitro-review.md",
  "rules/git-and-review.md",
  "rules/handoff-and-resume.md",
  "rules/investigation-and-implementation.md",
  "rules/project-local.md",
  "rules/session-startup.md",
  "rules/testing-and-verification.md",
]);

export type Change = {
  path: string;
  content: string;
  additions: string;
};

const behaviorScenarioContracts = {
  "charter-gate": {
    principles: ["canonical-ownership", "progressive-disclosure"],
    path: "tests/unit/agent-workflow-charter.test.ts",
    redName: "RED charter-gate:",
    greenName: "GREEN charter-gate:",
    owns: (change: Change) =>
      change.path === "rules/agent-development-workflow-charter.md" ||
      change.path === "scripts/charter-validate.ts" ||
      change.path === "scripts/charter-range-validate.ts" ||
      change.path.startsWith("scripts/charter-validator-"),
    redEvidence: {
      source: {
        binding: {
          kind: "import",
          module: "../../scripts/charter-validate.ts",
          name: "validateCharterFixture",
        },
        callee: /^validateCharterFixture$/,
      },
      assertion: {
        callee: /^assert\.deepEqual$/,
        directSourceValue: true,
        expectedText:
          /^\[\s*["']scripts\/charter-validate\.ts: contract charter-gate requires staged executable RED and GREEN scenarios in tests\/unit\/agent-workflow-charter\.test\.ts["']\s*,?\s*\]$/,
      },
    },
    greenEvidence: {
      source: {
        binding: {
          kind: "import",
          module: "../../scripts/charter-validate.ts",
          name: "validateCharterRepository",
        },
        callee: /^validateCharterRepository$/,
      },
      assertion: { callee: /^assert\.(?:deepEqual|doesNotThrow)$/ },
    },
  },
  "removal-only-evidence": {
    principles: ["semantic-delivery", "authority"],
    path: "tests/unit/review-workflow-contract.test.ts",
    redName: "RED removal-only-evidence:",
    greenName: "GREEN removal-only-evidence:",
    owns: (change: Change) =>
      change.path.startsWith("skills/review/") ||
      [
        "rules/agent-development-workflow-charter.md",
        "rules/docs-and-specs.md",
        "rules/git-and-review.md",
        "rules/investigation-and-implementation.md",
      ].includes(change.path),
    redEvidence: {
      source: {
        binding: {
          kind: "import",
          module: "../../skills/review/scripts/review-contract.ts",
          name: "validateTechnicalReadinessCheckpoint",
        },
        callee: /^validateTechnicalReadinessCheckpoint$/,
      },
      assertion: { callee: /^assert\.throws$/ },
    },
    greenEvidence: {
      source: {
        binding: {
          kind: "import",
          module: "../../skills/review/scripts/review-contract.ts",
          name: "validateTechnicalReadinessCheckpoint",
        },
        callee: /^validateTechnicalReadinessCheckpoint$/,
      },
      assertion: { callee: /^assert\.doesNotThrow$/ },
    },
  },
  "simplification-review": {
    principles: ["canonical-ownership", "semantic-delivery"],
    path: "tests/unit/code-simplifier-skill.test.ts",
    redName: "RED simplification-review:",
    greenName: "GREEN simplification-review:",
    owns: (change: Change) => change.path === "skills/code-simplifier/SKILL.md",
    redEvidence: {
      source: {
        binding: minimalReaderBinding,
        callee: /^read$/,
        text: /\(["']skills\/code-simplifier\/SKILL\.md["']\)/,
      },
      assertion: { callee: /^assert\.doesNotMatch$/ },
    },
    greenEvidence: {
      source: {
        binding: minimalReaderBinding,
        callee: /^read$/,
        text: /\(["']skills\/code-simplifier\/SKILL\.md["']\)/,
      },
      assertion: { callee: /^assert\.match$/ },
    },
  },
  "complete-explanations": {
    principles: ["progressive-disclosure", "semantic-delivery"],
    path: "tests/unit/communication-rules.test.ts",
    redName: "RED complete-explanations:",
    greenName: "GREEN complete-explanations:",
    owns: (change: Change) =>
      change.path === ".agents/plans/complete-first-pass-explanations.md" ||
      change.path === "rules/communication.md" ||
      change.path === "rules/confidence.md",
    redEvidence: {
      source: {
        binding: communicationReaderBinding,
        callee: /^read$/,
        text: /\(["']rules\/confidence\.md["']\)/,
      },
      assertion: { callee: /^assert\.doesNotMatch$/ },
    },
    greenEvidence: {
      source: {
        binding: communicationReaderBinding,
        callee: /^read$/,
        text: /\(["']rules\/communication\.md["']\)/,
      },
      assertion: { callee: /^assert\.match$/ },
    },
  },
  "nitro-raw-evidence": {
    principles: ["semantic-delivery", "canonical-ownership"],
    path: "tests/unit/nitro-feedback-gate-script.test.ts",
    redName: "RED nitro-raw-evidence:",
    greenName: "GREEN nitro-raw-evidence:",
    owns: (change: Change) =>
      change.path === "rules/fullscript/nitro-review.md" ||
      change.path.startsWith("skills/nitro-review-feedback/"),
    redEvidence: {
      source: {
        binding: {
          allowedModules: [
            "node:assert/strict",
            "node:test",
            "../../skills/nitro-review-feedback/scripts/gitlab-evidence-collect.ts",
            "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts",
          ],
          forbidDynamicModuleAccess: true,
          kind: "import",
          module:
            "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts",
          name: "runNitroGate",
        },
        callee: /^runNitroGate$/,
        text: /\(\s*["']validate-gitlab-evidence["']/,
      },
      assertion: {
        callee: /^assert\.match$/,
        expectedText: /^\/"gate_outcome": "blocked"\/$/,
      },
    },
    greenEvidence: {
      source: {
        binding: {
          allowedModules: [
            "node:assert/strict",
            "node:test",
            "../../skills/nitro-review-feedback/scripts/gitlab-evidence-collect.ts",
            "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts",
          ],
          forbidDynamicModuleAccess: true,
          kind: "import",
          module:
            "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts",
          name: "runNitroGate",
        },
        callee: /^runNitroGate$/,
        text: /\(\s*["']validate-gitlab-evidence["']/,
      },
      assertion: {
        callee: /^assert\.match$/,
        expectedText: /^\/"gate_outcome": "passed"\/$/,
      },
    },
  },
  "lifecycle-authority": {
    principles: ["authority", "semantic-delivery"],
    path: "tests/unit/agent-workflow-lifecycle.test.ts",
    redName: "RED authority:",
    greenName: "GREEN authority:",
    owns: (change: Change) =>
      ["AGENTS.md", "instructions/AGENTS.md"].includes(change.path) ||
      /^(?:skills\/(?:execute|finish|plan)\/|rules\/docs-and-specs\.md$|rules\/investigation-and-implementation\.md$)/.test(
        change.path,
      ),
    redEvidence: {
      source: {
        binding: lifecycleReaderBinding,
        callee: /^read$/,
        text: /\(["'](?:rules|skills)\//,
      },
      assertion: { callee: /^assert\.doesNotMatch$/ },
    },
    greenEvidence: {
      source: {
        binding: lifecycleReaderBinding,
        callee: /^read$/,
        text: /\(["'](?:rules|skills)\//,
      },
      assertion: { callee: /^assert\.match$/ },
    },
  },
  "stack-delivery": {
    principles: ["semantic-delivery"],
    path: "tests/unit/agent-workflow-lifecycle.test.ts",
    redName: "RED semantic-delivery:",
    greenName: "GREEN semantic-delivery: stack publication",
    owns: (change: Change) =>
      change.path === "rules/git-and-review.md" ||
      change.path === "rules/investigation-and-implementation.md" ||
      change.path.startsWith("skills/glab-stacked-diffs/"),
    redEvidence: {
      source: {
        binding: lifecycleReaderBinding,
        callee: /^read$/,
        text: /\(["']skills\/glab-stacked-diffs\//,
      },
      assertion: { callee: /^assert\.doesNotMatch$/ },
    },
    greenEvidence: {
      source: {
        binding: lifecycleReaderBinding,
        callee: /^read$/,
        text: /\(["'](?:rules|skills)\//,
      },
      assertion: { callee: /^assert\.match$/ },
    },
  },
  "change-request-owner": {
    principles: ["canonical-ownership", "authority"],
    path: "tests/unit/change-request-create-skill.test.ts",
    redName: "RED change-request-owner:",
    greenName: "GREEN change-request-owner:",
    owns: (change: Change) =>
      change.path === "ax.config.json" ||
      change.path.startsWith("skills/change-request-create/") ||
      change.path.startsWith("skills/github-pr-create/") ||
      change.path.startsWith("skills/glab-mr-create/"),
    redEvidence: {
      source: {
        callee: /\.includes$/,
        text: /(?:github|glab)-(?:pr|mr)-create/,
      },
      assertion: {
        callee: /^assert\.(?:ok|equal)$/,
      },
    },
    greenEvidence: {
      source: {
        binding: minimalReaderBinding,
        callee: /^read$/,
        text: /\(["']skills\/change-request-create\//,
      },
      assertion: { callee: /^assert\.match$/ },
    },
  },
  "hook-entrypoint": {
    principles: ["canonical-ownership"],
    path: "tests/unit/agent-workflow-charter.test.ts",
    redName: "RED charter-gate:",
    greenName: "GREEN canonical-ownership:",
    owns: (change: Change) =>
      change.path === "lefthook.yml" || change.path === "package.json",
    redEvidence: {
      source: {
        binding: {
          kind: "import",
          module: "../../scripts/charter-validate.ts",
          name: "validateCharterFixture",
        },
        callee: /^validateCharterFixture$/,
      },
      assertion: { callee: /^assert\.(?:ok|deepEqual)$/ },
    },
    greenEvidence: {
      source: {
        binding: charterReaderBinding,
        callee: /^read$/,
        text: /\(["'](?:lefthook\.yml|package\.json)/,
      },
      assertion: { callee: /^assert\.(?:equal|match)$/ },
    },
  },
} as const;

export function isPotentialBehaviorSurface(path: string): boolean {
  return (
    path === "AGENTS.md" ||
    path === "ax.config.json" ||
    path === "lefthook.yml" ||
    path === "package.json" ||
    /^(?:instructions|rules|skills|\.agents|hooks|automations)\//.test(path) ||
    path.startsWith("scripts/charter-") ||
    path === "scripts/skill-validate.ts" ||
    /^scripts\/.*(?:(?:agent|skill).*(?:validate|validator)|(?:validate|validator).*(?:agent|skill)).*\.ts$/.test(
      path,
    ) ||
    path === "scripts/ax.ts" ||
    path.startsWith("scripts/ax/") ||
    /^templates\/.*(?:agent|prompt|rubric).*\.(?:md|txt|ya?ml)$/.test(path)
  );
}

export function canonicalOwnerFor(path: string): string | undefined {
  if (path === "AGENTS.md" || path === "instructions/AGENTS.md") {
    return charterPath;
  }
  if (
    path.startsWith("skills/github-pr-create/") ||
    path.startsWith("skills/glab-mr-create/")
  ) {
    return "skills/change-request-create/SKILL.md";
  }
  if (canonicalRuleOwners.has(path)) {
    return path;
  }
  if (path === ".agents/plans/complete-first-pass-explanations.md") {
    return "rules/communication.md";
  }
  if (path.startsWith("rules/")) {
    return undefined;
  }
  const skill = path.match(/^skills\/([^/]+)\//);
  if (skill) {
    return `skills/${skill[1]}/SKILL.md`;
  }
  const localSkill = path.match(/^\.agents\/skills\/([^/]+)\//);
  if (localSkill) {
    return `.agents/skills/${localSkill[1]}/SKILL.md`;
  }
  if (path.startsWith(".agents/commands/")) {
    return path;
  }
  if (path.startsWith(".agents/")) {
    return undefined;
  }
  if (path === "ax.config.json") {
    return "skills/ax-cli/SKILL.md";
  }
  if (path === "lefthook.yml") {
    return "rules/testing-and-verification.md";
  }
  if (path === "package.json") {
    return "rules/command-and-tools.md";
  }
  if (
    path === "scripts/charter-validate.ts" ||
    path === "scripts/charter-range-validate.ts" ||
    path.startsWith("scripts/charter-validator-")
  ) {
    return charterPath;
  }
  if (path === "scripts/skill-validate.ts") {
    return "skills/writing-skills/SKILL.md";
  }
  if (path === "scripts/ax.ts" || path.startsWith("scripts/ax/")) {
    return "skills/ax-cli/SKILL.md";
  }
  if (path === "hooks/startup-git-sync.ts") {
    return "rules/session-startup.md";
  }
  if (path.startsWith("hooks/")) {
    return "rules/command-and-tools.md";
  }
  if (path.startsWith("automations/") || path.startsWith("templates/")) {
    return path;
  }
  return undefined;
}

export function validateBehaviorContractCoverage(
  changes: Change[],
  behaviorChanges: Change[],
  errors: string[],
): void {
  for (const change of behaviorChanges) {
    const contracts = Object.entries(behaviorScenarioContracts).filter(
      ([, contract]) => contract.owns(change),
    );
    if (contracts.length === 0) {
      errors.push(
        `${change.path}: agent-behavior surface has no contract-specific pressure scenario`,
      );
      continue;
    }
    for (const [contractId, contract] of contracts) {
      if (contract.principles.length === 0) {
        errors.push(`${change.path}: contract ${contractId} has no principles`);
        continue;
      }
      const scenario = changes.find(
        (candidate) => candidate.path === contract.path,
      );
      const declared = new Set(
        contractHeaderPattern
          .exec(scenario?.content ?? "")?.[1]
          .split(",")
          .map((value) => value.trim()) ?? [],
      );
      const redScenario = scenarioSyntax(
        scenario?.content ?? "",
        contract.redName,
      );
      const greenScenario = scenarioSyntax(
        scenario?.content ?? "",
        contract.greenName,
      );
      if (
        !scenario ||
        !declared.has(contractId) ||
        !redScenario ||
        !greenScenario ||
        !hasBoundEvidence(redScenario, contract.redEvidence) ||
        !hasBoundEvidence(greenScenario, contract.greenEvidence)
      ) {
        errors.push(
          `${change.path}: contract ${contractId} requires staged executable RED and GREEN scenarios in ${contract.path}`,
        );
      }
    }
  }
}
