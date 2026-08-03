# Confidence Framework

Use inline confidence scores on actionable conclusions and recommendation
blocks.

## Required Format

- Format: `[confidence: X.XX - label]`.
- Labels:
  - `certain` for 0.90-1.00
  - `high` for 0.75-0.89
  - `moderate` for 0.50-0.74
  - `low` for 0.25-0.49
  - `speculative` for 0.00-0.24
- Optionally append a short reason: `[confidence: 0.82 - high | reason: direct test output confirmed it]`.

## Annotation Granularity

- Put one annotation on a coherent conclusion or recommendation block when its
  claims share the same evidence basis and uncertainty.
- Use separate annotations when claims have materially different evidence or
  uncertainty.
- Do not repeat the same confidence annotation after each sentence in one
  reasoning chain.

## When to Show Confidence

- Show confidence on every actionable conclusion, diagnosis, recommendation,
  assertion block, and decision.
- Show confidence as each distinct hypothesis, diagnosis, or recommendation
  conclusion is formed, not only in the final conclusion.
- During multi-step investigation, treat each candidate root cause and each
  proposed fix as its own conclusion block.
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
- Self-check before finalizing: if you wrote three or more actionable conclusion
  blocks without confidence scores, revise them.
- Full framework details may also live in memory as `agent-confidence-framework.md`.
