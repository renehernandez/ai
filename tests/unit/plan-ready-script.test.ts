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

function withTempPlan(
  callback: (context: { artifactRef: string; fingerprint: string }) => void,
): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-ready-artifact-"));
  const artifactRef = join(directory, "plan.md");
  const content = "# Example Plan\n\n## Implementation Slices\n\n- Slice 1.\n";
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

function validHandoff(artifactRef: string, fingerprint: string): string {
  return `slice_plan_review:
  status: pass
  artifact_ref: ${artifactRef}
  artifact_fingerprint: ${fingerprint}
  mode: audit
  slices:
    - id: slice-01
      title: Example slice
      observable_outcome: pass
      bounded_scope: pass
      sequencing: pass
      verification: pass
      refactoring_reuse: pass
      delivery_fit: pass
  blocking_findings: []
  warnings: []

plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: ${artifactRef}
  approved_slice: Implement the first reviewed slice.
  required_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
    - refactoring-opportunities
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
`;
}

test("validate-handoff requires refactoring-opportunities as a baseline reviewer", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const handoff = validHandoff(artifactRef, fingerprint);
    const valid = runPlanReady("validate-handoff", handoff);

    assert.equal(valid.status, 0);

    const invalid = runPlanReady(
      "validate-handoff",
      handoff.replace("    - refactoring-opportunities\n", ""),
    );

    assert.notEqual(invalid.status, 0);
    assert.match(
      invalid.stderr,
      /required_reviewers must include refactoring-opportunities/,
    );
  });
});

test("validate-handoff requires a passing slice_plan_review", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const missing = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        /slice_plan_review:[\s\S]*?\n\nplan_ready_handoff:/,
        "plan_ready_handoff:",
      ),
    );

    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /slice_plan_review\.status is required/);

    const blocked = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        "  status: pass",
        "  status: blocked",
      ),
    );

    assert.notEqual(blocked.status, 0);
    assert.match(
      blocked.stderr,
      /slice_plan_review\.status must be pass before status ready/,
    );
  });
});

test("validate-handoff rejects stale or mismatched slice reviews", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const stale = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, "0".repeat(64)),
    );

    assert.notEqual(stale.status, 0);
    assert.match(
      stale.stderr,
      /slice_plan_review\.artifact_fingerprint must match current artifact_ref content/,
    );

    const mismatchedArtifact = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        `  artifact_ref: ${artifactRef}\n  artifact_fingerprint`,
        `  artifact_ref: ${join(artifactRef, "other.md")}\n  artifact_fingerprint`,
      ),
    );

    assert.notEqual(mismatchedArtifact.status, 0);
    assert.match(
      mismatchedArtifact.stderr,
      /slice_plan_review\.artifact_ref must match artifact_ref/,
    );
  });
});

test("validate-handoff rejects fresh but incomplete slice reviews", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const incomplete = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        / {2}mode: audit[\s\S]*? {2}blocking_findings: \[\]/,
        "  blocking_findings: []",
      ),
    );

    assert.notEqual(incomplete.status, 0);
    assert.match(incomplete.stderr, /slice_plan_review\.mode is required/);
    assert.match(
      incomplete.stderr,
      /slice_plan_review\.slices must include at least one slice/,
    );
  });
});

test("validate-handoff currently requires local plan file artifacts", () => {
  withTempPlan(({ artifactRef, fingerprint }) => {
    const linear = runPlanReady(
      "validate-handoff",
      validHandoff(artifactRef, fingerprint).replace(
        "  artifact_type: plan",
        "  artifact_type: linear",
      ),
    );

    assert.notEqual(linear.status, 0);
    assert.match(
      linear.stderr,
      /slice_plan_review currently supports local plan file artifacts only/,
    );
  });
});

test("validate-selection requires refactoring-opportunities in baseline reviewers", () => {
  const validSelection = `reviewer_selection_judge:
  verdict: baseline_sufficient
  baseline_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
    - refactoring-opportunities
  selected_optional_reviewers: []
  rationale:
    default: baseline reviewers cover this plan
`;

  const valid = runPlanReady("validate-selection", validSelection);

  assert.equal(valid.status, 0);

  const invalid = runPlanReady(
    "validate-selection",
    validSelection.replace("    - refactoring-opportunities\n", ""),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /baseline_reviewers must include refactoring-opportunities/,
  );
});

test("reviewer-template includes significant refactor scope gate", () => {
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
  assert.match(result.stdout, /refactor_scope_gate:/);
  assert.match(result.stdout, /significant_refactor_suggestions:/);
  assert.match(result.stdout, /blocks_plan_ready/);
});

test("handoff-template includes mandatory slice plan review", () => {
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
  assert.match(result.stdout, /slice_plan_review:/);
  assert.match(result.stdout, /artifact_fingerprint:/);
  assert.match(result.stdout, /plan_ready_handoff:/);
});
