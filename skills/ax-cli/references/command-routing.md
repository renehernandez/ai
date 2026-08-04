# AX Command Routing

| Need | AI repository | Managed shim |
| --- | --- | --- |
| Initialize/switch profile | `pnpm ax sync --profile <name>` | `ax sync --profile <name>` |
| All runtime surfaces | `pnpm ax sync` | `ax sync` |
| Skills | `pnpm ax skills sync` | `ax skills sync` |
| Instructions/rules | `pnpm ax instructions sync` | `ax instructions sync` |
| Hooks | `pnpm ax hooks sync` | `ax hooks sync` |
| Managed configs | `pnpm ax configs sync` | `ax configs sync` |
| Repo-local OpenSpec | `pnpm ax openspec sync` | `ax openspec sync` |
| Read-only state | `pnpm ax status` / `validate` | `ax status` / `validate` |

Run the matching scoped `status` or `validate` where available. Top-level sync
validates the full candidate before success.

## Managed configs

Use `configs status`, `configs sync`, and `configs validate`. Ownership is the
exact TOML leaves declared under `runtime.configs`; parent tables are grouping
only. Validation includes the Codex config loader. Preserve unowned values and
never hand-edit a managed config leaf.

## OpenSpec

Run `openspec status` first. Missing/context-required state needs
`--context-file <path>` in headless use. Configured state may use
`--review-config` plus `--accept-config-changes` only with authorization. Finish
with `openspec validate`; AX resolves the upstream executable from PATH.

## Isolated proof

```bash
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> status
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> sync
HOME=<isolated-home> pnpm ax --runtime-root <isolated-runtime-root> validate
```

If synchronization is interrupted, rerun the same sync; the transaction engine
owns restoration and disposable source cache handling.
