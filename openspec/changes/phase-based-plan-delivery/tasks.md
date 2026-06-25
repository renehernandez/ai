## 1. Contract Shape

- [x] 1.1 Update `rules/docs-and-specs.md` and related normative guidance to
      define delivery-unit headings and nested work items for OpenSpec plan
      delivery.
      First real confirmation: the `plan-review` command reports a valid
      four-unit OpenSpec task file with expected implementation shape `4 phase
      MRs, 22 sub-tasks` as visible success evidence.
- [x] 1.2 Update `skills/plan-ready/SKILL.md` so blueprints describe expected
      delivery-unit count, nested work-item count, split smells, merge smells,
      and justification requirements.
- [x] 1.3 Update `skills/plan-review/SKILL.md` so planning MRs report expected
      implementation shape and block invalid delivery-unit sizing before
      implementation starts.
- [x] 1.4 Update `skills/openspec-tasks/SKILL.md` so task audits describe the
      shared delivery-unit model and distinguish lifecycle-only groups from
      valid workflow-machinery deliverables.
- [x] 1.5 Add examples of valid and invalid delivery-unit breakdowns to the
      relevant skill or rule guidance.
- [x] 1.6 Update `skills/plan-orchestrator/SKILL.md` so top-level workflow,
      resume requirements, and stack-ready evidence refer to delivery-unit MRs
      rather than the legacy per-task MR mapping.

## 2. Readiness Gates

- [x] 2.1 Extend `skills/openspec-tasks/scripts/openspec-tasks.ts` with a
      shared delivery-unit model, nested work-item parsing, completion
      semantics, sizing checks, justification parsing, merge-smell checks, and
      legacy-flat normalization.
- [x] 2.2 Add sizing checks for the 2-6 target, more-than-6 split smell, and
      more-than-8 readiness blocker.
- [x] 2.3 Add merge-smell checks for one-item units without risk, deployment,
      or reviewability justification.
- [x] 2.4 Wire `plan-ready`, `plan-review`, `plan-unit-sequencer`,
      `plan-unit-delivery`, and stack-state helpers to the shared
      `openspec-tasks` delivery-unit API.
- [x] 2.5 Add shape fixtures for valid breakdowns, oversized units, unjustified
      tiny units, phase justification parsing, lifecycle-only groups, and valid
      workflow-machinery exceptions.
- [x] 2.6 Add a legacy migration matrix covering valid flat tasks, invalid flat
      tasks that hide multiple outcomes, mixed flat/unit task files, and stale
      legacy plan-ready artifacts.

## 3. Stack Delivery Delta

- [x] 3.1 Update `skills/plan-unit-sequencer/SKILL.md` so it selects the next
      unchecked delivery unit and hands that unit to `plan-unit-delivery`.
- [x] 3.2 Update `skills/plan-unit-delivery/SKILL.md` so one implementation MR
      may include multiple nested work-item commits and checkbox updates within
      the selected unit.
- [x] 3.3 Replace or extend `validate-task-delta` with delivery-unit delta
      validation that accepts exactly one unit completion and rejects unrelated
      work-item changes.
- [x] 3.4 Update delivery ledger requirements so they record selected unit ID,
      completed nested work-item IDs, unit base SHA, implementation artifact,
      head SHA, CI evidence, Nitro evidence, and restack state.
- [x] 3.5 Update resume and stack-ready validation so cumulative task state is
      delivery-unit aware, including relevant `plan-orchestrator` script
      surfaces and shared stack-state helpers.
- [x] 3.6 Add compatibility fixtures for one unit with multiple nested items,
      two units checked in one MR, future nested items checked early, legacy
      one-checkbox stacks, in-flight flat-task delivery, interrupted unit MRs,
      and rollback or downgrade status.

## 4. Runtime Surfaces

- [ ] 4.1 Update plan skill agent prompts under `skills/*/agents/` so delegated
      planning and delivery agents use delivery-unit and nested-work-item
      terminology.
- [ ] 4.2 Update OpenSpec-generated or installed skill surfaces in this repo
      that duplicate the legacy per-task MR language.
- [ ] 4.3 Update docs, examples, and change-request body guidance that mention
      one implementation MR per OpenSpec task or omit delivery-unit MR
      evidence.
- [ ] 4.4 Add prompt and template contract assertions that fail on stale
      `selected_task_id`, `unit_task_delta_valid`, or per-task MR wording in
      active runtime-facing surfaces unless the wording is explicitly legacy
      context.
