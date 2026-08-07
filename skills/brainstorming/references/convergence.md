# Brainstorming Convergence

Load this reference only after the user invites convergence and needs scope,
implementation slices, objective proof, or artifact routing.

## Separate v1 from future shape

Future integrations, dedicated infrastructure, signing, evals, artifacts,
gates, generic platforms, adapter models, and robust architecture describe
possible future shape. They enter v1 only when a concrete first-outcome risk
requires them.

Default v1 is one real path on existing infrastructure with the minimum safety
and diagnostics needed to trust it. Prefer the approach that proves a real
outcome soonest unless migration, safety, compliance, or operational risk
requires groundwork.

When approaches materially improve the decision, compare two or three:

```markdown
**Approach: [Name]**
- First working outcome:
- Existing owner reused or extended:
- Material assumption:
- Main trade-off:
- Deferred scope:
```

## Shape implementation slices

Separate the objective, selected feature, already-shipped context, candidate
slices, recommended first slice, and deferred work. A slice should produce a
safe, reviewable outcome with local proof.

Prefer objective proof in slice 1 through the real entrypoint. One or two
groundwork slices may precede it when they independently simplify the current
system or establish a required boundary that a named successor directly uses.
Groundwork must stay useful and safe if the stack stops.

The first stack objective proof must appear by slice 3. Name it explicitly:

```markdown
Proof location: [real entrypoint] demonstrates [visible success or failure evidence].
```

Setup, config, registries, schemas, helpers, metadata, or readiness alone do not
count as objective proof. Return to Plan when proof comes after slice 3,
groundwork is speculative, or a roadmap objective is presented as a slice.

## Recommend capture

| Artifact | Use when |
|---|---|
| OpenSpec | Durable cross-component behavior, independently reviewable units, migration, or a required rehearsal |
| Atomic plan | One coherent implementation and final change request needs no durable specification or POC |
| ADR | A durable, surprising, hard-to-reverse decision records a real trade-off |
| Glossary or `CONTEXT.md` | Material domain terminology changed and the repository has that pattern |
| No artifact | The discussion is still exploratory or should remain in chat |

Brainstorming recommends the route but does not write the artifact. Plan owns
the selected planning artifact and its review.
