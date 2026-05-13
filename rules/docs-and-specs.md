# Documentation and Specs Rules

These rules cover documentation workflow, OpenSpec, and diagrams.

## Documentation

- When the user wants to write docs, document a feature, create a guide, draft a tutorial, co-author documentation, review a doc, audit documentation, or check a guide, always use the `/doc-smith` skill.
- Load `/doc-smith` before any non-trivial create, edit, or review of a file under a `docs/` directory.
- Also load `/doc-smith` before non-trivial work on any Markdown documentation file, including guides, how-tos, references, explanations, onboarding docs, ADRs, and solution docs.
- This applies even when the user phrases the task implicitly, such as `let's also write that up`, `add that to a proper doc`, or `put this in the onboarding guide`.
- Trivial edits, such as fixing a typo, updating a stale path, or adding a one-line clarification, do not require `/doc-smith`.
- The rule applies in plan mode and normal mode.

## OpenSpec Changes

- Never write OpenSpec proposals, designs, specs, or tasks directly.
- Use `/opsx:propose` to create new OpenSpec changes.
- Use `/opsx:apply` to implement OpenSpec changes.
- Use `/opsx:explore` to investigate problems or clarify requirements before proposing.
- Use `/opsx:archive` to archive completed changes.
- This applies to any project with an `openspec/` directory.

## Diagrams in Documentation

- Always use Mermaid for diagrams in Markdown docs, including READMEs, guides, ADRs, and solution docs.
- Never use ASCII art diagrams.
- Use `flowchart` for architecture and request flow.
- Use `sequenceDiagram` for interactions over time.
- Use `erDiagram` for data models.
- Use `stateDiagram-v2` for lifecycles.
- GitLab and GitHub both render Mermaid natively in Markdown.
