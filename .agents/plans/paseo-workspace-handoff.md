# Workspace-bound Paseo workflow launches

## Objective and delivery

Make every managed Pi/Paseo launch run in its accepted repository/worktree, even when the planner is in another Paseo project. Recover one explicitly authorized, known misrouted implementation handoff without deleting history or repeating planning reviews. Deliver one atomic plan plus implementation in one Ready AI-repository PR. The user authorized its merge and live AX synchronization, then resumption of the separately accepted dashboard fix. No cleanup, force push, dependency changes, generic retry orchestration, or unrelated runtime changes are authorized.

## Evidence and canonical ownership

The runner's `launchArgs` supplies `--cwd` but no `--workspace`. Paseo's existing run-workspace resolver gives an explicit workspace priority over the caller-agent workspace; an agent-scoped caller otherwise inherits its workspace. The reproduced dashboard handoff therefore returned a valid implementer ID with an AI-repository cwd, not the accepted dashboard worktree. The implementer correctly stopped before edits. Merely registering a project does not bind a launch to a workspace.

Extend `skills/handoff-brief/scripts/paseo-workflow.ts` and its state owner, their current unit/pressure tests, and the owning Pi/Paseo workflow reference. Reuse the existing transport, locked transitions, role routes, snapshots, phase limits, and user-authorized continuation principles. Paseo's public workspace list/create and agent run/inspect/send commands own provider mechanics. No alternate coordinator, direct unmanaged Pi launch, model override, or hand-edited workflow state is needed.

## Workspace binding

Resolve a concrete Paseo workspace identity for the workflow's canonical cwd before dispatch. Reuse a unique existing workspace whose directory matches; allow an explicit workspace identity only after validating the same directory. Do not infer from a similar project name, a containing repo root, or the caller's ambient workspace. Reject ambiguous matches and mismatched supplied identities before reserving/launching an agent.

If the accepted target worktree has no workspace, the owning mode may register a local-backed Paseo workspace for that exact already-owned directory through the supported workspace-creation path. This registers existing work; it does not create another Git branch, choose another cwd, archive anything, or run unaccepted setup. Record the returned identity and verify the directory before using it. A lost creation response is an uncertain provider mutation: inspect before any retry, never create duplicates blindly.

Persist the binding in task state and revalidate it at launch. Pass explicit `--workspace` as well as the accepted cwd for every role, including reviewers. Keep existing versioned state readable; legacy workflows resolve the binding through a supported locked path, not external JSON editing. A missing/archived/moved workspace or changed canonical directory blocks dispatch with a clear workspace error.

## Verify before releasing work

A returned agent ID alone does not transfer write ownership. Launch with an inert startup assignment that grants no task edits, reviewer reads, or further launches. Inspect the known returned session, verify its cwd and configured provider/model/effort, and only then deliver the immutable phase assignment through Paseo. Keep the assignment snapshots and finite dispatch reservation model intact.

The implementation owner starts edits only after the runner records a verified identity and releases the accepted assignment. Reviewers likewise receive their artifact only after location verification. Ensure no write-bearing prompt reaches a misrouted session during the inspection race. Use a bounded startup wait if needed; do not send into an unconfirmed active startup turn.

Persist the session identity before further calls so a timeout/crash cannot lose a known agent. Record reservation, verification, and assignment-release uncertainty explicitly. An unknown identity, unverifiable session, duplicate identity, or uncertain send never becomes success and never causes an automatic replacement or duplicate assignment. A known mismatch is a hard blocked launch, not a successful owner; preserve its evidence and keep it inert. Existing reviewer degradation/fallback rules remain intact without replacement reviewer rounds.

## Explicit recovery of a known misroute

Add one narrowly scoped owner-driven retry transition for an existing implementation handoff whose known session ran in the wrong cwd and did no implementation work. Require explicit user authorization bound to the previous agent ID, accepted target directory/branch/head, and preserved brief/plan snapshots. Reinspect that exact session and require it to be inactive and no longer the write owner. Verify the target Git head and dirty-file inventory against the accepted handoff; the original untracked plan is permitted, unrelated drift is not.

Preserve the old handoff identity, error, and inspected evidence in the existing `Workflow.history` archive, extending its record shape where needed rather than adding a separate attempts ledger. Retain planning review reports, fingerprints, triage, policy, and immutable handoff content. Reserve the explicitly authorized replacement attempt under the existing lock and launch a fresh Sol session through the corrected workspace path. Release sole write ownership only after its verified location. Duplicate invocations must not start another agent or resend an assignment. A lost identity remains blocked for human-directed inspection, not eligible for this known-misroute retry.

Reject recovery after implementation writes, active ownership, changed targets, missing snapshots, unknown original IDs, completed implementations, or used review/repair phases that would make replay ambiguous. Do not stop/delete/archive agents or reset phase counters implicitly. This retry repairs a dispatch failure; it does not grant another implementation review round or terminal authority.

## Scope, risks, and rollout

The workspace selection and verification path plus narrow legacy recovery form one coherent launch-safety outcome. A workspace-flag-only patch would still accept a wrong returned session, and a generic retry without verified routing would reproduce the bug. Keep one PR, no POC. Aim for 10 files/500 changed lines; cohesive runner/state/test updates may exceed 500 because both launch safety and recovery need independent proof. Stay below 15 files/1,000 changed lines or return for a scoped size exception; do not compress code or scatter files to satisfy a count.

Primary risks are cross-repository edits, duplicate sessions after crashes, stale ownership, accidental replay of reviewed work, and bootstrap changes that bypass the live-runtime boundary. Address these in existing transport/state tests and writing-skills pressure scenarios. Reuse shared code only where it reduces duplicated invariants; avoid a new general event-sourcing or retry framework.

Exercise feature-branch behavior only with isolated HOME/runtime roots and test provider state. Keep the installed runtime unchanged before merge. This AI fix can bootstrap using the existing runner because its accepted worktree is the planner's current Paseo workspace; verify the actual launch identity before handing over. After review and authorized merge, require the clean worktree owning main to fast-forward to origin/main, then run live AX sync and validation. Only then use the supported recovery path on the preserved dashboard task. No previous dashboard plan/review evidence is discarded.

## Acceptance and proof

Before full implementation, confirm the installed CLI contract through read-only help/source inspection and available prior provider evidence: `run` must support explicit workspace selection, `send` must deliver a follow-up prompt to the existing background session, and `inspect` must expose its cwd and role identity. An unsupported surface blocks the verify-before-release design; do not silently substitute another launcher. Prove the complete two-step sequence through the existing injected transport with isolated state before feature activation, then verify it against Paseo through the authorized post-merge recovery.

- A caller in workspace A requests accepted cwd B: the launch uses B's explicit identity and its inspected session cwd is B. Inherited A must fail the RED scenario.
- Unique existing workspace reuse and authorized local workspace registration are deterministic; wrong explicit IDs, ambiguous cwd matches, moved/archived workspaces, and lost responses do not launch task work or create duplicates.
- Wrong cwd or role/model inspection prevents the actual assignment from being delivered; successful verification releases exactly one bounded assignment. Test crash/timeout boundaries around identity persistence and assignment sending.
- The real failed dashboard-state shape can be recovered on an isolated copy: original attempt and planning fingerprints remain, one newly authorized replacement launches, and repeated recovery cannot duplicate it. Unknown identity, active original session, Git drift, or existing implementation work block recovery.
- Preserve ordinary single-round reviews, fallback evidence, continuation policy, immutable snapshots, finite repair limits, and terminal-authority tests.
- Run focused runner unit tests, complete native hook validation, charter validation, and writing-skills RED/GREEN scenarios for the changed agent behavior. Name exact evidence rather than claiming process exit alone proves a launch.
- Verify the real post-merge recovery starts the dashboard implementation in its own registered project's intended worktree. Resume its existing accepted product and merge/install contract; report any remaining blocker without deleting state.

The personal AI repository route has neither required hosted CI nor a hosted reviewer under its active repository policy. Publish Ready and verify exact provider identity without inventing a review or passing an absent gate. The user authorized merging this one runner fix and syncing AX; that authority does not extend to unrelated PRs or cleanup.
