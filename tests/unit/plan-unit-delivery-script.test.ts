import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-unit-delivery-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempFiles(
  files: Record<string, string>,
  callback: (paths: Record<string, string>) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-unit-delivery-script-"));
  const paths: Record<string, string> = {};
  try {
    for (const [name, content] of Object.entries(files)) {
      const path = join(directory, name);
      writeFileSync(path, content, "utf8");
      paths[name] = path;
    }
    callback(paths);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanUnitDelivery(
  command: string,
  content = "",
): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;
  if (content) {
    withTempFile(content, (path) => {
      result = spawnSync(
        "pnpm",
        [
          "exec",
          "tsx",
          "skills/plan-unit-delivery/scripts/plan-unit-delivery.ts",
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
  } else {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/plan-unit-delivery/scripts/plan-unit-delivery.ts",
        command,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
  }

  assert.ok(result);
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runTaskDelta(
  base: string,
  head: string,
  taskId: string,
): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTempFiles({ "base.md": base, "head.md": head }, (paths) => {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/plan-unit-delivery/scripts/plan-unit-delivery.ts",
        "validate-task-delta",
        "--base",
        paths["base.md"],
        "--head",
        paths["head.md"],
        "--task",
        taskId,
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
      - Plan Orchestrator validates the handoff.
    verification:
      - pnpm test:unit
  constraints:
    files_or_areas:
      - skills/plan-unit-delivery
    out_of_scope: []
  delivery:
    expected_host: github_pr
    completion_updates:
      - Mark OpenSpec task checkbox complete in the same PR/MR.
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
  blockers: []
`;

const launchedReport = `reviewer_subagent_launch:
  status: launched
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  subagent_ids:
    - implementation-review-agent: 019-a
    - implementation-scrutiny-agent: 019-b
    - code-quality-review-agent: 019-c
    - code-simplifier-agent: 019-d
    - deslop-agent: 019-e
    - docs-alignment-review-agent: 019-f
`;

const deliveryLedger = `delivery_gate_ledger:
  handoff_validation:
    status: passed
    evidence: plan_delivery_handoff validated
  session_start:
    status: passed
    evidence: repo inspected
  slice_status:
    status: passed
    evidence: approved unit status recorded
  implementation:
    status: passed
    evidence: approved unit implemented
  local_verification:
    status: passed
    evidence: pnpm run test:unit
  refactoring_execution:
    status: passed
    evidence: required refactors implemented or deferred
  reviewer_subagents:
    status: passed
    evidence: reviewer reports validated
  implementation_review:
    status: passed
    evidence: no findings
  implementation_scrutiny:
    status: passed
    evidence: ship
  code_quality_review:
    status: passed
    evidence: no structural findings
  code_simplifier:
    status: passed
    evidence: complete
  deslop:
    status: passed
    evidence: complete
  security_review:
    status: not_applicable
    evidence: no security surface
  ai_readiness_upkeep:
    status: not_applicable
    evidence: no AI readiness surface
  docs_alignment:
    status: passed
    evidence: clean
  review_feedback_routing:
    status: passed
    evidence: github selected
  implementation_artifact_separation:
    status: passed
    evidence: implementation PR is separate from planning review PR
  artifact_creation_update:
    status: passed
    evidence: PR URL
  artifact_host_review:
    status: passed
    evidence: PR inspected
  pipeline_monitoring:
    status: passed
    evidence: latest-head pipeline passed
  automatic_review_feedback_wait:
    status: passed
    evidence: latest-head automatic review feedback resolved
`;

test("validate-handoff accepts the delivery handoff", () => {
  const result = runPlanUnitDelivery("validate-handoff", validHandoff);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_delivery_handoff valid/);
});

test("validate-handoff rejects legacy handoffs", () => {
  const result = runPlanUnitDelivery(
    "validate-handoff",
    `plan_ready_handoff:
  status: ready
  reviewed_slices:
    - slice-01
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /plan_ready_handoff is legacy; rerun plan-ready/);
  assert.match(result.stderr, /reviewed_slices is legacy; rerun plan-ready/);
});

test("validate-handoff requires completion updates for OpenSpec tasks", () => {
  const result = runPlanUnitDelivery(
    "validate-handoff",
    validHandoff.replace(
      "    completion_updates:\n      - Mark OpenSpec task checkbox complete in the same PR/MR.\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /openspec_task route requires delivery.completion_updates/,
  );
});

test("old followthrough delivery commands are not supported", () => {
  const result = runPlanUnitDelivery(
    "validate-followthrough-delivery",
    "plan_followthrough_delivery: {}",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: plan-unit-delivery\.ts/);
});

test("gate-template emits a readable summary before YAML", () => {
  const result = runPlanUnitDelivery("gate-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("delivery_gate_ledger:"),
  );
  assert.match(result.stdout, /delivery_gate_ledger:/);
});

test("reviewer-template emits a readable summary before YAML", () => {
  const result = runPlanUnitDelivery("reviewer-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("reviewer_subagent_launch:"),
  );
  assert.match(result.stdout, /reviewer_subagent_report:/);
});

test("refactoring-template emits a readable summary before YAML", () => {
  const result = runPlanUnitDelivery("refactoring-template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("refactoring_execution:"),
  );
  assert.match(result.stdout, /refactoring_execution:/);
});

test("validate-task-delta accepts exactly one expected checked deliverable", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete base task
- [ ] 1.2 Add stacked task
- [ ] 1.3 Add later task
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete base task
- [x] 1.2 Add stacked task
- [ ] 1.3 Add later task
`,
    "1.2",
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "unit_task_delta_valid");
  assert.equal(parsed.added_task.id, "1.2");
});

test("validate-task-delta rejects missing selected task checkbox", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
`,
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
`,
    "1.1",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unit_task_delta_missing/);
});

test("validate-task-delta rejects multiple newly checked deliverables", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
- [ ] 1.2 Add second task
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Add first task
- [x] 1.2 Add second task
`,
    "1.1",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unit_task_delta_multiple/);
});

test("validate-task-delta rejects an unexpected checked task", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
- [ ] 1.2 Add second task
`,
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
- [x] 1.2 Add second task
`,
    "1.1",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unit_task_delta_unexpected/);
});

test("validate-launch-report requires AI readiness accounting", () => {
  const valid = runPlanUnitDelivery("validate-launch-report", launchedReport);

  assert.equal(valid.status, 0);

  const invalid = runPlanUnitDelivery(
    "validate-launch-report",
    launchedReport.replace(
      "    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed\n",
      "",
    ),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /ai-readiness-upkeep-agent must be launched or listed/,
  );
});

test("validate-ledger accepts delivery gate evidence", () => {
  const result = runPlanUnitDelivery("validate-ledger", deliveryLedger);

  assert.equal(result.status, 0);
});

test("validate-ledger requires refactoring execution evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "  refactoring_execution:\n    status: passed\n    evidence: required refactors implemented or deferred\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /refactoring_execution is required/);
});

test("validate-ledger requires automatic review feedback wait evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    evidence: latest-head automatic review feedback resolved\n",
      "    evidence: latest-head review checked\n",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /automatic_review_feedback_wait\.evidence must show resolved feedback/,
  );
});

test("validate-ledger requires implementation artifact separation evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "implementation PR is separate from planning review PR",
      "same PR reused",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /implementation_artifact_separation.evidence must prove/,
  );
});
