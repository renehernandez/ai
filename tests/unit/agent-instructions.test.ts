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
const organizationalSurfaces = [
  ...entrypoints,
  "rules/agent-surface-routing.md",
  "rules/handoff-and-resume.md",
] as const;

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
    assert.match(
      text,
      /merge, deployment, and cleanup.*(?:explicit|separately scoped)/i,
    );
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
    assert.match(text, /accepted-proposal contract/);
    assert.match(text, /investigation-and-implementation\.md/);
  });

  test(`${file} preserves authority without repeated confirmation`, () => {
    const text = readFileSync(file, "utf-8");

    assert.match(text, /Infer what the user accepts from context/);
    assert.match(text, /selected delivery shape supply its normal checkpoint/);
    assert.match(text, /separately scoped acceptance for terminal actions/);
    assert.match(text, /Single-MR (?:merge )?authority.*consumed/is);
    assert.match(text, /user's aggregate\s+or sequential scope/);
    assert.doesNotMatch(text, /immediate `proceed`.*merge authority/is);
    assert.doesNotMatch(text, /standalone or ambiguous `proceed`/i);
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
}

test("active instructions contain no organizational-agent hierarchy", () => {
  const retired = [
    /agent-workspace/,
    /Delivery Executive Assistant/,
    /Executive Operations Assistant/,
    /Linear Project Manager/,
    /GitLab Project Manager/,
    /Squad Lead/,
  ] as const;

  for (const file of organizationalSurfaces) {
    const text = readFileSync(file, "utf-8");
    for (const term of retired) {
      assert.doesNotMatch(text, term, `${file} still references ${term}`);
    }
  }
});

test("active lifecycle rules contain no retired lifecycle entrypoints", () => {
  for (const file of lifecycleRules) {
    const text = readFileSync(file, "utf-8");
    for (const retired of retiredLifecycleReferences) {
      assert.doesNotMatch(text, retired, `${file} still references ${retired}`);
    }
  }
});

test("Linear start-work ownership follows the authenticated user without stealing assigned work", () => {
  const text = readFileSync("rules/git-and-review.md", "utf-8");
  const normalized = text.replace(/\s+/g, " ");

  assert.match(
    normalized,
    /before repository implementation begins.*re-reads? the issue.*when present.*its project/i,
  );
  assert.match(
    normalized,
    /issue without a project skips only the project-lead branch/i,
  );
  assert.match(
    normalized,
    /route one pre-implementation ownership step through Finish/i,
  );
  assert.match(
    normalized,
    /Finish as the sole provider-write owner, not as a transition into terminal Finish work/i,
  );
  assert.match(
    normalized,
    /unassigned.*assign it to the authenticated Linear user/i,
  );
  assert.match(
    normalized,
    /already assigned to the authenticated Linear user.*continue/i,
  );
  assert.match(
    normalized,
    /assigned to another user.*stop.*ask the user for instructions/i,
  );
  assert.match(
    normalized,
    /project has no lead.*verified creator is the authenticated Linear user.*assign that user as the project lead/i,
  );
  assert.match(normalized, /never infer project creation identity/i);
  assert.match(normalized, /preserve an existing project lead/i);
  assert.match(
    normalized,
    /project lead or creator metadata is unavailable.*skip and report the project-lead update.*do not block an otherwise verified issue assignment/i,
  );
  assert.match(
    normalized,
    /apply.*start-work ownership mutations without another prompt/i,
  );
  assert.match(
    normalized,
    /accepted start-work policy is confirmation.*eligible scalar writes.*conditional project-lead update.*does not confirm any other provider action/i,
  );
  assert.match(normalized, /verify the changed fields by readback/i);
  assert.match(
    normalized,
    /block implementation.*ownership read, authenticated-user resolution, write, or readback.*unavailable, fails, or does not match/i,
  );
  assert.match(
    normalized,
    /pre-implementation Finish step grants no publication, merge, deployment, cleanup, or unrelated provider authority/i,
  );
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
  assert.match(text, /infer later work authority from the proposal/);
  assert.match(text, /not from prescribed confirmation words/);
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
  assert.match(text, /Never force-push from an agent workflow/i);
  assert.match(
    text,
    /merge it into the feature branch.*ordinary push.*history remains/is,
  );
  assert.match(text, /human-owned history rewrite/i);
  assert.match(text, /Do not locally rebase.*expected to\s+publish/is);
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
  assert.match(text, /accepted-proposal contract/);
  assert.match(text, /terminal action requires one exact action and target/);
  assert.match(text, /one unambiguous MR.*consumed/is);
  assert.match(text, /multi-MR sequence requires the user's aggregate/is);
  assert.match(text, /material effective-diff change.*renewed authority/is);
  assert.match(text, /No confirmation word has\s+special authority/);
  assert.doesNotMatch(text, /immediate `proceed`.*merge/is);
  assert.match(
    text,
    /atomic\s+plan and its implementation form one change set in one final MR/is,
  );
  assert.match(text, /with no POC\s+phase/is);
  assert.doesNotMatch(text, /ax commit|review-gate|plans artifact/i);
});

test("GitLab and Linear messages require destination-bound confirmation", () => {
  const gitRules = readFileSync("rules/git-and-review.md", "utf-8");
  const finish = readFileSync("skills/finish/SKILL.md", "utf-8");
  const changeRequestCreate = readFileSync(
    "skills/change-request-create/SKILL.md",
    "utf-8",
  );
  const linearBreakdown = readFileSync(
    "skills/linear-breakdown/SKILL.md",
    "utf-8",
  );
  const linearis = readFileSync("skills/linearis/SKILL.md", "utf-8");

  assert.match(gitRules, /human-readable GitLab or Linear/i);
  assert.match(gitRules, /exact.*destination.*rendered draft/is);
  assert.match(gitRules, /explicit confirmation/i);
  assert.match(
    gitRules,
    /content or destination\s+changes.*new confirmation/is,
  );
  assert.match(
    gitRules,
    /Automatically generated by `<active harness>`\. Approved for submission by Rene Hernandez\./,
  );
  assert.match(
    gitRules,
    /Automatically generated by Codex\. Approved for submission by Rene Hernandez\./,
  );
  assert.match(
    gitRules,
    /actual generating harness.*Never claim a different/is,
  );
  assert.match(
    gitRules,
    /implementation.*delivery.*Finish.*does not.*confirmation/is,
  );
  assert.match(gitRules, /approved\s+outline.*unconfirmed draft/is);
  assert.match(gitRules, /command-only.*\/request_review @nitro/is);
  assert.match(gitRules, /distinct\s+service identity/i);
  assert.match(gitRules, /GitHub comment.*Co-Authored by: <harness>/is);
  assert.match(gitRules, /replace `<harness>`.*active agent harness/is);
  assert.match(
    gitRules,
    /commits.*PR\/MR titles or descriptions.*issue\s+bodies/is,
  );
  assert.match(
    gitRules,
    /checkpoint does not apply.*PR\/MR titles or descriptions.*issue\s+bodies/is,
  );

  for (const text of [finish, linearBreakdown, linearis]) {
    assert.match(
      text,
      /rules\/git-and-review\.md#agent-authored-provider-messages/,
    );
  }

  assert.match(finish, /MUST apply/i);
  assert.match(finish, /authority never\s+bypasses/is);
  assert.match(
    finish,
    /comments.*discussion replies.*notes.*issue comments.*project updates/is,
  );
  assert.match(
    finish,
    /checkpoint does not apply.*PR\/MR (?:titles or )?descriptions.*issue\s+bodies/is,
  );
  assert.match(
    changeRequestCreate,
    /PR\/MR titles and descriptions.*do not require.*destination-bound confirmation/is,
  );
  assert.match(
    changeRequestCreate,
    /finalized policy-compliant title and body/,
  );
  assert.doesNotMatch(changeRequestCreate, /approved title and body/i);
  assert.match(
    linearBreakdown,
    /Preview approval does not authorize unseen Linear prose/i,
  );
  assert.match(
    linearis,
    /Human-readable comments, replies, and project\s+updates also require/is,
  );
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
  assert.match(repoAgents, /Fullscript Nitro rule.*canonical/is);
  assert.match(portableAgents, /Nitro.*Fullscript GitLab/is);
  assert.match(portableAgents, /Fullscript Nitro rule.*canonical/is);
  assert.match(
    gitRules,
    /direct user instruction.*project policy.*workflow-policy profile/is,
  );
  assert.match(nitroRules, /Fullscript repositories/);
  assert.match(
    nitroRules,
    /Finish explicitly requests it.*after initial publication and every source-head push.*\/request_review @nitro/is,
  );
  assert.match(nitroRules, /latest-source-head/);
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
  assert.match(nitroRules, /same\s+source head and effective diff/);
  assert.match(nitroRules, /target-only movement/);
  assert.match(nitroRules, /still applies/);
  assert.match(nitroRules, /worth addressing before merge/);
});

test("accepted atomic plans continue through automated draft delivery", () => {
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");

  assert.match(
    portableAgents,
    /Acceptance of a complete atomic plan authorizes its uninterrupted Plan,\s+Execute, Review, and Finish sequence/,
  );
  assert.match(portableAgents, /dedicated\s+draft PR\/MR/);
  assert.match(portableAgents, /no actionable automated feedback remains/);
  assert.match(portableAgents, /does not authorize merge/);
});

test("multi-unit guidance supports parallel owners with ordered ancestry", () => {
  const repoAgents = readFileSync("AGENTS.md", "utf-8");
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");
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
    /each (?:stacked )?descendant.*targets its immediate predecessor/,
  );
  assert.match(gitRules, /Deeper\s+descendants remain untouched/);
  assert.match(gitRules, /exact expected remote-head lease/);

  for (const text of [repoAgents, portableAgents]) {
    assert.match(text, /Execute.*MR-scoped Finish.*concurrently/is);
    assert.match(text, /Finish.*provider-only/is);
  }
  assert.match(implementationRules, /task-wide dispatch barrier/);
  assert.match(
    implementationRules,
    /already in flight.*next safe tool boundary/is,
  );
  assert.match(
    implementationRules,
    /blocker.*does not release.*dispatch barrier/is,
  );
  assert.doesNotMatch(
    implementationRules,
    /persistent (?:publication )?(?:scheduler|ledger|queue)/i,
  );
});

test("OpenSpec guidance challenges delivery-unit cohesion before writing", () => {
  const portableAgents = readFileSync("instructions/AGENTS.md", "utf-8");
  const implementationRules = readFileSync(
    "rules/investigation-and-implementation.md",
    "utf-8",
  );
  const docsRules = readFileSync("rules/docs-and-specs.md", "utf-8");
  const testingRules = readFileSync(
    "rules/testing-and-verification.md",
    "utf-8",
  );
  const planAdapter = readFileSync("skills/plan/agents/openai.yaml", "utf-8");
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
    assert.match(text, /pre-POC topology.*provisional/is);
    assert.match(text, /authoritative final-topology gate/is);
    assert.match(text, /every material POC\s+footprint entry/is);
  }

  assert.match(testingRules, /delivery\s+shape/);
  assert.match(testingRules, /accepted OpenSpec POC/);
  assert.match(testingRules, /every final unit/);
  assert.match(testingRules, /mandatory lifecycle discriminator/);
  assert.match(testingRules, /accepted-footprint fingerprints/);
  assert.match(portableAgents, /pre-POC OpenSpec units as provisional/);
  assert.match(portableAgents, /authoritative final-topology gate/);
  assert.match(portableAgents, /material change is recorded.*unit IDs/is);
  assert.match(planAdapter, /pre-POC units as provisional/);
  assert.match(planAdapter, /every final unit and material footprint entry/);
  assert.match(reviewAdapter, /every phase-specific review type/);
  assert.match(reviewAdapter, /authoritative final-topology gate/);
  assert.match(reviewAdapter, /every final unit and material footprint entry/);
  assert.match(
    readFileSync("skills/review/SKILL.md", "utf-8"),
    /scripts\/validate-planning-review\.ts/,
  );
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
