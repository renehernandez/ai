# Agent workspaces

Agent workspaces provide Rene with a durable delegation hierarchy without a
dedicated orchestration service. Linear owns coordination records, Git owns
commit history, GitLab owns hosted MRs, CI, discussions, and approvals, and
pinned Codex tasks provide the conversational surface for persistent agents.
Persistent means event-driven with durable identity; it does not mean a model
process runs continuously.

This guide is for Rene and operators who already have authenticated Linear,
GitLab, and Codex Desktop access. Use it to understand and invoke the system.
Use the linked schemas, templates, and skill when implementing or debugging the
protocol.

## Organization

```mermaid
flowchart TD
  Rene --> DeliveryEA["Delivery Executive Assistant"]
  Rene --> OperationsEA["Executive Operations Assistant"]
  DeliveryEA --> LPM["Linear Project Manager\nOne per Linear Project"]
  DeliveryEA --> GPM["GitLab Project Manager\nOne per GitLab Project"]
  LPM --> Squad["Squad Lead\nOne delivery scope"]
  GPM -. repository context .-> Squad
  Squad --> Implementer["Implementer Runs"]
  Squad --> Reviewer["Reviewer Runs"]
  Squad --> Researcher["Researcher Runs"]
  OperationsEA --> Operations["Operations Specialist Runs"]
```

The two executive assistants are Rene's normal entrypoints:

- The Delivery Executive Assistant coordinates the software-delivery
  portfolio, resolves cross-project priority, and routes work to managers.
- The Executive Operations Assistant tracks calendar, email, Slack, and
  follow-up commitments. It reads and drafts; Rene authorizes every external
  mutation or send.

A Linear Project Manager owns one Linear Project outcome, including milestones,
delivery scopes, and cross-repository dependency eligibility. A GitLab Project
Manager owns repository policy, coherence, and live GitLab context for one
GitLab Project. A Squad Lead owns implementation and delivery decisions for one
scope and consults each affected GitLab Project Manager for repository-specific
constraints.

The two executive assistants, both manager types, and Squad Leads are pinned:
each keeps one persistent Codex task. Implementers, reviewers,
researchers, and operations specialists are ephemeral Agent Runs. A Squad Lead
may end when its delivery scope closes even though it can remain active for
months.

## Durable state

Every pinned workspace uses schema-defined Linear record conventions. These are
ordinary Linear issues and sub-issues created from tracked templates with
explicit record, role, domain, and attention labels; they are not native Linear
issue types.

| Record | Purpose |
| --- | --- |
| Root Agent Record | Stable identity, scope, task ID, generation, activation state, and prompt fingerprint |
| Current Memory Epoch | Current compact memory with links to canonical evidence |
| Workstream | One active, blocked, waiting, complete, or canceled delivery scope |
| Agent Run | One ephemeral delegation, created before the agent is spawned |
| Decision | A requested or completed decision with a fingerprint and reference to authenticated approval evidence when required |
| Escalation | Blocked, urgent, or waiting-on-Rene attention with impact and next action |

An agent can use more than one issue. Use the Root as the stable index, roll
memory into numbered epochs, and create Workstream, Run, Decision, and
Escalation sub-issues as needed. Do not copy full email, Slack, attachment, or
restricted-source bodies into Linear. Store redacted summaries, identifiers,
decisions, and evidence links.

Before dispatch, the Agent Workspace serializer validates each record against
the generated schemas and role-policy projection. For `restricted` records, it
sends only opaque identity, state, timestamps, authorized source links, and an
explicit redaction notice. Free-text fields do not enter dynamic agent context.

Root points to exactly one Current Memory Epoch. Older epochs remain linked as
immutable history. A Workstream is the durable record for one delivery scope;
its Agent Runs are bounded attempts within that scope. A mutable Decision body
never makes approval immutable. Store the exact action fingerprint and a
reference to authenticated, time-bounded approval captured by the active
provider policy.

## Invoke an agent

In Codex Desktop, open the pinned Delivery Executive Assistant or Executive
Operations Assistant task and send a normal message. From another local task,
invoke the `agent-workspace` skill with `open` plus the role and scope; it finds
the Root Agent Record and navigates to the exact task ID. A missing or duplicate
Root/task identity blocks navigation.

Talk to the Delivery Executive Assistant for normal delivery work. Typical
requests are:

```text
Start the Linear Project <project name>.
Start planning <feature> in <Linear Project>.
What should I work on next across active delivery work?
Ask the GitLab Project Manager for <repository> to assess this dependency.
Open the Squad Lead for <delivery scope>.
```

Talk to the Executive Operations Assistant for operational coordination:

```text
Review today's commitments and draft the follow-ups I owe.
Prepare a proposed calendar change for my approval.
Find the Slack and email threads that need a response.
```

Use the Delivery Executive Assistant as the default route to another delivery
agent. Direct contact remains available through `agent-workspace open`. Direct
messages still use the same correlated invocation envelope and reporting line.
The envelope carries a message and correlation ID so retries remain one logical
assignment.

## Activate a pinned workspace

Ask an active Delivery Executive Assistant to activate a manager or invoke the
`agent-workspace` skill from a local Codex task. The skill performs the provider
writes; these are not manual API steps.

Activation is idempotent. The stable key is the canonical Linear Project ID,
canonical GitLab
Project ID, or Linear Project plus delivery-scope key.

1. Search for an existing Root Agent Record with the stable key.
2. Create the Root in `reserved` and create its Current Memory Epoch.
3. Persist `task_pending` with the role, stable key, nonce, scope, reporting
   line, generation, contract version, and prompt hash. Supply that immutable
   tuple as the initial `pre_create` task-creation prompt. The new task must
   reply `PENDING_CONTEXT`.
4. Persist and read back the returned Codex task ID.
5. Send the complete `post_create` context as the first follow-up.
6. Persist the task's attestation, pin the task, and mark the Root `active`.

If task creation succeeds but persisting its ID fails, preserve the task and
Root in `task_pending`. Recovery lists Codex tasks and reads their initial
creation prompts. Adopt exactly one task only when trusted creation provenance
and the complete tuple match the Root. Zero, multiple, or mismatched candidates
block recovery. Never create a replacement to hide a partial transition.

## Delegate implementation

Create an Agent Run in `reserved` before spawning any ephemeral agent. Include
the objective, lifecycle mode, authority, canonical sources, acceptance,
verification, stop condition, escalation route, model profile, workspace
generation, and next check time.

For parallel delivery, the Squad Lead records one total Git predecessor order,
semantic eligibility, integration hotspots, and one writer per worktree. It may
run independent implementation units concurrently. A separate reviewer Run
inspects each exact artifact; the writer never reviews its own artifact. Every
head or target-base change invalidates prior review evidence.

Finish may publish technically ready draft MRs and follow CI and hosted review
when repository policy allows it. Green CI, approval, urgency, or the word
`proceed` never grants merge authority. Rene must merge or explicitly grant
merge authority for the exact action.

## Models and reasoning

Route each new delegation independently and start with the lowest adequate
profile. Pinned agents also re-evaluate their profile when the task shape or
risk changes:

| Work | Default | Automatic escalation |
| --- | --- | --- |
| Pinned delivery coordination | Sol, medium | Sol high, then xhigh |
| Routine operations coordination | Terra, low | Sol medium, then high |
| Implementation | Terra, low | Escalate from evidence and risk |
| Standard review | Sol, low | Sol high for high-risk review |
| Bounded research | Luna, medium | Sol medium when synthesis requires it |

Sol, Terra, and Luna are model-family aliases defined by the tracked manifest;
low through xhigh are reasoning levels. Max and Ultra are manual-only. Never
inherit an escalated profile into a later Run without new evidence.

## Escalation and wakeups

Use `BLOCKED` when progress needs authority, information, ownership,
credentials, or a material decision. Use `URGENT` only when delay has a concrete
delivery, operational, security, or customer cost. Include impact, evidence,
attempted mitigation, required action, owner, and deadline.

Pinned agents checkpoint concise state and set an RFC 3339 `next_check_at`; they
do not busy-poll. In the initial runtime, that value records the requested
wakeup for the coordinating task or user; it is not an autonomous scheduler.
An automation may later consume it, but activation must not assume one exists.
Completion closes the Workstream that represents a delivery scope. It does not
archive the pinned workspace. Deactivation and archival require Rene or an
exact active lifecycle policy.

## Contract vocabulary

| Term | Meaning |
| --- | --- |
| Workspace generation | Monotonic fencing value; stale generations may report but cannot mutate |
| Prompt fingerprint | SHA-256 of the rendered static role contract |
| Activation nonce | Retry correlation value, not authentication |
| Attestation | Persisted ACK of role, scope, reporting line, prompt, tools, and generation |
| Canonical source | Authoritative Linear, Git, GitLab, or operations record linked by ID |
| Exact artifact | Source HEAD plus resolved target-base identity reviewed together |
| Git predecessor order | Total order of related changes within a repository; it does not create ancestry across repositories |
| Semantic eligibility | Whether a unit can start based on accepted contracts and dependencies |
| Integration hotspot | File, API, schema, or behavior where parallel units may conflict |

The public lifecycle modes are Explore, Plan, Execute, Review, and Finish.
Finish owns permitted provider publication and follow-through; it does not imply
merge.

## See also

- [AX CLI](ax.md)
- [Agent manifest](../agents/manifest.json)
- [Activation schema](../agents/schemas/activation-context.schema.json)
- [Invocation envelope schema](../agents/schemas/invocation-envelope.schema.json)
- [Workspace record schema](../agents/schemas/workspace-record.schema.json)
- [Linear record templates](../agents/templates/linear/root-agent-record.md)
- [Five-mode repository instructions](../AGENTS.md)
- [Agent workspace skill](../skills/agent-workspace/SKILL.md)
