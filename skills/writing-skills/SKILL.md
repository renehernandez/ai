---
name: writing-skills
description: Use when creating new skills, editing existing skills, verifying skills before deployment, or when tempted to ship documentation without testing it first
allowed-tools: Task, Read, Write, Edit, Bash(wc:*), Bash(ls:*)
---

# Writing Skills

## Overview

**Writing skills IS Test-Driven Development applied to process documentation.**

You write test cases (pressure scenarios with subagents), watch them fail (baseline behavior), write the skill (documentation), watch tests pass (agents comply), and refactor (close loopholes).

**Core principle:** If you didn't watch an agent fail without the skill, you don't know if the skill teaches the right thing.

**Before writing:** Read anthropic-best-practices.md for Anthropic's official guidance on structure, scope, and common pitfalls.

## TDD Mapping for Skills

| TDD Concept | Skill Creation |
|-------------|----------------|
| **Test case** | Pressure scenario with subagent |
| **Production code** | Skill document (SKILL.md) |
| **Test fails (RED)** | Agent violates rule without skill (baseline) |
| **Test passes (GREEN)** | Agent complies with skill present |
| **Refactor** | Close loopholes while maintaining compliance |

## When to Create a Skill

**Create when:** Technique wasn't obvious, you'd reference it again, pattern applies broadly, others would benefit.

**Don't create for:** One-off solutions, standard practices, project-specific conventions (use CLAUDE.md), mechanical constraints (automate instead).

## Skill Types

- **Technique:** Concrete method with steps (condition-based-waiting, root-cause-tracing)
- **Pattern:** Way of thinking about problems (flatten-with-flags, test-invariants)
- **Reference:** API docs, syntax guides, tool documentation

## SKILL.md Structure

```markdown
---
name: Skill-Name-With-Hyphens
description: Use when [specific triggering conditions and symptoms]
allowed-tools: Tool1, Tool2
---

# Skill Name

## Overview
Core principle in 1-2 sentences.

## When to Use
Symptoms, use cases, when NOT to use.

## Core Pattern
Before/after comparison or key workflow.

## Quick Reference
Table or bullets for scanning.

## Common Mistakes
What goes wrong + fixes.
```

**Frontmatter rules:**
- Only `name`, `description`, `allowed-tools` supported
- `name`: letters, numbers, hyphens only
- `description`: Third-person, starts with "Use when...", max 1024 chars
- **NEVER summarize workflow in description** (see CSO section)

## Claude Search Optimization (CSO)

**Critical:** Future Claude uses description to decide which skills to load.

### Description = When to Use, NOT What It Does

```yaml
# BAD: Summarizes workflow - Claude may follow this instead of reading skill
description: Use when executing plans - dispatches subagent per task with code review

# GOOD: Just triggering conditions
description: Use when executing implementation plans with independent tasks
```

**Why:** When description summarizes workflow, Claude shortcuts to the description instead of reading the full skill content.

### Keyword Coverage

Use words Claude would search for: error messages, symptoms, synonyms, tool names.

### Token Efficiency

- Target <500 words for most skills
- Reference `--help` instead of documenting all flags
- Cross-reference other skills instead of repeating content

## The Iron Law

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

This applies to NEW skills AND EDITS. Same as TDD for code.

**No exceptions:**
- Not for "simple additions"
- Not for "just adding a section"
- Not for "documentation updates"
- Not for "reference skills" (they need retrieval testing)
- Not for "it's well-organized domain knowledge"
- Not because "we can iterate later"
- Not because "the partner has a hard stop"

**ALL skill types need testing.** The table below shows WHAT to test, not WHETHER to test. Reference skills need retrieval testing. Technique skills need application testing. Discipline skills need pressure testing. No skill ships without its appropriate test passing first.

## Testing Skills

Different skill types need different test approaches:

| Skill Type | Test With | Success Criteria |
|------------|-----------|------------------|
| **Discipline** (TDD, verification) | Pressure scenarios, combined pressures | Agent follows rule under maximum pressure |
| **Technique** (how-to guides) | Application scenarios, edge cases | Agent applies technique correctly |
| **Pattern** (mental models) | Recognition scenarios, counter-examples | Agent knows when/how to apply |
| **Reference** (documentation) | Retrieval scenarios, gap testing | Agent finds and applies info correctly |

**Testing methodology:** See testing-skills-with-subagents.md for pressure scenarios, rationalization capture, and loophole closing.

## Common Rationalizations for Skipping Testing

| Excuse | Reality |
|--------|---------|
| "Skill is obviously clear" | Clear to you ≠ clear to other agents. Test it. |
| "It's just a reference" | References can have gaps. Test retrieval. |
| "Testing is overkill" | Untested skills have issues. Always. |
| "I'll test if problems emerge" | Test BEFORE deploying. |
| "Reference skills are lower-risk" | Wrong test type ≠ no test. Retrieval testing still required. |
| "400 lines of domain expertise has value" | Untested value = unknown value. 15 min testing proves it works. |
| "We can iterate later" | "Later" means never. Test now or delete. |
| "Partner has a hard stop" | Then stop. Resume tomorrow with testing. Don't ship untested. |
| "This is pragmatic, not dogmatic" | Shipping untested skills is unprofessional, not pragmatic. |
| "Sometimes you accumulate process debt" | Process debt on skills = agents failing silently. Not acceptable. |

## Red Flags - STOP Immediately

If you catch yourself thinking any of these, STOP:

- "This skill type doesn't need the same testing"
- "The content is good, testing can come later"
- "We're under time pressure"
- "It's well-organized, so it'll work"
- "Real testing means using it over time"
- "Perfect is the enemy of shipped"
- "This is a pragmatic trade-off"

**All of these mean:** You're about to ship an untested skill. Stop. Either test it now or don't ship it.

## Bulletproofing Against Rationalization

For discipline-enforcing skills, address every loophole explicitly:

```markdown
Write code before test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Delete means delete
```

Build rationalization tables from baseline testing. Add red flags list for self-checking.

**Psychology:** See persuasion-principles.md for research on authority, commitment, and scarcity principles.

## RED-GREEN-REFACTOR for Skills

### RED: Baseline Testing
Run pressure scenario WITHOUT skill. Document exact rationalizations verbatim.

### GREEN: Write Minimal Skill
Address specific baseline failures. Run scenarios WITH skill - verify compliance.

### REFACTOR: Close Loopholes
New rationalization found? Add explicit counter. Re-test until bulletproof.

## Flowcharts

Use ONLY for non-obvious decision points, process loops, or "A vs B" decisions.

**Never for:** Reference material (tables), code (blocks), linear instructions (numbered lists).

See graphviz-conventions.dot for style rules. Use render-graphs.js to visualize.

## STOP: Before Moving to Next Skill

**After writing ANY skill, complete deployment before creating another.**

Deploying untested skills = deploying untested code.

## Skill Creation Checklist

**RED Phase:**
- [ ] Create pressure scenarios (3+ combined pressures for discipline skills)
- [ ] Run scenarios WITHOUT skill - document baseline verbatim
- [ ] Identify patterns in rationalizations

**GREEN Phase:**
- [ ] Name uses only letters, numbers, hyphens
- [ ] Description starts with "Use when..." (third person, no workflow summary)
- [ ] Keywords throughout for search
- [ ] Address specific baseline failures
- [ ] Run scenarios WITH skill - verify compliance

**REFACTOR Phase:**
- [ ] Identify NEW rationalizations from testing
- [ ] Add explicit counters
- [ ] Build rationalization table
- [ ] Re-test until bulletproof

**Quality:**
- [ ] Flowcharts only if decision non-obvious
- [ ] Quick reference table
- [ ] Common mistakes section
- [ ] No narrative storytelling

**Deployment:**
- [ ] Commit and push

## The Bottom Line

**Creating skills IS TDD for process documentation.**

Same Iron Law: No skill without failing test first.
Same cycle: RED (baseline) → GREEN (write skill) → REFACTOR (close loopholes).
Same benefits: Better quality, fewer surprises, bulletproof results.
