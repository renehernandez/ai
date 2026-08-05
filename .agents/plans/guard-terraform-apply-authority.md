# Guard Terraform Apply Authority

## Objective

Prevent a planned or discussed live infrastructure mutation from becoming an
agent-executed action unless the user separately assigns that exact mutation to
the agent. A user's statement that they will perform an action must reserve the
action to the user rather than being misread as confirmation for the agent.

## Approach

- Extend the accepted-proposal contract in
  `rules/investigation-and-implementation.md` with executor binding for live
  mutations. Planning, documenting, or accepting a plan that contains a live
  mutation establishes no execution authority by itself.
- Treat first-person user ownership such as `I'll apply this locally` as an
  explicit human-execution boundary. The agent may continue preparing the
  reviewed artifact but may not adopt the reserved action without an exact
  assignment naming the agent, whether in the same message or later.
- Require agent execution authority to identify the exact live mutation, its
  target environment or workspace, and the agent as executor. Preserve the
  existing semantic-assent model after those elements have been separately
  presented; introduce no magic confirmation word or intent parser.
- Project the canonical contract into the Fullscript Terraform rule so apply,
  destroy, import, mutating state operations, and tests that create real
  resources are treated as live infrastructure mutations. Keep format,
  validate, and plan available as non-live-mutation proof.
- Add deterministic RED/GREEN pressure coverage based on task
  `019fb9dd-82c3-78d3-ae06-c190b757b297`, including the user's statement that
  they would apply the Terraform changes locally.

## Material Decisions And Constraints

- Deliver one atomic plan and implementation in one final draft GitLab MR.
- Keep `rules/investigation-and-implementation.md` as the canonical owner of
  conversational authority. The Terraform rule is a domain projection, not a
  second authority system.
- Preserve ordinary Plan, Execute, Review, and Finish continuation through the
  accepted delivery checkpoint. The new boundary applies only when live
  mutation execution would otherwise be inferred.
- Do not make Terraform apply permanently human-only. A user may still
  delegate one exact apply after its target and agent executor are explicit.
- Do not add dependencies, a command parser, persistent approval state, or a
  new lifecycle mode.
- Terraform apply, deployment, merge, cleanup, and live AX synchronization are
  outside this change's execution authority.

## Reuse And Deviation Contract

Reuse the accepted-proposal and terminal-action mechanics in
`rules/investigation-and-implementation.md`, the Fullscript Terraform command
classification in `rules/ci-infra-and-cloudflare.md`, and the lifecycle
authority pressure tests in `tests/unit/agent-workflow-lifecycle.test.ts`.

Extend those canonical owners directly. Do not duplicate executor semantics in
AGENTS entrypoints or lifecycle skills. The only genuinely new contract is the
distinction between accepting that a live mutation should occur and assigning
the agent to execute it. This deviation is required by the observed task, where
`I'll apply those changes locally` did not reliably exclude agent execution.

End-to-end proof is one behavior scenario that reads both canonical rules and
fails unless plan inclusion is non-authorizing, first-person user execution is
exclusive, and exact action, target, and agent assignment are all required.

## Acceptance

- Planning, documenting, recommending, or accepting a plan that contains a
  live mutation never grants authority to execute that mutation.
- `I will` or `I'll` perform an action assigns it to the user and excludes the
  agent unless the same message or a later one exactly assigns it to the agent.
- Agent execution of a live mutation requires a separately presented exact
  action, target environment or workspace, and explicit assignment to the
  agent.
- Semantic assent remains valid after the complete executor-bound proposal is
  presented; no prescribed confirmation word is introduced.
- Terraform apply, destroy, import, mutating state operations, and real-resource
  tests use the live-mutation boundary. Format, validate, and plan do not grant
  apply authority and remain allowed as non-live-mutation proof.
- A pressure scenario reproducing the cited Stat migration conversation stops
  at the proposed MR and reviewed Terraform plan, while a scenario explicitly
  assigning one exact targeted apply to the agent can cross the boundary.
- Shared rules and tests retain one canonical authority model with no
  contradictory entrypoint or lifecycle-skill wording.

## First Real Confirmation

Run the focused lifecycle-authority unit tests. The cited migration scenario
must prove that a planned future apply plus `I'll apply those changes locally`
leaves the agent with artifact-preparation authority only. A positive control
must require an exact mutation, target environment or workspace, and explicit
agent assignment before recognizing execution authority.

## Delivery

Publish this plan and implementation together in one draft GitLab MR targeting
`main`. Use the native hook-enabled commit gate, exact-head local Review, GitLab
CI, and configured Nitro review. Leave the MR draft; do not merge, deploy,
apply Terraform, clean up, or synchronize the live AX runtime.
