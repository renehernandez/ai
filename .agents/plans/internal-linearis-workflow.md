# Internal Linearis Workflow

## Goal

Make the repository-owned `linearis` skill the provider adapter for Linear
work. Linear semantic skills must use the `linearis` CLI for supported reads
and mutations instead of Linear MCP, app, or plugin tools.

The first delivery keeps rich Markdown mutations unavailable until the CLI
accepts file-backed bodies. It must not fall back to inline shell interpolation
or a Linear plugin.

## Selected Approach

Create one repository-native `skills/linearis` skill from this repository's
lifecycle authority, provider safety, skill metadata, validation contracts,
and the installed CLI's live usage output.

Keep semantic ownership unchanged:

| Concern | Canonical owner |
| --- | --- |
| Linear CLI discovery, authentication failures, identifiers, JSON, and pagination | `linearis` |
| Stable project summary and Markdown overview | `linear-project-overview` |
| Outcome-centered milestones and issues | `linear-breakdown` |
| Planning-time Linear policy | `plan` |
| Linear provider mutation authority | `Finish`, after the owning semantic workflow's preview and approval contract is satisfied |

The `linearis` skill supplies provider mechanics. It does not grant mutation
authority or replace a semantic workflow owner.

## Domain Terms

| Term | Meaning |
| --- | --- |
| Internal skill | A repository-owned skill under `skills/linearis`; AX installs it from this repository. |
| Provider adapter | The skill that selects and operates `linearis` commands without deciding project purpose, issue breakdown, or lifecycle authority. |
| Rich Markdown mutation | A write that sends a project `content`, issue `description`, or discussion `body` value that requires safe file-backed transport. |
| Scalar mutation | An approved write whose value can be represented as a resolved identifier, enum, number, date, or similarly bounded non-Markdown value. |
| Workflow summary | The short Linear project summary represented by the Linearis `description` field. |
| Workflow description | The long Linear project Markdown body represented by the Linearis `content` field. |

## Scope

### In Scope

- Add `skills/linearis/SKILL.md` and Codex skill metadata.
- Add the internal skill to the repository-owned AX profile selection.
- Teach reactive installation and authentication failure handling, current
  `usage` discovery, canonical `linearis` invocation, JSON envelopes,
  identifiers, cursor-complete pagination, and exact readback.
- Make CLI usage subordinate to lifecycle and semantic mutation authority.
- Update `linear-project-overview` and `linear-breakdown` to use `linearis`
  instead of generic provider tools.
- Record the project-field mapping from workflow terms to Linearis
  `description` and `content` fields.
- Permit supported read workflows and explicitly approved scalar mutations.
- Block rich Markdown mutations when the CLI lacks file-backed input. Return a
  concrete capability blocker without falling back to MCP, apps, plugins,
  inline shell interpolation, temporary wrapper scripts, or command
  substitution.
- Update shared instructions and command policy so `linearis` is the preferred
  authenticated Linear CLI.
- Add focused contract tests for routing, authority, pagination, field mapping,
  mutation blocking, and internal AX selection.

### Out of Scope

- Installing the upstream Linearis skill or tracking its repository as an AX
  source.
- Removing machine-local Linear MCP servers, apps, or plugins.
- Managing the Linearis binary or API token through AX.
- Adding file-backed body flags to the Linearis CLI.
- Enabling inline shell transport for rich Markdown.
- Changing project purpose, issue slicing, or Linear policy semantics.
- Creating or updating Linear records for this delivery.
- Merging the final MR.

## Reuse and Deviation Contract

- Reuse this repository's `ax-cli` and host CLI skill pattern for a bounded
  provider adapter installed from the `personal-skills` block.
- Extend `linear-project-overview` and `linear-breakdown`; do not move their
  semantic contracts into `linearis`.
- Reuse the existing Plan policy of `required` or `disabled`, including exact
  preview and explicit approval before Linear writes.
- Use only the canonical `linearis` command and make pagination and exact
  readback mandatory.
- Add no general-purpose provider abstraction. The internal skill is specific
  to the installed Linearis CLI.

## Required Behavior

### Discovery and Reads

1. Use `linearis usage` and the relevant `linearis <domain> usage` output as the
   current command reference.
2. Treat command-not-found and the structured authentication-required response
   as blockers that need user action. Do not install or authenticate silently.
3. Use `linearis auth login` when authentication setup is required.
4. Traverse every `pageInfo.hasNextPage` cursor required by the semantic
   workflow. Preserve `nodes` and `pageInfo` when filtering paginated output.
5. Resolve ambiguous names before mutation and retain immutable IDs in previews
   and readback evidence.

### Mutations

1. The active semantic skill determines the approved mutation contract, and
   only Finish performs the provider write.
2. Re-read the exact target immediately before an approved write.
3. Apply only the approved fields.
4. Read the target again and require exact equality for every changed field.
5. Resolve team-specific statuses instead of assuming one universal completed
   state.
6. Permit an approved scalar mutation only when its command arguments do not
   require rich-text shell transport.
7. Block project `content`, issue `description`, and discussion `body` writes
   until Linearis exposes file-backed input for the relevant field.

### Semantic Workflow Integration

- `linear-project-overview` uses Linearis reads for the project, documents,
  milestones, issues, project discussions, and replies. Its Apply path reports
  the file-backed-input blocker while project `content` remains part of the
  approved update.
- `linear-breakdown` uses Linearis for read-only discovery and deduplication.
  Creation or update remains approval-gated. A required rich issue description
  blocks the write until safe file-backed input exists.
- Neither semantic skill uses a Linear MCP, app, or plugin fallback.

## Delivery Shape

Deliver the plan and implementation as one atomic final GitLab MR targeting
`main`. The change has one ownership boundary: repository-owned agent workflow
guidance and its AX selection. It requires no OpenSpec or POC.

Linear policy is `disabled`. This delivery creates or updates no Linear state.

## Proof Location

The first real confirmation is an isolated AX skill sync from this branch that
installs the repository-owned `linearis` skill, followed by focused contract
tests proving that an agent routes Linear reads through `linearis`, exhausts
pagination, preserves semantic ownership, and blocks a rich Markdown mutation
without calling a plugin.

## Acceptance Criteria

- The internal `linearis` skill is selected by both installed AX profiles from
  this repository.
- No AX source points to the upstream Linearis skill repository.
- The skill follows this repository's supported frontmatter and Codex metadata
  contracts.
- Shared instructions prefer `linearis` for Linear provider work.
- `linear-project-overview` maps workflow summary to `description` and workflow
  description to `content`.
- `linear-project-overview` and `linear-breakdown` require cursor-complete
  reads, immutable target identity, approved writes, and exact readback.
- Both semantic workflows reject Linear MCP, app, and plugin fallback.
- Rich Markdown mutations fail with a concrete file-backed-input capability
  blocker.
- Approved scalar mutations remain available when the semantic workflow allows
  them.
- Focused skill tests, repository skill validation, the full repository test
  suite, and isolated AX sync and validation pass.
- `writing-skills` pressure testing covers authority, plugin fallback pressure,
  incomplete pagination, project-field confusion, and unsafe rich-text write
  pressure.

## Risks and Controls

| Risk | Control |
| --- | --- |
| The internal copy drifts from Linearis commands | Require live `usage` discovery and keep durable guidance at the protocol level. |
| The CLI adapter performs an unauthorized write | State that semantic owner and lifecycle authority are prerequisites; cover pressure scenarios. |
| Project summary overwrites the Markdown body | Make the `description` and `content` mapping explicit and test it. |
| Field filtering removes pagination evidence | Require `nodes` and `pageInfo` preservation or raw JSON for paginated commands. |
| Rich Markdown executes shell syntax or changes content | Block the mutation until the CLI accepts file-backed input. |
| Agents silently fall back to installed Linear plugins | Forbid fallback in instructions, semantic skills, and tests. |

## Verification Contract

Implementation must run these verification layers:

- `writing-skills` RED and GREEN pressure scenarios for the changed behavior.
- Focused unit tests for `linearis`, `linear-project-overview`,
  `linear-breakdown`, instructions, and AX selection.
- Repository-wide shared-skill validation.
- Full repository unit and integration test suite through its package scripts.
- Isolated AX skills sync, status, and validation for both configured profiles.
- Git diff inspection confirming no dependency, lockfile, OpenSpec, runtime
  plugin, MCP, app, or live user-runtime mutation entered the change.

Finish publishes one draft GitLab MR, follows its full CI graph, requests Nitro
according to repository policy, and resolves actionable automated feedback.
Technical readiness leaves the MR draft. Merge requires separate authority.
