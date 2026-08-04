// charter-contracts: openspec-lifecycle-overlay
import assert from "node:assert/strict";
import test from "node:test";

import {
  archiveTransformViolations,
  lifecycleOverlayValid,
  normalizeLifecycleOverlay,
} from "../../scripts/ax/openspec-sync.ts";

const upstreamArchive = `# Archive

Proceed if user confirms
Archive without syncing
Don't block archive on warnings - just inform and confirm
`;

test("RED openspec-lifecycle-overlay: removes upstream archive bypasses", () => {
  const normalized = normalizeLifecycleOverlay(upstreamArchive, "archive.md");
  assert.doesNotMatch(
    normalized,
    /Proceed if user confirms|Archive without syncing|Don't block archive on warnings/,
  );
  assert.match(normalized, /\n {3}- STOP; incomplete work blocks archival\n/);
  assert.doesNotMatch(
    normalized,
    /\n- STOP; incomplete work blocks archival\n/,
  );
  assert.throws(
    () =>
      normalizeLifecycleOverlay(
        upstreamArchive.replace(
          "Proceed if user confirms",
          "Continue after approval",
        ),
        "archive.md",
      ),
    /openspec_overlay_drift:.*incomplete-work override applied 0 times/,
  );
  const reshaped = normalizeLifecycleOverlay(
    upstreamArchive.replace(
      "Proceed if user confirms",
      "Unexpected prefix: Proceed if user confirms despite incomplete work",
    ),
    "archive.md",
  );
  assert.doesNotMatch(reshaped, /Proceed if user confirms/);
  assert.match(reshaped, /STOP; incomplete work blocks archival/);
});

test("GREEN openspec-lifecycle-overlay: validates the owned authority overlay", () => {
  const normalized = normalizeLifecycleOverlay(upstreamArchive, "archive.md");
  assert.equal(lifecycleOverlayValid(normalized, "archive.md"), true);
  assert.equal(
    normalizeLifecycleOverlay(upstreamArchive, "openspec-bulk-archive-change"),
    upstreamArchive,
  );
  assert.deepEqual(archiveTransformViolations(normalized), []);
  const declaredBypass = `${normalized}\nArchive without syncing\n`;
  assert.deepEqual(archiveTransformViolations(declaredBypass), [
    "spec-sync bypass",
  ]);
  assert.equal(lifecycleOverlayValid(declaredBypass, "archive.md"), false);
});
