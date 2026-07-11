# Cloudflare agent workspace MVP

## Outcome

Keep Codex as Rene's interactive and remotely controllable interface. Put
durable organizational coordination state in one Cloudflare SQLite Durable
Object per personal workspace. Execute model and repository work only on the
local machine through one-shot Flue runs. Treat Linear as memory and result
output only.

The workspace is an independently deployed control plane. Managed services,
including Stat, are context and work targets only. Their deployments, endpoints,
health, versions, and release cycles never gate workspace deployment, rollback,
startup, or availability.

This is a fresh system. It may read Linear issues and projects as canonical
work context, but it does not copy, translate, or adopt them as workspace
records.

## User experience

The usable path is one `ax` command surface:

```bash
ax workspace configure --url https://<worker-host> --workspace rene
ax workspace bootstrap
ax workspace send --message "Summarize the delivery portfolio."
AX_FLUE_MODEL=<provider/model> ax workspace run --once
```

Rene normally talks only to `delivery-ea`. Direct `--to <agent-key>` routing is
available for diagnostics and intentional manager interaction. Long messages
can use `--file`. Explicit local repository writes require both `--repo` and
`--workspace-write`.

## Hierarchy

Bootstrap creates only:

- Delivery Executive Assistant Root, Memory, and completed bootstrap Workstream;
- Executive Operations Assistant Root, Memory, and completed bootstrap Workstream.

The executives create private Linear Project Manager, GitLab Project Manager,
and Squad Lead Roots only when a real scope needs them. A valid Cloudflare-native
Root mutation updates the routing table in the same result transaction, so the
new manager is immediately addressable. Ephemeral implementer, reviewer,
researcher, and operations-specialist work uses Run records.

## State and contracts

Cloudflare owns Root, Memory, Workstream, Run, Decision, and Escalation records,
messages, operation claims, structured results, generation fencing, and pending
Linear projections. Every Root uses `cloudflare-flue-v1`, its personal workspace
key, a stable runtime agent ID, a null Codex task ID, and an active workspace
generation.

Every operation records mode, authority, canonical sources, acceptance,
verification, stop condition, model profile, sandbox mode, correlation, and
idempotency. Completion requires the current claim token and matching workspace
generation. Dynamic record content cannot expand authority.

## Execution and security

Cloudflare stores coordination state and never receives repository bytes or
model credentials. Cloudflare Access protects the Worker. The local AX process
holds Access service-token credentials and a model credential. Read-only work
uses the Flue virtual workspace. Explicit write work uses a trusted-host adapter
against the named absolute local repository path.

There is no daemon, remote sandbox, autonomous timer, hosted shell, or remote
repository checkout in this iteration. Rene retains merge, deployment, cleanup,
external-send, calendar-mutation, and other provider-mutation authority unless
an exact active policy grants it.

## Linear integration output

Linear is the integration output for the workspace. The Worker projects
redacted Memory, Decision, Escalation, completed
Workstream/Run, and operation-result records. `ax workspace linear export`
returns pending projections. `ax workspace linear acknowledge --file <file>`
marks only provider writes that have already succeeded. Agents may read Linear
as a canonical source; editable Linear text never becomes workspace authority.

## Agentic Inbox fit

Cloudflare Agentic Inbox is a reference, not a dependency. Reuse its useful
ideas: one SQLite Durable Object per coordination atom, explicit schema
evolution, fail-closed Access, persistent history, and confirmation before
outbound actions. Do not adopt its email UI, R2 attachment flow, or
Cloudflare-hosted model execution in this MVP.

## Delivery scope

Implement in one final draft MR:

- `ax workspace` configure, bootstrap, status, send, records, one-shot run, and
  Linear projection commands;
- authenticated Worker routes and one personal SQLite Durable Object;
- fresh tracked-manifest bootstrap for the two executive agents;
- immediate routing registration for valid manager Root mutations;
- one-shot local Flue workflow and narrow child-process environment;
- typed schemas, generated validators, redaction, claim fencing, idempotency,
  documentation, and retrieval tests.

Do not deploy Cloudflare resources, write Linear projections, merge, or clean up
legacy systems as part of implementation.

## Acceptance and proof

1. No AX command, Worker route, schema, or documentation offers Linear import or
   record migration.
2. Bootstrap creates exactly two executive Roots plus their Memory and bootstrap
   Workstream records from tracked sources.
3. The Delivery Executive Assistant is the default send target.
4. A manager Root created in a structured result is immediately routable.
5. A local one-shot Flue run claims, validates, completes, and records work with
   claim-token and generation fencing.
6. The Linear integration output contains only durable projections and requires
   explicit acknowledgement after provider success.
7. Worker auth fails closed, production cannot use the development token, and
   request bodies are bounded.
8. Unit, integration, Worker, TypeScript, schema drift, Worker dry-run, Flue
   build, skill validation, and agent validation all pass.
9. Exact-head local review and hosted Nitro review have no unresolved actionable
   findings. The MR remains draft.
10. Workspace deployment and rollback require no deployment, availability, or
    version change in any managed service.
