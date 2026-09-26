# Paseo Runner Hardening

## Goal

Close three gaps that the first live end-to-end run of the planner-orchestrated
Paseo workflow exposed (`planner-orchestrated-paseo-workflow.md`, PR #17). The
orchestration design stays unchanged.

1. Runner actions other than `tick` print the full workflow state, about 25 KB
   per call. A long-lived orchestrator accumulates that on every dispatch,
   triage, repair, and order call.
2. The runner binds a caller-supplied head to an implementer's free-text report
   by short-SHA substring. The scratch report named both the starting commit
   and the real head, so the starting commit would also have bound.
3. Both scratch implementers chained shell commands in one call, against
   `rules/command-and-tools.md`. One also issued `git add` and `git commit` as
   parallel tool calls and hit an `index.lock` conflict.

## Selected approach

### Compact action results

Every runner action except `status` prints one JSON line. The line has the same
shape as the current `tick` result: the action, what changed, any new IDs
(agent, round, batch, order), and the `nextStep` result. Errors keep going to
stderr with a nonzero exit. `status` still prints the full state and remains the
only full-state read.

When a tick records an implementer or repair completion, its entry names the
verified head. The orchestrator can then dispatch implementation review or
record repair completion without reading `status`.

### Structured implementer reports

Implementer and repair assignments require a final machine-readable envelope,
following the reviewer `AX_REVIEW_BEGIN`/`AX_REVIEW_END` precedent. The envelope
holds one JSON object with `branch`, the full 40-character `head`, `commits`,
`verification`, `deviations`, and `risks`. The prose report may precede it.

When a tick records the completion, the runner:

- requires exactly one envelope and a well-formed object;
- compares `branch` and `head` with the workflow worktree through
  `git -C <cwd> rev-parse`, as resume verification already does;
- records the parsed report, including the observed uncommitted files as
  evidence. Uncommitted files do not fail the report.

A missing, ambiguous, or malformed envelope, or a head or branch that does not
match the worktree, marks the session `failed`. The existing `nextStep` gate
then returns `awaiting-user` for human-directed recovery. The runner never
guesses a head.

The `review` action for implementation and `repair` `complete` require the input
head to equal the recorded head exactly. Short-SHA substring matching is
removed. States recorded before this change hold only free-text reports and
fail that check; nothing migrates them.

### Compound shell commands denied for write roles

The Pi shell policy denies any command with more than one shell segment for the
`planner` and `implementer` roles. That covers `&&`, `||`, `;`, pipes,
background `&`, subshells and command substitution, and newline-separated
commands. It enforces the existing rule rather than adding one. Reviewers
already have no shell.

- The segment check reuses the shared tokenizer without changing what
  `tokenize` returns, so the Claude and Codex force-push and deletion hooks keep
  their behavior.
- Quoted operators and redirections such as `2>&1` stay allowed.
- Paseo, force-push, and deletion policies run first and keep their denial
  messages.
- The denial names the rule and says to issue one command per call.
- Known false positive: heredocs such as `git commit -F - <<EOF` are split at
  each newline and denied. Workers use `-m` or `-F <file>` instead.

The implementer assignment also states: one command per tool call, and never
issue git mutations as parallel tool calls. The scratch `index.lock` conflict
came from parallel calls, which a shell-string policy cannot see.

## Reuse and deviation contract

- **Inspected precedents:** `parseReview` and the reviewer envelope; resume
  verification's `git rev-parse` in `paseo-workflow.ts`; the compact `tick`
  result and `nextStep`; `hooks/pi/policy.ts` layering over
  `hooks/shell-command.ts`; `rules/command-and-tools.md` shell discipline;
  the scratch-run state under `/private/tmp/ax-orchestrator-e2e/state/`.
- **Reused or extended:** the runner owns report parsing and output; the Pi
  policy owns shell denial; the shared tokenizer owns shell splitting. The
  injected contract `references/paseo-workflow.md` documents all three.
- **New mechanisms:** none beyond a tokenizer-level segment count and the
  implementer envelope parser beside `parseReview`.
- **Rejected:**
  - denying only chained git mutations, which leaves the rule mostly unenforced
    and misses the observed parallel-call conflict;
  - a per-session in-flight git mutation guard in the Pi adapter, which adds
    adapter state for a failure that the assignment text addresses;
  - an automatic retry on a malformed report, which would add autonomy the
    orchestration contract does not grant.

## Out of scope

- Orchestration design, heartbeat lifecycle, review rosters, lenses, and limits.
- Claude Code and Codex shell hooks.
- A `status` selector or summarized status view.

## Acceptance

Behavior tests with the fake Paseo transport and policy unit tests prove:

1. **Compact output.** Each non-`status` action prints one JSON line that names
   the action, changes, new IDs, and the next step, and omits the lens catalog
   and review outcomes. `status` still prints the full state.
2. **Head in tick.** A tick that records an implementer completion names the
   verified head.
3. **Structured binding.** A valid envelope whose head matches the worktree is
   recorded. Implementation review and repair completion accept only that
   exact head. A report naming an older commit in prose cannot bind it.
4. **Report failures.** A missing, duplicate, or malformed envelope, or a
   head or branch mismatch with the worktree, marks the session failed and the
   next step is `awaiting-user`.
5. **Uncommitted files.** A matching report with uncommitted files is recorded
   with those files as evidence.
6. **Compound denial.** For `planner` and `implementer`, `a && b`, `a; b`,
   `a | b`, `a &`, `echo $(b)`, and newline-separated commands are denied with
   the shell-discipline message. Quoted operators, `2>&1`, and every
   currently allowed policy case stay allowed. Existing Paseo-policy denials
   keep their messages.
7. **Assignment text.** Implementer and repair assignments require the envelope,
   one command per tool call, and no parallel git mutations.

## Verification

- `pnpm run biome:lint-format`
- `pnpm run charter:validate`
- `pnpm run skills:validate`
- `pnpm run test:unit`
- `pnpm run test:integration`
- `writing-skills` validation of the changed injected contract and Pi policy
  behavior.
- AX sync exercised only with isolated HOME and runtime roots before merge.

## Delivery

One atomic plan and one final PR on the personal GitHub `origin`
(`renehernandez/ai`), branch `paseo-runner-hardening`. Repository policy
requires no hosted CI and no hosted reviewer on this route. Push and PR use the
`renehernandez` `gh` account, then the previously active account is restored.
Merge requires separate user authority. After merge, live `pnpm ax sync` and
`pnpm ax validate` run from the verified clean main worktree.

## Risks

- **Policy friction.** Workers that habitually chain read-only commands will hit
  denials and must retry one command at a time. The denial message names the
  fix, and the one-command rule already applies.
- **Stopped runs.** A worker that omits the envelope stops the run at
  `awaiting-user`. The assignment text and the reviewer-envelope precedent make
  this rare, and a stop is safer than binding an unverified head.

[confidence: 0.85 - likely | reason: each change extends an existing owner with
direct precedent; the scratch run supplies the failure evidence; heredoc denial
is the one accepted false positive]
