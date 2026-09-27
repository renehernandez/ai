---
name: paseo-orchestration
description: Use when a managed Pi/Paseo planner carries accepted work through runner-dispatched implementer and reviewer workers, ticks, triage, and publication.
---

# Paseo Orchestration

The managed planner orchestrates accepted work through the workflow runner. It
owns the planning artifact, every worker dispatch, triage, gate decisions,
Finish provider actions, and the user conversation. It never edits
implementation files and never launches a worker outside the runner. When the
accepted-proposal contract selects Execute, the planner routes the work to a
fresh implementer through the runner `handoff`; the Pi policy denies planner
code edits and commits. Every new head then receives a fresh review round.

This skill is a bounded specialist inside the five modes, not another mode.
Plan, Execute, Review, and Finish keep their authority; the runner supplies the
dispatch, state, and gate machinery. It grants no merge, deployment, or cleanup
authority.

Follow [the Pi workflow contract](references/paseo-workflow.md). Pi launch
injects that contract into every managed role. Write every implementer brief,
repair brief, and reviewer packet with `worker-handoff`. A brief that started
this session is a `session-handoff`: it never becomes a standing order or a
delivery override.

Drive the runner only from the orchestrator session:

```bash
node <skill-dir>/scripts/paseo-workflow.ts STATE ACTION INPUT.json
```

The contract's runner interface lists every action and its input.
