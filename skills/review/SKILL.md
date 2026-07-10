---
name: review
description: Use when inspecting a planning artifact, code diff, POC head, final implementation head, or hosted review finding without mutation.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion, Bash
---

# Review

## Authority

Review is read-only. It inspects one exact artifact fingerprint, target-base
diff, or Git HEAD and never fixes, commits, publishes, polls through provider
mutation, or merges. For non-trivial entry, announce `Review`, read-only
authority, and the target once.

## Target-Specific Baselines

Use `scripts/review-contract.ts` to select the deterministic baseline.

Planning or OpenSpec targets always run:

1. `implementation-readiness`
2. `edge-cases-and-risk`
3. `simplification-and-scope`
4. `refactoring-opportunities`

POC or final implementation targets always run:

1. `correctness`
2. `regression-risk`
3. `maintainability`
4. `verification-quality`

Add affected-domain specialists such as security, documentation/agent
alignment, AX/skill compatibility, data, infrastructure, or UI. Reviewers stay
read-only and return `passed`, `finding`, or `blocked` with file/line evidence
where applicable.

An in-scope planning finding returns to Plan. An in-scope implementation
finding returns to the same Execute owner. A material scope, architecture,
safety, migration, or delivery change returns to Plan. Target changes invalidate
all evidence tied to the previous fingerprint, base, or HEAD.

## Hosted Feedback

Review normalizes provider comments, automated review, CI, and approvals after
Finish performs the required provider interaction. GitHub, generic GitLab, and
Fullscript GitLab/Nitro retain their configured policies. Feedback for a stale
source HEAD or target-base SHA never passes a latest-effective-diff gate, and
hosted gates never replace the local baseline.

Inspect the complete available feedback surface for every configured required
reviewer, not only its summary status or opening sentence. For Nitro, read the
entire response and all unresolved Nitro-authored discussions. Reassuring text
such as `no findings` does not clear actionable language later in the same note
or applicable findings carried forward from older heads.

Keep provider, artifact URL, target base, head SHA, normalized status, and
findings in the task handoff. Keep reviewer identities, transcripts,
fingerprints, retries, and mode state out of commits, tracker records, and
hosted descriptions.

## Publication Checkpoint

Before every push, PR/MR creation, or PR/MR update, emit a task-local
`publication_checkpoint` only when all are current for the exact target:

- target-base ref, its exact resolved SHA, and implementation HEAD;
- inspected target-base diff;
- hook evidence;
- required local baseline and specialists;
- resolved provider route; and
- no blockers.

`scripts/review-contract.ts` validates this checkpoint. Any HEAD or resolved
target-base SHA change makes it stale. If evidence cannot be recovered after
resume, rerun it; do not reconstruct persisted gate state.

## Common Mistakes

| Mistake | Required response |
| --- | --- |
| Using planning reviewers on implementation code | Run the implementation baseline. |
| Treating Nitro or CI as local Review | Evaluate it as a separate hosted gate. |
| Fixing a finding from Review | Return it to Plan or the Execute owner. |
| Reusing evidence after the target changes | Rerun affected lanes and checkpoint inputs. |
| Persisting reviewer ledgers or gate state | Keep evidence task-local and recomputable. |
