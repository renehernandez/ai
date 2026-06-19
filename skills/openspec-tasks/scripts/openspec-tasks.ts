#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MANUAL_PATTERNS = [
  /\bmanual\b/i,
  /\bmonitor/i,
  /\bpost-?deployment\b/i,
  /\bpre-?deployment\b/i,
  /\bcreate .*ssm\b/i,
  /\bapprove\b/i,
  /\bverify .*production\b/i,
] as const;
const BROAD_PATTERNS = [
  /\bphase\b/i,
  /\bimplement .* and .* and\b/i,
  /\bend-to-end\b/i,
  /\ball\b/i,
  /\bmigrate .* and .* and\b/i,
] as const;

type Command = "parse" | "audit";

export type OpenSpecTask = {
  id: string;
  title: string;
  checked: boolean;
  line: number;
  heading: string;
  kind: "deliverable" | "manual";
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail("Usage: openspec-tasks.ts <parse|audit> <tasks.md>");
  }

  const path = args[0];
  if (!path) {
    fail(`${command} requires tasks.md path`);
  }

  const tasks = parseTasks(readFileSync(path, "utf8"));
  if (command === "parse") {
    console.log(JSON.stringify({ tasks }, null, 2));
    return;
  }

  auditTasks(tasks);
}

export function parseTasks(markdown: string): OpenSpecTask[] {
  const tasks: OpenSpecTask[] = [];
  let heading = "";

  markdown.split(/\r?\n/).forEach((line, index) => {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      return;
    }

    const taskMatch = line.match(
      /^- \[([ xX])\]\s+([0-9]+(?:\.[0-9]+)+)\s+(.+)$/,
    );
    if (!taskMatch) {
      return;
    }

    const title = taskMatch[3].trim();
    tasks.push({
      id: taskMatch[2],
      title,
      checked: taskMatch[1].toLowerCase() === "x",
      line: index + 1,
      heading,
      kind: isManualTask(`${heading} ${title}`) ? "manual" : "deliverable",
    });
  });

  return tasks;
}

export function validateTasks(tasks: OpenSpecTask[]): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  if (tasks.length === 0) {
    errors.push("tasks.md must include OpenSpec checkbox tasks");
    return errors;
  }

  for (const task of tasks) {
    if (seenIds.has(task.id)) {
      errors.push(`duplicate task id: ${task.id}`);
    }
    seenIds.add(task.id);

    if (!task.heading) {
      errors.push(`task ${task.id} must be under a numbered heading`);
    }

    if (task.kind === "deliverable" && isBroadTask(task.title)) {
      errors.push(
        `task ${task.id} appears too broad for one minor deliverable`,
      );
    }
  }

  return errors;
}

export function firstUncheckedDeliverable(
  tasks: OpenSpecTask[],
): OpenSpecTask | undefined {
  return tasks.find((task) => !task.checked && task.kind === "deliverable");
}

function auditTasks(tasks: OpenSpecTask[]): void {
  const errors = validateTasks(tasks);
  const nextTask = firstUncheckedDeliverable(tasks);

  if (errors.length > 0) {
    console.error(
      `Invalid openspec_tasks:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        status: "pass",
        next_deliverable: nextTask ?? null,
        manual_pending: tasks.filter(
          (task) => !task.checked && task.kind === "manual",
        ),
      },
      null,
      2,
    ),
  );
}

function isManualTask(text: string): boolean {
  return MANUAL_PATTERNS.some((pattern) => pattern.test(text));
}

function isBroadTask(text: string): boolean {
  return BROAD_PATTERNS.some((pattern) => pattern.test(text));
}

function isCommand(command: string | undefined): command is Command {
  return ["parse", "audit"].includes(command ?? "");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
