# Complete First-Pass Explanations

## Goal

Reduce clarification and rewording loops by making agent conversation provide a
complete first-pass explanation. Prefer two or three useful sentences over a
short answer that leaves the mechanism, relevance, or boundary implicit.

## Approach

- Extend the shared communication rule with an explanation contract. An
  explanatory answer must answer the exact question, state the mechanism that
  makes the answer true, add one useful example or contrast when needed, and
  state the relevant boundary or practical consequence.
- Keep applicable Simplified Technical English principles as the surface-style
  baseline. Preserve active voice, concrete words, stable terminology, and one
  point per sentence without claiming ASD-STE100 compliance or enforcing a
  controlled dictionary.
- Treat a follow-up such as `why?`, `how?`, or `what do you mean?` as evidence
  that the prior mental model was incomplete. Rebuild the explanation from one
  lower abstraction level instead of paraphrasing the prior answer or adding an
  unrelated example.
- Change confidence annotations from claim-level repetition to one annotation
  for each coherent conclusion or recommendation block. Use separate scores
  only when claims in the block have materially different uncertainty.
- Make explanation completeness blocking in clean-context behavioral pressure
  scenarios. Keep surface-style findings advisory so correct, natural prose is
  not rejected for superficial variation.

## Scope

Apply the contract as the global default for agent commentary and final
responses when they explain a technical concept, causal relationship,
diagnosis, recommendation, or decision. Apply the same explanation principles
to durable technical prose when it teaches or justifies a decision.

Do not force the four explanation responsibilities into acknowledgments,
status-only updates, direct answers that are already self-explanatory,
machine-readable contracts, code, exact provider templates, quotations, or
user-requested output shapes. Do not require examples when the mechanism and
boundary are already concrete. Do not add a controlled dictionary or claim
formal ASD-STE100 compliance.

## Terms

- **Explanation contract:** the semantic responsibilities needed to answer a
  question completely, independent of headings or a fixed response template.
- **Mechanism:** the causal or structural link that makes a claim true.
- **Relevant boundary:** the limitation, exception, or practical consequence
  needed to prevent the explanation from implying more than it proves.
- **Explanation repair:** a new explanation at a more concrete abstraction
  level after the reader signals that the prior explanation was incomplete.
- **Conclusion block:** a coherent paragraph or short group of bullets whose
  claims share one confidence basis.

## Material Decisions

- Optimize globally for complete first-pass understanding even when the initial
  response becomes two or three sentences longer.
- Enforce semantic completeness without prescribing a mandatory four-section
  response shape. The response may satisfy several responsibilities in one
  sentence when the result remains clear.
- Keep style diagnostics advisory. A short sentence limit, passive-voice rule,
  vocabulary list, or readability score must not block otherwise complete and
  accurate output.
- Keep confidence close to the conclusion it qualifies, but remove repeated
  annotations that interrupt a single line of reasoning.
- Preserve exact technical names and type expressions even when they do not
  belong to ordinary-language vocabulary.

## Reuse And Deviation Contract

`rules/communication.md` remains the canonical owner for conversational and
durable prose. Extend its existing Simplified Technical English-inspired
principles and completeness boundary rather than creating a new writing rule or
an always-triggered skill. `rules/confidence.md` remains the canonical owner for
confidence format and calibration; revise only annotation granularity.

`instructions/AGENTS.md`, `AGENTS.md`, and the `personal` and `work` AX profiles
already load those owners and require no parallel explanation policy.
`tests/unit/communication-rules.test.ts` remains the focused structural contract
test. The `writing-skills` RED/GREEN/refactor workflow remains the owner for
clean-context agent-behavior pressure scenarios.

The charter validator remains the mechanical owner for staged behavior-surface
classification. Register this plan and both changed rules to the focused
communication scenario, and extend the existing charter-gate test only as
required to prove that registry change.

The genuinely new mechanism is the semantic explanation contract and its
repair behavior. Existing concise-communication guidance cannot absorb the
requirement without extension because it controls sentence form and reader
need but does not require the causal bridge between a claim and its conclusion.
The accepted outcome intentionally deviates from the prior claim-level
confidence rule because repeated equivalent scores fragment the reasoning they
are meant to qualify.

End-to-end proof uses an anonymized TypeScript target-table scenario. A clean
agent must explain that exhaustiveness comes from a `Record` keyed by the target
union, distinguish that enforcement from the optional inference benefit of
`satisfies`, and state why that inference benefit does not affect a dispatcher
field already typed as the generalized table. The response must do this before
the reader asks separate `why?` and `what do you mean?` questions.

## Acceptance

- A first-pass technical explanation answers the exact question and includes
  the causal or structural mechanism needed to understand the conclusion.
- It includes a concrete contrast or example only when that materially improves
  understanding.
- It states the relevant limitation or practical consequence without expanding
  into unrelated design advice.
- It does not introduce an abstraction whose meaning or relevance the reader
  must request in another turn.
- It names material entities and their concrete relationship instead of using
  an ambiguous pronoun or spatial metaphor that hides the mechanism.
- After a clarification signal, it explains from a more concrete abstraction
  level instead of restating the same model in different words.
- One coherent conclusion or recommendation block carries one confidence
  annotation. Claims with materially different evidence or uncertainty remain
  separately scored.
- Existing confidence labels, numeric calibration, safety gates, and optional
  short reasons remain unchanged.
- Concision remains defined by reader need. The rule does not create a minimum
  answer length or require unnecessary examples, boundaries, or headings.

## Verification

- Focused structural tests verify the explanation contract, repair behavior,
  global scope, explicit exceptions, and block-level confidence policy in their
  canonical owners.
- Charter validation maps the plan and both changed rules to the executable
  communication RED/GREEN scenario and rejects an unclassified staged surface.
- Existing communication-rule tests continue to verify AX profile installation,
  entrypoint references, concise commentary, durable prose, and completeness
  safeguards.
- `writing-skills` RED/GREEN/refactor pressure scenarios exercise:
  - the TypeScript target-table explanation that previously required repeated
    clarification;
  - a concise direct answer that must not expand into ceremonial explanation;
  - a clarification repair that must move to a more concrete model rather than
    paraphrase;
  - a parent-child selector explanation that must name the identifier field
    linking the two entities instead of saying one is `beneath` the other;
  - mixed-confidence conclusions that must remain separately annotated; and
  - exact technical names that must survive the STE-inspired style pass.
- The pressure-scenario evaluator blocks missing semantic responsibilities and
  reports sentence-style concerns as advisory findings.
- Run the repository's formatting, focused unit-test, full pre-commit, and
  charter-validation paths. Review the exact target-base diff and HEAD before
  publication.

## Risks

- Agents can turn the contract into a repetitive four-part template. Prevent
  this by defining semantic responsibilities rather than required headings or
  sentence counts.
- More complete answers can become verbose. Keep examples and boundaries
  conditional on reader value and retain the existing stop condition.
- Block-level confidence can hide disagreement between claims. Require separate
  annotations when evidence or uncertainty materially differs.
- Style evaluation can become subjective. Keep semantic omissions blocking and
  surface-style findings advisory.
- Transcript fixtures can preserve private or incidental context. Use
  anonymized scenarios that retain only the failed reasoning pattern.

## First Real Confirmation

Run the anonymized target-table pressure scenario in a clean agent context. The
first response must identify the actual source of static exhaustiveness,
distinguish it from `satisfies`, explain the only relevant inference difference,
and stop without recommending a different architecture. The scenario fails if
the evaluator must ask `why?`, `how is that enforced?`, or `what do you mean?`
to recover any of those links.

## Delivery

Deliver this plan, the communication and confidence rule changes, and focused
contract tests in one final draft MR. Run the anonymized behavioral pressure
scenarios as task-local verification rather than committing their transcripts
or receipts. Target at most six changed files and 400 changed lines. No
OpenSpec, POC, dependency change, controlled-language package, or planning-only
MR is required.
