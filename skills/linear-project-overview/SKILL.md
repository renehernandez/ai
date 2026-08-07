---
name: linear-project-overview
description: Use when drafting, reviewing, or updating a Linear project's summary or description, especially when the overview is unstable, overloaded with delivery detail, duplicates milestones or updates, or needs approval-safe provider mutation.
allowed-tools: Read, Glob, Grep, AskUserQuestion, Bash(linearis:*), Bash(jq:*), mcp__linear__*, mcp__codex_apps__linear_*
---

# Linear Project Overview

## Authority

This bounded specialist drafts and reviews in Explore; Finish owns a later
explicitly approved update. It never creates a project. Use an available
authenticated Linear MCP or app integration first and fall back to `linearis`
only when it is unavailable, unauthenticated, or lacks the required operation.

## Field and Content Contract

Map workflow `summary` to Linearis `description`, and workflow Markdown
`description` to Linearis `content`. Preserve this mapping in previews, drift
checks, writes, and readback. The summary is one stable outcome statement within
255 characters. Load [content contract](references/content-contract.md) for the
overview structure and exclusion rules.

Use sources in this order: explicit current decisions; accepted Project Brief,
design, plan, or spec; verified behavior; unresolved team feedback; existing
Linear context. Do not infer purpose from text being corrected or from the
delivery inventory.

## Draft or Review

Resolve the exact project or mark it proposed. Read the project, documents,
milestones, issues, every discussion page, and every relevant reply thread.
Route unresolved purpose/scope before drafting.

Return an exact preview containing immutable project ID/link (or `proposed
project`), observed mapped fields, relevant feedback identity/state/body/update
time/anchor, proposed fields, and alignment, drift, feedback, and intentional
exclusion findings. Stop read-only.

## Apply an Approved Preview

A later instruction must approve the exact preview. Immediately re-read the
project and exhaust feedback pagination. Any mapped-field mismatch or new or
materially changed feedback blocks with a refreshed preview; minor wording
drift is reported.

Update only `description` and `content` through the preferred integration when
it supports the approved rich Markdown. If routing falls back to `linearis`,
apply its file-backed-input capability blocker and attempt no write. Require
exact readback through the adapter that performed the write. Never change team,
initiative, lead, members, status, dates, labels, priority, milestones, issues,
updates, comments, documents, or resources.

Route unresolved purpose/scope to `brainstorming`, intake to `start-project`,
milestones/issues to `linear-breakdown`, and progress/health to a project
update. A native project document owns design content; `doc-smith` assists when
engineering-document guidance is useful.
