# Driving mechanics

Choose the existing repository-native harness first. Add a helper only when the
same reliable operation cannot be expressed through that harness, and document
its invocation in the generated skill.

## Web UI or Electron

Prefer existing Playwright or Cypress setup, browser-control helpers, and stable
ARIA labels, roles, test IDs, or route paths. Avoid coordinates and incidental
tab order. Capture the initiating action and resulting state, not only a final
screenshot.

## CLI or TUI

Use the repository's CLI entrypoint. For interactive behavior, use an existing
PTY, expect, or tmux harness with real prompt strings and isolated data or config
directories. A short-lived CLI launches per drive; it does not need a fake
long-lived server lifecycle. Retain exit status and terminal transcript.

## HTTP service

Prefer existing integration clients or plain HTTP commands against a locally
launched service. Doctor should verify the expected build or version, endpoint,
auth, and instance ownership rather than accepting any listener on the port.
Capture request, response status/body, and externally visible side effects.

## Desktop, mobile, or another surface

Reuse the application's existing automation/debug bridge. If no safe
programmatic driver exists, report the harness gap rather than substituting
internal setters or test-only endpoints for the user path.

## Evidence and cleanup invariants

- Verify real user-visible behavior and observable side effects.
- Treat mocks as valid only at an existing production boundary.
- Observe what dry-run or test modes actually skip; do not trust their names.
- Isolate ports, profiles, data directories, and sessions when the app supports
  it. Refuse to double-drive a shared instance when isolation is unsafe.
- Kill by recorded process/session identity, never broad process name.
- Remove run-owned scratch state and preserve proof artifacts.
