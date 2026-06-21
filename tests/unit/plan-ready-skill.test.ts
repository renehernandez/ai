import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const skill = readFileSync(
  join(process.cwd(), "skills/plan-ready/SKILL.md"),
  "utf8",
);

test("plan-ready skill carries complex runtime blueprint boundary guidance", () => {
  assert.match(skill, /Runtime And Platform Blueprints/);
  assert.match(skill, /first deployable runtime\s+proof/);
  assert.match(skill, /service plus optional environment tuple/);
  assert.match(skill, /public ingress/);
  assert.match(skill, /auth or write policy/);
  assert.match(skill, /migration proof/);
  assert.match(skill, /review or runtime data cleanup/);
});
