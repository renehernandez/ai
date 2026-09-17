# Pi and Paseo workflow

This contract applies to AX-managed Paseo providers running Pi. It is the
explicitly accepted Pi workflow: one local review round per phase, one hosted
repair batch, and Ready publication. It takes precedence over older generic
draft-until-merge and repeated-review guidance in these sessions. Explore, Plan,
Execute, Review and Finish retain their authority. Merge requires separate
user authority.

## Work without model selection

Use the configured planner for brainstorming, research and the initial plan.
Role model and effort come from the managed Paseo provider command. Never ask
the user to select a worker model, override it, or substitute another model.
Unavailable reviewer models and incomplete reviewer responses are degraded evidence, never passing reviews. The owning Astra or Sol session records a complete inline fallback assessment against the same lenses before advancing. Uncertain implementer launch, missing session identity, corrupt state, snapshot failure, or ownership-transfer failure remains a hard blocker.

The planning owner starts one planning review round. GLM and DeepSeek each
review the whole plan against every applicable lens from the Review catalog.
Keep their independent reports, including a distinct code-simplifier result.
Deduplicate findings and evaluate whether each applies. Incorporate relevant
findings; ask the user when a material judgment is uncertain. Do not start a
second review round after repairs.

## Hand off to implementation

Use Handoff Brief to carry the accepted objective, reviewed plan, constraints,
design rationale, original evidence references, acceptance criteria and named
verification layers. Include repository, worktree, branch, target base, current
head, dirty files, unresolved risks, publication host and automated reviewer.
Keep the brief and workflow state task-local. Preserve the plan's durable
content in the repository; do not commit private review receipts.

When implementation is accepted, the Plan owner uses the handoff runner to
start a new Paseo-managed Sol session with that brief. Record the returned
session identity and transfer write ownership before Sol starts edits. The
planning session remains available for user conversation; it does not keep
writing the implementation worktree. Do not fork accumulated conversation or
reuse a previous worker session for the handoff.

Sol follows Execute, implements the accepted work and runs the project-native
verification. Reviewers only read the frozen artifact. Independent concurrent
tasks use separate singly owned worktrees.

## Review implementation once

Run one parallel round with GLM, DeepSeek and Astra. Each covers the complete
applicable review checklist, including simplification, quality, correctness,
deslop and scrutiny. Add security, migration/data, production and documentation
lenses when the change requires them. Thermonuclear review is quality-review
depth, not an extra worker. Do not spawn a worker per lens.

Bind reports to the inspected source and base. Require a complete nonempty
report from every model when available. A reviewer timeout, provider error,
malformed report, truncated response, or unavailable reviewer records degraded
evidence; it never becomes a pass and never triggers replacement dispatch. Sol
must assess the missing lens coverage inline and record that fallback before
advancing. A valid `blocked` outcome remains unresolved until repaired, answered,
or covered by an exact scoped user waiver. Never treat an exit code alone as
review evidence.

Sol evaluates the combined findings, applies relevant repairs and runs the
affected verification. Record rejected findings with reasons. Escalate material
uncertainty to the user. This is one local repair batch; do not automatically
rerun reviewers after it. Identify the reviewed, degraded, waived, and subsequent
repair heads accurately instead of claiming repairs received another independent
review.

## Publish and follow hosted feedback

Finish uses Change Request Create to publish the hook-clean implementation as
a Ready PR or MR and requests the configured Genie or Nitro review. This managed
Pi/Paseo Ready-publication contract takes precedence over generic Standard draft
publication rules. Respect
the provider-specific review request mechanism. Publication never authorizes
merge, deployment or cleanup.

The finite monitor collects required CI and the complete configured review for
the published head. Poll quietly while nothing changes. Stop on completion,
failure, required user input or deadline; the default deadline is 30 minutes.
Report missing reviewer evidence explicitly. A completed review is evidence to
triage, not an automatic assertion that all findings are valid or resolved.

Sol evaluates one hosted findings batch, fixes applicable issues, verifies and
pushes through native hooks. Keep the artifact Ready. Report current CI and
any later automated feedback, but do not start another repair batch. Stop with
the open PR/MR URL, reviewed and current heads, repairs, rejected findings and
remaining gaps. A second repair batch requires a new user instruction.

## Enforced boundary

Paseo owns session creation and visibility. Use the finite handoff runner for
workflow launches; do not call generic create-agent tools, recursive delegation
or another orchestration package. Its state records each phase dispatch before
launch and prevents automatic duplicate rounds or repairs.

The managed Pi wrapper fixes role/model/effort and waits for the mandatory
adapter before forwarding the first prompt. The adapter enforces role identity
and tool policy during work. Reviewers can only read, search and list files.
Existing force-push and deletion policies govern supported shell calls.
MCP is available to nonreview roles through the pinned adapter; unrestricted
script dispatch and direct agent-creation operations are excluded.

These controls govern managed launches and tools. They are not an operating
system sandbox, and direct unmanaged Pi sessions do not acquire these guarantees.
Do not change live runtime configuration to work around a failed control.

## Runner interface for lifecycle owners

Drive the runner from the owning session; the user does not operate these
transitions manually. Use Node 26 and private files outside the repository for
state and input. The installed Review skill supplies the canonical lens catalog.

```bash
node ~/.agents/skills/handoff-brief/scripts/paseo-workflow.ts STATE ACTION INPUT.json
```

Each input is one JSON object. The following table is the readable input
contract; omit optional fields unless needed.

| Action | Input fields and owner |
| --- | --- |
| `init` | Plan: `cwd`; optional `configPath`, `timeoutSeconds`, and `additionalLenses` keyed by planning/implementation. |
| `review` | Plan or Execute: `phase`, `artifactPath`, and implementation `head`. The artifact includes the exact diff/base or complete plan and original evidence references. Dispatches once and collects. |
| `collect` | Owning mode: `phase`; retrieves the existing sessions without starting replacements. |
| `triage` | Plan or Execute: `phase`, `decisions` containing each finding's `id`, `action` (fix/dismiss/question) and `reason`; for each degraded reviewer, `assessments` with its `role` and the owner's complete inline `assessment`. |
| `waiver` | Owning mode: `phase`, exact current `target`, exact `requestedAction`, nonempty `failedGates`, and `reason`. Records failed evidence without granting the action itself. |
| `handoff` | Plan: `briefPath`, `planResolution`; creates the fresh Sol session and records its identity. |
| `repair` | Execute: `phase` (implementation/hosted), `stage` (start/complete); completion includes `head` and named `verification`. |
| `publication` | Finish: observed `artifactUrl`, `head`, `reviewer` (genie/nitro), `ready: true`, and `evidence`. |
| `monitor` | Finish: `probeCommand` argv array; optional `deadlineMs` and `pollMs`. |
| `finish` | Finish: current observed publication fields and final evidence; does not merge. |
| `status` | No input required. Inspect persisted phase, reports and unresolved gaps. |

For monitoring, use the installed Finish probe as `probeCommand`: Node followed
by `~/.agents/skills/finish/scripts/paseo-hosted-probe.ts`, `--artifact-url`,
the URL, `--head`, the full SHA, `--reviewer`, the configured reviewer, and
`--bot-login`, its verified policy identity. Expand paths before building argv;
no shell interpolation is involved. Probe output is raw evidence for semantic
triage. Never convert a missing bot completion or absent CI policy into a pass.

For GitHub repositories that intentionally have no required CI, pass
`--no-required-ci-evidence` with the project-policy source or explicit user disposition.
An empty check list alone does not establish that policy. This exception applies
only to an empty required check set; it cannot excuse failed, pending or unknown
CI, or missing reviewer completion.

The runner stores review artifacts, lens definitions and handoff content in
private read-only snapshots beside its state. Launch prompts carry snapshot paths
and digests instead of full documents. Preserve these snapshots with the task;
editing an original document does not change an already-dispatched assignment.

Continue past degraded reviewer evidence only after recorded owner fallback
assessment or an exact scoped waiver. Stop on any hard-failed orchestration phase
and report the saved error. A reserved launch with no returned identity needs
Paseo inspection before human-directed recovery; never delete state to bypass
the one-pass limit. Before acting on a waiver, the runner compares its interpreted
target with the current artifact or head. A waiver preserves failed evidence,
does not grant its requested terminal action, and never permits force-push,
credential disclosure, hook bypass, destructive action without authority, or a
provider/OS-denied operation. After hosted repair, inspect
and report later feedback through Finish without restarting the repair monitor.
