import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-to-review-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanToReview(
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
        "skills/plan-to-review/scripts/plan-to-review.ts",
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
  reviewed_slices:
    - slice-01
  approved_slice: Implement the first reviewed slice.
  unresolved_blockers: []
  scrutiny_verdict: ship
`;

test("validate-request accepts plan-ready handoffs with reviewed slices", () => {
  const valid = runPlanToReview("validate-request", validHandoff);

  assert.equal(valid.status, 0);
  assert.match(valid.stdout, /plan_ready_handoff valid/);
});

test("validate-request requires reviewed slices in plan-ready handoffs", () => {
  const invalid = runPlanToReview(
    "validate-request",
    validHandoff.replace("  reviewed_slices:\n    - slice-01\n", ""),
  );

  assert.notEqual(invalid.status, 0);
  assert.match(
    invalid.stderr,
    /plan_ready_handoff reviewed_slices must include every upfront-reviewed slice id/,
  );
});
