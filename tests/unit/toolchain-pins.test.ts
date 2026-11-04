import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "smol-toml";
import { launchPackages } from "../../hooks/pi/launch.ts";

const config = JSON.parse(readFileSync("ax.config.json", "utf8"));
const globalTools = config.runtime.configs.mise.managed.tools;
const repoTools = parse(readFileSync("mise.toml", "utf8")).tools as Record<
  string,
  string
>;

test("global and repository mise pins agree on Node and pnpm", () => {
  assert.equal(globalTools.node, repoTools.node);
  assert.equal(globalTools.pnpm, repoTools.pnpm);
  assert.equal(
    JSON.parse(readFileSync("package.json", "utf8")).packageManager,
    `pnpm@${globalTools.pnpm}`,
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
