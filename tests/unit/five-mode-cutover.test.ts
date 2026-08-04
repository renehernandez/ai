import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const modes = ["execute", "explore", "finish", "plan", "review"];
const restoredSpecialists = [
  "brainstorming",
  "change-request-create",
  "github-adapter-review",
  "gitlab-adapter-review",
  "nitro-review-feedback",
  "openspec-tasks",
  "start-project",
];
const retainedSpecialists = [
  "ai-readiness-upkeep",
  "ax-cli",
  "brainstorming",
  "change-request-create",
  "code-quality-review",
  "code-simplifier",
  "deslop",
  "diff-review",
  "doc-smith",
  "docs-alignment-review",
  "explain-diff-html",
  "github-adapter-review",
  "gitlab-adapter-review",
  "glab-stacked-diffs",
  "handoff-brief",
  "linear-breakdown",
  "linear-project-overview",
  "linearis",
  "nitro-review-feedback",
  "openspec-tasks",
  "project-health-brief",
  "research",
  "research-content",
  "research-technical",
  "scrutinize",
  "security-review",
  "start-project",
  "writing-skills",
];
const retiredLifecycleSkills = [
  "codex-review-feedback",
  "github-pr-create",
  "glab-mr-create",
  "merge-followthrough",
  "plan-orchestrator",
  "plan-poc",
  "plan-ready",
  "plan-review",
  "plan-unit-delivery",
  "plan-unit-sequencer",
  "review-feedback-routing",
  "session-start",
];
const retiredRootHelpers = [
  "nitro-feedback-gate.ts",
  "objective-proof.ts",
  "plan-artifacts.ts",
  "planning-contracts.ts",
  "review-gate.ts",
  "stack-state.ts",
];

test("runtime profiles install five modes and bounded retained specialists", () => {
  const config = JSON.parse(
    readFileSync(join(root, "ax.config.json"), "utf8"),
  ) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
    runtime: { hooks: { sourceDir: string }; retiredSkills: string[] };
  };
  const configuredNames = config.blocks["personal-skills"].skills[0].names;

  assert.deepEqual(
    configuredNames.toSorted(),
    [...modes, ...retainedSpecialists].toSorted(),
  );
  assert.equal(config.runtime.hooks.sourceDir, "hooks");
  assert.ok(config.runtime.retiredSkills.includes("agent-workspace"));
  assert.ok(config.runtime.retiredSkills.includes("compound"));
  assert.equal(
    existsSync(join(root, "skills", "agent-workspace", "SKILL.md")),
    false,
  );
  assert.equal(configuredNames.includes("compound"), false);
});

test("review routing is owned by Review and Finish without orphaned policy data", () => {
  assert.equal(existsSync(join(root, "review-routing.yaml")), false);
  const review = readFileSync(join(root, "skills/review/SKILL.md"), "utf8");
  const finish = readFileSync(join(root, "skills/finish/SKILL.md"), "utf8");
  assert.match(review, /github-adapter-review/);
  assert.match(review, /gitlab-adapter-review/);
  assert.match(review, /nitro-review-feedback[^\n]*when policy selects Nitro/);
  assert.match(
    finish,
    /direct user instruction,\nproject policy, workflow-policy profile, remote inference/,
  );
});

test("restored specialists declare one five-mode owner without expanding authority", () => {
  const owners: Record<string, string> = {
    brainstorming: "Explore",
    "start-project": "Explore",
    "openspec-tasks": "Plan",
    "github-adapter-review": "Review",
    "gitlab-adapter-review": "Review",
    "nitro-review-feedback": "Review",
    "change-request-create": "Finish",
  };

  for (const [name, owner] of Object.entries(owners)) {
    const skill = readFileSync(join(root, "skills", name, "SKILL.md"), "utf8");
    assert.match(
      skill,
      new RegExp(`bounded ${owner} (?:specialist|provider adapter|adapter)`),
      name,
    );
  }

  const codex = join(root, "skills", "codex-review-feedback");
  assert.equal(existsSync(codex), false);
});

test("retired lifecycle packages and root workflow state are absent", () => {
  for (const name of modes) {
    assert.equal(
      existsSync(join(root, "skills", name, "SKILL.md")),
      true,
      name,
    );
    assert.equal(
      existsSync(join(root, "skills", name, "agents", "openai.yaml")),
      true,
      `${name} OpenAI metadata`,
    );
  }
  for (const name of retiredLifecycleSkills) {
    assert.equal(existsSync(join(root, "skills", name)), false, name);
  }
  for (const name of retainedSpecialists) {
    assert.equal(
      existsSync(join(root, "skills", name, "SKILL.md")),
      true,
      name,
    );
  }
  for (const name of restoredSpecialists) {
    assert.equal(
      existsSync(join(root, "skills", name, "agents", "openai.yaml")),
      true,
      `${name} OpenAI metadata`,
    );
  }
  for (const name of retiredRootHelpers) {
    assert.equal(existsSync(join(root, "scripts", name)), false, name);
  }
  assert.equal(existsSync(join(root, "ax.lock.json")), false);
});

test("tracked plan artifacts are primary Markdown only", () => {
  const plansRoot = join(root, ".agents", "plans");
  if (!existsSync(plansRoot)) {
    return;
  }
  const invalid = readdirSync(plansRoot, { recursive: true })
    .filter((entry) => typeof entry === "string")
    .filter((entry) => !entry.endsWith(".md"));
  assert.deepEqual(invalid, []);
});
