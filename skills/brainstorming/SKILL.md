---
name: brainstorming
description: "Collaborative design workflow for turning ideas into fully formed designs. ALWAYS invoke when brainstorming, designing features, thinking through problems, or exploring requirements before implementation."
allowed-tools: Read, Glob, Grep, AskUserQuestion
model: opus
---

# Brainstorming Ideas Into Designs

Help turn ideas into fully formed designs through collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each whether it looks right.

## The Process

**Understanding the idea:**
- Check out the current project state first (files, docs, recent commits)
- Ask questions one at a time using AskUserQuestion
- Prefer multiple choice when possible; open-ended is fine too
- Focus on: purpose, constraints, success criteria

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Lead with your recommendation and explain why
- Use this format for each approach:

```
**Approach: [Name]**
- How it works: [Brief description]
- Pros: [What you gain]
- Cons: [What you lose or defer]
- Best when: [Conditions where this shines]
```

**Presenting the design:**
- Break the design into sections of 200-300 words
- Ask after each section whether it looks right
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## Ending the Session

When the design is complete, detect what documentation patterns exist in the project and recommend the best fit.

**First, scan the project for existing patterns:**
```bash
# Check for OpenSpec (directory with specs/ subdirectory)
ls -d openspec/ openspec/specs/ 2>/dev/null

# Check for plan/spec directories
ls -d docs/plans docs/specs specs/ plans/ design/ 2>/dev/null

# Look at recent markdown files for patterns
find . -name "*.md" -path "*/docs/*" -mtime -30 2>/dev/null | head -10
```

Also check if Linear MCP tools are available (e.g., `mcp__linear-server__create_issue`). If so, Linear is an option for capturing the design.

**Recommend based on what exists:**

| If you find... | Recommend |
|----------------|-----------|
| `openspec/` directory with `specs/` | OpenSpec proposal - formal spec workflow is set up |
| `docs/plans/` or `specs/` | Plan document in that directory |
| Linear MCP available | Linear issue or project doc for team visibility |
| Nothing specific | Ask user preference, suggest plan file in project |

Ask: "The design looks complete. I see this project uses [detected pattern]. Want me to create a [spec/plan/doc] there, or would you prefer something else?"

**Options to offer:**

| Option | When to use |
|--------|-------------|
| **OpenSpec proposal** | Project has OpenSpec configured; formal designs needing review |
| **Plan/spec document** | Project has established docs structure; implementation-ready work |
| **Start implementing** | Simple changes where conversation provides enough context |
| **End session** | User wants to think more or hand off |

**If creating a document:**
- Use the project's established location and format
- Capture all design decisions, requirements, and trade-offs
- Include enough context for someone unfamiliar to understand

**If implementing:**
- Ask if they want to continue in this session or start fresh
- If starting fresh, provide a detailed prompt with sufficient context

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended
- **YAGNI ruthlessly** - Remove unnecessary features from designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Context-aware** - Respect the project's existing documentation patterns
