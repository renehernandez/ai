import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

const validHandoff = `plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: docs/plans/example.md
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

test("validate-handoff requires refactoring-opportunities as a baseline reviewer", () => {
  const valid = runPlanReady("validate-handoff", validHandoff);

  assert.equal(valid.status, 0);

  const invalid = runPlanReady(
    "validate-handoff",
    validHandoff.replace("    - refactoring-opportunities\n", ""),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /required_reviewers must include refactoring-opportunities/,
  );
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
