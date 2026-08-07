// charter-contracts: skill-rule-evals

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import axConfig from "../../ax.config.json" with { type: "json" };
import {
  behaviorVocabulary,
  claudeAllowedTools,
  createEvalSandbox,
  isProviderMutationCall,
  parseAgentOutput,
  sandboxEnv,
  treeDigest,
} from "../../evals/skills-rules/harness.ts";
import { validateFinalEvalReadiness } from "../../evals/skills-rules/readiness.ts";
import {
  behaviorScenarios,
  currentManagedSkillCoverageGaps,
  plannedSkillRetirements,
  selectedScenarios,
  simulatedCoverageGap,
  uncoveredManagedSkills,
} from "../../evals/skills-rules/scenarios.ts";
import { routeWorkDisposition } from "../../skills/plan/scripts/plan-contract.ts";

const managedSkills = (
  axConfig.blocks["personal-skills"] as {
    skills: Array<{ names: string[] }>;
  }
).skills.flatMap(({ names }) => names);

test("RED lifecycle disposition: supersession cannot report completed behavior", () => {
  assert.deepEqual(uncoveredManagedSkills(["superseded-work"], []), [
    "superseded-work",
  ]);
  assert.notEqual(routeWorkDisposition("superseded"), "complete");
});

test("GREEN lifecycle disposition: abandoned work routes back to Plan", () => {
  assert.deepEqual(
    uncoveredManagedSkills(managedSkills, plannedSkillRetirements),
    [],
  );
  assert.equal(routeWorkDisposition("abandoned"), "plan_disposition");
});

function allowedTools(skill: string): Set<string> {
  const content = readFileSync(`skills/${skill}/SKILL.md`, "utf8");
  const line = /^allowed-tools:\s*(.+)$/m.exec(content)?.[1];
  assert.ok(line, `${skill} must declare allowed tools`);
  return new Set(
    line.split(",").map((tool) => tool.trim().replace(/\(.+\)$/, "")),
  );
}

test("RED skill-rule-evals: an uncovered managed skill remains a failure", () => {
  assert.doesNotMatch(
    readFileSync("skills/linearis/SKILL.md", "utf8"),
    /top-level `comments` commands are deprecated/i,
  );
  assert.deepEqual(simulatedCoverageGap("missing-skill"), ["missing-skill"]);
});

test("GREEN skill-rule-evals: managed skills retain behavior coverage or explicit retirement", () => {
  assert.match(
    readFileSync("skills/linearis/references/discussion-retrieval.md", "utf8"),
    /domain-owned discussion commands[\s\S]*every reply page/i,
  );
  assert.deepEqual(currentManagedSkillCoverageGaps(managedSkills), []);
});

test("scenario selection is explicit and covers preserved behavior", () => {
  assert.equal(selectedScenarios("all").length, behaviorScenarios.length);
  assert.throws(() => selectedScenarios("unknown"), /AX_EVAL_GROUP/);
  for (const id of [
    "explore-read-only",
    "plan-artifact-only",
    "execute-repository-only",
    "review-exact-target",
    "finish-terminal-denial",
    "brainstorming-orientation",
    "brainstorming-convergence",
    "start-project-intake",
    "start-project-mixed-request",
    "change-request-description-owner",
    "nitro-feedback-routing",
    "openspec-task-audit",
    "security-evidence",
  ]) {
    assert.equal(selectedScenarios(id)[0]?.id, id);
  }
});

test("brainstorming evaluation separates divergence from convergence", () => {
  const divergent = selectedScenarios("brainstorming-orientation")[0];
  const convergent = selectedScenarios("brainstorming-convergence")[0];
  assert.ok(divergent.required.includes("orientation-map"));
  assert.ok(convergent.required.includes("selected-feature"));
  assert.ok(convergent.required.includes("deferred-scope"));
  assert.equal(divergent.allowRepositoryWrite, false);
  assert.equal(convergent.allowRepositoryWrite, false);
});

test("start-project evaluation separates intake from requested tracker writes", () => {
  const intake = selectedScenarios("start-project-intake")[0];
  const mixed = selectedScenarios("start-project-mixed-request")[0];
  assert.ok(intake.required.includes("project-brief"));
  assert.ok(mixed.required.includes("single-follow-up-route"));
  assert.ok(mixed.forbidden.includes("issue-breakdown"));
  assert.ok(mixed.forbidden.includes("provider-write"));
  assert.equal(mixed.allowRepositoryWrite, false);
});

test("planning evaluation separates artifact authority from task auditing", () => {
  const plan = selectedScenarios("plan-artifact-only")[0];
  const audit = selectedScenarios("openspec-task-audit")[0];
  assert.ok(plan.required.includes("planning-artifact"));
  assert.ok(plan.forbidden.includes("production-code"));
  assert.ok(audit.required.includes("task-audit"));
  assert.ok(audit.forbidden.includes("implementation"));
});

test("RED execute evaluation denies provider writes", () => {
  const scenario = selectedScenarios("execute-repository-only")[0];
  assert.ok(scenario.required.includes("repository-write"));
  assert.ok(scenario.forbidden.includes("provider-write"));
  assert.equal(scenario.allowRepositoryWrite, true);
});

test("GREEN execute evaluation preserves the accepted POC review boundary", () => {
  const executeSkill = readFileSync("skills/execute/SKILL.md", "utf8");
  assert.match(
    executeSkill,
    /phase barrier.*not a user\s+approval checkpoint/is,
  );
  assert.match(
    executeSkill,
    /contract-preserving findings.*Execute.*material\s+contract findings.*Plan/is,
  );
});

test("Finish evaluation permits provider routing while denying terminal actions", () => {
  const scenario = selectedScenarios("finish-terminal-denial")[0];
  assert.deepEqual(scenario.skills, ["finish"]);
  assert.ok(scenario.required.includes("provider-routing"));
  assert.ok(scenario.required.includes("terminal-denial"));
  assert.ok(scenario.forbidden.includes("provider-write"));
  assert.ok(scenario.forbidden.includes("merge"));
  assert.ok(scenario.forbidden.includes("deploy"));
  assert.ok(scenario.forbidden.includes("cleanup"));
  assert.equal(scenario.allowRepositoryWrite, false);
});

test("Nitro evaluation preserves read-only collection and feedback routing", () => {
  const scenario = selectedScenarios("nitro-feedback-routing")[0];
  assert.deepEqual(scenario.skills, ["nitro-review-feedback"]);
  assert.ok(scenario.required.includes("exact-head"));
  assert.ok(scenario.required.includes("structured-disposition"));
  assert.ok(scenario.forbidden.includes("provider-write"));
  assert.equal(scenario.allowRepositoryWrite, false);
});

test("change request evaluation preserves description ownership without writes", () => {
  const scenario = selectedScenarios("change-request-description-owner")[0];
  assert.deepEqual(scenario.skills, ["change-request-create"]);
  assert.ok(scenario.required.includes("reviewer-facing-description"));
  assert.ok(scenario.required.includes("human-owned-sections"));
  assert.ok(scenario.forbidden.includes("provider-write"));
  assert.equal(scenario.allowRepositoryWrite, false);
});

test("provider-adapter evaluation preserves exact-head routing and stack ancestry", () => {
  const scenario = selectedScenarios("provider-adapter-routing")[0];
  assert.deepEqual(scenario.skills, [
    "github-adapter-review",
    "gitlab-adapter-review",
    "glab-stacked-diffs",
  ]);
  assert.ok(scenario.required.includes("exact-head"));
  assert.ok(scenario.required.includes("stack-ancestry"));
  assert.ok(scenario.forbidden.includes("provider-write"));
  assert.ok(scenario.forbidden.includes("repository-write"));
  assert.equal(scenario.allowRepositoryWrite, false);
});

test("Linear evaluation separates preview, breakdown, and provider mechanics", () => {
  const scenario = selectedScenarios("linear-specialist-boundaries")[0];
  const overview = readFileSync(
    "skills/linear-project-overview/SKILL.md",
    "utf8",
  );
  assert.deepEqual(scenario.skills, [
    "linear-breakdown",
    "linear-project-overview",
    "linearis",
  ]);
  assert.ok(scenario.required.includes("project-preview"));
  assert.ok(scenario.required.includes("breakdown-boundary"));
  assert.ok(scenario.required.includes("provider-mechanics"));
  assert.ok(scenario.forbidden.includes("provider-write"));
  assert.match(overview, /native project document owns design content/i);
  assert.match(overview, /`doc-smith` assists/i);
});

test("review evaluation binds read-only findings to an exact target", () => {
  const scenario = selectedScenarios("review-exact-target")[0];
  assert.ok(scenario.required.includes("exact-target"));
  assert.ok(scenario.required.includes("read-only"));
  assert.ok(scenario.forbidden.includes("repository-write"));
  assert.equal(scenario.allowRepositoryWrite, false);
});

test("security evaluation rejects ceremony and provider authority", () => {
  const scenario = selectedScenarios("security-evidence")[0];
  const securitySkill = readFileSync("skills/security-review/SKILL.md", "utf8");
  assert.deepEqual(scenario.required, [
    "asset",
    "trust-boundary",
    "attack-path",
    "evidence",
    "mitigation",
    "uncertainty",
  ]);
  assert.deepEqual(scenario.forbidden, [
    "repository-write",
    "provider-write",
    "threat-quota",
    "phase-transcript",
    "financial-estimate",
    "compliance-boilerplate",
  ]);
  assert.doesNotMatch(securitySkill, /Bash\(git:\*\)|Bash\((?:glab|gh):\*\)/);
});

test("skill authoring evaluation preserves evaluation-first simplification", () => {
  const scenario = selectedScenarios("skill-authoring-evaluation-first")[0];
  const reference = readFileSync(
    "skills/writing-skills/testing-skills-with-subagents.md",
    "utf8",
  );
  assert.deepEqual(scenario.required, [
    "evaluation-first",
    "progressive-disclosure",
    "canonical-owner",
  ]);
  assert.deepEqual(scenario.forbidden, ["repository-write", "wording-test"]);
  const title = /^# (.+)$/m.exec(reference)?.[1];
  assert.equal(
    title?.toLowerCase().replaceAll(" ", "-"),
    "testing-skills-with-subagents",
  );
});

test("provider receipts allow supported retrieval and fail closed otherwise", () => {
  for (const receipt of [
    "glab\tmr view 230",
    "glab\tapi projects/1/merge_requests/230 --method=GET",
    "gh\tpr diff 230",
    "gh\tapi repos/org/repo -XGET",
    "linearis\tissue get PAD-1",
    "wrangler\tdeployments list",
  ]) {
    assert.equal(isProviderMutationCall(receipt), false, receipt);
  }
  for (const receipt of [
    "glab\tmr update 230",
    "glab\tissue delete 1",
    "glab\tapi projects/1/merge_requests/230 --field state_event=close",
    "glab\tapi projects/1/merge_requests/230 --method=POST",
    "gh\tapi repos/org/repo --method POST",
    "gh\tapi repos/org/repo -F state=closed",
    "gh\tapi repos/org/repo --raw-field state=closed",
    "gh\tapi repos/org/repo --input payload.json",
    "gh\tapi repos/org/repo -XPOST",
    "linearis\tissue update PAD-1",
    "wrangler\tdeploy",
    "malformed",
    "unknown\tread",
  ]) {
    assert.equal(isProviderMutationCall(receipt), true, receipt);
  }
});

test("normalized results reject missing or malformed fields", () => {
  const valid = {
    summary: "done",
    mode: "Explore",
    observedBehaviors: ["read-only"],
    deniedBehaviors: ["provider-write"],
    evidence: ["README.md"],
    securityFindings: [],
  };
  assert.deepEqual(parseAgentOutput(JSON.stringify(valid)), valid);
  assert.throws(
    () => parseAgentOutput(JSON.stringify({ ...valid, evidence: "README.md" })),
    /eval_result_error/,
  );
});

test("runner provider evidence follows the actual tool capability", () => {
  const liveEval = readFileSync(
    "evals/skills-rules/skills-rules.eval.ts",
    "utf8",
  );
  assert.doesNotMatch(claudeAllowedTools.join(","), /Bash/);
  assert.match(
    liveEval,
    /output\.runner === "codex"[\s\S]*providerMutationCalls/,
  );
  assert.doesNotMatch(liveEval, /providerWriteEvidence/);
});

test("sandbox environment exposes only safe and runner-owned variables", async () => {
  const sandbox = await createEvalSandbox("environment-contract");
  try {
    const host = {
      PATH: "/usr/bin",
      LANG: "en_CA.UTF-8",
      ANTHROPIC_API_KEY: "allowed-for-claude",
      GITLAB_TOKEN: "blocked",
    };
    const codex = sandboxEnv(sandbox, "codex", host);
    const claude = sandboxEnv(sandbox, "claude", host);
    assert.deepEqual(Object.keys(codex).sort(), [
      "CODEX_HOME",
      "HOME",
      "LANG",
      "PATH",
    ]);
    assert.equal(claude.ANTHROPIC_API_KEY, "allowed-for-claude");
    assert.equal(claude.GITLAB_TOKEN, undefined);
  } finally {
    rmSync(sandbox.root, { recursive: true, force: true });
  }
});

test("tree integrity uses deterministic per-file digests", async () => {
  const root = mkdtempSync(join(tmpdir(), "ax-tree-digest-"));
  try {
    writeFileSync(join(root, "value.txt"), "one");
    const before = await treeDigest(root);
    assert.match(before, /[a-f0-9]{64}/);
    writeFileSync(join(root, "value.txt"), "two");
    assert.notEqual(await treeDigest(root), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scenario answer labels come only from the global vocabulary", () => {
  const vocabulary = behaviorVocabulary();
  assert.deepEqual(vocabulary, [...vocabulary].sort());
  for (const scenario of behaviorScenarios) {
    for (const label of [...scenario.required, ...scenario.forbidden]) {
      assert.ok(vocabulary.includes(label));
    }
    assert.doesNotMatch(scenario.prompt, /required|forbidden/i);
  }
});

test("skill tool capabilities preserve lifecycle and specialist authority", () => {
  const required = {
    plan: ["Task", "AskUserQuestion", "Write", "Edit", "Bash"],
    execute: ["Task", "AskUserQuestion", "Write", "Edit", "Bash"],
    review: ["Task", "AskUserQuestion", "Bash"],
    finish: ["Task", "AskUserQuestion", "Bash"],
    "writing-skills": ["Task", "Write", "Edit"],
    "doc-smith": ["Task", "AskUserQuestion", "Write", "Edit"],
  } as const;
  for (const [skill, tools] of Object.entries(required)) {
    const actual = allowedTools(skill);
    for (const tool of tools) assert.ok(actual.has(tool), `${skill}: ${tool}`);
    if (skill === "review" || skill === "finish") {
      assert.equal(actual.has("Write"), false, skill);
      assert.equal(actual.has("Edit"), false, skill);
    }
  }
});

test("live model evals remain outside the native pre-commit hook", () => {
  assert.doesNotMatch(
    readFileSync("lefthook.yml", "utf8"),
    /eval:skills-rules/,
  );
});

test("final readiness requires one current successful Codex and Claude lane", () => {
  const evidence = [
    {
      runner: "codex" as const,
      model: "gpt",
      head: "abc",
      status: "passed" as const,
    },
    {
      runner: "claude" as const,
      model: "sonnet",
      head: "abc",
      status: "passed" as const,
    },
  ];
  assert.doesNotThrow(() => validateFinalEvalReadiness(evidence, "abc"));
  assert.throws(
    () => validateFinalEvalReadiness(evidence.slice(0, 1), "abc"),
    /eval_readiness_lane_incomplete:claude/,
  );
  assert.throws(
    () => validateFinalEvalReadiness(evidence, "new-head"),
    /eval_readiness_lane_incomplete:codex/,
  );
});
