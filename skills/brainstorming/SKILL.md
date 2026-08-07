---
name: brainstorming
description: Use when brainstorming, designing features, exploring requirements, thinking through problems, shaping plans, or turning rough ideas into implementation-ready designs.
allowed-tools: Read, Glob, Grep, Task, AskUserQuestion
---

# Brainstorming

## Authority

Brainstorming is a bounded Explore specialist and remains read-only. The boundary applies
to the whole brainstorming turn: it does not write plans, specs, code, Git
state, or provider state. An opening request to fix or implement something does
not change that boundary. Later intent is interpreted by the canonical
[accepted-proposal contract](../../rules/investigation-and-implementation.md),
not by skill-local confirmation words.

## Choose the response shape

For a quick or narrow request with a known objective, use the compact route:
answer, one reason, and the next decision only when material. Do not use the
Orientation Map. Include domain terms only when ambiguity changes the answer.

For non-trivial or open-ended work, use the visible Orientation Map before
selecting a solution, v1, implementation slice, proof location, or capture
artifact.

## Open the problem

Inspect relevant code, docs, recent decisions, and repository precedent before
asking questions the repository can answer. For every non-trivial design, name
the closest implementations and canonical owners, what can be reused or
extended, what is genuinely new, and any material deviation. Report `No
applicable precedent found` only with the inspected paths or searches.

Identify independent read-only evidence lanes. Start them together when that
reduces latency, using a minimal evidence contract; keep a small coherent scan
inline. Do not combine independent lanes into a nominal single scan.

Use this exact response shape:

## Orientation Map

```markdown
**Orientation Map**
| Area | Working hypothesis | Why | Discuss? |
|---|---|---|---|
| Objective | ... | ... | Yes/No |
| Problem framing | ... | ... | Yes/No |
| Domain terms | ... | ... | Yes/No |
| Existing precedent | ... | ... | Yes/No |
| Approach | ... | ... | Yes/No |

**Discussion Queue**
1. [Decision that needs user judgment]
2. [Decision that changes scope, safety, architecture, or visible behavior]

**Working Hypotheses**
- [Evidence-backed recommendation that remains revisable]

**Next step**
[Ask the most consequential unresolved question, or name the next action.]
```

Keep the Discussion Queue to one to three material decisions. A material
decision changes scope, behavior, architecture, safety, ownership, operations,
cost, or another user-visible contract. State evidence-backed low-risk defaults
as working hypotheses; omit a question when inspected evidence makes the
direction unambiguous. When a question is necessary, ask one material question
at a time.

Clarify two to five domain terms only when wording is fuzzy, overloaded,
inconsistent with the repository, or material to the decision. Use the
repository's existing meaning when it is unambiguous.

If the intended outcome is unknown and a hypothesis would smuggle in
architecture, ask one problem-framing question and stop. A neutral map may show
what remains unknown, but must not recommend the blocked choice.

## Convergence boundary

The opening pass stays divergent. Converge only after later user intent clearly
selects or requests a bounded direction. Convergence may choose the objective,
selected feature, approach, v1 boundary, shipped context, deferred work, and a
recommended capture route; it still does not authorize implementation.

Prefer ownership in this order:

1. reuse the canonical implementation;
2. extend its canonical owner;
3. extract a shared boundary used by both paths;
4. add a new mechanism only with evidence that the earlier choices are unsafe
   or insufficient.

Load [convergence.md](references/convergence.md) only after convergence is
invited and slices, objective proof, or artifact routing are actually needed.

Stop and surface the unresolved decision when v1 depends on a hard gate,
dedicated infrastructure, signing, generic orchestration, multiple providers,
or another expensive foundation without a concrete first-outcome risk.

## Output

On the compact route, return the answer and boundary directly. On the opening
route, return the Orientation Map and no implementation artifact. On a later
convergent route, return the selected direction, rejected alternatives,
deferred scope, precedent ownership, material uncertainties, and recommended
next lifecycle action.
