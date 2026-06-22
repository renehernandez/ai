import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-orchestrator-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanOrchestrator(
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
        "skills/plan-orchestrator/scripts/plan-orchestrator.ts",
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

function runPlanOrchestratorCommand(command: string): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-orchestrator/scripts/plan-orchestrator.ts",
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

const planningReview = `planning_review:
  status: reviewed
  artifact_type: plan
  artifact_ref: .agents/plans/example.md
  review_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
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
      - plan artifact reviewed
  review:
    evidence:
      - planning PR latest-head Nitro feedback completed cleanly
  blockers: []
`;

const resumeReport = `orchestrator_resume:
  status: resume_ready
  intake: existing_openspec
  planning_artifact: openspec/changes/example-change
  planning_review_state: reviewed
  planning_artifact_ref: https://git.fullscript.io/group/project/-/merge_requests/1
  current_stack_tip: https://git.fullscript.io/group/project/-/merge_requests/2
  task_state_fingerprint: feedface
  task_state:
    fingerprint: feedface
    tasks_markdown: |
      ## 1. Example Change

      - [x] 1.1 First deliverable
      - [ ] 1.2 Future deliverable
  task_artifacts:
    - task_id: "1.1"
      artifact: https://git.fullscript.io/group/project/-/merge_requests/2
  implementation_stack:
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      role: planning
      head_sha: def456
      nitro_gate_outcome: passed
      predecessor_artifact:
      task_delta_validated: true
      cumulative_task_state_valid: true
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      task_delta_validated: true
      cumulative_task_state_valid: true
  restack_required: false
  restack_evidence:
    - no earlier MR changed after descendants
  blockers: []
`;

const stackReady = `stack_ready:
  status: ready
  planning_artifact: openspec/changes/example-change
  target_branch: main
  stack_tip: https://git.fullscript.io/group/project/-/merge_requests/2
  task_state:
    fingerprint: feedface
    tasks_markdown: |
      ## 1. Example Change

      - [x] 1.1 First deliverable
      - [x] 1.2 Second deliverable
  task_artifacts:
    - task_id: "1.1"
      artifact: https://git.fullscript.io/group/project/-/merge_requests/2
    - task_id: "1.2"
      artifact: https://git.fullscript.io/group/project/-/merge_requests/3
  stack:
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      role: planning
      base_sha: abc123
      head_sha: def456
      nitro_gate_outcome: passed
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      base_sha: def456
      head_sha: abc789
      nitro_gate_outcome: passed
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/3
      role: implementation
      base_sha: abc789
      head_sha: beef123
      nitro_gate_outcome: passed
  restack_required: false
  integrity_evidence:
    - implementation MR base matches planning MR head
  blockers: []
`;

test("plan-review-request-template emits a readable summary before YAML", () => {
  const result = runPlanOrchestratorCommand("plan-review-request-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("plan_review_request:"),
  );
  assert.match(result.stdout, /plan_review_request:/);
});

test("resume-template emits a readable summary before YAML", () => {
  const result = runPlanOrchestratorCommand("resume-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("orchestrator_resume:"),
  );
  assert.match(result.stdout, /status: resume_ready \| delivery_blocked/);
  assert.doesNotMatch(result.stdout, /status: inspected/);
});

test("stack-ready-template emits a readable summary before YAML", () => {
  const result = runPlanOrchestratorCommand("stack-ready-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("stack_ready:"),
  );
});

test("validate-planning-review accepts reviewed planning", () => {
  const result = runPlanOrchestrator(
    "validate-planning-review",
    planningReview,
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /planning_review valid/);
});

test("validate-planning-review rejects legacy inputs", () => {
  const result = runPlanOrchestrator(
    "validate-planning-review",
    `plan_coordinate_handoff:
  status: ready
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /plan_coordinate_handoff is legacy/);
});

test("validate-planning-review rejects retired planning modes", () => {
  const result = runPlanOrchestrator(
    "validate-planning-review",
    planningReview.replace("mode: stacked_delivery", "mode: stack_when_ready"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review.mode stack_when_ready is legacy/,
  );
});

test("validate-planning-review blocks unsupported review hosts", () => {
  const result = runPlanOrchestrator(
    "validate-planning-review",
    planningReview.replace(
      "https://git.fullscript.io/group/project/-/merge_requests/1",
      "https://github.com/example/project/pull/1",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_blocked: unsupported stack\/review host/,
  );
});

test("validate-resume accepts inspected stack state", () => {
  const result = runPlanOrchestrator("validate-resume", resumeReport);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /orchestrator_resume valid/);
});

test("validate-resume blocks unsupported stack hosts", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "current_stack_tip: https://git.fullscript.io/group/project/-/merge_requests/2",
      "current_stack_tip: https://github.com/example/project/pull/2",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_blocked: unsupported stack\/review host/,
  );
});

test("validate-resume blocks resume-ready with stale predecessor gates", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "nitro_gate_outcome: passed",
      "nitro_gate_outcome: pending",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /nitro_gate_outcome must be passed before resume_ready/,
  );
});

test("validate-resume blocks resume-ready with invalid cumulative task state", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1\n      task_delta_validated: true\n      cumulative_task_state_valid: true",
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1\n      task_delta_validated: true\n      cumulative_task_state_valid: false",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /cumulative_task_state_valid must be true before resume_ready/,
  );
});

test("validate-resume blocks implementation entries without predecessor artifacts", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1",
      "      predecessor_artifact:",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /predecessor_artifact evidence is required before resume_ready/,
  );
});

test("validate-resume blocks implementation entries without task-delta evidence", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1\n      task_delta_validated: true",
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /task_delta_validated must be true for every implementation artifact before resume_ready/,
  );
});

test("validate-resume blocks later implementation entries without predecessor artifacts", () => {
  const twoImplementationResume = resumeReport.replace(
    `    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      task_delta_validated: true
      cumulative_task_state_valid: true`,
    `    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      task_delta_validated: true
      cumulative_task_state_valid: true
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/3
      role: implementation
      head_sha: beef123
      nitro_gate_outcome: passed
      task_delta_validated: true
      cumulative_task_state_valid: true`,
  );
  const result = runPlanOrchestrator(
    "validate-resume",
    twoImplementationResume,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /predecessor_artifact evidence is required before resume_ready/,
  );
});

test("validate-resume blocks checked predecessor tasks without artifact evidence", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      '    - task_id: "1.1"\n      artifact: https://git.fullscript.io/group/project/-/merge_requests/2\n',
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /orchestrator_resume\.task_artifacts missing implementation artifact evidence for checked deliverable tasks 1\.1/,
  );
});

test("validate-resume blocks delivery-blocked reports without blockers", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace("status: resume_ready", "status: delivery_blocked"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /blockers must explain why resume is delivery_blocked/,
  );
});

test("validate-stack-ready accepts a clean reviewed stack", () => {
  const result = runPlanOrchestrator("validate-stack-ready", stackReady);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /stack_ready valid/);
});

test("validate-stack-ready rejects pending Nitro gates", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "nitro_gate_outcome: passed",
      "nitro_gate_outcome: pending",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nitro_gate_outcome must be passed/);
});

test("validate-stack-ready rejects self-attested task completion booleans", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "  task_state:\n    fingerprint: feedface",
      "  task_state:\n    all_deliverable_tasks_checked: true\n    fingerprint: feedface",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /self-attested/);
});

test("validate-stack-ready rejects partial stacks with unchecked deliverables", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "- [x] 1.2 Second deliverable",
      "- [ ] 1.2 Second deliverable",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /partial stack: unchecked deliverable tasks 1\.2/,
  );
});

test("validate-stack-ready rejects checked tasks without artifact evidence", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      '    - task_id: "1.2"\n      artifact: https://git.fullscript.io/group/project/-/merge_requests/3\n',
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /missing implementation artifact evidence for checked deliverable tasks 1\.2/,
  );
});

test("validate-stack-ready blocks unsupported stack hosts", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2",
      "    - artifact: https://github.com/example/project/pull/2",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_blocked: unsupported stack\/review host/,
  );
});

test("validate-stack-ready blocks unsupported stack tip hosts", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "stack_tip: https://git.fullscript.io/group/project/-/merge_requests/2",
      "stack_tip: https://github.com/example/project/pull/2",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_blocked: unsupported stack\/review host/,
  );
});

test("validate-stack-ready reports missing stack tip without unsupported host noise", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "  stack_tip: https://git.fullscript.io/group/project/-/merge_requests/2\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stack_ready.stack_tip/);
  assert.doesNotMatch(
    result.stderr,
    /delivery_blocked: unsupported stack\/review host/,
  );
});
