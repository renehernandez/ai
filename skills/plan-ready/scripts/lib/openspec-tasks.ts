#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { analyzeObjectiveProof } from "./objective-proof.ts";

const MANUAL_PATTERNS = [
  /\bmanual\b/i,
  /\bmonitor/i,
  /\bpost-?deployment\b/i,
  /\bpre-?deployment\b/i,
  /\bcreate .*ssm\b/i,
  /\bapprove\b/i,
  /\bverify .*production\b/i,
] as const;
const LIFECYCLE_PHASE_PATTERNS = [
  /\bdocs?\b/i,
  /\bdocumentation\b/i,
  /\blint(?:ing)?\b/i,
  /\btests?\b/i,
  /\btesting\b/i,
  /\breview\b/i,
  /\bvalidation\b/i,
  /\bverification\b/i,
] as const;
const LIFECYCLE_HEADING_WORDS = new Set([
  "doc",
  "docs",
  "documentation",
  "lint",
  "linting",
  "test",
  "tests",
  "testing",
  "review",
  "reviews",
  "validation",
  "verification",
]);
const LIFECYCLE_HEADING_CONNECTORS = new Set([
  "and",
  "code",
  "or",
  "peer",
  "final",
  "phase",
  "phases",
  "qa",
  "cleanup",
  "evidence",
  "notes",
  "proof",
  "update",
  "updates",
]);
const FEATURE_EXCEPTION_PATTERNS = [
  /\b(documentation|docs?)\b.*\b(feature|site|generator|tool(?:ing)?|system|surface|workflow|machinery)\b/i,
  /\b(test(?:ing)?|validation|verification)\b.*\b(feature|tool(?:ing)?|runner|harness|fixture|validator|classifier|script|command|surface|workflow|machinery)\b/i,
  /\bci\b.*\b(feature|job|workflow|pipeline|tool(?:ing)?|command|surface)\b/i,
  /\breviewer[- ]tooling\b/i,
  /\bruntime[- ]validation[- ]tooling\b/i,
  /\breusable ai workflow\b/i,
  /\bworkflow machinery\b/i,
] as const;
const PROOF_ONLY_PATTERNS = [
  /^\s*(run|rerun|execute)\s+(tests?|lint|validation|verification)\b/i,
  /^\s*(capture|collect|record)\s+(ci\s+)?(proof|evidence)\b/i,
  /^\s*(test|lint|validate|verify)\b/i,
  /\bmanual(?:ly)?\s+(test|lint|validate|verify)\b/i,
  /\bmanual(?:ly)?\s+(validation|verification)\s+(evidence|notes?|proof)\b/i,
  /\bconfirm\s+(tests?|lint|validation|verification)\b/i,
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
  text: string;
  checked: boolean;
  line: number;
  heading: string;
  kind: "deliverable" | "manual" | "needs_spec_redesign";
  shape_reason?: string;
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
  let currentTask: OpenSpecTask | undefined;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      currentTask = undefined;
      return;
    }

    const taskMatch = line.match(
      /^- \[([ xX])\]\s+([0-9]+(?:\.[0-9]+)+)\s+(.+)$/,
    );
    if (!taskMatch) {
      if (/^\s+/.test(line) && currentTask) {
        currentTask.text = `${currentTask.text}\n${line.trim()}`;
      }
      return;
    }

    const title = taskMatch[3].trim();
    const shape = classifyTaskShape(heading, title);
    currentTask = {
      id: taskMatch[2],
      title,
      text: title,
      checked: taskMatch[1].toLowerCase() === "x",
      line: index + 1,
      heading,
      kind: shape.kind,
      shape_reason: shape.reason,
    };
    tasks.push(currentTask);
  });

  return tasks;
}

export function classifyTaskShape(
  heading: string,
  title: string,
): { kind: OpenSpecTask["kind"]; reason?: string } {
  const headingText = heading.trim();
  const titleText = title.trim();
  const combined = `${headingText} ${titleText}`;

  if (isLifecycleOnlyGroup(headingText, combined)) {
    return {
      kind: "needs_spec_redesign",
      reason: "lifecycle_phase_group",
    };
  }

  if (isProofOnlyTask(titleText) && !isFeatureException(combined)) {
    return {
      kind: "needs_spec_redesign",
      reason: "proof_only_task",
    };
  }

  if (isManualTask(combined)) {
    return { kind: "manual" };
  }

  return { kind: "deliverable" };
}

export function validateTasks(
  tasks: OpenSpecTask[],
  options: { requireObjectiveProof?: boolean } = {},
): string[] {
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

    if (task.kind === "needs_spec_redesign") {
      errors.push(
        `needs_spec_redesign: task ${task.id} is ${task.shape_reason ?? "not a deliverable implementation unit"}`,
      );
    }
  }

  if (options.requireObjectiveProof) {
    const objectiveProof = analyzeObjectiveProof(
      tasks
        .filter((task) => task.kind === "deliverable")
        .map((task) => ({ id: task.id, text: task.text })),
    );
    if (objectiveProof.status === "needs_spec_redesign") {
      errors.push(...objectiveProof.issues.map((issue) => issue.message));
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
  const errors = validateTasks(tasks, { requireObjectiveProof: true });
  const nextTask = firstUncheckedDeliverable(tasks);

  if (errors.length > 0) {
    const invalidTasks = tasks
      .filter((task) => task.kind === "needs_spec_redesign")
      .map((task) => ({
        id: task.id,
        title: task.title,
        line: task.line,
        heading: task.heading,
        reason: task.shape_reason ?? "not a deliverable implementation unit",
      }));
    const hasRedesignError = errors.some((error) =>
      error.startsWith("needs_spec_redesign"),
    );
    const status =
      invalidTasks.length > 0 || hasRedesignError
        ? "needs_spec_redesign"
        : "invalid";
    console.log(
      JSON.stringify(
        {
          status,
          errors,
          invalid_tasks: invalidTasks,
          next_action:
            status === "needs_spec_redesign"
              ? "ask_user_for_redesign_direction"
              : "fix_tasks",
        },
        null,
        2,
      ),
    );
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

function isLifecycleOnlyGroup(heading: string, combined: string): boolean {
  if (!LIFECYCLE_PHASE_PATTERNS.some((pattern) => pattern.test(heading))) {
    return false;
  }

  if (isFeatureException(combined)) {
    return false;
  }

  const words = heading
    .toLowerCase()
    .replace(/^\d+(?:\.\d+)*\s*/, "")
    .match(/[a-z]+/g);
  if (!words || words.length === 0) {
    return false;
  }

  return words.every(
    (word) =>
      LIFECYCLE_HEADING_WORDS.has(word) ||
      LIFECYCLE_HEADING_CONNECTORS.has(word),
  );
}

function isFeatureException(text: string): boolean {
  return FEATURE_EXCEPTION_PATTERNS.some((pattern) => pattern.test(text));
}

function isProofOnlyTask(text: string): boolean {
  if (/\b(production|deployment|ssm|approve)\b/i.test(text)) {
    return false;
  }

  return PROOF_ONLY_PATTERNS.some((pattern) => pattern.test(text));
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
