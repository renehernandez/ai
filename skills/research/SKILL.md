---
name: research
description: Use when a user asks to research, investigate, survey, or gather current evidence without naming a specific research skill, especially before brainstorming, planning, writing, presentations, talks, or technical implementation decisions.
---

# Research

Dispatch general research requests to exactly one area skill and return that
area skill's `research_brief`. Stop after the brief and recommend any downstream
continuation as a next step.

## When To Use

Use when the user asks for research, investigation, a survey, or current
evidence without invoking `research-technical` or `research-content` directly.

Do not use when:

- the user already named a specific research skill;
- the user supplied enough source material and only needs brainstorming,
  planning, editing, or drafting;
- no current or external grounding is needed.

## Default Research Dispatch

Select `research-technical` when the request is about standards, protocols,
APIs, SDKs, libraries, frameworks, architecture, implementation patterns,
security, performance, deployment, operations, current best practices, or
reference implementations for technical work.

Select `research-content` when the request is about talks, presentations,
essays, memos, workshops, public-facing narratives, content framing, examples,
stats, discourse, audience assumptions, or one-off written messages.

For mixed technical-plus-content requests, choose one primary skill and record
the deferred lane in `secondary_skill` or equivalent deferred-lane language in
the brief. Ask one clarifying question and stop only when the primary intent is
unclear. Do not run both area skills in v1.

For normal research requests, load and apply the selected area skill. Return the
selected area skill's `research_brief` as the final answer. Do not merely name
the selected skill or stop at a handoff.

If research is unnecessary, say so with `research_routing.status: unnecessary`
and recommend the next skill.

## Explicit Route-Only Mode

Return only `research_routing` when the user explicitly asks to route,
classify, choose a research skill, or asks for routing only. Examples include:

- "route this research request";
- "classify this research request";
- "which research skill should I use?";
- "route only".

## Output

Default research output is the selected area skill's `research_brief`.

Route-only, unclear, and unnecessary outputs use this shape:

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

Do not run downstream brainstorming, planning, writing, deck creation, or code
implementation from this skill. Recommend that next step in the brief instead.

## Common Mistakes

| Mistake | Fix |
| --- | --- |
| Returning only a routing decision for a normal research request | Load and apply exactly one selected area skill, then return its `research_brief` |
| Running downstream brainstorming, planning, drafting, deck creation, or coding | Stop at the research brief and recommend the next skill |
| Running both area skills for a mixed request | Pick the primary intent and record the secondary lane |
| Asking multiple clarifying questions | Ask one intent question and stop |
| Treating all non-code research as content research | Route operational or implementation evidence to `research-technical` |
