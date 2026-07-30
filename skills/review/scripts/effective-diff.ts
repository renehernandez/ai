import { execFileSync } from "node:child_process";

import type { EffectiveDiffFile } from "./delivery-shape-evidence.ts";

export function resolveGitEffectiveDiff(
  targetBaseSha: string,
  sourceHead: string,
): readonly EffectiveDiffFile[] {
  let numstatOutput: string;
  let nameStatusOutput: string;
  try {
    numstatOutput = execFileSync(
      "git",
      [
        "diff",
        "--numstat",
        "--no-renames",
        "-z",
        `${targetBaseSha}..${sourceHead}`,
      ],
      { encoding: "utf8" },
    );
    nameStatusOutput = execFileSync(
      "git",
      [
        "diff",
        "--name-status",
        "--no-renames",
        "-z",
        `${targetBaseSha}..${sourceHead}`,
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    throw new Error(
      `delivery_budget_removal_only_git_diff_unavailable:${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return parseGitNumstat(numstatOutput, parseGitNameStatus(nameStatusOutput));
}

export function parseGitNumstat(
  output: string,
  statuses: ReadonlyMap<string, EffectiveDiffFile["status"]>,
): readonly EffectiveDiffFile[] {
  return output
    .split("\0")
    .filter(Boolean)
    .map((record) => {
      const firstTab = record.indexOf("\t");
      const secondTab = record.indexOf("\t", firstTab + 1);
      const rawAdditions = record.slice(0, firstTab);
      const rawDeletions = record.slice(firstTab + 1, secondTab);
      const binary = rawAdditions === "-" && rawDeletions === "-";
      const additions = binary ? 0 : Number(rawAdditions);
      const deletions = binary ? 0 : Number(rawDeletions);
      const path = record.slice(secondTab + 1);
      if (
        firstTab < 0 ||
        secondTab < 0 ||
        !Number.isSafeInteger(additions) ||
        !Number.isSafeInteger(deletions) ||
        !path
      ) {
        throw new Error("delivery_budget_removal_only_git_diff_invalid");
      }
      const status = statuses.get(path);
      if (!status) {
        throw new Error("delivery_budget_removal_only_git_status_invalid");
      }
      return binary
        ? { path, additions, deletions, binary: true as const, status }
        : { path, additions, deletions, status };
    });
}

export function parseGitNameStatus(
  output: string,
): ReadonlyMap<string, EffectiveDiffFile["status"]> {
  const fields = output.split("\0").filter(Boolean);
  if (fields.length % 2 !== 0) {
    throw new Error("delivery_budget_removal_only_git_status_invalid");
  }
  const statuses = new Map<string, EffectiveDiffFile["status"]>();
  for (let index = 0; index < fields.length; index += 2) {
    const status = { A: "added", M: "modified", D: "deleted" }[
      fields[index]
    ] as EffectiveDiffFile["status"];
    const path = fields[index + 1];
    if (!status || !path || statuses.has(path)) {
      throw new Error("delivery_budget_removal_only_git_status_invalid");
    }
    statuses.set(path, status);
  }
  return statuses;
}
