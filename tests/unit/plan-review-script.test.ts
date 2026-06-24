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

function withTempTasks(
  content: string,
  callback: (path: string) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-script-"));
  const path = join(directory, "tasks.md");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempOpenSpec(
  tasksContent: string,
  callback: (path: string) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-script-"));
  try {
    writeFileSync(join(directory, "tasks.md"), tasksContent, "utf8");
    callback(directory);
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

function runPlanReviewArgs(
  args: string[],
  input = "",
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "skills/plan-review/scripts/plan-review.ts", ...args],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input,
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
      - planning MR latest-head Nitro feedback completed cleanly
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
  assert.match(result.stdout, /openspec_task_shape:/);
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

test("validate-planning-diff rejects OpenSpec diffs with source-plan paths", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "openspec"],
    [
      "A\t.agents/plans/added.md",
      "M\t.agents/plans/modified.md",
      "D\t.agents/plans/deleted.md",
      "R100\t.agents/plans/old.md\topenspec/changes/example/proposal.md",
      "C100\topenspec/changes/example/tasks.md\t.agents/plans/copied.md",
      "T\t.agents/plans/type-changed.md",
    ].join("\n"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /artifact_type openspec/);
  assert.match(result.stderr, /A: \.agents\/plans\/added\.md/);
  assert.match(result.stderr, /D: \.agents\/plans\/deleted\.md/);
  assert.match(result.stderr, /R100: \.agents\/plans\/old\.md/);
  assert.match(result.stderr, /C100: \.agents\/plans\/copied\.md/);
  assert.match(result.stderr, /T: \.agents\/plans\/type-changed\.md/);
});

test("validate-planning-diff rejects Git-quoted OpenSpec source-plan paths", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "openspec"],
    [
      'A\t".agents/plans/source.md\\tmeta"',
      'M\t".agents/plans/source.review-request.md\\nmeta"',
      'A\t".agents\\\\plans\\\\source.handoff.yaml"',
    ].join("\n"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /artifact_type openspec/);
  assert.match(result.stderr, /source\.md/);
  assert.match(result.stderr, /source\.review-request\.md/);
  assert.match(result.stderr, /source\.handoff\.yaml/);
});

test("validate-planning-diff rejects deletion-only OpenSpec source-plan diffs", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "openspec"],
    "D\t.agents/plans/source.md\n",
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /D: \.agents\/plans\/source\.md/);
});

test("validate-planning-diff accepts atomic plan source-plan artifacts", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "plan"],
    "A\t.agents/plans/source.md\n",
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /planning_diff_valid/);
});

test("validate-planning-diff rejects atomic plan support sidecars across name-status entries", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "plan"],
    [
      "A\t.agents/plans/source.review-request.md",
      "M\t.agents/plans/source.handoff.yaml",
      "D\t.agents/plans/source.validation-output.json",
      "R100\t.agents/plans/old.review-request.md\tdocs/old.review-request.md",
      "R100\tdocs/new.handoff.yaml\t.agents/plans/new.handoff.yaml",
      "C100\t.agents/plans/copy-source.validation-output.json\tdocs/copy-source.validation-output.json",
      "C100\tdocs/copied.report.json\t.agents/plans/copied.report.json",
      "T\t.agents/plans/source.ledger.yaml",
      "A\t.agents/plans/primary-plan.md",
    ].join("\n"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /artifact_type plan/);
  assert.match(
    result.stderr,
    /thread evidence or the private AX plan workspace/,
  );
  assert.match(result.stderr, /A: \.agents\/plans\/source\.review-request\.md/);
  assert.match(result.stderr, /M: \.agents\/plans\/source\.handoff\.yaml/);
  assert.match(
    result.stderr,
    /D: \.agents\/plans\/source\.validation-output\.json/,
  );
  assert.match(result.stderr, /R100: \.agents\/plans\/old\.review-request\.md/);
  assert.match(result.stderr, /R100: \.agents\/plans\/new\.handoff\.yaml/);
  assert.match(
    result.stderr,
    /C100: \.agents\/plans\/copy-source\.validation-output\.json/,
  );
  assert.match(result.stderr, /C100: \.agents\/plans\/copied\.report\.json/);
  assert.match(result.stderr, /T: \.agents\/plans\/source\.ledger\.yaml/);
  assert.doesNotMatch(result.stderr, /\.agents\/plans\/primary-plan\.md/);
});

test("validate-planning-diff rejects Git-quoted atomic plan support sidecars", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "plan"],
    [
      'A\t".agents/plans/source.handoff.yaml\\tmeta"',
      'M\t".agents/plans/source.review-request.md\\nmeta"',
      'A\t".agents\\\\plans\\\\source.validation-output.json"',
    ].join("\n"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source\.handoff\.yaml/);
  assert.match(result.stderr, /source\.review-request\.md/);
  assert.match(result.stderr, /source\.validation-output\.json/);
});

test("validate-planning-diff accepts OpenSpec diffs without source-plan paths", () => {
  const result = runPlanReviewArgs(
    ["validate-planning-diff", "--artifact-type", "openspec"],
    "A\topenspec/changes/example/proposal.md\n",
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /planning_diff_valid/);
});

test("validate-openspec-tasks accepts deliverable OpenSpec task shapes", () => {
  withTempTasks(
    `## Feature Work

- [ ] 1.1 Add the plan-review OpenSpec task gate
      - Proof location: run the plan-review validate-openspec-tasks CLI entrypoint and observe pass or failure output.
      - Verify with the plan-review unit tests.
`,
    (path) => {
      const result = runPlanReviewArgs([
        "validate-openspec-tasks",
        "--tasks",
        path,
      ]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /"status": "pass"/);
    },
  );
});

test("validate-openspec-tasks accepts documented artifact-ref input", () => {
  withTempOpenSpec(
    `## Feature Work

- [ ] 1.1 Add the plan-review OpenSpec task gate
      - Proof location: run the plan-review validate-openspec-tasks CLI entrypoint and observe pass or failure output.
`,
    (path) => {
      const result = runPlanReviewArgs([
        "validate-openspec-tasks",
        "--artifact-ref",
        path,
      ]);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /"status": "pass"/);
    },
  );
});

test("validate-openspec-tasks blocks planning review on lifecycle task groups", () => {
  withTempTasks(
    `## Feature Work

- [ ] 1.1 Add the plan-review OpenSpec task gate

## Validation

- [ ] 2.1 Run tests and lint
`,
    (path) => {
      const result = runPlanReviewArgs([
        "validate-openspec-tasks",
        "--tasks",
        path,
      ]);

      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /"status": "needs_spec_redesign"/);
      assert.match(result.stderr, /needs_spec_redesign/);
      assert.match(
        result.stderr,
        /do not create or update the planning PR\/MR/,
      );
    },
  );
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

test("validate-planning-review rejects missing description policy", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      / {2}description_policy:[\s\S]*? {2}stack_base_ref:/,
      "  stack_base_ref:",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy is required/,
  );
});

test("validate-planning-review rejects description policy missing evidence despite sibling evidence", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      / {4}evidence:\n {6}- MR body read before update and read back at current planning head\n/,
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.evidence is required/,
  );
});

test("validate-planning-review rejects placeholder description policy evidence", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "- MR body read before update and read back at current planning head",
      "- <description create/update/readback evidence>",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.evidence must not contain placeholder values/,
  );
});

test("validate-planning-review accepts created description policy with explicit not applicable update fields", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview
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
  assert.match(result.stdout, /planning_review valid/);
});

test("validate-planning-review rejects stale description readback head", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "    readback_head_sha: def456",
      "    readback_head_sha: old123",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.readback_head_sha must match current artifact head/,
  );
});

test("validate-planning-review rejects self-consistent stale head when expected head differs", () => {
  const result = runPlanReviewArgs(
    [
      "validate-planning-review",
      "--expected-artifact",
      "https://example.test/review/1",
      "--expected-head-sha",
      "new789",
    ],
    planningReview,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.reviewed_head must match expected current artifact head/,
  );
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.head_sha must match current artifact head/,
  );
});

test("validate-planning-review rejects restored readback without restore evidence", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "    readback_outcome: clean",
      "    readback_outcome: restored",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.rollback_or_restore_evidence is required when readback_outcome is restored/,
  );
});

test("validate-planning-review rejects metadata reuse without rationale", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview
      .replace("    update_mode: updated", "    update_mode: reused_current")
      .replace(
        "    materiality_decision: material_update",
        "    materiality_decision: metadata_only_reuse",
      ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.reuse_rationale/,
  );
});

test("validate-planning-review rejects metadata-only materiality for updated descriptions", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "    materiality_decision: material_update",
      "    materiality_decision: metadata_only_reuse",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.materiality_decision metadata_only_reuse requires update_mode reused_current/,
  );
});

test("validate-planning-review rejects process-history description drift evidence", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      "    omitted_process_history: true",
      "    omitted_process_history: false",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.description_policy\.omitted_process_history must be true/,
  );
});

test("validate-planning-review rejects missing planning feedback disposition", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview.replace(
      / {2}planning_feedback_disposition:[\s\S]*? {2}blockers: \[\]/,
      "  blockers: []",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review\.planning_feedback_disposition\.status/,
  );
});

test("validate-planning-review rejects unresolved feedback without disposition rationale", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview
      .replace("        resolved: true", "        resolved: false")
      .replace(
        "        disposition: fixed_in_planning",
        "        disposition: blocked",
      ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /disposition blocked prevents implementation/);
});

test("validate-planning-review accepts unresolved feedback deferred to a task", () => {
  const result = runPlanReview(
    "validate-planning-review",
    planningReview
      .replace("        resolved: true", "        resolved: false")
      .replace(
        "        disposition: fixed_in_planning",
        '        disposition: deferred_to_task\n        implementation_task: "1.7"',
      ),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /planning_review valid/);
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
