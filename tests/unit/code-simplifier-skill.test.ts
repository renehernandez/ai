// charter-contracts: simplification-review
import assert from "node:assert/strict";
import test from "node:test";

import { read } from "../../scripts/charter-validator-reader.ts";

const skill = read("skills/code-simplifier/SKILL.md").replace(/\s+/g, " ");

test("RED simplification-review: strengthens the prior naming and migration boundaries", () => {
  const contract = read("skills/code-simplifier/SKILL.md");

  assert.doesNotMatch(
    contract,
    /made unnecessary by clearer names(?:(?!shorter\s+word\s+is\s+not\s+simpler)[\s\S])*keep useful boundaries/i,
  );
  assert.doesNotMatch(
    contract,
    /## Implementation Lens(?:(?!existed\s+only\s+earlier\s+on\s+the\s+current\s+unshipped\s+branch)[\s\S])*keep useful boundaries/i,
  );
});

test("GREEN simplification-review: challenges redundant concepts and derived state", () => {
  const contract = read("skills/code-simplifier/SKILL.md");

  assert.match(contract, /one term per concept and one concept per term/i);
  assert.match(
    contract,
    /context is already supplied by the\s+module or owning type/i,
  );
  assert.match(
    contract,
    /passed or stored separately when canonical inputs can derive/i,
  );
  assert.match(contract, /overlapping types, constants, helpers, or state/i);
});

test("code-simplifier removes only proven unshipped compatibility", () => {
  assert.match(skill, /existed only earlier on the current unshipped branch/i);
  assert.match(skill, /target base/i);
  assert.match(skill, /external consumers/i);
  assert.match(skill, /accepted contract/i);
});

test("code-simplifier rejects branch-history overfitting without policing style", () => {
  assert.match(skill, /reader without the branch or conversation history/i);
  assert.match(skill, /repository's canonical vocabulary/i);
  assert.match(
    skill,
    /shorter word is not simpler when it loses domain precision/i,
  );
  assert.match(skill, /deslop.*verbosity.*local-style/i);
  assert.match(skill, /code-quality-review.*ownership.*architecture/i);
});

test("code-simplifier findings prove the surviving invariant and consumers", () => {
  assert.match(skill, /surviving source of truth/i);
  assert.match(skill, /redundant representation or compatibility path/i);
  assert.match(skill, /producers and consumers inspected/i);
  assert.match(skill, /reachable success and failure behavior/i);
});
