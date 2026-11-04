# Bootstrap verifies the pinned tool versions

## Objective

Make `bin/bootstrap` fail when a managed tool does not run at its pinned
version, instead of only printing what runs.

## Context

The first live bootstrap printed `pi 0.85.1` while the global mise pin was
1.5.0 and still reported success. An older `npm install -g` inside mise's own
Node 26.3.0 install put a `pi` executable in Node's `bin` directory, which mise
places ahead of the pinned `npm:@earendil-works/pi-coding-agent` tool. The
same report listed each duplicate PATH entry twice because PATH repeats
`/opt/homebrew/bin`.

## Decisions

- The validation step pairs each executable with the mise tool that pins it,
  runs it through `mise exec`, and compares its reported version with
  `mise current`. A mismatch fails bootstrap with the shadowing path and a
  removal command. A global npm package inside a mise install gets a
  `mise exec -- npm uninstall -g` command, so the right Node's npm runs.
- Other copies on PATH are reported once each, without failing, because mise
  wins wherever it is active.
- The pairing names tools only; versions still come from their owners.

## Reuse and deviation contract

`bin/bootstrap` stays the only orchestrator; the change is confined to its
validation step and its removal hint. No new mechanism.

## Delivery shape

One atomic plan plus one PR against `main`, two files plus this plan.

## Acceptance

1. `shellcheck` passes.
2. With the current machine state, the validation section passes and lists
   each other copy once.
3. With `pi` 0.85.1 reinstalled into mise's Node, the validation section exits
   non-zero, names the shadowing path and the pinned version, and suggests
   `mise exec -- npm uninstall -g @earendil-works/pi-coding-agent`.
4. After merge, `bin/bootstrap personal` from `main` completes.
