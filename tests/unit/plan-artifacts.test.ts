import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  classifyAgentsPlanArtifact,
  derivePlanArtifactWorkspaceIdentity,
  isAgentsPlanPath,
  isPlanSupportSidecar,
  isPrimaryMarkdownPlan,
  isSafeAgentsPlanRef,
  normalizeAgentsPlanRef,
  recordPlanArtifact,
  sha256Hex,
} from "../../scripts/plan-artifacts.ts";

function withTempDir(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "plan-artifacts-unit-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_PREFIX;
  delete env.GIT_QUARANTINE_PATH;
  delete env.GIT_WORK_TREE;
  return env;
}

function git(cwd: string, args: string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function createPlanArtifactTarget(directory: string): string {
  const targetRepo = join(directory, "target-repo");
  mkdirSync(join(targetRepo, ".agents", "plans"), { recursive: true });
  git(targetRepo, ["init"]);
  git(targetRepo, [
    "remote",
    "add",
    "origin",
    "git@git.fullscript.io:team/target-repo.git",
  ]);
  writeFileSync(
    join(targetRepo, ".agents", "plans", "example.md"),
    "# Example plan\n",
    "utf-8",
  );
  return targetRepo;
}

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

test("records absolute local support artifact files", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    const outsideArtifact = join(directory, "reviewer-selection.md");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(
      outsideArtifact,
      "# Reviewer selection\n\n- nitro\n",
      "utf-8",
    );

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: outsideArtifact,
      axPlansRoot,
    });

    assert.equal(result.status, "recorded");
    assert.equal(result.artifactKind, "reviewer_selection");
    assert.match(
      result.privateWorkspaceRelativePath,
      /^repos\/sha256-[a-f0-9]+\/plans\/example-[a-f0-9]{12}\/revisions\/plan-[a-f0-9]{16}\/artifacts\/reviewer_selection-[a-f0-9]+\.md$/,
    );
    assert.equal(
      readFileSync(
        join(axPlansRoot, result.privateWorkspaceRelativePath),
        "utf-8",
      ),
      "# Reviewer selection\n\n- nitro\n",
    );
  });
});

test("records absolute repo-local support artifact files", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    const repoArtifact = join(targetRepo, "reviewer-selection.md");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(repoArtifact, "# Reviewer selection\n\n- nitro\n", "utf-8");

    const result = recordPlanArtifact({
      targetRoot: targetRepo,
      planPath: ".agents/plans/example.md",
      kind: "reviewer_selection",
      filePath: repoArtifact,
      axPlansRoot,
    });

    assert.equal(result.status, "recorded");
    assert.equal(
      readFileSync(
        join(axPlansRoot, result.privateWorkspaceRelativePath),
        "utf-8",
      ),
      "# Reviewer selection\n\n- nitro\n",
    );
  });
});

test("rejects absolute repo-local symlink source escapes", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const axPlansRoot = join(directory, "ax-plans");
    const outsideArtifact = join(directory, "outside.md");
    const repoSymlink = join(targetRepo, "support.md");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(outsideArtifact, "# Outside\n", "utf-8");
    symlinkSync(outsideArtifact, repoSymlink);

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetRepo,
          planPath: ".agents/plans/example.md",
          kind: "handoff",
          filePath: repoSymlink,
          axPlansRoot,
        }),
      /--file must resolve inside target repo unless an absolute source path is provided/,
    );
  });
});

test("rejects absolute repo-local symlink escapes through target-root aliases", () => {
  withTempDir((directory) => {
    const targetRepo = createPlanArtifactTarget(directory);
    const targetAlias = join(directory, "target-alias");
    const axPlansRoot = join(directory, "ax-plans");
    const outsideArtifact = join(directory, "outside.md");
    const repoSymlink = join(targetRepo, "support.md");
    const aliasSymlink = join(targetAlias, "support.md");
    mkdirSync(axPlansRoot, { mode: 0o700 });
    chmodSync(axPlansRoot, 0o700);
    writeFileSync(outsideArtifact, "# Outside\n", "utf-8");
    symlinkSync(targetRepo, targetAlias);
    symlinkSync(outsideArtifact, repoSymlink);

    assert.throws(
      () =>
        recordPlanArtifact({
          targetRoot: targetAlias,
          planPath: ".agents/plans/example.md",
          kind: "handoff",
          filePath: aliasSymlink,
          axPlansRoot,
        }),
      /--file must resolve inside target repo unless an absolute source path is provided/,
    );
  });
});
