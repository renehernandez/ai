---
name: research-content
description: Use when researching credible material, current discourse, examples, claims, audience assumptions, framing, counterpoints, or stats for talks, presentations, essays, memos, workshops, public narratives, or one-off messages.
---

# Research Content

Answer: what credible material and framing should inform this talk,
presentation, essay, memo, workshop, or message?

Produce a source-backed `research_brief`. Stop at research findings and possible
angles; do not write the artifact, outline, script, deck, or message.

## Source Target

Aim for 5-10 sources.

Use fewer than 5 only when the topic is narrow, authoritative sources are
limited, the user constrains sources, or source access is blocked. Use more than
10 only when source conflicts, multiple viewpoints, controversy, fast-moving
claims, or high audience risk require it.

## Source Hierarchy

Prefer sources in this order:

1. Primary or canonical sources.
2. Current credible discourse.
3. Concrete examples and case studies.
4. Stats and data points.
5. Counterpoints.
6. Secondary commentary for sentiment or anecdote only.

## Workflow

1. Frame the content job and intended audience.
2. Ask one audience question if audience fit matters and is unclear, unless the
   user explicitly wants a generic landscape brief.
3. Collect sources across the hierarchy.
4. Extract useful examples, stats, references, and quote candidates.
5. Map current discourse, disagreements, and tired framing to avoid.
6. Produce research-derived thesis candidates in `possible_angles`.
7. Hand off to `brainstorming`, `doc-smith`, or `presentations`.

If current source access is unavailable for current discourse, recent stats,
market/category movement, or public sentiment, return `status: blocked` with
the missing source class and concrete next lookup.

## Output

Return this shape:

```yaml
research_brief:
  status: complete | blocked
  research_type: content
  topic:
  intended_next_step: brainstorming | plan-ready | doc-smith | presentations | other
  freshness:
    checked_at:
    stale_risk: low | medium | high
    current_sources_used: true | false
    evergreen_sources_used: true | false
  source_count:
  sources:
    - id: S1
      title:
      url:
      publisher_or_author:
      published_or_updated:
      accessed_at:
      source_type: primary | discourse | case_study | data | counterpoint | secondary
      why_it_matters:
  primary_sources:
    - S1
  credible_examples:
    - S2
  current_patterns: []
  anti_patterns: []
  constraints_or_implications: []
  evidence_map:
    - claim:
      supported_by:
        - S1
      confidence: low | medium | high
  open_questions: []
  decision_readiness:
    status: ready_for_brainstorming | ready_for_plan_ready | ready_for_doc_smith | ready_for_presentations | blocked
    recommended_next_skill:
    reason:
    missing_decisions: []
  confidence: low | medium | high
artifact_type: talk | presentation | essay | memo | workshop | message | other
audience_context:
  audience:
  role_or_group:
  sophistication_level: low | medium | high | unknown
  likely_beliefs: []
  likely_objections: []
  sensitivities: []
discourse_sources: []
examples_and_case_studies: []
stats_and_data_points: []
counterpoints: []
discourse_map:
  dominant_framing: []
  emerging_framing: []
  disagreements: []
tired_framing:
  - framing:
    why_to_avoid:
    better_alternative:
usable_material:
  examples: []
  stats: []
  references: []
  quote_candidates: []
  analogies_or_stories: []
possible_angles:
  - thesis:
    supporting_evidence: []
    audience_fit:
    risk_or_weakness:
claims:
  strong: []
  plausible: []
  speculative: []
claims_to_handle_carefully: []
```

Every actionable content claim must appear in `evidence_map` and reference
stable `sources[].id` values through `supported_by`. `possible_angles` are
research-derived thesis candidates only, not outlines or narrative sequences.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Writing the talk, deck, memo, or DM | Return material, claims, and possible angles only |
| Treating a catchy thesis as proven | Put it under the right claim strength |
| Omitting audience assumptions | Fill `audience_context` or ask one audience question |
| Using stats without traceability | Cite each stat through `sources[].id` and `evidence_map` |
