---
name: linearis
description: Use when a connected Linear integration is unavailable, unauthenticated, or lacks a required operation and Linear data must be read or mutated through the authenticated linearis CLI.
allowed-tools: Bash(linearis:*), Bash(jq:*)
---

# Linearis

## Boundary

Use `linearis` as the fallback adapter for Linear when the connected Linear
integration is unavailable, unauthenticated, or lacks the required operation.
It owns CLI discovery, authentication failures, identifiers, JSON envelopes,
pagination, and verified fallback operations. It does not grant Linear
mutation authority or replace `linear-project-overview`, `linear-breakdown`, or
another semantic owner.

Explore and Review stay read-only. Only Finish performs a Linear provider write
after the owning semantic workflow's preview and approval contract is
satisfied.

Before submitting a human-readable Linear comment, discussion reply, or
project update through the user's identity, Finish MUST also apply
`rules/git-and-review.md#agent-authored-provider-messages`. Semantic workflow
approval or general write authority does not replace that message-specific
checkpoint.

## Discover the Current CLI

1. Run `linearis usage` when the available domain is unknown.
2. Run `linearis <domain> usage` before using an unfamiliar domain or command.
3. Treat live usage output as authoritative. Do not invent flags or subcommands.
4. Use the canonical `linearis` command. Do not use the `linear` alias.

Every command emits JSON. Use `--fields` only when the selected paths preserve
the evidence needed by the workflow. For paginated output, retain both `nodes`
and `pageInfo`, or inspect the raw JSON. Use `jq` only for reshaping that the
CLI cannot express.

## Installation and Authentication

- If `linearis` is missing, report the blocker and the documented installation
  command. Do not install it, use `npx`, or change dependencies silently.
- If a command returns exit code 42 with
  `AUTHENTICATION_REQUIRED`, return the CLI's instruction and ask the user to
  run `linearis auth login`. Credential entry is a human action.
- Version checks are advisory. Never update the CLI without explicit authority.

## Reads

- Prefer immutable UUIDs after resolving a human-readable issue key, team key,
  or exact name. Preserve the immutable target ID in previews and evidence.
- For every paginated command, continue with `--after <endCursor>` while
  `pageInfo.hasNextPage` is true. Do not claim complete discovery from the first
  page.
- For threaded feedback, paginate root discussions and the replies for every
  relevant root thread. Use domain-owned discussion commands; the top-level
  `comments` facade is deprecated.
- Treat unsupported CLI coverage as a capability blocker after the preferred
  Linear integration is unavailable or cannot perform the operation.

## Mutations

Before an authorized scalar mutation:

1. Resolve and re-read the immutable target immediately before the write.
2. Compare it with the approved preview and stop on material drift.
3. Apply only the approved fields.
4. Read the target again and require exact equality for every changed field.
5. Report a mismatch as failed verification without another provider write.

Resolve team-specific statuses through the target team. Never assume one
universal completed status.

### Rich Markdown Blocker

The current CLI accepts project `content`, issue `description`, and discussion
`body` only as inline command arguments. Do not send these values through shell
interpolation, command substitution, temporary wrapper scripts, or handcrafted
escaping.

When the preferred Linear integration is unavailable or cannot perform the
approved rich Markdown mutation, and the CLI fallback lacks file-backed input,
return this capability blocker:

> Linearis has no file-backed input for the approved rich Markdown, and inline
> arguments are unsafe. No Linear write was attempted.

An approved CLI fallback mutation may continue only when every changed value is
a resolved identifier, enum, number, date, boolean, or similarly bounded
non-Markdown scalar. Use the preferred integration instead when it is available
and supports the approved rich Markdown mutation.

## Common Mistakes

| Mistake | Correction |
| --- | --- |
| Treating the CLI skill as write approval | Return to the owning semantic workflow and lifecycle mode. |
| Treating semantic approval as approval for unseen provider prose | Route the exact destination and rendered draft through the canonical agent-authored provider-message checkpoint. |
| Reading only the first page | Follow `pageInfo.endCursor` until `hasNextPage` is false. |
| Filtering away pagination evidence | Preserve `nodes` and `pageInfo`, or use raw JSON. |
| Assuming `Done` is universal | Resolve the target team's completed status. |
| Passing Markdown inline because quoting looks safe | Return the file-backed-input capability blocker. |
| Prompting for integration login when the CLI can complete the operation | Continue through the authenticated CLI fallback. |
| Treating an ambiguous integration mutation failure as proof that no write occurred | Re-read the target before selecting the CLI fallback. |

## Test Evidence

- RED: the repository had no internal CLI adapter, semantic skills named no
  `linearis` route, pagination evidence could be incomplete, and rich Markdown
  writes had no safe capability blocker.
- RED fallback: the CLI-only policy blocked an approved rich Markdown write
  despite an authenticated integration and did not model integration
  authentication or capability failures as fallback conditions.
- GREEN: focused executable scenarios require integration-first routing with a
  Linearis fallback while preserving lifecycle authority, cursor exhaustion,
  immutable identity, exact readback, project field mapping, and refusal of
  unsafe CLI Markdown.
- REFACTOR: Linearis remains a provider-specific fallback and leaves project
  overview and issue-breakdown semantics with their existing owners.
