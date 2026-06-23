---
name: research
description: Use when a user asks to research, investigate, survey, or gather current evidence without naming a specific research skill, especially before brainstorming, planning, writing, presentations, talks, or technical implementation decisions.
---

# Research

Route research requests to the right research skill. Stop after the routing
decision unless the user explicitly asks you to run the selected skill.

## When To Use

Use when the user asks for research without invoking `research-technical` or
`research-content` directly.

Do not use when:

- the user already named a specific research skill;
- the user supplied enough source material and only needs brainstorming,
  planning, editing, or drafting;
- no current or external grounding is needed.

## Routing Rules

Select `research-technical` when the request is about standards, protocols,
APIs, SDKs, libraries, frameworks, architecture, implementation patterns,
security, performance, deployment, operations, current best practices, or
reference implementations for technical work.

Select `research-content` when the request is about talks, presentations,
essays, memos, workshops, public-facing narratives, content framing, examples,
stats, discourse, audience assumptions, or one-off written messages.

For mixed technical-plus-content requests, choose one primary skill and record
the deferred lane in `secondary_skill`. Ask one question and stop only when the
primary intent is unclear. Do not run both area skills in v1 unless the user
explicitly asks for both.

If research is unnecessary, say so and recommend the next skill.

## Output

Return this shape:

```yaml
research_routing:
  status: routed | ask_user | unnecessary
  selected_skill: research-technical | research-content | none
  secondary_skill: research-technical | research-content | none
  reason:
  next_step:
```

`next_step` should name the selected skill or the better downstream skill, such
as `brainstorming`, `plan-ready`, `doc-smith`, or `presentations`.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Researching sources inside the router | Emit only the routing decision |
| Running both area skills for a mixed request | Pick the primary intent and record the secondary lane |
| Asking multiple clarifying questions | Ask one intent question and stop |
| Treating all non-code research as content research | Route operational or implementation evidence to `research-technical` |
