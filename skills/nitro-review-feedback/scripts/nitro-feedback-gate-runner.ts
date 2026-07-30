import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const gateScript =
  "skills/nitro-review-feedback/scripts/nitro-feedback-gate.ts";
const executeGate = spawnSync;

export function runNitroGate(
  command: string,
  content = "",
): SpawnSyncReturns<string> {
  const args = ["exec", "tsx", gateScript, command];
  if (!content) {
    return executeGate("pnpm", args, {
      cwd: process.cwd(),
      encoding: "utf8",
    });
  }

  const directory = mkdtempSync(join(tmpdir(), "nitro-feedback-gate-"));
  const path = join(directory, "input.yaml");
  try {
    writeFileSync(path, content, "utf8");
    return executeGate("pnpm", [...args, "--file", path], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}
