# Behavioral Test Selection

## Goal

Prevent agents from adding low-value tests or documentation that restate
implementation bytes, and stop local tests and durable prose from claiming to
prove hosted CI behavior before the pipeline runs. Preserve useful tests that
exercise observable behavior and useful documentation that serves a concrete
reader outcome.

## Selected Approach

Extend the canonical testing and verification policy with a test-worthiness
boundary. A proposed test must identify the behavior or executable contract it
can fail independently of the implementation's textual shape. Tests should
assert observable inputs, outputs, state transitions, security boundaries, or
stable public artifacts and should survive a behavior-preserving refactor.

Treat CI configuration and hosted pipeline execution as separate evidence
layers. Local work may parse, lint, render, or validate CI configuration, and it
may test reusable generators or validators. Local tests must not claim that a
pipeline schedules jobs, starts services, transfers artifacts, propagates
credentials, enforces dependency ordering, or deploys successfully. Those
claims require evidence from the hosted pipeline that executes the configuration.

Apply the rule during implementation and completed-code review so weak tests are
not added merely to increase coverage. Add focused workflow-contract coverage
that distinguishes rejected implementation-mirroring and speculative CI tests
from legitimate behavioral and configuration-tooling tests. Do not add a source
scanner or ban assertion APIs such as snapshots, string containment, or file
reads.

Add the parallel documentation-worthiness boundary to the canonical
documentation owner and Doc Smith review criteria. Durable documentation should
explain reader-relevant behavior, intent, decisions, ownership, constraints,
and workflows. It should not duplicate a source block or enumerate transient CI
jobs, dependencies, variables, and sequencing that the configuration already
owns. Tutorials, onboarding guides, executable runbooks, public reference
material, and examples may include concrete code or CI detail when the reader
must use, operate, diagnose, or learn it; those documents still explain purpose
and avoid maintaining a second exhaustive source of truth.

## Reuse And Deviation Contract

### Reused owners

- `rules/testing-and-verification.md` remains the canonical owner for test
  selection, regression coverage, verification layers, and proof wording.
- `rules/investigation-and-implementation.md` continues to own Execute and
  Review responsibilities. It will route test selection through the canonical
  test-worthiness boundary instead of defining a second testing policy.
- Existing workflow-contract tests remain the executable policy surface.
- Hosted GitLab pipelines remain the canonical proof for pipeline execution.
- `rules/docs-and-specs.md` remains the canonical owner for durable
  documentation policy.
- `doc-smith` continues to own document quality and reader outcomes, while
  `docs-alignment-review` continues to decide whether an exact diff requires a
  documentation update.

### Inspected precedents

- Nitro commit `f6892f5fb` removed a migration pipeline contract test that
  parsed `.gitlab-ci.yml` and repeated the job, rule, service, and `needs`
  configuration. The revised plan correctly assigned execution proof to the
  hosted merge-request and default-branch pipelines.
- Stat's `scripts/ci/review-environment-pipeline.test.ts` reads CI YAML as text
  and asserts copied job fragments. It demonstrates the same maintenance and
  evidence problem this policy must prevent.
- The current policy already rejects separate test-only delivery units. This
  change extends that principle to the worthiness of tests inside an
  implementation unit.
- Existing documentation policy already rejects execution diaries and requires
  reader-focused durable prose. This change makes source mirroring and transient
  CI narration explicit applications of that existing principle.

### New mechanism and deviations

No new mechanism is introduced. The change adds a selection invariant to the
existing testing owner and executable policy fixtures. It deliberately avoids
mechanical detection because the same APIs are valid when serialized bytes,
generated artifacts, parsers, or validators are the changed behavior.

## Scope

One atomic plan-plus-implementation change set will:

- define the behavioral-evidence and refactor-survival criteria in the canonical
  testing rule;
- define the local-versus-hosted CI evidence boundary and its narrow exceptions;
- require Execute and Review to omit or challenge tests that do not meet the
  criterion;
- define the documentation-worthiness boundary and its tutorial, onboarding,
  runbook, reference, and example exceptions;
- require Doc Smith and documentation alignment review to challenge source-
  mirroring or transient CI narration; and
- add focused workflow-contract scenarios covering rejected and permitted test
  and documentation examples.

## Out Of Scope

- Removing or rewriting existing Stat, Nitro, or AI repository tests.
- Rewriting existing Stat, Nitro, or AI documentation solely to apply the new
  policy retroactively.
- Building a test-quality linter or statically classifying assertion syntax.
- Banning snapshots, string assertions, SQL assertions, source reads, or
  configuration tests categorically.
- Changing GitLab pipeline behavior, required jobs, or hosted verification.
- Merge, deployment, cleanup, or live AX runtime synchronization.

## Acceptance Criteria

- Agent policy requires each new or materially changed test to prove observable
  behavior or an executable contract rather than duplicate implementation text.
- Policy identifies behavior-preserving refactor survival as a practical
  diagnostic, without treating it as an absolute rule when bytes are the public
  contract.
- Policy states that local CI parsing, linting, rendering, and validation do not
  prove hosted pipeline execution.
- Policy permits tests for reusable CI generators, parsers, validators, and
  stable public artifacts when their semantics are exercised independently.
- Execute omits low-value tests, and Review reports them as actionable findings.
- Executable workflow-contract coverage distinguishes the Nitro/Stat-style
  anti-pattern from legitimate behavioral and configuration-tooling tests.
- Durable documentation explains a reader outcome and does not mirror source
  blocks or exhaustively restate transient CI configuration.
- Tutorials, onboarding guides, executable runbooks, public references, and
  examples retain the concrete detail required for their reader outcome.
- Doc Smith reports source-mirroring and unnecessary CI-detail duplication as
  actionable findings, while documentation alignment review does not demand
  documentation churn for implementation detail that has no durable reader
  contract.
- No new framework, scanner, or blanket assertion ban is introduced.

## Verification Strategy

First establish a focused failing workflow-contract scenario for the missing
test-worthiness and CI-evidence rules. Implement the policy, then rerun the same
scenario. Run `writing-skills` because shared agent instructions and rules are
changing. The native pre-commit hook remains the full repository gate. After a
hook-clean commit, publish one draft GitLab MR, request exact-head Nitro review,
and complete local Review against the same head.

## Delivery Shape And Risk

This is one coherent atomic unit and one final draft MR targeting `main`. The
main risk is overcorrecting into a ban on valuable contract tests or concrete
instructional documentation. The explicit exceptions and positive examples
constrain that risk. Rollback is a normal revert of the policy and its focused
workflow fixtures.
