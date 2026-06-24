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
  assert.equal(parsed.next_action, "ask_user_for_redesign_direction");
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

## 2. Testing Tooling

- [ ] 2.1 Implement testing harness fixtures

## 3. Validation Tooling

- [ ] 3.1 Implement validation command fixtures

## 4. CI Tooling

- [ ] 4.1 Add CI workflow status parser

## 5. Reviewer Tooling

- [ ] 5.1 Add reviewer-tooling prompt selector

## 6. Runtime Validation Tooling

- [ ] 6.1 Add runtime-validation-tooling command

## 7. Workflow Machinery

- [ ] 7.1 Implement reusable AI workflow machinery fixtures
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

test("audit accepts one setup-only deliverable before objective proof", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Register target metadata
  - Target metadata is available to verification setup.
  - run pnpm test:unit
- [ ] 1.2 Add hw-admin verification path
  - First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact.
`,
  );

  assert.equal(result.status, 0);
});

test("audit rejects task 2 proof after a non-setup first task", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Implement blueprint validation
  - Valid blueprints pass validation.
- [ ] 1.2 Add CLI validation path
  - First real confirmation: run the plan-ready validate-blueprint CLI entrypoint and observe pass or failure output.
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /objective proof is allowed only when task 1\.1 is setup-only/,
  );
});

test("audit rejects deliverable-shaped tasks with objective proof at task 3", () => {
  const result = runOpenSpecTasks(
    "audit",
    `# Tasks

## 1. Delivery

- [ ] 1.1 Register target metadata
  - Target metadata is available to verification setup.
- [ ] 1.2 Generate target probes
  - Generated probe metadata is available for the target.
- [ ] 1.3 Add hw-admin verification path
  - First real confirmation: run the hosted verification workflow entrypoint against hw-admin and observe success or failure evidence in the summary artifact.
`,
  );

  assert.notEqual(result.status, 0);
  const parsed = JSON.parse(result.stdout);

  assert.equal(parsed.status, "needs_spec_redesign");
  assert.match(result.stderr, /objective proof first appears in task 1\.3/);
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
