#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const tsxLoader = pathToFileURL(
  join(sourceRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;
const runtimeScript = join(sourceRoot, "scripts", "agent-runtime.ts");

const result = spawnSync(
  process.execPath,
  ["--import", tsxLoader, runtimeScript, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AGENT_RUNTIME_EXECUTABLE_PATH: process.argv[1] ?? "",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
