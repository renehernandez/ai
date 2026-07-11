import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const entrypoints = ["AGENTS.md", "instructions/AGENTS.md"] as const;
const lifecycleRules = [
  ...entrypoints,
  "rules/investigation-and-implementation.md",
  "rules/session-startup.md",
  "rules/docs-and-specs.md",
  "rules/git-and-review.md",
] as const;
const modeNames = ["Explore", "Plan", "Execute", "Review", "Finish"] as const;

const retiredLifecycleReferences = [
  /\bbrainstorming\b/,
  /\bstart-project\b/,
  /\bsession-start\b/,
  /\bplan-ready\b/,
  /\bplan-review\b/,
  /\bplan-orchestrator\b/,
  /\bplan-poc\b/,
  /\bplan-unit-sequencer\b/,
  /\bplan-unit-delivery\b/,
  /\breview-feedback-routing\b/,
  /\bchange-request-create\b/,
  /\bmerge-followthrough\b/,
] as const;

for (const file of entrypoints) {
  test(`${file} exposes the five-mode lifecycle and bounded authority`, () => {
    const text = readFileSync(file, "utf-8");

    for (const mode of modeNames) {
      assert.match(text, new RegExp(`\\b${mode}\\b`));
    }
    assert.match(text, /explicit mode name.*override/i);
    assert.match(text, /one (?:write )?owner.*worktree|one writer.*worktree/i);
    assert.match(text, /merge, deployment, and cleanup.*explicit/i);
  });

  test(`${file} keeps shared behavior mechanically reviewed`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /writing-skills/);
    assert.match(text, /shared skill, agent, instruction, or rule sources/);
    assert.match(text, /Portable shared skills/);
    assert.match(text, /owning skill folder/);
    assert.match(text, /real package dependency/);
  });

  test(`${file} requires readable summaries for structured thread contracts`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Readable Summary/);
    assert.match(text, /YAML or JSON|YAML\/JSON/);
  });

  test(`${file} routes organizational agents through durable workspaces`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /agent-workspace/);
    assert.match(text, /Linear and Git own durable coordination state/);
    assert.match(text, /Delivery Executive Assistant/);
    assert.match(text, /Executive Operations Assistant/);
    assert.match(text, /Rene retains merge/);
    assert.match(text, /ax agents/);
  });
}

test("active lifecycle rules contain no retired public entrypoints", () => {
  for (const file of lifecycleRules) {
    const text = readFileSync(file, "utf-8");
    for (const retired of retiredLifecycleReferences) {
      assert.doesNotMatch(text, retired, `${file} still references ${retired}`);
    }
  }
});

test("startup rules perform shared mode preflight without a lifecycle skill", () => {
  const text = readFileSync("rules/session-startup.md", "utf-8");

  assert.match(text, /mode preflight/i);
  assert.match(text, /mode, mutation authority, and goal/i);
  assert.match(text, /git status --short --branch/);
  assert.match(text, /git worktree list/);
  assert.match(text, /one writer|one write owner/i);
  assert.match(text, /target-base diff|exact HEAD/i);
  for (const mode of modeNames) {
    assert.match(text, new RegExp(`\\b${mode}\\b`));
  }
});

test("implementation rules route semantically and enforce the full OpenSpec POC", () => {
  const text = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );

  assert.match(text, /semantic/i);
  assert.match(text, /no unresolved.*behavior.*architecture.*migration/is);
  assert.match(text, /atomic plan/i);
  assert.match(
    text,
    /atomic plan.*implementation.*one change set.*one final (?:PR\/MR|MR)/is,
  );
  assert.match(text, /atomic plan has no POC phase or POC PR\/MR/i);
  assert.match(text, /requires a rehearsal, select OpenSpec/i);
  assert.match(text, /OpenSpec/i);
  assert.match(text, /every OpenSpec.*full.*POC/is);
  assert.match(text, /draft.*review-only.*close.*unmerged/is);
  assert.match(
    text,
    /personal acceptance.*exact.*HEAD|exact.*HEAD.*personal acceptance/is,
  );
  assert.match(text, /one final.*MR.*top-level delivery unit/is);
  assert.match(
    text,
    /no separate planning (?:PR|MR)|no planning-only (?:PR|MR)/i,
  );
  assert.match(text, /POC commits.*not.*merge|never.*cherry-pick.*POC/is);
});

test("documentation rules keep OpenSpec adapters explicit and task-shaped", () => {
  const text = readFileSync("rules/docs-and-specs.md", "utf-8");

  assert.match(text, /explicit developer command/i);
  assert.match(text, /ordinary language.*five modes/is);
  assert.match(text, /top-level.*delivery unit.*final.*PR\/MR/is);
  assert.match(text, /nested work items/i);
  assert.match(text, /complete.*POC/i);
  assert.match(text, /only primary.*Markdown.*\.agents\/plans/is);
});

test("Git rules separate Review from Finish and use native hook-enabled commits", () => {
  const text = readFileSync("rules/git-and-review.md", "utf-8");

  assert.match(text, /native.*Git commit|Git commit.*repository hooks/i);
  assert.match(text, /never.*--no-verify/i);
  assert.match(text, /Review.*read-only/is);
  assert.match(text, /Finish.*provider mutation/is);
  assert.match(text, /publication_checkpoint/);
  assert.match(text, /task-local/i);
  assert.match(text, /HEAD or (?:the resolved )?target-base SHA.*stale/is);
  assert.match(text, /merge.*explicit/i);
  assert.match(
    text,
    /atomic\s+plan and its implementation form one change set in one final MR/is,
  );
  assert.match(text, /with no POC\s+phase/is);
  assert.doesNotMatch(text, /ax commit|review-gate|plans artifact/i);
});

test("AI repo Finish policy remains GitLab and Nitro specific", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");
  const gitRules = readFileSync("rules/git-and-review.md", "utf-8");
  const nitroRules = readFileSync("rules/fullscript/nitro-review.md", "utf-8");

  assert.match(repoAgents, /GitLab `origin`/);
  assert.match(repoAgents, /Nitro/);
  assert.match(repoAgents, /\/request_review @nitro/);
  assert.match(portableAgents, /Nitro.*Fullscript GitLab/is);
  assert.match(
    gitRules,
    /direct user instruction.*project policy.*workflow-policy profile/is,
  );
  assert.match(nitroRules, /Fullscript repositories/);
  assert.match(
    nitroRules,
    /Finish requests Nitro.*\/request_review @nitro.*after initial publication and every effective-diff\s+change: either the source HEAD or resolved target-base SHA/is,
  );
  assert.match(nitroRules, /latest-effective-diff/);
  assert.doesNotMatch(gitRules, /GitLab `origin` MRs targeting `main`/);
  assert.match(
    gitRules,
    /single or root MR targets\s+`main`; each stacked descendant targets its immediate predecessor/is,
  );
});

test("AI repo uses atomic plans without inferring OpenSpec", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");

  assert.match(
    repoAgents,
    /AI-repo work uses one atomic plan and one final MR/,
  );
  assert.match(repoAgents, /Do not infer an OpenSpec route/);
  assert.match(
    repoAgents,
    /OpenSpec adapters remain explicit developer commands/,
  );
});

test("delivery guidance keeps final MRs draft and follows hosted gates", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");
  const gitRules = readFileSync("rules/git-and-review.md", "utf-8");
  const nitroRules = readFileSync("rules/fullscript/nitro-review.md", "utf-8");

  for (const text of [repoAgents, portableAgents]) {
    assert.match(text, /draft through implementation/);
    assert.match(text, /without (?:requiring )?another user\s+prompt/);
  }
  assert.match(gitRules, /Every final MR is created as draft/);
  assert.match(gitRules, /Technical stack readiness leaves every MR draft/);
  assert.match(gitRules, /green parent\s+pipeline.*is not completion/is);
  assert.match(repoAgents, /reactivates the current\s+Execute owner to fix/);
  assert.match(nitroRules, /Read every Nitro response in full/);
  assert.match(nitroRules, /same effective diff/);
  assert.match(nitroRules, /source HEAD plus resolved target-base SHA/);
  assert.match(nitroRules, /still applies/);
  assert.match(nitroRules, /worth addressing before merge/);
});

test("multi-unit guidance supports parallel owners with ordered ancestry", () => {
  const implementationRules = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );
  const gitRules = readFileSync("rules/git-and-review.md", "utf-8");

  assert.match(implementationRules, /one writer each/);
  assert.match(implementationRules, /declared integration hotspots/);
  assert.match(
    implementationRules,
    /Semantically eligible\s+units may implement and follow review concurrently/,
  );
  assert.match(
    gitRules,
    /each descendant MR targets its immediate predecessor/,
  );
  assert.match(gitRules, /coalesce\s+superseded upstream heads/);
  assert.match(gitRules, /exact expected remote-head lease/);
});

test("only primary Markdown plans are tracked", () => {
  const planEntries = readdirSync(".agents/plans", { withFileTypes: true });

  for (const entry of planEntries) {
    assert.equal(
      entry.isFile(),
      true,
      `.agents/plans/${entry.name} is not a file`,
    );
    assert.match(
      entry.name,
      /\.md$/,
      `.agents/plans/${entry.name} is a private workflow sidecar`,
    );
  }
});

test("the five public mode packages exist", () => {
  for (const mode of ["explore", "plan", "execute", "review", "finish"]) {
    assert.equal(
      existsSync(`skills/${mode}/SKILL.md`),
      true,
      `skills/${mode}/SKILL.md is missing`,
    );
  }
});

test("CI infrastructure rules require internal Fullscript job images", () => {
  const text = readFileSync("rules/ci-infra-and-cloudflare.md", "utf-8");

  assert.match(text, /GitLab CI: Container Images/);
  assert.match(text, /Never use upstream public images/);
  assert.match(text, /images\.fullscript\.io\/devops\/ci-images/);
});

test("dependency changes remain package-manager mediated", () => {
  const commandRules = readFileSync("rules/command-and-tools.md", "utf-8");
  const dependencyRules = readFileSync("rules/dependency-security.md", "utf-8");

  assert.match(
    commandRules,
    /Route package-management file changes through the owning package manager CLI/,
  );
  assert.match(commandRules, /Do not hand-edit dependency entries/);
  assert.match(dependencyRules, /Package Manager Authority/);
  assert.match(dependencyRules, /Use the owning package manager CLI/);
});

test("CI and hook automation uses behavior-specific names", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");
  const localRules = readFileSync("rules/project-local.md", "utf-8");
  const mise = readFileSync("mise.toml", "utf-8");
  const lefthook = readFileSync("lefthook.yml", "utf-8");

  for (const text of [repoAgents, portableAgents]) {
    assert.match(text, /generic `check` terminology/);
    assert.match(text, /`lint`, `format`, `typecheck`, `unit-test`/);
  }
  assert.match(localRules, /`mise run pre-commit`/);
  assert.match(mise, /\[tasks\.pre-commit\]/);
  assert.match(lefthook, /biome-lint-format/);
});

test("hook discovery uses the snapshot-managed portable runtime path", () => {
  const hook = readFileSync("hooks/block-node-modules-bin.ts", "utf-8");

  assert.match(hook, /pnpm exec tsx ~\/\.agents\/hooks/);
  assert.doesNotMatch(hook, /\/Users\//);
  assert.doesNotMatch(hook, /npx tsx/);
});
