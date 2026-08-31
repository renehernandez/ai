# Maintenance pass

## Index and source coverage

Read the feature-map README and every sibling feature file. Resolve missing,
extra, duplicate, or dead index entries without creating another inventory.

For each feature, record current source entrypoints, the user-facing route or
command, likely drift or none, and one concise live recipe. A concrete source
path is required before adding a newly discovered feature. Recent churn is a
search aid, not a substitute for current source.

## Live coverage

Exercise every mapped feature at least once through a representative user path.
Use as few valid app states as practical while respecting the generated skill's
launch model: one owned long-lived instance for a server/UI or a fresh isolated
session for each short-lived CLI drive.

Doctor before the first drive, on each fresh session, and after a failed or
surprising drive. When Doctor cannot see a wedged user state, reset to a known
state or relaunch. Evidence captured so far must survive every reset and
cleanup. Clean drive-owned residue as soon as it is no longer useful.

An unreachable feature requires the route attempted and a concrete auth,
entitlement, OS, external-state, or similar prerequisite. Missing prerequisite
documentation is drift. An unproved reachability claim is `blocked`.

## Triage and outcomes

- `clean`: every feature has source and live coverage, no correction or product
  regression remains. Create no branch and no PR or MR.
- `changed`: only proven documentation or harness corrections inside the
  verification skill directory remain. Re-drive them, then return the changes
  to the active Execute/Finish workflow; this skill creates no provider artifact.
- `blocked`: coverage is incomplete, a correction cannot be proved safely, or
  live behavior establishes a product regression. Create no branch and no PR or
  MR. Report the product-facing evidence without editing product code or
  weakening the map.

Final teardown happens after every drive and re-proof. Confirm retained evidence
still exists before reporting the outcome.
