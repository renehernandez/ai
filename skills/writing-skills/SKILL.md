---
name: writing-skills
description: Use when creating, editing, simplifying, or validating skills and their progressively loaded references.
allowed-tools: Task, Read, Write, Edit, Bash(wc:*), Bash(ls:*)
---

# Writing Skills

## Authority

This specialist does not grant repository or provider authority. Work inside
the active lifecycle mode and its accepted files. Escalate when the requested
behavior conflicts with a canonical rule, script, schema, or lifecycle owner.

## Evaluation-first contract

Treat a skill as runtime behavior, not prose. Before changing it:

1. Name the observable behavior, trigger, output, authority boundary, and
   failure or escalation path. Identify the canonical owner for each concept;
   do not copy shared policy into the skill.
2. Choose the smallest proof. Prefer deterministic tests for structure,
   routing, schemas, tool capabilities, or forbidden mutations. Use a live
   model eval when success depends on judgment, restraint, retrieval, or
   semantically equivalent language.
3. Establish RED against the current behavior or a minimal failing fixture.
   Record what failed and why. If a safe RED cannot be produced, report the
   verification gap before editing.
4. Write the smallest runtime instruction that closes the observed gap. Most
   `SKILL.md` files should stay under 500 words and contain only triggers,
   unique judgment, output contract, and escalation. Use progressive disclosure
   for templates, examples, provider mechanics, and long procedures.
5. Re-run the same proof for GREEN. Refactor only when the behavior stays green;
   add counters only for an observed failure, not hypothetical rationalizations.

Load [testing-skills-with-subagents.md](testing-skills-with-subagents.md) when
designing model evals or pressure scenarios. Load
[anthropic-best-practices.md](anthropic-best-practices.md) when frontmatter,
discovery, portability, or cross-platform skill structure is in question.

## Skill shape

- Frontmatter supports `name`, `description`, and `allowed-tools`.
- Descriptions start with “Use when” and describe triggering conditions rather
  than the workflow.
- Keep deterministic validation in scripts, schemas, and tests.
- Keep examples and mechanics one reference link away from `SKILL.md`.
- Preserve required tool capability; removing prose must not silently remove
  the ability to perform the skill.

## Output

Report the canonical owner, behavioral contract, RED evidence, changed runtime
surface, progressively loaded material, GREEN evidence, and any unresolved
verification or authority blocker. Run the repository skill validator and the
affected behavior tests before handoff.
