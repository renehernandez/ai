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

const planningReview = `nitro_feedback_gate:
  artifact: https://git.fullscript.io/group/project/-/merge_requests/1
  head_sha: def456
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - glab mr note 1 -m "/request_review @nitro"
  start:
    status: started
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - Nitro acknowledged latest-head review
  completion:
    status: clean
    evidence:
      - Nitro completed latest-head review with no issues
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed

planning_review:
  status: reviewed
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_artifact: https://example.test/review/1
  mode: stacked_delivery
  gate_outcome: ready_for_stack
  target_branch: main
  target_base_sha: abc123
  planning_branch: plan/example
  reviewed_head: def456
  stack_base_ref: plan/example
  stack_base_evidence: latest-head Nitro feedback completed cleanly
  stack_identity:
    expected_base_ref: plan/example
    expected_base_sha: def456
    predecessor_artifact:
    restack_required: false
  task_state_fingerprint: feedface
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning MR latest-head Nitro feedback completed cleanly
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

test("validate-planning-review rejects missing Nitro gate", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      /^nitro_feedback_gate:[\s\S]*?\n\nplanning_review:/,
      "planning_review:",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nitro_feedback_gate.artifact/);
});

test("validate-planning-review rejects legacy planning modes", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "mode: stacked_delivery",
      "mode: ship_then_continue",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review.mode ship_then_continue is legacy/,
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
