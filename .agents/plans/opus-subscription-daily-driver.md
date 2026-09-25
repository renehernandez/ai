# Opus subscription daily driver and focused Sol reviews

## Objective

Make Claude Opus 5.5, authenticated through an eligible Claude subscription, the default Pi/Paseo planner and implementer. Use only Sol for automatic plan
and implementation reviews, in three parallel focus groups. Keep Astra as an
explicitly selectable alternative planner. Preserve the existing bounded
workflow, exact-workspace handoffs, tool restrictions, and publication policy.

## Accepted scope and defaults

- Use `pi-claude-bridge` as the candidate subscription provider, not Pi's direct Anthropic authentication or an API gateway. Pin a verified released version;
  do not float to latest at launch. Its upstream documentation currently
  identifies version 0.8.0 and requires Pi 0.86.1 or newer.
- Pin the actual Opus 5.5 model identifier after catalog and response-identity verification. Do not use the moving `opus` alias or silently substitute an
  older model when 5.5 is unavailable.
- Default Opus planning and implementation to medium effort, subject to proof
  of the provider's actual mapping. Keep Astra's existing low-effort planner
  route and Sol's existing configured model at medium effort; this change
  does not independently upgrade either OpenAI model.
- Both review phases use three fresh, read-only Sol sessions: correctness and risk; architecture and simplification; verification and contract alignment.
  GLM, DeepSeek, and Astra cease to be automatic reviewers. They are not
  replacement candidates when Sol fails.
- Review focus is a partition of the complete phase-specific lens catalog,
  not permission to omit required coverage. Conditional security, production,
  migration/data, and documentation lenses are assigned to a named group.
- Keep one local review round, one local repair batch, one hosted repair batch,
  Ready publication, and separately authorized merge/deployment/cleanup.
- No live model switch, authentication change, runtime sync, publication, or
  implementation is authorized merely by preparing this plan.

## Reuse and deviation contract

`ax.config.json` remains the desired-state owner of managed Pi/Paseo provider
profiles and defaults. Extend its exact-leaf configuration mechanism for bridge
settings and package availability; do not overwrite unrelated Pi packages,
credentials, or user configuration.

`hooks/pi/launch.ts`, `policy.ts`, and `enforcement.ts` remain the managed
launch and tool-policy boundary. Explicitly load the pinned bridge for Opus
routes despite `--no-extensions`, while retaining the mandatory MCP adapter,
fixed provider/model/effort verification, and startup handshake. Load no bridge
in Sol reviewer or Astra planner routes. Ordinary Pi startup must also resolve
its newly configured default provider.

The Handoff Brief finite runner remains the only managed workflow launcher and
write-ownership transfer owner. The Review skill remains the canonical lens
catalog. Extend these owners to snapshot each review group's assigned lenses,
identify sessions independently even though all use the same model, and
validate complete aggregate coverage. Do not introduce another orchestrator,
recursive delegation, or the bridge's optional AskClaude delegation tool.

The deliberate deviation is replacing repeated whole-artifact, different-model reviews with one parallel, focused Sol round. Each session may inspect the
whole artifact for context but is accountable for its assigned lenses. Preserve
an independently recorded `code-simplifier` outcome in the architecture group.

Update the canonical Pi/Paseo workflow prose and affected examples together
with executable routing. Replace model-specific owner wording with lifecycle
roles where behavior does not depend on the model. Do not duplicate the new
roster throughout general instructions or retire unrelated provider access.

## Subscription and enforcement boundary

Use existing first-party Claude subscription authentication through Claude Code/Agent SDK. Never copy credentials into tracked config, infer paid-plan
eligibility, enable paid credits, or silently fall back to direct API billing.
Before a real inference proof, verify subscription authentication and that paid
extra usage is disabled; require operator confirmation when that state cannot
be established safely. Account-side billing controls, not zero cost metadata,
are the authority for preventing additional charges.

Reject or isolate API-key, auth-token, gateway, and alternate-cloud environment
settings that could redirect the bridge away from the subscription route. Keep AskClaude disabled and enforce the managed tool allowlist regardless of local
bridge overrides. Do not permit project settings to enable native tool execution,
extra paid context, automatic delegation, or a different backend.

Start conservatively at 200K context for Opus 5.5. Expanding context is deferred until the exact subscription tier and SDK behavior are verified. Quota exhaustion,
missing subscription auth, unsupported model/effort, and bridge startup failure
must surface as errors without another provider or paid fallback.

The bridge projects Pi's system prompt onto Claude Code's preset and disables
native tools in its provider path. Prove that the complete managed workflow,
repository instructions, fixed role, and tool denial behavior remain effective
through this projection and on subsequent turns. Never remove safety instructions
or disguise the harness to obtain subscription eligibility. If stock bridge
behavior cannot preserve these contracts, stop and return the incompatibility to
Plan; a fork, alternate bridge, or weakened policy requires a new decision.

## Focused review contract

For planning, assign implementation readiness and edge cases/risk to correctness; code simplification and refactoring to architecture; delivery shape and acceptance coverage to contract alignment. For implementation, assign diff correctness and
adversarial scrutiny to correctness; quality, simplification, and deslop to
architecture; verification evidence and requirements/docs alignment to contract
alignment. Define new lens entries only where the current catalog cannot express
the accepted evidence requirement.

Bind each group's assignment and report to the same immutable artifact and,
for implementation, exact source/base. Launch the three groups concurrently once.
Reject missing groups, incomplete reports, missing assigned lenses, unassigned
required lenses, duplicate or drifted assignments, and stale artifact identities.
Deduplicate findings only after preserving each independent report.

A timeout, unavailable model, or malformed report remains degraded evidence. The owning planner or implementer performs the full missing assigned-lens
assessment inline, records its findings, and resolves them before advancing.
Do not spawn replacements or rerun reviewers after the repair batch. A true
launch-identity or orchestration failure remains a hard stop.

## State compatibility and rollout

New workflows snapshot the new routes, review groups, and lens assignments. Existing workflow states must not be reinterpreted as Sol-reviewed or silently launch the replacement roster. Preserve old reports, snapshots, and identities.
Support read-only inspection of legacy state; an incompatible continuation must
stop with an explicit explanation instead of mutating its evidence. No automatic
migration, session recreation, or live in-flight model switch is in scope.

Use only isolated HOME and runtime roots for feature-branch configuration and
bridge verification. The bridge and Claude Code can write their own session state;
keep that isolated too. Authentication that needs a new login remains user-owned.
Do not copy production credential files into disposable test fixtures.

Activate only from the verified clean merged default-branch worktree through AX
sync and validation after separate merge authority. Activation configures new
sessions; it does not repurpose this planning session or existing workers. If
activation fails, report the blocker and preserve the prior usable route; do not
fall back silently. Rollback restores the prior reviewed configuration through
normal Git/AX delivery without rewriting workflow evidence.

## Delivery shape

The first implementation milestone is isolated bridge compatibility proof through
the existing managed launcher: subscription-only authentication, exact Opus 5.5
response identity, preserved instructions, and policy-controlled tool execution.
Do not proceed to changing workflow defaults or review dispatch until that proof
succeeds. A blocked bridge milestone returns to Plan without substituting another
provider or relaxing controls; do not spend the rest of the change budget on an
unusable default.

One atomic plan plus one coherent implementation PR; no planning-only PR and no OpenSpec or disposable POC. The change connects provider availability, enforced
launch, focused dispatch, evidence validation, and their shared instructions.
Shipping only the defaults would select an unavailable or unenforced provider;
shipping only the new roster would leave evidence validation inconsistent.

Target at most 15 changed files and 1,000 changed lines, with a preferred budget
of 10 files and 500 lines. The likely overage over the preferred budget is the
necessary synchronized configuration, policy, runner, catalog, documentation, and
behavior-test fallout. If the concrete implementation exceeds the larger budget
or needs a new bridge-maintenance mechanism, return to Plan before broadening.

This transition is developed with the currently installed managed workflow;
prospective Sol-only routing is not implemented by hand-editing live config or
bypassing the current runner. Planning-review and implementation-launch limitations
must remain explicit rather than be reported as proof of the proposed workflow.

## Acceptance and named verification layers

1. **Isolated AX configuration integration:** applying the selected profile twice
   converges Pi and Paseo defaults, Opus planner/implementer availability, optional
   Astra planning, and three Sol review groups. Unowned settings and credentials
   remain unchanged; retired automatic review routes are no longer selectable as
   active managed review profiles. Other provider access remains untouched.
2. **Managed-launch and policy unit tests:** fixed identity and effort, explicit
   pinned extension loading, mandatory handshake, role-specific tool sets,
   subscription-route environment protection, and denial of override/delegation
   paths are exercised through their real owners.
3. **Runner integration tests:** one exact-workspace launch per group, immutable
   per-group lens snapshots, complete aggregate coverage, distinct simplifier
   result, degraded fallback, no duplicate rounds, source/base mismatch rejection,
   and incompatible legacy-state refusal are behaviorally proven.
4. **Isolated bridge RPC integration:** start a real Opus 5.5 session through the
   managed launcher, verify actual served model and subscription auth, complete
   multiple turns with a permitted read and scratch edit, and prove a prohibited
   tool request cannot execute. Exercise abort/resume and compaction without
   losing policy or handing off to a different billing route. Retain evidence
   privately; mocks alone do not establish subscription billing or model access.
5. **End-to-end workflow proof:** in an isolated scratch workspace, select the
   default Opus planner, transfer one accepted task to an independently verified
   Opus implementer, collect three simultaneous Sol focused reports, resolve the
   combined batch once, and separately demonstrate selectable Astra planning.
   This focused integration proof is not a disposable implementation POC.
6. **Agent-behavior validation:** writing-skills RED/GREEN pressure scenarios and
   charter validation cover changed instructions, role ownership, review coverage,
   subscription-only failure behavior, and explicit degraded evidence.
7. **Project-native verification:** unit and integration suites, skill validation,
   charter validation, and staged lint/format run through native hooks before an
   implementation commit. Required hosted gates follow resolved provider policy.

No completion claim is allowed if real model identity, subscription billing
conditions, or enforcement compatibility remains unverified. Report credential-
or service-blocked proof separately from code failures. Implementation acceptance is a later checkpoint; this artifact does not itself authorize handoff or merge.
