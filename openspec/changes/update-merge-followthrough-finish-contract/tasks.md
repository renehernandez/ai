## 1. Merge Followthrough Finish Contract

- [ ] 1.1 Define finish and check-only modes in
      `skills/merge-followthrough/SKILL.md`, update the skill frontmatter and
      adapter prompt for MR/PR finish mode and explicit stacks, and add focused
      behavioral coverage for prompt-to-mode examples.
- [ ] 1.2 Add explicit stack permission, stack order, and branch cleanup safety
      rules to the skill contract, including freshly validated stack-ready
      evidence and hosted source/target dependency checks, with focused
      behavioral coverage.
- [ ] 1.3 Add required default-branch CI graph completion rules to the skill
      contract, including no-pipeline verification gaps and child/downstream CI
      graph proof when required, 10-minute creation polling, and focused
      behavioral coverage.
- [ ] 1.4 Add post-merge fix-forward boundary rules to the skill contract,
      including the above-0.90 confidence threshold, normal hosted-review route,
      evidence-backed confidence inputs, Nitro request requirement where
      applicable, and never-auto-merge behavior, with focused behavioral
      coverage.

## Proof Expectations

Each deliverable task owns its own verification evidence. Before treating the
updated skill as live, the implementation must include:

- `writing-skills` RED baseline and GREEN retest pressure for the changed
  behavior in the task.
- Focused unit coverage, expected to live in
  `tests/unit/merge-followthrough-skill.test.ts`.
- `pnpm exec tsx scripts/skill-validate.ts skills/merge-followthrough`.
- Runtime profile validation and refresh for affected profiles:
  `pnpm ax skills validate --profile personal`,
  `pnpm ax skills validate --profile work`,
  `pnpm ax skills update --profile personal`,
  `pnpm ax skills status --profile personal`,
  `pnpm ax validate --profile personal`,
  `pnpm ax skills update --profile work`,
  `pnpm ax skills status --profile work`, and
  `pnpm ax validate --profile work`.
