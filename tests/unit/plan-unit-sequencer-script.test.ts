import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/plan-orchestrator", name),
    "utf8",
  );
}

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-unit-sequencer-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanUnitSequencer(
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
        "skills/plan-unit-sequencer/scripts/plan-unit-sequencer.ts",
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

function runPlanUnitSequencerCommand(command: string): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-unit-sequencer/scripts/plan-unit-sequencer.ts",
      command,
    ],
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

function runSelectNextTask(
  content: string,
  args: string[] = [],
): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTempFile(content, (path) => {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/plan-unit-sequencer/scripts/plan-unit-sequencer.ts",
        "select-next-task",
        path,
        ...args,
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

const validHandoff = `plan_delivery_handoff:
  status: ready
  route: openspec_task
  artifact:
    type: openspec
    ref: openspec/changes/example-change
    fingerprint: abc123
  approved_unit:
    id: "1.1"
    title: Add plan delivery
    scope: Implement one OpenSpec checkbox task.
    acceptance:
      - Plan Unit Sequencer validates the handoff.
    verification:
      - pnpm test:unit
  constraints:
    files_or_areas:
      - skills/plan-unit-sequencer
    out_of_scope: []
  delivery:
    expected_host: github_pr
    stack_identity:
      expected_base_ref: plan/example
      expected_base_sha: def456
      predecessor_artifact: https://example.test/review/1
      selected_task_base_sha: def456
      restack_required: false
    completion_updates:
      - Mark OpenSpec task checkbox complete in one separate implementation PR/MR.
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
  blockers: []
`;

const planningReview = `planning_review:
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
  description_policy:
    status: passed
    owner: glab-mr-create
    artifact: https://example.test/review/1
    head_sha: def456
    update_mode: updated
    materiality_decision: material_update
    readback_head_sha: def456
    read_before_update: true
    pre_update_body_evidence: prior body hash retained for manual-section recovery
    readback_after_update: true
    readback_outcome: clean
    preserved_manual_sections: true
    rollback_or_restore_evidence: none
    evidence:
      - MR body read before update and read back at current planning head
    omitted_process_history: true
    omitted_private_artifacts: true
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
      - feedback addressed and latest-head Nitro gate passed
  planning_feedback_disposition:
    status: complete
    evidence:
      - Nitro planning feedback was enumerated by note ID and disposition.
    items:
      - note_id: "3330306"
        discussion_id: abc123
        resolvable: true
        resolved: true
        disposition: fixed_in_planning
        evidence: planning MR commit addressed the comment
  blockers: []
`;

test("validate-handoff accepts a ready OpenSpec task handoff", () => {
  const result = runPlanUnitSequencer("validate-handoff", validHandoff);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_delivery_handoff valid/);
});

test("handoff-template emits a readable summary before YAML", () => {
  const result = runPlanUnitSequencerCommand("handoff-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("plan_delivery_handoff:"),
  );
  assert.match(result.stdout, /plan_delivery_handoff:/);
});

test("planning-review-template emits a readable summary before YAML", () => {
  const result = runPlanUnitSequencerCommand("planning-review-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("planning_review:"),
  );
  assert.match(result.stdout, /planning_review:/);
});

test("validate-planning-review accepts reviewed planning handoffs", () => {
  const result = runPlanUnitSequencer(
    "validate-planning-review",
    planningReview,
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /planning_review valid/);
});

test("validate-planning-review rejects missing planning evidence", () => {
  const result = runPlanUnitSequencer(
    "validate-planning-review",
    `plan_delivery_handoff:
  status: ready
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /planning_review.status is required/);
});

test("validate-handoff rejects legacy followthrough ledgers", () => {
  const result = runPlanUnitSequencer(
    "validate-handoff",
    `plan_followthrough_ledger:
  status: active
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /plan_followthrough_ledger is legacy; rerun plan-ready/,
  );
});

test("validate-handoff rejects old coordinate-root handoffs", () => {
  const result = runPlanUnitSequencer(
    "validate-handoff",
    validHandoff.replace("plan_delivery_handoff:", "plan_coordinate_handoff:"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /plan_coordinate_handoff is legacy; rerun plan-ready/,
  );
});

test("select-next-task returns the first unchecked deliverable", () => {
  const result = runSelectNextTask(`# Tasks

## 1. Delivery

- [x] 1.1 Complete the first task
- [ ] 1.2 Implement the second task
- [ ] 1.3 Manual production verification
`);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "ready");
  assert.equal(parsed.caller, "direct");
  assert.equal(parsed.delivery_goal, "next_task");
  assert.equal(parsed.completion_target, "one_task");
  assert.equal(parsed.next_delivery_unit.id, "1");
  assert.equal(parsed.next_task.id, "1.2");
});

test("fixture preserves direct sequencer next-task behavior outside orchestrator", () => {
  const result = runSelectNextTask(fixture("direct-sequencer-next-task.md"));

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "ready");
  assert.equal(parsed.caller, "direct");
  assert.equal(parsed.delivery_goal, "next_task");
  assert.equal(parsed.completion_target, "one_task");
  assert.equal(parsed.next_task.id, "1.2");
});

test("select-next-task reports complete when only manual tasks remain", () => {
  const result = runSelectNextTask(`# Tasks

## 1. Delivery

- [x] 1.1 Complete the first task
  - Justification: deployment risk is lower when the implementation is paired with manual production verification.
- [ ] 1.2 Manual production verification
`);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "complete");
  assert.equal(parsed.caller, "direct");
  assert.equal(parsed.delivery_goal, "next_task");
  assert.equal(parsed.next_delivery_unit, null);
  assert.equal(parsed.next_task, null);
});

test("select-next-task rejects lifecycle-only task shapes", () => {
  const result = runSelectNextTask(`# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser

## 2. Validation

- [ ] 2.1 Run validation checks
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /lifecycle_phase_group/);
});

test("select-next-task rejects proof-only task shapes before handoff", () => {
  const result = runSelectNextTask(`# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser
- [ ] 1.2 Run validation checks
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /proof_only_task/);
});

test("select-next-task coerces plan-orchestrator calls to full-change delivery", () => {
  const result = runSelectNextTask(
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete the first task
- [ ] 1.2 Implement the second task
`,
    ["--caller", "plan_orchestrator", "--goal", "next_task"],
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "ready");
  assert.equal(parsed.caller, "plan_orchestrator");
  assert.equal(parsed.delivery_goal, "complete_change");
  assert.equal(parsed.completion_target, "all_deliverable_tasks");
  assert.equal(parsed.next_delivery_unit.id, "1");
  assert.equal(parsed.next_task.id, "1.2");
});

test("select-next-task reports OpenSpec completion for plan-orchestrator only after no unchecked deliverables remain", () => {
  const result = runSelectNextTask(
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete the first task
  - Justification: deployment risk is lower when the implementation is paired with manual production verification.
- [ ] 1.2 Manual production verification
`,
    ["--caller", "plan_orchestrator"],
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "openspec_complete");
  assert.equal(parsed.caller, "plan_orchestrator");
  assert.equal(parsed.delivery_goal, "complete_change");
  assert.equal(parsed.completion_target, "all_deliverable_tasks");
  assert.equal(parsed.next_delivery_unit, null);
  assert.equal(parsed.next_task, null);
});
