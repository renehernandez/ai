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
  review_artifact: https://example.test/review/1
  mode: ship_then_continue
  gate_outcome: approved
  target_branch: main
  target_base_sha: abc123
  planning_branch: plan/example
  reviewed_head: def456
  stack_base_ref:
  stack_base_evidence:
  task_state_fingerprint: feedface
  validation:
    evidence:
      - plan artifact reviewed
  review:
    evidence:
      - planning PR merged after feedback was addressed
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
