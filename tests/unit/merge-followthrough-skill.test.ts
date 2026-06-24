import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("merge-followthrough frontmatter routes finish and check-only prompts", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /^name: merge-followthrough$/m);
  assert.match(skill, /^description: Use when /m);
  assert.match(skill, /finish a PR or MR/);
  assert.match(skill, /invoke merge-followthrough/);
  assert.match(skill, /inspect status without merging/);
});

test("merge-followthrough defines finish mode for one active PR or MR", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /## Mode Contract/);
  assert.match(
    skill,
    /Default to finish mode for one active PR or MR when the user invokes\n`\$merge-followthrough`/,
  );
  assert.match(
    skill,
    /Finish mode is permission to merge\nor queue after required gates are acceptable/,
  );
});

test("merge-followthrough keeps finish mode after metadata work", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(
    skill,
    /Metadata or review-administration work keeps finish mode/,
  );
  assert.match(skill, /update a PR or MR description, labels, reviewers/);
  assert.match(
    skill,
    /complete the metadata work, then continue\ntoward merge or queue/,
  );
  assert.match(
    skill,
    /Treating metadata plus `\$merge-followthrough` as check-only/,
  );
});

test("merge-followthrough preserves check-only and deployment boundaries", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /Use check-only mode when the user asks to watch/);
  assert.match(
    skill,
    /update\nstatus only, update without merging, see where this is/,
  );
  assert.doesNotMatch(skill, /update\nonly, see where this is/);
  assert.match(
    skill,
    /Check-only wording overrides metadata work if both are present/,
  );
  assert.match(skill, /In\ncheck-only mode, do not merge or queue/);
  assert.match(skill, /Deployment verification is explicit/);
  assert.match(
    skill,
    /Do not require deployment verification as\na default finish gate/,
  );
});

test("merge-followthrough OpenAI prompt names finish mode and explicit stack scope", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(skill, /Stack scope must be explicit/);
  assert.match(
    skill,
    /Ask for clarification before merging or queuing\nmultiple PRs or MRs/,
  );
  assert.match(metadata, /finish mode for one active PR\/MR/);
  assert.match(
    metadata,
    /update requested metadata, watch gates, and merge or queue/,
  );
  assert.match(metadata, /Use check-only mode only when/);
  assert.match(metadata, /check-only wording overrides metadata work/);
  assert.match(
    metadata,
    /Ask for explicit stack scope before merging multiple PRs\/MRs/,
  );
  assert.match(
    metadata,
    /single-artifact finish request does not widen to related PRs\/MRs/,
  );
  assert.match(metadata, /fresh current stack-ready evidence/);
  assert.match(metadata, /hosted IDs, head SHAs, source\/target branches/);
  assert.match(metadata, /refresh downstream items/);
  assert.match(metadata, /target\/base retargeting/);
  assert.match(metadata, /ask for intended order/);
  assert.match(metadata, /not default\/protected/);
  assert.match(metadata, /not checked out in any worktree/);
  assert.match(metadata, /no unmerged\/unpushed commits/);
  assert.match(metadata, /source or target\/base/);
  assert.match(metadata, /Report exact cleanup blockers/);
  assert.match(metadata, /never force-delete/);
});

test("merge-followthrough validates stack evidence before stack merges", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /fresh current stack-ready workflow evidence/);
  assert.match(
    skill,
    /Single-artifact finish mode does not widen to related PRs or MRs/,
  );
  assert.match(skill, /PR or MR ID, head SHA, source branch, target or base/);
  assert.match(skill, /hosted\nsource\/target dependency links/);
  assert.match(skill, /Merge or queue validated\nstacks bottom-to-top/);
  assert.match(
    skill,
    /After each predecessor lands, refresh every downstream\nitem/,
  );
  assert.match(skill, /stop and ask for the intended order/);
});

test("merge-followthrough guards branch cleanup after merge", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");

  assert.match(skill, /Branch cleanup is separate from merge/);
  assert.match(skill, /remote artifact is confirmed merged/);
  assert.match(skill, /source branch is\nnot default or protected/);
  assert.match(skill, /not checked out in any worktree/);
  assert.match(skill, /no unmerged or\nunpushed commits/);
  assert.match(skill, /any open PR or MR as source or\ntarget\/base/);
  assert.match(skill, /Never force-delete as follow-through cleanup/);
});

test("merge-followthrough requires default-branch CI graph completion", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(skill, /Default-branch CI completion is required after merge/);
  assert.match(
    skill,
    /required CI graph for the merged commit or\nresulting default-branch head succeeded/,
  );
  assert.match(skill, /Include child,\nbridge, downstream, or triggered/);
  assert.match(
    skill,
    /including child\/bridge\/downstream\/triggered\n\s+graph components/,
  );
  assert.match(skill, /including child\/bridge\/downstream\/triggered checks/);
  assert.match(
    skill,
    /poll for graph creation once per minute for up to 10 minutes/,
  );
  assert.match(
    skill,
    /report a\nverification gap and do not claim the workflow is fully done/,
  );
  assert.match(
    metadata,
    /verify the required default-branch CI graph for the merged commit or resulting default head succeeded/,
  );
  assert.match(
    metadata,
    /child\/bridge\/downstream\/triggered graph components/,
  );
  assert.match(metadata, /poll once per minute up to 10 minutes/);
  assert.match(metadata, /verification gap instead of done/);
});

test("merge-followthrough stops stack continuation on default-branch CI gaps", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(
    skill,
    /stop before merging or queuing the next item when the\npost-merge default-branch CI graph is failed, blocked, or missing/,
  );
  assert.match(
    skill,
    /Resume stack\nmerges only after the default branch is healthy, any required fix-forward\nartifact has landed cleanly, and the user asks to continue/,
  );
  assert.match(
    metadata,
    /stop before subsequent merges when default-branch CI is failed, blocked, missing, or a fix-forward is required/,
  );
  assert.match(
    metadata,
    /resume only after any fix-forward artifact has landed, the default branch is healthy, and the user asks to continue/,
  );
});

test("merge-followthrough bounds automatic fix-forward creation", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(skill, /Post-merge fix-forward is bounded/);
  assert.match(skill, /branch-caused before merge: fix and continue/);
  assert.match(
    skill,
    /branch-caused after merge on the default branch: use the fix-forward\n\s+boundaries below/,
  );
  assert.match(skill, /automatically investigate only with live evidence/);
  assert.match(
    skill,
    /Create a\nfix-forward PR or MR automatically only when evidence shows the merged branch\ncaused the failure/,
  );
  assert.match(skill, /confidence is strictly greater than 0\.90/);
  assert.match(
    skill,
    /failing default-branch job\/check, why\nthe failure is branch-caused rather than infrastructure or unrelated work/,
  );
  assert.match(skill, /minimal fix, and the local or hosted verification/);
  assert.match(
    metadata,
    /create a fix-forward PR\/MR automatically only when live evidence shows the merged branch caused the failure/,
  );
  assert.match(metadata, /confidence is strictly greater than 0\.90/);
  assert.match(metadata, /failing job\/check/);
  assert.match(
    metadata,
    /branch-cause rationale versus infrastructure\/unrelated work/,
  );
  assert.match(metadata, /minimal fix, and local or hosted verification/);
});

test("merge-followthrough never auto-merges fix-forward artifacts", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(
    skill,
    /Route fix-forward work through the normal hosted-review path/,
  );
  assert.match(skill, /request that reviewer on the\nfix-forward artifact/);
  assert.match(skill, /Never auto-merge a fix-forward PR or MR/);
  assert.match(skill, /acceptable\nto watch fix-forward CI and review state/);
  assert.match(
    metadata,
    /Route fix-forward artifacts through normal hosted review/,
  );
  assert.match(
    metadata,
    /request Nitro or other required reviewers where applicable/,
  );
  assert.match(metadata, /never auto-merge the fix-forward artifact/);
});

test("merge-followthrough reports low-confidence fix-forward instead of creating it", () => {
  const skill = read("skills/merge-followthrough/SKILL.md");
  const metadata = read("skills/merge-followthrough/agents/openai.yaml");

  assert.match(skill, /fix-forward confidence is 0\.90 or lower/);
  assert.match(skill, /do not\ncreate the fix-forward artifact automatically/);
  assert.match(
    skill,
    /Report the diagnosis, likely fix,\nconfidence score, and confidence rationale/,
  );
  assert.match(
    skill,
    /stop\nsubsequent merges while a branch-caused default-branch CI failure or required\nfix-forward exists/,
  );
  assert.match(
    skill,
    /Resume only after the fix-forward artifact has landed, the\ndefault branch is healthy, and the user asks to continue/,
  );
  assert.match(
    metadata,
    /stop before subsequent merges when default-branch CI is failed, blocked, missing, or a fix-forward is required/,
  );
  assert.match(
    metadata,
    /resume only after any fix-forward artifact has landed, the default branch is healthy, and the user asks to continue/,
  );
  assert.match(metadata, /confidence is 0\.90 or lower/);
  assert.match(
    metadata,
    /report diagnosis, likely fix, confidence score, and rationale/,
  );
  assert.match(metadata, /without creating a fix-forward artifact/);
});
