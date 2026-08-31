---
name: maintain-verification-skill
description: Use when auditing and correcting an existing project-local verification skill and its user-facing feature map against current source and live behavior.
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion
---

# Maintain Verification Skill

Keep one project-local verification skill honest. Operate within the active
lifecycle authority and edit only the selected verification skill directory;
never repair product code during this pass.

## Select And Cover

Locate the project-local skill whose instructions launch and drive the app and
whose feature map indexes user-facing behavior. Ask when several candidates
remain. If none exists, stop and route to `create-verification-skill`.

Read [maintenance-pass.md](references/maintenance-pass.md), then give every
mapped feature both source and live coverage. Source coverage traces the current
user-facing entrypoint and implementation. Live coverage exercises at least one
representative user path and captures its observable result. Do not expand this
into every sub-feature or permutation.

Reconcile the map index with its sibling files and sweep concrete user-facing
source changes for missing features. Use the verification skill's own Launch,
Doctor, Drive, Evidence, and Cleanup model. Re-run Doctor after surprising
behavior, preserve evidence through cleanup, and remove failed-drive residue.

## Classify And Bound Edits

- Wrong user-facing instructions or map entries are documentation drift.
- Working behavior the harness cannot drive is harness drift.
- A concrete unmet auth, entitlement, OS, or external-state prerequisite is
  verified unreachable and must be recorded accurately.
- Behavior exposed by current source but broken live is a product regression:
  report it as `blocked` and do not weaken the feature map to hide it.

Re-drive every changed instruction or helper before handoff. Changes outside the
verification skill directory, discovery-link repair, product fixes, scheduling,
and provider actions remain outside this skill.

## Outcome

Return exactly `clean`, `changed`, or `blocked`, plus feature-by-feature source
and live evidence, unreachable prerequisites, corrections, product regressions,
cleanup result, and retained evidence location.
