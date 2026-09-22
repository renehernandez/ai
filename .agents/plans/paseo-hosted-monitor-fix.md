# Repair shared Paseo hosted monitoring

## Objective

Make the canonical Finish probe work when directly invoked through installed symlinks and collect required GitHub CI evidence without depending on branch-protection settings. Deliver this plan and its implementation in one reviewed PR.

## Approach and ownership

Extend the existing Finish probe and its GitHub feedback collector. The probe owns command-line entrypoint detection; the GitHub collector owns CI evidence and artifact validation. Reuse the existing hosted-probe tests and provider command injection. Do not add a second monitor, change the workflow runner state model, or alter GitLab/Nitro collection.

Compare real filesystem paths for direct execution, converting the module URL to a filesystem path. Importing the module must remain inert. Prove this through subprocess execution, not only a helper assertion.

Collect actual GitHub checks for the expected commit rather than branch-protection-required jobs. Use commit-addressed provider evidence with complete pagination, including check runs and commit status contexts where applicable. Preserve latest-attempt/context semantics so superseded historical failures do not block a successful current run. Verify the PR is open, Ready, and at the expected head before and after collection. Reject incomplete or mismatched evidence.

## Observable behavior

- Two successful GitHub Actions jobs complete even when no branch-protection-required list exists.
- Applicable pending checks report waiting; failed and cancelled checks produce actionable findings with identifying details and links.
- Completion means evidence collection finished, not merge approval. Findings still require disposition.
- Empty, malformed, skipped, or unknown CI evidence requires disposition rather than success.
- Stale-head, draft, and closed PRs cannot complete successfully.
- CI policy and hosted-reviewer policy remain independent. A reviewer marked not-required is never requested or polled.
- Existing GitLab/Nitro behavior remains unchanged.

## Constraints and delivery

No new dependencies. Change repository source only; never patch installed assets or manually edit or bypass the failed paseo-dashboard workflow state. Exercise any AX sync using both isolated HOME and runtime roots before merge.

Use the accepted managed Pi/Paseo workflow: one planning review round, a fresh verified Sol implementation session, one implementation review round, native hooks, and Ready GitHub publication. Resolve the personal-profile policy independently for CI and reviewers. The user authorized merging this one fix when done. Merge only after required gates and findings are satisfied; apply the repository's clean-main post-merge runtime activation policy afterward.

## Acceptance and proof

First visible proof is a symlink-invoked subprocess emitting parseable JSON while a separate import subprocess emits no entrypoint output. Regression coverage also exercises successful jobs without branch protection, pending, failure, cancellation, skipping, empty evidence, PR lifecycle/head safety, independent reviewer policy, and unchanged GitLab/Nitro behavior.

Run focused hosted-probe regression tests, repository-native unit and integration verification, lint/format validation, skill validation and charter pressure scenarios through native hooks. Apply writing-skills RED/GREEN validation to the changed shared agent behavior. Keep review receipts and execution evidence task-local, not in this plan.
