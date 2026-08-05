import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectSkillCorpus } from "../../scripts/skill-corpus-report.ts";

test("reports ownership drift and misplaced evidence without enforcing budgets", () => {
  const root = mkdtempSync(join(tmpdir(), "skill-corpus-report-"));
  try {
    writeFileSync(
      join(root, "ax.config.json"),
      JSON.stringify({
        blocks: {
          local: {
            skills: [{ localPath: "skills", names: ["present", "missing"] }],
          },
        },
      }),
    );
    mkdirSync(join(root, "skills/present/references"), { recursive: true });
    writeFileSync(
      join(root, "skills/present/SKILL.md"),
      '# Present\n\n## Test Evidence\nold\n\n[bad](./references/nested/example.md "Nested")\n[fragment](references/example.md#details)\n[local](#section)\n',
    );
    writeFileSync(
      join(root, "skills/present/references/example.md"),
      "reference words\n",
    );

    const report = inspectSkillCorpus(root);
    assert.deepEqual(report.missingSkills, ["missing"]);
    assert.deepEqual(report.embeddedEvidence, [
      { skill: "present", heading: "Test Evidence" },
    ]);
    assert.deepEqual(report.progressiveDisclosureViolations, [
      { skill: "present", path: "references/nested/example.md" },
    ]);
    assert.equal(report.referenceFiles, 1);
    assert.ok(report.runtimeWords > 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
