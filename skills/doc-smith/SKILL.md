---
name: doc-smith
description: >
  Use when writing, reviewing, auditing, or improving engineering
  documentation, including a requested Markdown file or changed docs in a
  branch or diff. Planning artifacts remain with planning Review.
allowed-tools: Read, Glob, Grep, Bash(git:*), Write, Edit, AskUserQuestion, Task
---

# Doc Smith

Own the document's reader outcome, structure, accuracy, and prose. Use the
smallest path that produces trustworthy documentation. An enclosing lifecycle
owner retains repository and commit authority.

## Select the Path

- **Compact note:** one bounded operational or reference note whose audience,
  outcome, source, and location are known or clear from the repository.
- **Full document:** a tutorial, onboarding path, multi-step guide, explanation,
  or document with unresolved scope.
- **Review:** an existing file or the changed documentation in a verified diff.

Do not use this skill for code review, a single sentence edit, or atomic
plan/OpenSpec review. Route planning artifacts to planning Review.

## Establish Evidence

Before drafting or judging claims, inspect the relevant implementation, tests,
configuration, existing documentation, and 2–3 nearby documents when they
exist. Resolve a branch review from its merge base and read every selected
document completely. Never infer a technical fact from plausible prose; cite
repository evidence or label it unverified.

Ask only material questions the repository cannot answer. For a full document,
settle the target reader, desired outcome, source material, document type, and
location before prose. If type or location changes the result, recommend one
and get the user's decision.

## Author

For a compact note, draft the complete text directly and check accuracy,
actionability, tone, and local formatting. Do not require frontmatter,
prerequisites, recap, See Also, a diagram, or a questionnaire unless the target
format or reader task needs it.

For an accepted retrospective or reusable solution note, load
`references/retrospective-solution-note.md`. Capture only evidence-backed,
non-obvious learning; never trigger documentation or system mutation merely
because implementation finished.

For a full document:

1. Load the applicable template from
   `references/diataxis-templates.md` and local conventions from
   `references/formatting-conventions.md`.
2. Present an outcome-oriented outline when structure is still a material
   decision; otherwise draft the accepted structure.
3. Write cohesive sections with verified commands and examples. Use diagrams
   only when they materially clarify a relationship or sequence.
4. Apply `references/quality-rubric.md` before delivery.

Write or edit only within the enclosing Execute authority. Doc Smith never
commits. Return the absolute path, reader outcome, evidence inspected, and any
unverified or deferred claim.

## Review

Apply the seven dimensions in `references/quality-rubric.md`: document-type
fit, accuracy, completeness, actionability, tone, formatting, and cross-links.
Return findings inline; do not create a report file.

```text
Doc Review: <title or path>
Outcome: clean | findings
Evidence checked: <source and neighboring docs>
Findings:
- [critical|warning|suggestion] <location>: <reader impact> -> <specific fix>
Unverified claims: <none or list>
```

A clean result explains why the document enables its intended reader outcome.
Every accuracy finding needs source evidence; every finding needs a concrete
fix.

## Reader Escalation

Reader tests have one trigger: audience comprehension is part of acceptance or
a material comprehension risk remains. Run one final wave against stable text,
not every draft. Load the persona prompts in
`references/quality-rubric.md`, pass only the document and target-reader
profile, and fold actionable gaps into the draft or review. Never use reader
personas for planning contracts.

Escalate rather than fabricate when source behavior conflicts, required context
is unavailable, the audience/outcome remains materially ambiguous, or the
requested location violates repository convention.
