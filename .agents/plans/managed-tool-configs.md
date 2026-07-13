# Managed Tool Configs

## Goal

Add a generic AX `configs` runtime surface, with Codex as the first tool
handler, so selected user-level configuration values are tracked in
`ax.config.json` and converged without taking ownership of the rest of the
tool's machine-local configuration. [confidence: 0.96 - certain | reason: the
scope and ownership boundary were accepted during brainstorming]

Deliver this plan and its implementation as one change set in one final draft
MR. The change has no planning-only MR, POC, OpenSpec, migration phase, or
separate delivery unit. [confidence: 0.95 - certain | reason: the repository
policy and route check both select one atomic plan]

## Context

The current `~/.codex/config.toml` mixes intentional preferences with Codex
Desktop state, project trust records, plugin state, local absolute paths,
provider settings, and other machine-owned values. AX currently manages
selected runtime files and symlinks from tracked `ax.config.json`, but it does
not manage the user-level Codex config. The first iteration must therefore own
individual TOML leaf paths instead of the complete file or complete tables.
[confidence: 0.94 - certain | reason: direct inspection of the current config
and AX source confirmed the mixed-ownership boundary]

The existing local file already has the six desired values. After merge, the
first live config sync on this machine should report compliance and leave the
file byte-for-byte unchanged. [confidence: 0.91 - certain | reason: the live
values were inspected and match the accepted desired state]

## Accepted Decisions

### Command and ownership model

- Add `ax configs status`, `ax configs sync`, and `ax configs validate`, with
  the equivalent `pnpm ax ...` commands inside this repository. Include the
  configured tool configs in top-level `ax status`, `ax sync`, and
  `ax validate`. [confidence: 0.93 - certain | reason: this is the accepted
  generic command surface and matches existing AX scopes]
- Keep `ax.config.json` as the only tracked desired-state source. Add a
  `runtime.configs` map keyed by tool name; only the `codex` handler is valid in
  this iteration. [confidence: 0.91 - certain | reason: this extends the
  canonical owner already used by all AX runtime surfaces]
- Configure the Codex target as `~/.codex/config.toml`. Resolve `~` from the
  invocation's `HOME`, so normal use follows the current machine and
  feature-branch proof follows an isolated HOME. [confidence: 0.95 - certain |
  reason: this reuses AX path expansion and isolation policy]
- Require the Codex handler's tracked target to be exactly the portable
  `~/.codex/config.toml` location. After expansion, accept only an absent or
  regular-file target whose physical parent remains under the effective HOME;
  reject a symlink, directory, special file, parent escape, or alternate
  absolute target before reading or writing it. [confidence: 0.93 - certain |
  reason: a tracked source branch must not redirect config authority to an
  arbitrary machine path]
- Treat each scalar leaf under the tracked `managed` object as one exact owned
  TOML path. Parent objects group paths; they do not transfer ownership of a
  complete TOML table. Reject unsupported tool names and malformed managed
  trees before inspecting or changing a target. [confidence: 0.90 - certain |
  reason: exact leaf ownership is required to preserve mixed machine state]
- Do not add a registration command, ownership database, host-name map, local
  override file, or general adapter framework. A future tool handler may add
  the machine-binding mechanism it actually needs without changing the
  `configs status|sync|validate` command contract. [confidence: 0.92 - certain |
  reason: these mechanisms were explicitly deferred during brainstorming]

### First managed values

Track only these six Codex TOML leaf paths:

| Managed path | Desired value |
| --- | --- |
| `features.memories` | `true` |
| `features.multi_agent_v2.enabled` | `true` |
| `features.multi_agent_v2.max_concurrent_threads_per_session` | `10` |
| `agents.max_depth` | `1` |
| `memories.generate_memories` | `true` |
| `memories.use_memories` | `true` |

`features.js_repl` and every other current or future Codex setting remain
unowned passthrough values. [confidence: 0.98 - certain | reason: the exact
first-cut inventory was accepted explicitly]

### Read, report, and write semantics

- `configs status` is offline and read-only. It validates the tracked config
  shape, resolves the target, parses an existing TOML file, compares the six
  managed paths, and reports matching, missing, or differing values. A missing
  target is drift rather than an adoption prompt. [confidence: 0.94 - certain |
  reason: this is the accepted zero-step adoption behavior]
- `configs validate` is offline and read-only. It fails for an invalid tracked
  config, unsafe or unsupported target, invalid TOML, managed-key drift, or a
  candidate rejected by the installed `codex features list` config loader
  validator. [confidence: 0.88 - high | reason: the behavior is accepted, while
  the exact spawned-process seam will be finalized in implementation]
- `configs sync` starts from the existing file, or an empty document when the
  target is absent; changes only the managed leaf values; parses the complete
  candidate; validates it with the installed Codex config loader in a temporary
  `CODEX_HOME`; and only then replaces the target. The loader does not require
  auth, connectivity, or broader doctor health. If the candidate already
  equals the original bytes, it reports no change and performs no write.
  [confidence: 0.91 - certain | reason: this combines accepted preservation,
  validation, and no-op adoption semantics]
- Preserve all unowned TOML values. The Codex handler should preserve unowned
  source text and comments when editing the six simple scalar keys rather than
  serializing the complete document. It may normalize the representation of a
  managed key that it changes. If a managed key uses a TOML representation the
  bounded editor cannot change safely, fail with a specific diagnostic and
  leave the file untouched. [confidence: 0.84 - high | reason: source-preserving
  edits best satisfy mixed ownership without adding a dependency]
- Capture the original bytes or absent state before candidate construction.
  Immediately before replacement, reread the target and abort if that state
  changed. Write the validated candidate to a same-directory temporary file,
  preserve or safely restrict file permissions, and atomically rename it over
  the target. Remove temporary files on success or failure. [confidence: 0.93 -
  certain | reason: this is the accepted concurrent-writer and atomic-apply
  contract, and the repository already uses same-directory rename commits]
- On a disposable or otherwise unverified source, `configs sync` must require
  both an isolated runtime root and a HOME that resolves outside the operating
  system user's live home. An isolated runtime root alone is insufficient
  because it does not redirect the tool config target. A verified clean
  default-branch source matching its upstream may write the live target.
  [confidence: 0.94 - certain | reason: review traced the current live-source
  bypass and found that it only evaluates the runtime root]
- A config failure must not silently become a warning in top-level commands.
  Top-level status and validation include config findings, and top-level sync
  returns failure if the config candidate cannot be safely validated or
  applied. [confidence: 0.90 - certain | reason: authoritative desired state
  requires fail-closed drift handling]

## Scope

### In scope

- Extend the tracked AX runtime schema with the Codex target and six managed
  values.
- Add the generic `configs` CLI scope and Codex-specific TOML handler.
- Integrate managed configs into top-level AX status, sync, and validation.
- Add unit and integration coverage for exact-key ownership, no-op adoption,
  missing targets, drift repair, unowned-content preservation, validator
  failure, concurrent modification, target redirection, feature-branch
  isolation, and atomic replacement.
- Update the AX reference, active instructions/rules, and `ax-cli` skill so
  agents use the new source-managed flow instead of editing owned keys in the
  installed file.
- Validate changed shared agent guidance with `writing-skills` before commit.

### Out of scope

- Claude Code or any tool handler other than Codex.
- Plugins, MCP servers, providers, profiles, project trust entries, app IDs,
  hooks, Desktop state, caches, marketplace state, or any other Codex key.
- Whole-file or whole-table ownership, symlinking `config.toml`, or deleting
  untracked values.
- Machine registration, host profiles, templates, secrets management,
  environment-variable substitution, or a local override layer.
- Backups, restore commands, interactive adoption, or manual conflict
  resolution.
- Changing the six desired values chosen during brainstorming.
- Adding or changing package dependencies.

## Reuse and Deviation Contract

### Inspected precedents and canonical owners

- `ax.config.json` is the canonical desired-state owner and will directly hold
  the portable target plus managed values.
- `scripts/ax.ts` owns command parsing, scoped `status|sync|validate` surfaces,
  top-level aggregation, JSON output, path expansion, and package/shim parity.
- `scripts/ax/runtime-sync.ts` owns the current replaceable-tree runtime
  surface types, config validation, live-source safety boundary,
  candidate-before-apply ordering, isolated runtime behavior, and runtime
  reports.
- `scripts/ax/json-state.ts` and `scripts/ax/transaction-engine.ts` demonstrate
  same-directory temporary writes and rename-over atomic commit points.
- `scripts/ax/agent-runtime.ts` and
  `scripts/ax/coordinator-project-runtime.ts` already use `smol-toml` for TOML
  parsing and generated-candidate validation.
- `tests/unit/ax-cli.test.ts`,
  `tests/unit/runtime-authoritative-sync.test.ts`, and
  `tests/integration/ax-cli.test.ts` own the current CLI, authoritative-sync,
  isolated-HOME/runtime, and fake-executable test patterns.
- `docs/ax.md`, `rules/command-and-tools.md`, `instructions/AGENTS.md`, root
  `AGENTS.md`, and `skills/ax-cli/SKILL.md` are the active user and agent
  guidance owners for AX behavior.

### Direct reuse and extension

- Extend the existing Commander `Scope` and scoped-command patterns with
  `configs`; do not add `configs` to `RuntimeSurface`, because that type and its
  path classifiers describe replaceable runtime trees rather than
  mixed-ownership files. Do not introduce a second CLI.
- Reuse `~` expansion, isolated HOME tests, structured reports, `--json`, and
  the verified-default-branch live-sync guard. Extract or export the shared
  source-verification decision instead of duplicating its Git checks in the
  config handler; add the config-target isolation requirement at the caller
  boundary because runtime-root isolation alone does not protect config files.
- Reuse `smol-toml` for semantic parse and candidate verification.
- Reuse same-directory temporary-file cleanup and rename-over behavior for the
  single config file, while retaining an expected-original-state check for
  Codex Desktop concurrency.
- For top-level sync, prepare and Codex-load the tool-config candidate
  before invoking the existing runtime sync, then apply the prepared config
  afterward. Preserve the config handler's final expected-original-state check
  immediately before its rename; a late concurrent Desktop write still aborts
  instead of being overwritten and reports that ordinary runtime convergence
  may already have completed. This keeps the operation safely rerunnable
  without refactoring the established runtime candidate engine.
- Extend the existing documentation and skill owners rather than creating a
  second config-management guide.

### New mechanism and justification

Add one `scripts/ax/config-sync.ts` boundary containing a small tool registry,
the Codex handler, managed-leaf comparison, candidate construction, validator
invocation, and atomic apply. Runtime directory/symlink replacement cannot be
reused directly because the Codex target is a mixed-ownership document that
requires semantic leaf merging and concurrent-writer detection. `smol-toml`
does not provide lossless document edits, so the Codex handler needs a bounded
source-preserving editor for the six scalar keys; adding a general TOML writer
or a dependency is not justified by this first iteration. [confidence: 0.87 -
high | reason: source inspection confirms no current owner supports mixed-file
leaf convergence]

The handler registry is intentionally minimal: it dispatches the configured
`codex` entry and rejects unknown names. It is the only abstraction needed to
add a Claude handler later; no common value schema beyond the command/report
contract should be invented now. [confidence: 0.89 - high | reason: this keeps
the future extension seam without speculative framework code]

## Implementation Plan

### 1. Define the tracked contract and first real confirmation

- Extend `AxRuntimeConfig` with `runtime.configs`, the supported tool-name
  shape, portable target, and nested managed scalar values.
- Add the Codex entry to `ax.config.json` with the six accepted leaf paths and
  `~/.codex/config.toml` target.
- Validate exact managed leaves, scalar types, supported tool names, safe file
  targets, HOME containment, target kind, and collisions before target access.
- Add the first focused test around the actual user-visible entrypoint:
  `ax configs status --json` against an isolated HOME containing a matching
  Codex file must exit successfully and report the six managed paths as
  compliant while an otherwise identical drifted fixture must exit non-zero
  and identify the exact path. This is the first real confirmation, not a
  schema-only test. [confidence: 0.92 - certain | reason: it proves the named
  capability through the CLI in the first implementation area]

### 2. Implement Codex inspection, validation, and convergence

- Add the config-sync module and stable report types for target, managed paths,
  drift, changed paths, findings, and validator outcome.
- Implement full-document TOML parsing plus exact managed-leaf comparison.
- Implement the bounded source-preserving scalar updater for existing and
  missing canonical tables; reject ambiguous or unsafe managed-key syntax.
- Build candidates in a temporary directory and run `codex features list` with
  that directory as `CODEX_HOME`. This exercises Codex schema/type loading
  without rejecting unowned keys introduced by a newer execution surface. Make
  process execution injectable
  for unit tests and use a fake `codex` executable on `PATH` in integration
  tests; do not track a machine-specific executable path.
- Apply only a fully parsed and Codex-loaded candidate. Detect target
  changes since read, use a same-directory atomic rename, retain safe file
  permissions, and clean up every temporary path.
- Reuse the repository's source-verification logic, but require isolated HOME
  as well as isolated runtime state when an unverified source attempts config
  mutation. A live HOME must remain unwritable from a disposable worktree even
  when `--runtime-root` is set.
- Return a true no-op when the current bytes and desired candidate match.

### 3. Integrate the generic CLI surface

- Add `configs` to command parsing, help, scoped status/sync/validate routing,
  legacy-command rejection, and structured output.
- Include the configs result in top-level status, sync, and validate without
  weakening existing runtime surface behavior or repo-local OpenSpec routing.
- Prepare and Codex-load the config candidate before top-level sync calls
  the existing runtime synchronizer, so deterministic config failures cannot
  occur after ordinary runtime targets were already changed. Apply the
  prepared config after runtime convergence and retain the immediate
  concurrent-change check.
- Ensure scoped config sync and top-level sync retain the current verified live
  source requirement, while status and validate remain offline and read-only.
- Keep the target rooted in `HOME`; `--runtime-root` continues to control AX
  cache/runtime state and does not redirect tool config files.

### 4. Prove safety and preserve compatibility

- Unit-test matching, differing, missing, falsey, and wrong-type managed values;
  unowned nested tables and local absolute paths; invalid TOML; unsupported
  tools; unsafe targets; absent-file creation; unsupported managed-key syntax;
  validator rejection; no-op byte preservation; temp cleanup; concurrent
  writer rejection; symlink and physical-parent escape rejection; feature
  source plus live-HOME rejection even with an isolated runtime root; and
  atomic replacement.
- Extend CLI tests for the new scope, JSON report, top-level aggregation, and
  rejection of retired `install|update` verbs.
- Add integration tests using isolated HOME/runtime roots and a fake Codex
  executable that inspects the staged `CODEX_HOME/config.toml`. Prove both success
  and validator failure without touching the developer's live config.
- Retain all existing runtime, agent, coordinator, OpenSpec, and shim tests.

### 5. Align active guidance and prepare delivery

- Update the AX reference, command/tool rule, portable and repo-local
  instructions, and `ax-cli` skill with exact-key ownership, passthrough
  behavior, command selection, isolated-HOME proof, and post-merge live sync.
- Extend documentation and skill contract tests so the managed-config behavior
  cannot silently disappear or broaden to whole-file ownership.
- Run `writing-skills` RED/GREEN pressure scenarios for the changed `ax-cli`
  guidance, then run the repository skill validator.
- Keep the plan in this same final implementation change set. Do not publish a
  planning-only MR.

## Acceptance Criteria

1. `pnpm ax configs status --json` reports the configured Codex target and all
   six exact managed paths, exits zero when they match, and exits non-zero with
   path-specific drift when any are missing or different.
2. `pnpm ax configs validate --json` is read-only and fails for tracked-contract
   errors, target/path errors, TOML parse errors, drift, or installed Codex
   installed-loader rejection.
3. `pnpm ax configs sync --json` creates a missing file or repairs only the six
   managed paths after full candidate validation.
4. Sync preserves every unowned semantic value and unowned source content,
   including machine-specific absolute paths and unrelated tables.
5. A matching target is not rewritten; its bytes and modification time remain
   unchanged.
6. A validator failure, unsupported TOML representation, or concurrent target
   change leaves the original target untouched and removes temporary files.
7. The final replacement is atomic at the target path and does not expose a
   target-absent window.
8. A disposable or unverified source cannot mutate the operating system user's
   live Codex config by setting only `--runtime-root`; it must use an isolated
   HOME as well. Symlinked or escaped Codex targets are rejected.
9. Top-level sync prepares and Codex-loads the config candidate before
   ordinary runtime mutation. A late concurrent config change still aborts at
   the config commit point, reports that runtime convergence may already have
   completed, and remains safely rerunnable.
10. Top-level AX status/sync/validate includes configured tool configs, while
   `ax configs ...` remains independently usable.
11. Existing AX runtime surfaces, OpenSpec behavior, shim behavior, and unrelated
   Codex settings remain unchanged.
12. The active AX docs and `ax-cli` skill accurately describe tracked ownership,
    passthrough values, isolation, and activation.
13. On this machine, the post-merge live `ax configs sync` is a no-op because
    the six current values already match.

## Verification

Run focused proof first:

```bash
pnpm exec node --import tsx --test tests/unit/config-sync.test.ts tests/unit/ax-cli.test.ts
pnpm exec node --import tsx --test tests/integration/ax-cli.test.ts
```

Run shared-guidance validation after changing the skill and instructions:

```bash
pnpm skills:validate
pnpm exec node --import tsx --test tests/unit/ax-cli-skill-contract.test.ts tests/unit/ax-runtime-identity-docs.test.ts
```

Run full repository verification:

```bash
pnpm biome:lint-format
pnpm test
pnpm agents:validate
```

Before merge, prove config behavior only with isolated HOME and runtime roots;
do not point the feature branch at the live Codex config:

```bash
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> configs status
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> configs sync
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> configs validate
```

After merge, locate and verify the clean main worktree, fast-forward it to
`origin/main`, then run live `pnpm ax sync` and `pnpm ax validate` from that
main worktree. Confirm the config result reports no changed path on this
machine. Merge and live activation remain Finish authority. [confidence: 0.94 -
certain | reason: this is the repository's required AX activation policy]

## Risks and Controls

| Risk | Control |
| --- | --- |
| Whole-file rewrite destroys machine-specific state | Own scalar leaves only, parse the complete file, preserve unowned source content, and test local absolute paths and unrelated tables. |
| Codex Desktop writes during sync | Compare the target's original state immediately before atomic rename and abort on any change. |
| An isolated runtime root is mistaken for isolated config state | On unverified sources, require the expanded config target to live outside the OS user's real home as well as requiring isolated runtime state. |
| A tracked target redirects through a symlink or alternate path | Accept only the exact portable Codex target and verify its kind and physical parent containment before access. |
| A syntactically valid candidate is rejected by Codex | Run the installed config loader against a staged `CODEX_HOME` before replacement. |
| The installed `codex` executable is missing or incompatible | Fail with a path-specific validator diagnostic; do not weaken validation or add a tracked machine-local executable path. |
| Missing file is mistaken for a migration problem | Treat it as ordinary drift and construct the minimum valid managed document. |
| Generic abstraction grows ahead of requirements | Support only the Codex handler and shared command/report contract; reject unknown tools. |
| Top-level sync changes live config during feature development | Require isolated HOME before merge and activate only from verified merged main. |
| Guidance and runtime behavior diverge | Update the existing AX docs and skill owners, run writing-skills, and enforce contract tests. |

## Implementation Handoff

Execute this reviewed plan in this worktree as one singly owned change set. At
Execute entry, create `codex/managed-tool-configs` from
`1391d93472b4a24e1cad4eef3ce525c0b6732898`; the final MR targets `main`. The
logical order is tracked contract and first CLI proof, Codex handler, CLI
integration, safety coverage, then guidance alignment. Keep the MR draft
through technical readiness. Publication and hosted follow-through are Finish
authority; merge and live activation require explicit authority. [confidence:
0.94 - certain | reason: the base fingerprint, detached worktree state, and
delivery policy were verified in this Plan]
