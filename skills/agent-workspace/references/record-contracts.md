# Agent Workspace record contracts

## Linear projection naming

Linear's `RENE-<number>` identifier is an address assigned by the team and is
not the agent's name. Root titles are purpose-first: `Delivery Executive
Assistant`, `Executive Operations Assistant`, `Linear Project Manager —
<Linear project>`, `GitLab Project Manager — <GitLab project>`, or `Squad Lead
— <delivery scope>`. Add a two-digit suffix only to disambiguate concurrent
agents with the same purpose and scope.

Ephemeral Run titles use a monotonic two-digit sequence scoped to their parent
Squad or Workstream: `Implementer 01 — <scope>`, `Reviewer 01 — <review type>`,
`Worker 01 — <task>`, or the corresponding role purpose. Never reuse a Run
sequence. Supporting titles remain purpose-first, such as `<Agent purpose> —
Memory 03` and `<Agent purpose> — <workstream outcome>`. Stable semantic keys
remain in the normalized record body.

Linear receives projections of these records. Cloudflare stores their
authoritative normalized bodies.

## Root Agent Record

Stable identity keyed by portfolio, Linear Project ID, canonical GitLab Project
ID, or Linear Project plus delivery scope. Stores role, reporting line, owned
scope, workspace generation, activation state, current Memory Epoch, prompt
version/hash, model profile, canonical links, and `next_check_at`.

Every Root is Cloudflare-native: `runtime_backend` is `cloudflare-flue-v1`,
`workspace_key` and `runtime_agent_id` identify its Durable Object workspace,
and `codex_task_id` is null. Bootstrap creates only the two executive Roots;
executive results create manager Roots when a real scope needs one.

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

When projecting to Linear, apply record-type, role, attention, and domain labels
explicitly; subissues do not inherit labels.
