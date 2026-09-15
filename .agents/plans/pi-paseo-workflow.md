# Pi and Paseo coding workflow

## Objective

Make AX the source of Pi and Paseo configuration and deliver a deterministic
planning-to-implementation handoff with bounded independent model review.

## Accepted approach

Astra owns brainstorming, research and planning. One planning review round runs
GLM 5.3 and DeepSeek independently; each covers every applicable planning lens,
including a distinct simplification outcome. Astra evaluates their findings and
incorporates relevant changes, asking the user about material uncertainty.

The existing handoff brief starts a new Paseo-managed Pi session with GPT-5.6
Sol. Sol implements and verifies. One implementation review round runs GLM 5.3,
DeepSeek and Astra independently, each covering all applicable review lenses.
Sol evaluates the combined findings, fixes applicable issues and verifies the
repairs without automatically repeating local model review.

Sol publishes a Ready PR or MR and requests the repository-selected Genie or
Nitro reviewer. Hosted monitoring collects CI and automated review completion.
Sol handles one hosted feedback repair batch, verifies and pushes, then reports
the current state with the artifact remaining open and Ready. Later automated
feedback is reported without starting another repair loop. Merge is excluded.

## Ownership and reuse

Extend AX's existing configuration and runtime transaction owners for managed
Pi JSON settings and Paseo JSON profiles/providers. Preserve unrelated settings
and credential files. Resolve the existing personal/work profile once for assets
and configuration. Reuse the hooks runtime tree for Pi integration and existing
force-push/deletion policy evaluators. The existing handoff-brief and review
catalog remain the owners of handoff content and review lenses.

Paseo alone creates and tracks sessions. A role launcher supplies the model,
effort and finite assignment. A Pi adapter validates the actual active role/model
before work and blocks prohibited tools; provider presets alone are insufficient
because Paseo appends model arguments and permits session environment overrides.
Model mismatch, missing enforcement or unsupported configuration fails closed.
Reviewers have read-only tools and cannot spawn workers. No silent model fallback
or recursive delegation is allowed. Hooks enforce supported tool boundaries,
not a hostile process security sandbox.

OpenAI uses Pi's existing ChatGPT subscription authentication. GLM and DeepSeek
use the Cloudflare AI Gateway provider. Anthropic and organization-level chief
of staff/project managers are deferred. MCP integration must preserve Paseo's
native extension and use its supported adapter without introducing another
orchestration owner.

### Deterministic runtime contract

The tracked role catalog fixes these routes for both profiles:

| Role | Pi provider/model | Thinking |
| --- | --- | --- |
| Planner | openai-codex/gpt-6-astra | low |
| Implementer | openai-codex/gpt-5.6-sol | medium |
| GLM reviewer | cloudflare-ai-gateway/workers-ai/@cf/zai-org/glm-5.3 | low |
| DeepSeek reviewer | cloudflare-ai-gateway/workers-ai/@cf/deepseek-ai/deepseek-v4-pro-0813 | off |
| Astra reviewer | openai-codex/gpt-6-astra | low |

AX's existing `sync --profile personal|work` selects the profile; later syncs
reuse persisted selection. An uninitialized runtime fails without a selection.
No new profile selector or default is introduced. The profiles retain their
different instruction policies but use the same initial model routes.

Both enforcement points are required: the wrapper validates final Paseo argv
and explicitly loads the mandatory adapter; the adapter validates the active
model/effort and allowed tools during the session. Missing adapter initialization
must prevent prompt dispatch. Reviewer calls use only read, grep, find and ls;
they cannot call shell, MCP mutations or worker-launch tools. The supported
community MCP package is pi-mcp-adapter, pinned after compatibility verification;
Paseo's generated native integration extension remains loaded.

GLM reasoning is always enabled. Manage its supported reasoning-effort mapping,
32,768 output-token limit and 1,048,576 context limit instead of Pi's invalid
catalog defaults. Sol, GLM and DeepSeek have account-specific response proof;
this validates the machine's current credentials, not another machine's profile.
Provider command arguments are the role contract consumed by the wrapper and
runner; verify display model/effort metadata agrees with that contract.

AX config-sync prepares JSON candidates, runtime-sync stages them in its existing
transaction with assets, and profile state commits last. JSON ownership is an
explicit list of managed paths; provider definitions are atomic subtrees.
Credential files are outside every managed path.

Both profiles also manage Paseo hosted relay enablement, daemon/public endpoints
(`relay.paseo.sh:443`) and both TLS flags. Pairing identities and encryption keys
remain machine-local. Endpoint/TLS changes require restart after runtime
activation; deployment overrides must not silently replace the tracked values.

The transaction includes the entire managed hooks tree and Pi adapter. A private
startup acknowledgment must precede forwarding the initial prompt. Model/effort
validation also runs before every tool call. Handoff creates a new Paseo agent
and records its new identity; normal Paseo session-file arguments are preserved.
The handoff carries resolved publication host and reviewer before publication.
For this repository, personal selects GitHub origin with Genie; work selects
Fullscript GitLab origin with Nitro. Verify origin matches the selected profile
before publication; a mismatch blocks external publication, not local implementation.

Each model request has a finite timeout and requires a nonempty successful
response with complete review outcomes. Transport failure, malformed output or
missing model support is blocked evidence, never a pass or silent retry.
Hosted monitoring has a configurable deadline, defaults to 30 minutes, and ends
as completed, awaiting-user, timed-out, or failed; unchanged polls stay quiet.
After one hosted repair batch, later feedback is reporting-only.

## Delivery and deviations

This is one accepted migration, one atomic plan and one implementation change
set. The user's explicit single-change instruction supersedes splitting this
migration into separate units. Their Ready publication and finite review policy
supersede the older draft-until-merge and recurring repair policy for this Pi
workflow. Legacy harness behavior remains intact where this workflow is inactive.

Work in an owned feature worktree. Test AX with isolated HOME and runtime roots;
do not activate feature code in the live runtime. After separately authorized
merge, synchronize from verified clean main. Never commit authentication data.

## Acceptance and proof

- An isolated AX sync creates Pi/Paseo configuration, instructions and hooks
  from source; switching profiles remains consistent and unrelated keys survive.
- Configuration and runtime changes roll back together on failure; unsafe
  paths, invalid JSON and concurrent changes stop synchronization.
- Actual launch arguments fix role/model/effort, preserve Paseo integration,
  reject overrides and missing enforcement, and start a fresh implementation
  session with the brief rather than inherited conversation history.
- Reviewer tool restrictions and existing destructive-command policies have
  behavioral tests; changed-model work is rejected before tools execute.
- A review checkpoint dispatches each required model once, gathers separate
  complete lens outcomes, and never silently retries malformed model output.
- One local repair batch and one hosted repair batch are enforced, with
  uncertainty returned to the user and final provider state reported accurately.
- Native formatting, charter validation, skill validation and repository tests
  pass. Live provider smoke proof is distinguished from local simulated proof.

## Rollout risks

Paseo 0.8.0 and Pi 0.85.1 are installed. Exact configured model availability
requires provider validation; a catalog entry alone is not account entitlement.
This laptop's GitHub origin matches the personal route. The work laptop retains
its GitLab origin and Nitro route; no remote is rewritten by the migration.
Runtime activation remains separate from feature implementation and publication.
