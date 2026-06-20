#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  firstUncheckedDeliverable,
  parseTasks,
  validateTasks,
} from "../../openspec-tasks/scripts/openspec-tasks.ts";

const ROUTES = ["atomic_plan", "openspec_task"] as const;
const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const EXPECTED_HOSTS = ["github_pr", "gitlab_mr", "direct_publish"] as const;
const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
  "refactoring-opportunities",
] as const;
const LEGACY_ROOTS = [
  "slice_plan_review",
  "plan_coordinate_handoff",
  "plan_ready_handoff",
  "plan_followthrough_slice_handoff",
  "plan_followthrough_ledger",
] as const;
const LEGACY_KEYS = ["reviewed_slices"] as const;

type Command =
  | "detect"
  | "handoff-template"
  | "validate-handoff"
  | "select-next-task";

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-orchestrator.ts <detect|handoff-template|validate-handoff|select-next-task> [--file path|tasks.md]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "handoff-template") {
    printHandoffTemplate();
    return;
  }

  if (command === "select-next-task") {
    selectNextTask(args[0]);
    return;
  }

  validateHandoff(readInput(args));
}

function detect(): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const remoteText = remotes.toLowerCase();

  console.log(
    JSON.stringify(
      {
        repo_root: repoRoot,
        branch,
        head_sha: headSha,
        remotes: remotes.split("\n").filter(Boolean),
        artifact_host_hint:
          remoteText.includes("gitlab") ||
          remoteText.includes("git.fullscript.io")
            ? "gitlab"
            : remoteText.includes("github")
              ? "github"
              : null,
        openspec_present: existsSync(join(repoRoot, "openspec")),
      },
      null,
      2,
    ),
  );
}

function printHandoffTemplate(): void {
  console.log(`## Readable Summary

- Status: ready for one selected OpenSpec task.
- Route: OpenSpec task.
- Artifact: openspec/changes/example-change.
- Selected task: 1.1.
- Delivery: mark only that task complete in the same PR, MR, or direct-publish commit.

\`\`\`yaml
plan_delivery_handoff:
  status: ready
  route: openspec_task
  artifact:
    type: openspec
    ref: openspec/changes/example-change
    fingerprint: <target commit sha>
  approved_unit:
    id: "1.1"
    title: <OpenSpec task title>
    scope: <one paragraph>
    acceptance:
      - <observable result>
    verification:
      - <required command, check, or manual proof>
  constraints:
    files_or_areas:
      - <expected ownership area>
    out_of_scope:
      - <explicit non-goal>
  delivery:
    expected_host: github_pr | gitlab_mr | direct_publish
    completion_updates:
      - Mark OpenSpec task checkbox complete in the same PR/MR.
  review:
    required_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    optional_reviewers: []
  blockers: []
\`\`\`
`);
}

function validateHandoff(input: string): void {
  const errors = legacyErrors(input);
  const handoff = parseHandoff(input);

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.route, "route", errors);
  requireValue(handoff.artifactType, "artifact.type", errors);
  requireValue(handoff.artifactRef, "artifact.ref", errors);
  requireValue(handoff.artifactFingerprint, "artifact.fingerprint", errors);
  requireValue(handoff.unitId, "approved_unit.id", errors);
  requireValue(handoff.unitTitle, "approved_unit.title", errors);
  requireValue(handoff.unitScope, "approved_unit.scope", errors);
  requireValue(handoff.expectedHost, "delivery.expected_host", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }
  if (handoff.route && !includes(ROUTES, handoff.route)) {
    errors.push(`route must be one of: ${ROUTES.join(", ")}`);
  }
  if (handoff.artifactType && !includes(ARTIFACT_TYPES, handoff.artifactType)) {
    errors.push(`artifact.type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }
  if (handoff.expectedHost && !includes(EXPECTED_HOSTS, handoff.expectedHost)) {
    errors.push(
      `delivery.expected_host must be one of: ${EXPECTED_HOSTS.join(", ")}`,
    );
  }
  if (handoff.acceptance.length === 0) {
    errors.push("approved_unit.acceptance must include at least one item");
  }
  if (handoff.verification.length === 0) {
    errors.push("approved_unit.verification must include at least one item");
  }
  if (handoff.filesOrAreas.length === 0) {
    errors.push("constraints.files_or_areas must include at least one item");
  }
  for (const reviewer of BASELINE_REVIEWERS) {
    if (!handoff.requiredReviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }
  if (handoff.blockers.length > 0) {
    errors.push("blockers must be empty before status ready");
  }
  if (handoff.route === "atomic_plan" && handoff.unitId !== "atomic") {
    errors.push("atomic_plan route requires approved_unit.id atomic");
  }
  if (handoff.route === "openspec_task") {
    if (handoff.artifactType !== "openspec") {
      errors.push("openspec_task route requires artifact.type openspec");
    }
    if (handoff.completionUpdates.length === 0) {
      errors.push("openspec_task route requires delivery.completion_updates");
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid plan_delivery_handoff:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("plan_delivery_handoff valid");
}

function selectNextTask(path: string | undefined): void {
  if (!path) {
    fail("select-next-task requires tasks.md path");
  }

  const tasks = parseTasks(readFileSync(path, "utf8"));
  const errors = validateTasks(tasks);
  if (errors.length > 0) {
    console.error(
      `Invalid openspec_tasks:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  const task = firstUncheckedDeliverable(tasks);
  if (!task) {
    console.log(
      JSON.stringify({ status: "complete", next_task: null }, null, 2),
    );
    return;
  }

  console.log(JSON.stringify({ status: "ready", next_task: task }, null, 2));
}

function parseHandoff(input: string): {
  status?: string;
  route?: string;
  artifactType?: string;
  artifactRef?: string;
  artifactFingerprint?: string;
  unitId?: string;
  unitTitle?: string;
  unitScope?: string;
  acceptance: string[];
  verification: string[];
  filesOrAreas: string[];
  expectedHost?: string;
  completionUpdates: string[];
  requiredReviewers: string[];
  blockers: string[];
} {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_delivery_handoff");
  const artifact = extractSection(section, "artifact");
  const unit = extractSection(section, "approved_unit");
  const constraints = extractSection(section, "constraints");
  const delivery = extractSection(section, "delivery");
  const review = extractSection(section, "review");

  return {
    status: scalar(section, "status"),
    route: scalar(section, "route"),
    artifactType: scalar(artifact, "type"),
    artifactRef: scalar(artifact, "ref"),
    artifactFingerprint: scalar(artifact, "fingerprint"),
    unitId: scalar(unit, "id"),
    unitTitle: scalar(unit, "title"),
    unitScope: scalar(unit, "scope"),
    acceptance: list(unit, "acceptance"),
    verification: list(unit, "verification"),
    filesOrAreas: list(constraints, "files_or_areas"),
    expectedHost: scalar(delivery, "expected_host"),
    completionUpdates: list(delivery, "completion_updates"),
    requiredReviewers: list(review, "required_reviewers"),
    blockers: list(section, "blockers"),
  };
}

function legacyErrors(input: string): string[] {
  const body = extractYaml(input);
  const errors: string[] = [];

  for (const root of LEGACY_ROOTS) {
    if (hasSection(body, root)) {
      errors.push(`${root} is legacy; rerun plan-ready`);
    }
  }
  for (const key of LEGACY_KEYS) {
    if (hasKey(body, key)) {
      errors.push(`${key} is legacy; rerun plan-ready`);
    }
  }

  return errors;
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "handoff-template",
    "validate-handoff",
    "select-next-task",
  ].includes(command ?? "");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

function extractYaml(input: string): string {
  const fenced = input.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
  return (fenced?.[1] ?? input).trim();
}

function extractSection(input: string, sectionName: string): string {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return "";
  }
  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
}

function hasSection(input: string, sectionName: string): boolean {
  return new RegExp(`^\\s*${escapeRegExp(sectionName)}:\\s*$`, "m").test(input);
}

function hasKey(input: string, key: string): boolean {
  return new RegExp(`^\\s*${escapeRegExp(key)}:\\s*`, "m").test(input);
}

function scalar(input: string, key: string): string | undefined {
  const match = input.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"),
  );
  return match ? cleanScalar(match[1]) : undefined;
}

function list(input: string, key: string): string[] {
  const inline = input.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"),
  );
  if (inline) {
    const raw = inline[1].trim();
    return raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
  }

  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return [];
  }

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const values: string[] = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }
    const item = line.trim().match(/^- (.+)$/);
    if (item) {
      values.push(cleanScalar(item[1]));
    }
  }
  return values.filter(Boolean);
}

function readInput(args: string[]): string {
  const fileIndex = args.indexOf("--file");
  if (fileIndex !== -1) {
    const file = args[fileIndex + 1];
    if (!file) {
      fail("--file requires a path");
    }
    return readFileSync(file, "utf8");
  }
  return readFileSync(0, "utf8");
}

function requireValue(
  value: string | undefined,
  label: string,
  errors: string[],
): void {
  if (!value || value.startsWith("<")) {
    errors.push(`${label} is required`);
  }
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function includes<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value as T[number]);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
