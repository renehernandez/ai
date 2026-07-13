#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { analyzeObjectiveProof } from "./lib/objective-proof.ts";

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
  unit_id?: string;
  unit_title?: string;
  kind: "deliverable" | "manual" | "needs_spec_redesign";
  shape_reason?: string;
};

export type OpenSpecWorkItem = OpenSpecTask & {
  unit_id: string;
  unit_title: string;
};

export type OpenSpecDeliveryUnit = {
  id: string;
  title: string;
  heading: string;
  line: number;
  checked: boolean;
  kind: OpenSpecTask["kind"];
  shape_reason?: string;
  justification?: string;
  sizing: {
    work_item_count: number;
    status: "target" | "split_smell" | "blocked";
  };
  merge_smell: {
    status: "ok" | "needs_justification";
  };
  work_items: OpenSpecWorkItem[];
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

  const markdown = readFileSync(path, "utf8");
  const deliveryUnits = parseDeliveryUnits(markdown);
  const tasks = flattenDeliveryUnits(deliveryUnits);
  if (command === "parse") {
    console.log(
      JSON.stringify({ delivery_units: deliveryUnits, tasks }, null, 2),
    );
    return;
  }

  auditTasks(deliveryUnits);
}

export function parseTasks(markdown: string): OpenSpecTask[] {
  return flattenDeliveryUnits(parseDeliveryUnits(markdown));
}

export function parseDeliveryUnits(markdown: string): OpenSpecDeliveryUnit[] {
  const units: OpenSpecDeliveryUnit[] = [];
  let heading = "";
  let currentUnit: OpenSpecDeliveryUnit | undefined;
  let currentTask: OpenSpecWorkItem | undefined;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      heading = headingMatch[1].trim();
      currentUnit = deliveryUnitFromHeading(heading, index + 1);
      units.push(currentUnit);
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
    currentUnit ??= syntheticDeliveryUnit(taskMatch[2], heading, index + 1);
    if (!units.includes(currentUnit)) {
      units.push(currentUnit);
    }
    currentTask = {
      id: taskMatch[2],
      title,
      text: title,
      checked: taskMatch[1].toLowerCase() === "x",
      line: index + 1,
      heading,
      unit_id: currentUnit.id,
      unit_title: currentUnit.title,
      kind: shape.kind,
      shape_reason: shape.reason,
    };
    currentUnit.work_items.push(currentTask);
  });

  return units.map(finalizeDeliveryUnit);
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
  return validateDeliveryUnits(groupTasksAsDeliveryUnits(tasks), options);
}

export function validateDeliveryUnits(
  units: OpenSpecDeliveryUnit[],
  options: { requireObjectiveProof?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const tasks = flattenDeliveryUnits(units);
  const seenUnitIds = new Set<string>();
  const seenIds = new Set<string>();

  if (tasks.length === 0) {
    errors.push("tasks.md must include OpenSpec checkbox tasks");
    return errors;
  }

  for (const unit of units) {
    if (seenUnitIds.has(unit.id)) {
      errors.push(`duplicate delivery unit id: ${unit.id}`);
    }
    seenUnitIds.add(unit.id);

    if (!unit.heading) {
      errors.push(`delivery unit ${unit.id} must have a numbered heading`);
    }

    if (unit.work_items.length === 0) {
      errors.push(`delivery unit ${unit.id} must include work items`);
    }

    if (unit.kind === "deliverable" && unit.sizing.status === "blocked") {
      errors.push(
        `delivery_unit_size_blocked: delivery unit ${unit.id} has ${unit.sizing.work_item_count} deliverable work items; more than 8 is a readiness blocker`,
      );
    }

    if (
      unit.kind === "deliverable" &&
      unit.sizing.status === "split_smell" &&
      !unit.justification
    ) {
      errors.push(
        `delivery_unit_split_smell: delivery unit ${unit.id} has ${unit.sizing.work_item_count} deliverable work items; more than 6 and at most 8 requires a Justification: note`,
      );
    }

    if (
      unit.kind === "deliverable" &&
      unit.merge_smell.status === "needs_justification"
    ) {
      errors.push(
        `delivery_unit_merge_smell: delivery unit ${unit.id} has one deliverable work item; one-item units require a Justification: note naming risk, deployment, or reviewability`,
      );
    }
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

export function firstUncheckedDeliveryUnit(
  units: OpenSpecDeliveryUnit[],
): OpenSpecDeliveryUnit | undefined {
  return units.find((unit) =>
    unit.work_items.some(
      (workItem) => !workItem.checked && workItem.kind === "deliverable",
    ),
  );
}

function auditTasks(units: OpenSpecDeliveryUnit[]): void {
  const tasks = flattenDeliveryUnits(units);
  const errors = validateDeliveryUnits(units, { requireObjectiveProof: true });
  const nextTask = firstUncheckedDeliverable(tasks);
  const nextUnit = firstUncheckedDeliveryUnit(units);

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
          delivery_units: units,
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
        delivery_units: units,
        next_delivery_unit: nextUnit ?? null,
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

function deliveryUnitFromHeading(
  heading: string,
  line: number,
): OpenSpecDeliveryUnit {
  const match = heading.match(/^([0-9]+(?:\.[0-9]+)*)\.?\s*(.*)$/);
  const id = match?.[1] ?? heading.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const title = (match?.[2] ?? heading).trim() || heading;
  return {
    id,
    title,
    heading,
    line,
    checked: false,
    kind: "deliverable",
    work_items: [],
    sizing: {
      work_item_count: 0,
      status: "target",
    },
    merge_smell: {
      status: "ok",
    },
  };
}

function syntheticDeliveryUnit(
  taskId: string,
  heading: string,
  line: number,
): OpenSpecDeliveryUnit {
  const [unitId] = taskId.split(".");
  return {
    id: unitId,
    title: heading || `Legacy unit ${unitId}`,
    heading,
    line,
    checked: false,
    kind: "deliverable",
    work_items: [],
    sizing: {
      work_item_count: 0,
      status: "target",
    },
    merge_smell: {
      status: "ok",
    },
  };
}

function finalizeDeliveryUnit(
  unit: OpenSpecDeliveryUnit,
): OpenSpecDeliveryUnit {
  const invalidWorkItem = unit.work_items.find(
    (workItem) => workItem.kind === "needs_spec_redesign",
  );
  const deliverableItems = unit.work_items.filter(
    (workItem) => workItem.kind === "deliverable",
  );
  const manualItems = unit.work_items.filter(
    (workItem) => workItem.kind === "manual",
  );
  const justification = extractJustification(unit);
  const sizing = deliveryUnitSizing(unit.work_items);
  const mergeSmell = deliveryUnitMergeSmell(unit.work_items, justification);

  if (invalidWorkItem) {
    return {
      ...unit,
      checked: false,
      kind: "needs_spec_redesign",
      shape_reason: invalidWorkItem.shape_reason,
      justification,
      sizing,
      merge_smell: mergeSmell,
    };
  }

  if (deliverableItems.length === 0 && manualItems.length > 0) {
    return {
      ...unit,
      checked: manualItems.every((workItem) => workItem.checked),
      kind: "manual",
      justification,
      sizing,
      merge_smell: mergeSmell,
    };
  }

  return {
    ...unit,
    checked:
      deliverableItems.length > 0 &&
      deliverableItems.every((workItem) => workItem.checked),
    kind: "deliverable",
    justification,
    sizing,
    merge_smell: mergeSmell,
  };
}

function flattenDeliveryUnits(
  units: OpenSpecDeliveryUnit[],
): OpenSpecWorkItem[] {
  return units.flatMap((unit) => unit.work_items);
}

function groupTasksAsDeliveryUnits(
  tasks: OpenSpecTask[],
): OpenSpecDeliveryUnit[] {
  const units = new Map<string, OpenSpecDeliveryUnit>();
  for (const task of tasks) {
    const unitId = task.unit_id ?? task.id.split(".")[0];
    const unit = units.get(unitId) ?? {
      id: unitId,
      title: task.unit_title ?? task.heading,
      heading: task.heading,
      line: task.line,
      checked: false,
      kind: "deliverable" as const,
      sizing: {
        work_item_count: 0,
        status: "target" as const,
      },
      merge_smell: {
        status: "ok" as const,
      },
      work_items: [],
    };
    unit.work_items.push({
      ...task,
      unit_id: unitId,
      unit_title: task.unit_title ?? task.heading,
    });
    units.set(unitId, unit);
  }

  return Array.from(units.values()).map(finalizeDeliveryUnit);
}

function deliveryUnitSizing(workItems: OpenSpecWorkItem[]): {
  work_item_count: number;
  status: "target" | "split_smell" | "blocked";
} {
  const workItemCount = workItems.filter(
    (workItem) => workItem.kind === "deliverable",
  ).length;
  if (workItemCount > 8) {
    return { work_item_count: workItemCount, status: "blocked" };
  }
  if (workItemCount > 6) {
    return { work_item_count: workItemCount, status: "split_smell" };
  }
  return { work_item_count: workItemCount, status: "target" };
}

function extractJustification(unit: OpenSpecDeliveryUnit): string | undefined {
  const lines = [
    unit.heading,
    ...unit.work_items.flatMap((workItem) => workItem.text.split("\n")),
  ];
  const startIndex = lines.findIndex((line) =>
    /\bJustification:\s*(.*)$/i.test(line),
  );
  if (startIndex === -1) {
    return undefined;
  }

  const firstLine =
    lines[startIndex].match(/\bJustification:\s*(.*)$/i)?.[1].trim() ?? "";
  const continuationLines: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (line.length === 0) {
      continue;
    }
    if (/^-?\s*[A-Z][A-Za-z ]+:\s*/.test(line)) {
      break;
    }
    continuationLines.push(line);
  }
  const text = [firstLine, ...continuationLines].join(" ").trim();
  return text || undefined;
}

function deliveryUnitMergeSmell(
  workItems: OpenSpecWorkItem[],
  justification: string | undefined,
): { status: "ok" | "needs_justification" } {
  const deliverableCount = workItems.filter(
    (workItem) => workItem.kind === "deliverable",
  ).length;
  if (deliverableCount !== 1) {
    return { status: "ok" };
  }
  if (
    justification &&
    /\b(risk|deploy(?:ment)?|reviewab(?:le|ility))\b/i.test(justification)
  ) {
    return { status: "ok" };
  }
  return { status: "needs_justification" };
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
