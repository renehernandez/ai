import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("runtime profiles install one shared communication rule", () => {
  assert.equal(existsSync("rules/communication.md"), true);

  const config = JSON.parse(read("ax.config.json")) as {
    profiles: Record<string, { paths: Array<string | { sourcePath: string }> }>;
  };

  for (const profile of ["personal", "work"]) {
    assert.equal(
      config.profiles[profile]?.paths.includes("rules/communication.md"),
      true,
      `${profile} does not install rules/communication.md`,
    );
  }
});

test("shared instructions define concise conversation without weakening confidence", () => {
  const communication = read("rules/communication.md");
  const confidence = read("rules/confidence.md");

  assert.match(
    communication,
    /lead with the (?:result|outcome), decision, or blocker/i,
  );
  assert.match(communication, /one point (?:in each|per) sentence/i);
  assert.match(communication, /material new (?:state|information)/i);
  assert.match(communication, /omit empty sections/i);
  assert.match(communication, /do not restate the request/i);
  assert.match(communication, /filler.*formulaic contrast/i);
  assert.match(communication, /required evidence/i);
  assert.match(communication, /confidence/i);
  assert.match(confidence, /Show confidence on every actionable statement/);

  for (const entrypoint of ["AGENTS.md", "instructions/AGENTS.md"]) {
    assert.match(read(entrypoint), /rules\/communication\.md/);
  }
});

test("durable prose uses reader need instead of fixed document ceremony", () => {
  const communication = read("rules/communication.md");
  const docs = read("rules/docs-and-specs.md");

  assert.match(communication, /durable (?:document|prose)/i);
  assert.match(communication, /correctness.*safety.*uncertainty/is);
  assert.match(communication, /no arbitrary .*limit/i);
  assert.match(docs, /(?:rules\/)?communication\.md/);
  assert.match(docs, /execution diar/i);
});

test("shared communication preserves focus and cross-turn continuity", () => {
  const communication = read("rules/communication.md");

  assert.match(communication, /keep the active outcome visible/i);
  assert.match(communication, /independent ready work.*serial narrative/is);
  assert.match(communication, /preserve every explicitly requested outcome/i);
  assert.match(communication, /park only out-of-scope tangents/i);
  assert.match(
    communication,
    /assign the next action to the actor who owns it/i,
  );
  assert.match(
    communication,
    /continue routine authorized.*agent-owned work/is,
  );
  assert.match(communication, /cross-turn state needed to resume/i);
  assert.match(communication, /ask one material question at a time/i);
  assert.match(communication, /state the low-risk default/i);
  assert.match(communication, /show concrete progress/i);
  assert.match(communication, /full explanation.*user requests/is);
  assert.match(communication, /safety.*authority.*evidence.*required format/is);
});

test("brainstorming has a compact route for narrow requests", () => {
  const skill = read("skills/brainstorming/SKILL.md");

  assert.match(skill, /quick|narrow/i);
  assert.match(skill, /answer.*reason.*next decision/is);
  assert.match(skill, /do not\s+use the\s+orientation map/i);
  assert.match(skill, /domain terms.*only when/i);
});

test("doc smith can write a bounded operational note without guide ceremony", () => {
  const skill = read("skills/doc-smith/SKILL.md");

  assert.match(skill, /compact (?:note|document) path/i);
  assert.match(skill, /audience.*outcome.*source.*(?:known|clear)/is);
  assert.match(skill, /do not require.*frontmatter/is);
  assert.match(skill, /do not require.*See Also/is);
  assert.match(skill, /do not ask.*question/is);
  assert.match(skill, /reader tests have one trigger/i);
  assert.match(skill, /acceptance or a material comprehension risk/i);
  assert.match(
    skill,
    /enclosing Execute owner retains its\s+existing commit authority/i,
  );
});
