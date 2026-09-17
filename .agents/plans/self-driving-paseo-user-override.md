# Self-driving Paseo workflow with user-controlled overrides

## Goal

Make the managed Pi/Paseo workflow continue automatically from an accepted Astra plan through planning review, plan repair, fresh Sol implementation, implementation review, and one repair batch. Preserve the user's final authority by allowing a clear instruction to proceed past failed, missing, or incomplete non-absolute quality gates without claiming those gates passed.

The workflow must not require the user to switch profiles, create the implementation session, recover reviewer formatting errors, or use a terminal from another device. It may pause for a material decision, a human-only credential step, or an operation that remains prohibited independently of review state.

## Selected approach

Extend the existing finite workflow runner and its injected contract. Do not add another orchestrator.

Treat configured reviewers as automatically launched evidence providers. A reviewer timeout, provider error, malformed envelope, or unavailable model records degraded evidence and does not by itself prevent the owning Astra or Sol session from continuing. A valid reviewer outcome marked `blocked` represents a potentially material issue: the owner must either resolve it, ask the user one focused question, or record the user's explicit waiver.

The owning session remains responsible for judgment and mutation:

1. Astra writes the accepted plan and starts planning review without another prompt.
2. GLM and DeepSeek review concurrently.
3. Astra evaluates all valid findings, records unavailable reviewer evidence, applies one contract-preserving plan repair batch, and asks only when a material decision remains.
4. Astra creates the immutable handoff and the runner launches a fresh Sol session automatically.
5. Sol implements, runs project-native verification, freezes the implementation artifact, and starts GLM, DeepSeek, and Astra review without another prompt.
6. Sol evaluates the combined findings, applies one relevant repair batch, reruns affected verification, and continues to the already authorized delivery boundary.
7. Publication or deployment follows its own exact authority. Review state does not manufacture or remove terminal-action authority.

A later clear user instruction such as “deploy this revision despite the failed review” records a scoped waiver for that action and artifact. No magic phrase is required. The workflow reports the failed evidence, the waiver, the exact artifact, and the result. A waiver never changes failed evidence to passed evidence.

## Critical interruption boundary

Pause for the user only when at least one of these remains unresolved:

- externally visible behavior or acceptance must change;
- architecture, migration, security, privacy, data-loss, or rollback policy needs a material choice;
- reviewers provide conflicting evidence that the owner cannot resolve defensibly;
- credentials, authentication, or another human-only action is required;
- a destructive or irreversible action lacks exact authority;
- a waiver target is ambiguous, stale, or differs from the current artifact or head; or
- the requested command is prohibited independently of workflow quality gates.

Automatically handle ordinary review findings, plan wording, contract-preserving corrections, test failures, lint, types, CI diagnosis, reviewer outages, and session/profile routing.

Explicit user direction may waive review, verification, CI, or workflow-completeness gates for a named action and artifact. It does not permit agent force-push, credential disclosure, hook bypass, or an operation denied by the provider or operating system.

## Ownership and reuse

- Extend `skills/handoff-brief/scripts/paseo-workflow.ts` and `paseo-workflow-state.ts`, which already own session routes, immutable snapshots, reviewer dispatch, triage, and the fresh implementation handoff.
- Extend `skills/handoff-brief/references/paseo-workflow.md`, which is injected as the managed session contract.
- Keep lifecycle and terminal authority in `rules/investigation-and-implementation.md` and `skills/finish/SKILL.md`; align them only where failed quality evidence currently overrides explicit user authority.
- Reuse the current fixed role catalog and Paseo CLI transport. Do not add model selection, generic agent creation, recursive delegation, or a second state store.
- Keep private review reports, waivers, session IDs, and workflow state task-local. Commit only this plan and behavior sources.

The new behavior is an intentional deviation from the current fail-closed rule for reviewer completeness. Review evidence remains fail-honest, but infrastructure completeness becomes advisory. Existing hard command guards remain unchanged.

## Implementation contract

### Continuous workflow state

Use one workflow state identity from planning review through implementation review and Finish. The implementation handoff must carry that state path, and the runner must record the fresh Sol identity before Sol can mutate the worktree. A manually created compatible session must not be required for the normal path.

State must distinguish:

- complete review evidence;
- degraded or unavailable reviewer evidence;
- actionable findings and material blockers;
- owner dispositions and verified repairs; and
- user waivers scoped to phase, artifact/head, requested action, reason, and known failed gates.

A phase can advance with degraded reviewer evidence after the owner records its fallback assessment. It cannot silently discard a valid blocked outcome. A scoped user waiver can advance the named action while preserving the unresolved evidence in final reporting. Record the artifact or head against which the user instruction was interpreted, compare it with the current target immediately before acting, and ask one focused question when the target is ambiguous or stale.

Degraded evidence applies only to configured reviewer responses. An uncertain or failed Sol launch, missing session identity, corrupt or unavailable workflow state, snapshot-integrity failure, or ownership-transfer failure remains a hard orchestration blocker. Automatic continuation cannot mutate the implementation worktree until the runner records the fresh Sol identity, and it must not retry an uncertain launch in a way that could create a duplicate session.

### Automatic continuation

Update the managed prompts and transition rules so phase owners continue routine work without waiting for another user message:

- plan acceptance starts review;
- non-material planning findings trigger one plan update batch;
- a settled plan launches Sol;
- completed implementation and verification start implementation review;
- non-material implementation findings trigger one repair batch; and
- the workflow continues to the already authorized publication or deployment boundary.

Starting a child session remains a runner-owned action. Switching roles means launching the configured dedicated Paseo session, not changing the model inside the current session.

### Explicit override

Add a deterministic workflow transition for recording a user-directed waiver. Validate that it names the phase or failed gates, exact artifact or head, and requested terminal action. The transition must not claim successful review and must not broaden authority beyond that action.

The prose contract must tell the active owner to honor clear contextual instructions rather than demand a prescribed phrase. If the action itself was not already authorized, the user’s waiver message must also clearly assign that exact action to the agent.

## Regression scenarios

Add clean-context RED/GREEN behavior tests for these observed failures:

1. **Birthday planning reviewer failure:** GLM completes, DeepSeek returns a malformed envelope, Astra records degraded evidence, performs an inline fallback assessment, and can hand off without a replacement review session.
2. **Automatic handoff:** after settled planning feedback, the runner launches exactly one fresh Sol session with the same workflow identity and immutable plan/brief snapshots.
3. **Automatic implementation review:** the handed-off Sol session can dispatch the implementation review once without `Implementation review requires a fresh implementation handoff`.
4. **Material blocker:** a valid `blocked` reviewer outcome prevents automatic continuation until repaired, answered, or explicitly waived.
5. **Explicit deployment override:** a failed review plus a clear user instruction to deploy a named head records a waiver and permits Finish to run the authorized deployment while reporting the failed review accurately.
6. **No accidental widening:** vague urgency or a review waiver does not authorize an otherwise unrequested deployment, merge, cleanup, force-push, credential disclosure, or hook bypass.
7. **One-pass preservation:** degraded evidence and waiver handling do not silently launch duplicate reviewer rounds or duplicate implementation sessions.

## Verification

- Focused unit tests for workflow state, review collection, degraded evidence, handoff identity, automatic continuation prompts, and scoped waiver validation.
- Integration tests for terminal authority and the full planning-to-Sol-to-implementation-review path.
- `pnpm run biome:lint-format`
- `pnpm run charter:validate`
- `pnpm run skills:validate`
- `pnpm run test:unit`
- `pnpm run test:integration`
- Run `writing-skills` validation against every changed shared skill, rule, instruction, and managed workflow source.
- Exercise AX synchronization only with isolated HOME and runtime roots; do not change the live runtime from the feature worktree.

## Acceptance

- One accepted plan can progress from Astra through dedicated plan reviewers into a fresh Sol implementation session without another user prompt when no material decision remains.
- Sol automatically starts one dedicated implementation review round after freezing and verifying its first implementation.
- Reviewer infrastructure failures remain visible but do not deadlock the workflow.
- Valid material blockers still receive repair, one focused user question, or an explicit scoped waiver.
- A user working from a phone can clearly direct an authorized deployment despite failed review evidence, and the agent executes it rather than redirecting the user to a terminal.
- Final reports distinguish reviewed, degraded, waived, repaired, current, and deployed heads accurately.
- Existing force-push, hook, credential, destructive-operation, and provider restrictions remain effective.

[confidence: 0.97 - certain | reason: the existing runner already owns all session routes and the birthday transcripts directly demonstrate both failure chains]
