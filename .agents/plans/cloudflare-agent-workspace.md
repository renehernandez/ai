# Cloudflare-Backed Agent Workspace

## Goal

Replace Linear and Codex task delivery as the operational agent control plane
with one Cloudflare-backed workspace while preserving the complete existing
organizational hierarchy and record contracts. Rene continues talking to the
Delivery Executive Assistant through Codex. Flue executes every agent turn and
all repository work on Rene's local machine. Linear becomes a human-readable
projection of compact memory, decisions, escalations, and completed results.

## Context

The current Agent Workspace protocol already defines the desired organization:

- Delivery Executive Assistant and Executive Operations Assistant;
- one Linear Project Manager per Linear Project;
- one GitLab Project Manager per GitLab Project;
- one Squad Lead per delivery scope; and
- ephemeral implementer, reviewer, researcher, and operations-specialist Runs.

It also defines six durable record types: Root, Memory, Workstream, Agent Run,
Decision, and Escalation. Today those records live in Linear and pinned Codex
tasks carry agent-to-agent messages. The referenced activation attempt proved
that Codex task reads and sends can time out at the coordination boundary, task
permissions are fixed at creation, and a failed task surface can block the
entire hierarchy even when Linear state is intact.

This change keeps the record vocabulary, hierarchy, authority, model routing,
privacy rules, and Git/provider lifecycle. It changes which system owns live
coordination. Cloudflare stores and serializes operational state. Linear and
GitLab remain canonical for their own product and delivery objects, while
Linear Agent Workspace issues become projections rather than scheduling locks.

This is one coherent AI-repo change: the service, AX client, local Flue runner,
projection protocol, migrated agent instructions, and verification form one
runtime contract and ship in one final draft MR. It does not deploy the Worker
or migrate live records before merge; deployment and live migration remain
explicitly authorized post-merge operations.

## Readable Summary

Codex remains the interface. A new `ax workspace` command group talks to a
Cloudflare Worker. The Worker routes one named personal workspace to a SQLite
Durable Object, which owns the complete record graph, agent messages, claimed
operations, results, and Linear projection outbox.

`ax workspace send` appends a message for the executive agent. `ax workspace
run --once` claims one operation, invokes a local Flue agent with the validated
workspace context and role charter, then atomically records its structured
result and any delegated messages. Flue uses the local filesystem and shell
only for an authorized writable Run. Model and provider credentials never
enter Cloudflare.

Linear projection is intentionally separate from operational commits. The
workspace produces retryable projection entries for Memory, Decision,
Escalation, and completed Workstream/Run results. Codex applies them through
its connected Linear surface and acknowledges successful projection IDs
through AX.
Failed projection never blocks agent coordination and can be retried without
changing its projection ID. The Linear consumer must use that ID to reconcile
ambiguous retries before acknowledging the write.

## Decisions

### One personal workspace is the coordination atom

- Route the stable workspace key, initially `rene`, to one SQLite-backed
  Durable Object. The object is not a platform-global singleton; one object
  owns one person's organizational graph and serializes its mutations.
- Store all six existing schema-validated records without weakening their
  classification, authority, generation, or immutable approval fields.
- Evolve Root into a backend-discriminated contract. Imported
  `linear-codex-v1` roots retain their saved-project/task activation tuple;
  `cloudflare-flue-v1` roots instead require workspace key, runtime agent ID,
  role/prompt attestation, generation, and Cloudflare activation state. Never
  populate legacy Codex fields with sentinel or fabricated values.
- Add service metadata outside record bodies: import/activation state, operation
  claim owner/time, result history, projection state, and acknowledgement time.
- Preserve stable semantic agent keys and parent relationships. Linear issue
  IDs become optional projection addresses, never runtime identities.

### Cloudflare is authoritative for operational state

- The Durable Object owns activation, current generation, agent inboxes,
  correlated messages, Run state, decisions awaiting authenticated approval,
  escalation attention, checkpoints, and recovery.
- Linear remains canonical for Linear Projects and issues; Git/GitLab remain
  canonical for repositories, commits, MRs, CI, discussions, and approvals.
- Linear Agent Workspace records are output projections. Mutable Linear text
  cannot authorize or advance the Cloudflare state machine.
- Import accepts the existing validated record array as non-authoritative staged
  state. Re-import before activation reconciles records by stable ID.
- Activation of an imported Root is a recorded backend migration: preserve its
  legacy task/project tuple as immutable provenance, increment the generation,
  bind the Cloudflare runtime identity, and only then make Cloudflare
  authoritative. Import alone never changes authority.

### Codex stays the only interactive surface

- Rene normally talks only to the Delivery Executive Assistant in Codex.
- Codex invokes `ax workspace`; there is no MCP server or custom dashboard.
- Private managers and Squad Leads remain durable instances and communicate
  through Cloudflare mailboxes. They need no separate pinned Codex tasks.
- `ax coordinators` and current pinned tasks remain available during migration
  but stop being authoritative only after `ax workspace activate` succeeds for
  the complete imported hierarchy.

### AX provides one small operational command group

Provide human-readable output by default and stable JSON with `--json`:

- `ax workspace configure --url <url> --workspace <key>` stores non-secret
  client configuration in the local AX config directory. Production authentication
  uses Cloudflare Access service-token headers from
  `AX_WORKSPACE_ACCESS_CLIENT_ID` and `AX_WORKSPACE_ACCESS_CLIENT_SECRET`;
  neither value is written to configuration.
- `ax workspace import --file <records.json>` validates and imports the current
  Linear-derived record graph.
- `ax workspace activate` atomically migrates every validated imported Root to
  the Cloudflare backend and increments its generation. Repeating activation
  after success is a status-preserving no-op.
- `ax workspace status` summarizes agents, workstreams, pending attention,
  queued operations, active lease, and projection backlog.
- `ax workspace send --to <agent-key> [--message <text> | --file <path>]`
  appends one correlated message. Delivery EA is the default destination.
- `ax workspace records list|show` exposes the durable graph for diagnosis.
- `ax workspace run --once` claims and executes one local Flue
  operation. Repeated invocation drains work without a resident daemon.
- `ax workspace linear export` returns pending projections with stable IDs for
  consumer-side reconciliation;
  `ax workspace linear acknowledge --file <ids.json>` records successful IDs.

`ax sync`, `status`, and `validate` retain their current offline semantics and
never contact or mutate the workspace service. `ax workspace` is explicitly
networked and operational.

### Flue executes locally and returns structured actions

- Add one tracked Flue application that uses the existing role manifest,
  shared contract, role charters, and required skills as its prompt source.
- Each claimed operation selects a role and model profile from the existing
  manifest. Provider/model overrides are local configuration; provider keys
  remain local environment variables.
- Reconstruct the agent turn from the Cloudflare Root, Current Memory Epoch,
  relevant Workstreams, Decisions/Escalations, and correlated messages.
  Cloudflare is the long-term memory, so local Flue process state is disposable.
- Add versioned workspace-operation and workspace-result schemas rather than
  reusing the Codex two-phase activation context. Legacy activation and
  invocation schemas remain valid only for `linear-codex-v1` compatibility.
- Pinned roles receive no host shell. An authorized ephemeral Run may use
  Flue's trusted-host local adapter with the exact claimed worktree as its
  working directory and only with the recorded sandbox mode and authority
  grant. The adapter is not a filesystem isolation boundary.
- Require a validated structured result containing the visible response,
  checkpoints, record mutations, delegated messages, projection candidates,
  and terminal or waiting state. AX validates before submitting it.
- A crash leaves the operation claimed. A later `run --once` requeues a claim
  older than two hours under the same operation ID. The operator must inspect
  unknown local or external effects before accepting another write attempt.

### Command and storage protocol

- Use versioned workspace-operation and workspace-result envelopes with
  workspace key, operation ID, generation, role, authority, and timestamps.
- Production sits behind Cloudflare Access. The Worker fails closed when its
  Access audience/team configuration is absent and validates the
  `Cf-Access-Jwt-Assertion` against the remote JWKS, pinned issuer, audience,
  algorithm, and non-zero clock tolerance. Local Worker tests use an explicit
  development-only authentication hook that cannot be selected by deployed
  configuration.
- The Worker authorizes only its configured personal workspace key, limits JSON
  request bodies to one megabyte, and returns sanitized structured errors.
- The Durable Object performs each activation or completion mutation in one
  synchronous SQLite transaction without external I/O between writes.
- Messages are idempotent when they carry an idempotency ID. Operations retain
  correlation IDs; Runs retain invocation ID and attempt semantics.
- The service exposes command/query routes only. It does not run a
  model, access repositories, call Linear/GitLab, or hold their credentials.

### Linear projection contract

- Project the current Memory Epoch, Decisions, Escalations, and terminal
  Workstream/Run results.
- Each projection includes an opaque projection ID, entity type, entity ID,
  typed payload, and creation time. Acknowledgement records successful IDs.
- Restricted records emit only the existing redacted projection allowed by the
  serializer. Full Cloudflare content remains subject to the same privacy
  classification and must not be copied to Linear.
- Projection acknowledgement is idempotent. Unacknowledged entries remain
  exportable for provider retry.

### Agentic Inbox fit

- Treat Cloudflare's `agentic-inbox` repository as a maintained reference, not
  a dependency or fork. Its per-mailbox Durable Object, SQLite migration,
  generated-binding, Cloudflare Access, and explicit-send-confirmation patterns
  apply directly to this workspace service.
- Do not adopt its Cloudflare Agents SDK/Workers AI execution, React client,
  MCP endpoint, Email Routing, mailbox CRUD, or R2 attachment model in v1.
  Those would move agent work to Cloudflare and replace the chosen Codex/AX
  interface.
- Preserve an integration seam for the Executive Operations Assistant to read
  a future Agentic Inbox mailbox and prepare drafts. Sending email remains an
  authenticated Rene-approved provider action and is not implemented here.

## Scope

### In scope

- Cloudflare Worker and SQLite Durable Object configuration;
- the complete six-record graph, hierarchy, messages, claims, results, and
  projection outbox;
- versioned service/client contracts and schema validation;
- backend-discriminated Root records plus workspace-operation and
  workspace-result schemas, with legacy Codex compatibility;
- `ax workspace` configuration, import, status, messaging, record inspection,
  one-shot execution, and Linear projection commands;
- one local Flue application using existing agent roles and local execution;
- updated Agent Workspace skill, docs, rules, and generated behavior contracts;
- compatibility with the existing Linear/Codex runtime during migration;
- deterministic tests for state transitions, message idempotency, generation
  fencing, stale-claim recovery, privacy redaction, CLI behavior, and projection
  acknowledgement;
- Worker type generation, dry-run bundling, and local Worker-route proof.

### Out of scope

- Worker deployment, Cloudflare resource creation, secrets, or live migration;
- remote sandboxes, Containers, Kubernetes, CI execution, or hosted agents;
- a daemon, scheduler, web UI, MCP server, mobile application, or notifications;
- autonomous merge, deployment, cleanup, calendar, email, or Slack mutations;
- replacing Codex as Rene's interface;
- deleting current Linear records, coordinator projects, or pinned tasks;
- generalized multi-user tenancy, billing, or public API access.

## Acceptance

1. The service stores every existing workspace record type and preserves the
   current hierarchy, generation, authority, privacy, and idempotency fields.
   Legacy roots import without loss, and Cloudflare-native roots validate
   without fabricated Codex task or saved-project fields.
2. Two messages with the same idempotency ID produce one operation; a stale
   generation cannot complete or mutate state.
3. Agent messages remain ordered and correlated through retry, and one claim
   owns an operation. Stale work is recoverable under the same ID.
4. `ax workspace import` can ingest a representative current Linear record
   graph and `status` reports agent, record, operation, and projection counts.
   `ax workspace activate` performs one all-or-nothing authority cutover.
5. From Codex, one `ax workspace send` to the Delivery Executive Assistant and
   one `ax workspace run --once` produce a local Flue result and durable records
   without a Codex task-to-task call.
6. Writable Flue execution starts in the explicitly claimed local worktree and
   receives a narrow child-process environment; Cloudflare receives no
   repository files or provider/model credentials.
7. Linear export contains only allowed memory/results projections.
   Acknowledgement removes successful IDs from later exports.
8. Existing offline AX commands retain their behavior and do not contact the
   workspace service.
9. Documentation makes Cloudflare operational state authoritative, Linear the
   memory/results projection, Codex the interface, and the local machine the
   only execution surface.
10. No deployment, provider mutation, or live record migration occurs as part
    of implementation or verification.

## Verification

- Unit tests for command parsing, schema validation, generation fencing,
  message idempotency, structured Flue results, and Linear projection state.
- Schema compatibility tests covering legacy Root import, explicit backend
  migration, Cloudflare-native activation, and rejection of mixed tuples.
- AX CLI tests for command parsing, executive defaults, and unchanged offline
  command behavior.
- Worker-runtime route tests against a local Durable Object binding for auth,
  import/activation, generation migration, idempotent messaging, derived Runs,
  completion, and projection export.
- `wrangler types --check` against the committed generated bindings.
- generated Wrangler type drift validation and `wrangler deploy --dry-run` for
  the Worker bundle without publishing it.
- Existing `pnpm test`, `pnpm agents:validate`, `pnpm skills:validate`, and
  `pnpm biome:lint-format` repository gates.
- Writing Skills behavior validation for the changed Agent Workspace and AX
  guidance before commit.
- Read-only implementation review of the exact target-base diff and HEAD for
  correctness, regression risk, maintainability, Worker security, privacy,
  and verification coverage before draft publication.

## Risks and mitigations

- **Split authority:** Linear and Cloudflare could disagree. Mitigation:
  Cloudflare is authoritative for operational records; pending and acknowledged
  projection IDs make write state explicit.
- **Local runner interruption:** a model or shell call may have produced an
  unknown effect. Mitigation: lease expiry never assumes rollback; recovery
  inspects local state and escalates ambiguous external effects.
- **Over-privileged local agent:** Flue local sandbox can reach host resources.
  Mitigation: only an authorized workspace-write Run receives it, with exact
  worktree cwd and a narrow environment allowlist; pinned roles receive none.
  This is trusted local execution, not host isolation.
- **Cloudflare secret leakage:** request logging could expose content or tokens.
  Mitigation: structured metadata-only logs, bounded bodies, sanitized errors,
  Access service-token secrets kept only in the local environment, and no
  token/model/provider credentials in records.
- **Projection duplication:** applying an export twice could repeat Linear
  writes. Mitigation: apply each opaque projection ID once and acknowledge only
  successful provider writes; richer receipt reconciliation remains future work.
- **Beta Flue API drift:** Flue is currently beta. Mitigation: pin exact package
  versions, isolate it behind one AX runner adapter, and test the generated
  local invocation rather than exposing Flue types throughout AX.
- **Scope growth:** a production platform would add queues, schedules, UI,
  remote execution, and multi-tenancy. Mitigation: all remain explicitly out
  of scope; one personal workspace and one-shot runner are the v1 boundary.

## First real confirmation

This is the post-merge operator confirmation. Local implementation verification
builds the Flue application but does not invoke a paid model or migrate live
provider state.

Use a representative SPAT snapshot containing the Delivery Executive
Assistant, the Stat Async Deployment Lifecycle Linear Project Manager, the
`ai/stat` GitLab Project Manager, the Async deployment lifecycle Squad Lead,
their active Workstream, one Run, one Decision, and one Escalation. Import it
into the local Durable Object, activate the complete snapshot, send the
executive a status request, execute one local Flue turn, and verify the durable
message/result plus retryable Linear projection export. This proves the complete
hierarchy and the actual failure boundary without deploying or touching live
provider state.

## Implementation handoff

Execute in this owned worktree on branch
`codex/cloudflare-agent-workspace`, targeting `main`. Keep the plan and
implementation in the same final change set. Begin with contracts and the pure
state machine, add the Durable Object adapter and Worker routes, then the AX
client and local Flue adapter, followed by projection and instruction changes.
Do not publish until the exact diff passes all named local verification and
read-only review. Finish may open one draft GitLab MR and follow configured
hosted review; merge, deployment, live migration, and cleanup remain explicit.
