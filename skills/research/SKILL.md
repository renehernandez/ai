---
name: research
description: Use when a user asks to research, investigate, survey, or gather current evidence without naming a specific research skill, especially before brainstorming, planning, writing, presentations, talks, or technical implementation decisions.
---

# Research

Route a general research request to exactly one evidence lane, apply that lane,
and return its source-backed `research_brief`. Stop before brainstorming,
planning, drafting, deck creation, or implementation; recommend the next owner.

## Select One Lane

- `research-technical`: current standards, protocols, APIs, SDKs, libraries,
  architecture, implementation patterns, security, performance, deployment,
  operations, or reference implementations.
- `research-content`: credible material, discourse, audience assumptions,
  framing, examples, counterpoints, or statistics for talks, presentations,
  essays, memos, workshops, or messages.

For mixed intent, select the lane that answers the primary decision and record
the other as deferred. Ask one material question only when primary intent is
unclear. Do not run both lanes in one request.

Skip research when the user already supplied sufficient sources or only needs
brainstorming, planning, editing, or drafting. Honor an explicitly named lane.

## Route-Only Output

Return routing without research only when the user explicitly asks to classify
or choose a lane, the primary intent is unclear, or research is unnecessary.

```yaml
research_routing:
  status: routed | ask_user | unnecessary
  selected_skill: research-technical | research-content | none
  secondary_skill: research-technical | research-content | none
  reason: <decision evidence>
  next_step: <selected or downstream skill>
```

Normal requests return the selected lane's `research_brief`, not merely its
name. Downstream owners include `explore`, `plan`, and `doc-smith`.
