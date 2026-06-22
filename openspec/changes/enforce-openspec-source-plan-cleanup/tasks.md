## 1. Source-Plan Cleanup Contract

- [x] 1.1 Document source-plan cleanup in planning skills
      Update `skills/plan-orchestrator`, `skills/plan-review`, their agent
      prompts, and relevant normative planning specs or rules so
      plan-to-OpenSpec conversion treats `.agents/plans/**` files as scratch
      intake artifacts. `plan-orchestrator` must document deletion after
      successful OpenSpec creation and strict validation. `plan-review` must
      document that `artifact_type: openspec` planning diffs contain no
      `.agents/plans/**` paths. Atomic plan behavior for `artifact_type: plan`
      must remain unchanged.

- [x] 1.2 Add executable cleanup and diff validation
      Extend planning helper scripts so `plan-orchestrator` can enforce source
      plan cleanup preconditions and `plan-review` can reject OpenSpec planning
      diffs containing `.agents/plans/**` paths, including added, modified,
      deleted, renamed, copied, and type-changed files. The implementation must
      preserve the source plan on OpenSpec validation failure, block already
      committed source plans, and allow atomic plan review to keep using
      `.agents/plans/**` artifacts. Depends on 1.1.

- [x] 1.3 Add regression coverage for source-plan states
      Add tests or fixture-backed script checks for untracked source plan
      cleanup, staged source plan cleanup, validation-failure preservation,
      already committed source-plan blocking, OpenSpec planning-diff rejection,
      deletion-only diff rejection, and atomic plan acceptance. Depends on 1.2.

- [x] 1.4 Validate skill quality and refresh runtime surfaces
      Run `writing-skills` against the changed planning skill behavior, address
      blocking findings, refresh installed runtime skill surfaces for personal
      and work profiles when live runtime refresh is intended, and verify the
      installed `plan-orchestrator` and `plan-review` surfaces agree with the
      repo source. Account for any lockfile or generated runtime-surface changes
      before delivery. Depends on 1.3.

- [x] 1.5 Bind cleanup to expected source-plan context
      Add `openspec_blueprint.source_plan.ref` and
      `openspec_blueprint.source_plan.change_id` to the `plan-ready` blueprint
      template and validator for plan-file-backed OpenSpec blueprints. Update
      `plan-orchestrator` cleanup behavior so `cleanup-source-plan` requires
      separate `--expected-source-plan` and `--expected-change-id` values from
      that conversion context, and the cleanup target must match the expected
      path for the same change id.
      Being untracked, staged, or under `.agents/plans/**` must not be
      sufficient authority to delete a file. Add regression coverage for
      missing expected-source input, missing expected-change input, mismatched
      expected path, wrong change id, normalized path equivalence, path escape
      rejection, tracked source-plan states, preservation of an unrelated
      `.agents/plans/**` file in the same worktree, and freshly-created
      disposable cleanup fixtures. Update `plan-ready` and `plan-orchestrator`
      skill docs/prompts, runtime surfaces, and validation evidence as needed.
      Depends on 1.4.
