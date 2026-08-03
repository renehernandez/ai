// charter-contracts: complete-explanations
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { read } from "../../scripts/charter-validator-reader.ts";

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

test("RED complete-explanations: claim-level confidence repetition is removed", () => {
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
  assert.match(
    confidence,
    /one annotation.*coherent conclusion or recommendation block/is,
  );
  assert.match(
    confidence,
    /separate annotations.*materially different.*(?:evidence|uncertainty)/is,
  );
  assert.match(confidence, /each candidate root cause.*own conclusion block/is);
  assert.match(confidence, /do not repeat.*after each sentence/i);
  assert.doesNotMatch(
    confidence,
    /Show confidence on every actionable statement/,
  );

  for (const entrypoint of ["AGENTS.md", "instructions/AGENTS.md"]) {
    assert.match(read(entrypoint), /rules\/communication\.md/);
  }
});

test("GREEN complete-explanations: first-pass answers supply the causal chain", () => {
  const communication = read("rules/communication.md");

  assert.match(communication, /answer the exact question/i);
  assert.match(
    communication,
    /state the (?:causal or structural )?mechanism.*makes.*true/is,
  );
  assert.match(communication, /example or contrast.*when.*helps/is);
  assert.match(
    communication,
    /relevant (?:boundary|limitation).*practical consequence/is,
  );
  assert.match(
    communication,
    /prefer two or three.*sentences.*missing explanatory link/is,
  );
  assert.match(
    communication,
    /semantic responsibilities.*not.*fixed.*(?:template|headings)/is,
  );
});

test("clarification repairs the mental model without forcing ceremony", () => {
  const communication = read("rules/communication.md");

  assert.match(communication, /why\?.*how\?.*what do you mean\?.*incomplete/is);
  assert.match(
    communication,
    /one (?:more concrete|lower)\s+abstraction level.*instead of paraphrasing/is,
  );
  assert.match(
    communication,
    /do not introduce.*abstraction.*current question/is,
  );
  assert.match(communication, /define.*unfamiliar term.*first use/is);
  assert.match(
    communication,
    /name both entities.*concrete relationship.*material/is,
  );
  assert.match(
    communication,
    /do not rely on.*(?:vague pronoun|spatial metaphor).*beneath\s+it/is,
  );
  assert.match(
    communication,
    /acknowledgments.*status-only updates.*self-explanatory/is,
  );
  assert.match(
    communication,
    /machine-readable contracts.*exact provider templates/is,
  );
  assert.match(
    communication,
    /boundary is relevant only if.*omission.*misstate.*direct answer/is,
  );
  assert.match(
    communication,
    /do not add adjacent caveats.*unsolicited (?:architecture|design) advice/is,
  );
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
  assert.match(communication, /full\s+explanation.*user requests/is);
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
