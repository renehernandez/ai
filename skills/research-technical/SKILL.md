---
name: research-technical
description: Use when researching current technical standards, APIs, SDKs, libraries, frameworks, architectures, implementation patterns, security, performance, deployment, operations, best practices, or reference implementations before brainstorming or planning.
---

# Research Technical

Produce a source-backed technical `research_brief`: the current credible
implementation options and constraints. Stop before implementation planning or
code.

## Evidence Selection

Prefer standards/specifications, official vendor/framework documentation,
source repositories and maintained examples, mature ecosystem implementations,
security/operations evidence, then community sources for field evidence. Use
enough sources to resolve the decision and conflicts; 5–10 is a useful default,
not a quota.

Frame the implementation question and version context. Extract recommended and
viable alternative patterns, deprecated paths, failure modes, security and
operational limits, verification implications, and conflicts between sources.
Every actionable claim maps to stable source IDs.

Do not inspect the target repository deeply unless requested. Put likely local
fit under assumptions to verify, never confirmed facts. If current evidence is
unavailable for a fast-moving API, SDK, cloud, security, model/provider,
pricing, or support topic, return `blocked` with the missing source class and
next lookup.

## Output Contract

```yaml
research_brief:
  status: complete | blocked
  research_type: technical
  topic: <question researched>
  freshness: { checked_at: <date>, stale_risk: low | medium | high }
  source_count: <number>
  sources:
    - id: S1
      title: <source>
      url: <url>
      source_type: standard | official_doc | source_repo | maintained_example | ecosystem_impl | security_ops | secondary
      why_it_matters: <relevance>
  evidence_map:
    - claim: <claim>
      supported_by: [S1]
      confidence: low | medium | high
  version_context: <runtime, framework/SDK, provider, versions, unknowns>
  technical_findings: <recommended pattern, alternatives, references, risks, limits, verification, planning constraints>
  source_conflicts: <conflict, source IDs, likely resolution, risk>
  repo_applicability: <likely surfaces, constraints, assumptions to verify>
  constraints_or_implications: []
  open_questions: []
  decision_readiness: <status, next skill, reason, missing decisions>
```

Recommend `explore` or `plan` as the next owner.
