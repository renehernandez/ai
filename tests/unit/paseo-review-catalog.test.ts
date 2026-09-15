import assert from "node:assert/strict";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { loadReviewCatalog } from "../../skills/handoff-brief/scripts/paseo-workflow-state.ts";
import {
  finalImplementationReviewerCatalog,
  planningReviewerCatalog,
  reviewerCatalog,
} from "../../skills/review/scripts/review-contract.ts";

test("handoff obtains canonical lens definitions through the Review CLI subprocess", async () => {
  const catalog = await loadReviewCatalog();
  assert.deepEqual(
    catalog.planning,
    planningReviewerCatalog.map((id) => ({ id, ...reviewerCatalog[id] })),
  );
  assert.deepEqual(
    catalog.implementation,
    finalImplementationReviewerCatalog.map((id) => ({
      id,
      ...reviewerCatalog[id],
    })),
  );
});

test("missing Review skill reports the required CLI dependency clearly", async (context) => {
  const temporary = await mkdtemp(join(tmpdir(), "missing-review-skill-"));
  context.after(() => rm(temporary, { recursive: true }));
  const stateModule = join(temporary, "paseo-workflow-state.ts");
  await copyFile(
    new URL(
      "../../skills/handoff-brief/scripts/paseo-workflow-state.ts",
      import.meta.url,
    ),
    stateModule,
  );
  const isolated = await import(pathToFileURL(stateModule).href);
  await assert.rejects(
    isolated.loadReviewCatalog(),
    /Required Review skill catalog CLI is unavailable or failed/,
  );
});
