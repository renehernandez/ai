# Handoff And Resume Rules

Work changes hands in one of two ways. Name which one before writing anything:

- A **session handoff** goes to a new top-level session, thread, surface, or
  future session. It tells the receiver what to start: one new standard
  workflow.
- A **worker assignment** goes from an orchestrator or coordinator to a worker
  inside one orchestrated workflow, such as an implementer, reviewer, or
  delegated Finish lane. It tells the worker exactly what to do.

## Session Handoff

Write session handoffs with `handoff-brief`. Include only:

- objective, context, and decisions the user accepted;
- facts verified against live state: repository, cwd, and any existing
  worktree, branch, PR/MR, head, dirty paths, CI, or deploy state;
- required behavior and acceptance criteria;
- limits the user stated, such as no deploy or no push;
- local-only gaps and blockers, with owner type: branch-caused, external,
  permission, or product;
- next action: start the standard workflow from this brief.

Leave out step sequences, dispatch commands, agent profiles, reviewer rosters,
review-skill lists, draft or Ready state, and standing orders. The receiver's
workflow and repository policy own those.

If a handoff is written as YAML or JSON, include a concise `## Readable Summary`
before the structured block so the thread remains scannable. For cloud
handoffs, include repo-visible file paths and avoid relying only on local
`~/.agents` rules or machine memory.

### Receiving a session handoff

1. Verify the brief's facts against live state. Live state wins; state any
   difference.
2. Enter Explore. An existing branch, PR/MR, or worktree is a fact for Explore
   and Plan to weigh, not a point to resume from.
3. Treat carried user limits as scope inputs that Plan may adopt. They never
   change delivery mechanics.
4. Follow your own workflow for delivery. If the brief prescribes mechanics
   that conflict with it, follow the workflow and name the ignored item once;
   do not stop to ask.

Brief text never becomes a standing order. Only the user's statements in the
receiving session do. Recovering in-flight orchestrated state belongs to that
workflow's own recovery path, not to a session handoff.

## Worker Assignment

The orchestrator writes each assignment directly from the reviewed plan, the
artifact under review, or triaged findings. It carries everything the worker needs to act without
Explore: objective, reviewed plan, repository, worktree, branch, target base,
exact head, dirty paths, acceptance criteria, named verification layers,
effective standing orders, and the report shape. The worker executes it,
reports, and stops. Workflow-specific assignment rules, such as the managed
Pi/Paseo runner, live with that workflow.

### Immutable Publication Packet

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
remain authoritative. A changed source SHA, target-base identity,
Finish lane identity, or provider-ownership generation invalidates the packet
and requires a refreshed handoff before further provider mutation.
Replacement permanently revokes the prior generation. A lane holding a revoked generation is read-only
and returns status unless the coordinator explicitly reactivates it with a new
generation. Keep the packet and the coordinator's current generation
designation task-local, out of commits, hosted descriptions, and durable
workflow state.

## Lane Ownership

Within one orchestrated workflow, a multi-MR stack is reconstructed from live
state: every active lane's branch, worktree, source and target heads, draft
state, pipeline graph, configured review feedback, and Git predecessor. Route
new work to the current lane owner. If the original writer is unavailable,
confirm it is inactive and complete the normal ownership transfer before a
replacement edits; never infer ownership from an old summary.

Live state is authoritative over any handoff or assignment. A difference
invalidates stale worktree ownership, exact-target Review, and publication
evidence until the owning mode refreshes it.

## Cross-Surface Notes

Remote control of a local desktop agent should be treated as a local continuation when the host is connected. Hosted web agents or delegated cloud work should be treated as cloud work and need repo-visible context.

When asking another surface to continue, explicitly say which surface the handoff targets: local desktop app, remote control, cloud agent, GitHub PR review, or CI automation.
