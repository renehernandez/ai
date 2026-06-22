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
  status: inspected
  intake: existing_openspec
  planning_artifact: openspec/changes/example-change
  planning_review_state: reviewed
  planning_artifact_ref: https://git.fullscript.io/group/project/-/merge_requests/1
  current_stack_tip: https://git.fullscript.io/group/project/-/merge_requests/2
  task_state_fingerprint: feedface
  implementation_stack:
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      role: planning
      head_sha: def456
      nitro_gate_outcome: passed
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
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
    all_deliverable_tasks_checked: true
    fingerprint: feedface
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
