import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const require = createRequire(import.meta.url);
const tsxLoader = require.resolve("tsx");
const planOrchestratorScript = join(
  repoRoot,
  "skills/plan-orchestrator/scripts/plan-orchestrator.ts",
);

function cleanGitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_PREFIX;
  return env;
}

function fixture(name: string): string {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/plan-orchestrator", name),
    "utf8",
  );
}

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

function runPlanOrchestratorInCwd(
  command: string,
  content: string,
  cwd: string,
): { status: number | null; stderr: string; stdout: string } {
  let result:
    | { status: number | null; stderr: string; stdout: string }
    | undefined;
  withTempFile(content, (path) => {
    result = runPlanOrchestratorArgs([command, "--file", path], cwd);
  });

  assert.ok(result);
  return result;
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

function runPlanOrchestratorArgs(
  args: string[],
  cwd = repoRoot,
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, planOrchestratorScript, ...args],
    {
      cwd,
      encoding: "utf8",
      env: cleanGitEnv(),
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function withTempOpenSpecRepo(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-orchestrator-repo-"));
  try {
    mkdirSync(join(directory, "openspec", "changes"), { recursive: true });
    cpSync(
      join(repoRoot, "openspec/config.yaml"),
      join(directory, "openspec/config.yaml"),
    );
    cpSync(
      join(repoRoot, "openspec/changes/enforce-openspec-source-plan-cleanup"),
      join(directory, "openspec/changes/enforce-openspec-source-plan-cleanup"),
      { recursive: true },
    );
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.test"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    runGit(directory, ["add", "openspec"]);
    runGit(directory, ["commit", "-m", "add openspec fixture"]);
    mkdirSync(join(directory, ".agents/plans"), { recursive: true });
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runGit(directory: string, args: string[]): string {
  const result = spawnSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: cleanGitEnv(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function cleanupArgs(
  sourcePlan: string,
  changeId = "enforce-openspec-source-plan-cleanup",
): string[] {
  return [
    "cleanup-source-plan",
    "--source-plan",
    sourcePlan,
    "--expected-source-plan",
    sourcePlan,
    "--expected-change-id",
    changeId,
    "--change-id",
    changeId,
  ];
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
  description_policy:
    status: passed
    owner: glab-mr-create
    artifact: https://git.fullscript.io/group/project/-/merge_requests/1
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
      - plan artifact reviewed
  review:
    evidence:
      - planning PR latest-head Nitro feedback completed cleanly
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
  phase_evidence:
    readiness:
      owner: plan-ready
      status: fresh
      artifact_fingerprint: feedface
      expected_artifact_fingerprint: feedface
      route_to:
    planning_commit:
      owner: plan-review
      status: fresh
      reviewed_head: def456
      expected_head_sha: def456
      route_to:
    delivery:
      owner: plan-unit-delivery
      status: fresh
      task_state_fingerprint: feedface
      expected_task_state_fingerprint: feedface
      route_to:
  unit_artifacts:
    - unit_id: "1"
      artifact: https://git.fullscript.io/group/project/-/merge_requests/2
  implementation_stack:
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      role: planning
      head_sha: def456
      nitro_gate_outcome: passed
      predecessor_artifact:
      delivery_unit_delta_validated: true
      cumulative_task_state_valid: true
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      delivery_unit_delta_validated: true
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
  unit_artifacts:
    - unit_id: "1"
      artifact: https://git.fullscript.io/group/project/-/merge_requests/2
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
  assert.match(result.stdout, /hosted_review_routing:/);
  assert.match(result.stdout, /copy each hosted-review reviewer/);
  assert.doesNotMatch(result.stdout, /- nitro\n\s+- developers/);
  assert.match(result.stdout, /readiness_reviewer_evidence:/);
  assert.match(result.stdout, /artifact_fingerprint:/);
  assert.match(result.stdout, /baseline_reviewers:/);
  assert.match(result.stdout, /selected_dynamic_reviewers:/);
  assert.match(result.stdout, /per_reviewer_status:/);
  assert.match(result.stdout, /copy each selected plan-ready dynamic reviewer/);
  assert.match(result.stdout, /copy every plan-ready per-reviewer status/);
  assert.match(result.stdout, /copy each plan-ready blocking finding/);
  assert.match(result.stdout, /blueprint_provenance:/);
  assert.match(result.stdout, /source: openspec_blueprint/);
  assert.match(result.stdout, /generated_change:/);
  assert.match(result.stdout, /cleanup_evidence:/);
});

test("plan-review-request-template copies reviewer evidence without embedding reviewer policy", () => {
  const result = runPlanOrchestratorCommand("plan-review-request-template");
  const source = readFileSync(planOrchestratorScript, "utf8");
  const ownerReviewerPolicyNames = [
    "implementation-readiness",
    "edge-cases-and-risks",
    "simplification-and-scope-control",
    "refactoring-opportunities",
    "security-and-auth",
    "data-migration-and-backfill",
    "ci-and-release-impact",
    "frontend-ux-accessibility",
    "infra-and-cloud",
    "docs-and-agent-alignment",
    "performance-and-scale",
    "ax-and-skill-compatibility",
    "implementation-review",
    "implementation-scrutiny",
    "code-quality-review",
    "code-simplifier",
    "deslop",
    "ai-readiness-upkeep",
    "docs-alignment-review",
    "security-review",
  ];

  assert.equal(result.status, 0);
  assert.match(result.stdout, /copy each plan-ready baseline reviewer/);
  assert.match(result.stdout, /copy each selected plan-ready dynamic reviewer/);
  assert.match(result.stdout, /copy every plan-ready per-reviewer status/);
  assert.doesNotMatch(
    source,
    /const (BASELINE_REVIEWERS|OPTIONAL_REVIEWERS|REVIEW_PASSES)/,
  );
  for (const reviewer of ownerReviewerPolicyNames) {
    assert.equal(source.includes(reviewer), false, reviewer);
  }
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
  assert.match(result.stdout, /phase_evidence:/);
  assert.match(result.stdout, /readiness:/);
  assert.match(result.stdout, /planning_commit:/);
  assert.match(result.stdout, /delivery:/);
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

test("cleanup-source-plan deletes untracked source plans after validation", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      cleanupArgs(".agents/plans/source.md"),
      directory,
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /source_plan_cleanup_complete/);
    assert.equal(existsSync(sourcePlan), false);
    assert.equal(runGit(directory, ["status", "--short"]), "");
  });
});

test("cleanup-source-plan removes staged source plans from index and disk", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");
    runGit(directory, ["add", ".agents/plans/source.md"]);

    const result = runPlanOrchestratorArgs(
      cleanupArgs(".agents/plans/source.md"),
      directory,
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /source_plan_cleanup_complete/);
    assert.equal(existsSync(sourcePlan), false);
    assert.equal(runGit(directory, ["status", "--short"]), "");
  });
});

test("cleanup-source-plan preserves source plans when OpenSpec validation fails", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      cleanupArgs(".agents/plans/source.md", "missing-change"),
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.equal(existsSync(sourcePlan), true);
  });
});

test("cleanup-source-plan blocks already committed source plans", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");
    runGit(directory, ["add", ".agents/plans/source.md"]);
    runGit(directory, ["commit", "-m", "commit source plan"]);

    const result = runPlanOrchestratorArgs(
      cleanupArgs(".agents/plans/source.md"),
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source_plan_committed/);
    assert.equal(existsSync(sourcePlan), true);
  });
});

test("cleanup-source-plan blocks source plans tracked in target base", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");
    runGit(directory, ["add", ".agents/plans/source.md"]);
    runGit(directory, ["commit", "-m", "target base has source plan"]);
    const targetBase = runGit(directory, ["rev-parse", "HEAD"]);
    runGit(directory, ["rm", ".agents/plans/source.md"]);
    runGit(directory, ["commit", "-m", "remove source plan from head"]);
    mkdirSync(join(directory, ".agents/plans"), { recursive: true });
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      [...cleanupArgs(".agents/plans/source.md"), "--target-base", targetBase],
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source_plan_committed/);
    assert.equal(existsSync(sourcePlan), true);
  });
});

test("cleanup-source-plan requires expected source plan context", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      [
        "cleanup-source-plan",
        "--source-plan",
        ".agents/plans/source.md",
        "--change-id",
        "enforce-openspec-source-plan-cleanup",
      ],
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--expected-source-plan is required/);
    assert.equal(existsSync(sourcePlan), true);
  });
});

test("cleanup-source-plan preserves unrelated same-worktree plans", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    const unrelatedPlan = join(directory, ".agents/plans/unrelated.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");
    writeFileSync(unrelatedPlan, "Other thread plan", "utf8");

    const result = runPlanOrchestratorArgs(
      [
        "cleanup-source-plan",
        "--source-plan",
        ".agents/plans/unrelated.md",
        "--expected-source-plan",
        ".agents/plans/source.md",
        "--expected-change-id",
        "enforce-openspec-source-plan-cleanup",
        "--change-id",
        "enforce-openspec-source-plan-cleanup",
      ],
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source_plan_context_mismatch/);
    assert.equal(existsSync(sourcePlan), true);
    assert.equal(existsSync(unrelatedPlan), true);
  });
});

test("cleanup-source-plan rejects wrong expected change id", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      [
        "cleanup-source-plan",
        "--source-plan",
        ".agents/plans/source.md",
        "--expected-source-plan",
        ".agents/plans/source.md",
        "--expected-change-id",
        "other-change",
        "--change-id",
        "enforce-openspec-source-plan-cleanup",
      ],
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /source_plan_context_mismatch/);
    assert.equal(existsSync(sourcePlan), true);
  });
});

test("cleanup-source-plan requires expected change id", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      [
        "cleanup-source-plan",
        "--source-plan",
        ".agents/plans/source.md",
        "--expected-source-plan",
        ".agents/plans/source.md",
        "--change-id",
        "enforce-openspec-source-plan-cleanup",
      ],
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--expected-change-id is required/);
    assert.equal(existsSync(sourcePlan), true);
  });
});

test("cleanup-source-plan accepts normalized equivalent expected paths", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      [
        "cleanup-source-plan",
        "--source-plan",
        "./.agents/plans/source.md",
        "--expected-source-plan",
        ".agents/plans/nested/../source.md",
        "--expected-change-id",
        "enforce-openspec-source-plan-cleanup",
        "--change-id",
        "enforce-openspec-source-plan-cleanup",
      ],
      directory,
    );

    assert.equal(result.status, 0);
    assert.equal(existsSync(sourcePlan), false);
  });
});

test("cleanup-source-plan rejects path escapes", () => {
  withTempOpenSpecRepo((directory) => {
    const sourcePlan = join(directory, ".agents/plans/source.md");
    writeFileSync(sourcePlan, "Plan intake", "utf8");

    const result = runPlanOrchestratorArgs(
      [
        "cleanup-source-plan",
        "--source-plan",
        ".agents/plans/source.md",
        "--expected-source-plan",
        ".agents/plans/../../outside.md",
        "--expected-change-id",
        "enforce-openspec-source-plan-cleanup",
        "--change-id",
        "enforce-openspec-source-plan-cleanup",
      ],
      directory,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--expected-source-plan_invalid/);
    assert.equal(existsSync(sourcePlan), true);
  });
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

test("validation commands do not write review-gate state", () => {
  withTempOpenSpecRepo((directory) => {
    const reviewGateState = join(directory, ".git", "ax", "review-gate.json");
    const validations = [
      ["validate-planning-review", planningReview],
      ["validate-resume", resumeReport],
      ["validate-stack-ready", stackReady],
    ] as const;

    for (const [command, input] of validations) {
      const result = runPlanOrchestratorInCwd(command, input, directory);

      assert.equal(result.status, 0, result.stderr || result.stdout);
      assert.equal(existsSync(reviewGateState), false);
    }
  });
});

test("validate-resume routes stale readiness evidence to plan-ready", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      artifact_fingerprint: feedface\n      expected_artifact_fingerprint: feedface",
      "      artifact_fingerprint: stale\n      expected_artifact_fingerprint: feedface",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /phase_evidence\.readiness is stale; route_to plan-ready/,
  );
});

test("validate-resume routes stale planning commit evidence to plan-review", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      reviewed_head: def456\n      expected_head_sha: def456",
      "      reviewed_head: stale\n      expected_head_sha: def456",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /phase_evidence\.planning_commit is stale; route_to plan-review/,
  );
});

test("validate-resume routes stale delivery evidence to plan-unit-delivery", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      task_state_fingerprint: feedface\n      expected_task_state_fingerprint: feedface",
      "      task_state_fingerprint: stale\n      expected_task_state_fingerprint: feedface",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /phase_evidence\.delivery is stale; route_to plan-unit-delivery/,
  );
});

test("validate-resume accepts blocked stale phase evidence with owning route", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport
      .replace("status: resume_ready", "status: delivery_blocked")
      .replace(
        "      status: fresh\n      artifact_fingerprint: feedface",
        "      status: stale\n      artifact_fingerprint: stale",
      )
      .replace(
        "      route_to:\n    planning_commit:",
        "      route_to: plan-ready\n    planning_commit:",
      )
      .replace("  blockers: []", "  blockers:\n    - rerun plan-ready"),
  );

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
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1\n      delivery_unit_delta_validated: true\n      cumulative_task_state_valid: true",
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1\n      delivery_unit_delta_validated: true\n      cumulative_task_state_valid: false",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /cumulative_task_state_valid must be true before resume_ready/,
  );
});

test("validate-resume blocks lifecycle or proof-only task shapes", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "- [ ] 1.2 Future deliverable",
      "- [ ] 1.2 Run validation checks",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /ask the user whether to redo the spec/);
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

test("validate-resume blocks implementation entries without delivery-unit-delta evidence", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1\n      delivery_unit_delta_validated: true",
      "      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /delivery_unit_delta_validated must be true for every implementation artifact before resume_ready/,
  );
});

test("validate-resume blocks later implementation entries without predecessor artifacts", () => {
  const twoImplementationResume = resumeReport.replace(
    `    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      delivery_unit_delta_validated: true
      cumulative_task_state_valid: true`,
    `    - artifact: https://git.fullscript.io/group/project/-/merge_requests/2
      role: implementation
      head_sha: abc789
      nitro_gate_outcome: passed
      predecessor_artifact: https://git.fullscript.io/group/project/-/merge_requests/1
      delivery_unit_delta_validated: true
      cumulative_task_state_valid: true
    - artifact: https://git.fullscript.io/group/project/-/merge_requests/3
      role: implementation
      head_sha: beef123
      nitro_gate_outcome: passed
      delivery_unit_delta_validated: true
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
      '    - unit_id: "1"\n      artifact: https://git.fullscript.io/group/project/-/merge_requests/2\n',
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /orchestrator_resume\.task_artifacts missing implementation artifact evidence for checked deliverable tasks 1\.1/,
  );
});

test("validate-resume blocks resume-ready without reviewed planning", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "planning_review_state: reviewed",
      "planning_review_state: blocked",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /planning_review_state must be reviewed when status is resume_ready/,
  );
});

test("validate-resume blocks resume-ready when restack is required", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace("restack_required: false", "restack_required: true"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /restack_required must be false before resume_ready/,
  );
});

test("validate-resume blocks resume-ready reports with blockers", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport.replace(
      "  blockers: []",
      "  blockers:\n    - waiting on predecessor MR",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /blockers must be empty before resume_ready/);
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

test("validate-resume accepts delivery-blocked reports with blockers", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    resumeReport
      .replace("status: resume_ready", "status: delivery_blocked")
      .replace(
        "  blockers: []",
        "  blockers:\n    - waiting on predecessor MR",
      ),
  );

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

test("validate-stack-ready blocks lifecycle or proof-only task shapes", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      "- [x] 1.2 Second deliverable",
      "- [x] 1.2 Run validation checks",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /ask the user whether to redo the spec/);
});

test("validate-stack-ready rejects checked tasks without artifact evidence", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    stackReady.replace(
      '    - unit_id: "1"\n      artifact: https://git.fullscript.io/group/project/-/merge_requests/2\n',
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /missing implementation artifact evidence for checked deliverable tasks 1\.1, 1\.2/,
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

test("fixture rejects partial stack-ready state", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    fixture("partial-stack-ready.yaml"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /partial stack: unchecked deliverable tasks 1\.2/,
  );
});

test("fixture rejects resume without predecessor artifacts", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    fixture("resume-missing-predecessor.yaml"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /predecessor_artifact evidence is required before resume_ready/,
  );
});

test("fixture rejects resume with stale predecessor gates", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    fixture("resume-stale-gate.yaml"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /nitro_gate_outcome must be passed before resume_ready/,
  );
});

test("fixture rejects resume with invalid cumulative task state", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    fixture("resume-invalid-cumulative-state.yaml"),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /cumulative_task_state_valid must be true before resume_ready/,
  );
});

test("fixture blocks unsupported host stack-ready state", () => {
  const result = runPlanOrchestrator(
    "validate-stack-ready",
    fixture("unsupported-host-stack-ready.yaml"),
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

test("fixture treats session handoff before stack-ready as delivery-blocked", () => {
  const result = runPlanOrchestrator(
    "validate-resume",
    fixture("session-handoff-blocked.yaml"),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /orchestrator_resume valid/);
});
