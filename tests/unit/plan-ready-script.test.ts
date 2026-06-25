import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function withTempPlan(
  callback: (context: { artifactRef: string; fingerprint: string }) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-artifact-"));
  const artifactRef = join(directory, "plan.md");
  const content = "# Example Plan\n\nOne atomic implementation unit.\n";
  try {
    writeFileSync(artifactRef, content, "utf8");
    callback({
      artifactRef,
      fingerprint: createHash("sha256").update(content).digest("hex"),
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanReady(
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
        "skills/plan-ready/scripts/plan-ready.ts",
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

function validHandoff(artifactRef: string, fingerprint: string): string {
  return `plan_delivery_handoff:
  status: ready
  route: atomic_plan
  artifact:
    type: plan
    ref: ${artifactRef}
    fingerprint: ${fingerprint}
  approved_unit:
    id: atomic
    title: Example atomic unit
    scope: Implement the one approved change.
    acceptance:
      - The requested behavior is observable.
    verification:
      - pnpm test
  constraints:
    files_or_areas:
      - skills/plan-ready
    out_of_scope: []
  delivery:
    expected_host: github_pr
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
  blockers: []
`;
}

function validBlueprint(): string {
  return `openspec_blueprint:
  status: ready_for_openspec
  source_plan:
    ref: .agents/plans/example.md
    change_id: add-plan-blueprints
  change:
    suggested_id: add-plan-blueprints
    title: Add PlanReady OpenSpec blueprints
    objective: Make complex PlanReady output reviewed OpenSpec-ready breakdowns.
  scope:
    in:
      - Complex plans produce a reviewed blueprint.
    out:
      - PlanReady writes OpenSpec files directly.
  specs:
    affected_or_new:
      - plan-readiness
    proposed_requirements:
      - PlanReady MUST emit an OpenSpec Blueprint for complex work that is ready for mechanical OpenSpec creation.
  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []
  recommended_first_task: "1.1"
  review:
    required_reviewers:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    optional_reviewers: []
    reviewers_used:
      - implementation-readiness
      - edge-cases-and-risks
      - simplification-and-scope-control
      - refactoring-opportunities
    findings:
      - The breakdown is ready to translate into OpenSpec files.
  risks:
    - OpenSpec authors may still need to choose exact requirement wording.
  blockers: []
  next_action: create_openspec_change
`;
}

test("validate-handoff accepts an atomic plan delivery handoff", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /plan_delivery_handoff valid/);
  });
});

test("validate-handoff rejects legacy slice handoff shapes", () => {
  const legacy = `slice_plan_review:
  status: pass

plan_ready_handoff:
  status: ready
  reviewed_slices:
    - slice-01
`;

  const result = runPlanReady("validate-handoff", legacy);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /slice_plan_review is legacy; rerun plan-ready/);
  assert.match(result.stderr, /plan_ready_handoff is legacy; rerun plan-ready/);
  assert.match(result.stderr, /reviewed_slices is legacy; rerun plan-ready/);
});

test("validate-handoff requires openspec completion updates for openspec tasks", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint)
      .replace("  route: atomic_plan\n", "  route: openspec_task\n")
      .replace("    type: plan\n", "    type: openspec\n")
      .replace("    id: atomic\n", '    id: "1.1"\n');

    const result = runPlanReady("validate-handoff", handoff);

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /openspec_task route requires delivery.completion_updates/,
    );
  });
});

test("validate-handoff rejects direct publish for orchestrated delivery", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const result = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        "    expected_host: github_pr",
        "    expected_host: direct_publish",
      ),
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /delivery.expected_host must be one of: github_pr, gitlab_mr/,
    );
  });
});

test("validate-handoff rejects stale artifact fingerprints", () => {
  withTempPlan(({ artifactRef }) => {
    const result = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, "bad"),
    );

    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /artifact.fingerprint must match current artifact.ref content/,
    );
  });
});

test("handoff-template emits the plan delivery contract", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-ready/scripts/plan-ready.ts",
      "handoff-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("plan_delivery_handoff:"),
  );
  assert.match(result.stdout, /plan_delivery_handoff:/);
  assert.match(result.stdout, /\.agents\/plans\/example\.md/);
  assert.doesNotMatch(result.stdout, /direct_publish/);
  assert.doesNotMatch(result.stdout, /reviewed_slices/);
  assert.doesNotMatch(result.stdout, /docs\/plans\/example\.md/);
});

test("reviewer-template routes workflow artifacts and lifecycle blockers", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-ready/scripts/plan-ready.ts",
      "reviewer-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /docs-and-agent-alignment/);
  assert.match(result.stdout, /local workflow artifact boundary/);
  assert.match(result.stdout, /ax-and-skill-compatibility/);
  assert.match(result.stdout, /adapter prompt/);
  assert.match(result.stdout, /lifecycle-only task groups/);
  assert.match(result.stdout, /proof-only tasks/);
  assert.match(result.stdout, /final documentation or validation phases/);
  assert.match(result.stdout, /checkbox-only delivery units/);
  assert.match(result.stdout, /blocking planning-readiness findings/);
  assert.match(result.stdout, /committed local readiness reports/);
  assert.match(result.stdout, /private workflow state/);
  assert.match(result.stdout, /baseline_reviewer_blocking_rubric/);
  assert.match(result.stdout, /implementation-readiness:/);
  assert.match(result.stdout, /edge-cases-and-risks:/);
  assert.match(result.stdout, /simplification-and-scope-control:/);
  assert.match(result.stdout, /refactoring-opportunities:/);
  assert.match(result.stdout, /do not downgrade them to suggestions/);
});

test("blueprint-template emits the OpenSpec blueprint contract", () => {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "tsx",
      "skills/plan-ready/scripts/plan-ready.ts",
      "blueprint-template",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("openspec_blueprint:"),
  );
  assert.match(result.stdout, /openspec_blueprint:/);
  assert.match(result.stdout, /status: ready_for_openspec/);
  assert.match(result.stdout, /deliverable: <PR\/MR-sized outcome>/);
  assert.match(result.stdout, /deliverable-scoped docs or proof work/);
  assert.match(result.stdout, /required_reviewers:/);
  assert.match(result.stdout, /optional_reviewers: \[\]/);
  assert.match(result.stdout, /reviewers_used:/);
  assert.match(result.stdout, /findings:/);
  assert.match(result.stdout, /next_action: create_openspec_change/);
  assert.doesNotMatch(result.stdout, /needs_openspec/);
});

test("validate-blueprint accepts a reviewed OpenSpec blueprint", () => {
  const result = runPlanReady("validate-blueprint", validBlueprint());

  assert.equal(result.status, 0);
  assert.match(result.stdout, /openspec_blueprint valid/);
});

test("validate-blueprint rejects lifecycle-only documentation tasks", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Documentation Updates
      deliverable: Capture documentation proof after implementation.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is lifecycle_phase_group/);
});

test("validate-blueprint rejects imperative lifecycle update tasks", () => {
  const documentationResult = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Update documentation
      deliverable: Update user docs after implementation.`,
    ),
  );
  const validationResult = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Update validation evidence
      deliverable: Update validation notes after implementation.`,
    ),
  );

  assert.notEqual(documentationResult.status, 0);
  assert.match(
    documentationResult.stderr,
    /tasks\.1\.1 is lifecycle_phase_group/,
  );
  assert.notEqual(validationResult.status, 0);
  assert.match(validationResult.stderr, /tasks\.1\.1 is lifecycle_phase_group/);
});

test("validate-blueprint rejects proof-only blueprint tasks", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Run tests and lint
      deliverable: Run tests and lint after implementation.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is proof_only_task/);
});

test("validate-blueprint rejects manual-looking proof collection tasks", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Validation Evidence
      deliverable: Manual validation evidence collection.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is lifecycle_phase_group/);
});

test("validate-blueprint rejects proof-only deliverables with feature-looking titles", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Validation Tooling
      deliverable: Capture CI proof after implementation.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /tasks\.1\.1 is proof_only_task/);
});

test("validate-blueprint rejects missing objective proof", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      '        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."\n',
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /objective proof must be explicit/);
});

test("validate-blueprint accepts one setup-only task before objective proof", () => {
  const blueprint = validBlueprint().replace(
    `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []`,
    `  tasks:
    - id: "1.1"
      title: Add blueprint schema support
      deliverable: Implement the schema fields needed by blueprint validation.
      acceptance:
        - Schema-backed blueprints can represent planned tasks.
      verification:
        - run pnpm test:unit
      dependencies: []
    - id: "1.2"
      title: Validate blueprints through the CLI
      deliverable: Connect the schema to the plan-ready validator.
      acceptance:
        - "First real confirmation: run the plan-ready validate-blueprint CLI entrypoint against a valid blueprint and observe openspec_blueprint valid output."
      verification:
        - pnpm test:unit
      dependencies: ["1.1"]`,
  );

  const result = runPlanReady("validate-blueprint", blueprint);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /openspec_blueprint valid/);
});

test("validate-blueprint rejects task 2 proof after a non-setup first task", () => {
  const blueprint = validBlueprint().replace(
    `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []`,
    `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []
    - id: "1.2"
      title: Validate blueprints through the CLI
      deliverable: Connect the schema to the plan-ready validator.
      acceptance:
        - "First real confirmation: run the plan-ready validate-blueprint CLI entrypoint against a valid blueprint and observe openspec_blueprint valid output."
      verification:
        - pnpm test:unit
      dependencies: ["1.1"]`,
  );

  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /objective proof is allowed only when task 1\.1 is setup-only/,
  );
});

test("validate-blueprint rejects objective proof delayed to task 3", () => {
  const blueprint = validBlueprint()
    .replace(
      `  tasks:
    - id: "1.1"
      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.
      acceptance:
        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Valid blueprints pass validation.
      verification:
        - pnpm test:unit
      dependencies: []`,
      `  tasks:
    - id: "1.1"
      title: Register target support
      deliverable: Add target registry entries and metadata.
      acceptance:
        - Target metadata is available to the validator.
      verification:
        - pnpm test:unit
      dependencies: []
    - id: "1.2"
      title: Generate target probes
      deliverable: Add generated probe metadata for the registered target.
      acceptance:
        - Probe metadata is generated for the target.
      verification:
        - pnpm test:unit
      dependencies: ["1.1"]
    - id: "1.3"
      title: Verify hw-admin target
      deliverable: Run target verification through the real workflow.
      acceptance:
        - "First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact."
      verification:
        - pnpm test:unit
      dependencies: ["1.2"]`,
    )
    .replace(
      '  recommended_first_task: "1.1"',
      '  recommended_first_task: "1.1"',
    );

  const result = runPlanReady("validate-blueprint", blueprint);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /objective proof first appears in task 1\.3/);
});

test("validate-blueprint rejects deferred and setup-only objective proof markers", () => {
  const deferred = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output",
      "defer proof to task 3 after setup is ready",
    ),
  );
  const setupOnly = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output",
      "record registry metadata and config readiness",
    ),
  );

  assert.notEqual(deferred.status, 0);
  assert.match(deferred.stderr, /objective proof marker defers proof/);
  assert.notEqual(setupOnly.status, 0);
  assert.match(setupOnly.stderr, /readiness rather than real capability proof/);
});

test("validate-blueprint does not let later verification rescue weak proof markers", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `"Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."`,
      `"Proof location: TBD."
      verification_note: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output.`,
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /real entrypoint and visible success or failure evidence/,
  );
});

test("validate-blueprint ignores later deferral notes after a valid proof marker", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."`,
      `        - "Proof location: run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output."
        - Future task 3 can add broader provider coverage.`,
    ),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /openspec_blueprint valid/);
});

test("validate-blueprint rejects setup-only proof markers with command output", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "run the plan-ready validate-blueprint CLI entrypoint and observe openspec_blueprint valid output",
      "run the registry CLI command and observe metadata output",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /readiness rather than real capability proof/);
});

test("validate-blueprint accepts docs and validation tooling as feature work", () => {
  const docsFeature = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Build documentation generator
      deliverable: Implement a documentation generator feature for release notes.`,
    ),
  );
  const validationFeature = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      `      title: Add blueprint validation
      deliverable: Implement complex-plan blueprint schema checks.`,
      `      title: Add runtime validation tooling
      deliverable: Implement runtime validation tooling for OpenSpec task-shape checks.`,
    ),
  );

  assert.equal(docsFeature.status, 0);
  assert.match(docsFeature.stdout, /openspec_blueprint valid/);
  assert.equal(validationFeature.status, 0);
  assert.match(validationFeature.stdout, /openspec_blueprint valid/);
});

test("validate-blueprint requires source plan ref", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "  source_plan:\n    ref: .agents/plans/example.md\n",
      "",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.ref/);
});

test("validate-blueprint requires source plan change id", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace("    change_id: add-plan-blueprints\n", ""),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.change_id/);
});

test("validate-blueprint requires source plan change id to match suggested id", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    change_id: add-plan-blueprints",
      "    change_id: other-change",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /source_plan.change_id must match change.suggested_id/,
  );
});

test("validate-blueprint requires source plan ref under agents plans", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    ref: .agents/plans/example.md",
      "    ref: docs/plans/example.md",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.ref must be under .agents\/plans/);
});

test("validate-blueprint rejects escaped source plan refs", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "    ref: .agents/plans/example.md",
      "    ref: .agents/plans/../../outside.md",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source_plan.ref must be under .agents\/plans/);
});

test("validate-blueprint requires the recommended first task to exist", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      '  recommended_first_task: "1.1"\n',
      '  recommended_first_task: "9.9"\n',
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /recommended_first_task must match an existing task id/,
  );
});

test("validate-blueprint rejects a recommended first task with dependencies", () => {
  const result = runPlanReady(
    "validate-blueprint",
    validBlueprint().replace(
      "      dependencies: []\n",
      '      dependencies: ["2.1"]\n',
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /recommended_first_task must not have dependencies/,
  );
  assert.match(
    result.stderr,
    /tasks.1.1.dependencies includes unknown task 2.1/,
  );
});
