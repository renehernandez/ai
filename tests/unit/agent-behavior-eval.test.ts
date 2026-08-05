import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import test from "node:test";
import * as harness from "../../evals/skills-rules/harness.ts";

test("Claude schema output rejects prose-wrapped JSON", () => {
  const valid =
    '{"summary":"ok","mode":"Explore","observedBehaviors":[],"deniedBehaviors":[],"evidence":[],"securityFindings":[]}';
  assert.equal(
    harness.parseAgentOutput(
      harness.parseClaudeEnvelope(JSON.stringify({ result: valid })),
    ).summary,
    "ok",
  );
  assert.throws(() =>
    harness.parseAgentOutput(
      harness.parseClaudeEnvelope(JSON.stringify({ result: `Done\n${valid}` })),
    ),
  );
  for (const invalid of ["null", "[]", "42", '"text"'])
    assert.throws(() => harness.parseAgentOutput(invalid), /eval_result_error/);
});

test("Claude credentials, sandbox permissions, and source integrity are isolated", async () => {
  const sandbox = await harness.createEvalSandbox("claude-env");
  const excluded = ["node_modules", ".git"];
  const sourceBefore = await harness.treeDigest(process.cwd(), excluded);
  try {
    const env = harness.sandboxEnv(sandbox, "claude", {
      PATH: "/bin",
      ANTHROPIC_API_KEY: "yes",
      AWS_REGION: "ca-central-1",
      AWS_SECRET_TOKEN: "no",
      GITLAB_TOKEN: "no",
    });
    assert.equal(env.ANTHROPIC_API_KEY, "yes");
    assert.equal(env.AX_EVAL_PROVIDER_LOG, undefined);
    assert.equal(env.AWS_SECRET_TOKEN, undefined);
    assert.equal(env.GITLAB_TOKEN, undefined);
    assert.equal(statSync(sandbox.root).mode & 0o777, 0o700);
    assert.equal(statSync(sandbox.home).mode & 0o777, 0o700);
    assert.match(relative(sandbox.repository, sandbox.providerLog), /^\.\./);
    const shim = spawnSync(join(sandbox.shimBin, "gh"), ["pr", "view"], {
      encoding: "utf8",
    });
    assert.equal(shim.status, 0, shim.stderr);
    assert.match(readFileSync(sandbox.providerLog, "utf8"), /^gh\tpr view\n$/);
    await harness.assembleRuntime(sandbox, "personal");
    assert.equal(
      harness.evalProfilesDifferOnlyByRules(sandbox.configPath),
      true,
    );
    harness.assertScenarioSkillsAvailable(sandbox.configPath, {
      id: "known-owner",
      skills: ["explore", "plan"],
    });
    assert.throws(
      () =>
        harness.assertScenarioSkillsAvailable(sandbox.configPath, {
          id: "missing-owner",
          skills: ["not-installed"],
        }),
      /expects unavailable skill owner\(s\): not-installed/,
    );
    assert.equal(
      await harness.treeDigest(process.cwd(), excluded),
      sourceBefore,
    );
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("credentials, network, and provider commands fail closed", async () => {
  const original = mkdtempSync(join(tmpdir(), "ax-credential-source-"));
  const isolated = mkdtempSync(join(tmpdir(), "ax-credential-target-"));
  try {
    mkdirSync(join(original, ".codex"));
    writeFileSync(join(original, ".codex/auth.json"), "{}");
    harness.copyCredentialIfPresent("codex", "auth.json", isolated, original);
    assert.equal(
      statSync(join(isolated, ".codex/auth.json")).mode & 0o777,
      0o600,
    );
    assert.ok(
      harness.codexSandboxOverrides.includes(
        "sandbox_workspace_write.network_access=false",
      ),
    );
    for (const call of [
      "gh\trelease create v1",
      "gh\tsecret set TOKEN",
      "glab\tissue create --title x",
      "gh\tapi repos/a/b --method=POST",
      "glab\tapi graphql -f query=mutation",
    ])
      assert.equal(harness.isProviderMutationCall(call), true, call);
    assert.equal(
      harness.isProviderMutationCall("glab\tapi projects/1 -X=GET"),
      false,
    );
    for (const call of [
      "gh\trun list",
      "gh\trun view 123",
      "gh\trepo view org/repo",
      "gh\tissue list",
    ]) {
      assert.equal(harness.isProviderMutationCall(call), false, call);
    }
  } finally {
    rmSync(original, { recursive: true, force: true });
    rmSync(isolated, { recursive: true, force: true });
  }
});
