import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

const modes = ["execute", "explore", "finish", "plan", "review"];
const retainedSpecialists = [
  "agent-workspace",
  "ai-readiness-upkeep",
  "ax-cli",
  "code-quality-review",
  "code-simplifier",
  "compound",
  "deslop",
  "diff-review",
  "doc-smith",
  "docs-alignment-review",
  "handoff-brief",
  "linear-breakdown",
  "project-health-brief",
  "research",
  "research-content",
  "research-technical",
  "scrutinize",
  "security-review",
  "writing-skills",
];
const retiredLifecycleSkills = [
  "brainstorming",
  "change-request-create",
  "codex-review-feedback",
  "github-adapter-review",
  "github-pr-create",
  "gitlab-adapter-review",
  "glab-mr-create",
  "merge-followthrough",
  "nitro-review-feedback",
  "openspec-tasks",
  "plan-orchestrator",
  "plan-poc",
  "plan-ready",
  "plan-review",
  "plan-unit-delivery",
  "plan-unit-sequencer",
  "review-feedback-routing",
  "session-start",
  "start-project",
];
const retiredRootHelpers = [
  "nitro-feedback-gate.ts",
  "objective-proof.ts",
  "plan-artifacts.ts",
  "planning-contracts.ts",
  "review-gate.ts",
  "stack-state.ts",
];

test("runtime profiles install only the five modes and retained specialists", () => {
  const config = JSON.parse(
    readFileSync(join(root, "ax.config.json"), "utf8"),
  ) as {
    blocks: { "personal-skills": { skills: Array<{ names: string[] }> } };
    runtime: { hooks: { sourceDir: string } };
  };
  const configuredNames = config.blocks["personal-skills"].skills[0].names;

  assert.deepEqual(
    configuredNames.toSorted(),
    [...modes, ...retainedSpecialists].toSorted(),
  );
  assert.equal(config.runtime.hooks.sourceDir, "hooks");
});

test("review routing is owned by Review and Finish without orphaned policy data", () => {
  assert.equal(existsSync(join(root, "review-routing.yaml")), false);
  const review = readFileSync(join(root, "skills/review/SKILL.md"), "utf8");
  const finish = readFileSync(join(root, "skills/finish/SKILL.md"), "utf8");
  assert.match(
    review,
    /Fullscript GitLab\/Nitro retain their configured policies/,
  );
  assert.match(
    finish,
    /direct user instruction,\nproject policy, workflow-policy profile, remote inference/,
  );
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
