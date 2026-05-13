# Solution Document Template

Use this template when creating solution docs in `docs/solutions/`.

## File Format

```markdown
---
title: <Short descriptive title>
date: <YYYY-MM-DD>
category: <bug-fix | pattern | architecture | debugging | ci-cd | performance | security | workflow>
tags: [<tag1>, <tag2>, <tag3>]
related: [<path to related solution or spec if any>]
---

# <Title>

## Problem

<What went wrong or what challenge was faced. 2-4 sentences. Include symptoms that would help someone searching for this in the future.>

## Root Cause

<Why it happened. This is the non-obvious part — the actual mechanism, not just the symptom.>

## Solution

<What was done to fix it. Include the key insight or pattern, not a blow-by-blow of every file changed.>

## Prevention

<How to avoid this in the future. Could be: a CLAUDE.md rule, a test, a linter rule, a CI check, or a convention.>

## References

- <Link to PR, commit, or OpenSpec spec if relevant>
- <Link to external docs if the solution came from framework/library knowledge>
```

## Category Definitions

| Category | When to use |
|----------|-------------|
| `bug-fix` | A bug was found and fixed, and the root cause is worth remembering |
| `pattern` | A reusable code pattern or technique was discovered |
| `architecture` | A structural decision was made with trade-offs worth documenting |
| `debugging` | A debugging technique or approach proved effective |
| `ci-cd` | A CI/CD pipeline issue was resolved |
| `performance` | A performance problem was diagnosed and fixed |
| `security` | A security issue was found and addressed |
| `workflow` | A development workflow improvement was made |

## Tagging Guidelines

- Use existing tags from prior solutions when possible (check `docs/solutions/` first)
- Tags should be specific enough to filter by (e.g. `n-plus-one` not just `database`)
- Include the framework/tool name if relevant (e.g. `terraform`, `cloudflare-workers`, `rails`)
- 3-5 tags per solution is ideal
