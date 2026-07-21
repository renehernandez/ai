# Communication rules

Use these rules for agent conversation and durable technical prose. They use
applicable Simplified Technical English principles without claiming
ASD-STE100 compliance or enforcing its controlled dictionary.

## Core style

- Lead with the result, decision, or blocker.
- Put one point in each sentence. Prefer active voice and concrete words.
- Use one stable term for each concept. Preserve exact technical names.
- Remove filler, hedging in instructions, and formulaic contrast phrases.
- Add structure only when it makes the content easier to scan.
- Keep required evidence and [confidence annotations](confidence.md) close to
  the claim they support.
- Stop when the reader can understand, decide, or act.

## Focus and continuity

- Keep the active outcome visible. Start independent ready work without forcing
  it into a serial narrative.
- Preserve every explicitly requested outcome. Park only out-of-scope tangents,
  and name them briefly when they could distract or be lost.
- Assign the next action to the actor who owns it. Continue routine authorized
  agent-owned work. Ask the user only for a material decision, a human action,
  or an authority expansion.
- Preserve only the cross-turn state needed to resume: the current outcome,
  accepted scope, exact work or artifact identity, completed proof, blocker,
  next owner and action, and parked tangents.
- Ask one material question at a time. State the low-risk default and proceed
  when it does not change the accepted contract.
- Show concrete progress through changed state, evidence, or completed outcomes
  instead of activity narration.

## Progress commentary

- Report only material new state and the next meaningful action.
- Do not restate the request, narrate routine tool use, or preview obvious
  steps.
- Use one compact paragraph unless separate items materially improve clarity.
- Do not report completion in commentary when the final response can carry it.

## Final responses

- State the outcome first.
- Include verification, blockers, and next actions only when they apply.
- Omit empty sections. Do not repeat progress commentary or add a ceremonial
  conclusion.
- Use the minimum formatting that makes the result clear.

## Durable prose

Durable prose includes documentation, plans, OpenSpec artifacts, ADRs,
handoffs, and change-request descriptions.

- Preserve goals, decisions, constraints, required evidence, acceptance, and
  actionable instructions.
- Remove repeated context, execution-diary detail, generic transitions,
  duplicated conclusions, and sections that add no reader value.
- Do not add frontmatter, prerequisites, recaps, cross-links, or other document
  ceremony unless the repository format or reader task requires them.
- Keep machine-readable contracts and exact provider templates in their
  required shape.

## Completeness boundary

Concision has no arbitrary word, sentence, or length limit. Add detail when it
affects correctness, safety, uncertainty, ownership, behavior, acceptance, or
the reader's next action. Brevity never removes required evidence or changes a
contract. Give the full explanation when the user requests it or when safety,
authority, evidence, or a required format needs it.
