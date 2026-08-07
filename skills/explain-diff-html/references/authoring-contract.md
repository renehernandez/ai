# Explanation Authoring Contract

## Narrative

Order the page for understanding:

1. **Background:** a skippable beginner model and the relevant prior contract.
2. **Intuition:** the smallest useful model, representative values, and a clear
   old-versus-new comparison.
3. **Code:** conceptual groups ordered by execution or dependency flow, with
   precise file references.
4. **Quiz:** five medium-difficulty questions about behavior, causality,
   contracts, edge cases, or trade-offs.

Explain jargon on first use. Distinguish observed facts from interpretation.
Use captions and example values to make a diagram's meaning accessible.

## Visual and Passive-Data Boundary

Use the renderer's passive classes and semantic HTML. Code belongs in escaped
`<pre><code>` blocks. Keep comparisons stackable, flows horizontally
scrollable, and code/tables contained at narrow widths.

Do not use ASCII diagrams, tabs, remote fonts/images, CDNs, network assets,
inline handlers/styles, active elements, navigation/resource attributes, or
source-derived markup. Repair rejected content at the spec boundary.

## Quiz

Give each question four parallel, plausible options with one correct answer and
specific feedback for every option. Test understanding, not trivia or copied
phrases. Avoid jokes, all/none choices, answer letters, uniquely qualified
correct answers, and manual option reordering. The renderer balances answer
positions and shuffles distractors deterministically.
