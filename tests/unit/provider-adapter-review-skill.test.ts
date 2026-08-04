import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const github = readFileSync("skills/github-adapter-review/SKILL.md", "utf8");
const githubThreads = readFileSync(
  "skills/github-adapter-review/references/review-thread-retrieval.md",
  "utf8",
);
const gitlab = readFileSync("skills/gitlab-adapter-review/SKILL.md", "utf8");

test("host adapters remain read-only retrieval specialists", () => {
  for (const skill of [github, gitlab]) {
    assert.ok(skill.trim().split(/\s+/u).length <= 450);
    assert.match(skill, /bounded Review adapter is read-only/i);
    assert.match(skill, /`diff-review` owns findings/i);
    assert.match(skill, /Never post[\s\S]*publish, or merge/i);
    assert.match(skill, /evidenced\s+hosted gap/i);
    assert.match(
      skill,
      /Keep output local unless a separately authorized\s+Finish\s+scope permits a host write/i,
    );
    assert.doesNotMatch(
      skill,
      /^## (?:Common Mistakes|Validation Scenarios|Test Evidence)$/m,
    );
  }
});

test("GitHub retrieval distinguishes comments, threads, checks, and staleness", () => {
  assert.doesNotMatch(github, /originalLine|updatedAt|author \{ login \}/);
  assert.match(github, /paginated REST/i);
  assert.match(github, /GraphQL `pullRequest\.reviewThreads`/);
  assert.match(github, /references\/review-thread-retrieval\.md/);
  for (const field of [
    "isResolved",
    "isOutdated",
    "originalLine",
    "hasNextPage",
    "endCursor",
  ]) {
    assert.match(githubThreads, new RegExp(`\\b${field}\\b`));
  }
  assert.match(githubThreads, /both cursor levels to completion/i);
  assert.match(githubThreads, /PR head OID/i);
  assert.match(github, /Exit code 8 means pending/i);
  assert.match(github, /stale evidence does not prove the latest diff/i);
  assert.match(github, /Codex-authored PR feedback/);
});

test("GitLab retrieval covers exact source, discussions, and pipeline graph", () => {
  assert.match(gitlab, /detached checkout or separate\s+worktree/i);
  assert.match(gitlab, /Include every unresolved thread/i);
  assert.match(gitlab, /MR\/head pipeline/i);
  assert.match(gitlab, /failed\/blocked job traces/i);
  assert.match(gitlab, /child\/downstream state/i);
  assert.match(gitlab, /unrelated branch pipeline/i);
});
