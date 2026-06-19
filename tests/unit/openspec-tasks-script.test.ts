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
- [ ] 1.2 Validate the delivery handoff
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
