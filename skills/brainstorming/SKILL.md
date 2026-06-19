---
name: brainstorming
description: Use when brainstorming, designing features, exploring requirements, thinking through problems, or turning rough ideas into implementation-ready plans.
allowed-tools: Read, Glob, Grep, AskUserQuestion
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs through collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each whether it looks right.

## Hard Stops

If the user lists long-term capabilities such as future integrations, dedicated infrastructure, signing, evals, artifacts, gates, generic platforms, adapter models, or robust architecture, do not design the solution yet. Ask one scope-setting question that identifies the first real outcome or the v1 trust level, then stop.

If you ask a scope-setting question, the response ends after that question. Do not include a recommended default, approaches, components, first slice, or deferred list.

Do not bypass this with "assuming..." or "if I had to recommend..." after the question. That is continuing the design without the answer.

Do not bypass this by adding recommended choices under the question. Offer choices only if none are marked as recommended and they do not smuggle a design.

Examples of scope-setting questions:

- "Which real workflow should v1 prove first?"
- "Should v1 be advisory while it earns trust, or required from the first release?"
- "Can v1 reuse the existing path, or is isolation required for a concrete risk?"

## The Process

**Understanding the idea:**
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time using AskUserQuestion
- Prefer multiple choice when possible; open-ended is fine too
- Focus on: purpose, constraints, success criteria, first useful outcome
- Ask what "good enough for v1" means before designing the long-term shape
- If the first real workflow/outcome is unknown, ask that before proposing architecture
- If you ask a scope-setting question whose answer changes v1 shape, stop there. Do not ask and then continue designing.
- A message with a scope-setting question must end after the question. No recommendation, approaches, components, first slice, or deferred list in the same response.

**Scope pressure gate:**
- Long-term capabilities are future shape, not v1 scope, until the user explicitly promotes them
- If a user lists many advanced nouns, first separate "v1 proof" from "future shape"
- Default v1 is one real path on existing infrastructure with the minimum safety and diagnostics needed to trust it
- Do not design a generic core, adapter contract, provider-neutral manifest, dedicated environment, hard gate, signing scheme, or two-provider skeleton unless a concrete first-slice risk requires it
- Treat "orchestrator with provider adapters" as a platform design; do not recommend it for v1 until one real path proves the need

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Lead with your recommendation and explain why
- Prefer the approach that proves a real outcome soonest, unless safety, data migration, compliance, or operational risk requires foundation first
- When the user asks for a first feature slice, different slices, or an
  implementation plan, separate the response into: objective, selected feature,
  already-shipped context, multiple implementation slices, and recommended first
  slice
- Do not let a roadmap objective or selected feature stand in for an
  implementation slice; decompose the feature into PR-sized slices first
- Do not ask the user to choose task-audit mechanics; those are internal
  `openspec-tasks` concerns, not brainstorming vocabulary
- Do not recommend a platform/core/foundation approach while claiming the first slice is thin; the recommendation and first slice must match
- Treat the first PR as the first proof point: it should deliver a narrow
  end-to-end sliver of the desired outcome, not only setup for later PRs
- The first sliver may be manually triggered, advisory, fixture-backed, or
  limited to one happy path, but it must exercise the real entrypoint, operation,
  and visible success/failure result
- Foundation work belongs in the first PR only when that same PR consumes it to
  produce the sliver; otherwise push it behind the first proof or fold only the
  minimum needed into the sliver
- Use this format for each approach:

```
**Approach: [Name]**
- How it works: [Brief description]
- First working outcome: [The earliest PR-sized end-to-end sliver: entrypoint, operation, visible result]
- What it reuses: [Existing systems, paths, infrastructure, or conventions]
- What it defers: [Hardening, generalization, integrations, polish]
- Pros: [What you gain]
- Cons: [What you lose or defer]
- Best when: [Conditions where this shines]
```

**Good-enough design pressure:**
- Ask: "What is the smallest real outcome that would prove this direction works?"
- Ask: "Which existing path or infrastructure can carry v1?"
- Ask: "What would we delete if this had to ship in one iteration?"
- Ask: "What risk are we actually addressing, and is it present in v1?"
- When the user lists long-term capabilities, separate "future shape" from "v1 proof" before proposing architecture
- Do not include an advanced capability in v1 only because the user mentioned it as long-term scope
- Treat foundation, generic frameworks, plugin systems, broad schemas, dashboards, and future integrations as suspect until tied to the first outcome
- Allow simple duplication when it keeps the first version readable and can be extracted after the second real use case appears
- Require a concrete v1 reason before adding dedicated infrastructure, signed/encrypted protocols, hard gates, provider-neutral manifests, contract tests, or two-provider skeletons
- If no concrete v1 reason is known, default to existing infrastructure, advisory/non-required verification, minimal trustworthy metadata, one real integration, and bounded artifacts
- If the first workflow is not known, stop at the approach trade-off and ask which workflow to prove first
- Do not continue into components after asking whether v1 is advisory vs required, existing vs dedicated infrastructure, or single vs multiple providers

**Presenting the design:**
- Break the design into sections of 200-300 words
- Ask after each section whether it looks right
- Cover: first outcome, architecture, components, data flow, error handling, testing, deferred work
- Be ready to go back and clarify if something doesn't make sense

**Before finalizing:**
- Check that the visible output distinguishes the objective, selected feature,
  already-shipped context, implementation slices, and recommended first slice
- Check that there are multiple implementation slices unless the work is
  genuinely atomic and the atomic rationale is explicit
- Check that the first slice produces an observable user/system outcome
- Check that the first slice includes the real entrypoint, real operation, and visible result for one path
- Check that the first PR proves a sliver of the target end-to-end workflow even
  if the sliver is manual, advisory, fixture-backed, or happy-path-only
- Check that foundation work is directly consumed by that first slice
- Check that feature flags, rollout switches, config gates, and optional guards
  are justified by a concrete safety, cost, compliance, or operational risk; do
  not add them only because staged rollout feels cautious
- Check that hardening and future integrations are separated unless required for v1 safety
- Check that existing systems are reused before proposing new infrastructure
- Check that the recommendation matches the first slice; if the first slice is thin, recommend the thin-slice approach
- Check that any dedicated environment, hard gate, signing, adapter contract, or second provider has an explicit v1 risk it addresses
- Check that long-term requirements are named as future shape or deferred work, not silently promoted into the first slice
- If the first slice is mostly schema, registry, adapter, platform, or infrastructure work, rewrite it around the first real outcome
- Do not accept "a second adapter can be sketched" or "the contract is ready" as first-slice success; success must prove behavior through a real path
- If you cannot name the real entrypoint, operation, and visible result, ask a question instead of inventing components
- If an unresolved answer would decide whether to use a hard gate, dedicated infrastructure, signing, or generic orchestration, ask the question and stop
- If you ask a question and then write "recommended default," "recommended approach," or "first implementation slice," you violated this skill
- If you ask a question and then write "assuming..." to continue, you violated this skill
- If you ask a question and then list a "recommended" option, you violated this skill

## Ending the Session

When the design is complete, detect what documentation patterns exist in the project and recommend the best fit.

**First, scan the project for existing patterns:**
```bash
# Check for OpenSpec (directory with specs/ subdirectory)
ls -d openspec/ openspec/specs/ 2>/dev/null

# Check for plan/spec directories
ls -d .agents/plans docs/specs specs/ plans/ design/ 2>/dev/null

# Look at recent markdown files for patterns
find . -name "*.md" -path "*/docs/*" -mtime -30 2>/dev/null | head -10
```

Also check if Linear MCP tools are available (e.g., `mcp__linear-server__create_issue`). If so, Linear is an option for capturing the design.

**Recommend based on what exists:**

| If you find... | Recommend |
|----------------|-----------|
| `openspec/` directory with `specs/` | OpenSpec proposal - formal spec workflow is set up |
| `.agents/plans/` | Plan document in `.agents/plans/` |
| `specs/` | Plan/spec document in that directory |
| Linear MCP available | Linear issue or project doc for team visibility |
| Nothing specific | Ask user preference, suggest plan file in project |

Ask: "The design looks complete. I see this project uses [detected pattern]. Want me to create a [spec/plan/doc] there, or would you prefer something else?"

**Options to offer:**

| Option | When to use |
|--------|-------------|
| **OpenSpec proposal** | Project has OpenSpec configured; formal designs needing review |
| **Plan/spec document** | Project has established docs structure; implementation-ready work |
| **Start implementing** | Simple changes where conversation provides enough context |
| **End session** | User wants to think more or hand off |

**If creating a document:**
- Write implementation plans under `.agents/plans/`
- Use the project's established format
- Capture all design decisions, requirements, and trade-offs
- Include enough context for someone unfamiliar to understand

**If implementing:**
- Ask if they want to continue in this session or start fresh
- If starting fresh, provide a detailed prompt with sufficient context

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended
- **Good enough beats imagined complete** - Find the smallest solution that works, is understandable, and can be safely improved
- **YAGNI ruthlessly** - Remove unnecessary features from designs
- **Outcome before foundation** - Prefer proving the real path before building reusable layers
- **Reuse before inventing** - Existing workflows, environments, and conventions are usually the best v1 substrate
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Context-aware** - Respect the project's existing documentation patterns

## Common Overengineering Traps

| Trap | Better move |
|------|-------------|
| Designing for every future integration | Name future needs, implement the first real path |
| Promoting long-term requirements into v1 | Keep them as future shape unless they address a concrete first-slice risk |
| Building generic adapters before one concrete path works | Use a narrow internal shape, extract after a second use case |
| Recommending a platform while implementing a thin slice | Recommend the thin slice; describe the platform as a future extraction |
| Treating interface readiness as the outcome | Make the outcome a real operation with visible success/failure |
| Making Slice 1 a package, runtime, schema, or config foundation while the first real workflow appears in Slice 2+ | Reshape Slice 1 so the same PR proves the smallest real end-to-end path |
| Adding feature flags or repository variables as default rollout guards | Add only eligibility/safety checks tied to concrete risk; otherwise let the narrow path run |
| Designing components before knowing the first workflow | Ask which workflow to prove first |
| Asking a scope question and continuing anyway | Stop after the question; wait for the answer |
| Using "assuming..." to keep designing after a question | Do not assume; wait for the answer |
| Hiding a design in multiple-choice answers | Keep choices neutral and stop |
| Calling a provider-adapter orchestrator the v1 design | Prove one real path first, then extract orchestration |
| Creating dedicated infrastructure by default | Reuse existing infrastructure unless isolation is required |
| Adding full auth/security hardening to the first proof | Keep the minimum meaningful safety, harden after the path exists |
| Treating docs, telemetry, dashboards, and polish as v1 foundations | Add only what is needed to operate and verify the first slice |
| Treating a feature direction as the first implementation slice | Break the feature into multiple PR-sized slices and recommend the first one |
| Asking the user whether planning should use task-audit mechanics | Infer that later in `openspec-tasks`; keep brainstorming focused on outcomes and slices |

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
- REFACTOR: subagent `019eb4d7-8214-79b2-8688-f10c170d9846` still asked an advisory-vs-required question and then continued into a provider-adapter orchestrator design, so the hard stop is now at the top of the skill.
- REFACTOR: subagent `019eb4d8-3ba1-7360-9997-7ab236cb6f73` used "assuming the goal..." after a scope question to continue into a verification orchestrator, so the skill now explicitly forbids that bypass.
- REFACTOR: subagent `019eb4d8-f28a-72c2-aab4-22c94f353fe4` asked a scope question but smuggled design through recommended answer choices, architecture, first slice, and deferred work.
- RED: thread `019ec851-0d15-74e0-ab86-1f105de1c358` planned the PR-review migration with an early runtime/package slice and cautious enablement flag before the first real hosted review proof, causing later correction around direct end-to-end evidence and unnecessary variables.
- RED: thread `019ed2b5-6e2e-7581-8fc5-e776bde1c1ec` treated the selected feature direction as the first slice until user correction forced a true objective / feature / implementation-slice breakdown.
- GREEN: brainstorming now requires implementation-plan responses to show objective, selected feature, shipped context, multiple implementation slices, and a recommended first slice while leaving OpenSpec task-audit mechanics hidden from brainstorming vocabulary.
