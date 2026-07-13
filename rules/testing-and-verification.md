# Testing And Verification Rules

These rules cover test selection, regression coverage, and verification wording
across local work, hosted review feedback, CI failures, and browser checks.

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

- Planning artifacts use implementation-readiness, edge-case/risk,
  simplification/scope, refactoring, and delivery-shape reviewers against one
  artifact fingerprint. Reviewers verify the artifact's reuse and deviation
  contract against live repository evidence. Intermediate edits rerun affected
  lanes; Execute handoff requires the complete final-artifact baseline.
- At first objective proof, a POC uses separate `code-quality-review` and
  `scrutinize` reviewers plus targeted verification of the real entrypoint and
  visible outcome.
- Completed POC and final implementation targets use five distinct findings-only
  reviewers—`code-simplifier`, `code-quality-review`, `deslop`, `diff-review`,
  and `scrutinize`—against one target-base diff and exact HEAD. Add affected-
  domain specialists beyond that floor.
- Every OpenSpec POC proves the complete accepted contract, including applicable
  operational, migration, rollback, compatibility, security, performance, and
  accessibility concerns. Explicit requirements cannot be waived by a receipt.
- Exercise central decision boundaries directly or in a fidelity-equivalent
  environment. A mock that bypasses the decision is not verification.
- Run pre-merge AX proof only with isolated HOME and runtime roots. Live runtime
  activation waits for verified merged default branch source and `ax sync`.
- Intermediate artifact or HEAD changes invalidate affected verification and
  Review surfaces. Any target-base or HEAD change invalidates the complete
  publication checkpoint, which reruns every required reviewer and selected
  specialist on the final exact target.

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
3. At a stable final head, run all repository-required verification and execute
   independent commands concurrently when safe.
4. When a final failure may predate the branch, reproduce it against the target
   base before attributing it to the change.
