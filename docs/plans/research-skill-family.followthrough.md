# Research Skill Family Followthrough

```yaml
plan_followthrough_ledger:
  status: complete
  ledger_ref: docs/plans/research-skill-family.followthrough.md
  plan:
    artifact_ref: docs/plans/research-skill-family.md
  slice_advancement:
    mode: ship_then_continue
    source: user_statement
  current_slice:
    id: slice-01-research-and-two-area-skills
    title: Research and two area skills
  slices:
    - id: slice-01-research-and-two-area-skills
      title: Research and two area skills
      status: shipped
    - id: slice-02-optional-validator-and-follow-on-research-areas
      title: Optional validator and follow-on research areas
      status: skipped
  carry_forward:
    refactoring_reuse: []
    significant_refactor_suggestions: []
    review_findings: []
    verification_gaps:
      - Repo-wide `pnpm exec biome check .` still reports pre-existing formatting and lint issues outside this slice; focused Biome check for the new test file passed.
    changed_assumptions:
      - Direct-to-main delivery is being used per user instruction instead of hosted PR delivery.
  next_action: stop
  blockers: []
  warnings:
    - Slice 2 is intentionally conditional and should not start until real Slice 1 usage justifies it.
```

## Slice 1 Reconciliation

- Shipped `research`, `research-technical`, and `research-content`.
- Added OpenAI adapter metadata for each skill.
- Added focused unit tests for router behavior, area-skill brief contracts,
  source IDs, evidence mapping, blocked-state rules, and adapter metadata.
- Forward-test prompts from the plan were checked against the new contracts:
  technical OAuth token rotation research maps to `research-technical`; internal
  AI-assisted development talk research maps to `research-content`.

## Verification

- `pnpm exec tsx skills/plan-followthrough/scripts/plan-followthrough.ts validate-ledger --file docs/plans/research-skill-family.followthrough.md`
- `pnpm exec biome check tests/unit/research-skills.test.ts`
- `pnpm test:unit`
- `pnpm ax skills update --profile personal`
- `pnpm ax skills status --profile personal`
- `pnpm ax validate --all-profiles`
- `git diff --check`
- `pnpm test`
