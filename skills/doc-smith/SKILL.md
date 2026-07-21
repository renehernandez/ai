---
name: doc-smith
description: >
  Use when the user wants to write, review, audit, or improve engineering
  documentation. Triggers on: "write docs for X", "document this feature",
  "create a guide", "draft a tutorial", "write an explanation", "co-author
  documentation", "add a doc", "review this doc", "audit the documentation",
  "check this guide", "review the docs in this MR", "review changed docs".
  Also use when the user passes a `.md` file path, a branch, or a diff ref and
  asks for documentation feedback.
allowed-tools: Read, Glob, Grep, Bash(git:*), Write, Edit, AskUserQuestion, Task
---

# doc-smith

Write or review engineering documentation with a compact note path and a full
documentation pipeline. Use the smallest path that preserves accuracy and the
reader's outcome.

## Arguments

- **Topic, file path, or branch** (optional)
  - Topic or feature name → writing mode (e.g. `feature flags`)
  - File path → review mode (e.g. `docs/feature_flags.md`)
  - Branch or diff ref → review mode on changed `.md` files (e.g. `origin/main`)
  - If omitted, ask the user whether they want to write or review

### Example invocations

```text
/doc-smith feature flags                # writing mode, topic
/doc-smith docs/feature_flags.md        # review mode, file
/doc-smith origin/main                  # review mode, diff vs main
/doc-smith                              # ask the user which mode
```

## When to Use

- User says "write docs", "document this", "create a guide", "draft a tutorial", "write an explanation", "co-author documentation"
- User says "review this doc", "audit the documentation", "check this guide", "review the docs in this MR", "review changed docs"
- User asks to document a feature, API, workflow, or concept
- User has existing notes or source material and wants help turning them into a doc
- User passes a `.md` file path and asks for feedback

## When NOT to Use

- User wants to **review code** changes — use a code-review workflow, not this skill
- User wants to review an atomic plan or OpenSpec artifact — these are planning
  contracts owned by Plan and the planning Review baseline
- User wants a **small inline edit** to a single sentence in a doc — do that directly without this workflow
- User wants a **README** for a brand new project with no existing material — start with the project setup, come back here

---

## Pipeline overview

```text
Compact note: inspect source → draft directly → run focused quality gate
Stage 1: Mode and intake      → determine write vs review, gather doc + context
Stage 2: Context (write only) → topic, doc type, location, source material, clarifying questions
Stage 3: Structured analysis  → rubric review across seven dimensions
Stage 4: Draft or fix plan    → section-by-section drafting (write) or findings report (review)
Stage 5: Reader testing       → one final wave when acceptance or material comprehension risk requires it
```

Review mode enters at Stage 3. Full writing mode runs all five stages.

## Compact note path

Use this path for one bounded operational or reference note when the audience,
outcome, source material, and target location are known or clear from the
repository. Do not use it for tutorials, onboarding, multi-step guides, or
documents with unresolved scope.

1. Verify the claim and local document convention from source.
2. Draft the complete note directly. Keep only the content needed to understand
   or use it.
3. Run focused accuracy, actionability, tone, and formatting checks.

Do not ask questions the repository already answers. Do not require Diataxis
classification, frontmatter, prerequisites, a recap, or a See Also section
unless the target format or reader task requires them. Skip the scaffold and
section-by-section approval. Run reader personas only when audience
comprehension is part of acceptance or a material comprehension risk remains.

---

## Stage 1: Mode and intake

### Step 1: Determine mode

Use the first matching case:

1. **File path argument** — review mode. `Read` the file directly. Skip to Stage 3.
2. **Branch or diff argument** — review mode. Run:
   ```bash
   git diff --name-only $(git merge-base HEAD <ref>)..HEAD | grep -E '\.(md|mdx)$'
   ```
   Present the matching files to the user. Confirm which to review. Skip to Stage 3.
3. **Topic or feature name** — writing mode. Proceed to Stage 2.
4. **No argument** — ask the user via `AskUserQuestion`: are they writing a new doc or reviewing an existing one?

When no `.md` files are found in a diff, fall back to asking the user for a file path.

When multiple `.md` files are in scope, review each completely before moving to the next. If more than 10 files are identified, ask the user which to prioritize.

---

## Stage 2: Context gathering (writing mode only)

Never skip this stage on the full writing path. The compact note path gathers
the same facts from the prompt and repository without a questionnaire.

### Step 1: Understand the topic

Ask the four core questions — accept a single info dump covering all four, or ask individually:

1. **What** — What is the topic? What does it do or explain?
2. **Who** — Who is the reader? (New engineer, experienced engineer from another team, external user?)
3. **Outcome** — What should the reader be able to do or understand after reading?
4. **Source material** — Is there existing code, a design doc, a Slack thread, or other material to draw from?

### Step 2: Classify the Diataxis doc type

Present the doc type table from `references/diataxis-templates.md` and confirm the type with the user. If the topic spans multiple types, explain the trade-offs and recommend the primary type.

### Step 3: Determine the target location

1. Use `Glob` to look for an existing `docs/` directory or `README.md` in the project root.
2. If a `docs/` directory exists, look at neighboring files to understand naming conventions and `sidebar_position` numbering.
3. Propose a file path following snake_case naming (e.g. `docs/feature_flags.md`).
4. Confirm the path with the user via `AskUserQuestion` before proceeding.

### Step 4: Gather existing context

Use available tools to gather material — do not fabricate technical details:

- `Glob` — find related docs, source files, test files, config examples
- `Read` — read source code or config that the doc will describe
- `Grep` — locate usages, function names, API calls referenced in the topic
- Read 2-3 neighboring docs to internalize the project's tone and formatting style

### Step 5: Clarifying questions

Ask 5-8 targeted questions to close remaining gaps. Tailor questions to the doc type and what you found in Step 4. Examples:

- What are the prerequisites a reader needs before starting?
- Are there gotchas or common mistakes worth calling out?
- Which edge cases are in scope vs. out of scope?
- Are there related docs that should be cross-linked?
- Should this include a diagram? (architecture, sequence, flow)
- What version or environment does this apply to?
- Is there anything intentionally not explained here?

Do not proceed to Stage 3 until the user confirms the context is complete.

---

## Stage 3: Structured analysis

Apply the review rubric in `references/quality-rubric.md` across all seven dimensions: Diataxis fit, Accuracy, Completeness, Actionability, Tone and slop, Formatting, Cross-links.

For **writing mode**: review the Stage 2 context and use the rubric as a forward-looking checklist for what the scaffold and draft must cover. No report is produced here — continue to Stage 4.

For **review mode**: read the full document, then produce the structured findings report using the format in `references/quality-rubric.md`. Continue to Stage 5 for reader testing. The final report is assembled after Stage 5.

---

## Stage 4: Draft or fix plan

### Writing mode: scaffold and drafting loop

#### Step 1: Generate scaffold

Produce an outline — not full prose. The outline must include:

- Docusaurus frontmatter block (filled with proposed values)
- Section headings from the Diataxis template for the confirmed doc type (see `references/diataxis-templates.md`)
- 1-2 sentence placeholder describing what each section will contain
- Proposed Mermaid diagram locations with a note on diagram type (e.g. `[Mermaid sequence diagram: auth flow]`)

Confirm the structure with the user before writing any prose. A wrong structure is harder to fix mid-draft than pre-draft.

#### Step 2: Section-by-section drafting loop

For each section in the scaffold:

1. Draft the section in full.
2. Present it to the user.
3. Refine based on feedback.
4. Move to the next section only when the user is satisfied.

Do not draft the entire document at once. Iterating section by section keeps quality high and avoids large rewrites.

#### Step 3: Quality gate

Before presenting the near-final draft, self-assess against every criterion in the quality gate table in `references/quality-rubric.md` and run the slop-detection scan. All criteria must pass; any failure must be fixed before moving on. Report the result inline.

---

### Review mode: findings report

Produce the structured findings report using the format in `references/quality-rubric.md`. The full report has three parts: header, severity summary, and findings list.

```markdown
## Doc Review: <doc title or filename>

**File:** <path>
**Diataxis type:** <Tutorial | Guide | Explanation | Reference>
**Review scope:** <Full | Focused: <dimensions>>

### Severity summary
- Critical: <count>
- Warning: <count>
- Suggestion: <count>

### Findings

**[WARNING]** — Accuracy [Stage 3 Analysis]
Location: `docs/feature_flags.md:42`
Issue: Example config key `feature_flags.toggle` does not match the actual key used in source (`feature_flag.toggle`, singular).
Fix: Update the example to `feature_flag.toggle` and add a note about the naming.

**[SUGGESTION]** — Cross-links [Stage 5 Reader Test: New Engineer]
Location: See Also section
Issue: No link to the rollout playbook, which the reader will need immediately after this doc.
Fix: Add `- [Rollout playbook](./rollout_playbook.md)` to See Also.
```

---

## Stage 5: Reader testing

Reserve reader testing for user-facing or operational documentation when
audience comprehension is part of acceptance or a material comprehension risk
remains. Never use it for atomic plans or OpenSpec artifacts. Run one persona
wave, in parallel, against the final stable document text after structured
analysis and drafting are complete; do not rerun personas after every
intermediate edit.

Use the `Task` tool and pass only the final stable document text—no conversation
history or surrounding context. Substitute `<target reader profile>` with the
reader description gathered in Stage 2 (writing mode) or inferred from the
document's content and tone (review mode). If the reader profile is unclear in
review mode, ask the user before Stage 5.

**Sub-agent 1: New engineer persona**

```text
You are a new engineer who just joined the team.
Target reader profile for this doc: <target reader profile>
Read the following documentation and report:
1. Steps that need more context to follow
2. Terms that are not explained
3. Setup assumptions that are not stated
4. Anything confusing or unclear
5. Points where your level of experience diverges from the target reader profile

Document:
<doc text>
```

**Sub-agent 2: Experienced engineer from different team persona**

```text
You are an experienced engineer from a different team who understands the general stack but not this specific system.
Target reader profile for this doc: <target reader profile>
Read the following documentation and report:
1. Technical inaccuracies or misleading statements
2. Points where you got stuck or needed to re-read
3. Missing cross-links to related systems or docs
4. Anything that seems out of date or inconsistent
5. Points where your level of experience diverges from the target reader profile

Document:
<doc text>
```

**Writing mode** — run reader testing only when audience comprehension is part
of acceptance or a material comprehension risk remains. If it surfaces gaps,
loop back to Stage 4 Step 2 and revise the affected sections before writing.

**Review mode** — use the same trigger. When it applies, run both personas once
and fold their findings into the report using the source labels from
`references/quality-rubric.md`. Otherwise stop after the structured rubric.

---

## Write the file (writing mode only)

After Stage 5 reader testing is complete (or skipped):

1. Use the `Write` tool for new documents or the `Edit` tool for additions to existing documents.
2. Return the result to the invoking lifecycle owner. For a standalone
   invocation, tell the user:
   - The file has been written or updated.
   - The absolute path to the file.
3. Doc Smith does not commit by itself. An enclosing Execute owner retains its
   existing commit authority.

---

## Constraints

- **Never skip Stage 2** on the full writing path — writing without context produces generic, inaccurate docs
- **Confirm doc type** before scaffolding on the full writing path
- **Confirm file path** when the prompt and repository do not already establish it
- **Never fabricate technical details** — read source code or ask the user
- **Scope per invocation** — writing mode: one new or existing document per invocation. Review mode: multiple files allowed (see Stage 1), reviewed one at a time
- **Reader tests have one trigger** — run them only when audience comprehension is part of acceptance or a material comprehension risk remains; never run them for planning contracts
- **Review output is inline only** — do NOT write the review report to a file; the user decides what to fix
- **Do not commit as Doc Smith** — return control to the enclosing lifecycle owner, which retains its existing authority
- **Never flag accuracy issues without evidence** — confirm via code search or explicitly label as unverified

---

## Common mistakes

| Mistake | Fix |
|---------|-----|
| Skipping context on the full path | Complete Stage 2 before scaffolding |
| Bare code blocks without language identifiers | Every code block must have a language (e.g. `ruby`, `bash`, `yaml`) |
| Using kebab-case filenames | Use snake_case: `feature_flags.md` not `feature-flags.md` |
| Adding document ceremony by habit | Use the compact note path when its bounded criteria hold |
| Missing required frontmatter | Add it when the repository format requires it |
| Passive or hedging tone | Use imperative mood; state what to do, not what the reader "might" do |
| AI slop phrases | Scan for "simply", "just", "it's worth noting" and remove all instances |
| Skipping scaffold confirmation on the full path | Confirm the outline before writing prose |
| Missing required See Also section | Add it when the reader task or repository format requires it |
| Fabricating technical details | Read source code or ask the user — never invent API names, config keys, or behavior |
| Writing a full-path doc at once | Draft section by section and get user approval at each step |
| Ignoring neighboring docs on the full path | Read 2-3 neighbors to match the project's conventions |
| Running reader tests on planning contracts | Route atomic plans and OpenSpec artifacts through planning Review. |
| Repeating reader tests after intermediate edits | Run one parallel wave against final stable document text. |
| Writing review report to a file | Report output is inline in the conversation only |
| Flagging accuracy issues without checking source | Use `Grep` and `Read` to verify before flagging — or label as unverified |
| Reviewing only part of the doc | Always `Read` the full file before producing any findings |
| Running sub-agents with conversation history | Pass only the document text — no context bleed |
| Flagging issues without a suggested fix | Every finding must include a specific `Fix:` line |
| Skipping the severity summary header | Always output the severity summary block before the findings list |

---

## Reference files

| File | Content |
|------|---------|
| `references/quality-rubric.md` | Review rubric, severity definitions, quality gate criteria, slop detection, finding format |
| `references/diataxis-templates.md` | Scaffold templates for Guide, Tutorial, Explanation, and Reference doc types |
| `references/formatting-conventions.md` | Docusaurus frontmatter, filenames, code blocks, diagrams, tone, tables, headings |

---

## See Also

- `writing-skills` — TDD-based approach for authoring the skills themselves (useful when updating this skill or adding a sibling)

## Test Evidence

- RED: a bounded operational note expanded to 171 words with frontmatter,
  prerequisites, a recap, and See Also despite a fully known reader and claim.
- GREEN: the compact note path preserved the verified behavior and confidence
  annotation in 32 words without document ceremony.
