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
  /\bsession-start\b/,
  /\bplan-ready\b/,
  /\bplan-review\b/,
  /\bplan-orchestrator\b/,
  /\bplan-poc\b/,
  /\bplan-unit-sequencer\b/,
  /\bplan-unit-delivery\b/,
  /\breview-feedback-routing\b/,
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

  test(`${file} gates new substantive tasks through Explore before readiness`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Every new substantive task begins in Explore/);
    assert.match(text, /defaults to `brainstorming`/);
    assert.match(
      text,
      /opening request to fix, implement, change,\s+or build does not itself authorize mutation/,
    );
    assert.match(
      text,
      /materially different requested\s+outcome resets the task to Explore/,
    );
    assert.match(
      text,
      /later explicit instruction to proceed\s+authorizes Plan or Execute/,
    );
    assert.match(
      text,
      /Direct Execute is eligible only when one coherent\s+MR/,
    );
  });

  test(`${file} preserves authority without repeated confirmation`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /continue automatically within that scope/);
    assert.match(
      text,
      /Routine wording, formatting, validation, test, CI,\s+review, and schema repairs do not require renewed permission/,
    );
    assert.match(text, /explicit recommendation bundle accepts that bundle/);
    assert.match(text, /never unstated\s+scope or unrelated mutation/);
    assert.match(
      text,
      /Existing authenticated\s+commands do not require renewed approval/,
    );
    assert.match(
      text,
      /credential entry or a new credential\s+grant remains a human action/,
    );
  });

  test(`${file} keeps shared behavior mechanically reviewed`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /writing-skills/);
    assert.match(text, /shared skill, agent, instruction, or rule sources/);
    assert.match(text, /Portable shared skills/);
    assert.match(text, /owning skill folder/);
    assert.match(text, /real package dependency/);
  });

  test(`${file} keeps simplification as a core planning and execution reviewer`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /`code-simplifier` is a core reviewer/);
    assert.match(text, /always keeps\s+its own recorded outcome/);
    assert.match(text, /another available model/);
  });

  test(`${file} defaults non-trivial work to precedent discovery and reuse`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /every non-trivial design and implementation/);
    assert.match(text, /repository precedent/);
    assert.match(text, /canonical-owner reuse/);
    assert.match(text, /request does not mention\s+an existing approach/);
    assert.match(text, /repository-backed justification/);
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

test("active lifecycle rules contain no retired lifecycle entrypoints", () => {
  for (const file of lifecycleRules) {
    const text = readFileSync(file, "utf-8");
    for (const retired of retiredLifecycleReferences) {
      assert.doesNotMatch(text, retired, `${file} still references ${retired}`);
    }
  }
});

test("entrypoints route bounded specialists through the five mode owners", () => {
  for (const file of entrypoints) {
    const text = readFileSync(file, "utf-8");
    assert.match(text, /Explore uses `brainstorming` and\s+`start-project`/);
    assert.match(text, /Plan uses `openspec-tasks`/);
    assert.match(text, /Review uses the GitHub\/GitLab\s+host adapters/);
    assert.match(text, /Finish\s+uses `change-request-create`/);
    assert.match(text, /`codex-review-feedback` remains retired/);
    assert.match(text, /No mandatory frontend-design skill/);
    assert.doesNotMatch(text, /`hallmark`/);
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
  assert.match(text, /Every new substantive task begins in Explore/);
  assert.match(
    text,
    /Opening imperatives such as "fix", "implement", "change", or "build"/,
  );
  assert.match(text, /do not independently authorize mutation/);
  assert.match(text, /later explicit instruction such as\s+"proceed"/);
  assert.match(
    text,
    /materially different requested outcome creates a new task boundary/,
  );
  assert.match(
    text,
    /review feedback, and CI failures.*do not\s+reset the task/is,
  );
  assert.match(text, /no\s+unresolved.*behavior.*architecture.*migration/is);
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
  assert.match(
    text,
    /similarity wording narrows the scan but never triggers it/,
  );
  assert.match(text, /reuse and deviation contract/);
  assert.match(text, /Keep the primary artifact at the durable-contract level/);
  assert.match(
    text,
    /Exact files, symbols, commands, exhaustive test or\s+edge-case matrices/,
  );
  assert.match(text, /Exact files.*remain task-local/is);
  assert.match(text, /first stack objective proof/);
  assert.match(
    text,
    /separate findings-only `code-simplifier` reviewer-run\s+identity/,
  );
  assert.match(
    text,
    /independent findings-only `code-quality-review` and `scrutinize`/,
  );
  assert.match(
    text,
    /completed stable POC publishes a hook-clean\s+draft, requests hosted review, then receives every completed-code\s+review type/i,
  );
});

test("documentation rules keep OpenSpec adapters explicit and task-shaped", () => {
  const text = readFileSync("rules/docs-and-specs.md", "utf-8");

  assert.match(text, /explicit developer command/i);
  assert.match(text, /ordinary language.*five modes/is);
  assert.match(text, /top-level.*delivery unit.*final.*PR\/MR/is);
  assert.match(text, /nested work items/i);
  assert.match(text, /complete.*POC/i);
  assert.match(text, /only primary.*Markdown.*\.agents\/plans/is);
  assert.match(text, /Every non-trivial primary plan or OpenSpec/);
  assert.match(text, /No applicable precedent found/);
  assert.match(text, /Keep the OpenSpec artifacts complementary/);
  assert.match(text, /Tasks remain a high-level delivery queue/);
  assert.match(text, /`groundwork`, `outcome`, or `hardening`/);
  assert.match(text, /stack objective proof must appear by unit 3/i);
  assert.match(
    text,
    /nested work items never declare themselves final PRs\/MRs/i,
  );
  assert.match(
    text,
    /Planning artifacts preserve the objective, high-level approach/,
  );
  assert.match(text, /review chronology.*task-local/is);
  assert.match(
    text,
    /planning contracts.*do not run Doc Smith reader personas/is,
  );
});

test("Git rules separate Review from Finish and use native hook-enabled commits", () => {
  const text = readFileSync("rules/git-and-review.md", "utf-8");

  assert.match(text, /native.*Git commit|Git commit.*repository hooks/i);
  assert.match(text, /never.*--no-verify/i);
  assert.match(text, /Review.*read-only/is);
  assert.match(text, /Finish.*provider mutation/is);
  assert.match(text, /technical_readiness_checkpoint/);
  assert.match(
    text,
    /hook-clean commit.*creates or updates the.*draft.*hosted review.*local Review/is,
  );
  assert.match(text, /pre-commit hook's.*full-suite evidence/is);
  assert.match(text, /task-local/i);
  assert.match(text, /HEAD or the resolved target-base SHA.*fresh exact-/is);
  assert.match(text, /patch-\s*equivalent rebase.*reuse discovery/is);
  assert.match(text, /merge.*explicit/i);
  assert.match(
    text,
    /atomic\s+plan and its implementation form one change set in one final MR/is,
  );
  assert.match(text, /with no POC\s+phase/is);
  assert.doesNotMatch(text, /ax commit|review-gate|plans artifact/i);
});

test("workflow spec publishes the hook-clean draft before local readiness", () => {
  const text = readFileSync(
    "openspec/specs/agent-workflow-modes/spec.md",
    "utf-8",
  );

  assert.match(
    text,
    /publish a hook-clean draft before local implementation Review/i,
  );
  assert.match(text, /local and hosted review against the same exact head/i);
  assert.match(text, /every required local review type/i);
  assert.match(text, /technical_readiness_checkpoint/);
  assert.doesNotMatch(text, /Review emits `publication_checkpoint`/);
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

test("AI repo converges the main worktree and live AX runtime after every merge", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");

  assert.match(repoAgents, /After every successful merge/);
  assert.match(repoAgents, /git worktree list --porcelain/);
  assert.match(repoAgents, /refs\/heads\/main/);
  assert.match(repoAgents, /clean/);
  assert.match(repoAgents, /git pull --ff-only origin main/);
  assert.match(repoAgents, /HEAD.*origin\/main/is);
  assert.match(repoAgents, /pnpm ax sync/);
  assert.match(repoAgents, /pnpm ax validate/);
  assert.match(repoAgents, /feature or disposable worktree/);
  assert.match(repoAgents, /blocker/);
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

test("accepted atomic plans continue through automated draft delivery", () => {
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");

  assert.match(portableAgents, /complete atomic plan.*`agreed`/is);
  assert.match(portableAgents, /dedicated\s+draft PR\/MR/);
  assert.match(portableAgents, /no actionable automated feedback remains/);
  assert.match(portableAgents, /does not authorize merge/);
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

test("OpenSpec guidance challenges delivery-unit cohesion before writing", () => {
  const implementationRules = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );
  const docsRules = readFileSync("rules/docs-and-specs.md", "utf-8");
  const testingRules = readFileSync(
    "rules/testing-and-verification.md",
    "utf-8",
  );
  const reviewAdapter = readFileSync(
    "skills/review/agents/openai.yaml",
    "utf-8",
  );

  for (const text of [implementationRules, docsRules]) {
    assert.match(text, /existing\s+headings (?:are|as) hypotheses/i);
    assert.match(
      text,
      /(?:safe.*merged.*intermediate state|safe.*when merged before)/is,
    );
    assert.match(
      text,
      /shared prerequisites.*feature behavior.*proof infrastructure.*activation/is,
    );
    assert.match(text, /unused.*unverifiable.*checkbox-only/is);
    assert.match(text, /POC.*actual/is);
  }

  assert.match(testingRules, /delivery\s+shape/);
  assert.match(reviewAdapter, /every phase-specific review type/);
  assert.doesNotMatch(reviewAdapter, /four-lane/);
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

test("automated setup is allowed while dependency graph changes remain permission-gated", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");
  const commandRules = readFileSync("rules/command-and-tools.md", "utf-8");

  for (const text of [repoAgents, portableAgents]) {
    assert.match(text, /documented automated setup/);
    assert.match(text, /dependencies already declared/);
    assert.match(text, /without separate permission/);
    assert.match(
      text,
      /Adding, updating, downgrading, or\s+removing dependencies/,
    );
    assert.match(text, /manifest or lockfile changes/);
  }

  assert.match(commandRules, /documented automated setup command/);
  assert.match(commandRules, /dependency graph already declared/);
  assert.match(commandRules, /without\s+separate permission/);
  assert.match(commandRules, /Do not add, update, downgrade, or remove/);
  assert.match(
    commandRules,
    /If setup would make one of\s+those changes, stop/,
  );
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
