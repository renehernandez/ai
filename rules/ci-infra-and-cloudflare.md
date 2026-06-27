# CI, Infrastructure, and Cloudflare Rules

These rules cover test coverage, GitLab CI, Docker image policy, Cloudflare, Terraform, and sandbox behavior.

## Test Coverage

- Never exclude files from test coverage to work around low coverage thresholds.
- If coverage is below threshold, write tests to increase coverage instead.
- Always ask the user before excluding any file from coverage reporting.

## GitLab CI: Container Images

- Never use upstream public images such as `node:22-alpine`, `alpine:3.21`, or `ubuntu:24.04` in CI job `image:` fields.
- Always use internal Fullscript images from `images.fullscript.io/devops/ci-images/`.
- To find the right image and tag, check the `devops/ci-images` group on `git.fullscript.io`.
- When unsure which image or tag to use, ask the user before proceeding.

## Docker and Image SHAs

- Never suggest or introduce SHA-based pinning in Dockerfiles or image references.
- This ban covers per-tool SHA256 checksum verification such as `echo "$SHA  file" | sha256sum -c -`.
- This ban also covers base image digest pinning such as `FROM image@sha256:...`.
- Always pin by version tag, such as `FROM cloudflare/sandbox:0.9.3` or `ARG TOOL_VERSION=1.2.3`.
- Tag-based pinning is the Fullscript convention across projects.
- If a reviewer flags "pin by SHA" for reproducibility or supply-chain integrity, dismiss it because it conflicts with the org-wide convention.
- Bump tools by updating the version tag only. Do not add companion SHA256 args.

## GitLab CI: Environment Teardown

- When a CI job depends on artifacts from another job, such as credentials via dotenv, avoid making the `on_stop` job depend on artifacts from the main pipeline.
- Those artifacts may expire before the environment is stopped.
- Instead, use a child pipeline pattern.
- Make the `on_stop` trigger job launch a child pipeline that contains both the credential-fetching job and the teardown job.
- This ensures fresh credentials are fetched at teardown time, regardless of how long ago the last pipeline ran.

## GitLab CI: Inline Scripts

- Never hardcode multi-line shell scripts in `.gitlab-ci.yml` job `script:` blocks.
- Extract logic into a dedicated script file, such as `scripts/ci/<name>.ts`, and invoke it with a single `pnpm tsx` call.
- Short single-line commands such as `corepack enable`, `pnpm install`, and `echo "..."` are fine inline.
- Keep CI configuration declarative and scripts testable.

## CI and Local Hook Naming

- Do not name CI jobs, package scripts that back CI, or pre-commit hook entries with generic `check` terminology such as `check`, `cli:check`, `validation:check`, or `*:check`.
- Use names that state the behavior being enforced: `lint`, `format`, `typecheck`, `unit-test`, `integration-test`, `e2e-test`, `build`, `deploy`, `teardown`, `schema-validate`, or `drift-validate`.
- If a tool's native command uses `check`, such as `biome check` or `git diff --check`, keep the native command invocation but wrap it in a purpose-specific job, hook, or script name.
- If one automation intentionally runs multiple enforcement categories, split it when practical. Otherwise name it as an explicit gate such as `pre-commit-verification` instead of hiding it behind `check`.

## Cloudflare Resources

- Always use `wrangler` CLI via the `/wrangler` skill when interacting with Cloudflare Workers, KV, R2, D1, Durable Objects, Queues, logs, tailing, or deployments.
- Load the `/wrangler` skill at the start of any session touching Workers, Workers infrastructure, `wrangler.jsonc`, `wrangler.toml`, or CF Access apps bound to Workers.
- Prefer `wrangler` subcommands over writing direct REST clients against `api.cloudflare.com`.
- Stop and check for a corresponding `wrangler <resource> <verb>` command before drafting any direct API call for Cloudflare resources.
- Examples include `wrangler kv namespace list`, `wrangler r2 bucket create`, `wrangler d1 execute`, `wrangler secret put`, `wrangler deployments view`, and `wrangler rollback`.
- Never use `curl` to interact with the Cloudflare API directly.
- When a CI script manages Cloudflare resources, shell out to `wrangler` through the project package manager, such as `pnpm exec wrangler`.
- This reuses wrangler auth from `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` and preserves wrangler output formats.
- When multiple Cloudflare accounts are available, set `CLOUDFLARE_ACCOUNT_ID` to avoid interactive prompts.

## Deploying Workers with Secrets

- When CI/CD deploys a Worker that requires secrets, ship code and secrets in the same `wrangler deploy` invocation using `--secrets-file <path>`.
- Do not run `wrangler deploy` followed by `wrangler secret bulk` or `wrangler secret put` as separate steps.
- Every `secret put` and `secret bulk` creates a new Worker version and deploys it immediately.
- Separating deploy and secrets can create a race window where the Worker is live but missing secrets.
- `--secrets-file` accepts the same JSON and `.env` formats as `wrangler secret bulk`.
- Secrets not present in the file are preserved from the previous version.
- In CI, write secrets to a gitignored transient file, set permissions to `0600`, pass it via `--secrets-file`, and delete it immediately after deploy.
- Manual secret rotation outside deploy is still fine with `wrangler secret put` or `wrangler versions secret put` on an already-deployed Worker.

## CF Access JWT Validation in Workers

- When a Worker sits behind Cloudflare Access, validate the JWT from `Cf-Access-Jwt-Assertion`.
- Do not validate the client's `Authorization: Bearer` token for CF Access origin authentication.
- At Fullscript, inbound bearer tokens are often WARP-device-bound and signed with a key that is not published in the JWKS.
- Origin-side verification against `/cdn-cgi/access/certs` can fail for that WARP-device-trust path.
- Use a maintained JWT library with remote JWKS support.
- Pin the algorithm explicitly.
- Pin a non-zero clock tolerance.
- Fail closed on JWKS fetch failures.
- Do not fall back to stale keys.
- Sanitize errors returned to the client.
- To diagnose `Invalid or expired token`, decode the JWT payload. If it has `warp_as_auth: true` and `device_id`, and the `kid` appears in `/cdn-cgi/access/certs` but RS256 verification still fails, switch to reading `Cf-Access-Jwt-Assertion`.

## Terraform

- Always ask for explicit user confirmation before running `terraform apply`.
- Running `terraform plan` is allowed without confirmation.
- Never use `-auto-approve` without explicit user permission.

## AI Sandbox Mode

- When running inside a Cloudflare sandbox through `rxp sandbox run`, assume read-only AWS credentials from the `devops-sandbox` SSO profile.
- Freely run read-only `aws`, `kubectl`, and `terraform` commands.
- Write operations will fail with `AccessDenied`; ask the user to escalate when write access is needed.
- Auto-commit and auto-push to feature branches only when the user is the sole committer and the current policy allows commits.
- Never push to `main` or `master`.
