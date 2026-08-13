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
  assert.match(finish, /final MR as draft/i);
  assert.match(finish, /Readiness never\s+authorizes marking it ready/i);
  assert.match(finish, /Monitor the newest effective pipeline graph/i);
  assert.match(finish, /every configured reviewer/i);
  assert.match(finish, /Continue until draft technical readiness/i);
  assert.match(finish, /refresh source-head review/i);
  assert.match(finish, /changed target\s+identity requires a fresh checkpoint/);
  assert.match(
    finish,
    /Report `draft_stack_ready`[\s\S]*Every MR remains draft/,
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
  assert.match(
    finish,
    /may not edit files.*change commits[\s\S]*rebase, restack/is,
  );
  assert.match(finish, /mutation\s+ceiling overrides broader task authority/is);
  assert.match(finish, /findings.*current Execute owner/is);
  assert.match(
    finish,
    /active through draft technical\s+readiness[\s\S]*scheduling rule/is,
  );
  assert.match(
    finish,
    /Before each mutation[\s\S]*lane identity.*ownership generation/is,
  );
  assert.match(
    finish,
    /revoked generation becomes\s+read-only and returns status/is,
  );
  assert.match(
    finish,
    /actionable\s+feedback, including findings labeled nonblocking/is,
  );
  assert.match(
    finish,
    /Diagnose failures and return one in-scope repair batch[\s\S]*Execute owner/is,
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

test("GitLab feedback monitoring is serialized and rate-limit aware", () => {
  const implementationRules = read("rules/investigation-and-implementation.md");
  const gitRules = read("rules/git-and-review.md");
  const nitroRules = read("rules/fullscript/nitro-review.md");
  const finish = read("skills/finish/SKILL.md");
  const gitlabReview = read("skills/gitlab-adapter-review/SKILL.md");

  assert.match(gitRules, /exactly one monitor owner per MR/i);
  assert.match(gitRules, /five minutes after the prior snapshot completes/i);
  assert.match(gitRules, /status request.*timestamped.*snapshot/is);
  assert.match(gitRules, /timer or supported wakeup/i);
  assert.match(gitRules, /do not\s+poll.*clock/is);
  assert.match(gitRules, /429.*abort.*remaining.*snapshot/is);
  assert.match(
    gitRules,
    /suspend.*task-local GitLab reads and writes.*host and credential/is,
  );
  assert.match(gitRules, /RateLimit-ResetTime.*RateLimit-Reset.*Retry-After/is);
  assert.match(gitRules, /60-second safety buffer/i);
  assert.match(gitRules, /15 minutes.*30 minutes.*60 minutes/is);
  assert.match(gitRules, /one lightweight MR read.*recovery probe/is);

  assert.match(
    implementationRules,
    /serialize.*GitLab snapshots.*host and credential/is,
  );
  assert.match(
    implementationRules,
    /credential identity is unknown.*same host.*sharing a credential/is,
  );
  assert.match(
    implementationRules,
    /30\s+seconds after one snapshot completes.*different MR's snapshot/is,
  );
  assert.match(
    implementationRules,
    /repository.*non-GitLab work.*remain.*concurrent/is,
  );

  assert.match(finish, /request.*monitor.*GitLab feedback/is);
  assert.match(finish, /one monitor owner/i);
  assert.match(gitlabReview, /does not establish a competing poller/i);
  assert.match(nitroRules, /five-minute.*snapshot cadence/i);
});
