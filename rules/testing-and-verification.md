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
  artifact fingerprint.
- POC and final implementation use correctness, regression, maintainability,
  and verification reviewers against one target-base diff and exact HEAD.
- Every OpenSpec POC proves the complete accepted contract, including applicable
  operational, migration, rollback, compatibility, security, performance, and
  accessibility concerns. Explicit requirements cannot be waived by a receipt.
- Exercise central decision boundaries directly or in a fidelity-equivalent
  environment. A mock that bypasses the decision is not verification.
- Run pre-merge AX proof only with isolated HOME and runtime roots. Live runtime
  activation waits for verified merged default branch source and `ax sync`.
- Any artifact, target-base, or HEAD change invalidates target-bound evidence.
  Rerun the affected verification and Review surfaces.
