---
name: plan-poc
description: Use when running an opt-in OpenSpec implementation rehearsal in one draft review artifact before revising the spec for final delivery.
---

# Plan POC

## Overview

Run a review-only OpenSpec implementation rehearsal. A POC is useful when Rene
wants reviewers to see the full implementation shape in one draft MR or PR
before the final spec is revised and delivered through the normal plan
orchestrator.

The POC artifact is not final delivery. It is draft-only, includes the
rehearsed OpenSpec files for reviewer comparison, and must not be merged or
reused as the source of final implementation commits.

## When To Use

Use when Rene explicitly asks for a POC, proof of concept, implementation
rehearsal, or `plan-poc` run for an existing OpenSpec change.

Do not use for normal implementation delivery, plan review, or plan-ready
scope shaping. Use the standard plan workflow when the goal is mergeable
implementation.

## Required Input

Start from one OpenSpec change reference. Before implementation work begins,
validate the referenced change and task shape through the repo's OpenSpec
workflow. If validation fails, report the blocker and do not start POC
implementation.

## Draft Artifact Contract

Every POC uses one hosted review artifact:

- mark the artifact as draft;
- start the title with `POC:`;
- state that the artifact is a review-only implementation rehearsal;
- state that the artifact is not intended to merge;
- include the rehearsed OpenSpec files;
- include the implementation diff;
- state that OpenSpec files are comparison context for the rehearsal;
- state that final delivery must come from a revised OpenSpec, not from POC
  commits.

The helper in `scripts/plan-poc.ts` renders and validates this initial artifact
state. It checks the OpenSpec reference shape, but it does not replace strict
OpenSpec validation or task-shape audit. Later workflow steps may attach
host-specific creation, feedback routing, closure, and learning-summary behavior
to the same contract.

## POC Implementation Loop

When a POC spans multiple OpenSpec units in the same draft artifact, track the
current POC unit explicitly. Task-state updates must mark only work items that
belong to the current unit; previously rehearsed or future units stay available
as context, but they are not marked as the current unit's task state. POC task
state is contextual and non-authoritative.

After every material POC push and every feedback-fix push, record the pushed
head and route reviewer feedback against that latest head before moving to the
next POC unit. Current and completed POC units must keep checkpoints tied to
each pushed head they reviewed; pending units stay contextual until they are
implemented.
