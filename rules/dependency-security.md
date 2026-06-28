# Dependency Security Rules

These rules apply before suggesting, approving, or performing dependency changes.

## Mandatory Dependency Change Gate

Validate the current security posture before any dependency version change,
package addition, package removal, or package replacement.

This applies to:

- Direct dependency upgrades.
- Direct dependency additions or removals.
- Transitive dependency overrides.
- Framework or template upgrades.
- Replacing one package with another.
- Changing semver ranges.
- Changing lockfile-resolved versions.

## Package Manager Authority

Use the owning package manager CLI to mutate dependency manifests, workspace
dependency declarations, package-manager catalogs, and lockfiles. For example,
use `pnpm add`, `pnpm remove`, `pnpm update`, `npm install`, `npm uninstall`,
`yarn add`, `yarn remove`, `bun add`, or `bun remove`.

Do not manually edit dependency sections in `package.json`, package-manager
catalogs, workspace dependency declarations, or lockfiles to add, remove,
upgrade, or downgrade packages. Manual manifest, catalog, or lockfile edits are
not an acceptable substitute for the package manager resolving dependency state.

After the package manager writes the manifest and lockfile changes, inspect the
generated diff before proceeding.

## Required Checks

For every dependency change:

1. Identify the package name, current version, proposed version, and reason for the change.
2. Check for recent advisories, known compromises, malware, maintainer account takeovers, token leaks, or suspicious releases affecting the package or ecosystem.
3. Prefer primary sources when available: GitHub Security Advisories, project postmortems, npm provenance/package pages, vendor docs, and official changelogs.
4. Inspect the lockfile diff for unexpected new packages, lifecycle scripts, git dependencies, tarball URL changes, or surprising package-family additions.
5. Avoid `latest`, broad ranges, and unpinned prereleases for security-sensitive packages.
6. Run the relevant verification commands after the dependency change.

## Recent Attack Awareness

If the ecosystem has had a recent supply chain incident, explicitly compare the proposed version against affected and patched version ranges before proceeding.

For TanStack packages specifically:

- Do not use `latest`.
- Pin exact versions.
- Check the TanStack security advisory and postmortem before upgrading.
- Search for known indicators of compromise when relevant:
  - `@tanstack/setup`
  - `router_init.js`
  - `github:tanstack/router#79ac49eedf774dd4b0cfa308722bc463cfe5885c`

## Blocking Conditions

Stop and ask for direction before proceeding if:

- The package has an unresolved active compromise.
- The proposed version is in an affected range.
- The package introduces unexpected install scripts.
- The lockfile adds unexplained packages from unfamiliar scopes.
- The dependency change requires disabling verification or bypassing hooks.

## Expected Response Shape

When proposing or making a dependency change, include:

- Current version.
- Target version or removal state.
- Security posture summary.
- Advisory or attack checks performed.
- Verification commands run.

Keep this concise, but do not omit the security review.
