---
name: research-technical
description: Use when researching current technical standards, APIs, SDKs, libraries, frameworks, architectures, implementation patterns, security, performance, deployment, operations, best practices, or reference implementations before brainstorming or planning.
---

# Research Technical

Answer: what is the current credible way to implement this?

Produce a source-backed `research_brief`. Stop at research findings and handoff
constraints; do not write an implementation plan or code.

## Source Target

Aim for 5-10 sources.

Use fewer than 5 only when the topic is narrow, authoritative sources are
limited, the user constrains sources, or source access is blocked. Use more than
10 only when source conflicts, multiple viable paths, controversy, fast-moving
risk, or high impact require it.

## Source Hierarchy

Prefer sources in this order:

1. Standards and specs.
2. Official vendor, framework, or platform docs.
3. Source repos and maintained examples.
4. Mature ecosystem implementations.
5. Security and operational sources.
6. Secondary/community sources for field evidence only.

## Workflow

1. Frame the implementation question and version context.
2. Select source lanes from the hierarchy.
3. Collect primary evidence and credible examples.
4. Extract current implementation patterns.
5. Identify anti-patterns, deprecated paths, and failure modes.
6. Compare viable options and source conflicts.
7. Hand off constraints to `brainstorming` or `plan-ready`.

If current source access is unavailable for a fast-moving API, SDK, cloud,
security, model/provider, pricing, or platform-support topic, return
`status: blocked` with the missing source class and concrete next lookup.

## Repo Applicability

Do not inspect the repository deeply unless the user asks. Frame local fit as
assumptions to verify, not confirmed facts.

## Output

Return this shape:

```yaml
research_brief:
  status: complete | blocked
  research_type: technical
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
      source_type: standard | official_doc | source_repo | maintained_example | ecosystem_impl | security_ops | secondary
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
version_context:
  language_or_runtime:
  framework_or_sdk:
  provider_platform:
  relevant_versions:
  version_unknowns: []
technical_findings:
  recommended_pattern:
  viable_alternatives: []
  reference_implementations: []
  standards_or_docs: []
  security_considerations: []
  performance_or_operational_limits: []
  verification_implications: []
  deprecated_or_risky_paths: []
  planning_constraints: []
source_conflicts:
  - conflict:
    sources: []
    likely_resolution:
    implementation_risk:
repo_applicability:
  likely_existing_surfaces: []
  integration_constraints: []
  assumptions_to_verify_locally: []
```

Every actionable technical claim must appear in `evidence_map` and reference
stable `sources[].id` values through `supported_by`.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Drafting the implementation plan | Return research constraints and recommended next skill |
| Using uncited best-practice claims | Add the claim to `evidence_map` with source IDs |
| Treating community posts as primary evidence | Use them only for field evidence unless no primary source exists |
| Confirming repo facts without inspection | Put them in `assumptions_to_verify_locally` |
