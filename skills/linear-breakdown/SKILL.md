---
name: linear-breakdown
description: Use when collaboratively turning plans, OpenSpec changes, specs, design docs, or implementation proposals into Linear issues, milestones, projects, or delivery slices.
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# Linear Breakdown

## Overview

Turn planning artifacts into Linear-ready delivery slices with the user. Treat ticket breakdown as product/design work, not a mechanical copy from a plan. Bias toward the earliest real end-to-end outcome, then harden and expand after that outcome exists.

## When To Use

Use for OpenSpec-to-Linear breakdowns, plan-to-ticket conversion, milestone shaping, project issue sequencing, or when a user asks to create Linear issues from a spec/design.

Do not use for implementation planning inside one already-written ticket; use `plan` for that.

## Core Rule

Do not create or update Linear issues until the user has reviewed the proposed breakdown.

The only exception is an explicit bypass confirmation that includes both ideas:

1. skip the breakdown review/preview/walkthrough
2. write/create/update the Linear issues now

Phrases like "create the tickets," "move fast," "use your judgment," "don't walk me through it," or "we can fix titles later" do not include both ideas. They are not bypass approval.

If pressured to skip review, the correct action is to present the concise preview and ask one approval question. Do not infer permission.

Read-only discovery is allowed before approval: inspect existing Linear projects, milestones, issues, labels, and duplicates when tools are available. Discovery never permits writes. If matching issues already exist, preview the update/reuse plan and ask before editing them.

## Workflow

1. Read the source artifact and summarize:
   - target outcome
   - first observable end-to-end proof
   - existing systems to reuse
   - constraints and non-goals
   - hardening or future scope

2. Present 2-3 delivery arcs. Lead with the recommended arc.

```
**Recommended Arc: E2E First**
- First outcome:
- What it reuses:
- What it defers:
- Why this order:
- Risk:
```

3. Walk the user through slices in small groups:
   - first outcome ticket
   - diagnosability and artifacts
   - trust, safety, and operational hardening
   - required gates or rollout
   - expansion scenarios or future integrations
   - docs and operator polish

Ask after each group whether the boundary feels right.

4. Suggest milestones only when useful. Do not force them.

5. Show a final preview before writing to Linear.

```yaml
linear_breakdown_preview:
  status: awaiting_approval
  source_artifact: <path, URL, issue key, or description>
  milestone_recommendation: suggested | not_suggested
  first_observable_outcome: <short outcome>
  issue_count: <number>
  creation_mode: draft_only | create_after_approval | create_immediately
```

6. Create or update Linear only after approval, then summarize issue keys, milestone link, ordering, and deferred work.

## Approval Modes

| Mode | When to use | Linear writes |
| --- | --- | --- |
| `draft_only` | User asks to brainstorm or propose tickets | No |
| `create_after_approval` | Default for all breakdown work | Only after preview approval |
| `create_immediately` | User explicitly says to skip review/preview and write now | Yes |

Read-only dedupe is compatible with every mode. Creating, updating, linking, moving, labeling, or commenting on issues is a write and follows the approval mode.

## Slicing Bias

Default order:

1. Prove the real path works once.
2. Make failures diagnosable.
3. Make the path trustworthy and safe.
4. Make it required, deployed, or operationally enforced.
5. Add more scenarios, users, surfaces, or integrations.
6. Polish docs, runbooks, ownership, and cleanup.

The first issue should usually answer: "What is the thinnest ticket that proves the desired behavior through the real path?"

Foundation work may appear in the first issue only when directly needed for that first proof. Do not create early issues for unused frameworks, generic registries, all adapters, full schemas, or future integrations.

## Issue Shape

Use outcome-centered titles:

- Good: `Prove refund status sync through the real webhook path`
- Good: `Make failed import retries visible to operators`
- Avoid: `Add webhook adapter package`
- Avoid: `Create adapter registry`

Issue template:

```markdown
## Goal

## Outcome Slice

## Scope

## Acceptance Criteria

## Verification

## Out of Scope

## Dependencies

## References
```

For hardening tickets, `Outcome Slice` should still name the operational value, such as "Failures are bounded and diagnosable under real provider API behavior."

## Evidence Contracts

For any issue that claims hosted, CI, deploy, integration, webhook, agent, automation, migration, data-sync, or external-system behavior, include the evidence that proves the claimed behavior happened.

A green generic pipeline, passing local test suite, merged config file, or implemented code path is not proof of a claimed external behavior unless that is the actual outcome slice.

Add this section when the issue needs proof beyond code existence:

```markdown
## Proof Required Before MR Ready

The implementation MR is not ready until it includes direct evidence that this issue's claimed behavior ran in the target environment or system.

Required proof:

- Parent MR, deploy, pipeline, workflow, job, or run link.
- Specific job, child pipeline, environment, external-system event, webhook delivery, automation run, data change, or generated artifact that proves the new path executed.
- Evidence artifact, summary note, log excerpt, dashboard/query link, external-system link, or before/after state showing the expected result.
- Explicit pass/fail result for the outcome slice.
- If the path is absent, skipped, disabled by rules/config/env, or only present in code/config, the issue is incomplete.
```

Keep the proof contract proportional. A narrow UI copy issue does not need a hosted evidence bundle. A ticket that says "runs in CI," "posts to another system," "syncs data," "blocks release," "migrates records," or "verifies an integration" needs concrete proof.

## Activation And Identity Contracts

When a slice depends on runtime activation, name the activation condition explicitly:

- feature flag, environment variable, CI rule, cron, queue, webhook, deploy target, migration gate, or third-party config
- whether the path may be advisory/non-blocking
- what counts as incomplete if the path is disabled, skipped, or absent

When a slice crosses systems, name identifier representations that must match across producer, transport, consumer, tests, and proof evidence:

- path vs numeric ID
- public key vs internal database ID
- MR/PR number vs database ID
- tenant/account/user identifier
- run ID, nonce, scenario ID, batch ID, migration version, or deployed SHA

If the breakdown cannot name the activation condition or cross-boundary identity contract, either add a discovery ticket before the implementation slice or narrow the first issue until the contract is knowable.

## Milestones

Suggest a milestone when 3+ issues form a coherent delivery arc, release phase, integration milestone, or externally visible capability.

Do not suggest a milestone for one or two issues, unrelated backlog work, exploratory cleanup, or when the project already has a better grouping mechanism.

Milestone template:

```markdown
## Milestone Goal

## Delivery Principle

## Included Issues

## Explicitly Deferred

## Completion Signal
```

## Split And Merge Heuristics

Split when acceptance criteria describe different outcomes, ownership differs, review paths differ, or one part can ship without the other.

Merge when a ticket only creates unused foundation, two tiny tasks have identical verification, or the split hides the first observable outcome.

Distinguish delivery order from blocking dependency. Do not over-link dependencies when the order is advisory.

## Self-Review Before Preview

Before showing the final preview, check:

- Does the first issue deliver an observable outcome?
- Are foundation tasks tied to that first outcome?
- Did we reuse existing systems before proposing new ones?
- Are hardening and expansion separated from the first proof?
- Are milestones suggested only when useful?
- Does every issue include acceptance criteria and verification?
- Does every issue claiming hosted/system behavior include direct proof required before MR ready?
- Are activation conditions named, including what happens if the path is disabled or skipped?
- Are cross-boundary identifiers represented consistently across producer, consumer, tests, and evidence?
- Are future integrations shaping names without bloating v1?

If the first 1-2 issues do not produce a real outcome, rewrite the breakdown.

## Pressure Rules

When speed pressure conflicts with collaboration, collaboration wins. A ticket breakdown encodes product judgment, ownership, delivery order, and scope cuts.

Do not satisfy a "just create the tickets" request by producing a foundation-first list. Respond with a concise preview and one approval question:

> "I can create these after you approve the breakdown. First, here is the E2E-first slice I recommend..."

If the user rejects the walkthrough again, ask one focused confirmation: "Do you want me to skip breakdown review and write these to Linear now?" Only a yes to that exact bypass concept permits immediate writes.

Under pressure, do not start with:

- configuration schema
- adapter registry
- shared artifact format
- all-provider drivers
- auth hardening
- docs

Start with the real outcome ticket, then place only the minimum foundation inside that ticket.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Copying OpenSpec sections directly into issues | Reshape by delivered outcome |
| Creating Linear immediately because the user says "move fast" | Preview first unless the user explicitly says to skip review and write now |
| Treating "create the tickets" as approval to skip collaboration | Ask for approval on the proposed breakdown before Linear writes |
| Treating a dedupe/readback pass as permission to write | Use readback to improve the preview, then ask before creating or updating |
| Starting with scaffolding, registry, or schema tickets | Put only first-proof foundation into the first outcome ticket |
| Packing all security hardening into the first ticket | Keep minimum meaningful trust in the first proof; harden later |
| Creating tickets for future Slack/Linear/etc. integrations too early | Capture deferred work or a tracking note unless the milestone includes them |
| Treating milestones as mandatory | Suggest only when the work forms a coherent arc |
| Treating generic green CI as proof for hosted/system behavior | Require evidence that the specific claimed path ran and produced the expected result |
| Letting disabled flags, rules, or env hide the path | State whether disabled/skipped/absent means incomplete or blocked |
| Leaving cross-system identifiers implicit | Name the canonical identifier representation in the ticket |

## Test Evidence

- RED: baseline subagent `019eb4c7-16eb-7d21-8cbc-27666434979d` created Linear immediately, started with package scaffolding, added HMAC before the first proof, and delayed the self-repo scenario until issue 7.
- RED: baseline subagent `019eb4c7-2beb-7a00-83b3-8120d26034b3` skipped interactive review and created config, adapter registry, artifact format, auth, Slack, and Linear driver tickets before the E2E scenario.
- RED: baseline subagent `019eb4c7-49fe-70b3-8d59-9645565db978` selected an E2E-first direction but still split the first proof across many layer tickets and treated a milestone as the default.
- REFACTOR: subagent `019eb4c9-ac24-76c0-b4d5-dd7edb0c45cb` still treated "just create the tickets" as approval to bypass review, so the core rule now requires an explicit confirmation that includes both skipping review/preview and writing to Linear now.
- REFACTOR: subagent `019eb4cb-3041-7711-8a6d-00d2f0e52784` treated read-only dedupe as permission to write immediately, so discovery is now explicitly read-only and does not bypass preview approval.
- GREEN: subagent `019eb4ca-72f3-73f3-b9c2-9ec01f64c888` refused to create issues from "just create the tickets," proposed an E2E-first sequence, emitted `creation_mode: create_after_approval`, and asked for approval.
- GREEN: subagent `019eb4cc-a401-7f30-82f8-9d88c49d03d3` kept dedupe read-only, previewed update/reuse actions for existing stale Linear artifacts, and asked for approval before writes.
