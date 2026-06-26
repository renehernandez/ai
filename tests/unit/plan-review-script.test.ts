import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key === "GIT_DIR" || key.startsWith("GIT_")) {
      delete env[key];
    }
  }
  env.AX_PLAN_REVIEW_ALLOW_OPENSPEC_COMMAND_OVERRIDE = "1";
  return env;
}

function runPlanReview(
  command: string,
  content: string,
  extraArgs: string[] = [],
  env: NodeJS.ProcessEnv = withoutGitRepositoryEnv(),
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
        ...extraArgs,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env,
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
      env: withoutGitRepositoryEnv(),
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
      env: withoutGitRepositoryEnv(),
      input,
    },
  );

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function runGit(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: withoutGitRepositoryEnv(),
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

const reviewGateDiffHash =
  "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const planReviewRequest = `plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - nitro
    - developers
  readiness_reviewer_evidence:
    artifact_fingerprint: source-plan-fingerprint
    completed_at: 2026-06-23T18:00:00.000Z
    gate_outcome: passed
    baseline_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    selected_dynamic_reviewers:
      - docs-and-agent-alignment
    per_reviewer_status:
      implementation-readiness: passed
      edge-cases-and-risks: passed
      simplification-and-scope-control: passed
      refactoring-opportunities: passed
      docs-and-agent-alignment: passed
    skipped_reviewers: []
    skipped_rationale: []
    blocking_findings: []
  blueprint_provenance:
    source: openspec_blueprint
    source_plan:
      ref: .agents/plans/example-change.md
      change_id: example-change
      artifact_fingerprint: source-plan-fingerprint
    generated_change:
      change_id: example-change
      ref: openspec/changes/example-change
      generated_paths:
        - openspec/changes/example-change/proposal.md
        - openspec/changes/example-change/tasks.md
    validation_evidence:
      - openspec validate example-change --strict --no-interactive
      - pnpm ax openspec validate
    cleanup_evidence:
      - scripts/plan-orchestrator.ts cleanup-source-plan --source-plan .agents/plans/example-change.md --expected-source-plan .agents/plans/example-change.md --expected-change-id example-change --change-id example-change
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

test("validate-request requires readiness reviewer evidence", () => {
  const result = runPlanReview(
    "validate-request",
    planReviewRequest.replace(
      / {2}readiness_reviewer_evidence:[\s\S]*? {2}unresolved_blockers: \[\]/,
      "  unresolved_blockers: []",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /readiness_reviewer_evidence is required/);
});

test("validate-request requires selected dynamic reviewer status", () => {
  const result = runPlanReview(
    "validate-request",
    planReviewRequest.replace("      docs-and-agent-alignment: passed\n", ""),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /readiness_reviewer_evidence\.per_reviewer_status must include docs-and-agent-alignment/,
  );
});

test("validate-request rejects blocking readiness findings", () => {
  const result = runPlanReview(
    "validate-request",
    planReviewRequest.replace(
      "    blocking_findings: []",
      "    blocking_findings:\n      - readiness reviewer found a blocker",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /readiness_reviewer_evidence\.blocking_findings must be empty/,
  );
});

test("review-gate-input binds readiness evidence to staged planning diff", () => {
  const result = runPlanReview("review-gate-input", planReviewRequest, [
    "--diff-hash",
    reviewGateDiffHash,
    "--source-ref",
    "request.yaml",
  ]);
  const output = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(output.workflow, "plan-review");
  assert.equal(output.unit.id, "openspec/changes/example-change");
  assert.equal(output.sourceProvenance.kind, "plan_review_request");
  assert.equal(output.sourceProvenance.ref, "openspec/changes/example-change");
  assert.equal(output.sourceProvenance.phase, "plan-review");
  assert.deepEqual(output.sourceProvenance.evidence, ["request.yaml"]);
  assert.deepEqual(output.requiredReviewPasses, [
    "implementation-readiness",
    "edge-cases-and-risks",
    "simplification-and-scope-control",
    "refactoring-opportunities",
    "docs-and-agent-alignment",
  ]);
  assert.equal(
    output.results["docs-and-agent-alignment"].diffHash,
    reviewGateDiffHash,
  );
  assert.equal(output.results["docs-and-agent-alignment"].status, "passed");
  assert.equal(
    output.results["docs-and-agent-alignment"].completedAt,
    "2026-06-23T18:00:00.000Z",
  );
  assert.deepEqual(output.blockingFindings, []);
});

test("review-gate-input requires a diff hash value", () => {
  const result = runPlanReview("review-gate-input", planReviewRequest, [
    "--diff-hash",
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review-gate-input requires --diff-hash/);
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects missing readiness artifact fingerprints", () => {
  const result = runPlanReview(
    "review-gate-input",
    planReviewRequest.replace(
      "    artifact_fingerprint: source-plan-fingerprint\n",
      "",
    ),
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /readiness_reviewer_evidence\.artifact_fingerprint/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects readiness evidence outside the request", () => {
  const detachedEvidenceRequest = `${planReviewRequest.replace(
    / {2}readiness_reviewer_evidence:[\s\S]*?(?= {2}blueprint_provenance:)/,
    "",
  )}external_wrapper:
  readiness_reviewer_evidence:
    artifact_fingerprint: source-plan-fingerprint
    completed_at: 2026-06-23T18:00:00.000Z
    gate_outcome: passed
    baseline_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    selected_dynamic_reviewers:
      - docs-and-agent-alignment
    per_reviewer_status:
      implementation-readiness: passed
      edge-cases-and-risks: passed
      simplification-and-scope-control: passed
      refactoring-opportunities: passed
      docs-and-agent-alignment: passed
    skipped_reviewers: []
    skipped_rationale: []
    blocking_findings: []
`;

  const result = runPlanReview("review-gate-input", detachedEvidenceRequest, [
    "--diff-hash",
    reviewGateDiffHash,
  ]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /readiness_reviewer_evidence is required/);
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects malformed readiness timestamps", () => {
  const result = runPlanReview(
    "review-gate-input",
    planReviewRequest.replace(
      "    completed_at: 2026-06-23T18:00:00.000Z",
      "    completed_at: yesterday",
    ),
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /readiness_reviewer_evidence\.completed_at must be an ISO-8601 UTC timestamp/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects blocking readiness reviewer statuses", () => {
  const result = runPlanReview(
    "review-gate-input",
    planReviewRequest.replace(
      "      edge-cases-and-risks: passed",
      "      edge-cases-and-risks: blocked",
    ),
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /readiness_reviewer_evidence\.per_reviewer_status\.edge-cases-and-risks must be passed/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input rejects readiness blocking findings", () => {
  const result = runPlanReview(
    "review-gate-input",
    planReviewRequest.replace(
      "    blocking_findings: []",
      "    blocking_findings:\n      - reviewer found a blocker",
    ),
    ["--diff-hash", reviewGateDiffHash],
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /readiness_reviewer_evidence\.blocking_findings must be empty/,
  );
  assert.equal(result.stdout, "");
});

test("review-gate-input emits planning gate input without writing state", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-gate-input-"));
  try {
    runGit(directory, ["init"]);
    const result = runPlanReview("review-gate-input", planReviewRequest, [
      "--cwd",
      directory,
      "--diff-hash",
      reviewGateDiffHash,
    ]);
    const output = JSON.parse(result.stdout);

    assert.equal(result.status, 0);
    assert.equal(output.workflow, "plan-review");
    assert.equal(output.sourceProvenance.phase, "plan-review");
    assert.equal(
      output.results["implementation-readiness"].diffHash,
      reviewGateDiffHash,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.invalidated.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning activates review gate and invokes required-gate ax commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const argsPath = join(directory, "ax-args.txt");
    const fakeAxPath = join(directory, "fake-ax");
    writeFileSync(
      fakeAxPath,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\n`,
      "utf8",
    );
    chmodSync(fakeAxPath, 0o755);

    const openspecArgsPath = join(directory, "openspec-args.txt");
    const fakeOpenSpecPath = join(directory, "fake-openspec");
    writeFileSync(
      fakeOpenSpecPath,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${openspecArgsPath}"\n`,
      "utf8",
    );
    chmodSync(fakeOpenSpecPath, 0o755);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      fakeAxPath,
      "--openspec-command",
      fakeOpenSpecPath,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /planning_commit_committed/);
    assert.deepEqual(
      readFileSync(openspecArgsPath, "utf8").trim().split("\n"),
      ["validate", "example-change", "--strict", "--no-interactive"],
    );
    assert.deepEqual(readFileSync(argsPath, "utf8").trim().split("\n"), [
      "commit",
      "--require-review-gate",
      "-m",
      "Commit planning",
    ]);

    const state = JSON.parse(
      readFileSync(join(directory, ".git", "ax", "review-gate.json"), "utf8"),
    );
    assert.equal(state.workflow, "plan-review");
    assert.equal(state.status, "active");
    assert.deepEqual(state.requiredReviewPasses, [
      "implementation-readiness",
      "edge-cases-and-risks",
      "simplification-and-scope-control",
      "refactoring-opportunities",
      "docs-and-agent-alignment",
    ]);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks OpenSpec gate activation when strict validation fails", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const fakeOpenSpecPath = join(directory, "fake-openspec");
    writeFileSync(
      fakeOpenSpecPath,
      "#!/bin/sh\nprintf '%s\\n' 'invalid openspec' >&2\nexit 1\n",
      "utf8",
    );
    chmodSync(fakeOpenSpecPath, 0o755);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
      "--openspec-command",
      fakeOpenSpecPath,
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /openspec_strict_validation_failed/);
    assert.match(
      result.stderr,
      /openspec validate example-change --strict --no-interactive/,
    );
    assert.match(result.stderr, /invalid openspec/);
    assert.equal(
      result.stderr.includes("ENOENT") || result.stderr.includes("not found"),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning reports missing OpenSpec executable before gate activation", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
      "--openspec-command",
      join(directory, "missing-openspec"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /openspec_strict_validation_failed/);
    assert.match(result.stderr, /spawn/);
    assert.match(result.stderr, /pnpm ax openspec status/);
    assert.match(result.stderr, /pnpm ax openspec validate/);
    assert.equal(
      result.stderr.includes("TypeError") ||
        result.stderr.includes("Cannot read properties"),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning forbids OpenSpec command overrides outside tests", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const env = withoutGitRepositoryEnv();
    delete env.AX_PLAN_REVIEW_ALLOW_OPENSPEC_COMMAND_OVERRIDE;
    const result = runPlanReview(
      "commit-planning",
      planReviewRequest,
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
        "--openspec-command",
        "/usr/bin/true",
      ],
      env,
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /openspec_command_override_forbidden/);
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning skips OpenSpec provenance checks for non-OpenSpec artifacts", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, ".agents", "plans"), { recursive: true });
    writeFileSync(
      join(directory, ".agents", "plans", "example-change.md"),
      "planning\n",
      "utf8",
    );
    runGit(directory, ["add", ".agents/plans/example-change.md"]);

    const argsPath = join(directory, "ax-args.txt");
    const fakeAxPath = join(directory, "fake-ax");
    writeFileSync(
      fakeAxPath,
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${argsPath}"\n`,
      "utf8",
    );
    chmodSync(fakeAxPath, 0o755);

    const planArtifactRequest = planReviewRequest
      .replace("artifact_type: openspec", "artifact_type: plan")
      .replace(
        "artifact_ref: openspec/changes/example-change",
        "artifact_ref: .agents/plans/example-change.md",
      )
      .replace(
        / {2}blueprint_provenance:[\s\S]*? {2}unresolved_blockers: \[\]/,
        "  unresolved_blockers: []",
      );
    const result = runPlanReview("commit-planning", planArtifactRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      fakeAxPath,
    ]);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /planning_commit_committed/);
    assert.deepEqual(readFileSync(argsPath, "utf8").trim().split("\n"), [
      "commit",
      "--require-review-gate",
      "-m",
      "Commit planning",
    ]);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks OpenSpec gate activation when blueprint provenance is missing", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        / {2}blueprint_provenance:[\s\S]*? {2}unresolved_blockers: \[\]/,
        "  unresolved_blockers: []",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /openspec_blueprint_provenance_blocked/);
    assert.match(
      result.stderr,
      /rerun readiness reviewers on the materialized OpenSpec diff/,
    );
    assert.equal(
      result.stderr.includes("ENOENT") || result.stderr.includes("not found"),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning requires blueprint provenance as a direct request child", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const nestedRequest = planReviewRequest.replace(
      / {2}blueprint_provenance:[\s\S]*? {2}unresolved_blockers: \[\]/,
      (match) =>
        `${match
          .replace("  unresolved_blockers: []", "")
          .split("\n")
          .map((line) => (line ? `  ${line}` : line))
          .join("\n")}\n  unresolved_blockers: []`,
    );
    const result = runPlanReview("commit-planning", nestedRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /blueprint_provenance is required for OpenSpec planning commits/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects non-blueprint materialized OpenSpec provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        "    source: openspec_blueprint",
        "    source: copied_open_spec",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /blueprint_provenance\.source must be openspec_blueprint/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects mismatched materialized OpenSpec change identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        "      change_id: example-change\n      ref: openspec/changes/example-change",
        "      change_id: other-change\n      ref: openspec/changes/other-change",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /blueprint_provenance\.generated_change\.ref must match artifact_ref/,
    );
    assert.match(
      result.stderr,
      /blueprint_provenance source_plan\.change_id, generated_change\.change_id, and artifact_ref change id must match/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning requires generated OpenSpec paths in blueprint provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        / {6}generated_paths:\n {8}- openspec\/changes\/example-change\/proposal\.md\n {8}- openspec\/changes\/example-change\/tasks\.md/,
        "      generated_paths: []",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /blueprint_provenance\.generated_change\.generated_paths is required/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning requires strict OpenSpec validation evidence", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        "      - openspec validate example-change --strict --no-interactive\n",
        "",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /blueprint_provenance\.validation_evidence must include openspec validate example-change --strict --no-interactive/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks generated paths with unstaged working-tree changes", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "initial planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Initial\n",
      "utf8",
    );
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "-m", "initial"]);
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "staged planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Unstaged change\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec/changes/example-change/proposal.md"]);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /OpenSpec artifact has unstaged or untracked changes outside the staged diff/,
    );
    assert.match(result.stderr, /openspec\/changes\/example-change\/tasks.md/);
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks staged source plan paths for OpenSpec commits", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, ".agents", "plans"), { recursive: true });
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, ".agents", "plans", "example-change.md"),
      "source plan\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", ".agents", "openspec"]);

    const sourceFingerprint = createHash("sha256")
      .update("source plan\n")
      .digest("hex");
    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replaceAll(
        "source-plan-fingerprint",
        sourceFingerprint,
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /must not stage \.agents\/plans paths/);
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks undeclared dirty files under the OpenSpec artifact", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "initial planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "-m", "initial"]);
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "staged planning\n",
      "utf8",
    );
    mkdirSync(
      join(directory, "openspec", "changes", "example-change", "specs", "new"),
      { recursive: true },
    );
    writeFileSync(
      join(
        directory,
        "openspec",
        "changes",
        "example-change",
        "specs",
        "new",
        "spec.md",
      ),
      "unstaged spec\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec/changes/example-change/proposal.md"]);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /OpenSpec artifact has unstaged or untracked changes outside the staged diff/,
    );
    assert.match(result.stderr, /openspec\/changes\/example-change\/specs\//);
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks invalid OpenSpec source plan refs before ax commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        "      ref: .agents/plans/example-change.md",
        "      ref: .agents/plans/../example-change.md",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /source_plan\.ref must point to a concrete \.agents\/plans file/,
    );
    assert.equal(
      result.stderr.includes("ENOENT") || result.stderr.includes("not found"),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects source plan symlink provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, ".agents", "plans"), { recursive: true });
    mkdirSync(join(directory, "outside"), { recursive: true });
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(join(directory, "outside", "source.md"), "source\n", "utf8");
    symlinkSync(
      join(directory, "outside", "source.md"),
      join(directory, ".agents", "plans", "example-change.md"),
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const sourceFingerprint = createHash("sha256")
      .update("source\n")
      .digest("hex");
    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replaceAll(
        "source-plan-fingerprint",
        sourceFingerprint,
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /source_plan\.ref must resolve inside \.agents\/plans/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects source plans through symlinked plan roots", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  const outsideRoot = mkdtempSync(join(tmpdir(), "plan-review-outside-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, ".agents"), { recursive: true });
    mkdirSync(join(outsideRoot, "plans"), { recursive: true });
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(outsideRoot, "plans", "example-change.md"),
      "source\n",
      "utf8",
    );
    symlinkSync(
      join(outsideRoot, "plans"),
      join(directory, ".agents", "plans"),
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const sourceFingerprint = createHash("sha256")
      .update("source\n")
      .digest("hex");
    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replaceAll(
        "source-plan-fingerprint",
        sourceFingerprint,
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /source_plan\.ref must resolve inside \.agents\/plans/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
    rmSync(outsideRoot, { force: true, recursive: true });
  }
});

test("commit-planning requires source plan change id from source_plan provenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace("      change_id: example-change\n", ""),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /blueprint_provenance\.source_plan\.change_id is required/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects cleanup evidence prefix spoofing", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest
        .replace(
          "--expected-source-plan .agents/plans/example-change.md",
          "--expected-source-plan .agents/plans/example-change.md.bak",
        )
        .replace(
          "--expected-change-id example-change",
          "--expected-change-id example-change-old",
        )
        .replace(
          "--change-id example-change",
          "--change-id example-change-old",
        ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /cleanup_evidence must prove source_plan\.ref cleanup/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects spoofed cleanup command names", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        "scripts/plan-orchestrator.ts cleanup-source-plan",
        "fake-cleanup-source-plan",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /cleanup_evidence must prove source_plan\.ref cleanup/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects cleanup evidence with extra arguments", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        " --change-id example-change",
        " --change-id example-change --skip-repo-openspec-validation",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /cleanup_evidence must prove source_plan\.ref cleanup/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning requires cleanup evidence to include actual change id", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(" --change-id example-change", ""),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /cleanup_evidence must prove source_plan\.ref cleanup/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks source plans changed after readiness review", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, ".agents", "plans"), { recursive: true });
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    const originalSourcePlan = "original source plan\n";
    const originalFingerprint = createHash("sha256")
      .update(originalSourcePlan)
      .digest("hex");
    writeFileSync(
      join(directory, ".agents", "plans", "example-change.md"),
      "changed source plan\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replaceAll(
        "source-plan-fingerprint",
        originalFingerprint,
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /source_plan\.artifact_fingerprint must match source_plan\.ref content/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning ignores copied-from OpenSpec paths when proving staged artifact changes", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "-m", "initial"]);
    writeFileSync(
      join(directory, "copied-proposal.md"),
      readFileSync(
        join(directory, "openspec", "changes", "example-change", "proposal.md"),
        "utf8",
      ),
      "utf8",
    );
    runGit(directory, ["add", "copied-proposal.md"]);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /staged OpenSpec diff must include at least one path under artifact_ref/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks spoofed OpenSpec artifact roots", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "docs", "example-change"), { recursive: true });
    writeFileSync(
      join(directory, "docs", "example-change", "proposal.md"),
      "not openspec\n",
      "utf8",
    );
    runGit(directory, ["add", "docs"]);

    const spoofedRequest = planReviewRequest
      .replace(
        "  artifact_ref: openspec/changes/example-change",
        "  artifact_ref: docs/example-change",
      )
      .replace(
        "      ref: openspec/changes/example-change",
        "      ref: docs/example-change",
      )
      .replaceAll(
        "openspec/changes/example-change/proposal.md",
        "docs/example-change/proposal.md",
      )
      .replaceAll(
        "openspec/changes/example-change/tasks.md",
        "docs/example-change/tasks.md",
      );

    const result = runPlanReview("commit-planning", spoofedRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /generated_change\.ref and artifact_ref must be openspec\/changes\/example-change/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects option-shaped OpenSpec change ids", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "--help"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "--help", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "--help", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const optionRequest = planReviewRequest
      .replaceAll("example-change", "--help")
      .replaceAll(".agents/plans/--help.md", ".agents/plans/example.md");
    const result = runPlanReview("commit-planning", optionRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /change_id must be a lowercase OpenSpec change id slug/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning rejects malformed OpenSpec kebab-case change ids", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example--change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example--change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example--change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const malformedRequest = planReviewRequest.replaceAll(
      "example-change",
      "example--change",
    );
    const result = runPlanReview("commit-planning", malformedRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /change_id must be a lowercase OpenSpec change id slug/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks renames out of declared OpenSpec artifact paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "-m", "initial"]);
    runGit(directory, [
      "mv",
      "openspec/changes/example-change/proposal.md",
      "proposal.md",
    ]);
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Updated\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec/changes/example-change/tasks.md"]);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /staged OpenSpec path is not declared in blueprint_provenance\.generated_change\.generated_paths: proposal\.md/,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks stale OpenSpec blueprint provenance before ax commit", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    runGit(directory, ["add", "README.md"]);
    runGit(directory, ["commit", "-m", "initial"]);
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "openspec"]);

    const result = runPlanReview(
      "commit-planning",
      planReviewRequest.replace(
        "      artifact_fingerprint: source-plan-fingerprint",
        "      artifact_fingerprint: stale-source-plan-fingerprint",
      ),
      [
        "--cwd",
        directory,
        "--message",
        "Commit planning",
        "--ax-command",
        join(directory, "missing-fake-ax"),
      ],
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /source_plan\.artifact_fingerprint must match readiness_reviewer_evidence\.artifact_fingerprint/,
    );
    assert.equal(
      result.stderr.includes("ENOENT") || result.stderr.includes("not found"),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning blocks OpenSpec provenance when staged diff misses artifact paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "plan-review-commit-"));
  try {
    runGit(directory, ["init"]);
    runGit(directory, ["config", "user.email", "test@example.com"]);
    runGit(directory, ["config", "user.name", "Test User"]);
    writeFileSync(join(directory, "README.md"), "hello\n", "utf8");
    mkdirSync(join(directory, "openspec", "changes", "example-change"), {
      recursive: true,
    });
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "proposal.md"),
      "planning\n",
      "utf8",
    );
    writeFileSync(
      join(directory, "openspec", "changes", "example-change", "tasks.md"),
      "- [ ] 1. Implement\n",
      "utf8",
    );
    runGit(directory, ["add", "."]);
    runGit(directory, ["commit", "-m", "initial"]);
    writeFileSync(join(directory, "unrelated.md"), "not planning\n", "utf8");
    runGit(directory, ["add", "unrelated.md"]);

    const result = runPlanReview("commit-planning", planReviewRequest, [
      "--cwd",
      directory,
      "--message",
      "Commit planning",
      "--ax-command",
      join(directory, "missing-fake-ax"),
    ]);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /staged OpenSpec diff must include at least one path under artifact_ref/,
    );
    assert.equal(
      result.stderr.includes("ENOENT") || result.stderr.includes("not found"),
      false,
    );
    assert.equal(
      existsSync(join(directory, ".git", "ax", "review-gate.json")),
      false,
    );
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});

test("commit-planning requires a message", () => {
  const result = runPlanReview("commit-planning", planReviewRequest);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /commit-planning requires --message/);
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
  assert.match(result.stdout, /readiness_reviewer_evidence:/);
  assert.match(result.stdout, /blueprint_provenance:/);
  assert.match(
    result.stdout,
    /openspec validate example-change --strict --no-interactive/,
  );
  assert.match(result.stdout, /copy every plan-ready per-reviewer status/);
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
      - Justification: reviewability improves because the task gate is a narrow planning-validation surface.
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
      - Justification: reviewability improves because the task gate is a narrow planning-validation surface.
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
