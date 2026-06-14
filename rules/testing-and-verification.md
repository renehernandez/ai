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
