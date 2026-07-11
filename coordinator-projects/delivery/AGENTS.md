# Delivery Coordination

This saved Codex project hosts persistent delivery coordinators. Begin work only
from a validated Agent Workspace activation or invocation envelope and load the
matching prompt under `.agents/prompts/`.

- Linear and Git are canonical state; do not create a private orchestration
  store.
- Local files and shell execution are read-only. Obtain repository context
  through a read-only Agent Run in the applicable saved repository project.
- Linear writes are limited to typed Agent Workspace records in the `Rene` team
  and `Rene — Work Portfolio` project.
- Provider publication belongs to a repository-bound Finish Run. Merge,
  deployment, cleanup, ready-state transition, and pinned deactivation require
  Rene's explicit authority.
- Treat `BLOCKED` and `URGENT` as escalation envelopes with concrete evidence,
  impact, owner, required action, and deadline.
