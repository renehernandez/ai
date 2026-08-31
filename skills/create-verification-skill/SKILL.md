---
name: create-verification-skill
description: Use when a repository needs a project-local skill that can drive and prove its real user-facing application behavior.
allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion
---

# Create Verification Skill

Create one project-local `verify-<app>` skill for the repository's primary
user-facing surface. Repository interviewing and baseline diagnosis remain
read-only; write only inside an authorized Execute lane.

## Interview And Baseline

Inspect repository instructions, documented run commands, entrypoints, routes,
commands, menus, auth, seed data, isolation controls, and evidence locations.
Reuse the repository's Playwright, browser, CLI, PTY, HTTP, desktop, mobile, or
application harness before designing another driver.

Prove the documented checkout can build or start and that the selected harness
can reach it. A broken or unverified baseline is `blocked`: report the failing
command and evidence without generating speculative instructions or repairing
product code.

Read [project-layout.md](references/project-layout.md) before selecting the
destination or feature-map shape. Read
[driving-mechanics.md](references/driving-mechanics.md) only for the detected
surface and harness.

## Generate And Prove

Write concrete, repository-backed instructions with **Launch, Doctor, Drive,
Evidence, and Cleanup**. Document every executable helper invocation. Cleanup
owns only processes and scratch state the verification run started and never
removes retained evidence.

Seed a user-facing feature map from real routes, commands, menus, or docs. Map
the important observable features rather than internal modules or an exhaustive
inventory.

Run the generated skill end to end: launch, doctor, drive and prove one mapped
feature, clean up, then confirm the named evidence still exists. Run cleanup
after failed attempts too. A skill that cannot prove one mapped feature is
`blocked`, not complete.

## Boundaries

The generated skill owns application-driving mechanics only. Do not add a
generic verification framework, global feature registry, scheduler, dependency
change, product fix, discovery link, branch, or provider artifact unless the
active lifecycle owner separately authorizes it.

Return the selected surface and location, reused harness, baseline evidence,
mapped features, proved feature, retained evidence, cleanup result, and any
blocker.
