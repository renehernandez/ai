import type {
  OpenSpecDeliveryUnit,
  OpenSpecWorkItem,
} from "./openspec-tasks.ts";
import { parseDeliveryUnits, validateDeliveryUnits } from "./openspec-tasks.ts";

export type UnitTaskDelta = {
  errors: string[];
  addedTask?: OpenSpecWorkItem;
};

export type DeliveryUnitDelta = {
  errors: string[];
  addedUnit?: OpenSpecDeliveryUnit;
  addedWorkItems: OpenSpecWorkItem[];
};

export type TaskArtifactEvidence = {
  taskId?: string;
  unitId?: string;
  artifact: string;
};

export function artifactHostHintFromRemoteText(
  remoteText: string,
): "gitlab" | "github" | null {
  const normalized = remoteText.toLowerCase();
  if (
    normalized.includes("gitlab") ||
    normalized.includes("git.fullscript.io")
  ) {
    return "gitlab";
  }
  if (normalized.includes("github")) {
    return "github";
  }
  return null;
}

export function isFullscriptGitLabMergeRequest(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === "git.fullscript.io" &&
      /\/-\/merge_requests\/\d+(?:\/)?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function fullscriptGitLabMergeRequestErrors(
  artifacts: Array<string | undefined>,
  message: string,
): string[] {
  return artifacts
    .filter((artifact): artifact is string => Boolean(artifact))
    .some((artifact) => !isFullscriptGitLabMergeRequest(artifact))
    ? [message]
    : [];
}

export function validateUnitTaskDelta(
  baseMarkdown: string,
  headMarkdown: string,
  expectedTaskId: string,
): UnitTaskDelta {
  const errors: string[] = [];
  const baseUnits = parseDeliveryUnits(baseMarkdown);
  const headUnits = parseDeliveryUnits(headMarkdown);
  const baseTasks = flattenDeliveryUnits(baseUnits);
  const headTasks = flattenDeliveryUnits(headUnits);

  errors.push(
    ...deliveryUnitShapeErrors(baseUnits, "base tasks.md"),
    ...deliveryUnitShapeErrors(headUnits, "head tasks.md"),
  );

  const baseById = new Map(baseTasks.map((task) => [task.id, task]));
  const headById = new Map(headTasks.map((task) => [task.id, task]));
  const expectedBaseTask = baseById.get(expectedTaskId);
  const expectedHeadTask = headById.get(expectedTaskId);

  if (!expectedBaseTask || !expectedHeadTask) {
    errors.push(
      `unit_task_delta_unexpected: expected task ${expectedTaskId} must exist in both base and head tasks.md`,
    );
  }

  for (const baseTask of baseTasks) {
    if (!headById.has(baseTask.id)) {
      errors.push(
        `unit_task_delta_invalid_tasks: task ${baseTask.id} missing from head tasks.md`,
      );
    }
  }

  for (const headTask of headTasks) {
    if (!baseById.has(headTask.id)) {
      errors.push(
        `unit_task_delta_invalid_tasks: task ${headTask.id} missing from base tasks.md`,
      );
    }
  }

  const newlyChecked = headTasks.filter((headTask) => {
    const baseTask = baseById.get(headTask.id);
    return baseTask && !baseTask.checked && headTask.checked;
  });
  const newlyCheckedDeliverables = newlyChecked.filter(
    (task) => task.kind === "deliverable",
  );
  const uncheckedPreviouslyChecked = baseTasks.filter((baseTask) => {
    const headTask = headById.get(baseTask.id);
    return baseTask.checked && headTask && !headTask.checked;
  });

  for (const task of uncheckedPreviouslyChecked) {
    errors.push(
      `unit_task_delta_invalid_tasks: task ${task.id} was unchecked relative to base`,
    );
  }

  if (expectedBaseTask?.checked && expectedHeadTask?.checked) {
    errors.push(
      `unit_task_delta_unexpected: expected task ${expectedTaskId} was already checked in base`,
    );
  } else if (expectedHeadTask && !expectedHeadTask.checked) {
    errors.push(
      `unit_task_delta_missing: expected task ${expectedTaskId} was not checked`,
    );
  }

  if (newlyCheckedDeliverables.length === 0) {
    errors.push(
      `unit_task_delta_missing: expected exactly task ${expectedTaskId} to be newly checked`,
    );
  } else if (newlyCheckedDeliverables.length > 1) {
    errors.push(
      `unit_task_delta_multiple: checked deliverable tasks ${newlyCheckedDeliverables.map((task) => task.id).join(", ")}`,
    );
  }

  if (
    newlyCheckedDeliverables.length === 1 &&
    newlyCheckedDeliverables[0].id !== expectedTaskId
  ) {
    errors.push(
      `unit_task_delta_unexpected: checked ${newlyCheckedDeliverables[0].id} instead of ${expectedTaskId}`,
    );
  }

  const unexpectedNewlyCheckedTasks = newlyChecked.filter(
    (task) => task.id !== expectedTaskId,
  );
  if (
    unexpectedNewlyCheckedTasks.length > 0 &&
    newlyCheckedDeliverables.length <= 1
  ) {
    errors.push(
      `unit_task_delta_unexpected: checked extra tasks ${unexpectedNewlyCheckedTasks.map((task) => task.id).join(", ")}`,
    );
  }

  return {
    errors,
    addedTask: newlyCheckedDeliverables.find(
      (task) => task.id === expectedTaskId,
    ),
  };
}

export function validateDeliveryUnitDelta(
  baseMarkdown: string,
  headMarkdown: string,
  expectedUnitId: string,
): DeliveryUnitDelta {
  const errors: string[] = [];
  const baseUnits = parseDeliveryUnits(baseMarkdown);
  const headUnits = parseDeliveryUnits(headMarkdown);
  const baseTasks = flattenDeliveryUnits(baseUnits);
  const headTasks = flattenDeliveryUnits(headUnits);

  errors.push(
    ...deliveryUnitShapeErrors(baseUnits, "base tasks.md"),
    ...deliveryUnitShapeErrors(headUnits, "head tasks.md"),
  );

  const baseUnitsById = new Map(baseUnits.map((unit) => [unit.id, unit]));
  const headUnitsById = new Map(headUnits.map((unit) => [unit.id, unit]));
  const expectedBaseUnit = baseUnitsById.get(expectedUnitId);
  const expectedHeadUnit = headUnitsById.get(expectedUnitId);

  if (!expectedBaseUnit || !expectedHeadUnit) {
    errors.push(
      `delivery_unit_delta_unexpected: expected unit ${expectedUnitId} must exist in both base and head tasks.md`,
    );
  }

  for (const baseUnit of baseUnits) {
    if (!headUnitsById.has(baseUnit.id)) {
      errors.push(
        `delivery_unit_delta_invalid_tasks: unit ${baseUnit.id} missing from head tasks.md`,
      );
    }
  }

  for (const headUnit of headUnits) {
    if (!baseUnitsById.has(headUnit.id)) {
      errors.push(
        `delivery_unit_delta_invalid_tasks: unit ${headUnit.id} missing from base tasks.md`,
      );
    }
  }

  const baseById = new Map(baseTasks.map((task) => [task.id, task]));
  const headById = new Map(headTasks.map((task) => [task.id, task]));

  for (const baseTask of baseTasks) {
    if (!headById.has(baseTask.id)) {
      errors.push(
        `delivery_unit_delta_invalid_tasks: task ${baseTask.id} missing from head tasks.md`,
      );
    }
  }

  for (const headTask of headTasks) {
    if (!baseById.has(headTask.id)) {
      errors.push(
        `delivery_unit_delta_invalid_tasks: task ${headTask.id} missing from base tasks.md`,
      );
    }
  }

  const newlyChecked = headTasks.filter((headTask) => {
    const baseTask = baseById.get(headTask.id);
    return baseTask && !baseTask.checked && headTask.checked;
  });
  const newlyCheckedDeliverables = newlyChecked.filter(
    (task) => task.kind === "deliverable",
  );
  const uncheckedPreviouslyChecked = baseTasks.filter((baseTask) => {
    const headTask = headById.get(baseTask.id);
    return baseTask.checked && headTask && !headTask.checked;
  });

  for (const task of uncheckedPreviouslyChecked) {
    errors.push(
      `delivery_unit_delta_invalid_tasks: task ${task.id} was unchecked relative to base`,
    );
  }

  const baseExpectedDeliverables =
    expectedBaseUnit?.work_items.filter(
      (task) => task.kind === "deliverable",
    ) ?? [];
  const headExpectedDeliverables =
    expectedHeadUnit?.work_items.filter(
      (task) => task.kind === "deliverable",
    ) ?? [];

  if (
    baseExpectedDeliverables.length > 0 &&
    baseExpectedDeliverables.every((task) => task.checked)
  ) {
    errors.push(
      `delivery_unit_delta_unexpected: expected unit ${expectedUnitId} was already checked in base`,
    );
  }

  const uncheckedExpectedHead = headExpectedDeliverables.filter(
    (task) => !task.checked,
  );
  if (expectedHeadUnit && uncheckedExpectedHead.length > 0) {
    errors.push(
      `delivery_unit_delta_missing: expected unit ${expectedUnitId} still has unchecked deliverable work items ${uncheckedExpectedHead.map((task) => task.id).join(", ")}`,
    );
  }

  if (newlyCheckedDeliverables.length === 0) {
    errors.push(
      `delivery_unit_delta_missing: expected unit ${expectedUnitId} to add checked deliverable work items`,
    );
  }

  const unexpectedNewlyChecked = newlyCheckedDeliverables.filter(
    (task) => task.unit_id !== expectedUnitId,
  );
  if (unexpectedNewlyChecked.length > 0) {
    errors.push(
      `delivery_unit_delta_unexpected: checked deliverable work items outside unit ${expectedUnitId}: ${unexpectedNewlyChecked.map((task) => task.id).join(", ")}`,
    );
  }

  return {
    errors,
    addedUnit: expectedHeadUnit,
    addedWorkItems: newlyCheckedDeliverables.filter(
      (task) => task.unit_id === expectedUnitId,
    ),
  };
}

export function validateStackTipTaskState(
  tasksMarkdown: string,
  taskArtifacts: TaskArtifactEvidence[],
  options: { context?: string; requireAllDeliverablesChecked?: boolean } = {},
): string[] {
  const errors: string[] = [];
  const context = options.context ?? "stack_ready";

  if (tasksMarkdown.trim().length === 0) {
    return [`${context}.task_state.tasks_markdown is required`];
  }

  const units = parseDeliveryUnits(tasksMarkdown);
  const tasks = flattenDeliveryUnits(units);
  errors.push(...deliveryUnitShapeErrors(units, "tasks.md"));

  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const artifactByTask = new Map<string, string>();
  for (const evidence of taskArtifacts) {
    if ((!evidence.taskId && !evidence.unitId) || !evidence.artifact) {
      errors.push(
        `${context}.task_artifacts entries must include task_id or unit_id and artifact`,
      );
      continue;
    }

    if (evidence.unitId) {
      const unit = unitsById.get(evidence.unitId);
      if (!unit) {
        errors.push(
          `${context}.task_artifacts references unknown unit ${evidence.unitId}`,
        );
        continue;
      }
      for (const task of unit.work_items.filter(
        (workItem) => workItem.kind === "deliverable" && workItem.checked,
      )) {
        if (artifactByTask.has(task.id)) {
          errors.push(
            `${context}.task_artifacts has duplicate evidence for task ${task.id}`,
          );
        }
        artifactByTask.set(task.id, evidence.artifact);
      }
      continue;
    }

    if (!evidence.taskId || !tasksById.has(evidence.taskId)) {
      errors.push(
        `${context}.task_artifacts references unknown task ${evidence.taskId}`,
      );
      continue;
    }

    if (artifactByTask.has(evidence.taskId)) {
      errors.push(
        `${context}.task_artifacts has duplicate evidence for task ${evidence.taskId}`,
      );
    }

    artifactByTask.set(evidence.taskId, evidence.artifact);
  }

  const uncheckedDeliverables = tasks.filter(
    (task) => task.kind === "deliverable" && !task.checked,
  );
  if (
    options.requireAllDeliverablesChecked !== false &&
    uncheckedDeliverables.length > 0
  ) {
    errors.push(
      `${context} partial stack: unchecked deliverable tasks ${uncheckedDeliverables.map((task) => task.id).join(", ")}`,
    );
  }

  const checkedDeliverablesMissingArtifacts = tasks.filter(
    (task) =>
      task.kind === "deliverable" &&
      task.checked &&
      !artifactByTask.has(task.id),
  );
  if (checkedDeliverablesMissingArtifacts.length > 0) {
    errors.push(
      `${context}.task_artifacts missing implementation artifact evidence for checked deliverable tasks ${checkedDeliverablesMissingArtifacts.map((task) => task.id).join(", ")}`,
    );
  }

  return errors;
}

function deliveryUnitShapeErrors(
  units: OpenSpecDeliveryUnit[],
  prefix: string,
): string[] {
  return validateDeliveryUnits(units).map((error) =>
    error.startsWith("needs_spec_redesign")
      ? `${prefix}: ${error}; ask the user whether to redo the spec, brainstorm, narrow scope, or choose another route before continuing delivery`
      : `${prefix}: ${error}`,
  );
}

function flattenDeliveryUnits(
  units: OpenSpecDeliveryUnit[],
): OpenSpecWorkItem[] {
  return units.flatMap((unit) => unit.work_items);
}
