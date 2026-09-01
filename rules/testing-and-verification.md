# Testing And Verification Rules

These rules cover test selection, regression coverage, and verification wording
across local work, hosted review feedback, CI failures, and browser checks.

## Test worthiness

Add or materially change a test only when it proves observable behavior or an
executable contract: inputs and outputs, state transitions, security boundaries,
integration behavior, or a stable public artifact. A useful diagnostic is
whether the test survives a behavior-preserving refactor. Omit tests that merely
duplicate or mirror implementation text, generated output, internal call order,
or configuration bytes.

The diagnostic is not a blanket ban on snapshots, string assertions, source
reads, SQL assertions, or configuration tests. Those techniques are appropriate
when the bytes are themselves a public or published contract, or when the
changed product is a generator, parser, validator, migration, policy, or
security invariant whose semantics the test exercises independently.

Local CI parsing, linting, rendering, and validation can prove configuration
structure. It does not prove that the hosted pipeline schedules jobs, starts
services, transfers artifacts, propagates credentials, enforces dependencies,
or deploys successfully. Require those claims from the pipeline that executes
the configuration. Do not add a repository test that restates CI YAML as a
substitute for hosted pipeline evidence.

## Fastest Durable Regression

When a bug fix, review comment, CI failure, or browser check reveals missing
coverage, add the fastest durable regression that can prove the behavior
reliably.

Prefer the lowest practical layer:

1. Pure unit test.
2. Domain, repository, or policy test.
3. Server-function, API route, or worker-runtime route test.
4. Component test.
5. Local integration test.
6. Local browser E2E test.
7. Deployed-preview browser E2E test.

Use browser E2E for integrated workflow proof. Do not make browser E2E the
default home for edge cases that a lower layer can catch more directly.

When a lower layer is skipped, state why. If a local layer cannot run because
the required infrastructure is unavailable, such as a missing `DATABASE_URL`,
add the regression when CI can run it and report the local skip explicitly.

## Verification Reporting

Name the exact verification layer that ran. Prefer terms such as unit test,
component test, worker-runtime route test, database integration test, local
browser E2E, deployed-preview E2E, console check, route check, or deployment
verification.

Do not use vague shortcut labels for verification. Report skipped layers,
external blockers, and CI-only coverage as verification gaps.

## Planning, POC, and final targets

- Planning artifacts receive one discovery pass against one artifact
  fingerprint. Cover every planning review type: implementation readiness,
  edge cases and risk, `code-simplifier`, refactoring, and delivery shape. One
  inline execution may cover them for a small coherent artifact, but
  `code-simplifier` keeps its own recorded outcome. Review verifies the reuse
  and deviation contract against live repository evidence.
- After an accepted OpenSpec POC, the delivery-shape result also binds to the
  POC head and reconciled OpenSpec fingerprint, assesses every final unit,
  accounts for every material footprint entry, and blocks incomplete,
  unassigned, split-required, merge-required, or unaccepted topology changes.
  Its mandatory lifecycle discriminator prevents a post-POC handoff from using
  the atomic or pre-POC fast path, and accepted-footprint fingerprints reject
  reviewer-self-declared coverage.
- At first objective proof, a POC uses separate `code-simplifier`,
  `code-quality-review`, and `scrutinize` reviewers plus targeted verification
  of the real entrypoint and visible outcome.
- Completed POC and final implementation targets receive one findings-only
  discovery pass against the exact hosted target-base diff and HEAD, covering
  every completed-code review type. One integrated inline pass may cover a
  small coherent change; use subagents only when delegation is expected to
  finish faster. Add affected-domain specialists when the diff exposes them.
- Every OpenSpec POC proves the complete accepted contract, including applicable
  operational, migration, rollback, compatibility, security, performance, and
  accessibility concerns. Explicit requirements cannot be waived by a receipt.
- Exercise central decision boundaries directly or in a fidelity-equivalent
  environment. A mock that bypasses the decision is not verification.
- Run pre-merge AX proof only with isolated HOME and runtime roots. Live runtime
  activation waits for verified merged default branch source and `ax sync`.
- Repair changes receive one closure check limited to the enumerated findings
  plus affected review types and verification. New discovery is required only
  for a material contract or review-risk change. A patch-equivalent rebase may preserve
  discovery after Review confirms unchanged effective patch, base-sensitive
  context, required coverage, and affected proof, then emits a fresh exact-target
  checkpoint.

## Progressive Verification

Before implementation writes, resolve the documented setup, actual runtime and
package-manager versions, required commands, task-specific credentials, and one
small representative command. Stop on an environment blocker before producing
a substantial diff.

Escalate proof with target maturity:

1. During implementation, run affected unit, type, lint, schema, or equivalent
   narrow verification.
2. At first objective proof, run the targeted real-entrypoint integration,
   route, browser, or equivalent proof.
3. Commit the stable head through the native pre-commit hook, which owns the
   full repository-required suite. Local Review and review subagents consume
   that hook evidence instead of rerunning the suite.
4. When a final failure may predate the branch, reproduce it against the target
   base before attributing it to the change.
