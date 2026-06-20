---
name: gitlab-adapter-review
description: Use when reviewing GitLab merge requests, MR diffs, GitLab discussions, GitLab CI state, or when the user asks for glab-review or GitLab review feedback.
allowed-tools: Bash(glab:*), Bash(git:*), Bash(jq:*), Read, Glob, Grep, AskUserQuestion
---

# GitLab Adapter Review

Use GitLab as the artifact-host adapter, then apply `diff-review` to the verified MR diff. Keep review output in the conversation unless the user explicitly asks to post, approve, merge, or resolve anything.

## When to Use

- The user asks to review a GitLab merge request or MR URL.
- The current branch has an open GitLab MR.
- `plan-unit-delivery` or `plan-review` detects a GitLab remote and needs the hosted review gate.
- The user says `glab-review`; treat that as the legacy name for this skill.

Use `diff-review` directly for local-only diffs. Use `github-adapter-review` for GitHub PRs.

## Adapter Workflow

1. Resolve the MR:
   ```bash
   glab mr list --source-branch "<current-branch>"
   glab mr view "<iid-or-branch>" --output json
   glab repo view --json fullPath
   glab api "projects/<url-encoded-project>/merge_requests/<iid>"
   ```
   If an MR URL was provided, extract the IID from `/merge_requests/<iid>`.

2. Capture artifact-host context:
   - MR IID and URL
   - title, description, author, labels
   - source and target branches
   - latest source/head commit when available
   - unresolved discussions and review comments
   - stale or resolved thread position context when available
   - pipeline/check state and links
   - child or downstream pipeline state when available

3. Checkout or verify the source branch before reading files:
   ```bash
   git status --short --branch
   git worktree list
   git fetch origin "<source-branch>"
   git switch --detach "origin/<source-branch>"
   ```
   Preserve dirty user work; stop before checkout if the working tree is not clean. Use a detached checkout or separate worktree when reviewing a hosted MR so local branch state is not mutated.

4. Get the verified diff:
   ```bash
   glab mr diff "<iid>" --color=never
   glab api "projects/<url-encoded-project>/merge_requests/<iid>/changes"
   ```
   Build the changed-file list from host diff plus local checkout.

5. Fetch discussions:
   ```bash
   glab mr view "<iid>" --comments --unresolved
   ```
   Use `glab api` when detailed thread metadata is needed:
   ```bash
   glab api "projects/<url-encoded-project>/merge_requests/<iid>/discussions?per_page=100"
   ```
   Include unresolved discussions. If stale or resolved threads may affect review readiness, inspect thread positions and report whether they are still relevant, stale, or unverifiable; do not resolve or dismiss threads unless the user explicitly asks for host writes.

6. Fetch CI/pipeline state. This is required for every MR review, even when the review task is framed as a code review:
   ```bash
   glab ci status
   glab ci list
   glab ci get
   ```
   Also fetch MR metadata when needed and use `head_pipeline.id`, `head_pipeline.status`, `head_pipeline.sha`, and `head_pipeline.ref` as the preferred MR pipeline coordinates:
   ```bash
   glab api "projects/<url-encoded-project>/merge_requests/<iid>"
   ```
   If the host CLI cannot identify the MR pipeline, use the MR pipeline API:
   ```bash
   glab api "projects/<url-encoded-project>/merge_requests/<iid>/pipelines?per_page=20"
   glab api "projects/<url-encoded-project>/pipelines/<pipeline-id>/jobs?per_page=100"
   glab api "projects/<url-encoded-project>/jobs/<job-id>/trace"
   glab api "projects/<url-encoded-project>/pipelines/<pipeline-id>/bridges?per_page=100"
   ```
   For failing or blocked pipelines, list failing/blocked jobs and fetch traces when access allows. Check bridge/downstream pipeline state when the project uses child or multi-project pipelines; if bridge details are unavailable, report downstream state as `unknown` or `uncertain` with evidence. If neither CLI nor API access can identify the MR pipeline, report checks as `unknown` with the command output or host-context gap. Do not rely on `pipeline-failure-analyzer` as a separate later step unless it is explicitly invoked and its result is included in this adapter output.

7. Apply `diff-review`:
   - review only issues introduced or materially worsened by the MR diff;
   - read full changed files and relevant usages/tests;
   - include unresolved GitLab discussions as artifact-host context;
   - include GitLab CI/pipeline state as artifact-host context;
   - run `docs-alignment-review` when behavior, workflow, architecture, tests, CI, deployment, auth, data contracts, or agent expectations changed.

## Output Contract

Return this shape so `plan-unit-delivery` or `plan-review` can consume the gate consistently:

```markdown
artifact_host: GitLab
artifact: !<iid> <url>
worktree_guard: <branch, dirty state, worktree placement, checkout safety>
mr_metadata: <title, author, source/target, labels, linked issues, diff refs, head_pipeline>
base_head: <target>@<sha-or-unknown>...<source>@<sha-or-unknown>
diff_scope: <changed files, count, change categories, diff source>
unresolved_discussions: <none | every unresolved thread with author, file/line, summary, blocker status>
stale_resolved_threads: <not applicable | stale/incorrectly resolved concerns checked | unknown>
ci_state: <green | failing | pending | unknown, MR/head pipeline id/status/SHA, command/API evidence>
failed_jobs: <none | names/ids/stages/URLs | unknown>
failing_job_traces_collected: <yes | not needed | unavailable | not run, with evidence>
child_downstream_pipeline_state: <checked green | checked failing | checked pending | absent | unknown, with reason>
docs_alignment_state: <aligned | missing | stale | not applicable | not run>
test_coverage_state: <covered | partially covered | missing | not applicable | not assessed>
verification_performed: <exact commands/API checks/read checks performed>
verification_gaps: <none | list, including child/downstream uncertainty>
findings: <diff-review findings or no issues>
merge_readiness: <ready | blocked | not ready | unknown, with reasons>
```

## Quick Reference

| Need | Command |
| --- | --- |
| Find MR from branch | `glab mr list --source-branch "<branch>"` |
| View MR | `glab mr view "<iid-or-branch>" --output json` |
| Project path | `glab repo view --json fullPath` |
| MR metadata/API | `glab api "projects/<project>/merge_requests/<iid>"` |
| View unresolved comments | `glab mr view "<iid>" --comments --unresolved` |
| Discussion metadata | `glab api "projects/<project>/merge_requests/<iid>/discussions?per_page=100"` |
| Diff | `glab mr diff "<iid>" --color=never` |
| Changed files | `glab api "projects/<project>/merge_requests/<iid>/changes"` |
| CI state | `glab ci status`, `glab ci list`, then `glab ci get` |
| MR pipeline API | `glab api "projects/<project>/merge_requests/<iid>/pipelines?per_page=20"` |
| Pipeline jobs | `glab api "projects/<project>/pipelines/<pipeline-id>/jobs?per_page=100"` |
| Failed job trace | `glab api "projects/<project>/jobs/<job-id>/trace"` |
| Child/downstream pipelines | `glab api "projects/<project>/pipelines/<pipeline-id>/bridges?per_page=100"` |
| Checkout source | `git fetch origin "<branch>"` then `git switch --detach "origin/<branch>"` |

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Treating GitLab mechanics as review judgment | Use GitLab only to gather host context; apply `diff-review` for findings |
| Reviewing stale local code | Verify source branch and host diff before reading files |
| Ignoring unresolved discussions | Include them in the output contract and never call the MR ready while they remain |
| Leaving check state implicit | Fetch GitLab CI state or mark checks `unknown` with evidence |
| Missing downstream pipeline failures | Query pipeline bridges or report child/downstream pipeline state as unknown |
| Calling a failing pipeline reviewed without traces | Fetch failing/blocked job traces when access allows, or report the trace gap |
| Assuming another skill will analyze CI | Collect pipeline state and trace evidence in this adapter output, or explicitly mark the gap |
| Posting comments by default | Keep output local unless the user explicitly asks for a host write |
| Using GitHub commands for GitLab | Use `glab` and GitLab MR terminology |

## Validation Scenarios

- GitLab MR with unresolved discussions and stale resolved threads: pass only if unresolved discussions are surfaced and stale-thread resolution is not performed without explicit user approval.
- GitLab MR with pending or failing CI: pass only if CI state is fetched or checks are marked `unknown` with evidence.
- Clean GitLab MR review: pass only if residual host-context gaps and docs alignment state are still named.

## Test Evidence

- RED: sub-agent `019eae14-4b9c-7b52-9c89-0834a8a3110b` gathered MR metadata, versions, diffs, discussions, notes, MR pipelines, pipeline jobs, and failing traces, while naming child/downstream pipelines, stale thread position context, large diffs, linked issues, and local execution as residual unknowns.
- GREEN attempt: sub-agent `019eae16-70a7-7783-a64c-3323926b1e58` found a loophole: checkout guards, failing traces, child/downstream pipeline uncertainty, stale-thread audit, docs state, and verification gaps were not explicit enough.
- GREEN retest: sub-agent `019eae18-1a4f-7dc0-bc51-3e2ca42f9495` found the same loophole persisted because the output contract did not force dirty-worktree guard, MR pipeline id, failed traces, downstream uncertainty, docs/test state, verification performed, and merge readiness fields.
- GREEN retest: sub-agent `019eae19-9333-7aa0-bf8f-cc39785c2ee1` still found the contract too easy to satisfy without hard keyed fields for worktree guard, MR metadata, diff scope, CI state, child/downstream state, docs/test state, verification, and merge readiness.
- GREEN: sub-agent `019eae1a-f361-7ef1-a740-02be95f46a43` passed after the keyed output contract forced worktree guard, MR/head pipeline metadata, failed traces, child/downstream state, docs/test state, verification gaps, findings, and merge readiness.
- REFACTOR: adapter output contract keeps artifact-host context separate from `diff-review` findings so `plan-unit-delivery` can consume the gate.
- REFACTOR: the output contract now uses explicit keyed fields for worktree guard, MR metadata, diff scope, unresolved discussions, stale resolved threads, CI state, failed jobs, failing traces, child/downstream pipelines, docs alignment, test coverage, verification performed, verification gaps, findings, and merge readiness.
