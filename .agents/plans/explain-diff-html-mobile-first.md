# Explain Diff HTML Mobile-First Presentation

## Goal

Make every generated explanation comfortable to read and operate on a narrow
phone viewport, with particular attention to the quiz presentation exposed by
the first real test drive.

## Scope

- Replace the fieldset-based quiz treatment with an in-card question header,
  compact answer markers, and feedback adjacent to the selected answer.
- Make narrow-screen layout the renderer default: single-column comparisons,
  contained code and tables, and horizontally coherent process flows.
- Let wider viewports add space and comparison columns without changing the
  reading order or interaction model.
- Document the mobile inspection contract in the shared skill.

## Acceptance

- Questions and answers remain visually associated without a legend crossing a
  card border.
- Every answer is a touch-sized button with a generated A-D marker and visible
  keyboard focus.
- Selected-answer feedback appears directly below that answer.
- At 320-430px, code, tables, diagrams, and comparisons stay within the page or
  expose intentional local scrolling instead of widening the document.
- Quiz ordering remains deterministic and balanced, and the offline/CSP safety
  boundary remains unchanged.

## Proof

- Focused renderer unit tests cover markup, feedback placement, mobile-first
  CSS, responsive enhancement, and containment primitives.
- The repository skill validator and native commit hooks pass.
- `writing-skills` reviews the revised behavior using the user's screenshot as
  the RED case and a fresh generated explanation as the GREEN case.
- Exact-head review covers the implementation diff. Browser-based local-file
  inspection is recorded as unavailable if the active browser policy continues
  to reject `file://` URLs.

## Delivery

One follow-up draft GitLab MR targeting `main`, followed by CI/no-pipeline
inspection and the configured Nitro review. Merge and live AX sync are outside
this change's authority.
