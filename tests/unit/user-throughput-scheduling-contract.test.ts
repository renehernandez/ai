import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(path, "utf8").replace(/\s+/g, " ");
}

test("portable instructions make user-visible latency the scheduling priority", () => {
  const instructions = read("instructions/AGENTS.md");

  assert.match(instructions, /minimize user-visible latency/i);
  assert.match(
    instructions,
    /start every safe, authorized, useful independent lane/i,
  );
  assert.match(
    instructions,
    /start it or state the concrete constraint that prevents starting it/i,
  );
  assert.match(
    instructions,
    /investigation-and-implementation\.md#schedule-for-user-throughput/i,
  );
  const priority = instructions.match(
    /## User throughput priority (.*?) Route authority before readiness/i,
  )?.[1];
  assert.ok(priority);
  assert.doesNotMatch(priority, /ordered Git or provider mutation/i);
  assert.doesNotMatch(priority, /unstable exact target/i);
  assert.doesNotMatch(priority, /Coordination or lane setup/i);
});

test("canonical rules own a task-local dependency map and ready queue", () => {
  const rules = read("rules/investigation-and-implementation.md");

  assert.match(rules, /## Schedule for user throughput/);
  assert.match(rules, /task-local dependency map and ready queue/i);
  assert.match(rules, /backfill available capacity/i);
  assert.match(rules, /phase barrier is a join point/i);
  assert.match(rules, /exclusive mutation ownership/i);
  assert.match(rules, /unstable exact target/i);
  assert.match(rules, /not a committed ledger/i);
});

test("startup preflight exposes ready lanes before avoidable waiting", () => {
  const startup = read("rules/session-startup.md");

  assert.match(startup, /identify independent lanes/i);
  assert.match(startup, /concrete dependencies/i);
  assert.match(startup, /available capacity/i);
  assert.match(
    startup,
    /start ready work within current authority immediately/i,
  );
});

test("Explore can parallelize independent read-only evidence without fanout ceremony", () => {
  const brainstorming = readFileSync("skills/brainstorming/SKILL.md", "utf8");
  const normalized = brainstorming.replace(/\s+/g, " ");

  assert.match(brainstorming, /allowed-tools:.*Task/);
  assert.match(normalized, /independent read-only evidence lanes/i);
  assert.match(normalized, /start them together/i);
  assert.match(normalized, /keep a small coherent scan inline/i);
  assert.match(normalized, /Do not combine independent lanes/i);
  assert.match(normalized, /minimal evidence contract/i);
});

test("existing lifecycle owners apply the scheduling contract without a new hierarchy", () => {
  const plan = read("skills/plan/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const review = read("skills/review/SKILL.md");
  const finish = read("skills/finish/SKILL.md");
  const instructions = read("instructions/AGENTS.md");

  assert.match(
    plan,
    /classify each as independent, contract-dependent, or implementation-dependent/i,
  );
  assert.match(execute, /Start independent units immediately/i);
  assert.match(review, /Start independent ready types together/i);
  assert.match(review, /backfill\s+capacity/i);
  assert.match(finish, /both can proceed concurrently/i);
  assert.doesNotMatch(
    [instructions, plan, execute, review, finish].join(" "),
    /Squad Lead|Project Lead|persistent scheduler/i,
  );
});

test("MR visibility preserves concurrent work without speculative restacks", () => {
  const gitRules = read("rules/git-and-review.md");
  const stackSkill = read("skills/glab-stacked-diffs/SKILL.md");
  const stackWorkflow = read(
    "skills/glab-stacked-diffs/references/workflows.md",
  );

  assert.match(gitRules, /Logical dependencies control semantic eligibility/i);
  assert.match(gitRules, /Implement semantically eligible units concurrently/i);
  assert.match(stackSkill, /Sequential initial publication/i);
  assert.match(stackSkill, /Promotion-only restacking/i);
  assert.match(stackWorkflow, /Do not accept an automatic descendant rewrite/i);
  assert.match(stackWorkflow, /Review gates can execute concurrently/i);
});

test("small coherent work avoids parallelization overhead", () => {
  const verification = read("rules/testing-and-verification.md");
  const review = read("skills/review/SKILL.md");

  assert.match(
    verification,
    /One integrated inline pass may cover a small coherent change/i,
  );
  assert.match(
    review,
    /small coherent target may\s+use one integrated inline pass/i,
  );
});
