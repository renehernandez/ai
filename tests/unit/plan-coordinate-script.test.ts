import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-coordinate-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanCoordinate(
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
        "skills/plan-coordinate/scripts/plan-coordinate.ts",
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

function runSelectNextTask(content: string): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTempFile(content, (path) => {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/plan-coordinate/scripts/plan-coordinate.ts",
        "select-next-task",
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

const validHandoff = `plan_coordinate_handoff:
  status: ready
  route: openspec_task
  artifact:
    type: openspec
    ref: openspec/changes/example-change
    fingerprint: abc123
  approved_unit:
    id: "1.1"
    title: Add the coordinator
    scope: Implement one OpenSpec checkbox task.
    acceptance:
      - The coordinator validates the handoff.
    verification:
      - pnpm test:unit
  constraints:
    files_or_areas:
      - skills/plan-coordinate
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

test("validate-handoff accepts a ready OpenSpec task handoff", () => {
  const result = runPlanCoordinate("validate-handoff", validHandoff);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_coordinate_handoff valid/);
});

test("validate-handoff rejects legacy followthrough ledgers", () => {
  const result = runPlanCoordinate(
    "validate-handoff",
    `plan_followthrough_ledger:
  status: active
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /plan_followthrough_ledger is legacy; rerun plan-ready/,
  );
});

test("select-next-task returns the first unchecked deliverable", () => {
  const result = runSelectNextTask(`# Tasks

## 1. Delivery

- [x] 1.1 Complete the first task
- [ ] 1.2 Implement the second task
- [ ] 1.3 Manual production verification
`);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "ready");
  assert.equal(parsed.next_task.id, "1.2");
});

test("select-next-task reports complete when only manual tasks remain", () => {
  const result = runSelectNextTask(`# Tasks

## 1. Delivery

- [x] 1.1 Complete the first task
- [ ] 1.2 Manual production verification
`);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "complete");
  assert.equal(parsed.next_task, null);
});
