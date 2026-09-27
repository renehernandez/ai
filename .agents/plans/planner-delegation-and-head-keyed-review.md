# Planner Delegation and Head-Keyed Review

## Goal

Make the managed Pi/Paseo planner a pure orchestrator, and make local review
follow the code instead of the handoff that produced it.

A managed tripdy planner session implemented an accepted UI change itself,
published PR #2, and then could not start a local review round. The runner's
`review` action for implementation requires a completed implementer handoff
whose report head equals the reviewed head. No handoff existed, so no review was
possible. The same precondition also blocks a user-authorized fresh round after
any repair: `continuation` keeps the original handoff, whose report head no
longer matches the repaired head.

This change closes both paths:

1. The planner never writes implementation code. Every implementation, repair,
   and review runs in a fresh runner-launched agent, so the planner's context
   stays clean.
2. Review evidence is keyed to the exact head, as in pstack's verification
   ledger. Every new head automatically receives a fresh review round, bounded
   at three rounds per phase.

## Selected approach

### The planner only orchestrates

The Pi policy enforces the planner role instead of relying on instructions:

- `edit` and `write` are allowed only for `.agents/plans/**` inside the workflow
  cwd and for private task files outside every Git work tree, such as briefs
  and runner state. Any other path, including another repository, is denied
  with a message naming the runner `handoff`.
- Git commands that change repository content are denied for the planner:
  `commit`, `add`, `rm`, `mv`, `reset`, `restore`, `checkout`, `switch`,
  `merge`, `rebase`, `cherry-pick`, `revert`, `stash`, `apply`, and `am`.
  Read-only git, `push`, and `gh`/`glab` publication stay allowed because the
  planner owns Finish.
- The implementer commits the atomic plan with the implementation, keeping one
  change set.
- Reconciling a moved target base, resolving conflicts, and any other change
  to branch content are fresh implementer tasks, as in pstack's Orchestrate
  playbook. The resulting head receives a review round like any other.

Routing follows the existing accepted-proposal contract in
`rules/investigation-and-implementation.md`. Acceptance is inferred from
context, never from a particular word. When that contract selects Execute in a
managed planner session, Execute means a runner `handoff` to a fresh
implementer. `execute` and `paseo-orchestration` state this once and point to
the contract; neither adds trigger phrases or acceptance logic. Small changes
follow the same route.

Shell writes such as `sed -i` or redirections remain outside what the policy
can prove, as the injected contract already says. The commit denial keeps a
stray planner edit from becoming a planner-authored head.

### Head-keyed review rounds

Each phase keeps an ordered list of review rounds instead of one round. A round
records its target, its reviewer reports, its triage, and at most one repair.

- **Target.** An implementation round targets the workflow worktree head. The
  runner reads branch and head with `git rev-parse` and rejects a
  caller-supplied head that differs. Uncommitted files are recorded as
  evidence, as report verification already does, and are not reviewed. The
  runner refuses a round while an implementer or repair is in flight. It no
  longer requires the head to equal a handoff report head. A planning round
  targets the plan artifact fingerprint.
- **Verdict.** A round whose triage has no `fix` decisions and no open
  questions is a clean verdict for its target. A new head or plan fingerprint
  has no verdict until a round reviews it.
- **Fresh agents.** Each round launches three fresh Sol reviewers with the
  existing roster, lens assignment, snapshots, and degraded-evidence rules. Each
  repair launches one fresh implementer. The runner never resumes a worker.

### Automatic re-review loop

`nextStep` drives the loop without a user prompt:

1. After handoff completion, dispatch implementation round 1 on the worktree
   head.
2. After triage with `fix` decisions, dispatch one fresh repair.
3. After the repair report is recorded, dispatch the next round on the repaired
   head.
4. After a clean verdict, continue to publication.

Planning follows the same loop. The planner revises the plan from triaged
findings, and the changed fingerprint receives the next planning round. Hosted
feedback also follows it. A hosted repair head receives a fresh local
implementation round before Finish pushes it, and the pushed head re-arms the
hosted probe for the next hosted batch.

Publication requires a clean verdict for the published head. Finish requires a
clean local verdict and a completed hosted gate for the final head.

### Bound

Planning and implementation each allow at most three review rounds before
publication. Hosted feedback allows at most three repair batches, and each
hosted repair head's local round belongs to that batch rather than to the
implementation budget. When the last allowed round still has `fix`
decisions or open questions, the workflow stops at `awaiting-user` with the open
findings, the reviewed heads, and the repairs. It never repairs past the bound,
starts a fourth round, or downgrades findings to pass. The existing
`continuation` action remains the user-authorized way to open a new bounded
batch.

### State compatibility

New states carry a new orchestration marker. States written with the
single-round shape stay readable through `status`; `tick` and every dispatch
refuse them, following the existing pre-orchestration precedent. Nothing
migrates them.

## Reuse and deviation contract

- **Inspected precedents:** `review`, `nextStep`, `transition`, and
  `continuation` in `skills/paseo-orchestration/scripts/`; implementer report
  verification through `git rev-parse`; `hooks/pi/policy.ts` role tools and
  the Paseo dispatch denial; `references/paseo-workflow.md`; the
  accepted-proposal contract; `planner-orchestrated-paseo-workflow.md` and
  `paseo-runner-hardening.md`; the tripdy session
  `1c89c2d8-6065-477f-a47d-a2983efd784b`; pstack's Orchestrate playbook,
  Autonomous run, and `interrogate`, read through `ericlitman/open-pstack`.
- **Extended:** the runner owns rounds, verdicts, and the loop bound. The Pi
  policy owns planner write and git denials. The accepted-proposal contract
  keeps owning acceptance, and `execute` and `paseo-orchestration` only add
  role routing.
- **New mechanisms:** none outside existing owners. The round list replaces the
  single round in the runner state.
- **Deliberate deviations:**
  - The one-round and one-repair-batch limits give way to automatic re-review
    bounded at three, following pstack's rule that a new head voids its
    verdict.
  - pstack lets a single-agent task run inline. This workflow keeps the planner
    out of code for every task size.
- **Rejected:**
  - an `adopt` action for planner-authored heads, which the planner block makes
    unnecessary;
  - binding a fresh round to `continuation.expectedHead`, which head-keyed
    evidence replaces;
  - word-based routing of acceptance;
  - unbounded re-review.

## Out of scope

- Reviewer rosters, lens catalogs, models, and timeouts.
- Claude Code and Codex hooks.
- Merge, deployment, and cleanup authority.
- Recovering tripdy PR #2. After merge and live sync, it can go through a fresh
  runner handoff.

## Acceptance

Policy unit tests and runner behavior tests with the fake Paseo transport prove:

1. **Planner writes.** The planner can edit `.agents/plans/**` and files outside
   every Git work tree. Its edits or writes to other cwd paths or to another
   repository are denied. The implementer's tools are unchanged.
2. **Planner git.** The listed mutating git commands are denied for the
   planner, including nested shell payloads. Read-only git, `git push`, and
   `gh pr create` stay allowed. Existing Paseo, force-push, deletion, and
   compound denials keep their messages.
3. **Head binding.** An implementation round records the worktree head from
   `git rev-parse` and any uncommitted files as evidence. A mismatched caller
   head, or a round requested while a writer is in flight, is rejected. No
   handoff-report precondition remains.
4. **Automatic loop.** Handoff, round 1 with a fix, repair, then tick yields
   round 2 on the repaired head. A clean round 2 yields publication. A tick
   after a repair never requires `continuation`.
5. **Planning loop.** A planning round with fixes followed by a changed plan
   yields planning round 2. An unchanged fingerprint is refused.
6. **Bound.** A third round with fixes yields `awaiting-user`. A fourth round or
   repair is refused. `continuation` opens a new bounded batch.
7. **Verdict gates.** Publication on a head without a clean verdict is refused.
   A hosted repair head receives a local round before Finish accepts it, even
   after the implementation phase used all three rounds.
8. **Legacy state.** A single-round state stays readable through `status`, and
   `tick` and dispatch refuse it.
9. **Routing text.** `execute`, `paseo-orchestration`, and the injected contract
   route managed-planner Execute to `handoff` through the accepted-proposal
   contract, without trigger phrases.

## Verification

- `pnpm run biome:lint-format`
- `pnpm run charter:validate`
- `pnpm run skills:validate`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `writing-skills` validation of the changed skills, injected contract, and Pi
  policy behavior.
- AX sync exercised only with isolated HOME and runtime roots before merge.

## Delivery

One atomic plan and one final PR on the personal GitHub `origin`
(`renehernandez/ai`). Repository policy requires no hosted CI and no hosted
reviewer on this route. The measured diff, 10 files and about 1,420 changed
lines, exceeds the 1,000-line cap under explicit user approval: the planner
block and the head-keyed loop are one contract, since dropping head provenance
is safe only because the planner cannot commit. Merge requires separate user authority. After merge,
live `pnpm ax sync` and `pnpm ax validate` run from the verified clean main
worktree, which also replaces the stale `handoff-brief` runner install.

## Risks

- **Review cost.** Up to three rounds per phase triples reviewer spend in the
  worst case. The bound and the `awaiting-user` stop cap it.
- **Planner friction.** Planner sessions that used to make quick fixes must hand
  off. That is the intended behavior, and the denial message names the runner
  action.
- **Unprovable shell writes.** The policy cannot see every shell file write. The
  commit denial and the implementer's uncommitted-file evidence make a stray
  write visible instead of reviewed as worker output.

[confidence: 0.80 - high | reason: every change extends an existing owner, the
tripdy session and runner source show both failures, and pstack supplies the
head-keyed precedent; the three-round bound is a judgment call]
