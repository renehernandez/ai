---
name: brainstorming
description: Use when brainstorming, designing features, exploring requirements, thinking through problems, shaping plans, or turning rough ideas into implementation-ready designs.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Brainstorming Ideas Into Designs

Help open up ideas before selectively converging them into designs. The default
posture is: understand the problem space first, narrow only when invited.

## Mode Boundary

This is a bounded Explore specialist. It is read-only and does not create or
edit plans, OpenSpec changes, tracker state, branches, commits, PRs, or MRs.
Agreement may recommend Plan; it does not authorize a write by itself.
The read-only boundary applies to the whole turn. If a prompt mixes
brainstorming with planning or implementation, complete the opening exploration,
converge only when the user explicitly invites it, then queue the requested
mutation for a later Plan or Execute turn after the brainstorming outcome is
accepted.

## Default Flow

1. **Inspect context and precedent first.** Read relevant files, docs, recent
   plans, glossary files, and code before asking questions the project can
   answer. For every non-trivial design, find the closest existing
   implementations and their canonical owners without waiting for the user to
   request reuse. Phrases such as "same approach as" only narrow this required
   scan; they do not trigger it. Identify independent read-only evidence lanes.
   When bounded delegation will lower latency, start them together with the
   same minimal evidence contract and reconcile them once; keep a small
   coherent scan inline when coordination would take longer. Do not combine
   independent lanes into one nominal scan or delay their launch by designing
   an elaborate packet.
2. **Choose the smallest useful response shape.** For a quick or narrow request
   with a known objective and no material ambiguity, use the compact route:
   answer, one reason, and the next decision only when needed. Do not use the
   orientation map for this route. For non-trivial or open-ended work, lead with
   an orientation map covering the objective, problem framing, material domain
   terms, existing precedent, approach, working hypotheses, and discussion
   queue. Do not choose v1, implementation slices, proof location, or capture
   artifact during this opening phase.
3. **Keep the discussion queue short.** Pick 1-3 high-leverage decisions to
   discuss. Put the rest under working hypotheses or parking lot.
4. **Drill one material item at a time.** Ask one question at a time only when
   an unresolved item changes scope, behavior, architecture, safety, ownership,
   operations, cost, or another user-visible contract. State low-risk defaults
   and evidence-backed recommendations without asking the user to approve each
   one. When inspected evidence makes the direction unambiguous, omit the
   question, recommend readiness, and wait for a later explicit transition.
5. **Converge only when invited later.** After the opening pass, a later request
   to narrow, choose v1, plan, implement, or prepare delivery activates
   convergence. Then summarize the objective, selected feature, shipped
   context, implementation slices, recommended first slice, deferred work,
   domain terms, and artifact routing.

Treat agreement such as "agreed", "sounds good", or "yes" as accepting the
explicit recommendation or recommendation bundle that the response clearly
refers to. Do not ask again about accepted items or low-risk defaults. Move to
the next unresolved material discussion item without treating unstated scope,
artifact writes, implementation, or terminal actions as accepted.

## Orientation Map

Use the orientation map for non-trivial or open-ended opening responses. Do not
use it for the compact route or when the user asks for a quick or narrow answer:

```markdown
**Orientation Map**
| Area | Working hypothesis | Why | Discuss? |
|---|---|---|---|
| Objective | ... | ... | Yes/No |
| Problem framing | ... | ... | Yes/No |
| Domain terms | ... | ... | Yes/No |
| Existing precedent | ... | ... | Yes/No |
| Approach | ... | ... | Yes/No |

**Discussion Queue**
1. [Decision that needs user judgment]
2. [Decision that changes scope, safety, architecture, or visible behavior]

**Working Hypotheses**
- [Evidence-backed recommendation that focuses discussion without fixing scope]

**Next step**
[Ask only the highest-leverage unresolved material question, or state that the
direction appears ready for an explicit transition.]
```

When a question is needed, keep it tied to the discussion queue. Do not ask
about mechanics that can be inferred later, such as task-audit workflow
details. Working hypotheses must be supported by inspected context and remain
revisable until the user accepts the specific recommendation.

For non-trivial designs, the orientation map must name the closest applicable
implementations and canonical owners, what can be reused or extended, what is
genuinely new, and any material deviation. Report `No applicable precedent
found` only after showing the inspected paths or searches that support it.

## Domain Terms

Include a domain-terms pass only when terminology is fuzzy, overloaded,
inconsistent with the repository, or material to the decision. Keep a single
term clarification inline on the compact route. For broader work, identify 2-5
material terms and compare the user's wording against `CONTEXT.md`, glossary
files, existing docs, or code when available.

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

During the opening phase, if the intended outcome is unknown and any working
hypothesis would smuggle architecture, ask one problem-framing question and
stop. Do not add working hypotheses, approaches, or delivery guidance for the
blocked decision.

After convergence is invited, use a hard stop for unresolved answers that
decide whether v1 needs a hard gate, dedicated infrastructure, signing, generic
orchestration, multiple providers, or another high-cost foundation.

Examples of scope-setting questions:

- "Which real workflow should v1 prove first?"
- "Should v1 be advisory while it earns trust, or required from the first release?"
- "Can v1 reuse the existing path, or is isolation required for a concrete risk?"

You may still show a neutral map of categories to be decided later, but do not
recommend an answer for the blocked category.

## Scope Pressure

Apply this section only after the user invites convergence. During the opening
phase, future capabilities are evidence about the problem space, not a reason
to choose v1 or produce implementation slices.

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

During the opening phase, approaches are distinct ways to frame the problem,
not implementation plans. Propose 2-3 options with a working recommendation
when they materially improve the discussion:

```markdown
**Approach: [Name]**
- How it frames the problem:
- What it prioritizes:
- What it assumes:
- Main trade-off:
- Best when:
```

After convergence is invited, add first working outcome, reuse, and deferred
scope. Prefer the approach that proves a real outcome soonest unless safety,
data migration, compliance, or operational risk requires foundation first. If
the first slice is thin, the recommended delivery approach must also be the
thin-slice approach.

Choose ownership in this order unless evidence justifies a deviation:

1. reuse the canonical implementation directly;
2. extend its canonical owner;
3. extract a shared boundary used by both paths; or
4. add a new mechanism and state why the earlier options are unsafe or
   insufficient.

## Slices

When the user asks for a first feature slice, different slices, or an
implementation plan, separate:
- objective,
- selected feature,
- already-shipped context,
- multiple implementation slices,
- recommended first slice.

The preferred first slice produces an observable user or system outcome through
the real entrypoint. When that vertical slice would combine materially distinct
ownership, security, deployment, rollback, or review seams, the implementation
shape may begin with one or two independently valuable groundwork slices.
Groundwork must simplify or refactor the current system, or establish a required
boundary that a named successor directly consumes. Each groundwork slice needs
local proof and must remain useful and safe if the rest of the stack stops.

## Earliest Objective Proof

Apply this section only after the user invites an implementation shape.

Every implementation shape must identify where the named new capability is
proved. The preferred default is proof in slice 1. Plan may put one or two
locally proved groundwork slices first when forcing vertical proof earlier would
create an oversized or cross-cutting review unit. The first stack objective
proof must appear by slice 3; a third pre-outcome slice returns to Plan for
decomposition review.

Planning artifacts must use explicit proof wording such as `Proof location:` or
`First real confirmation:`. The marker must name the real entrypoint being
exercised and the visible success or failure evidence the user can inspect.
Setup, config, registry, metadata, schema, helper, or readiness work alone does
not count as proof.

Block or reshape plans where the first real confirmation appears after slice 3,
where preceding groundwork is speculative, unsafe without successors, or lacks
a named consumer, where proof is deferred to a later task, or where the marker
only says that proof will happen somewhere else.

Do not let a roadmap objective or selected feature stand in for an
implementation slice. Decompose the feature into PR-sized slices first.

## Artifact Routing

After convergence is invited and the design is complete, recommend the capture
path:

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
not permission to edit files. Plan owns creation of an atomic plan or OpenSpec
artifact; Brainstorming only recommends that capture route.

## Challenge Rules

Challenge only high-risk defaults: reversibility, scope, safety, data,
architecture, cost, operations, or user-visible behavior. Let low-risk defaults
stand so the conversation does not become a questionnaire.

Ask the repo before asking the user. If code or docs can answer a question,
inspect them and present the finding.

## Before Ending The Opening Pass

Check that:
- the response used the compact route for a narrow request or the orientation
  map opened a non-trivial problem with working hypotheses and a short
  discussion queue,
- the closest implementations and canonical owners were inspected and shown,
- reused or extended elements, new concepts, and material deviations were
  explicit,
- domain terms were included only when material,
- the discussion queue stayed at 1-3 items unless the user asked for more,
- clear agreement accepted the explicit recommendation or bundle it referred
  to without expanding into unstated scope or authority,
- no v1, implementation slice, proof location, or artifact route was selected
  without a convergence invitation, and
- an unnecessary question was omitted when the inspected direction was
  unambiguous.

## Before Finalizing Convergence

After convergence is invited, also check that:
- every slice owns local proof and a safe merged outcome,
- the stack objective proof is explicit by slice 3,
- any preceding groundwork is independently valuable and directly consumed by
  a named successor,
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
| Treating every "agree" as acceptance of the whole map | Accept the explicit recommendation or bundle the response refers to, never unstated scope |
| Asking `agree?` after every recommended default | State low-risk defaults together and ask only about unresolved material choices |
| Over-structuring a quick take | Give the answer, one reason, and only a material next decision |
| Skipping material vocabulary | Add only the term clarification needed for the decision |
| Waiting for the user to ask for reuse | Scan for precedent for every non-trivial design; prompt wording only narrows the scan |
| Inspecting independent evidence lanes one at a time | Start them together when bounded delegation will finish faster; keep only small coherent scans inline |
| Calling several independent sources one coherent scan | Keep the lanes distinct and use only the minimal shared evidence contract needed for reconciliation |
| Claiming there is no precedent without evidence | Name the inspected paths or searches before accepting a new mechanism |
| Treating an opening "fix" or "implement" request as mutation authority | Complete the read-only opening pass and wait for a later explicit transition |
| Choosing v1 or a first slice during the opening pass | Keep delivery guidance dormant until the user invites convergence |
| Promoting future requirements into v1 | Keep them as future shape unless they address a concrete first-slice risk |
| Recommending a platform while implementing a thin slice | Recommend the thin-slice approach and name the platform as future extraction |
| Forcing every cross-cutting stack to prove the objective in Slice 1 | Allow up to two locally proved groundwork slices when they reduce the size or risk of the first outcome MR |
| Letting groundwork become speculative architecture | Require current standalone value, a safe intermediate state, and a named consuming successor |
| Treating interface readiness as the outcome | Make the outcome a real operation with visible success/failure |
| Letting a deliverable-shaped plan defer first real confirmation past task 3 | Return to Plan; no more than two groundwork units may precede stack objective proof |
| Adding feature flags by habit | Add only eligibility or safety checks tied to concrete risk |
| Asking about task-audit mechanics | Infer those later in `openspec-tasks`; keep brainstorming focused on outcomes and slices |

## Test Evidence

- RED: a user asking for a quick CLI naming take received a 252-word orientation
  map, discussion queue, hypotheses, and next-step section.
- GREEN: the compact route returned the recommendation, semantic distinction,
  and confidence annotation in 25 words without losing the decision boundary.
- RED: an opening-fix pressure test without this contract chose immediate
  Execute because the user explicitly requested implementation, the worktree
  was clean, the likely change was one line, and urgency made a separate
  read-only phase appear counterproductive.
- GREEN: the same opening-fix pressure test chose only the opening Explore pass
  after the revision, kept v1 and implementation shape dormant, and cited the
  explicit rule that urgency, an obvious one-line solution, and a clean
  worktree do not authorize first-turn mutation.
- REFACTOR controls continued to reopen architectural scope changes and resist
  premature platform design, so the revision closes the initial authority
  loophole without adding a broader questionnaire.
- RED: baseline subagent `019eb4d1-5300-7461-b581-937f05a18316` narrowed to GitLab but still defaulted to a dedicated verification environment, signed markers, hard CI gate, and component architecture before challenging whether existing review infrastructure or a softer first proof was good enough.
- RED: baseline subagent `019eb4d1-6b0a-7272-abde-d98ff92093b4` recommended a vertical slice but still introduced named orchestration, adapter-shaped wrappers, auth providers, telemetry sinks, and contract tests in the first design.
- RED/GREEN control: baseline subagent `019eb4d1-8531-7901-90da-9f0d4a954986` performed well only when the user explicitly requested avoiding overengineering, showing the skill needed to make that pressure default.
- RED: the prior earliest-proof rule rejected every Task 3 confirmation, even
  when Tasks 1 and 2 were independently valuable groundwork that reduced a
  cross-cutting root MR; the task audit also flattened nested work items and
  could mistake checkbox 1.1 proof for proof in the first final MR.
- GREEN: revised guidance permits stack objective proof in unit 3 after at most
  two locally proved groundwork units, while the audit rejects proof after unit
  3 and nested work items that impersonate final MRs.
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
- RED: Stat thread `019f601f-ea2e-7892-a9d8-cd422023ded0` walked through individually recommended decisions and later requested two wording-only approvals after Plan authority already existed.
- GREEN: explicit recommendation bundles are accepted together, low-risk defaults do not become questions, and only unresolved material choices remain in the discussion queue.
- RED: the automatic risk-scoring rehearsal proved its behavior while missing
  repository equivalents and proposing parallel owners until repeated user
  steering exposed the duplication.
- GREEN: the `unprompted-precedent-scan-passes-reviewed-first-proof` fixture
  requires precedent evidence even when the request contains no reuse phrase.
- REFACTOR: the missing-precedent fixture blocks progress, while a documented
  `No applicable precedent found` result remains eligible for review.
- GREEN: brainstorming now opens with a compact orientation map, always includes domain terms, caps the discussion queue, treats agreement as accepting defaults, and routes artifacts to OpenSpec, single plan files, ADRs, glossary/context updates, or no artifact.
- RED: a fresh Explore pressure test could choose parallel evidence collection
  only by relying on the user's live priority; the tracked brainstorming skill
  lacked `Task`, a ready-lane rule, and a clear answer to the consistency
  rationalization for serial reads.
- GREEN: independent read-only evidence lanes start together under one evidence
  contract when that reduces latency, while a small coherent scan remains
  inline and the whole brainstorming turn stays read-only.
