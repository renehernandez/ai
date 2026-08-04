---
name: diff-review
description: Use when reviewing a verified implementation diff for correctness, regression risk, security, performance, usability, tests, docs impact, or residual delivery risk.
---

# Diff Review

Run a findings-only correctness review of issues introduced or materially
worsened by one exact diff. Never edit, even when fixes are also requested.

## Review

1. Load repository review policy and bind the live base/head or verified local
   diff. Hosted adapters supply host metadata, exact SHAs, checks, feedback,
   and the verified diff. If host evidence is unavailable, state the verified
   local boundary.
2. Read changed code plus unchanged callers, tests, configuration, and data
   paths needed to verify behavior.
3. Evaluate, in order: security/data/auth; correctness and regression;
   performance/scalability; usability/accessibility; maintainability and
   testability; verification gaps; documentation/plan/description drift.
4. Route enforceable verification gaps to `ai-readiness-upkeep` and behavioral
   documentation drift to `docs-alignment-review` when available. Include their
   blocking findings in the batch; do not duplicate their mechanics.
5. Ignore formatting owned by automation. Return findings and residual risk to
   Execute.

## Output

```text
Diff review result: passed | finding | blocked
Target: <base...head and diff source>
Finding: [severity] <title> [confidence]
Location: <path:line>
Issue:
Evidence:
Recommendation:
Verification gaps:
Docs alignment: clean | updates needed | not applicable
Residual risk:
```

A clean result still names the tested and untested behavior. Inspect every path
cited by a reviewer before accepting the claim. Provider freshness requires
host evidence; when it is unavailable, report only the verified local boundary.
Name unit, integration, E2E, and deployment evidence as separate verification
layers.
