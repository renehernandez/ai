import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-followthrough-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanFollowthrough(
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
        "skills/plan-followthrough/scripts/plan-followthrough.ts",
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

const validLedger = `plan_followthrough_ledger:
  status: active
  ledger_ref: docs/plans/qms-v1.followthrough.md
  plan:
    artifact_ref: docs/plans/qms-v1.md
  slice_advancement:
    mode: ship_then_continue
    source: user_statement
  current_slice:
    id: slice-01
    title: Upload foundation
  slices:
    - id: slice-01
      title: Upload foundation
      status: pending
  carry_forward:
    refactoring_reuse: []
    review_findings: []
    verification_gaps: []
    changed_assumptions: []
  next_action: run_plan_to_pr
  blockers: []
  warnings: []
`;

const validSliceHandoff = `plan_followthrough_slice_handoff:
  status: ready
  plan_ready_handoff:
    status: ready
    artifact_type: plan
    artifact_ref: docs/plans/qms-v1.md
    approved_slice: Implement upload foundation.
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers_selected: []
    unresolved_blockers: []
    scrutiny_verdict: ship
  followthrough_context:
    ledger_ref: docs/plans/qms-v1.followthrough.md
    slice_advancement_mode: stack_then_continue
    slice_id: slice-01
    slice_name: Upload foundation
    prior_slices: []
    carry_forward:
      refactoring_reuse: []
      review_findings: []
      verification_gaps: []
      changed_assumptions: []
    stop_conditions: []
`;

const validDelivery = `plan_followthrough_delivery:
  slice_id: slice-01
  slice_name: Upload foundation
  status: shipped
  artifact:
    pr_or_mr: https://example.test/pr/1
    commit: abc123
    branch: qms-upload
  delivery_ledger_ref: final response
  verification:
    passed:
      - pnpm test
    gaps: []
  review_feedback:
    resolved: []
    carried_forward: []
  refactoring_reuse:
    implemented: []
    deferred: []
    must_consume_later: []
  changed_assumptions: []
  recommended_next_action: run next slice
`;

test("validate-ledger requires explicit slice advancement mode", () => {
  const valid = runPlanFollowthrough("validate-ledger", validLedger);

  assert.equal(valid.status, 0);

  const invalid = runPlanFollowthrough(
    "validate-ledger",
    validLedger.replace("    mode: ship_then_continue\n", ""),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /mode is required/);
});

test("validate-slice-handoff requires followthrough context before plan-to-pr", () => {
  const valid = runPlanFollowthrough(
    "validate-slice-handoff",
    validSliceHandoff,
  );

  assert.equal(valid.status, 0);

  const invalid = runPlanFollowthrough(
    "validate-slice-handoff",
    validSliceHandoff.replace(
      "  followthrough_context:\n    ledger_ref: docs/plans/qms-v1.followthrough.md\n    slice_advancement_mode: stack_then_continue\n    slice_id: slice-01\n    slice_name: Upload foundation\n    prior_slices: []\n    carry_forward:\n      refactoring_reuse: []\n      review_findings: []\n      verification_gaps: []\n      changed_assumptions: []\n    stop_conditions: []\n",
      "",
    ),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /followthrough_context section is required/);
});

test("validate-delivery gives followthrough a reconciliation contract", () => {
  const valid = runPlanFollowthrough("validate-delivery", validDelivery);

  assert.equal(valid.status, 0);

  const invalid = runPlanFollowthrough(
    "validate-delivery",
    validDelivery.replace("  status: shipped\n", "  status: done\n"),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /status must be one of: delivered, shipped, stacked_pending_merge, blocked, needs_replan/,
  );
});
