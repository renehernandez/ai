import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "smol-toml";
import { launchPackages } from "../../hooks/pi/launch.ts";

const config = JSON.parse(readFileSync("ax.config.json", "utf8"));
const globalTools = config.runtime.configs.mise.managed.tools;
const repoMise = parse(readFileSync("mise.toml", "utf8"));
const repoTools = repoMise.tools as Record<string, string>;

test("global and repository mise pins agree on Node and pnpm", () => {
  assert.equal(globalTools.node, repoTools.node);
  assert.equal(globalTools.pnpm, repoTools.pnpm);
  assert.equal(
    JSON.parse(readFileSync("package.json", "utf8")).packageManager,
    `pnpm@${globalTools.pnpm}`,
  );
});

test("GH_TOKEN stays empty without a resolvable per-clone gh account", () => {
  const template = (repoMise.env as Record<string, string>).GH_TOKEN;
  const command = template.match(/exec\(command='(.+)'\)/)?.[1];
  assert.ok(command, "GH_TOKEN must come from exec()");
  assert.match(
    command,
    /git config --get credential\.https:\/\/github\.com\.username/,
  );

  // Hooks export GIT_* variables that would point git at this repository, and
  // an inherited GH_TOKEN would make gh ignore --user.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GH_TOKEN: "inherited-token",
    GITHUB_TOKEN: "inherited-token",
  });

  const run = (username?: string) => {
    const dir = mkdtempSync(join(tmpdir(), "gh-account-"));
    try {
      execFileSync("git", ["init", "--quiet", dir], { env });
      if (username) {
        execFileSync(
          "git",
          [
            "config",
            "--file",
            join(dir, ".git", "config"),
            "credential.https://github.com.username",
            username,
          ],
          { env },
        );
      }
      return execFileSync("sh", ["-c", command], {
        cwd: dir,
        encoding: "utf8",
        env,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  // Compare without echoing output, which could be a real token.
  assert.ok(run() === "", "unset account yields an empty GH_TOKEN");
  assert.ok(
    run("no-such-gh-account-for-test") === "",
    "unknown account yields an empty GH_TOKEN",
  );
});

test("Pi package pre-download covers the managed bridge and MCP adapter", () => {
  const settingsPackage = config.runtime.configs.pi.managedPaths.find(
    (entry: { path: string[] }) => entry.path.join(".") === "packages",
  ).value;
  assert.ok(launchPackages.includes(settingsPackage));
  assert.ok(
    launchPackages.some((pkg) => pkg.startsWith("npm:pi-mcp-adapter@")),
  );
});
