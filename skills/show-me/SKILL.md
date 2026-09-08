---
name: show-me
description: Use when the user asks to show or visually explain the current topic, code shape, call flow, file responsibilities, proposed change, or UI comparison, including a focused HTML explainer.
---

# Show Me

Help the user understand the current question with the smallest useful visual.
Keep prose brief and put each visual beside the point it explains. Use the
conversation's concrete names and labels. Distinguish proposed or illustrative
shapes from behavior verified in source; inspect the relevant source before
claiming a sketch describes an existing implementation.

## Choose the view

- Logic or an algorithm: pseudocode.
- Runtime control flow: a call tree with meaningful ordering and branches.
- UI structure: a component tree, retaining relevant state and module owners.
- File responsibilities or a broad refactor: a shallow annotated file tree.
- Component interaction or data flow: Mermaid.
- A change to an existing shape: a `diff` of the relevant calls, components,
  files, or pseudocode. Label conceptual diffs as proposals rather than patches.
- Mostly new content, essential surrounding context, or a copyable target:
  show the complete small block, including types or signatures when useful.
- A visual layout, state comparison, or concept too dense for Mermaid: create
  one focused HTML diagram, infographic, or short slide deck.

Use one view unless another answers a distinct part of the question. Omit calls,
files, props, and states that do not help explain the decision. Load
[examples](references/examples.md) when a concrete sketch pattern would help.

## Focused HTML

Author the HTML directly; no other visualization skill or renderer is required.
Keep it standalone, with its styles and any necessary script in the file. Match
the product's colors, type, spacing, and components when those are known. Use
supplied labels and data, support mobile and desktop, and keep code and wide
diagrams contained. Treat source text as display data and escape it accordingly.

Save `show-me-<topic>.html` in a task-owned artifact location and open it using
the host's available file or browser capability. Inspect mobile and desktop
layout and any interactions when browser tools are available. Return the file
link and state any opening or visual-verification limitation accurately.

## Boundary

Work within the current lifecycle authority. A request for an explanation does
not authorize product edits or publication. Honor explicit no-write limits with
inline output. Create HTML only within authorized artifact-writing scope.

Keep focused HTML here. A detailed, verified code-change walkthrough with quiz
reinforcement belongs to `explain-diff-html` when that is the requested outcome.

Adapted from [HumanLayer's Show Me](https://github.com/humanlayer/skills/tree/main/plugins/show-me/skills/show-me).
Copyright (c) 2026 HumanLayer; distributed under the included [MIT license](LICENSE).
