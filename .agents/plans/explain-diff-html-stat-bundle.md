# Stat-Compatible Offline Explanation Bundle

## Goal

Make every `explain-diff-html` artifact retain its interactive quiz when opened
directly from local disk or published as a static folder to Stat, without
weakening Stat's generated-site Content Security Policy or maintaining separate
local and hosted renderers.

## Motivation

The renderer currently emits one HTML file with an inline quiz script and a
page-level policy that allows inline execution. Stat preserves that HTML but
adds its canonical generated-site response policy, `script-src 'self'`, so the
browser blocks the quiz runtime. The page remains readable and the
render-time quiz ordering remains deterministic, but answer selection produces
no feedback.

The browser console and deployed response establish that this is a content
packaging mismatch rather than a Stat upload, cache, or transformation failure.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Explanation bundle | One dedicated offline directory containing `index.html` and its renderer-owned `quiz.js`. |
| Local artifact | The bundle's `index.html` opened directly through a `file://` URL without a development server or network dependency. |
| Stat deployment | The unchanged explanation bundle published through Stat's existing static-folder path. |
| Quiz ordering | The deterministic render-time allocation and shuffling of answer positions; it does not depend on browser JavaScript. |
| Quiz runtime | The fixed browser script that applies selected-answer state and displays option-specific feedback. |

## Selected Approach

[confidence: 0.94 - certain | reason: the deployed header and intact inline script directly identify the incompatibility]

Change the renderer's canonical output from one standalone HTML file to one
offline bundle. Keep the generated content and CSS in `index.html`, move the
fixed quiz runtime to a sibling `quiz.js`, and load it through a relative
same-origin script reference.

Use one page-level CSP that permits the sibling script for direct local-file
use and is compatible with Stat's stricter response header. When hosted, both
policies remain enforced and Stat continues limiting scripts to same-origin
assets. Do not add hashes, nonces, inline-script exceptions, or upload-specific
branches.

The default render operation creates a dedicated dated directory under `/tmp`,
prints the absolute `index.html` path for immediate local opening, and leaves
the containing directory ready for `statctl publish`. A new `--output-dir`
option selects an explicit bundle directory. The legacy file-oriented
`--output` option fails with a migration message rather than silently treating
its path as a directory.

## Scope

### In Scope

- Update the bundled TypeScript renderer to emit `index.html` and `quiz.js` in
  one dedicated output directory.
- Replace the inline quiz script with a relative reference to the emitted
  renderer-owned runtime.
- Align the page-level CSP with direct `file://` loading and Stat's
  same-origin-script response policy.
- Preserve deterministic answer ordering, current selection behavior,
  option-specific feedback, accessible state, and mobile-first presentation.
- Update the skill workflow and output handoff so agents report the local page
  path and identify its containing folder as the Stat-publishable artifact.
- Replace the file-oriented output override with an explicit bundle-directory
  override and a clear failure for legacy invocations.
- Add focused regression coverage for bundle output, CSP compatibility, local
  interaction, and hosted-policy interaction.
- Run `writing-skills` against the changed shared-skill behavior before the
  implementation commit.

### Out Of Scope

- Changing Stat's generated-site CSP or deployment implementation.
- Allowing `'unsafe-inline'` in Stat response headers.
- Calculating per-deployment script hashes or nonces.
- Supporting arbitrary third-party scripts, remote assets, or network-backed
  explanation content.
- Replacing the JavaScript quiz with a CSS-only interaction model.
- Maintaining separate standalone and Stat-specific page implementations.
- Changing narrative structure, quiz authoring requirements, deterministic
  randomization, or passive-content validation.
- Publishing a bundle to Stat, merging the MR, or synchronizing the live AX
  runtime without the separately required authority for each action.

## Observable Behavior

- Running the renderer once yields one dedicated bundle with `index.html` and
  `quiz.js` and no inline executable script.
- Opening `index.html` directly from disk requires no server or network and
  provides the complete quiz interaction.
- Publishing the same directory to Stat preserves that interaction under
  Stat's existing `script-src 'self'` response policy.
- The renderer continues to reject active or external markup supplied through
  the content specification; only the fixed renderer-owned script is emitted.
- Re-rendering the same specification produces the same page content, quiz
  ordering, and quiz runtime bytes.
- The agent handoff distinguishes the local entrypoint from the publishable
  directory so neither a lone HTML file nor an overly broad parent directory is
  sent to Stat.

## Reuse And Deviation Contract

- Extend the canonical renderer at
  `skills/explain-diff-html/scripts/render-explanation.ts`; it remains the sole
  owner of layout, CSP, quiz ordering, browser behavior, and artifact writing.
- Extend the canonical skill workflow at `skills/explain-diff-html/SKILL.md`
  rather than adding publication logic to the renderer or copying the quiz
  runtime into generated content specifications.
- Reuse Stat's existing static-folder and same-origin-script contract without
  changing the `ai/stat` repository. Stat's generated-site security headers and
  `/__stat/sdk.js` demonstrate the established external same-origin asset
  boundary.
- Reuse the current passive-data validation unchanged: inspected diffs,
  comments, and repository text cannot control script source, CSP, or emitted
  runtime bytes.
- Deliberately deviate from the original single-file artifact contract because
  inline execution cannot satisfy Stat's intentional response policy. The new
  portable unit is one offline folder rather than one HTML file.
- Add no new runtime dependency or general bundling framework; the existing
  self-contained TypeScript helper and Node built-ins can own both files.

## Acceptance And Proof

[confidence: 0.90 - certain | reason: each proof exercises the exact artifact boundary that previously failed]

- Renderer tests prove the bundle contains exactly the expected page and quiz
  runtime, the page contains no inline executable script, and the relative
  script source and CSP remain compatible.
- Deterministic-ordering and passive-markup regression tests remain green.
- A browser interaction test opens the generated `index.html` through
  `file://`, selects correct and incorrect answers, and observes feedback
  directly below each selection at a narrow viewport.
- A browser interaction test serves the unchanged bundle with Stat's exact
  generated-site CSP header and observes the same selection and feedback
  behavior without an inline-script violation.
- Repository skill validation and `writing-skills` pressure coverage prove that
  agents return the local `index.html` path and the narrow publishable bundle
  directory.
- After separate deployment authority is granted, publishing that same folder
  to a disposable or user-selected Stat slug provides final hosted confirmation
  that the quiz remains interactive. Cloudflare's blocked external analytics
  beacon is unrelated and does not fail this acceptance check.

First real confirmation: render a representative specification through the
skill's actual TypeScript entrypoint, open the emitted `index.html` directly,
and then exercise that unchanged bundle behind Stat's exact CSP header; both
surfaces visibly display selected-answer feedback.

## Risks And Controls

| Risk | Control |
| --- | --- |
| Local browsers treat `file://` origins differently | Exercise the real local-file entrypoint in browser coverage and keep the page-level policy explicit for local sibling assets. |
| The HTML and quiz runtime drift | Generate both from the same renderer invocation and verify stable runtime bytes in focused tests. |
| Agents publish the HTML file instead of its folder | Make the skill handoff name both the local entrypoint and the exact publishable directory. |
| A CSP repair weakens hosted isolation | Leave Stat unchanged and prove the bundle under its current response header. |
| The output-contract change surprises an existing caller | Add the unambiguous `--output-dir` option, reject legacy `--output` with migration guidance, and document the new bundle contract in the skill. |
| Cloudflare analytics warnings obscure the real result | Treat only explanation-owned script failures as blocking; retain the existing policy that blocks the external beacon. |

## Delivery Shape And Rollback

Deliver the plan, renderer contract update, skill guidance, and focused tests as
one atomic change in one final draft MR targeting `main`. No OpenSpec, POC,
planning-only MR, Stat-repository change, or multi-MR sequence is required.

Rollback restores the single-file renderer and skill wording together. If the
change has already been merged and synchronized into managed runtimes, revert
the source change and rerun the normal post-merge AX synchronization from a
clean `main` worktree. Previously generated bundle directories remain static
and require no migration.
