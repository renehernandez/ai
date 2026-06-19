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
      - skills/plan-to-review
  delivery:
    expected_host: github_pr
  review:
    required_reviewers: []
    optional_reviewers: []
  blockers: []
`;

test("validate-request accepts plan review requests", () => {
  const result = runPlanToReview("validate-request", planReviewRequest);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_review_request valid/);
});

test("validate-request accepts delivery handoffs for planning review", () => {
  const result = runPlanToReview("validate-request", deliveryHandoff);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /plan_delivery_handoff valid/);
});

test("validate-request rejects legacy plan-ready handoffs", () => {
  const result = runPlanToReview(
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
  const result = runPlanToReview(
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
