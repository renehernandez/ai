import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-to-pr-script-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runPlanToPr(command: string, content: string): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTempFile(content, (path) => {
    result = spawnSync("pnpm", [
      "exec",
      "tsx",
      "skills/plan-to-pr/scripts/plan-to-pr.ts",
      command,
      "--file",
      path,
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
  });

  assert.ok(result);
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

const launchedReport = `reviewer_subagent_launch:
  status: launched
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  subagent_ids:
    - implementation-review-agent: 019-a
    - implementation-scrutiny-agent: 019-b
    - code-quality-review-agent: 019-c
    - code-simplifier-agent: 019-d
    - deslop-agent: 019-e
    - docs-alignment-review-agent: 019-f
`;

test("validate-launch-report requires AI readiness accounting", () => {
  const valid = runPlanToPr("validate-launch-report", launchedReport);

  assert.equal(valid.status, 0);

  const invalid = runPlanToPr("validate-launch-report", launchedReport.replace(
    "    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed\n",
    "",
  ));

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /ai-readiness-upkeep-agent must be launched or listed/);
});

test("validate-review-report requires AI readiness accounting", () => {
  const report = `reviewer_subagent_report:
  status: complete
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed
    - security-review-agent: not_applicable - no security-sensitive surface changed
  outcomes:
    - implementation-review-agent: passed - no actionable correctness or regression findings
    - implementation-scrutiny-agent: passed - scrutiny verdict ship
    - code-quality-review-agent: passed - no critical or warning maintainability findings
    - code-simplifier-agent: passed - simplification applied or not needed
    - deslop-agent: passed - AI-shaped clutter removed or not present
    - docs-alignment-review-agent: passed - docs alignment clean or updated
`;

  const valid = runPlanToPr("validate-review-report", report);

  assert.equal(valid.status, 0);

  const invalid = runPlanToPr("validate-review-report", report.replace(
    "    - ai-readiness-upkeep-agent: not_applicable - no AI readiness verification or agent-surface contract changed\n",
    "",
  ));

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /ai-readiness-upkeep-agent must be launched or listed/);
});

test("validate-review-report requires launched AI readiness evidence to validate the report", () => {
  const report = `reviewer_subagent_report:
  status: complete
  launched_reviewers:
    - implementation-review-agent
    - implementation-scrutiny-agent
    - code-quality-review-agent
    - code-simplifier-agent
    - deslop-agent
    - ai-readiness-upkeep-agent
    - docs-alignment-review-agent
  skipped_reviewers:
    - security-review-agent: not_applicable - no security-sensitive surface changed
  outcomes:
    - implementation-review-agent: passed - no actionable correctness or regression findings
    - implementation-scrutiny-agent: passed - scrutiny verdict ship
    - code-quality-review-agent: passed - no critical or warning maintainability findings
    - code-simplifier-agent: passed - simplification applied or not needed
    - deslop-agent: passed - AI-shaped clutter removed or not present
    - ai-readiness-upkeep-agent: passed - validated ai_readiness_upkeep_report with verdict passed
    - docs-alignment-review-agent: passed - docs alignment clean or updated
`;

  const valid = runPlanToPr("validate-review-report", report);

  assert.equal(valid.status, 0);

  const invalid = runPlanToPr("validate-review-report", report.replace(
    "validated ai_readiness_upkeep_report with verdict passed",
    "no AI readiness findings",
  ));

  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /ai-readiness-upkeep-agent outcome evidence must mention validate-report/);
});

test("validate-ledger accepts not applicable AI readiness gate", () => {
  const ledger = `delivery_gate_ledger:
  handoff_validation:
    status: passed
    evidence: plan_ready_handoff validated
  session_start:
    status: passed
    evidence: repo inspected
  implementation:
    status: passed
    evidence: approved slice implemented
  local_verification:
    status: passed
    evidence: pnpm run test:unit
  reviewer_subagents:
    status: passed
    evidence: reviewer reports validated
  implementation_review:
    status: passed
    evidence: no findings
  implementation_scrutiny:
    status: passed
    evidence: ship
  code_quality_review:
    status: passed
    evidence: no structural findings
  code_simplifier:
    status: passed
    evidence: complete
  deslop:
    status: passed
    evidence: complete
  security_review:
    status: not_applicable
    evidence: no security surface
  ai_readiness_upkeep:
    status: not_applicable
    evidence: no AI readiness surface
  docs_alignment:
    status: passed
    evidence: clean
  review_feedback_routing:
    status: passed
    evidence: github selected
  artifact_creation_update:
    status: passed
    evidence: PR URL
  artifact_host_review:
    status: passed
    evidence: PR inspected
  review_feedback:
    status: passed
    evidence: latest-head feedback resolved
  ci:
    status: passed
    evidence: checks green
`;

  const result = runPlanToPr("validate-ledger", ledger);

  assert.equal(result.status, 0);
});
