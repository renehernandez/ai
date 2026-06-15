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
    significant_refactor_suggestions: []
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
    reviewed_slices:
      - slice-01
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
      significant_refactor_suggestions: []
      review_findings: []
      verification_gaps: []
      changed_assumptions: []
    stop_conditions: []
`;

const validDelivery = `plan_followthrough_delivery:
  slice_id: slice-01
  slice_name: Upload foundation
  slice_advancement_mode: ship_then_continue
  status: shipped
  artifact:
    pr_or_mr:
      url: https://example.test/pr/1
      draft: false
      latest_head: abc123
      merge_state: merged
    commit: abc123
    branch: qms-upload
  delivery_ledger_ref: final response
  verification:
    passed:
      - pnpm test
    gaps: []
  review_feedback:
    status: passed
    reviewed_head: abc123
    resolved: []
    carried_forward: []
  refactoring_reuse:
    implemented: []
    deferred: []
    must_consume_later: []
  significant_refactor_suggestions: []
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
      "  followthrough_context:\n    ledger_ref: docs/plans/qms-v1.followthrough.md\n    slice_advancement_mode: stack_then_continue\n    slice_id: slice-01\n    slice_name: Upload foundation\n    prior_slices: []\n    carry_forward:\n      refactoring_reuse: []\n      significant_refactor_suggestions: []\n      review_findings: []\n      verification_gaps: []\n      changed_assumptions: []\n    stop_conditions: []\n",
      "",
    ),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /followthrough_context section is required/);
});

test("validate-slice-handoff requires reviewed slice ids", () => {
  const invalid = runPlanFollowthrough(
    "validate-slice-handoff",
    validSliceHandoff.replace("    reviewed_slices:\n      - slice-01\n", ""),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /reviewed_slices is required/);
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
    /status must be one of: shipped, stacked_pending_merge, blocked, needs_replan/,
  );
});

test("validate-delivery rejects shipped draft PRs", () => {
  const invalid = runPlanFollowthrough(
    "validate-delivery",
    validDelivery.replace("      draft: false\n", "      draft: true\n"),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /shipped delivery cannot reference a draft PR/);
});

test("validate-delivery rejects shipped delivery with blocked review feedback", () => {
  const invalid = runPlanFollowthrough(
    "validate-delivery",
    validDelivery.replace("    status: passed\n", "    status: blocked\n"),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /review_feedback.status blocked requires delivery status blocked/,
  );
});

test("validate-delivery rejects stale hosted review head", () => {
  const invalid = runPlanFollowthrough(
    "validate-delivery",
    validDelivery.replace(
      "    reviewed_head: abc123\n",
      "    reviewed_head: def456\n",
    ),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /review_feedback.reviewed_head must match artifact.pr_or_mr.latest_head/,
  );
});

test("validate-delivery rejects stacked delivery under ship_then_continue", () => {
  const stacked = validDelivery
    .replace("  status: shipped\n", "  status: stacked_pending_merge\n")
    .replace("      merge_state: merged\n", "      merge_state: mergeable\n");

  const invalid = runPlanFollowthrough("validate-delivery", stacked);

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /stacked_pending_merge is not valid for ship_then_continue/,
  );
});

test("validate-delivery accepts stacked delivery with passed review under stack_then_continue", () => {
  const stacked = validDelivery
    .replace(
      "  slice_advancement_mode: ship_then_continue\n",
      "  slice_advancement_mode: stack_then_continue\n",
    )
    .replace("  status: shipped\n", "  status: stacked_pending_merge\n")
    .replace("      draft: false\n", "      draft: true\n")
    .replace("      merge_state: merged\n", "      merge_state: draft\n")
    .replace(
      "  recommended_next_action: run next slice\n",
      "  recommended_next_action: continue_stack\n",
    );

  const valid = runPlanFollowthrough("validate-delivery", stacked);

  assert.equal(valid.status, 0);
});

test("validate-delivery requires significant refactor suggestions key", () => {
  const invalid = runPlanFollowthrough(
    "validate-delivery",
    validDelivery.replace("  significant_refactor_suggestions: []\n", ""),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /significant_refactor_suggestions is required/);
});

test("templates carry significant refactor suggestions through ledger and delivery", () => {
  const ledger = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-followthrough/scripts/plan-followthrough.ts",
      "ledger-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  const delivery = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-followthrough/scripts/plan-followthrough.ts",
      "delivery-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(ledger.status, 0);
  assert.equal(delivery.status, 0);
  assert.match(ledger.stdout, /significant_refactor_suggestions:/);
  assert.match(delivery.stdout, /significant_refactor_suggestions:/);
});
