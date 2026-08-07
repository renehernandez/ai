---
name: linearis
description: Use when a connected Linear integration is unavailable, unauthenticated, or lacks a required operation and Linear work must fall back to the authenticated linearis CLI.
allowed-tools: Bash(linearis:*), Bash(jq:*)
---

# Linearis

## Authority

This is the fallback adapter for Linear CLI operations. It owns CLI discovery,
authentication, identifiers, JSON envelopes, pagination, and verified
operations; semantic specialists own what a project or issue should say.
Explore/Review are read-only. Only Finish may write after the semantic owner's
preview/approval contract. Human-readable comments, replies, and project
updates also require `rules/git-and-review.md#agent-authored-provider-messages`.

Do not require integration login when this authenticated fallback can safely
complete the operation. Missing CLI coverage is a capability blocker; never
retry an ambiguous integration mutation without first re-reading the target.

## Provider Mechanics

- Run `linearis usage` and domain `usage` before unfamiliar commands; live
  usage is authoritative.
- Every response is JSON. Preserve `nodes` and `pageInfo`; continue with
  `--after <endCursor>` until `hasNextPage` is false. Paginate root discussions
  and every relevant reply thread.
- For comment or reply retrieval, load
  [Discussion retrieval](references/discussion-retrieval.md).
- Resolve human keys/names to immutable UUIDs and retain those IDs in previews,
  drift checks, mutations, and evidence.
- Exit 42 with `AUTHENTICATION_REQUIRED` returns the CLI login instruction;
  credential entry is human. Do not install or update the CLI without
  authority.
- Resolve statuses through the target team; never assume a universal `Done`.

## Verified Scalar Mutations

Before an authorized write, re-read the immutable target and compare it with
the approved preview. Material drift blocks and returns a refreshed preview.
Apply only approved fields, read back once, and require exact equality for each
changed field. A mismatch is failed verification; do not write again.

## Rich Markdown Blocker

The CLI currently accepts project `content`, issue `description`, and
discussion `body` only as inline arguments. Never pass rich Markdown through
shell interpolation, command substitution, wrapper scripts, or handcrafted
escaping. Until file-backed input exists, return:

> Linearis has no file-backed input for the approved rich Markdown, and inline
> arguments are unsafe. No Linear write was attempted.

Only bounded scalar values such as resolved identifiers, enums, numbers,
dates, and booleans may proceed. Report the exact target, operation, provider
evidence, readback, drift, and capability gaps.
