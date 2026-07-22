# Handoff And Resume Rules

Use these rules when work may continue in another thread, another agent surface, a remote-control client, a cloud agent, or a future session.

## Handoff Brief

If a handoff is written as YAML or JSON, include a concise `## Readable Summary`
before the structured block so the thread remains scannable.

When handing off non-trivial work, include:

- objective and current decision;
- current mode and mutation authority;
- repository, cwd, branch, and PR number if any;
- write owner, current worktree state, exact HEAD, changed/untracked paths, and
  diff fingerprint;
- files changed or docs written;
- verification already run, using exact test layer names such as unit, component, worker-runtime, database integration, local browser E2E, deployed-preview E2E, or deployment verification;
- CI, review, merge, or deploy state if relevant;
- blockers and whether they are branch-caused, external, permission-related, or product decisions;
- the next concrete command or action.

For cloud handoffs, include repo-visible file paths and avoid relying only on local `~/.agents` rules or machine memory.

## Immutable Publication Packet

When a frozen MR unit becomes publication-ready, the coordinator gives its
provider-only Finish subagent one task-local immutable publication packet with:

- unit and current Execute owner;
- Finish lane identity and monotonically increasing provider-ownership
  generation;
- provider route;
- source branch and exact source SHA;
- target branch and expected target-base identity;
- draft title and incremental scope;
- issue relationship or completion semantics;
- configured reviewer policy; and
- the delegated lane's explicit mutation ceiling.

The packet transfers no repository-write ownership. Live Git and provider state
remain authoritative. A changed source SHA, target-base identity, Finish lane
identity, or provider-ownership generation invalidates the packet and requires a
refreshed handoff before further provider mutation. Replacement permanently
revokes the prior generation. A lane holding a revoked generation is read-only
and returns status unless the coordinator explicitly reactivates it with a new
generation. Keep the packet and the coordinator's current generation
designation task-local, out of commits, hosted descriptions, and durable
workflow state.

## Resume Pass

When resuming from a handoff, do not restart discovery from scratch. First verify the handoff against live state:

1. Confirm cwd, branch, worktree, and uncommitted changes.
2. Confirm PR/MR, CI, review, and terminal state through the selected provider
   CLI when relevant.
3. Re-read only the rule files and changed files needed for the next action.
4. Continue from the next concrete action unless live state contradicts the handoff.

For a multi-MR stack, verify every active lane's branch, worktree, source and
target heads, draft state, pipeline graph, configured review feedback, and Git
predecessor before resuming. Route new work to the current lane owner. If the
original writer is unavailable, confirm it is inactive and complete the normal
ownership handoff before a replacement edits; never infer ownership from an old
summary.

If live state differs from the handoff, state the difference and use live state
as authoritative. Invalidate stale worktree ownership, exact-target Review, and
publication evidence before continuing.

## Cross-Surface Notes

Remote control of a local desktop agent should be treated as a local continuation when the host is connected. Hosted web agents or delegated cloud work should be treated as cloud work and need repo-visible context.

When asking another surface to continue, explicitly say which surface the handoff targets: local desktop app, remote control, cloud agent, GitHub PR review, or CI automation.
