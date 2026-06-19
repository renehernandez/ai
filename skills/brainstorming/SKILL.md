---
name: brainstorming
description: Use when brainstorming, designing features, exploring requirements, thinking through problems, shaping plans, or turning rough ideas into implementation-ready designs.
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# Brainstorming Ideas Into Designs

Help turn ideas into designs through a skimmable first pass, explicit defaults,
and selective drilldown. The default posture is: map first, drill second.

## Default Flow

1. **Inspect context first.** Read relevant files, docs, recent plans, glossary
   files, and code before asking questions the project can answer.
2. **Open with an orientation map.** Show the full decision shape up front:
   objective, domain terms, approach options, recommended defaults, discussion
   queue, and likely capture artifact.
3. **Keep the discussion queue short.** Pick 1-3 high-leverage decisions to
   discuss. Put the rest under recommended defaults or parking lot.
4. **Drill one item at a time.** Ask one question at a time only for items in
   the discussion queue. Everything else proceeds with the recommended default
   unless the user objects.
5. **Converge into an implementation-ready shape.** Summarize the objective,
   selected feature, shipped context, implementation slices, recommended first
   slice, deferred work, domain terms, and artifact routing.

Treat agreement such as "agreed", "sounds good", or "yes" as accepting the
current recommendation set. Move to the next unresolved discussion item instead
of re-litigating accepted defaults.

## Orientation Map

The first substantive brainstorming response should be compact and scannable.
Use this structure unless the user asks for a different format:

```markdown
**Orientation Map**
| Area | Recommended default | Why | Discuss? |
|---|---|---|---|
| Objective | ... | ... | Yes/No |
| Domain terms | ... | ... | Yes/No |
| Approach | ... | ... | Yes/No |
| First slice | ... | ... | Yes/No |
| Capture | ... | ... | Yes/No |

**Discussion Queue**
1. [Decision that needs user judgment]
2. [Decision that changes scope, safety, architecture, or visible behavior]

**Defaultable**
- [Decision]: [recommended default unless the user objects]

**First question**
[Ask only the highest-leverage unresolved question.]
```

Keep the first question tied to the discussion queue. Do not ask about mechanics
that can be inferred later, such as task-audit workflow details.

## Domain Terms

Always include a lightweight domain-terms pass. Identify 2-5 terms that could
be fuzzy, overloaded, or inconsistent with the repo's language. Compare the
user's wording against `CONTEXT.md`, glossary files, existing docs, or code when
available.

For each term, either:
- propose a canonical meaning,
- flag why it needs discussion, or
- say it appears unambiguous and can use the repo's existing meaning.

Use concrete scenarios sparingly when a boundary is unclear. One good edge case
is better than a chain of abstract questions.

`CONTEXT.md` and glossary updates are capture recommendations, not automatic
brainstorming edits. Only write them when the user explicitly asks to capture
the outcome.

## Hard Stops

If the first real outcome is unknown and any recommendation would smuggle
architecture, ask one scope-setting question and stop. Do not add recommended
defaults, approaches, first slices, or deferred lists for the blocked decision.

Use a hard stop for unresolved answers that decide whether v1 needs a hard gate,
dedicated infrastructure, signing, generic orchestration, multiple providers, or
another high-cost foundation.

Examples of scope-setting questions:

- "Which real workflow should v1 prove first?"
- "Should v1 be advisory while it earns trust, or required from the first release?"
- "Can v1 reuse the existing path, or is isolation required for a concrete risk?"

You may still show a neutral map of categories to be decided later, but do not
recommend an answer for the blocked category.

## Scope Pressure

Long-term capabilities are future shape, not v1 scope, until the user explicitly
promotes them. If the user lists future integrations, dedicated infrastructure,
signing, evals, artifacts, gates, generic platforms, adapter models, or robust
architecture, separate "v1 proof" from "future shape" before proposing a design.

Default v1 is one real path on existing infrastructure with the minimum safety
and diagnostics needed to trust it. Do not design a generic core, provider
adapter contract, provider-neutral manifest, dedicated environment, hard gate,
signing scheme, or two-provider skeleton unless a concrete first-slice risk
requires it.

## Approaches

When approaches are useful, propose 2-3 options with a recommendation. Keep each
option brief enough to scan:

```markdown
**Approach: [Name]**
- How it works:
- First working outcome:
- What it reuses:
- What it defers:
- Best when:
```

Prefer the approach that proves a real outcome soonest, unless safety, data
migration, compliance, or operational risk requires foundation first. If the
first slice is thin, the recommended approach must also be the thin-slice
approach.

## Slices

When the user asks for a first feature slice, different slices, or an
implementation plan, separate:
- objective,
- selected feature,
- already-shipped context,
- multiple implementation slices,
- recommended first slice.

The first slice must produce an observable user or system outcome. It should
exercise the real entrypoint, real operation, and visible success/failure result
for one path. Foundation work belongs in the first slice only when that same
slice consumes it to prove the outcome.

Do not let a roadmap objective or selected feature stand in for an
implementation slice. Decompose the feature into PR-sized slices first.

## Artifact Routing

When the design is complete, recommend the capture path:

| Artifact | Use when |
|---|---|
| OpenSpec | Complex product or behavior changes that need specs, tasks, acceptance criteria, or reviewable implementation sequence |
| Single plan file | Simple implementation plans where one document can coordinate the work |
| ADR | A durable decision is hard to reverse, surprising without context, and the result of a real trade-off |
| Glossary or `CONTEXT.md` | A domain term was clarified and the repo has a glossary/context pattern |
| No artifact yet | The conversation is still exploratory or the user wants to keep it in chat |

OpenSpec and plan files answer "what are we going to do?" ADRs answer "what
decision should future work preserve?" ADRs sit beside the plan when needed;
they do not replace OpenSpec or a plan file.

Before recommending an artifact, scan for existing project patterns:

```bash
ls -d openspec/ openspec/specs/ 2>/dev/null
ls -d .agents/plans docs/specs specs/ plans/ design/ 2>/dev/null
find . -name "*.md" -path "*/docs/*" -mtime -30 2>/dev/null | head -10
```

Ask before writing the artifact. Brainstorming agreement is design confirmation,
not permission to edit files.

## Challenge Rules

Challenge only high-risk defaults: reversibility, scope, safety, data,
architecture, cost, operations, or user-visible behavior. Let low-risk defaults
stand so the conversation does not become a questionnaire.

Ask the repo before asking the user. If code or docs can answer a question,
inspect them and present the finding.

## Before Finalizing

Check that:
- the orientation map showed recommended defaults and the discussion queue,
- domain terms were included,
- the discussion queue stayed at 1-3 items unless the user asked for more,
- accepted defaults were not re-litigated,
- the first slice proves a real path with visible result,
- foundation work is directly consumed by the first slice,
- hardening and future integrations are separated unless required for v1 safety,
- existing systems are reused before proposing new infrastructure,
- feature flags, rollout switches, config gates, and optional guards are tied to
  concrete safety, cost, compliance, or operational risk,
- ADRs are recommended only for durable, surprising, trade-off decisions,
- artifact routing distinguishes OpenSpec, single plan files, ADRs, and glossary
  updates.

## Common Traps

| Trap | Better move |
|---|---|
| Walking every branch of the decision tree | Show the whole tree, then drill into 1-3 high-leverage decisions |
| Treating every "agree" as a chance to restate the design | Accept the defaults and move to the next unresolved item |
| Skipping vocabulary because the topic feels obvious | Include a lightweight domain-terms pass every time |
| Promoting future requirements into v1 | Keep them as future shape unless they address a concrete first-slice risk |
| Recommending a platform while implementing a thin slice | Recommend the thin-slice approach and name the platform as future extraction |
| Making Slice 1 a package, runtime, schema, or config foundation | Reshape Slice 1 around the smallest real end-to-end outcome |
| Treating interface readiness as the outcome | Make the outcome a real operation with visible success/failure |
| Adding feature flags by habit | Add only eligibility or safety checks tied to concrete risk |
| Asking about task-audit mechanics | Infer those later in `openspec-tasks`; keep brainstorming focused on outcomes and slices |

## Test Evidence

- RED: baseline subagent `019eb4d1-5300-7461-b581-937f05a18316` narrowed to GitLab but still defaulted to a dedicated verification environment, signed markers, hard CI gate, and component architecture before challenging whether existing review infrastructure or a softer first proof was good enough.
- RED: baseline subagent `019eb4d1-6b0a-7272-abde-d98ff92093b4` recommended a vertical slice but still introduced named orchestration, adapter-shaped wrappers, auth providers, telemetry sinks, and contract tests in the first design.
- RED/GREEN control: baseline subagent `019eb4d1-8531-7901-90da-9f0d4a954986` performed well only when the user explicitly requested avoiding overengineering, showing the skill needed to make that pressure default.
- REFACTOR: subagent `019eb4d2-8e0a-7162-9009-90313b8c46d4` claimed a GitLab-first slice but recommended a provider adapter core and still included dedicated infrastructure, signed markers, hard gate behavior, and provider-neutral manifests.
- REFACTOR: subagent `019eb4d2-a6d0-7c30-b885-a60ffb2730d2` challenged platform-first thinking but recommended a two-provider skeleton without a concrete v1 need for the second provider.
- REFACTOR: subagent `019eb4d3-95e3-7e51-b814-8dc84f8e6d32` still promoted long-term mentions like dedicated environments, signed markers, and required CI gates into the first slice, so the skill now separates future shape from v1 proof explicitly.
- REFACTOR: subagent `019eb4d3-acf9-75f2-9e2e-6ef718d75b47` used "first integration with adapter boundary" but made interface readiness and second-adapter sketching the success signal instead of a real visible workflow outcome.
- REFACTOR: subagent `019eb4d4-be9f-7701-ba36-b853f82e5ede` still promoted dedicated environments, signed markers, and hard CI gates from long-term scope into v1.
- REFACTOR: subagent `019eb4d4-d58d-7cf2-b5f8-4aa708f63c01` improved the framing but designed a generic workflow core and adapter contract before naming the first real workflow.
- REFACTOR: subagent `019eb4d5-e8a7-72a2-a1af-0f489995d6b8` asked whether v1 should be advisory or required, then continued into an orchestrator/provider-adapter design with dedicated environments and signed markers anyway.
- REFACTOR: subagent `019eb4d6-be88-7423-bd5a-ad2ee01e9d61` asked an eval-vs-operational question, then continued with recommendations, approaches, and a first slice in the same response.
- REFACTOR: subagent `019eb4d7-8214-79b2-8688-f10c170d9846` still asked an advisory-vs-required question and then continued into a provider-adapter orchestrator design, so the hard stop remains explicit.
- REFACTOR: subagent `019eb4d8-3ba1-7360-9997-7ab236cb6f73` used "assuming the goal..." after a scope question to continue into a verification orchestrator, so the skill forbids that bypass.
- REFACTOR: subagent `019eb4d8-f28a-72c2-aab4-22c94f353fe4` asked a scope question but smuggled design through recommended answer choices, architecture, first slice, and deferred work.
- RED: thread `019ec851-0d15-74e0-ab86-1f105de1c358` planned the PR-review migration with an early runtime/package slice and cautious enablement flag before the first real hosted review proof, causing later correction around direct end-to-end evidence and unnecessary variables.
- RED: thread `019ed2b5-6e2e-7581-8fc5-e776bde1c1ec` treated the selected feature direction as the first slice until user correction forced a true objective / feature / implementation-slice breakdown.
- RED: this session found that the prior skill forced section-by-section validation, which made defaultable decisions feel like required discussion.
- GREEN: brainstorming now opens with a compact orientation map, always includes domain terms, caps the discussion queue, treats agreement as accepting defaults, and routes artifacts to OpenSpec, single plan files, ADRs, glossary/context updates, or no artifact.
