# Quality Rubric

Use this rubric during both the quality gate (writing phase) and structured analysis (review phase).

---

## Severity definitions (review phase)

| Severity | Meaning |
|----------|---------|
| **CRITICAL** | Factually wrong, missing required sections, or would cause a reader to take a wrong action |
| **WARNING** | Incomplete, misleading, or likely to confuse a reader |
| **SUGGESTION** | Style, clarity, or minor improvement — correct but could be better |

---

## Review rubric

| Dimension | What to check |
|-----------|---------------|
| **Diataxis fit** | Structure matches the inferred doc type; sections appear in the correct order for that type; the doc does not mix tutorial and reference material in a way that degrades both |
| **Accuracy** | Spot-check technical claims against source code via `Read` and `Grep`; verify command syntax, config keys, API names, and version references are correct |
| **Completeness** | Required sections are present; no unfilled placeholders (`TODO`, `TBD`, `<insert…>`); prerequisites and outcomes are stated when the reader task needs them |
| **Actionability** | A reader can follow instructions without needing outside help; steps are unambiguous; commands are complete and runnable |
| **Tone and slop** | No weasel words ("simply", "just", "easily", "straightforward"); no filler phrases ("it's worth noting", "keep in mind that"); no hedging in instructions ("might want to", "could potentially"); imperative mood used for steps |
| **Formatting** | Required frontmatter is complete; code blocks have language identifiers; headings are sentence-cased; no emojis in headings; tables are used appropriately; internal links are relative |
| **Cross-links** | Required cross-links are present; internal links use relative paths; no obviously broken references; related docs are linked where the reader task needs them |
| **Source-of-truth fit** | The document serves a reader outcome instead of duplicating or mirroring source code; it does not exhaustively restate CI jobs, dependencies, variables, or sequencing that canonical configuration owns; tutorials, onboarding guides, executable runbooks, public reference material, and examples retain only the concrete detail their reader task requires |

For the **Accuracy** dimension, use `Grep` to locate relevant source files and `Read` to verify technical claims. Do not flag accuracy issues without evidence — either confirm via code search or explicitly label the finding as unverified.

---

## Quality gate criteria (writing phase)

Before presenting a near-final draft, self-assess against every criterion below. All must pass; fix any failure before moving on. Report the result inline.

| Criterion | Check |
|-----------|-------|
| Completeness | All required sections are filled; no placeholders remain |
| Accuracy | No technical claims made without reading source code or confirming with user |
| Structure | Sections follow the Diataxis template for the confirmed type |
| Actionability | A reader can follow instructions without needing to ask someone else |
| Tone | Direct, imperative, concise — no hedging or filler |
| Formatting | Code blocks have language identifiers; tables used for comparisons; no emojis in headings |
| Cross-links | Reader-required related docs are linked; internal links use relative paths |
| Source-of-truth fit | Prose does not mirror source or transient CI internals; concrete tutorial, onboarding, runbook, reference, and example details serve the reader outcome |

---

## Slop detection

Scan the full draft for the following patterns and fix each before presenting:

- **Weasel words**: "simply", "just", "easily", "straightforward", "obvious"
- **Filler phrases**: "it's worth noting", "keep in mind that", "as mentioned above"
- **Flattery**: "great question", "excellent choice", "this is a powerful feature"
- **Hedging**: "might", "could potentially", "in some cases" — prefer direct assertions. Test: can the statement be made more direct without losing accuracy? If yes, it is slop. Only keep hedged phrasing when the outcome genuinely depends on inputs the doc cannot pin down (e.g. the reader's cloud provider).
- **Passive voice**: prefer active voice for instructions (e.g. "Run the command" not "The command should be run")
- **Long sentences**: split any sentence over 30 words

Fix all instances before presenting the cleaned version.

---

## Finding format (review phase)

For each finding, use this format:

```text
**[CRITICAL|WARNING|SUGGESTION]** — <Dimension> [<source>]
Location: <section name or line reference>
Issue: <what is wrong>
Fix: <specific suggested change>
```

Source labels:
- `[Stage 3 Analysis]` — structured rubric analysis
- `[Stage 5 Reader Test: New Engineer]` — new engineer sub-agent
- `[Stage 5 Reader Test: Experienced Engineer]` — experienced engineer sub-agent

## Reader persona prompts

Pass only the stable document and target-reader profile.

- **New engineer:** identify missing context, unexplained terms, unstated setup,
  confusing steps, and places where the assumed experience differs from the
  target reader.
- **Experienced adjacent engineer:** identify inaccuracies, rereading points,
  missing system links, stale or inconsistent claims, and places where domain
  knowledge is assumed without explanation.

Ask each persona for concrete locations and reader impact. Treat their output
as evidence to assess, not findings to copy automatically.
