# Normalize Paseo review envelopes

## Objective

Accept a single valid `AX_REVIEW_BEGIN` / `AX_REVIEW_END` review envelope when a reviewer adds harmless surrounding prose. Preserve fail-closed handling for missing, duplicated, malformed, stale, or incomplete review evidence.

## Selected approach

Extend the existing Paseo workflow parser. Locate exactly one bounded review envelope in the final reviewer message, parse only its JSON payload, and keep the current fingerprint, lens coverage, outcome, and finding validation unchanged.

Do not change reviewer models, dispatch another reviewer, or weaken one-pass review rules. DeepSeek remains the configured reviewer because the inspected sessions completed substantive reviews; the current parser rejected four of five valid embedded envelopes only because they included introductory prose.

## Ownership and reuse

`skills/handoff-brief/scripts/paseo-workflow.ts` remains the canonical owner for review-envelope parsing and semantic validation. Existing workflow unit tests remain the canonical proof surface. The injected Paseo workflow reference remains the owner for the rule that receipt-shape errors from returned evidence are normalized without another reviewer prompt.

No new parser, state transition, reviewer role, or model-routing mechanism is needed. This change deliberately preserves the current envelope markers and all semantic validation after extraction.

## Behavior and constraints

- Accept one envelope with optional text before or after it.
- Reject responses with no complete envelope or more than one envelope.
- Reject malformed JSON, fingerprint mismatches, incomplete lens coverage, invalid outcome status, invalid findings, and duplicate finding IDs as before.
- Ignore surrounding text only after proving that exactly one begin marker and one end marker form the single envelope.
- Keep degraded-review evidence and owner fallback behavior unchanged when parsing still fails.

## Delivery shape and proof

Deliver one atomic plan and implementation in one Ready pull request. The first visible proof is a regression test that reproduces the observed DeepSeek response shape and passes without changing its embedded review report.

Verification covers focused workflow unit tests, repository lint and format validation, skill behavior validation because the owning workflow reference is shared agent behavior, and the repository’s native hook-enabled commit suite.

## Acceptance

- All five inspected DeepSeek response shapes would yield their embedded valid review reports.
- Prefix or suffix prose around one envelope does not degrade the reviewer.
- Multiple envelopes remain ambiguous and fail.
- Existing semantic validation remains fail-closed.
- No reviewer model or runtime route changes.

[confidence: 0.99 - certain | reason: five persisted DeepSeek sessions contained one valid JSON envelope each, while four failed only the parser’s whole-message anchors]
