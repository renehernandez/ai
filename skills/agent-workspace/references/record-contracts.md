# Agent Workspace record contracts

## Root Agent Record

Stable identity keyed by Linear Project ID, canonical GitLab Project ID, or
Linear Project plus delivery scope. Stores role, reporting line, owned scope,
workspace generation, activation state, task ID, current Memory Epoch, prompt
version/hash, model profile, canonical links, and `next_check_at`.

Before task creation, `task_pending` stores an immutable creation tuple:
canonical role ID, stable agent key, activation nonce, owned scope, reporting
line, workspace generation, prompt contract version, and rendered prompt hash.
Canonicalize the tuple with the prompt-contract helper and embed the same value
in the task title and initial activation context. Codex task listing plus
initial-task readback is the recovery source when the create response cannot be
persisted. No matching task, multiple matches, or missing provenance blocks
adoption.

## Current Memory Epoch

Stores the current charter summary, durable decisions, constraints, active
Workstreams, and prior-epoch link. Roll on material charter/prompt/lifecycle
change or configured operational threshold. Keep old epochs immutable history.

## Workstream

Stores outcome, owner, status, scope, acceptance, dependencies, risks,
canonical links, next action, and `next_check_at`. Prefer flat children of Root;
relate Agent Runs to their Workstream.

## Agent Run

Key by invocation ID. State transitions are `reserved`, `spawned`, `active`,
then `complete`, `canceled`, or `failed`. A recoverable spawn attempt increments
`attempt` while the Run remains `reserved`; `failed` is terminal. Store workspace generation, role
variant, model routing reason, authority, sources, worktree/HEAD, acceptance,
verification, and handoff.

## Decision and Escalation

Decision records contain question, evidence, owner, status, and any immutable
authenticated approval provenance. Mutable text never grants authority.

Escalations classify `blocked`, `urgent`, or `waiting_on_rene` and include
impact, evidence, attempted mitigation, required action, owner, deadline, and
next check.

Apply record-type, role, attention, and domain labels explicitly; subissues do
not inherit labels.
