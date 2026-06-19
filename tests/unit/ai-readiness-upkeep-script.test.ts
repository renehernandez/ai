import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "ai-readiness-upkeep-"));
  const path = join(directory, "report.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function validateReport(content: string): {
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
        "skills/ai-readiness-upkeep/scripts/ai-readiness-upkeep.ts",
        "validate-report",
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

const checked = `  checked:
    surfaces:
      - source
    evidence:
      - tests/example.test.ts: touched behavior
`;

test("validate-report accepts a passed report", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings:
    blocking: []
    nonblocking: []
  deferred: []
`);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /ai_readiness_upkeep_report valid/);
});

test("validate-report rejects reports missing checked evidence", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
  checked:
    surfaces:
      - source
  findings:
    blocking: []
    nonblocking: []
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /checked\.evidence must include at least one evidence item/,
  );
});

test("validate-report rejects reports missing findings sections", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings: []
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /findings\.blocking is required/);
  assert.match(result.stderr, /findings\.nonblocking is required/);
});

test("validate-report rejects reports missing deferred", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings:
    blocking: []
    nonblocking: []
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /deferred is required/);
});

test("validate-report accepts nonblocking findings with findings verdict", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: findings
${checked}
  findings:
    blocking: []
    nonblocking:
      - title: Add slower scheduled drift check
        evidence: External dependency can drift outside code changes
        suggestion: Track in a future audit job
        action_type: defer
        lane: scheduled
  deferred: []
`);

  assert.equal(result.status, 0);
});

test("validate-report rejects passed reports with nonblocking findings", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings:
    blocking: []
    nonblocking:
      - title: Missing CI check
        evidence: CI config does not run the new validator
        suggestion: Wire the validator into CI
        action_type: wire_automation
        lane: ci
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /passed reports must not include nonblocking findings/,
  );
});

test("validate-report rejects passed reports with deferred items", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings:
    blocking: []
    nonblocking: []
  deferred:
    - item: Add scheduled drift check
      reason: Needs separate rollout
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /passed reports must not include deferred items/);
});

test("validate-report rejects not applicable reports with residual findings", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: not_applicable
${checked}
  findings:
    blocking: []
    nonblocking:
      - title: Missing CI check
        evidence: CI config does not run the new validator
        suggestion: Wire the validator into CI
        action_type: wire_automation
        lane: ci
  deferred:
    - item: Add scheduled drift check
      reason: Needs separate rollout
`);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /not_applicable reports must not include nonblocking findings/,
  );
  assert.match(
    result.stderr,
    /not_applicable reports must not include deferred items/,
  );
});

test("validate-report accepts blocked reports with enforceable blocking findings", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: blocked
${checked}
  findings:
    blocking:
      - title: Generated client has no drift check
        contract: Generated clients must match the API schema
        evidence: src/client.ts changed without a generator check
        required_change: Add a package script that regenerates and fails on diff
        action_type: add_verification
        lane: task_command
        target_surface: package.json
    nonblocking: []
  deferred: []
`);

  assert.equal(result.status, 0);
});

test("validate-report rejects unknown lanes", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: blocked
${checked}
  findings:
    blocking:
      - title: Unknown lane
        contract: Contract
        evidence: Evidence
        required_change: Change
        action_type: add_verification
        lane: preflight
        target_surface: package.json
    nonblocking: []
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /lane must be one of/);
});

test("validate-report rejects passed reports with blocking findings", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings:
    blocking:
      - title: Blocking mismatch
        contract: Contract
        evidence: Evidence
        required_change: Change
        action_type: add_verification
        lane: ci
        target_surface: .github/workflows/test.yml
    nonblocking: []
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /passed reports must not include blocking findings/,
  );
});

test("validate-report rejects blocking findings missing required fields", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: blocked
${checked}
  findings:
    blocking:
      - title: Missing fields
        contract: Contract
        action_type: add_verification
        lane: ci
        target_surface: .github/workflows/test.yml
    nonblocking: []
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /blocking\[0\]\.evidence is required/);
  assert.match(result.stderr, /blocking\[0\]\.required_change is required/);
});

test("validate-report rejects manual blocking lanes", () => {
  const result = validateReport(`ai_readiness_upkeep_report:
  verdict: blocked
${checked}
  findings:
    blocking:
      - title: Manual blocker
        contract: Contract
        evidence: Evidence
        required_change: Change
        action_type: add_verification
        lane: manual
        target_surface: runbook.md
    nonblocking: []
  deferred: []
`);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /blocking finding lane must be enforceable/);
});

test("validate-report accepts fenced yaml input", () => {
  const result = validateReport(`\`\`\`yaml
ai_readiness_upkeep_report:
  verdict: passed
${checked}
  findings:
    blocking: []
    nonblocking: []
  deferred: []
\`\`\`
`);

  assert.equal(result.status, 0);
});
