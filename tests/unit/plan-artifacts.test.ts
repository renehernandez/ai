import assert from "node:assert/strict";
import { homedir } from "node:os";
import test from "node:test";
import {
  classifyAgentsPlanArtifact,
  derivePlanArtifactWorkspaceIdentity,
  isAgentsPlanPath,
  isPlanSupportSidecar,
  isPrimaryMarkdownPlan,
  isSafeAgentsPlanRef,
  normalizeAgentsPlanRef,
  sha256Hex,
} from "../../scripts/plan-artifacts.ts";

test("normalizes safe agents plan references and rejects escapes", () => {
  assert.equal(
    normalizeAgentsPlanRef("./.agents/plans/nested/../example.md"),
    ".agents/plans/example.md",
  );
  assert.equal(isSafeAgentsPlanRef(".agents/plans/example.md"), true);
  assert.equal(isSafeAgentsPlanRef("/tmp/.agents/plans/example.md"), false);
  assert.equal(isSafeAgentsPlanRef(".agents/plans/../../outside.md"), false);
  assert.equal(isSafeAgentsPlanRef("../.agents/plans/example.md"), false);
  assert.equal(isSafeAgentsPlanRef("\\tmp\\.agents\\plans\\example.md"), false);
  assert.equal(
    isSafeAgentsPlanRef("\\\\server\\share\\.agents\\plans\\example.md"),
    false,
  );
});

test("detects agents plan paths after normalization", () => {
  assert.equal(isAgentsPlanPath(".agents/plans"), true);
  assert.equal(isAgentsPlanPath(".agents/plans/example.md"), true);
  assert.equal(isAgentsPlanPath("docs/plans/example.md"), false);
});

test("classifies primary markdown plans separately from support sidecars", () => {
  assert.deepEqual(
    classifyAgentsPlanArtifact(".agents/plans/release-plan.md"),
    {
      type: "primary_markdown_plan",
      normalizedPath: ".agents/plans/release-plan.md",
      extension: ".md",
    },
  );

  assert.equal(
    isPlanSupportSidecar(".agents/plans/release-plan.review-request.md"),
    true,
  );
  assert.equal(
    isPlanSupportSidecar(".agents/plans/release-plan.validation-output.json"),
    true,
  );
  assert.equal(isPlanSupportSidecar(".agents/plans/release-plan.yaml"), true);
  assert.equal(isPrimaryMarkdownPlan(".agents/plans/release-plan.md"), true);
  assert.equal(
    isPrimaryMarkdownPlan(".agents/plans/release-plan.handoff.md"),
    false,
  );
});

test("fingerprints content deterministically", () => {
  assert.equal(
    sha256Hex("plan"),
    "64879f7d6b960a01909762d911a32d4582c20010c5641ee90278b644a9e3b525",
  );
  assert.notEqual(sha256Hex("plan"), sha256Hex("other plan"));
});

test("derives deterministic private workspace identity for plan artifacts", () => {
  const first = derivePlanArtifactWorkspaceIdentity({
    repoKey: "git@git.fullscript.io:rene.hernandez/ai.git",
    planPath: ".agents/plans/private-plan-support-artifacts.md",
    axPlansRoot: "/home/rene/.ax/plans",
  });
  const second = derivePlanArtifactWorkspaceIdentity({
    repoKey: "git@git.fullscript.io:rene.hernandez/ai.git",
    planPath: ".agents/plans/archive/private-plan-support-artifacts.md",
    axPlansRoot: "/home/rene/.ax/plans",
  });

  assert.match(first.planSlug, /^private-plan-support-artifacts-[a-f0-9]{12}$/);
  assert.match(
    second.planSlug,
    /^private-plan-support-artifacts-[a-f0-9]{12}$/,
  );
  assert.notEqual(first.planSlug, second.planSlug);
  assert.equal(
    first.workspacePath,
    `/home/rene/.ax/plans/repos/sha256-${first.repoHash}/plans/${first.planSlug}`,
  );
  assert.equal(first.artifactsPath, `${first.workspacePath}/artifacts`);
  assert.equal(first.manifestPath, `${first.workspacePath}/manifest.json`);
  assert.equal(first.indexPath, `${first.workspacePath}/index.jsonl`);
});

test("derives default private workspace identity under the current home directory", () => {
  const identity = derivePlanArtifactWorkspaceIdentity({
    repoKey: "https://git.fullscript.io/rene.hernandez/ai.git",
    planPath: ".agents/plans/example.md",
  });

  assert.equal(
    identity.workspacePath.startsWith(`${homedir()}/.ax/plans/`),
    true,
  );
});
