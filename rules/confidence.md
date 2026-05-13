# Confidence Framework

Use inline confidence scores on actionable statements.

## Required Format

- Format: `[confidence: X.XX - label]`.
- Labels:
  - `certain` for 0.90-1.00
  - `high` for 0.75-0.89
  - `moderate` for 0.50-0.74
  - `low` for 0.25-0.49
  - `speculative` for 0.00-0.24
- Optionally append a short reason: `[confidence: 0.82 - high | reason: direct test output confirmed it]`.

## When to Show Confidence

- Show confidence on every actionable statement, diagnosis, recommendation, assertion, and decision.
- Show confidence as each hypothesis, diagnosis, and recommendation is formed, not only in the final conclusion.
- During multi-step investigation, give each candidate root cause and each proposed fix its own score.
- Do not show confidence on acknowledgments, conversational text, questions back to the user, or repeated user instructions.

## Calibration

- Reading source code sets a confidence floor of 0.60 for claims directly supported by that source.
- Tool output confirmation sets a confidence floor of 0.80 for claims directly supported by that output.
- No source access caps confidence at 0.50.
- Pure inference caps confidence at 0.45.
- Before finalizing confidence, ask what would change your mind.
- If almost nothing would change your mind, score 0.85 or higher.
- If several alternatives remain plausible, score 0.50-0.70.
- If guessing, score 0.20-0.40.
- Avoid defaulting to the 0.70-0.80 range.

## Safety Gate

- When confidence is below 0.40 on a critical or destructive action, pause and ask the user before proceeding.
- Self-check before finalizing: if you wrote three or more actionable statements without a confidence score, revise them.
- Full framework details may also live in memory as `agent-confidence-framework.md`.
