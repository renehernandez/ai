import assert from "node:assert/strict";
import test from "node:test";
import { validateCharterFixture } from "../../scripts/charter-validate.ts";
import {
  hasBoundEvidence,
  scenarioSyntax,
} from "../../scripts/charter-validator-evidence.ts";

const root = process.cwd();

test("for-of assertions retain evidence from canonical source results", () => {
  const scenario = scenarioSyntax(
    `import assert from "node:assert/strict";
import { read } from "../../scripts/charter-validator-reader.ts";
test("RED authority: loop evidence", () => {
  const skill = read("skills/finish/SKILL.md");
  const rule = read("rules/investigation-and-implementation.md");
  for (const text of [skill, rule]) {
    assert.doesNotMatch(text, /automatic closure/);
  }
});`,
    "RED authority:",
  );

  assert.ok(scenario);
  assert.equal(
    hasBoundEvidence(scenario, {
      source: {
        binding: {
          allowedModules: [
            "node:assert/strict",
            "node:test",
            "../../scripts/charter-validator-reader.ts",
          ],
          forbidDynamicModuleAccess: true,
          kind: "import",
          module: "../../scripts/charter-validator-reader.ts",
          name: "read",
        },
        callee: /^read$/,
        text: /\(["'](?:rules|skills)\//,
      },
      assertion: { callee: /^assert\.doesNotMatch$/ },
    }),
    true,
  );
});

test("charter contract evidence cannot be supplied by comments", () => {
  const commentedEvidence =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: commented evidence", () => {\n// validateCharterFixture(root, fixture);\nassert.ok(true);\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": commentedEvidence,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("charter contract scenarios cannot be supplied by block comments", () => {
  const commentedScenario =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\n/*\ntest("RED charter-gate: commented scenario", () => {\nvalidateCharterFixture(root, fixture);\nassert.ok(true);\n});\n*/\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": commentedScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("charter contract evidence cannot be supplied by string literals", () => {
  const stringEvidence =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: string evidence", () => {\nconst fake = "validateCharterFixture(root, fixture)";\nassert.ok(fake);\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": stringEvidence,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("charter contract discovery preserves template literal syntax", () => {
  const templateLiteral =
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture must preserve literal template syntax
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\nimport { validateCharterFixture, validateCharterRepository } from "../../scripts/charter-validate.ts";\ntest("RED charter-gate: template syntax", () => {\nconst endpoint = `${scheme}://host`;\nconst errors = validateCharterFixture(root, fixture);\nassert.deepEqual(errors, ["scripts/charter-validate.ts: contract charter-gate requires staged executable RED and GREEN scenarios in tests/unit/agent-workflow-charter.test.ts"]);\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": templateLiteral,
    },
    true,
  );

  assert.ok(
    !errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("charter assertions must depend on the owning-path result", () => {
  const unboundEvidence =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: unbound calls", () => {\nvalidateCharterFixture(root, fixture);\nassert.ok(true);\n});\ntest("GREEN charter-gate: unbound calls", () => {\nvalidateCharterRepository(root);\nassert.deepEqual([], []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": unboundEvidence,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("charter evidence ignores owning calls in uninvoked functions", () => {
  const nestedEvidence =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: nested call", () => {\nconst neverCalled = () => validateCharterFixture(root, fixture);\nassert.ok(true);\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": nestedEvidence,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("value assertions do not invoke function-valued evidence", () => {
  const lazyEvidence =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: lazy call", () => {\nassert.ok(() => validateCharterFixture(root, fixture));\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": lazyEvidence,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("shadowed variables cannot inherit owning-path evidence", () => {
  const shadowedEvidence =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\ntest("RED charter-gate: shadowed result", () => {\nconst errors = validateCharterFixture(root, fixture);\n{\nconst errors = [];\nassert.ok(errors);\n}\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-contracts.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": shadowedEvidence,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("charter evidence must be reachable, canonical, and tested", () => {
  const scenario = (redBody: string) =>
    `// charter-contracts: charter-gate
import assert from "node:assert/strict";
import {
  validateCharterFixture,
  validateCharterRepository,
} from "../../scripts/charter-validate.ts";
test("RED charter-gate: adversarial binding", () => {
${redBody}
});
test("GREEN charter-gate: executable evidence", () => {
assert.deepEqual(validateCharterRepository(root), []);
});
`;
  const invalidBodies = [
    "if (false) {\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors);\n}",
    '{\nconst validateCharterFixture = () => ["fake"];\nconst errors = validateCharterFixture();\nassert.ok(errors);\n}',
    "const errors = validateCharterFixture(root, fixture);\nassert.ok(true, errors);",
    "return;\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors);",
    "try {\nreturn;\n} finally {}\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors);",
    "switch (0) {\ncase 1: {\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors);\nbreak;\n}\n}",
    "if (flag) {\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors);\n}",
    "for (const value of []) {\nconst errors = validateCharterFixture(root, fixture);\nassert.ok(errors && value);\n}",
    "for (; false; assert.ok(validateCharterFixture(root, fixture))) {}",
    "do { break; } while (assert.ok(validateCharterFixture(root, fixture)))",
    "for (const value of [...[]]) { assert.ok(validateCharterFixture(root, fixture) && value); }",
    "assert.ok((validateCharterFixture(root, fixture), true));",
    "try { assert.ok(validateCharterFixture(root, fixture)); } catch {}",
    "assert.ok(validateCharterFixture(root, fixture) || true);",
    "assert.ok(validateCharterFixture(root, fixture) ? true : true);",
    "assert.deepEqual(validateCharterFixture(root, fixture).length * 0, 0);",
    "let errors = validateCharterFixture(root, fixture); errors = []; assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); errors.length = 0; assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); Object.assign(errors, { length: 0 }); assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); (() => { errors.length = 0; })(); assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); const clear = () => { errors.length = 0; }; clear(); assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); (() => { errors.length = 0; }).call(null); assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); const box = [errors]; box[0].length = 0; assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); let alias; alias = errors; alias.length = 0; assert.deepEqual(errors, []);",
    "const errors = validateCharterFixture(root, fixture); assert.deepEqual(errors, errors);",
    "const errors = validateCharterFixture(root, fixture); assert.ok(errors.every(() => true));",
    "const errors = validateCharterFixture(root, fixture); assert.ok(errors.some(() => true));",
    'const errors = validateCharterFixture(root, fixture); Array.prototype.includes = () => true; assert.ok(errors.includes("contract charter-gate requires staged executable RED and GREEN scenarios"));',
    'assert.ok(validateCharterFixture(root, fixture).startsWith(""));',
    "const actual = validateCharterFixture(root, fixture); assert.deepEqual(actual, validateAgain(root, fixture));",
    "const assert = { ok: (_value: unknown) => undefined }; assert.ok(validateCharterFixture(root, fixture));",
    "assert.ok = (_value: unknown) => undefined; assert.ok(validateCharterFixture(root, fixture));",
    "const assertionAlias = assert; assertionAlias.ok = (_value: unknown) => undefined; assert.ok(validateCharterFixture(root, fixture));",
    'const errors = validateCharterFixture(root, fixture); assert.deepEqual(!errors, false, "contract charter-gate requires staged executable RED and GREEN scenarios");',
  ];

  for (const redBody of invalidBodies) {
    const errors = validateCharterFixture(
      root,
      {
        "scripts/charter-validator-contracts.ts":
          "canonical owner charter validation\n",
        "tests/unit/agent-workflow-charter.test.ts": scenario(redBody),
      },
      true,
    );

    assert.ok(
      errors.some((error) =>
        error.includes(
          "contract charter-gate requires staged executable RED and GREEN scenarios",
        ),
      ),
      redBody,
    );
  }
});

test("module-scope assertion mutation cannot supply charter evidence", () => {
  const mutatedAssertion =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\nimport { validateCharterFixture, validateCharterRepository } from "../../scripts/charter-validate.ts";\nassert.ok = (_value: unknown) => undefined;\ntest("RED charter-gate: patched assertion", () => {\nassert.ok(validateCharterFixture(root, fixture));\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-evidence.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": mutatedAssertion,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("sibling test assertion mutation cannot supply charter evidence", () => {
  const mutatedAssertion =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\nimport { validateCharterFixture, validateCharterRepository } from "../../scripts/charter-validate.ts";\ntest("setup assertion patch", () => {\nassert.ok = (_value: unknown) => undefined;\n});\ntest("RED charter-gate: patched assertion", () => {\nassert.ok(validateCharterFixture(root, fixture));\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-evidence.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": mutatedAssertion,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("alternate assertion imports cannot supply charter evidence", () => {
  const mutatedAssertion =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\nimport assertAlias from "node:assert/strict";\nimport { validateCharterFixture, validateCharterRepository } from "../../scripts/charter-validate.ts";\ntest("RED charter-gate: alternate assertion import", () => {\nassertAlias.ok = (_value: unknown) => undefined;\nassert.ok(validateCharterFixture(root, fixture));\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-evidence.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": mutatedAssertion,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("canonical charter imports cannot be reassigned", () => {
  const reassignedSource =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\nimport { validateCharterFixture, validateCharterRepository } from "../../scripts/charter-validate.ts";\nvalidateCharterFixture = () => ["scripts/charter-validate.ts: contract charter-gate requires staged executable RED and GREEN scenarios in tests/unit/agent-workflow-charter.test.ts"];\ntest("RED charter-gate: reassigned source", () => {\nassert.deepEqual(validateCharterFixture(root, fixture), ["scripts/charter-validate.ts: contract charter-gate requires staged executable RED and GREEN scenarios in tests/unit/agent-workflow-charter.test.ts"]);\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-evidence.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": reassignedSource,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("legacy assertion imports cannot supply charter evidence", () => {
  const mutatedAssertion =
    '// charter-contracts: charter-gate\nimport assert from "node:assert/strict";\nimport legacyAssert from "node:assert";\nimport { validateCharterFixture, validateCharterRepository } from "../../scripts/charter-validate.ts";\ntest("RED charter-gate: legacy assertion import", () => {\nlegacyAssert.strict.ok = (_value: unknown) => undefined;\nassert.ok(validateCharterFixture(root, fixture));\n});\ntest("GREEN charter-gate: executable evidence", () => {\nassert.deepEqual(validateCharterRepository(root), []);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "scripts/charter-validator-evidence.ts":
        "canonical owner charter validation\n",
      "tests/unit/agent-workflow-charter.test.ts": mutatedAssertion,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract charter-gate requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("local Nitro runners cannot replace the canonical owner", () => {
  const fakeNitroScenario =
    '// charter-contracts: nitro-raw-evidence\nimport assert from "node:assert/strict";\nimport test from "node:test";\nfunction runNitroGate(_command: string, content: string) { return { status: 0, stderr: "", stdout: content }; }\ntest("RED nitro-raw-evidence: local runner", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "blocked"\').stdout, /"gate_outcome": "blocked"/);\n});\ntest("GREEN nitro-raw-evidence: local runner", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "passed"\').stdout, /"gate_outcome": "passed"/);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "skills/nitro-review-feedback/scripts/nitro-feedback-gate.ts":
        "canonical owner Nitro validation\n",
      "tests/unit/nitro-feedback-gate-script.test.ts": fakeNitroScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract nitro-raw-evidence requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("Nitro evidence cannot import producer-mutation facilities", () => {
  const fakeNitroScenario =
    '// charter-contracts: nitro-raw-evidence\nimport assert from "node:assert/strict";\nimport childProcess from "node:child_process";\nimport { syncBuiltinESMExports } from "node:module";\nimport { runNitroGate } from "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts";\n(childProcess as any).spawnSync = () => ({ status: 0, stderr: "", stdout: \'"gate_outcome": "passed"\' });\nsyncBuiltinESMExports();\ntest("RED nitro-raw-evidence: replaced producer", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "blocked"\').stdout, /"gate_outcome": "blocked"/);\n});\ntest("GREEN nitro-raw-evidence: replaced producer", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "passed"\').stdout, /"gate_outcome": "passed"/);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts":
        "canonical owner Nitro validation\n",
      "tests/unit/nitro-feedback-gate-script.test.ts": fakeNitroScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract nitro-raw-evidence requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("Nitro evidence cannot load producer modules dynamically", () => {
  const fakeNitroScenario =
    '// charter-contracts: nitro-raw-evidence\nimport assert from "node:assert/strict";\nimport test from "node:test";\nimport { runNitroGate } from "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts";\nprocess.getBuiltinModule("node:child_process");\ntest("RED nitro-raw-evidence: dynamic producer", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "blocked"\').stdout, /"gate_outcome": "blocked"/);\n});\ntest("GREEN nitro-raw-evidence: dynamic producer", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "passed"\').stdout, /"gate_outcome": "passed"/);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts":
        "canonical owner Nitro validation\n",
      "tests/unit/nitro-feedback-gate-script.test.ts": fakeNitroScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract nitro-raw-evidence requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("canonical Nitro runner imports cannot be reassigned", () => {
  const fakeNitroScenario =
    '// charter-contracts: nitro-raw-evidence\nimport assert from "node:assert/strict";\nimport test from "node:test";\nimport { runNitroGate } from "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts";\nrunNitroGate = (_command: string, content: string) => ({ status: 0, stderr: "", stdout: content });\ntest("RED nitro-raw-evidence: reassigned runner", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "blocked"\').stdout, /"gate_outcome": "blocked"/);\n});\ntest("GREEN nitro-raw-evidence: reassigned runner", () => {\nassert.match(runNitroGate("validate-gitlab-evidence", \'"gate_outcome": "passed"\').stdout, /"gate_outcome": "passed"/);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts":
        "canonical owner Nitro validation\n",
      "tests/unit/nitro-feedback-gate-script.test.ts": fakeNitroScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract nitro-raw-evidence requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("local rule readers cannot replace the canonical repository reader", () => {
  const localReaderScenario =
    '// charter-contracts: lifecycle-authority\nimport assert from "node:assert/strict";\nfunction read(_path: string) { return "explicit authority"; }\ntest("RED authority: local reader", () => {\nassert.doesNotMatch(read("rules/fake.md"), /automatic close/);\n});\ntest("GREEN authority: local reader", () => {\nassert.match(read("rules/fake.md"), /explicit authority/);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "rules/docs-and-specs.md": "canonical owner lifecycle policy\n",
      "tests/unit/agent-workflow-lifecycle.test.ts": localReaderScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract lifecycle-authority requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});

test("rule evidence cannot import repository-reader mutation facilities", () => {
  const mutatedReaderScenario =
    '// charter-contracts: lifecycle-authority\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\nimport { syncBuiltinESMExports } from "node:module";\nimport test from "node:test";\nimport { read } from "../../scripts/charter-validator-reader.ts";\n(fs as any).readFileSync = () => "explicit authority";\nsyncBuiltinESMExports();\ntest("RED authority: mutated reader", () => {\nassert.doesNotMatch(read("rules/fake.md"), /automatic close/);\n});\ntest("GREEN authority: mutated reader", () => {\nassert.match(read("rules/fake.md"), /explicit authority/);\n});\n';
  const errors = validateCharterFixture(
    root,
    {
      "rules/docs-and-specs.md": "canonical owner lifecycle policy\n",
      "tests/unit/agent-workflow-lifecycle.test.ts": mutatedReaderScenario,
    },
    true,
  );

  assert.ok(
    errors.some((error) =>
      error.includes(
        "contract lifecycle-authority requires staged executable RED and GREEN scenarios",
      ),
    ),
  );
});
