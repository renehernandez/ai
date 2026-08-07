# Testing Skills With Subagents

Load this reference when a skill change needs live model evaluation or a
pressure scenario. Deterministic assertions remain preferable when code can
decide the behavior exactly.

## Choose the evaluation

| Skill type | Primary evaluation | Pass condition |
|---|---|---|
| Discipline | Pressure scenario with competing incentives | The agent preserves the boundary under pressure |
| Technique | Application scenario and edge case | The agent applies the method to a realistic artifact |
| Pattern | Recognition and counterexample scenarios | The agent selects the pattern only when it fits |
| Reference | Retrieval and application scenario | The agent finds and correctly uses the required detail |

Use semantic evaluation only for qualities that deterministic state cannot
prove. A semantic judge cannot override a forbidden mutation, missing output
field, stale target, or failed schema.

## RED, GREEN, REFACTOR

### RED: establish the gap

Run the scenario without the proposed instruction or against a fixture that
lacks it. Keep the task realistic and avoid telling the model the expected
answer. Record:

- the prompt and available tools;
- target artifact or fixture fingerprint;
- observable actions and structured output;
- the failed criterion and evidence;
- runner and model identity for live evals.

A pre-inference runner, credential, or gateway error is a setup failure, not
behavioral RED evidence.

### GREEN: test the changed skill

Run the same scenario with the proposed skill. Assert observable behavior:
filesystem state, tool calls, provider receipts, selected route, structured
fields, retrieval result, or a named semantic criterion. Do not require an
exact phrase when equivalent behavior is acceptable.

### REFACTOR: reduce while preserving behavior

Remove duplicate explanation, examples, counters, or mechanics and run the
same proof again. Add a new instruction only when a new failing case identifies
a real gap. A passing result on a materially different scenario does not close
the original contract.

## Scenario design

A useful scenario contains:

1. a realistic goal and artifact;
2. only the authority and tools available in production;
3. one material decision boundary;
4. observable pass and fail criteria;
5. isolation from live repositories and providers when mutation is possible.

For discipline skills, combine pressures that plausibly cause the boundary to
fail, such as urgency, sunk cost, authority, or convenience. Keep the expected
choice out of the prompt. For retrieval tests, place relevant and distracting
material in separate references and verify both selection and application.

## Concise examples

### Discipline

Ask an agent to review an urgent exact-head change while offering write tools.
Pass when it reports findings without modifying the repository.

### Technique

Give the agent a small artifact with one normal case and one edge case. Pass
when the produced transformation handles both and stays within scope.

### Pattern

Present one case where the pattern reduces complexity and one where it adds an
unneeded abstraction. Pass when the agent distinguishes them with evidence.

### Reference

Put a required provider flag in a linked reference, not the main skill. Pass
when the agent loads that reference only for the provider-shaped request and
uses the flag correctly.

## Result record

Keep evaluation evidence task-local unless the fixture or contract is reusable
repository machinery. Record scenario ID, target fingerprint, runner, model,
result, deterministic receipts, judge result if any, and diagnostics. A later
skill change must rerun the affected scenario; unrelated passing scenarios do
not substitute for it.
