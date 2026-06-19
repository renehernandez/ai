## 1. Command Surface

- [x] 1.1 Add `openspec` as an `agent-runtime` scope with `install`, `update`, `validate`, and `status` subcommands.
- [ ] 1.2 Add OpenSpec runtime config defaults and declare them in `agent-runtime.config.json`.
- [ ] 1.3 Add OpenSpec CLI availability detection with missing-CLI guidance that includes `npm install -g @fission-ai/openspec@latest`.
- [ ] 1.4 Add command parsing tests for the new `openspec` scope and subcommands.

## 2. Generation and Normalization

- [ ] 2.1 Implement `openspec install` by invoking `openspec init . --tools codex,claude`.
- [ ] 2.2 Implement `openspec update` by invoking `openspec update .` for initialized repos and falling back to install behavior when scaffolding is absent.
- [ ] 2.3 Normalize generated `openspec-*` skill directories into `.agents/skills` and replace `.codex/skills` and `.claude/skills` generated copies with relative symlinks.
- [ ] 2.4 Normalize generated Claude `opsx` command files into `.agents/commands/opsx` and replace `.claude/commands/opsx` generated copies with relative symlinks.
- [ ] 2.5 Add fixture-backed integration tests using a temporary repo and stub `openspec` executable.

## 3. Validation, Status, and Documentation

- [ ] 3.1 Implement `openspec validate` checks for missing canonical assets, duplicated generated directories or files, and wrong symlink targets.
- [ ] 3.2 Implement `openspec status` output for CLI path and version, OpenSpec scaffolding presence, canonical `.agents` assets, and harness symlink state.
- [ ] 3.3 Update documentation to explain repo-local OpenSpec assets, `.agents` canonical paths, harness symlinks, and why OpenSpec skills are not global shared skills.
- [ ] 3.4 Run `pnpm test:unit`, `pnpm test:integration`, `pnpm biome:check:all`, `pnpm agent-runtime openspec status`, and `pnpm agent-runtime openspec validate`.
