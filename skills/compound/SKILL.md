---
name: compound
description: Use when a task, feature, bug fix, or investigation is complete and the user wants to capture learnings, retrospectives, post-mortems, or solution notes.
allowed-tools: Read, Glob, Grep, Bash(git:*), Write, Edit, AskUserQuestion
---

# Compound

Capture what was learned from completed work so the system gets better over time. This is the fourth step of the compound engineering loop: Plan > Work > Review > **Compound**.

## When to Use

- After completing a feature, bug fix, investigation, or refactor
- After resolving a tricky issue worth remembering
- When the user says "compound", "capture learnings", "what did we learn"
- After a post-mortem or retrospective discussion

## When NOT to Use

- Mid-implementation (finish the work first)
- For ephemeral decisions that won't matter in future sessions
- For things already captured in CLAUDE.md or OpenSpec

---

## Workflow

### Step 1: Understand What Just Happened

Gather context about the completed work:

```bash
# Recent commits on this branch
git log --oneline -15

# What changed
git diff --stat $(git merge-base HEAD main)..HEAD 2>/dev/null || git diff --stat $(git merge-base HEAD master)..HEAD

# Current branch
git branch --show-current
```

Also read any relevant:
- OpenSpec proposals/specs in `openspec/` if they exist
- Recent conversation context (what was discussed)
- PR description if one exists

### Step 2: Reflection Questions

Ask the user these questions **one at a time** using AskUserQuestion:

1. **What was the problem?** (pre-fill from git context if obvious, ask to confirm)
2. **What was surprising or non-obvious about the solution?** (this is the core insight worth capturing)
3. **Did anything go wrong that we should prevent next time?**

Skip questions where the answer is clearly derivable from the code/commits. Focus on the non-obvious.

### Step 3: Classify the Learning

Determine what type of output is needed. Multiple may apply:

| Signal | Action |
|--------|--------|
| A reusable pattern or technique was discovered | Write a **solution doc** to `docs/solutions/` |
| A convention or preference should be enforced going forward | Propose a **CLAUDE.md update** |
| A category of bug was found and fixed | Write a **solution doc** + propose CLAUDE.md rule |
| A new workflow or automation would help | Propose a **new skill or agent** |
| An existing skill/agent behaved incorrectly | Propose a **skill update** |
| Nothing reusable — just a one-off fix | Skip documentation, confirm with user |

Ask the user which actions feel right if unclear.

### Step 4: Create Solution Doc (if applicable)

Write to `docs/solutions/` in the project root. Create the directory if it doesn't exist.

Use the solution template from [references/solution-template.md](references/solution-template.md).

**File naming:** `NNNN-<short-slug>.md` where NNNN is the next sequential number.

```bash
# Find next number
ls docs/solutions/*.md 2>/dev/null | tail -1
```

If no prior solutions exist, start at `0001`.

### Step 5: Update System (if applicable)

For each system update identified in Step 3:

**CLAUDE.md updates:**
- Read the current project CLAUDE.md
- Propose the specific addition (show the diff)
- Ask user to confirm before writing

**Skill/agent proposals:**
- Describe what the skill would do
- Ask if the user wants to create it now or capture it as a todo

### Step 6: Verify the Learning

Ask: **"If this exact situation happened again in a new session, would the system handle it better?"**

If yes — done. If no — identify what's still missing and loop back to Step 3.

---

## Output Format

End with a summary:

```markdown
## Compound Summary

**Work completed:** <one-line description>
**Key insight:** <the non-obvious learning>

### Artifacts created
- [ ] Solution doc: `docs/solutions/NNNN-slug.md`
- [ ] CLAUDE.md updated: <what was added>
- [ ] Skill proposed: <name and purpose>
- [ ] No artifacts needed — one-off fix

### System improvement
<One sentence: how the system is now better equipped for similar work>
```

---

## Key Principles

- **Capture the non-obvious** — If it's derivable from reading the code, it doesn't need a solution doc
- **Prefer system updates over documentation** — A CLAUDE.md rule that prevents a bug is worth more than a doc explaining the bug
- **One question at a time** — Don't overwhelm with all reflection questions at once
- **Skip when empty** — Not every task produces a compoundable learning. That's fine. Confirm with user and move on
- **Searchable over perfect** — A quick, tagged solution doc is better than no doc because you didn't have time to polish it

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Documenting obvious things derivable from code | Focus on the non-obvious: *why* a decision was made, not *what* was done |
| Skipping the verification step | Always ask "would the system catch this next time?" |
| Writing solution docs for one-off fixes | Confirm with user first — not everything needs documentation |
| Updating CLAUDE.md without asking | Always show the proposed change and get confirmation |
| Creating overly long solution docs | Keep solutions focused: problem, insight, pattern. Under 100 lines |
| Forgetting YAML frontmatter on solution docs | Always include — it's what makes solutions searchable |
