---
name: research-content
description: Use when researching credible material, current discourse, examples, claims, audience assumptions, framing, counterpoints, or stats for talks, presentations, essays, memos, workshops, public narratives, or one-off messages.
---

# Research Content

Produce a source-backed content `research_brief`: credible material and framing
for a specified audience. Stop before writing an outline, narrative, talk,
deck, memo, workshop, or message.

## Evidence Selection

Prefer primary/canonical sources, then current credible discourse, concrete
examples/case studies, traceable data, counterpoints, and secondary commentary
for sentiment only. Use enough sources to represent the claim and material
disagreement; 5–10 is a useful default, not a quota.

Settle the content job and audience. Ask one audience question only when it
changes source selection or interpretation. Extract usable examples, stats,
references, cautious quote candidates, disagreements, tired framing, and
research-derived thesis candidates. A compelling angle is not a proven claim.

Every actionable claim maps to stable source IDs. Distinguish strong,
plausible, and speculative claims; identify sensitivities and likely audience
objections. If current discourse, statistics, or sentiment matters and current
sources are unavailable, return `blocked` with the missing source class and
next lookup.

## Output Contract

```yaml
research_brief:
  status: complete | blocked
  research_type: content
  topic: <question researched>
  freshness: { checked_at: <date>, stale_risk: low | medium | high }
  source_count: <number>
  sources:
    - id: S1
      title: <source>
      url: <url>
      source_type: primary | discourse | case_study | data | counterpoint | secondary
      why_it_matters: <relevance>
  evidence_map:
    - claim: <claim>
      supported_by: [S1]
      confidence: low | medium | high
  audience_context: <beliefs, objections, sophistication, sensitivities>
  discourse_map: <dominant, emerging, and disputed framing>
  tired_framing: <what to avoid and why>
  usable_material: <examples, stats, references, quotes, analogies>
  possible_angles: <thesis, supporting evidence, audience fit, weakness>
  claims: { strong: [], plausible: [], speculative: [] }
  constraints_or_implications: []
  open_questions: []
  decision_readiness: <status, next skill, reason, missing decisions>
```

Recommend `explore`, `plan`, or `doc-smith` as the next owner.
