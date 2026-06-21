import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTempFile(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "nitro-feedback-gate-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runNitroGate(
  command: string,
  content = "",
): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;

  if (content) {
    withTempFile(content, (path) => {
      result = spawnSync(
        "pnpm",
        [
          "exec",
          "tsx",
          "scripts/nitro-feedback-gate.ts",
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
  } else {
    result = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/nitro-feedback-gate.ts", command],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
  }

  assert.ok(result);
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

const cleanGate = `nitro_feedback_gate:
  artifact: https://git.fullscript.io/group/project/-/merge_requests/1
  head_sha: abc123
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
`;

test("template emits a readable summary before YAML", () => {
  const result = runNitroGate("template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("nitro_feedback_gate:"),
  );
  assert.match(
    result.stdout,
    /start:\n {4}status: started \| blocked \| pending/,
  );
});

test("validate accepts a clean latest-head gate", () => {
  const result = runNitroGate("validate", cleanGate);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nitro_feedback_gate valid/);
});

test("validate rejects passed gates with unresolved findings", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "  unresolved_actionable_feedback: []",
      "  unresolved_actionable_feedback:\n    - fix this",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gate_outcome passed requires/);
});

test("normalize-feedback maps pending to a pending gate", () => {
  const result = runNitroGate(
    "normalize-feedback",
    `artifact: https://git.fullscript.io/group/project/-/merge_requests/1
head_sha: abc123
status: pending
`,
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /completion:\n {4}status: pending/);
  assert.match(result.stdout, /gate_outcome: pending/);
});

test("normalize-feedback maps findings to a blocked gate", () => {
  const result = runNitroGate(
    "normalize-feedback",
    `artifact: https://git.fullscript.io/group/project/-/merge_requests/1
head_sha: abc123
status: findings
`,
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /completion:\n {4}status: findings/);
  assert.match(
    result.stdout,
    /unresolved_actionable_feedback:\n {4}- latest-head Nitro findings/,
  );
  assert.match(result.stdout, /gate_outcome: blocked/);
});

test("validate-route accepts Fullscript GitLab merge requests", () => {
  const result = runNitroGate(
    "validate-route",
    `nitro_route:
  artifact_host: gitlab
  artifact_kind: merge_request
  remote_host: git.fullscript.io
  required: true
`,
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nitro_route valid/);
});

test("validate-route rejects GitHub as Nitro unsupported", () => {
  const result = runNitroGate(
    "validate-route",
    `nitro_route:
  artifact_host: github
  artifact_kind: pull_request
  remote_host: github.com
  required: true
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nitro_route_unsupported/);
});
