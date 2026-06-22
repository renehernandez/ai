import type { OpenSpecTask } from "../skills/openspec-tasks/scripts/openspec-tasks.ts";
import {
  parseTasks,
  validateTasks,
} from "../skills/openspec-tasks/scripts/openspec-tasks.ts";

export type UnitTaskDelta = {
  errors: string[];
  addedTask?: OpenSpecTask;
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
  const baseTasks = parseTasks(baseMarkdown);
  const headTasks = parseTasks(headMarkdown);
  const baseErrors = validateTasks(baseTasks);
  const headErrors = validateTasks(headTasks);

  errors.push(
    ...baseErrors.map((error) => `base tasks.md: ${error}`),
    ...headErrors.map((error) => `head tasks.md: ${error}`),
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
