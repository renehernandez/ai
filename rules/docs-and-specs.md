# Documentation and Specs Rules

These rules cover documentation workflow, OpenSpec, and diagrams.

## Documentation

- When the user wants to write docs, document a feature, create a guide, draft a tutorial, co-author documentation, review a doc, audit documentation, or check a guide, always use the `/doc-smith` skill.
- Load `/doc-smith` before any non-trivial create, edit, or review of a file under a `docs/` directory.
- Also load `/doc-smith` before non-trivial work on any Markdown documentation file, including guides, how-tos, references, explanations, onboarding docs, ADRs, and solution docs.
- This applies even when the user phrases the task implicitly, such as `let's also write that up`, `add that to a proper doc`, or `put this in the onboarding guide`.
- Trivial edits, such as fixing a typo, updating a stale path, or adding a one-line clarification, do not require `/doc-smith`.
- The rule applies in plan mode and normal mode.

## Machine-Readable Thread Contracts

- When writing a machine-readable YAML or JSON block back to a chat thread, first include a concise `## Readable Summary`.
- This applies to handoffs, ledgers, gate reports, reviewer reports, OpenSpec blueprints, plan delivery artifacts, automation state, and other structured contracts.
- Keep the summary to 3-6 bullets naming status, artifact, scope or unit, verification or gate state, blockers, and next action as relevant.
- Keep the YAML or JSON block immediately after the summary so machine readers still have the structured contract.
- Tiny scalar command outputs and ordinary code or config snippets are exempt.

## OpenSpec Changes

- Never write OpenSpec proposals, designs, specs, or tasks directly.
- Use `/opsx:propose` to create new OpenSpec changes.
- Use `/opsx:apply` to implement OpenSpec changes.
- Use `/opsx:explore` to investigate problems or clarify requirements before proposing.
- Use `/opsx:archive` to archive completed changes.
- This applies to any project with an `openspec/` directory.

## OpenSpec Task Shape

- OpenSpec `tasks.md` headings are delivery units. In stacked plan delivery, one
  delivery-unit heading normally maps to one implementation PR/MR. The checkboxes
  under that heading are nested work items for that same PR/MR, usually one
  commit each.
- Use delivery-unit headings for deliverable implementation areas with
  reviewable outcomes, often the phases named in the plan. Do not use headings
  for process lifecycle phases.
- Target 2-6 nested work items per delivery unit. More than 6 and at most 8
  work items is a split smell and needs a `Justification:` paragraph attached
  to the heading before the first checkbox. More than 8 work items is a
  planning-readiness blocker. A one-item delivery unit is a merge smell unless
  risk, deployment, reviewability, or ownership boundaries justify a separate
  PR/MR.
- Do not add task groups anywhere in the file that are dedicated only to
  documentation, linting, testing, review, validation, or verification.
- Documentation, linting, testing, review, validation, and verification belong
  in the corresponding delivery unit or nested work item as acceptance or
  verification work. When warranted, make them a proof subcheck or
  acceptance/verification bullet inside the related work item. They are not a separate OpenSpec task checkbox
  or independent delivery unit.
- Docs, testing, validation, CI, reviewer tooling, runtime validation tooling,
  or reusable AI workflow machinery are valid only when that area is the feature being
  changed. Deliverable-scoped proof subchecks are valid only inside the related
  nested work item, not as independent OpenSpec task checkboxes.
- Existing bad task shape must block with `needs_spec_redesign`. Ask the user
  whether to redo the spec, brainstorm a better breakdown, narrow the change, or
  choose another planning route. Do not silently rewrite `tasks.md`.

Valid delivery-unit breakdown:

```md
## 1. Contract Shape

- [ ] 1.1 Update the shared task-shape rule
- [ ] 1.2 Update readiness blueprint guidance
- [ ] 1.3 Update planning review guidance
```

Invalid lifecycle breakdown:

```md
## 4. Testing and Documentation

- [ ] 4.1 Run validation
- [ ] 4.2 Update docs
```

## Diagrams in Documentation

- Always use Mermaid for diagrams in Markdown docs, including READMEs, guides, ADRs, and solution docs.
- Never use ASCII art diagrams.
- Use `flowchart` for architecture and request flow.
- Use `sequenceDiagram` for interactions over time.
- Use `erDiagram` for data models.
- Use `stateDiagram-v2` for lifecycles.
- GitLab and GitHub both render Mermaid natively in Markdown.
