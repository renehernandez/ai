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
  assert.match(result.stdout, /next_action: create_openspec_change/);
  assert.doesNotMatch(result.stdout, /needs_openspec/);
});

test("validate-blueprint accepts a reviewed OpenSpec blueprint", () => {
  const result = runPlanReady("validate-blueprint", validBlueprint());

  assert.equal(result.status, 0);
  assert.match(result.stdout, /openspec_blueprint valid/);
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
