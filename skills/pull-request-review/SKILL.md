---
name: pull-request-review
description: Use when reviewing pull requests, merge requests, branch diffs, review comments, local changes, hosted code review output, security review output, or PR feedback for correctness, security, performance, usability, maintainability, or quality.
---

# Pull Request Review

## Overview

Review only issues introduced or materially worsened by the diff. Lead with actionable findings, not summaries.

## When To Use

Use for PR/MR review, local diff review, reviewing another agent's feedback, or preparing a review rubric. Skip when the user asks for implementation without review.

## Quick Reference

| Review context | First move |
| --- | --- |
| GitHub/GitLab PR | Verify branch, base, checks, and comments with provider tools |
| Local changes | Inspect status, diff, and relevant repo rules |
| Hosted/cloud review | Prefer repo-visible rules and PR diff |
| Another agent's feedback | Check claims against code and evidence |

## Workflow

1. Load project review rules: `AGENTS.md`, relevant `.agents/rules/*.md`, and repo-specific review rubrics.
2. Establish the diff base with provider tools or `git merge-base`.
3. If provider tools are unavailable, establish the best local base from remotes/refs, state what could not be verified, and scope findings to the verified diff only.
4. Read changed files plus enough surrounding code to avoid false positives.
5. Prioritize findings:
   - security, data leaks, auth/access, secrets;
   - correctness and behavioral regressions;
   - performance and scalability regressions;
   - usability/accessibility regressions;
   - maintainability, ownership, testability, and quality gaps.
6. Ignore formatting nits when automated tooling owns them.
7. Report blockers and residual risk; do not edit files during a review unless the user asks for fixes.

## Findings Format

```markdown
**[SEVERITY] Title**
Location: path:line
Issue:
Evidence:
Recommendation:
```

Use severity names from the repo when available. If no issues are found, say so and name remaining test/deploy risk.

## Mistakes

| Mistake | Fix |
| --- | --- |
| Summarizing before findings | Findings first |
| Reviewing stale branch state | Verify live PR/base/checks |
| Trusting another agent's claim | Re-check code/evidence |
| Mixing test layers | Name unit/component/integration/E2E/deploy verification |
| Filing style nits owned by tools | Skip them |

## Validation Scenarios

- Stale PR after base changed: pass only if base/check state is verified.
- Agent feedback cites nonexistent code: pass only if claim is checked.
- Clean review: pass only if residual risk is still named.

## Test Evidence

- RED: baseline reviewed local refs but provider-unavailable behavior was ad hoc.
- GREEN: skill run scoped findings to verified local refs and named residual provider risk.
- REFACTOR: workflow now requires provider fallback and verification gaps.
