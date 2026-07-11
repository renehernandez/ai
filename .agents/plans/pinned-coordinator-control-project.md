# Pinned coordinator control projects

## Context

The merged Agent Workspace runtime correctly defines durable Linear records,
role charters, model routes, dynamic-context validation, and Codex custom-agent
outputs. Activation exposed one incorrect platform assumption: Codex custom
agent TOML files configure spawned subagents, while the desktop task-creation
surface creates root tasks without selecting a custom-agent descriptor.

Pinned organizational agents still need durable Codex tasks, but their security
boundary cannot be prompt text. They need a task environment that applies a
restricted permission profile, loads the shared coordinator contract, and
constrains connector and task-control tools independently of the selected role
prompt. Linear and Git remain canonical state; no orchestration database is
introduced.

This is one coherent AI-repo runtime change delivered with its implementation
in one final draft MR. It uses no OpenSpec or disposable POC phase.

## First real confirmation

After the change is merged and synchronized, activation is confirmed by the
real Delivery Executive Assistant activation:

1. Rene registers the generated Delivery Coordination and Executive Operations
   directories as two saved local Codex projects.
2. The bootstrap task resolves both project IDs through the desktop
   `list_projects` surface and verifies that `create_thread` accepts each ID as
   a local saved-project destination.
3. The bootstrap task activates the Delivery Executive Assistant in the
   Delivery Coordination project using the existing two-phase Linear and task
   contract.
4. The task starts with the enforced coordinator permission profile, replies
   `PENDING_CONTEXT`, is pinned, receives validated post-create context, and
   persists its attestation before the Root becomes `active`.
5. The Delivery Executive Assistant then becomes the activation writer and
   activates the Executive Operations Assistant in the Executive Operations
   project.

No Root, Memory, Workstream, or task is created before both generated projects,
their policy fingerprints, and their saved Codex project IDs pass preflight.

## Decisions

### Two generated control projects

Generate two non-Git runtime projects from tracked sources at these exact saved
Codex project roots:

- `/Users/rene.hernandez/work/projects/rene.hernandez/agent-control/delivery`
  hosts **Delivery Coordination**: the Delivery Executive Assistant, Linear
  Project Managers, GitLab Project Managers, and Squad Leads.
- `/Users/rene.hernandez/work/projects/rene.hernandez/agent-control/operations`
  hosts **Executive Operations**: only the Executive Operations Assistant.

Two projects keep private operations connectors out of delivery tasks without
creating one saved project per role. All delivery coordinators share the same
mechanical authority boundary; role-specific responsibility remains in the
validated activation prompt and static role hash.

Tracked source lives under `coordinator-projects/` in the AI repository. AX
synchronizes the two exact child targets under
`/Users/rene.hernandez/work/projects/rene.hernandez/agent-control/` and refuses
unmanaged files, directories, or incorrect links inside either target before
replacement. AX does not own or remove unrelated sibling paths under the
`agent-control` parent. The two child targets are generated products rather
than independent source repositories; the AI repository remains their Git
source of truth.

### Root tasks use project policy, not custom-agent selection

Pinned root tasks are ordinary persistent Codex tasks created in one of the two
saved control projects. Their model and reasoning route are supplied explicitly
by activation. Their security policy comes from the active project config and
hook fingerprint, not from a custom-agent TOML.

The agent manifest therefore gives every output an explicit `kind` rather than
inferring its destination from role lifecycle. The renderer separates:

- `pinned_prompt_bundle` outputs, which produce versioned static prompt bundles
  and role-policy projections for the control projects; and
- `codex_custom_agent` outputs for ephemeral implementer, reviewer, researcher,
  and operations-specialist roles, which remain TOML files for spawned
  sessions.

Validation rejects lifecycle/output-kind mismatches, a pinned role emitted as a
spawnable Codex custom agent, and an ephemeral role missing its required
custom-agent output.

### Enforced local boundary

Each control project contains a trusted `.codex/config.toml` with a named
permission profile that provides:

- read-only filesystem access to the generated project and the minimum runtime
  paths required by Codex;
- no general workspace write roots;
- no unrestricted shell or local process authority;
- no automatic escalation to broader permission profiles;
- the expected model-family ceiling remains in the activation contract rather
  than the project default.

Project configuration disables generic destructive and open-world app behavior
by default. Explicit tool settings expose only the connectors needed by that
project. Connector and Codex task-control mutations are independently filtered
by the project hook because local filesystem permission profiles do not govern
MCP or app calls.

### TypeScript policy source with standalone runtime output

Add one tracked TypeScript policy implementation for pinned coordinators. AX
transpiles it with the repository's TypeScript dependency while building the
candidate and installs a dependency-free `.mjs` hook into each generated
project. Hook registration executes the rendered module with the resolved Node
runtime, so it does not depend on `tsx`, `pnpm`, the AI checkout, or
project-local `node_modules` at task runtime.

The hook fails closed for malformed payloads, unknown task-control mutations,
unsupported role-policy versions, and write-capable tools outside the explicit
allowlist. It emits a deterministic discovery document and policy hash for AX
validation and task attestation.

Hooks are defense in depth for MCP and recognized tool calls. They do not claim
to intercept every Codex tool path. The permission profile remains the
filesystem and shell boundary, raw provider-write tools are absent or disabled,
and unsupported enforcement surfaces block activation.

### Project-specific capabilities

Delivery Coordination allows:

- Linear reads across connected teams and projects;
- schema-conformant coordination-record creation and updates only on the
  personal `Rene` team and `Rene — Work Portfolio` project;
- Codex task list, read, create, pin, navigate, and message operations needed
  by the recorded activation writer;
- repository-scoped read-only Agent Runs for GitLab and source context, created
  in the applicable saved repository project; the control project itself gets
  no general shell-network path or direct `glab` surface;
- spawning the existing ephemeral custom agents;
- delegating provider publication to a bounded repository task or Run that
  follows the target repository's Finish policy.

It denies direct merge, deployment, cleanup, ready-state transition, provider
mutation, arbitrary Linear-project mutation, and external operations actions.

Executive Operations allows:

- read-only Gmail, Slack, Calendar, and permitted follow-up source access;
- schema-conformant coordination-record creation and updates only on the
  personal control project;
- creation of inert draft and Decision records;
- bounded operations-specialist delegation.

It denies email or Slack send, calendar mutation, invitation response,
external-provider mutation, delivery publication, and task activation. Rene
continues to execute final operations actions unless a separate narrow executor
is later accepted.

### Linear mutation validation

The policy hook validates every permitted Linear mutation before the connector
call. Creation must name the exact personal team and control project and must
use a tracked typed-record template. Updates and comments must target a `RENE-`
record and preserve its required record identity. The hook validates the
normalized record body against the generated workspace schema where the tool
input carries a body.

The task contract still requires a fresh read of workspace generation, owner,
and authority immediately before mutation. Linear text cannot grant authority.
The hook enforces destination and shape; the Agent Workspace serializer and
role contract enforce generation and invocation coherence.

### Activation and attestation changes

Activation preflight resolves the expected saved control-project ID from the
AX-managed machine-local identity document. It verifies:

- the task destination is the correct generated control-project path;
- the generated project fingerprint matches the merged source;
- the task model and reasoning route match the manifest profile;
- the active permission mode is the required coordinator profile;
- the loaded instruction sources include the generated coordinator contract;
- the policy discovery hash matches `tool_policy_attestation`;
- required app and MCP tool names are present and prohibited mutation tools are
  not usable through the active policy.

The immutable creation tuple adds `control_project_kind`,
`control_project_id`, `control_policy_sha256`, `control_source_sha256`, and
`control_permission_profile`, plus the exact `control_project_path`. Existing workspace records gain the corresponding
optional fields with a migration rule: inactive or pre-activation records may
omit them, while `task_pending` and later states require them. Workspace
generation increments when an existing pinned task is migrated to a control
project or its policy, source fingerprint, or permission profile changes.

Task creation remains two phase. A pre-create task may only return
`PENDING_CONTEXT`; post-create context is serialized by the existing helper.
Activation remains idempotent and never creates a replacement task to hide a
partial transition.

### Manual saved-project registration

AX can generate and validate the two directories but the available desktop API
cannot register a new saved project. After live post-merge sync, Rene performs
one explicit UI action for each exact child root—`agent-control/delivery` and
`agent-control/operations`—to add/open it as a saved Codex project. The
bootstrap task then discovers and records the returned project IDs in an
AX-managed machine-local identity file at
`<effective AX runtime root>/control-projects.json`, not in Git, Linear, or a
private orchestration database. Tests override the runtime root; live sync uses
the same effective runtime-root resolution as other AX state.

The identity file stores only project kind, canonical path, desktop project ID,
source fingerprint, policy hash, and registration time. It grants no authority.
The bootstrap task first proves a unique project-ID-to-path association with
Codex `list_projects`; `ax coordinators register` records it locally. A path,
project ID, fingerprint, permission-profile, trust, or policy mismatch blocks
activation and requires explicit re-registration; activation never guesses
another saved project.

## Scope

### Repository changes

- Add canonical Delivery Coordination and Executive Operations project sources.
- Add generation of pinned prompt bundles and stop rendering pinned roles as
  spawnable custom agents.
- Add TypeScript control-policy source, standalone hook rendering,
  repository-run routing, and deterministic policy discovery/hash generation.
- Extend AX config, sync, status, and validate for exact coordinator-project
  targets and local registration identity validation.
- Extend activation, workspace, and invocation schemas for control-project
  identity and policy attestation.
- Update `agent-workspace` activation/resume/open behavior and failure codes.
- Update docs, instructions, templates, and tests to describe root tasks versus
  spawned custom agents accurately.
- Map the implementation to existing control issue `RENE-1`; create no new
  Linear project or implementation issue.

### Explicitly out of scope

- A new orchestration database or service.
- Automatic Codex saved-project registration through undocumented files or UI
  automation.
- A general Linear proxy or separately stored Linear credential.
- Autonomous merge, deployment, cleanup, email send, Slack send, or calendar
  mutation.
- Replacing Codex Desktop with the Agents SDK, Workspace Agents, or a custom UI.
- Automatically migrating or deactivating any existing pinned task.
- Activating pinned tasks from the feature branch.

## Implementation sequence

1. Add failing contract tests for pinned-output separation, both generated
   projects, schema migration, tool-policy decisions, unmanaged-target
   protection, and activation destination checks.
2. Add coordinator-project source contracts and extend the manifest projection
   for control-project assignment and policy capabilities.
3. Implement TypeScript policy evaluation and standalone hook rendering with
   exhaustive allow/deny fixtures for Linear, Codex task control,
   repository-run routing, Gmail, Slack, Calendar, shell, file-edit, and
   unknown tools.
4. Implement exact AX candidate generation, synchronization, status, validate,
   registration identity, rollback, and interrupted-sync recovery for both
   runtime projects.
5. Split pinned prompt bundles from ephemeral custom-agent TOML outputs and
   regenerate role/tool attestations.
6. Extend schemas, templates, serializer, CLI, and activation skill for control
   project and policy identity.
7. Update documentation and repository instructions, then run writing-skills,
   docs-alignment, AI-readiness, and diff review.
8. Prove both project candidates in isolated HOME/runtime roots. Do not touch
   the live runtime until the final MR merges.
9. Finish through one draft GitLab MR, current native verification, Nitro, and
   explicit Rene merge authority.
10. After merge, fast-forward clean `main`, run live `ax sync`, obtain Rene's
    two manual saved-project registrations, validate their IDs, then activate
    the two executive assistants in order.

## Acceptance criteria

- Pinned roles are no longer advertised as spawnable custom-agent TOML files.
- Ephemeral agent outputs retain their model, reasoning, sandbox, and reviewer
  overlay behavior.
- AX deterministically renders and synchronizes both coordinator projects and
  refuses unmanaged content inside either exact child target before mutation
  while preserving unrelated siblings under `agent-control`.
- Both generated projects operate with read-only local permission profiles and
  dependency-free policy hooks.
- Delivery and operations policies allow their declared read and coordination
  paths and deny every tested external/provider mutation path.
- Linear mutations outside the `Rene` control plane or outside typed record
  shapes are denied before connector execution.
- Activation blocks on missing registration, wrong project, wrong policy hash,
  unexpected permission mode, missing instruction source, model mismatch, or
  stale workspace generation without leaving partial provider state.
- Existing inactive/pre-activation records remain readable; new task-pending
  records require control-project identity and policy fields.
- No feature-branch command mutates live AX runtime, saved Codex projects, or
  Linear activation state.
- Post-merge activation produces one Delivery Executive Assistant Root,
  Current Memory Epoch, Workstream, and pinned task before writer transfer, then
  one Executive Operations Assistant workspace.

## Verification

- Focused unit tests for manifest/output routing, schemas, policy hashing,
  activation migration, and standalone hook execution.
- Table-driven allow/deny tests for every supported pinned role and tool class,
  including malformed and unknown hook payloads.
- AX integration tests for missing, managed, unmanaged-file,
  unmanaged-directory, wrong-link, partial-transition, and exact rerun cases for
  both coordinator targets.
- Isolated `pnpm ax sync`, `pnpm ax status`, and `pnpm ax validate` with separate
  HOME, runtime, cache, Codex config, and coordinator target roots.
- `pnpm run agents:validate`, `pnpm run skills:validate`,
  `pnpm run biome:lint-format`, TypeScript type validation, and the complete
  unit/integration suite.
- Native pre-commit hooks, local four-lane Review, docs alignment,
  AI-readiness report, GitLab no-pipeline state or current configured CI, and a
  complete Nitro review of the exact final head.
- Post-merge live AX status/validate, saved-project discovery, and the real
  Delivery Executive Assistant activation transcript and Linear readback.

## Risks and mitigations

- **Codex project registration remains manual.** Document exactly two paths and
  block before Linear writes until both IDs are verified.
- **Project config or app-tool names drift.** Hash generated policy discovery,
  test observed tool-name fixtures, and fail activation on missing or unknown
  enforcement surfaces.
- **Hooks are not complete sandbox boundaries.** Keep filesystem and shell
  authority read-only, remove raw provider-write tools, and treat hooks only as
  connector/task-control enforcement and defense in depth.
- **Connector writes bypass local filesystem policy.** Deny by default and
  allow only exact typed Linear coordination operations in the personal
  control plane.
- **Delivery tasks need GitLab and source context without control-project shell
  authority.** Resolve the saved repository project, create a read-only
  repository-scoped Agent Run, and delegate draft publication separately to a
  repository-bound Finish Run. If the repository is not registered as a saved
  Codex project or resolves ambiguously, block and ask Rene to register or
  disambiguate it.
- **A stale task writes an old generation.** Require fresh canonical read in
  the role contract, bind generation in every serialized invocation, and reject
  stale post-create/resume attestation.
- **Generated runtime hides untracked local content.** Preflight all target
  shapes, refuse replacement before transaction preparation, and keep AX
  ownership limited to the exact `delivery` and `operations` child targets.

## Execute handoff

Execute owns branch `codex/pinned-coordinator-control-project` in worktree
`/Users/rene.hernandez/.codex/worktrees/pinned-coordinator-control-project/ai`
against `main` at `df875c0dda68ef8bc7342fb977a0183df997fd07`.

Start with failing contract tests and keep one final MR. Do not synchronize the
live runtime, register saved projects, or create Linear Agent Workspace records
from the feature branch. The existing `RENE-1` issue is the implementation
mapping; tracker mutation is unnecessary unless its scope or status must change.
