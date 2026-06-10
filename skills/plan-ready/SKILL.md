---
name: plan-ready
description: Use when an idea, feature request, plan file, OpenSpec change, Linear ticket, or fuzzy implementation goal must become an implementation-ready plan before coding begins.
---

# Plan Ready

## Overview

Turn planning input into a reviewed implementation handoff. This skill owns brainstorming, plan hardening, dispatch review, and final plan scrutiny. It stops before implementation so the user can verify the plan.

## When To Use

Use for ideas, feature requests, implementation plans that still need review, OpenSpec changes before apply, Linear tickets that need implementation planning, or any request that should be validated before `plan-to-pr`.

Do not use for implementation after the handoff is ready. Use `plan-to-pr` for that second phase.

## Progress Output

Announce each helper step before it starts:

- `Using $session-start to inspect live repo and planning-artifact context.`
- `Using $brainstorming to settle scope before plan review.`
- `Using the plan-ready reviewer-selection judge to choose optional reviewer lenses.`
- `Using dispatch to run required plan reviewers.`
- `Using $scrutinize on the final plan before handoff.`

After each gate, report one line with the gate, verdict, artifact, and next action.

## Workflow

1. Run the bundled script `scripts/plan-ready.ts detect <artifact-ref-if-known>` from this skill directory to inspect repo and planning-artifact hints.
2. Use `session-start` to verify live repo, branch, dirty state, and relevant planning files.
3. Clarify scope with `brainstorming` when the request is not already implementation-ready.
4. Create or update the authoritative planning artifact:
   - plan file in the project's established plan location;
   - OpenSpec change through the project's OpenSpec workflow;
   - Linear ticket or linked plan context.
5. Run the bundled script `scripts/plan-ready.ts reviewer-template` and dispatch a reviewer-selection judge using that exact catalog. Validate the judge output with `scripts/plan-ready.ts validate-selection`.
6. Dispatch all baseline reviewers plus judge-selected optional reviewers as subagents.
7. Resolve every blocking finding:
   - `agent_fixable`: update the planning artifact and rerun affected reviewers.
   - `user_decision`: ask one focused question and incorporate the answer.
   - `external_blocker`: record the blocker and do not emit `status: ready` unless the blocker is resolved or the user explicitly accepts the risk.
8. Run `scrutinize` on the final plan. The handoff requires `Scrutinize verdict: ship`.
9. Generate the handoff with `scripts/plan-ready.ts handoff-template`, fill it, and validate it with `validate-handoff`.
10. Stop. Do not invoke `plan-to-pr`, start implementation, create branches, push, open PRs/MRs, or request hosted review.

## Reviewer Selection

Baseline reviewers always run:

- `implementation-readiness`
- `edge-cases-and-risks`
- `simplification-and-scope-control`

The reviewer-selection judge may select optional reviewers only from this catalog:

- `security-and-auth`: auth, authorization, secrets, token handling, sensitive data, webhooks, dependency trust.
- `data-migration-and-backfill`: schema changes, data corrections, reprocessing, idempotency, rollback, irreversible writes.
- `ci-and-release-impact`: CI config, package publishing, deployment, release automation, branch protection, required checks.
- `frontend-ux-accessibility`: UI flows, responsive layout, accessibility, visual verification, interaction states.
- `infra-and-cloud`: Terraform, Kubernetes, Cloudflare, AWS, DNS, queues, storage, environment config.
- `docs-and-agent-alignment`: docs, agent instructions, skill/rule updates, automation prompts, background-review rubrics, PR description expectations.
- `performance-and-scale`: hot paths, concurrency, caching, queues, rate limits, batch behavior, operational limits.
- `agent-runtime-and-skill-compatibility`: Codex/Claude skill structure, `SKILL.md` conventions, `agents/openai.yaml`, install/update paths, bundled scripts, runtime compatibility.

Selection rules:

- Select `docs-and-agent-alignment` for changes to reusable workflows, docs, skills, rules, automation prompts, background review expectations, or PR/MR description contracts.
- Select `agent-runtime-and-skill-compatibility` for changes to skill folder structure, skill metadata, bundled scripts, Codex/Claude adapter files, install/update behavior, or agent runtime behavior.
- Select only from the optional catalog. Do not invent reviewer names.
- Return `baseline_sufficient` only after explaining why no optional catalog reviewer is needed.

The main agent may not remove baseline reviewers or judge-selected reviewers. It may add another optional reviewer only when it records a reason.

## Reviewer Output Contract

Each reviewer must return:

```yaml
reviewer: <name>
verdict: pass | findings | blocked
blocking_findings:
  - title: <short title>
    class: agent_fixable | user_decision | external_blocker
    evidence: <concrete evidence>
    required_change: <change required before readiness>
nonblocking_findings:
  - title: <short title>
    evidence: <concrete evidence>
    suggestion: <optional change>
summary: <one paragraph>
```

Plan readiness requires no unresolved blocking findings.

## Handoff Contract

The final response must include one fenced YAML block:

```yaml
plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: docs/plans/example.md
  approved_slice: "Implement the first reviewed slice."
  required_reviewers:
    - implementation-readiness
    - edge-cases-and-risks
    - simplification-and-scope-control
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
```

Do not write this handoff into committed plan files, OpenSpec files, or Linear comments by default. It is session handoff state, not reviewable product documentation.

## Artifact Modes

| Mode | Requirement |
| --- | --- |
| Plan file | Update the plan file, but keep readiness state out of the file |
| OpenSpec | Use OpenSpec proposal/spec/design/tasks workflow and run `openspec validate <change-id> --strict --no-interactive` |
| Linear | Use the ticket as planning input; do not post the full handoff as a comment unless the user asks |

## Gate Rules

| Gate | Passes when |
| --- | --- |
| Artifact intake | Planning artifact is identified or created |
| Brainstorming | Scope, constraints, and success criteria are clear |
| Reviewer selection | Judge output validates and uses only the fixed optional reviewer catalog |
| Dispatch review | Baseline reviewers and selected optional reviewers return verdicts |
| Feedback resolution | No blocking reviewer findings remain unresolved |
| Plan scrutiny | `scrutinize` verdict is `ship` |
| Handoff validation | `validate-handoff` passes |

## Mistakes

| Mistake | Fix |
| --- | --- |
| Starting implementation after a ready verdict | Stop and ask the user to invoke `plan-to-pr` |
| Treating dispatch review as optional | Always run baseline reviewers |
| Inventing optional reviewer names | Select only from the fixed catalog |
| Skipping `docs-and-agent-alignment` for skill/rule/workflow changes | Add that optional reviewer |
| Skipping `agent-runtime-and-skill-compatibility` for skill metadata, script, or runtime changes | Add that optional reviewer |
| Hiding blocking findings in summary prose | Classify each blocker as `agent_fixable`, `user_decision`, or `external_blocker` |
| Writing readiness YAML into committed artifacts | Emit the handoff in the final session response only |

## Test Evidence

- RED: prior `plan-to-pr` flow mixed brainstorming, plan review, implementation, hosted review, and CI into one workflow.
- GREEN: this skill creates a separate plan-readiness phase with required dispatch review, final scrutiny, and a validated handoff.
- REFACTOR: the skill stops before implementation so the user can verify the ready plan before `plan-to-pr` runs.
- RED/GREEN: pressure testing found optional reviewer selection was too implicit for skill/runtime changes; selection rules and `validate-selection` now require fixed-catalog reviewer output.
