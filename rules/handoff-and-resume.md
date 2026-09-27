# Handoff And Resume Rules

Work changes hands in one of two ways. Name which one applies before writing
anything, then use its owner:

| Handoff | Goes to | Owner |
| --- | --- | --- |
| Session handoff | A new top-level session, thread, surface, or future session that starts its own standard workflow | `session-handoff` |
| Worker assignment | An implementer, reviewer, or delegated Finish lane inside one orchestrated workflow | `worker-handoff` |

A session handoff never prescribes the receiver's delivery mechanics, and its
text never becomes a standing order. A worker assignment is complete and exact;
the worker executes, reports, and stops.

## Live State

Live state is authoritative over any handoff or assignment. A difference
invalidates stale worktree ownership, exact-target Review, and publication
evidence until the owning mode refreshes it.

Within one orchestrated workflow, a multi-MR stack is reconstructed from live
state: every active lane's branch, worktree, source and target heads, draft
state, pipeline graph, configured review feedback, and Git predecessor. Route
new work to the current lane owner. If the original writer is unavailable,
confirm it is inactive and complete the normal ownership transfer before a
replacement edits; never infer ownership from an old summary.

## Cross-Surface Notes

Remote control of a local desktop agent should be treated as a local continuation when the host is connected. Hosted web agents or delegated cloud work should be treated as cloud work and need repo-visible context.

When asking another surface to continue, explicitly say which surface the handoff targets: local desktop app, remote control, cloud agent, GitHub PR review, or CI automation.
