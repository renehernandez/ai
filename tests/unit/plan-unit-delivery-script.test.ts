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
  extraArgs: string[] = [],
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
          ...extraArgs,
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
        ...extraArgs,
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

function runPlanUnitDeliveryArgs(
  args: string[],
  content: string,
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-unit-delivery/scripts/plan-unit-delivery.ts",
      ...args,
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: content,
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

const reviewGateDiffHash =
  "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function runTaskDelta(
  base: string,
  head: string,
  id: string,
  mode: "--task" | "--unit" = "--task",
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
        mode,
        id,
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
    id: "1"
    title: Add plan delivery
    scope: Implement one OpenSpec delivery unit.
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
    stack_identity:
      expected_base_ref: plan/example
      expected_base_sha: def456
      predecessor_artifact: https://example.test/review/1
      selected_unit_base_sha: def456
      restack_required: false
    completion_updates:
      - Mark OpenSpec delivery-unit work item checkboxes complete in the same MR.
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
  blockers: []
`;

const launchedReport = `reviewer_launch:
  status: launched
  launched_reviewers:
    - implementation-review
    - implementation-scrutiny
    - code-quality-review
    - code-simplifier
    - deslop
    - docs-alignment-review
  skipped_reviewers:
    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review: not_applicable - no security-sensitive surface changed
  review_pass_ids:
    - implementation-review: inline-a
    - implementation-scrutiny: inline-b
    - code-quality-review: inline-c
    - code-simplifier: inline-d
    - deslop: inline-e
    - docs-alignment-review: inline-f
`;

const reviewerReport = `reviewer_report:
  status: complete
  reviewed_diff_hash: ${reviewGateDiffHash}
  launched_reviewers:
    - implementation-review
    - implementation-scrutiny
    - code-quality-review
    - code-simplifier
    - deslop
    - docs-alignment-review
  skipped_reviewers:
    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review: not_applicable - no security-sensitive surface changed
  outcomes:
    - implementation-review: passed - implementation review found no blocking issues
    - implementation-scrutiny: passed - scrutiny verdict ship
    - code-quality-review: passed - code quality review found no maintainability findings
    - code-simplifier: passed - simplification review found no needed changes
    - deslop: passed - deslop review found no AI-shaped clutter
    - docs-alignment-review: passed - docs-alignment-review verdict clean for touched skill surfaces
`;

function reviewerEvidenceWithLaunchedSecurityReview(): {
  launch: string;
  report: string;
} {
  const launch = launchedReport
    .replace(
      "    - docs-alignment-review\n",
      "    - docs-alignment-review\n    - security-review\n",
    )
    .replace(
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n    - security-review: not_applicable - no security-sensitive surface changed\n",
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n",
    )
    .replace(
      "    - docs-alignment-review: inline-f\n",
      "    - docs-alignment-review: inline-f\n    - security-review: inline-g\n",
    );
  const report = reviewerReport
    .replace(
      "    - docs-alignment-review\n",
      "    - docs-alignment-review\n    - security-review\n",
    )
    .replace(
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n    - security-review: not_applicable - no security-sensitive surface changed\n",
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n",
    )
    .replace(
      "    - docs-alignment-review: passed - docs-alignment-review verdict clean for touched skill surfaces\n",
      "    - docs-alignment-review: passed - docs-alignment-review verdict clean for touched skill surfaces\n    - security-review: passed - security review found no sensitive surface issues\n",
    );

  return { launch, report };
}

function reviewerEvidenceWithOverlappingSecurityReview(): {
  launch: string;
  report: string;
} {
  const evidence = reviewerEvidenceWithLaunchedSecurityReview();
  return {
    launch: evidence.launch.replace(
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n",
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n    - security-review: not_applicable - no security-sensitive surface changed\n",
    ),
    report: evidence.report.replace(
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n",
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n    - security-review: not_applicable - no security-sensitive surface changed\n",
    ),
  };
}

const deliveryLedger = `nitro_feedback_gate:
  artifact: https://git.fullscript.io/group/project/-/merge_requests/2
  head_sha: abc789
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - glab mr note 2 -m "/request_review @nitro"
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

delivery_gate_ledger:
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
  unit_artifact_boundary:
    status: passed
    evidence: selected delivery unit delivered in one separate MR
  delivery_unit_delta:
    status: passed
    evidence: exactly delivery unit 1 changed from unchecked to checked
    command: pnpm exec tsx skills/plan-unit-delivery/scripts/plan-unit-delivery.ts validate-task-delta --base base.md --head head.md --unit 1
    output: |
      {
        "status": "delivery_unit_delta_valid",
        "added_unit": {
          "id": "1",
          "title": "Delivery"
        },
        "added_work_items": [
          {
            "id": "1.1",
            "title": "Tighten orchestrator contract",
            "checked": true
          },
          {
            "id": "1.2",
            "title": "Update delivery ledger",
            "checked": true
          }
        ]
      }
  local_verification:
    status: passed
    evidence: pnpm run test:unit
  refactoring_execution:
    status: passed
    evidence: required refactors implemented or deferred
  reviewer_passes:
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
    evidence: docs-alignment-review verdict clean for touched skill and OpenSpec surfaces
  review_feedback_routing:
    status: passed
    evidence: github selected
  implementation_artifact_separation:
    status: passed
    evidence: implementation PR is separate from planning review PR
  description_policy:
    status: passed
    evidence: MR body updated and read back at current implementation head
    owner: glab-mr-create
    artifact: https://git.fullscript.io/group/project/-/merge_requests/2
    head_sha: abc789
    update_mode: updated
    materiality_decision: material_update
    readback_head_sha: abc789
    read_before_update: true
    pre_update_body_evidence: prior body hash retained for manual-section recovery
    readback_after_update: true
    readback_outcome: clean
    preserved_manual_sections: true
    rollback_or_restore_evidence: none
    omitted_process_history: true
    omitted_private_artifacts: true
  artifact_creation_update:
    status: passed
    evidence: PR URL
  stack_identity:
    status: passed
    evidence: implementation artifact and latest head recorded
    selected_unit_id: "1"
    completed_work_item_ids: "1.1, 1.2"
    selected_unit_base_sha: def456
    predecessor_artifact: https://example.test/review/1
    implementation_artifact: https://git.fullscript.io/group/project/-/merge_requests/2
    implementation_head_sha: abc789
    restack_required: false
  artifact_host_review:
    status: passed
    evidence: PR inspected
  pipeline_monitoring:
    status: passed
    evidence: latest-head pipeline passed
  automatic_review_feedback_wait:
    status: passed
    evidence: latest-head Nitro feedback resolved
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
      "    completion_updates:\n      - Mark OpenSpec delivery-unit work item checkboxes complete in the same MR.\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /openspec_task route requires delivery.completion_updates/,
  );
});

test("review-gate-input maps validated delivery evidence to active gate input", () => {
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${launchedReport}\n${reviewerReport}`,
    ["--diff-hash", reviewGateDiffHash, "--source-ref", "handoff.yaml"],
  );
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.workflow, "plan-unit-delivery");
  assert.equal(output.unit.id, "1");
  assert.equal(output.unit.title, "Add plan delivery");
  assert.equal(output.sourceProvenance.kind, "plan_delivery_handoff");
  assert.equal(output.sourceProvenance.ref, "openspec/changes/example-change");
  assert.equal(output.sourceProvenance.phase, "plan-unit-delivery");
  assert.deepEqual(output.sourceProvenance.evidence, [
    "handoff.yaml",
    "skipped reviewer ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed",
    "skipped reviewer security-review: not_applicable - no security-sensitive surface changed",
  ]);
  assert.deepEqual(output.requiredReviewPasses, [
    "implementation-review",
    "implementation-scrutiny",
    "code-quality-review",
    "code-simplifier",
    "deslop",
    "docs-alignment-review",
  ]);
  assert.equal(
    output.results["implementation-review"].diffHash,
    reviewGateDiffHash,
  );
  assert.equal(output.results["implementation-review"].status, "passed");
  assert.match(
    output.results["implementation-review"].summary,
    /no blocking issues/,
  );
  assert.ok(!output.requiredReviewPasses.includes("ai-readiness-upkeep"));
  assert.ok(!output.requiredReviewPasses.includes("security-review"));
  assert.equal(output.results["security-review"], undefined);
  assert.deepEqual(output.blockingFindings, []);
});

test("review-gate-input requires a diff hash value", () => {
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${launchedReport}\n${reviewerReport}`,
    ["--diff-hash", "--source-ref", "handoff.yaml"],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review-gate-input requires --diff-hash/);
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects mismatched launch and report evidence", () => {
  const evidence = reviewerEvidenceWithLaunchedSecurityReview();
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${evidence.launch}\n${reviewerReport}`,
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid reviewer launch\/report pair/);
  assert.match(
    result.stderr,
    /reviewer_report missing launched reviewer: security-review/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects stale reviewer report evidence", () => {
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${launchedReport}\n${reviewerReport.replace(
      reviewGateDiffHash,
      "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    )}`,
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /reviewer_report\.reviewed_diff_hash is stale for current staged diff/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input promotes launched dynamic reviewers to required gate passes", () => {
  const evidence = reviewerEvidenceWithLaunchedSecurityReview();
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${evidence.launch}\n${evidence.report}`,
    ["--diff-hash", reviewGateDiffHash],
  );
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.ok(output.requiredReviewPasses.includes("security-review"));
  assert.ok(!output.requiredReviewPasses.includes("ai-readiness-upkeep"));
  assert.equal(output.results["security-review"].status, "passed");
  assert.equal(output.results["security-review"].diffHash, reviewGateDiffHash);
  assert.match(output.sourceProvenance.evidence[0], /input\.yaml$/);
  assert.deepEqual(output.sourceProvenance.evidence.slice(1), [
    "skipped reviewer ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed",
  ]);
});

test("review-gate-input rejects reviewers listed as both launched and skipped", () => {
  const evidence = reviewerEvidenceWithOverlappingSecurityReview();
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${evidence.launch}\n${evidence.report}`,
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /security-review cannot be both launched and skipped/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects nonpassing launched required gate passes", () => {
  const result = runPlanUnitDelivery(
    "review-gate-input",
    `${validHandoff}\n${launchedReport}\n${reviewerReport.replace(
      "    - code-simplifier: passed - simplification review found no needed changes\n",
      "    - code-simplifier: not_applicable - simplification review skipped after launch\n",
    )}`,
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid delivery review gate evidence/);
  assert.match(
    result.stderr,
    /required review pass must be passed: code-simplifier/,
  );
  assert.equal(result.stdout, "");
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
      result.stdout.indexOf("reviewer_launch:"),
  );
  assert.match(result.stdout, /reviewer_report:/);
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

test("validate-task-delta accepts exactly one completed delivery unit", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete base task
- [ ] 1.2 Add stacked task
- [ ] 1.3 Add later task

## 2. Follow-up

- [ ] 2.1 Add unrelated task
- [ ] 2.2 Add unrelated fixture
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete base task
- [x] 1.2 Add stacked task
- [x] 1.3 Add later task

## 2. Follow-up

- [ ] 2.1 Add unrelated task
- [ ] 2.2 Add unrelated fixture
`,
    "1",
    "--unit",
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "delivery_unit_delta_valid");
  assert.equal(parsed.added_unit.id, "1");
  assert.deepEqual(
    parsed.added_work_items.map((item: { id: string }) => item.id),
    ["1.2", "1.3"],
  );
});

test("validate-task-delta preserves legacy single-task mode", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete base task
- [ ] 1.2 Add stacked task
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Complete base task
- [x] 1.2 Add stacked task
`,
    "1.2",
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "unit_task_delta_valid");
  assert.equal(parsed.added_task.id, "1.2");
});

test("validate-task-delta rejects incomplete selected delivery unit", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
- [ ] 1.2 Add second task
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Add first task
- [ ] 1.2 Add second task
`,
    "1",
    "--unit",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_delta_missing/);
});

test("validate-task-delta rejects future nested items checked early", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task

## 2. Later Delivery

- [ ] 2.1 Add later task
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Add first task

## 2. Later Delivery

- [x] 2.1 Add later task
`,
    "1",
    "--unit",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_delta_unexpected/);
});

test("validate-task-delta rejects two delivery units checked in one MR", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
- [ ] 1.2 Add second task

## 2. Later Delivery

- [ ] 2.1 Add later task
- [ ] 2.2 Add later fixture
`,
    `# Tasks

## 1. Delivery

- [x] 1.1 Add first task
- [x] 1.2 Add second task

## 2. Later Delivery

- [x] 2.1 Add later task
- [x] 2.2 Add later fixture
`,
    "1",
    "--unit",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_delta_unexpected/);
});

test("validate-task-delta rejects rollback or downgrade status", () => {
  const result = runTaskDelta(
    `# Tasks

## 1. Delivery

- [x] 1.1 Add first task
- [ ] 1.2 Add second task
`,
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add first task
- [x] 1.2 Add second task
`,
    "1",
    "--unit",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_delta_invalid_tasks/);
});

test("validate-launch-report requires AI readiness accounting", () => {
  const valid = runPlanUnitDelivery("validate-launch-report", launchedReport);

  assert.equal(valid.status, 0);

  const invalid = runPlanUnitDelivery(
    "validate-launch-report",
    launchedReport.replace(
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n",
      "",
    ),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /ai-readiness-upkeep must be launched or listed/,
  );

  const placeholderEvidence = runPlanUnitDelivery(
    "validate-launch-report",
    launchedReport.replace(
      "    - ai-readiness-upkeep: not_applicable - no AI readiness verification or agent-surface contract changed\n",
      "    - ai-readiness-upkeep: not_applicable - <evidence>\n",
    ),
  );

  assert.notEqual(placeholderEvidence.status, 0);
  assert.match(
    placeholderEvidence.stderr,
    /ai-readiness-upkeep skipped evidence is required/,
  );
  assert.match(
    placeholderEvidence.stderr,
    /ai-readiness-upkeep must be launched or listed/,
  );

  const unknownSkippedReviewer = runPlanUnitDelivery(
    "validate-launch-report",
    launchedReport.replace(
      "    - security-review: not_applicable - no security-sensitive surface changed\n",
      "    - unknown-review: not_applicable - no security-sensitive surface changed\n",
    ),
  );

  assert.notEqual(unknownSkippedReviewer.status, 0);
  assert.match(unknownSkippedReviewer.stderr, /unknown skipped reviewer/);
  assert.match(
    unknownSkippedReviewer.stderr,
    /security-review must be launched or listed/,
  );
});

test("validate-ledger accepts delivery gate evidence", () => {
  const result = runPlanUnitDelivery("validate-ledger", deliveryLedger);

  assert.equal(result.status, 0);
});

test("validate-ledger accepts atomic plan delivery without task-delta proof", () => {
  const atomicLedger = deliveryLedger
    .replace(
      / {2}delivery_unit_delta:[\s\S]*? {2}local_verification:/,
      `  delivery_unit_delta:
    status: not_applicable
    evidence: atomic plan unit has no OpenSpec checkbox delta
  local_verification:`,
    )
    .replace('    selected_unit_id: "1"', "    selected_unit_id: atomic");

  const result = runPlanUnitDelivery("validate-ledger", atomicLedger);

  assert.equal(result.status, 0);
});

test("validate-ledger rejects atomic plan task-delta command leftovers", () => {
  const atomicLedger = deliveryLedger.replace(
    '    selected_unit_id: "1"',
    "    selected_unit_id: atomic",
  );

  const result = runPlanUnitDelivery(
    "validate-ledger",
    atomicLedger.replace(
      "    status: passed\n    evidence: exactly delivery unit 1 changed from unchecked to checked",
      "    status: not_applicable\n    evidence: atomic plan unit has no OpenSpec checkbox delta",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_unit_delta\.command and output must be omitted for atomic plan delivery/,
  );
});

test("validate-ledger requires a passed Nitro feedback gate", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      /^nitro_feedback_gate:[\s\S]*?\n\ndelivery_gate_ledger:/,
      "delivery_gate_ledger:",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nitro_feedback_gate.artifact/);
});

test("validate-ledger requires description policy evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      / {2}description_policy:[\s\S]*? {2}artifact_creation_update:/,
      "  artifact_creation_update:",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /description_policy is required/);
});

test("validate-ledger rejects description policy for prior head", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace("    head_sha: abc789", "    head_sha: old123"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /description_policy\.head_sha must match current artifact head/,
  );
});

test("validate-ledger rejects self-consistent stale head when expected head differs", () => {
  const result = runPlanUnitDeliveryArgs(
    [
      "validate-ledger",
      "--expected-artifact",
      "https://git.fullscript.io/group/project/-/merge_requests/2",
      "--expected-head-sha",
      "new789",
    ],
    deliveryLedger,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /stack_identity\.implementation_head_sha must match expected current artifact head/,
  );
  assert.match(
    result.stderr,
    /description_policy\.head_sha must match current artifact head/,
  );
});

test("validate-ledger rejects description policy missing evidence despite sibling evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    evidence: MR body updated and read back at current implementation head\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /description_policy\.evidence is required/);
});

test("validate-ledger rejects scalar placeholder description policy evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    evidence: MR body updated and read back at current implementation head",
      "    evidence: <description create/update/readback evidence>",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /description_policy\.evidence must not contain placeholder values/,
  );
});

test("validate-ledger accepts created description policy with explicit not applicable update fields", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger
      .replace("    update_mode: updated", "    update_mode: created")
      .replace(
        "    read_before_update: true",
        "    read_before_update: not_applicable_for_created",
      )
      .replace(
        "    pre_update_body_evidence: prior body hash retained for manual-section recovery",
        "    pre_update_body_evidence: not_applicable_for_created",
      )
      .replace(
        "    preserved_manual_sections: true",
        "    preserved_manual_sections: not_applicable_for_created",
      )
      .replace(
        "    rollback_or_restore_evidence: none",
        "    rollback_or_restore_evidence: not_applicable_for_created",
      ),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /delivery_gate_ledger valid/);
});

test("validate-ledger rejects reused description evidence without rationale", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger
      .replace("    update_mode: updated", "    update_mode: reused_current")
      .replace(
        "    materiality_decision: material_update",
        "    materiality_decision: metadata_only_reuse",
      ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /description_policy\.reuse_rationale/);
});

test("validate-ledger rejects restored readback without restore evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    readback_outcome: clean",
      "    readback_outcome: restored",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /description_policy\.rollback_or_restore_evidence is required when readback_outcome is restored/,
  );
});

test("validate-ledger rejects metadata-only materiality for updated descriptions", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    materiality_decision: material_update",
      "    materiality_decision: metadata_only_reuse",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /description_policy\.materiality_decision metadata_only_reuse requires update_mode reused_current/,
  );
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
      "    evidence: latest-head Nitro feedback resolved\n",
      "    evidence: latest-head review checked\n",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /automatic_review_feedback_wait\.evidence must show resolved Nitro feedback/,
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

test("validate-ledger requires one MR per delivery unit evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "selected delivery unit delivered in one separate MR",
      "selected delivery unit split across multiple MRs",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unit_artifact_boundary.evidence must prove/);
});

test("validate-ledger requires selected unit identity evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace('    selected_unit_id: "1"\n', ""),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stack_identity\.selected_unit_id/);
});

test("validate-ledger requires predecessor artifact evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    predecessor_artifact: https://example.test/review/1\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stack_identity\.predecessor_artifact/);
});

test("validate-ledger requires validate-task-delta command evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    command: pnpm exec tsx skills/plan-unit-delivery/scripts/plan-unit-delivery.ts validate-task-delta --base base.md --head head.md --unit 1\n",
      "    command: pnpm test\n",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_unit_delta\.command must run validate-task-delta/,
  );
});

test("validate-ledger requires task-delta validator output evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      `    output: |
      {
        "status": "delivery_unit_delta_valid",
        "added_unit": {
          "id": "1",
          "title": "Delivery"
        },
        "added_work_items": [
          {
            "id": "1.1",
            "title": "Tighten orchestrator contract",
            "checked": true
          },
          {
            "id": "1.2",
            "title": "Update delivery ledger",
            "checked": true
          }
        ]
      }
`,
      "    output: task checked manually\n",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_unit_delta\.output must include delivery_unit_delta_valid/,
  );
});

test("validate-ledger requires task-delta command to match selected unit", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace("--unit 1", "--unit 2"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_unit_delta\.command --unit must match stack_identity\.selected_unit_id/,
  );
});

test("validate-ledger requires task-delta output to match selected unit", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace('"id": "1"', '"id": "2"'),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_unit_delta\.output added_unit\.id must match stack_identity\.selected_unit_id/,
  );
});

test("validate-ledger requires Nitro artifact to match stack identity", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    implementation_artifact: https://git.fullscript.io/group/project/-/merge_requests/2",
      "    implementation_artifact: https://git.fullscript.io/group/project/-/merge_requests/3",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /nitro_feedback_gate\.artifact must match stack_identity\.implementation_artifact/,
  );
});

test("validate-ledger requires Nitro head to match stack identity", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    implementation_head_sha: abc789",
      "    implementation_head_sha: def999",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /nitro_feedback_gate\.head_sha must match stack_identity\.implementation_head_sha/,
  );
});

test("validate-ledger requires docs-alignment-review verdict evidence", () => {
  const result = runPlanUnitDelivery(
    "validate-ledger",
    deliveryLedger.replace(
      "    evidence: docs-alignment-review verdict clean for touched skill and OpenSpec surfaces",
      "    evidence: no docs changes",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /docs_alignment\.evidence must reference a docs-alignment-review verdict/,
  );
});
