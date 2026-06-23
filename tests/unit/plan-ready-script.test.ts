import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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
        cwd: process.cwd(),
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

function validHandoff(artifactRef: string, fingerprint: string): string {
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
    optional_reviewers: []
  blockers: []
`;
}

function validBlueprint(): string {
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
      deliverable: Validate the complex-plan blueprint schema.
      acceptance:
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
    optional_reviewers: []
    reviewers_used:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
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
  assert.doesNotMatch(result.stdout, /direct_publish/);
  assert.doesNotMatch(result.stdout, /reviewed_slices/);
  assert.doesNotMatch(result.stdout, /docs\/plans\/example\.md/);
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
  assert.match(result.stdout, /required_reviewers:/);
  assert.match(result.stdout, /optional_reviewers: \[\]/);
  assert.match(result.stdout, /reviewers_used:/);
  assert.match(result.stdout, /findings:/);
  assert.match(result.stdout, /next_action: create_openspec_change/);
  assert.doesNotMatch(result.stdout, /needs_openspec/);
});

test("validate-blueprint accepts a reviewed OpenSpec blueprint", () => {
  const result = runPlanReady("validate-blueprint", validBlueprint());

  assert.equal(result.status, 0);
  assert.match(result.stdout, /openspec_blueprint valid/);
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

test("review-gate-input does not promote handoff optional reviewers before activation", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint).replace(
      "    optional_reviewers: []",
      "    optional_reviewers:\n      - docs-and-agent-alignment",
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
    ]);
    assert.equal(output.results["docs-and-agent-alignment"], undefined);
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
  const result = runPlanReady("review-gate-input", validBlueprint(), [
    "--diff-hash",
    reviewGateDiffHash,
    "--source-ref",
    "blueprint.yaml",
  ]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.workflow, "plan-ready");
  assert.equal(output.unit.id, "add-plan-blueprints");
  assert.equal(output.unit.title, "Add PlanReady OpenSpec blueprints");
  assert.equal(output.sourceProvenance.kind, "openspec_blueprint");
  assert.equal(output.sourceProvenance.ref, ".agents/plans/example.md");
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
