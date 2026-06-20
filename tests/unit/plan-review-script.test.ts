import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanReview(
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
        "skills/plan-review/scripts/plan-review.ts",
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

function runPlanReviewCommand(command: string): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "skills/plan-review/scripts/plan-review.ts", command],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

const planReviewRequest = `plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - nitro
    - developers
  unresolved_blockers: []
`;

const deliveryHandoff = `plan_delivery_handoff:
  status: ready
  route: atomic_plan
  artifact:
    type: plan
    ref: .agents/plans/example.md
    fingerprint: abc123
  approved_unit:
    id: atomic
    title: Example atomic unit
    scope: Implement one approved change.
    acceptance:
      - The behavior is observable.
    verification:
      - pnpm test
  constraints:
    files_or_areas:
      - skills/plan-review
  delivery:
    expected_host: github_pr
  review:
    required_reviewers: []
    optional_reviewers: []
  blockers: []
`;

const planningReview = `planning_review:
  status: reviewed
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_artifact: https://example.test/review/1
  mode: ship_then_continue
  gate_outcome: approved
  target_branch: main
  target_base_sha: abc123
  planning_branch: plan/example
  reviewed_head: def456
  stack_base_ref:
  stack_base_evidence:
  task_state_fingerprint: feedface
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning MR merged after feedback was addressed
  blockers: []
`;

test("validate-request accepts plan review requests", () => {
  const result = runPlanReview("validate-request", planReviewRequest);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_review_request valid/);
});

test("request-template emits a readable summary before YAML", () => {
  const result = runPlanReviewCommand("request-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("plan_review_request:"),
  );
  assert.match(result.stdout, /plan_review_request:/);
});

test("gate-template emits a readable summary before YAML", () => {
  const result = runPlanReviewCommand("gate-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("plan_review_gate_ledger:"),
  );
  assert.match(result.stdout, /plan_review_gate_ledger:/);
});

test("planning-review-template emits a readable summary before YAML", () => {
  const result = runPlanReviewCommand("planning-review-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("planning_review:"),
  );
  assert.match(result.stdout, /planning_review:/);
});

test("validate-planning-review accepts reviewed planning handoffs", () => {
  const result = runPlanReview("validate-planning-review", planningReview);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /planning_review valid/);
});

test("validate-planning-review rejects pending blockers", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "  blockers: []",
      "  blockers:\n    - pending review",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review.blockers must be empty before sequencing/,
  );
});

test("validate-request accepts delivery handoffs for planning review", () => {
  const result = runPlanReview("validate-request", deliveryHandoff);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_delivery_handoff valid/);
});

test("validate-request rejects legacy plan-ready handoffs", () => {
  const result = runPlanReview(
    "validate-request",
    `plan_ready_handoff:
  status: ready
  reviewed_slices:
    - slice-01
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /legacy handoffs are unsupported; rerun plan-ready/,
  );
});

test("validate-request rejects ambiguous review and delivery inputs", () => {
  const result = runPlanReview(
    "validate-request",
    `${planReviewRequest}
${deliveryHandoff}`,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /provide exactly one of plan_review_request or plan_delivery_handoff/,
  );
});
