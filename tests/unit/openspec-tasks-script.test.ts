import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function withTasks(content: string, callback: (path: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "openspec-tasks-script-"));
  const path = join(directory, "tasks.md");
  try {
    writeFileSync(path, content, "utf8");
    callback(path);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function runOpenSpecTasks(
  command: string,
  content: string,
): { status: number | null; stderr: string; stdout: string } {
  let result: ReturnType<typeof spawnSync> | undefined;
  withTasks(content, (path) => {
    result = spawnSync(
      "pnpm",
      [
        "exec",
        "tsx",
        "skills/openspec-tasks/scripts/openspec-tasks.ts",
        command,
        path,
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
      },
    );
  });

  assert.ok(result);
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

const validTasks = `# Tasks

## 1. Core delivery

- [x] 1.1 Add the delivery detector
  - Proof location: run the delivery detector CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Implement the delivery handoff validator
- [ ] 1.3 Manual production verification after merge

## 2. Follow-up

- [ ] 2.1 Update the adapter prompt
  - Justification: reviewability improves because the prompt update can be reviewed independently from the core delivery code.
`;

test("parse extracts OpenSpec checkbox tasks in document order", () => {
  const result = runOpenSpecTasks("parse", validTasks);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.tasks.length, 4);
  assert.deepEqual(
    parsed.tasks.map((task: { id: string }) => task.id),
    ["1.1", "1.2", "1.3", "2.1"],
  );
  assert.equal(parsed.tasks[2].kind, "manual");
});

test("audit reports the first unchecked deliverable task", () => {
  const result = runOpenSpecTasks("audit", validTasks);

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "pass");
  assert.equal(parsed.next_deliverable.id, "1.2");
  assert.equal(parsed.manual_pending.length, 1);
});

test("audit reports the first unchecked delivery unit with nested work items", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Contract Shape

- [x] 1.1 Define delivery-unit headings
  - Proof location: run the task-shape validator CLI entrypoint and observe pass or failure output.
- [x] 1.2 Update plan-ready guidance

## 2. Readiness Gates

- [ ] 2.1 Add nested work-item parsing
- [ ] 2.2 Add sizing checks
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.delivery_units.length, 2);
  assert.equal(parsed.delivery_units[0].checked, true);
  assert.equal(parsed.delivery_units[1].checked, false);
  assert.equal(parsed.next_delivery_unit.id, "2");
  assert.deepEqual(
    parsed.next_delivery_unit.work_items.map((item: { id: string }) => item.id),
    ["2.1", "2.2"],
  );
  assert.equal(parsed.next_deliverable.id, "2.1");
});

test("audit accepts justified delivery units with seven or eight work items", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Readiness Gates

- [ ] 1.1 Add parser model
  - Proof location: run the task-shape validator CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
- [ ] 1.7 Add compatibility output
  - Justification: these changes update one shared parser contract and splitting them would create temporary incompatible output shapes.
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.delivery_units[0].sizing.work_item_count, 7);
  assert.equal(parsed.delivery_units[0].sizing.status, "split_smell");
  assert.match(
    parsed.delivery_units[0].justification,
    /one shared parser contract/,
  );
});

test("audit reports delivery-unit sizing boundary statuses", () => {
  const sixItemResult = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Target Boundary

- [ ] 1.1 Add parser model
  - Proof location: run the task-shape validator CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
`,
  );
  const eightItemResult = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Split Boundary

- [ ] 1.1 Add parser model
  - Proof location: run the task-shape validator CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
- [ ] 1.7 Add compatibility output
- [ ] 1.8 Add migration fixtures
  - Justification: these changes update one shared parser contract and splitting them would create temporary incompatible output shapes.
`,
  );

  assert.equal(sixItemResult.status, 0);
  assert.equal(eightItemResult.status, 0);
  const sixItemParsed = JSON.parse(sixItemResult.stdout);
  const eightItemParsed = JSON.parse(eightItemResult.stdout);

  assert.equal(sixItemParsed.delivery_units[0].sizing.work_item_count, 6);
  assert.equal(sixItemParsed.delivery_units[0].sizing.status, "target");
  assert.equal(eightItemParsed.delivery_units[0].sizing.work_item_count, 8);
  assert.equal(eightItemParsed.delivery_units[0].sizing.status, "split_smell");
});

test("audit rejects split-smell delivery units without justification", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Readiness Gates

- [ ] 1.1 Add parser model
  - Proof location: run the task-shape validator CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
- [ ] 1.7 Add compatibility output
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_split_smell/);
  assert.match(result.stderr, /requires a Justification:/);
});

test("audit blocks delivery units with more than eight work items", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Readiness Gates

- [ ] 1.1 Add parser model
  - Proof location: run the task-shape validator CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
- [ ] 1.7 Add compatibility output
- [ ] 1.8 Add downstream adapters
- [ ] 1.9 Add migration fixtures
  - Justification: this is still too broad.
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_size_blocked/);
  assert.match(result.stderr, /more than 8 is a readiness blocker/);
});

test("audit accepts one-item units with reviewability justification", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Focused Migration

- [ ] 1.1 Add migration shim
  - Proof location: run the migration validator CLI entrypoint and observe pass or failure output.
  - Justification: reviewability improves because this compatibility shim has a narrow owner boundary.
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.delivery_units[0].merge_smell.status, "ok");
});

test("audit accepts wrapped justification continuations", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Focused Migration

- [ ] 1.1 Add migration shim
  - Justification: this compatibility shim stays separate because
    reviewability improves when the narrow owner boundary is isolated.
  - Proof location: run the migration validator CLI entrypoint and observe pass or failure output.
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.delivery_units[0].merge_smell.status, "ok");
  assert.match(
    parsed.delivery_units[0].justification,
    /reviewability improves/,
  );
});

test("audit rejects one-item units without risk deployment or reviewability justification", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Focused Migration

- [ ] 1.1 Add migration shim
  - Proof location: run the migration validator CLI entrypoint and observe pass or failure output.
  - Justification: this is convenient to split out.
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /delivery_unit_merge_smell/);
  assert.match(result.stderr, /risk, deployment, or reviewability/);
});

test("audit covers the delivery-unit shape fixture matrix", () => {
  const cases = [
    {
      name: "valid breakdown",
      shouldPass: true,
      markdown: `# Tasks

## 1. Parser Contract

- [ ] 1.1 Add unit parser
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add unit serializer
`,
    },
    {
      name: "oversized unit",
      shouldPass: false,
      stderr: /delivery_unit_size_blocked/,
      markdown: `# Tasks

## 1. Parser Contract

- [ ] 1.1 Add parser model
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
- [ ] 1.7 Add compatibility output
- [ ] 1.8 Add downstream adapters
- [ ] 1.9 Add migration fixtures
`,
    },
    {
      name: "unjustified tiny unit",
      shouldPass: false,
      stderr: /delivery_unit_merge_smell/,
      markdown: `# Tasks

## 1. Parser Contract

- [ ] 1.1 Add parser model
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
`,
    },
    {
      name: "phase justification parsing",
      shouldPass: true,
      markdown: `# Tasks

## 1. Parser Contract

- [ ] 1.1 Add parser model
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add nested parsing
- [ ] 1.3 Add completion semantics
- [ ] 1.4 Add sizing metadata
- [ ] 1.5 Add split-smell validation
- [ ] 1.6 Add blocker validation
- [ ] 1.7 Add compatibility output
  - Justification: reviewability stays acceptable because this updates one shared parser contract.
`,
    },
    {
      name: "lifecycle-only group",
      shouldPass: false,
      stderr: /lifecycle_phase_group/,
      markdown: `# Tasks

## 1. Documentation

- [ ] 1.1 Update docs
  - Proof location: run the docs validator CLI entrypoint and observe pass or failure output.
`,
    },
    {
      name: "workflow machinery exception",
      shouldPass: true,
      markdown: `# Tasks

## 1. Workflow Machinery

- [ ] 1.1 Implement reusable AI workflow machinery fixtures
  - Proof location: run the workflow fixture CLI entrypoint and observe pass or failure output.
  - Justification: reviewability improves because workflow fixture behavior is isolated.
`,
    },
  ];

  for (const testCase of cases) {
    const result = runOpenSpecTasks("audit", testCase.markdown);
    if (testCase.shouldPass) {
      assert.equal(result.status, 0, testCase.name);
    } else {
      assert.notEqual(result.status, 0, testCase.name);
      assert.match(result.stderr, testCase.stderr ?? /Invalid openspec_tasks/);
    }
  }
});

test("audit covers the legacy flat-task migration matrix", () => {
  const validFlatTasks = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Legacy Delivery

- [ ] 1.1 Add parser support
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
- [ ] 1.2 Add serializer support
`,
  );
  assert.equal(validFlatTasks.status, 0);

  const validFlatParsed = JSON.parse(validFlatTasks.stdout);
  assert.equal(validFlatParsed.next_delivery_unit.id, "1");
  assert.equal(validFlatParsed.next_deliverable.id, "1.1");

  const hiddenOutcomes = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Legacy Delivery

- [ ] 1.1 Implement parser and delivery and PR workflow
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
`,
  );
  assert.notEqual(hiddenOutcomes.status, 0);
  assert.match(hiddenOutcomes.stderr, /appears too broad/);

  const mixedFlatAndUnit = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Legacy Delivery

- [x] 1.1 Add parser support
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
- [x] 1.2 Add serializer support

## 2. Focused Migration

- [ ] 2.1 Add migration shim
  - Justification: reviewability improves because the shim is isolated.
`,
  );
  assert.equal(mixedFlatAndUnit.status, 0);

  const mixedParsed = JSON.parse(mixedFlatAndUnit.stdout);
  assert.equal(mixedParsed.next_delivery_unit.id, "2");
  assert.equal(mixedParsed.next_deliverable.id, "2.1");

  const staleLegacyArtifact = runOpenSpecTasks(
    "audit",
    `# Tasks

- [ ] 1.1 Add parser support
  - Proof location: run the parser contract CLI entrypoint and observe pass or failure output.
`,
  );
  assert.notEqual(staleLegacyArtifact.status, 0);
  assert.match(staleLegacyArtifact.stderr, /must be under a numbered heading/);
});

test("audit rejects broad deliverable tasks", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Implement parser and delivery and PR workflow
  - Proof location: run the parser CLI entrypoint and observe pass or failure output.
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /task 1.1 appears too broad/);
});

test("audit rejects empty tasks files", () => {
  const result = runOpenSpecTasks("audit", "# Tasks\n");

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tasks.md must include OpenSpec checkbox tasks/);
});

test("parse classifies invalid lifecycle and proof-only task shapes", () => {
  const result = runOpenSpecTasks(
    "parse",
    `# Tasks

## 1. Implementation

- [ ] 1.1 Implement the parser with unit tests
- [ ] 1.2 Run tests and lint
- [ ] 1.3 Manually verify validation output

## 2. Documentation

- [ ] 2.1 Update user-facing docs

## 3. Validation Tooling

- [ ] 3.1 Implement validation command fixtures
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);
  type ParsedTask = {
    id: string;
    kind: string;
    shape_reason?: string;
  };
  const byId = new Map(parsed.tasks.map((task: ParsedTask) => [task.id, task]));

  assert.equal(byId.get("1.1").kind, "deliverable");
  assert.equal(byId.get("1.2").kind, "needs_spec_redesign");
  assert.equal(byId.get("1.2").shape_reason, "proof_only_task");
  assert.equal(byId.get("1.3").kind, "needs_spec_redesign");
  assert.equal(byId.get("2.1").kind, "needs_spec_redesign");
  assert.equal(byId.get("2.1").shape_reason, "lifecycle_phase_group");
  assert.equal(byId.get("3.1").kind, "deliverable");
});

test("audit returns needs_spec_redesign for lifecycle-only task shapes", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser

## 2. Code Review

- [ ] 2.1 Review the generated spec
`,
  );

  assert.notEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "needs_spec_redesign");
  assert.equal(parsed.next_action, "return_to_plan");
  assert.equal(parsed.invalid_tasks[0].id, "2.1");
  assert.equal(parsed.invalid_tasks[0].reason, "lifecycle_phase_group");
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /lifecycle_phase_group/);
});

test("audit accepts feature exceptions for workflow machinery", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Documentation Feature

- [ ] 1.1 Build documentation generator
  - Proof location: run the documentation generator CLI entrypoint and observe generated output.
  - Justification: reviewability improves because the generator has a narrow user-facing contract.

## 2. Testing Tooling

- [ ] 2.1 Implement testing harness fixtures
  - Justification: reviewability improves because the harness fixture API is isolated.

## 3. Validation Tooling

- [ ] 3.1 Implement validation command fixtures
  - Justification: reviewability improves because the command fixture behavior is isolated.

## 4. CI Tooling

- [ ] 4.1 Add CI workflow status parser
  - Justification: deployment risk is lower when CI parser changes are reviewed separately.

## 5. Reviewer Tooling

- [ ] 5.1 Add reviewer-tooling prompt selector
  - Justification: reviewability improves because reviewer routing can be inspected in one focused diff.

## 6. Runtime Validation Tooling

- [ ] 6.1 Add runtime-validation-tooling command
  - Justification: deployment risk is lower when runtime validation behavior is reviewed separately.

## 7. Workflow Machinery

- [ ] 7.1 Implement reusable AI workflow machinery fixtures
  - Justification: reviewability improves because workflow fixture behavior is isolated.
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.next_deliverable.id, "1.1");
});

test("audit rejects manual-looking validation evidence tasks", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser
- [ ] 1.2 Manual validation evidence
`,
  );

  assert.notEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "needs_spec_redesign");
  assert.equal(parsed.invalid_tasks[0].reason, "proof_only_task");
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /proof_only_task/);
});

test("audit emits structured invalid output for non-redesign task errors", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

- [ ] 1.1 Implement parser and delivery and PR workflow
  - Proof location: run the parser CLI entrypoint and observe pass or failure output.
`,
  );

  assert.notEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "invalid");
  assert.equal(parsed.next_action, "fix_tasks");
  assert.deepEqual(parsed.invalid_tasks, []);
  assert.match(result.stderr, /task 1\.1 must be under a numbered heading/);
});

test("audit rejects common lifecycle heading variants", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser

## 2. Documentation Updates

- [ ] 2.1 Update user-facing docs

## 3. Validation Evidence

- [ ] 3.1 Capture CI proof

## 4. Update Documentation

- [ ] 4.1 Update user-facing docs
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /task 2\.1 is lifecycle_phase_group/);
  assert.match(result.stderr, /task 3\.1 is lifecycle_phase_group/);
  assert.match(result.stderr, /task 4\.1 is lifecycle_phase_group/);
});

test("audit lets lifecycle groups override manual task classification", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser

## 2. Validation

- [ ] 2.1 Manual production verification after merge
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /needs_spec_redesign/);
  assert.match(result.stderr, /lifecycle_phase_group/);
});

test("audit keeps production verification as manual work", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [x] 1.1 Implement the parser
  - Proof location: run the parser CLI entrypoint and observe pass or failure output.
  - Justification: deployment risk is lower when parser behavior is paired with manual production verification.
- [ ] 1.2 Manual production verification
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.next_deliverable, null);
  assert.equal(parsed.manual_pending[0].id, "1.2");
});

test("audit accepts objective proof in the first deliverable", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Implement target verification
  - Proof location: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact.
- [ ] 1.2 Add cleanup handling
`,
  );

  assert.equal(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "pass");
});

test("audit recognizes explicit HTTP paths as real objective-proof entrypoints", () => {
  for (const entrypoint of [
    "GET /llms.txt",
    "POST /api/v1/users",
    "GET /~user",
  ]) {
    const result = runOpenSpecTasks(
      "audit",
      `# Tasks

## 1. Delivery

- [ ] 1.1 Deliver protected publishing
  - Proof location: ${entrypoint} returns visible success or reports the failure boundary.
- [ ] 1.2 Add cleanup handling
`,
    );

    assert.equal(result.status, 0, entrypoint);
    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.status, "pass", entrypoint);
  }
});

test("audit rejects a bare HTTP root as an objective-proof entrypoint", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Deliver protected publishing
  - Proof location: GET / returns visible success or reports the failure boundary.
- [ ] 1.2 Add cleanup handling
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /real entrypoint and visible success or failure evidence/,
  );
});

test("audit accepts one groundwork delivery unit before objective proof", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Extract target registration

- [ ] 1.1 Register target metadata
- [ ] 1.2 Preserve existing target behavior

## 2. Deliver target verification

- [ ] 2.1 Add hw-admin verification path
  - First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact.
- [ ] 2.2 Add cleanup handling
`,
  );

  assert.equal(result.status, 0);
});

test("audit accepts two groundwork delivery units before objective proof", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Simplify target ownership

- [ ] 1.1 Extract the canonical target owner
- [ ] 1.2 Preserve current target behavior

## 2. Establish target contracts

- [ ] 2.1 Add the target result contract
- [ ] 2.2 Preserve existing consumer behavior

## 3. Deliver target verification

- [ ] 3.1 Add the hosted verification path
  - First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact.
- [ ] 3.2 Add cleanup handling
`,
  );

  assert.equal(result.status, 0);
});

test("audit accepts unit 3 proof that names its current task", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Simplify target ownership

- [ ] 1.1 Extract the canonical target owner
- [ ] 1.2 Preserve current target behavior

## 2. Establish target contracts

- [ ] 2.1 Add the target result contract
- [ ] 2.2 Preserve existing consumer behavior

## 3. Deliver target verification

- [ ] 3.1 Add the hosted verification path
  - First real confirmation: run the task 3 hosted workflow entrypoint and observe success or failure evidence in the summary artifact.
- [ ] 3.2 Add cleanup handling
`,
  );

  assert.equal(result.status, 0);
});

test("audit rejects a proof marker that points to a later unit", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Prepare target verification

- [ ] 1.1 Add target metadata
  - First real confirmation: task 3 will run the hosted workflow entrypoint and report success or failure output.
- [ ] 1.2 Preserve current target behavior
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /defers proof/);
});

test("audit rejects objective proof after delivery unit 3", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Simplify target ownership

- [ ] 1.1 Register target metadata
- [ ] 1.2 Preserve current behavior

## 2. Establish target contracts

- [ ] 2.1 Generate target probes
- [ ] 2.2 Preserve current consumers

## 3. Add target routing

- [ ] 3.1 Route target requests
- [ ] 3.2 Preserve fallback behavior

## 4. Deliver target verification

- [ ] 4.1 Add hw-admin verification path
  - First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact.
- [ ] 4.2 Add cleanup handling
`,
  );

  assert.notEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "needs_spec_redesign");
  assert.match(
    result.stderr,
    /objective proof first appears in delivery unit 4/,
  );
});

test("audit rejects nested work items that impersonate final MRs", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. One-Prompt Publishing

- [ ] 1.1 Deliver root-to-live publishing. Final MR 1; targets main.
  - Proof location: run the stat publish CLI entrypoint and observe success or failure output.
- [ ] 1.2 Harden artifact publication. Final MR 2; targets the task 1.1 branch.
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nested_final_change_mapping/);
  assert.match(result.stderr, /top-level delivery unit/);
});

test("audit permits non-topology references to a final MR", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Preserve review-only behavior

- [ ] 1.1 Keep the rehearsal review-only and do not publish a final MR
  - Proof location: run the rehearsal workflow entrypoint and observe success or failure output.
- [ ] 1.2 Preserve cleanup behavior
`,
  );

  assert.equal(result.status, 0);
});

test("audit permits ordinary maps-to-review prose", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Preserve review-only behavior

- [ ] 1.1 Keep the rehearsal review-only; this step maps to a PR review cycle
  - Proof location: run the rehearsal workflow entrypoint and observe success or failure output.
- [ ] 1.2 Preserve cleanup behavior
`,
  );

  assert.equal(result.status, 0);
});

test("audit rejects explicit unnumbered final MR mappings", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Preserve review-only behavior

- [ ] 1.1 Keep the rehearsal review-only; this work item maps to a final MR.
  - Proof location: run the rehearsal workflow entrypoint and observe success or failure output.
- [ ] 1.2 Preserve cleanup behavior
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nested_final_change_mapping/);
});

test("audit rejects missing and marker-only objective proof", () => {
  const missing = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Register target metadata
- [ ] 1.2 Generate target probes
`,
  );
  const markerOnly = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Add target result path
  - Proof location: target readiness is documented.
`,
  );

  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /objective proof must be explicit/);
  assert.notEqual(markerOnly.status, 0);
  assert.match(
    markerOnly.stderr,
    /real entrypoint and visible success or failure evidence/,
  );
});
