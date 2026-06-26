import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
  "refactoring-opportunities",
];

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempPlan(
  callback: (context: { artifactRef: string; fingerprint: string }) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-artifact-"));
  const artifactRef = join(directory, "plan.md");
  const content = "# Example Plan\n\nOne atomic implementation unit.\n";
  try {
    writeFileSync(artifactRef, content, "utf8");
    callback({
      artifactRef,
      fingerprint: createHash("sha256").update(content).digest("hex"),
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempBlueprintSourcePlan(
  callback: (context: { cwd: string; fingerprint: string }) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-blueprint-"));
  try {
    callback({
      cwd: directory,
      fingerprint: writeBlueprintSourcePlan(directory),
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function writeBlueprintSourcePlan(cwd: string): string {
  const planPath = join(cwd, ".agents", "plans", "example.md");
  const content = "# Blueprint Source Plan\n\nA reviewed multi-step plan.\n";
  mkdirSync(join(cwd, ".agents", "plans"), { recursive: true });
  writeFileSync(planPath, content, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

function withGitFixture(callback: (cwd: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-git-"));
  try {
    git(directory, ["init", "-q"]);
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function git(cwd: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: withoutGitRepositoryEnv(),
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  return env;
}

function runPlanReady(
  command: string,
  content: string,
  extraArgs: string[] = [],
): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTempFile(content, (path) => {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/plan-ready/scripts/plan-ready.ts",
        command,
        ...extraArgs,
        "--file",
        path,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
  });

  assert.ok(result);
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runPlanReadyInRepo(
  command: string,
  content: string,
  cwd: string,
  extraArgs: string[] = [],
): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTempFile(content, (path) => {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/plan-ready/scripts/plan-ready.ts",
        command,
        ...extraArgs,
        "--cwd",
        cwd,
        "--file",
        path,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
  });

  assert.ok(result);
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

const reviewGateDiffHash = `sha256:${"1".repeat(64)}`;
const completedAt = "2026-06-23T10:00:00Z";

function reviewerEvidenceBlock(
  fingerprint: string,
  selectedDynamicReviewers: string[] = [],
): string {
  const reviewed = [...BASELINE_REVIEWERS, ...selectedDynamicReviewers];
  return `    reviewer_evidence:
      artifact_fingerprint: ${fingerprint}
      completed_at: ${completedAt}
      gate_outcome: passed
      baseline_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `        - ${reviewer}`).join("\n")}
      selected_dynamic_reviewers:${selectedDynamicReviewers.length === 0 ? " []" : ""}
${selectedDynamicReviewers.map((reviewer) => `        - ${reviewer}`).join("\n")}
      per_reviewer_status:
${reviewed.map((reviewer) => `        ${reviewer}: passed`).join("\n")}
      skipped_reviewers: []
      skipped_rationale: []
      blocking_findings: []
`;
}

function validHandoff(artifactRef: string, fingerprint: string): string {
  return validHandoffWithOptionalReviewers(artifactRef, fingerprint);
}

function validHandoffWithOptionalReviewers(
  artifactRef: string,
  fingerprint: string,
  optionalReviewers: string[] = [],
): string {
  return `plan_delivery_handoff:
  status: ready
  route: atomic_plan
  artifact:
    type: plan
    ref: ${artifactRef}
    fingerprint: ${fingerprint}
  approved_unit:
    id: atomic
    title: Example atomic unit
    scope: Implement the one approved change.
    acceptance:
      - The requested behavior is observable.
    verification:
      - pnpm test
  constraints:
    files_or_areas:
      - skills/plan-ready
    out_of_scope: []
  delivery:
    expected_host: github_pr
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers:${optionalReviewers.length === 0 ? " []" : ""}
${optionalReviewers.map((reviewer) => `      - ${reviewer}`).join("\n")}
${reviewerEvidenceBlock(fingerprint, optionalReviewers)}
  blockers: []
`;
}

function validBlueprint(): string {
  return validBlueprintWithOptionalReviewers();
}

function validBlueprintWithOptionalReviewers(
  optionalReviewers: string[] = [],
  reviewerUsedExtras: string[] = optionalReviewers,
  reviewerEvidenceFingerprint = "source-plan-fingerprint",
): string {
  return `openspec_blueprint:
  status: ready_for_openspec
  source_plan:
    ref: .agents/plans/example.md
    change_id: add-plan-blueprints
  change:
    suggested_id: add-plan-blueprints
    title: Add PlanReady OpenSpec blueprints
    objective: Make complex PlanReady output reviewed OpenSpec-ready breakdowns.
  scope:
    in:
      - Complex plans produce a reviewed blueprint.
    out:
      - PlanReady writes OpenSpec files directly.
  specs:
    affected_or_new:
      - plan-readiness
    proposed_requirements:
      - PlanReady MUST emit an OpenSpec Blueprint for complex work that is ready for mechanical OpenSpec creation.
  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []
  recommended_first_task: "1.1"
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers:${optionalReviewers.length === 0 ? " []" : ""}
${optionalReviewers.map((reviewer) => `      - ${reviewer}`).join("\n")}
    reviewers_used:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
${reviewerUsedExtras.map((reviewer) => `      - ${reviewer}`).join("\n")}
${reviewerEvidenceBlock(reviewerEvidenceFingerprint, optionalReviewers)}
    findings:
      - The breakdown is ready to translate into OpenSpec files.
  risks:
    - OpenSpec authors may still need to choose exact requirement wording.
  blockers: []
  next_action: create_openspec_change
`;
}

test("validate-handoff accepts an atomic plan delivery handoff", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /plan_delivery_handoff valid/);
  });
});

test("validate-handoff rejects legacy slice handoff shapes", () => {
  const legacy = `slice_plan_review:
  status: pass

plan_ready_handoff:
  status: ready
  reviewed_slices:
    - slice-01
`;

  const result = runPlanReady("validate-handoff", legacy);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /slice_plan_review is legacy; rerun plan-ready/);
  assert.match(result.stderr, /plan_ready_handoff is legacy; rerun plan-ready/);
  assert.match(result.stderr, /reviewed_slices is legacy; rerun plan-ready/);
});

test("validate-handoff requires openspec completion updates for openspec tasks", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint)
      .replace("  route: atomic_plan\n", "  route: openspec_task\n")
      .replace("    type: plan\n", "    type: openspec\n")
      .replace("    id: atomic\n", '    id: "1.1"\n');

    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /openspec_task route requires delivery.completion_updates/,
    );
  });
});

test("validate-handoff rejects direct publish for orchestrated delivery", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        "    expected_host: github_pr",
        "    expected_host: direct_publish",
      ),
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /delivery.expected_host must be one of: github_pr, gitlab_mr/,
    );
  });
});

test("validate-handoff rejects stale artifact fingerprints", () => {
  withTempPlan(({ artifactRef }) => {
    const result = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, "bad"),
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /artifact.fingerprint must match current artifact.ref content/,
    );
  });
});

test("validate-handoff rejects optional reviewers in required reviewers", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      "      - refactoring-opportunities\n    optional_reviewers: []",
      "      - refactoring-opportunities\n      - docs-and-agent-alignment\n    optional_reviewers: []",
    );
    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid plan_delivery_handoff/);
    assert.match(
      result.stderr,
      /required_reviewers can include only baseline reviewers: docs-and-agent-alignment/,
    );
    assert.equal(result.stdout, "");
  });
});

test("validate-handoff requires reviewer evidence", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      reviewerEvidenceBlock(fingerprint),
      "",
    );
    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /review\.reviewer_evidence is required/);
  });
});

test("validate-handoff requires explicit empty reviewer evidence fields", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      "      selected_dynamic_reviewers: []\n",
      "",
    );
    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /review\.reviewer_evidence\.selected_dynamic_reviewers is required/,
    );
  });
});

test("validate-handoff rejects reviewer evidence with mismatched artifact fingerprint", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      `artifact_fingerprint: ${fingerprint}`,
      "artifact_fingerprint: other-fingerprint",
    );
    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /review\.reviewer_evidence\.artifact_fingerprint must match artifact\.fingerprint/,
    );
  });
});

test("validate-handoff rejects impossible reviewer evidence timestamps", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      `completed_at: ${completedAt}`,
      "completed_at: 2026-99-99T99:99:99Z",
    );
    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /review\.reviewer_evidence\.completed_at must be an ISO-8601 UTC timestamp/,
    );
  });
});

test("handoff-template emits the plan delivery contract", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-ready/scripts/plan-ready.ts",
      "handoff-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("plan_delivery_handoff:"),
  );
  assert.match(result.stdout, /plan_delivery_handoff:/);
  assert.match(result.stdout, /\.agents\/plans\/example\.md/);
  assert.match(result.stdout, /reviewer_evidence:/);
  assert.match(result.stdout, /per_reviewer_status:/);
  assert.match(result.stdout, /gate_outcome: passed/);
  assert.doesNotMatch(result.stdout, /direct_publish/);
  assert.doesNotMatch(result.stdout, /reviewed_slices/);
  assert.doesNotMatch(result.stdout, /docs\/plans\/example\.md/);
});

test("reviewer-template routes workflow artifacts and lifecycle blockers", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-ready/scripts/plan-ready.ts",
      "reviewer-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /docs-and-agent-alignment/);
  assert.match(result.stdout, /local workflow artifact boundary/);
  assert.match(result.stdout, /ax-and-skill-compatibility/);
  assert.match(result.stdout, /adapter prompt/);
  assert.match(result.stdout, /lifecycle-only task groups/);
  assert.match(result.stdout, /proof-only tasks/);
  assert.match(result.stdout, /final documentation or validation phases/);
  assert.match(result.stdout, /checkbox-only delivery units/);
  assert.match(result.stdout, /blocking planning-readiness findings/);
  assert.match(result.stdout, /committed local readiness reports/);
  assert.match(result.stdout, /private workflow state/);
  assert.match(result.stdout, /baseline_reviewer_blocking_rubric/);
  assert.match(result.stdout, /implementation-readiness:/);
  assert.match(result.stdout, /edge-cases-and-risks:/);
  assert.match(result.stdout, /simplification-and-scope-control:/);
  assert.match(result.stdout, /refactoring-opportunities:/);
  assert.match(result.stdout, /do not downgrade them to suggestions/);
});

test("blueprint-template emits the OpenSpec blueprint contract", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-ready/scripts/plan-ready.ts",
      "blueprint-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("openspec_blueprint:"),
  );
  assert.match(result.stdout, /openspec_blueprint:/);
  assert.match(result.stdout, /status: ready_for_openspec/);
  assert.match(result.stdout, /deliverable: <PR\/MR-sized outcome>/);
  assert.match(result.stdout, /deliverable-scoped docs or proof work/);
  assert.match(result.stdout, /required_reviewers:/);
  assert.match(result.stdout, /optional_reviewers: \[\]/);
  assert.match(result.stdout, /reviewers_used:/);
  assert.match(result.stdout, /reviewer_evidence:/);
  assert.match(result.stdout, /selected_dynamic_reviewers: \[\]/);
  assert.match(result.stdout, /findings:/);
  assert.match(result.stdout, /next_action: create_openspec_change/);
  assert.doesNotMatch(result.stdout, /needs_openspec/);
});

test("validate-blueprint accepts a reviewed OpenSpec blueprint", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const result = runPlanReadyInRepo(
      "validate-blueprint",
      validBlueprintWithOptionalReviewers([], [], fingerprint),
      cwd,
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /openspec_blueprint valid/);
  });
});

test("validate-blueprint rejects missing source plan reviewer evidence provenance", () => {
  const result = runPlanReadyInRepo(
    "validate-blueprint",
    validBlueprint(),
    tmpdir(),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /source_plan\.ref must exist before reviewer evidence can be accepted/,
  );
});

test("validate-blueprint rejects stale source plan reviewer evidence fingerprints", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const blueprint = validBlueprint()
      .replace("source-plan-fingerprint", fingerprint)
      .replace(
        `artifact_fingerprint: ${fingerprint}`,
        "artifact_fingerprint: stale-source-plan",
      );
    const result = runPlanReadyInRepo("validate-blueprint", blueprint, cwd);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /review\.reviewer_evidence\.artifact_fingerprint must match source_plan\.ref content/,
    );
  });
});

test("validate-blueprint requires selected dynamic reviewers in reviewer evidence", () => {
  const blueprint = validBlueprintWithOptionalReviewers([
    "docs-and-agent-alignment",
  ]).replace(
    "      selected_dynamic_reviewers:\n        - docs-and-agent-alignment",
    "      selected_dynamic_reviewers: []",
  );
  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /review\.reviewer_evidence\.selected_dynamic_reviewers must include docs-and-agent-alignment/,
  );
});

test("validate-blueprint rejects unselected dynamic reviewers in reviewer evidence", () => {
  const blueprint = validBlueprint().replace(
    "      selected_dynamic_reviewers: []",
    "      selected_dynamic_reviewers:\n        - docs-and-agent-alignment",
  );
  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /review\.reviewer_evidence\.selected_dynamic_reviewers contains docs-and-agent-alignment not listed in review\.optional_reviewers/,
  );
});

test("validate-blueprint rejects unknown skipped reviewers in reviewer evidence", () => {
  const blueprint = validBlueprint()
    .replace(
      "      skipped_reviewers: []",
      "      skipped_reviewers:\n        - made-up-reviewer",
    )
    .replace(
      "        refactoring-opportunities: passed",
      "        refactoring-opportunities: passed\n        made-up-reviewer: skipped",
    )
    .replace(
      "      skipped_rationale: []",
      "      skipped_rationale:\n        - made-up-reviewer was not applicable.",
    );
  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /review\.reviewer_evidence\.skipped_reviewers contains unknown reviewer: made-up-reviewer/,
  );
});

test("validate-blueprint rejects lifecycle-only documentation tasks", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Documentation Updates
      deliverable: Capture documentation proof after implementation.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is lifecycle_phase_group/);
});

test("validate-blueprint rejects imperative lifecycle update tasks", () => {
  const documentationResult = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Update documentation
      deliverable: Update user docs after implementation.`,
    ),
  );
  const validationResult = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Update validation evidence
      deliverable: Update validation notes after implementation.`,
    ),
  );

  assert.notEqual(documentationResult.status, 0);
  assert.match(
    documentationResult.stderr,
    /tasks\.1\.1 is lifecycle_phase_group/,
  );
  assert.notEqual(validationResult.status, 0);
  assert.match(validationResult.stderr, /tasks\.1\.1 is lifecycle_phase_group/);
});

test("validate-blueprint rejects proof-only blueprint tasks", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Run tests and lint
      deliverable: Run tests and lint after implementation.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is proof_only_task/);
});

test("validate-blueprint rejects manual-looking proof collection tasks", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Validation Evidence
      deliverable: Manual validation evidence collection.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is lifecycle_phase_group/);
});

test("validate-blueprint rejects proof-only deliverables with feature-looking titles", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Validation Tooling
      deliverable: Capture CI proof after implementation.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is proof_only_task/);
});

test("validate-blueprint rejects missing objective proof", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      '        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."\n',
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /objective proof must be explicit/);
});

test("validate-blueprint accepts one setup-only task before objective proof", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const blueprint = validBlueprintWithOptionalReviewers(
      [],
      [],
      fingerprint,
    ).replace(
      `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []`,
      `  tasks:
    - id: "1.1"
      title: Add blueprint schema support
      deliverable: Implement the schema fields needed by blueprint validation.
      acceptance:
        - Schema-backed blueprints can represent planned tasks.
      verification:
        - run pnpm test:unit
      dependencies: []
    - id: "1.2"
      title: Validate blueprints through the CLI
      deliverable: Connect the schema to the plan-ready validator.
      acceptance:
        - "First real confirmation: run the plan-ready validate-blueprint CLI entrypoint against a valid blueprint and observe openspec_blueprint valid output."
      verification:
        - pnpm test:unit
      dependencies: ["1.1"]`,
    );

    const result = runPlanReadyInRepo("validate-blueprint", blueprint, cwd);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /openspec_blueprint valid/);
  });
});

test("validate-blueprint rejects task 2 proof after a non-setup first task", () => {
  const blueprint = validBlueprint().replace(
    `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []`,
    `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []
    - id: "1.2"
      title: Validate blueprints through the CLI
      deliverable: Connect the schema to the plan-ready validator.
      acceptance:
        - "First real confirmation: run the plan-ready validate-blueprint CLI entrypoint against a valid blueprint and observe openspec_blueprint valid output."
      verification:
        - pnpm test:unit
      dependencies: ["1.1"]`,
  );

  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /objective proof is allowed only when task 1\.1 is setup-only/,
  );
});

test("validate-blueprint rejects objective proof delayed to task 3", () => {
  const blueprint = validBlueprint()
    .replace(
      `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []`,
      `  tasks:
    - id: "1.1"
      title: Register target support
      deliverable: Add target registry entries and metadata.
      acceptance:
        - Target metadata is available to the validator.
      verification:
        - pnpm test:unit
      dependencies: []
    - id: "1.2"
      title: Generate target probes
      deliverable: Add generated probe metadata for the registered target.
      acceptance:
        - Probe metadata is generated for the target.
      verification:
        - pnpm test:unit
      dependencies: ["1.1"]
    - id: "1.3"
      title: Verify hw-admin target
      deliverable: Run target verification through the real workflow.
      acceptance:
        - "First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact."
      verification:
        - pnpm test:unit
      dependencies: ["1.2"]`,
    )
    .replace(
      '  recommended_first_task: "1.1"',
      '  recommended_first_task: "1.1"',
    );

  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /objective proof first appears in task 1\.3/);
});

test("validate-blueprint rejects deferred and setup-only objective proof markers", () => {
  const deferred = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output",
      "defer proof to task 3 after setup is ready",
    ),
  );
  const setupOnly = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output",
      "record registry metadata and config readiness",
    ),
  );

  assert.notEqual(deferred.status, 0);
  assert.match(deferred.stderr, /objective proof marker defers proof/);
  assert.notEqual(setupOnly.status, 0);
  assert.match(setupOnly.stderr, /readiness rather than real capability proof/);
});

test("validate-blueprint does not let later verification rescue weak proof markers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `"Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."`,
      `"Proof location: TBD."
      verification_note: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /real entrypoint and visible success or failure evidence/,
  );
});

test("validate-blueprint ignores later deferral notes after a valid proof marker", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const result = runPlanReadyInRepo(
      "validate-blueprint",
      validBlueprintWithOptionalReviewers([], [], fingerprint).replace(
        `        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."`,
        `        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Future task 3 can add broader provider coverage.`,
      ),
      cwd,
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /openspec_blueprint valid/);
  });
});

test("validate-blueprint rejects setup-only proof markers with command output", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output",
      "run the registry CLI command and observe metadata output",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /readiness rather than real capability proof/);
});

test("validate-blueprint accepts docs and validation tooling as feature work", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const docsFeature = runPlanReadyInRepo(
      "validate-blueprint",
      validBlueprintWithOptionalReviewers([], [], fingerprint).replace(
        `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
        `      title: Build documentation generator
      deliverable: Implement a documentation generator feature for release notes.`,
      ),
      cwd,
    );
    const validationFeature = runPlanReadyInRepo(
      "validate-blueprint",
      validBlueprintWithOptionalReviewers([], [], fingerprint).replace(
        `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
        `      title: Add runtime validation tooling
      deliverable: Implement runtime validation tooling for OpenSpec task-shape checks.`,
      ),
      cwd,
    );

    assert.equal(docsFeature.status, 0);
    assert.match(docsFeature.stdout, /openspec_blueprint valid/);
    assert.equal(validationFeature.status, 0);
    assert.match(validationFeature.stdout, /openspec_blueprint valid/);
  });
});

test("review-gate-input maps a validated handoff to active gate input", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanReady(
      "review-gate-input",
      validHandoff(artifactRef, fingerprint),
      ["--diff-hash", reviewGateDiffHash, "--source-ref", "handoff.yaml"],
    );
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(output.workflow, "plan-ready");
    assert.equal(output.unit.id, "atomic");
    assert.equal(output.unit.title, "Example atomic unit");
    assert.equal(output.sourceProvenance.kind, "plan_delivery_handoff");
    assert.equal(output.sourceProvenance.ref, artifactRef);
    assert.equal(output.sourceProvenance.phase, "plan-ready");
    assert.deepEqual(output.sourceProvenance.evidence, ["handoff.yaml"]);
    assert.deepEqual(output.requiredReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
      "simplification-and-scope-control",
      "refactoring-opportunities",
    ]);
    assert.equal(
      output.results["implementation-readiness"].diffHash,
      reviewGateDiffHash,
    );
    assert.equal(output.results["implementation-readiness"].status, "passed");
    assert.deepEqual(output.blockingFindings, []);
  });
});

test("review-gate-input promotes handoff optional reviewers", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoffWithOptionalReviewers(
      artifactRef,
      fingerprint,
      ["docs-and-agent-alignment"],
    );
    const result = runPlanReady("review-gate-input", handoff, [
      "--diff-hash",
      reviewGateDiffHash,
    ]);
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(output.requiredReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
      "simplification-and-scope-control",
      "refactoring-opportunities",
      "docs-and-agent-alignment",
    ]);
    assert.equal(output.results["docs-and-agent-alignment"].status, "passed");
    assert.equal(
      output.results["docs-and-agent-alignment"].diffHash,
      reviewGateDiffHash,
    );
  });
});

test("review-gate-input rejects handoff optional reviewers in required reviewers", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      "      - refactoring-opportunities\n    optional_reviewers: []",
      "      - refactoring-opportunities\n      - docs-and-agent-alignment\n    optional_reviewers: []",
    );
    const result = runPlanReady("review-gate-input", handoff, [
      "--diff-hash",
      reviewGateDiffHash,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid plan_delivery_handoff/);
    assert.match(
      result.stderr,
      /required_reviewers can include only baseline reviewers: docs-and-agent-alignment/,
    );
    assert.equal(result.stdout, "");
  });
});

test("review-gate-input requires a diff hash value", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanReady(
      "review-gate-input",
      validHandoff(artifactRef, fingerprint),
      ["--diff-hash", "--source-ref", "handoff.yaml"],
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /review-gate-input requires --diff-hash/);
    assert.equal(result.stdout, "");
  });
});

test("review-gate-input rejects unsupported input contracts", () => {
  const result = runPlanReady("review-gate-input", "example: true\n", [
    "--diff-hash",
    reviewGateDiffHash,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /review-gate input requires plan_delivery_handoff or openspec_blueprint/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input maps a validated blueprint to active gate input", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const result = runPlanReadyInRepo(
      "review-gate-input",
      validBlueprintWithOptionalReviewers([], [], fingerprint),
      cwd,
      ["--diff-hash", reviewGateDiffHash, "--source-ref", "blueprint.yaml"],
    );
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(output.workflow, "plan-ready");
    assert.equal(output.unit.id, "add-plan-blueprints");
    assert.equal(output.unit.title, "Add PlanReady OpenSpec blueprints");
    assert.equal(output.sourceProvenance.kind, "openspec_blueprint");
    assert.equal(output.sourceProvenance.ref, ".agents/plans/example.md");
    assert.equal(output.sourceProvenance.phase, "plan-ready");
    assert.deepEqual(output.sourceProvenance.evidence, ["blueprint.yaml"]);
    assert.deepEqual(output.requiredReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
      "simplification-and-scope-control",
      "refactoring-opportunities",
    ]);
    assert.equal(
      output.results["edge-cases-and-risks"].diffHash,
      reviewGateDiffHash,
    );
    assert.equal(output.results["edge-cases-and-risks"].status, "passed");
    assert.deepEqual(output.blockingFindings, []);
  });
});

test("review-gate-input promotes only blueprint selected optional reviewers", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const blueprint = validBlueprintWithOptionalReviewers(
      ["docs-and-agent-alignment"],
      ["docs-and-agent-alignment"],
      fingerprint,
    );
    const result = runPlanReadyInRepo("review-gate-input", blueprint, cwd, [
      "--diff-hash",
      reviewGateDiffHash,
    ]);
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.deepEqual(output.requiredReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
      "simplification-and-scope-control",
      "refactoring-opportunities",
      "docs-and-agent-alignment",
    ]);
    assert.equal(output.results["docs-and-agent-alignment"].status, "passed");
    assert.equal(output.results["ax-and-skill-compatibility"], undefined);
  });
});

test("validate-blueprint rejects reviewers_used outside selected reviewers", () => {
  withTempBlueprintSourcePlan(({ cwd, fingerprint }) => {
    const blueprint = validBlueprintWithOptionalReviewers(
      ["docs-and-agent-alignment"],
      ["docs-and-agent-alignment", "ax-and-skill-compatibility"],
      fingerprint,
    );
    const result = runPlanReadyInRepo("validate-blueprint", blueprint, cwd);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /reviewers_used contains ax-and-skill-compatibility not listed in baseline plus selected optional reviewers/,
    );
  });
});

test("validate-blueprint requires reviewers_used to include selected optional reviewers", () => {
  const blueprint = validBlueprintWithOptionalReviewers(
    ["docs-and-agent-alignment"],
    [],
  );
  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /reviewers_used must include selected optional reviewer docs-and-agent-alignment/,
  );
});

test("review-gate-input rejects partial blueprints before mapping", () => {
  const result = runPlanReady(
    "review-gate-input",
    validBlueprint().replace(
      "    reviewers_used:\n      - implementation-readiness\n      - edge-cases-and-risks\n      - simplification-and-scope-control\n      - refactoring-opportunities\n",
      "",
    ),
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid openspec_blueprint/);
  assert.match(
    result.stderr,
    /reviewers_used must include implementation-readiness/,
  );
  assert.equal(result.stdout, "");
});

test("activate-review-gate rejects legacy activation and writes no state", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    withGitFixture((cwd) => {
      writeFileSync(join(cwd, "file.txt"), "ready\n", "utf8");
      git(cwd, ["add", "file.txt"]);

      const result = runPlanReadyInRepo(
        "activate-review-gate",
        validHandoff(artifactRef, fingerprint),
        cwd,
      );
      const output = JSON.parse(result.stdout);

      assert.notEqual(result.status, 0);
      assert.equal(output.status, "blocked");
      assert.equal(output.gate_outcome, "blocked");
      assert.equal(output.route_to, "plan-review");
      assert.match(
        output.blockers.join("\n"),
        /activate-review-gate is legacy/,
      );
      assert.match(
        output.blockers.join("\n"),
        /plan-review owns readiness evidence and publication checkpoint handling/,
      );
      assert.equal(
        existsSync(join(cwd, ".git", "ax", "review-gate.json")),
        false,
      );
      assert.equal(
        existsSync(join(cwd, ".git", "ax", "review-gate.invalidated.json")),
        false,
      );
    });
  });
});

test("review-gate-input still emits readiness gate input without writing state", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    withGitFixture((cwd) => {
      const result = runPlanReadyInRepo(
        "review-gate-input",
        validHandoff(artifactRef, fingerprint),
        cwd,
        ["--diff-hash", reviewGateDiffHash],
      );
      const output = JSON.parse(result.stdout);

      assert.equal(result.status, 0);
      assert.equal(output.workflow, "plan-ready");
      assert.deepEqual(output.requiredReviewPasses, BASELINE_REVIEWERS);
      assert.equal(
        output.results["implementation-readiness"].diffHash,
        reviewGateDiffHash,
      );
      assert.equal(
        existsSync(join(cwd, ".git", "ax", "review-gate.json")),
        false,
      );
    });
  });
});

test("blueprint review-gate-input stays side-effect free for migration", () => {
  withGitFixture((cwd) => {
    const fingerprint = writeBlueprintSourcePlan(cwd);
    const result = runPlanReadyInRepo(
      "review-gate-input",
      validBlueprint().replace("source-plan-fingerprint", fingerprint),
      cwd,
      ["--diff-hash", reviewGateDiffHash],
    );
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(output.workflow, "plan-ready");
    assert.equal(output.sourceProvenance.phase, "plan-ready");
    assert.deepEqual(output.requiredReviewPasses, BASELINE_REVIEWERS);
    assert.equal(
      existsSync(join(cwd, ".git", "ax", "review-gate.json")),
      false,
    );
    assert.equal(
      existsSync(join(cwd, ".git", "ax", "review-gate.invalidated.json")),
      false,
    );
  });
});

test("validate-blueprint requires source plan ref", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "  source_plan:\n    ref: .agents/plans/example.md\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.ref/);
});

test("validate-blueprint requires source plan change id", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace("    change_id: add-plan-blueprints\n", ""),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.change_id/);
});

test("validate-blueprint requires source plan change id to match suggested id", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    change_id: add-plan-blueprints",
      "    change_id: other-change",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /source_plan.change_id must match change.suggested_id/,
  );
});

test("validate-blueprint requires source plan ref under agents plans", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    ref: .agents/plans/example.md",
      "    ref: docs/plans/example.md",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.ref must be under .agents\/plans/);
});

test("validate-blueprint rejects escaped source plan refs", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    ref: .agents/plans/example.md",
      "    ref: .agents/plans/../../outside.md",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.ref must be under .agents\/plans/);
});

test("validate-blueprint requires the recommended first task to exist", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      '  recommended_first_task: "1.1"\n',
      '  recommended_first_task: "9.9"\n',
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /recommended_first_task must match an existing task id/,
  );
});

test("validate-blueprint rejects a recommended first task with dependencies", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "      dependencies: []\n",
      '      dependencies: ["2.1"]\n',
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /recommended_first_task must not have dependencies/,
  );
  assert.match(
    result.stderr,
    /tasks.1.1.dependencies includes unknown task 2.1/,
  );
});

test("validate-blueprint requires normalized required reviewers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      / {4}required_reviewers:\n {6}- implementation-readiness\n {6}- edge-cases-and-risks\n {6}- simplification-and-scope-control\n {6}- refactoring-opportunities\n/,
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review.required_reviewers is required/);
});

test("validate-blueprint requires normalized optional reviewers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace("    optional_reviewers: []\n", ""),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review.optional_reviewers is required/);
});

test("validate-blueprint requires baseline reviewers in required reviewers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace("      - edge-cases-and-risks\n", ""),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /required_reviewers must include edge-cases-and-risks/,
  );
});

test("validate-blueprint rejects unknown required reviewers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "      - refactoring-opportunities\n    optional_reviewers: []",
      "      - refactoring-opportunities\n      - invented-reviewer\n    optional_reviewers: []",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /required_reviewers can include only baseline reviewers: invented-reviewer/,
  );
});

test("validate-blueprint rejects optional reviewers in required reviewers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "      - refactoring-opportunities\n    optional_reviewers: []",
      "      - refactoring-opportunities\n      - docs-and-agent-alignment\n    optional_reviewers: []",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /required_reviewers can include only baseline reviewers: docs-and-agent-alignment/,
  );
});

test("validate-blueprint rejects non-catalog optional reviewers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    optional_reviewers: []",
      "    optional_reviewers:\n      - implementation-readiness",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /optional_reviewers can include only optional reviewers: implementation-readiness/,
  );
});
