# Self-contained Show Me skill

## Objective

Add an invocable `show-me` skill that explains the current topic with the
smallest useful visual, following HumanLayer's Show Me approach. It chooses
inline code sketches or creates a focused HTML explanation itself.

## Approach and ownership

Adapt HumanLayer's MIT-licensed skill with attribution and its license. Keep
format selection in the skill and concrete examples in one reference. Support
pseudocode, call trees, component trees, file trees, Mermaid, conceptual diffs,
and complete code shapes. HTML remains a self-contained skill capability with
no dependency on another visual skill or renderer.

The skill works within the current lifecycle authority. An explanation does
not authorize product edits or publication. When HTML output is authorized,
write it to a task-owned artifact location and open it with the available host
capability. Explicit read-only limits retain inline output.

## Reuse and deviation contract

- HumanLayer's upstream Show Me supplies the format-selection technique and
  examples. Adapt its shell-specific opening command to available host tools.
- `rules/communication.md` remains the owner of general explanation quality;
  Show Me adds an explicit visual explanation technique.
- `explain-diff-html` keeps verified, detailed change walkthroughs and quizzes.
  Show Me owns its focused HTML without delegating to that renderer.
- Existing local skills and `ax.config.json` supply packaging and installation
  for both profiles. No new runtime mechanism or dependency is needed.
- Visualize was separately uninstalled at the user's request. This change does
  not add a replacement plugin or alter plugin management.

## Acceptance and proof

- The managed profiles discover `show-me` with its examples and attribution.
- A small save-flow explanation stays inline, preserves behavior and ordering,
  and distinguishes a proposed sketch from verified implementation.
- A request for a focused HTML comparison produces a standalone responsive
  artifact without another skill, preserves real supplied labels, and opens
  through the available host capability. Browser inspection verifies desktop
  and mobile layout; missing browser access is reported as a verification gap.
- A read-only request does not create files, edit product code, or publish.
- Skill validation, managed-skill evaluation coverage, isolated AX installation,
  live application scenarios, and native hook verification pass.

## Delivery

One atomic plan and implementation in one draft GitLab MR targeting `main`.
No OpenSpec or POC is needed. Keep review and evaluation evidence task-local.
Merge and live runtime activation remain outside this delivery authority.
