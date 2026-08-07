import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("mode skills coordinate parallel draft stacks through hosted readiness", () => {
  const plan = read("skills/plan/SKILL.md");
  const execute = read("skills/execute/SKILL.md");
  const review = read("skills/review/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  assert.match(
    plan,
    /independent, contract-dependent, or\s+implementation-dependent/,
  );
  assert.match(plan, /branch\/worktree identity/);
  assert.match(execute, /Each unit has\s+one owned branch\/worktree/);
  assert.match(execute, /Start independent units\s+immediately/);
  assert.match(execute, /restack only its immediate child/);
  assert.match(execute, /refresh that child's gates/);
  assert.match(review, /complete response/);
  assert.match(
    review,
    /Read the complete response and every unresolved Nitro-authored discussion/,
  );
  assert.match(finish, /Create every final MR as draft/);
  assert.match(
    finish,
    /technical\s+readiness never authorize changing it from draft to ready/,
  );
  assert.match(finish, /Do not stop at publication/);
  assert.match(finish, /green parent pipeline/);
  assert.match(finish, /repeat without another user prompt/);
  assert.match(finish, /Before publication and every hosted-review request/);
  assert.match(finish, /changed\s+target identity requires a fresh checkpoint/);
  assert.match(
    finish,
    /Report `draft_stack_ready` while every MR\s+remains draft/,
  );
});

test("hook-clean multi-MR units dispatch provider-only Finish subagents", () => {
  const implementationRules = read("rules/investigation-and-implementation.md");
  const gitRules = read("rules/git-and-review.md");
  const handoffRules = read("rules/handoff-and-resume.md");
  const execute = read("skills/execute/SKILL.md");
  const finish = read("skills/finish/SKILL.md");

  assert.match(implementationRules, /publication-ready/);
  assert.match(implementationRules, /task-wide dispatch barrier/);
  assert.match(
    implementationRules,
    /before any agent\s+begins\s+another repository mutation/i,
  );
  assert.match(
    implementationRules,
    /already in flight.*next safe tool boundary/is,
  );
  assert.match(
    implementationRules,
    /blocker.*does not release.*dispatch barrier/is,
  );
  assert.match(
    implementationRules,
    /task-wide hold is intentional.*publication correctness.*progressive MR visibility.*temporary\s+throughput/is,
  );
  assert.doesNotMatch(
    implementationRules,
    /publication-ready` when publication\s+authority, provider routing, credentials/is,
  );
  assert.doesNotMatch(
    implementationRules,
    /until the lane starts or the unit is no longer publication-ready/is,
  );
  assert.match(
    implementationRules,
    /only explicit\s+withdrawal or supersession.*release.*without.*lane/is,
  );
  assert.match(
    implementationRules,
    /signals every active Execute\s+owner.*acknowledges.*paused/is,
  );
  assert.match(implementationRules, /free.*worker slot.*Finish subagent/is);
  assert.match(
    implementationRules,
    /successful.*start.*signals.*Execute owners.*resume/is,
  );
  assert.match(
    implementationRules,
    /multi-(?:unit|MR).*small coherent.*exception/is,
  );
  assert.match(
    implementationRules,
    /one MR per unit is an artifact boundary, not a user approval checkpoint/is,
  );
  assert.match(
    implementationRules,
    /do not wait for.*(?:continue|review|approval).*between.*units/is,
  );
  assert.match(execute, /Do not invent a user pause/);
  assert.match(execute, /MR-scoped, provider-only Finish lane/);
  assert.match(execute, /shared scheduling\s+barrier/);
  assert.match(execute, /Immutable Publication Packet/);
  assert.doesNotMatch(
    execute,
    /when publication authority, provider routing, credentials/is,
  );
  assert.doesNotMatch(execute, /target branch and expected target identity/is);

  assert.match(finish, /provider-only delegated lane/);
  assert.match(finish, /Immutable Publication Packet/);
  assert.doesNotMatch(finish, /target branch and expected target identity/is);
  assert.match(finish, /may not edit.*commit.*rebase.*restack/is);
  assert.match(finish, /mutation ceiling.*broader.*terminal\s+authority/is);
  assert.match(finish, /findings.*current Execute owner/is);
  assert.match(
    finish,
    /remain active.*draft technical\s+readiness.*canonical\s+scheduling rule/is,
  );
  assert.match(
    finish,
    /before every provider mutation.*lane identity.*ownership generation/is,
  );
  assert.match(finish, /lane holding.*revoked.*read-only.*returns status/is);
  assert.match(
    finish,
    /actionable.*require no user decision.*automatic repair.*Nitro.*nonblocking/is,
  );
  assert.match(
    finish,
    /pipeline failure.*current Execute owner.*without.*user prompt/is,
  );
  assert.match(
    implementationRules,
    /Finish lane.*remain active.*technical\s+readiness/is,
  );
  assert.match(
    implementationRules,
    /confirm.*prior.*inactive.*exactly one.*provider owner/is,
  );
  assert.match(
    gitRules,
    /descendant Finish lane may start.*provider mutation waits/is,
  );
  assert.match(
    gitRules,
    /source HEAD or resolved target-base SHA.*invalidates.*packet/is,
  );
  assert.match(handoffRules, /immutable publication packet/);
  assert.match(handoffRules, /unit and current Execute owner/);
  assert.match(
    handoffRules,
    /Finish lane identity.*provider-ownership generation/is,
  );
  assert.match(
    handoffRules,
    /changed.*lane identity.*provider-ownership generation.*invalidates/is,
  );
  assert.match(handoffRules, /target branch and expected target-base identity/);
  assert.match(handoffRules, /draft title and incremental scope/);
  assert.match(handoffRules, /issue relationship or completion semantics/);
  assert.match(handoffRules, /mutation ceiling/);
});
