import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

test("planning gate command rejects a handoff without lifecycle identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "planning-review-gate-"));
  const inputPath = join(directory, "checkpoint.json");
  writeFileSync(
    inputPath,
    JSON.stringify({
      checkpoint: {},
      expected: {
        artifact: ".agents/plans/example.md",
        artifactFingerprint: "sha256:plan-a",
      },
    }),
  );

  try {
    const result = spawnSync(
      "pnpm",
      ["exec", "tsx", "scripts/validate-planning-review.ts", inputPath],
      { cwd: join(root, "skills/review"), encoding: "utf8" },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /planning_review_lifecycle_unresolved/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
