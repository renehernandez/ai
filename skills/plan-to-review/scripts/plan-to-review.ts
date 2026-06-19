#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const REQUEST_STATUSES = ["ready_for_review"] as const;
const REQUESTED_REVIEWERS = [
  "nitro",
  "codex",
  "developers",
  "human",
  "security",
  "docs",
] as const;
const LEDGER_GATES = [
  "request_validation",
  "session_start",
  "planning_only_diff",
  "artifact_validation",
  "review_feedback_routing",
  "artifact_creation_update",
  "artifact_host_inspection",
  "automated_feedback",
  "developer_review",
  "no_implementation",
] as const;
const LEDGER_NOT_APPLICABLE_GATES = [
  "automated_feedback",
  "developer_review",
] as const;
const LEDGER_STATUSES = ["passed", "blocked", "not_applicable"] as const;

type Command =
  | "detect"
  | "request-template"
  | "validate-request"
  | "gate-template"
  | "validate-ledger";

type ParsedRequest = {
  source:
    | "plan_review_request"
    | "plan_delivery_handoff"
    | "legacy"
    | "ambiguous";
  status?: string;
  artifact_type?: string;
  artifact_ref?: string;
  review_goal?: string;
  requested_reviewers: string[];
  unresolved_blockers: string[];
  blockers: string[];
};

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-to-review.ts <detect|request-template|validate-request|gate-template|validate-ledger> [--file path]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "request-template") {
    printRequestTemplate();
    return;
  }

  if (command === "gate-template") {
    printGateTemplate();
    return;
  }

  const input = readInput(args);
  if (command === "validate-request") {
    validateRequest(input);
    return;
  }

  validateLedger(input);
}

function detect(): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const remoteText = remotes.toLowerCase();

  const result = {
    repo_root: repoRoot,
    branch,
    head_sha: headSha,
    remotes: remotes.split("\n").filter(Boolean),
    artifact_host_hint:
      remoteText.includes("gitlab") || remoteText.includes("git.fullscript.io")
        ? "gitlab"
        : remoteText.includes("github")
          ? "github"
          : null,
    openspec_present: existsSync(join(repoRoot, "openspec")),
    plan_dirs_present: [".agents/plans", "plans", "docs"].filter((path) =>
      existsSync(join(repoRoot, path)),
    ),
  };

  console.log(JSON.stringify(result, null, 2));
}

function printRequestTemplate(): void {
  console.log(`plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - nitro
    - developers
  unresolved_blockers: []
`);
}

function printGateTemplate(): void {
  console.log(`plan_review_gate_ledger:
${LEDGER_GATES.map(
  (gate) => `  ${gate}:
    status: passed
    evidence: <evidence>`,
).join("\n")}
`);
}

function validateRequest(input: string): void {
  const request = parseRequest(input);
  const errors: string[] = [];

  if (request.source === "ambiguous") {
    console.error(
      "Invalid ambiguous:\n- provide exactly one of plan_review_request or plan_delivery_handoff",
    );
    process.exit(1);
  }

  if (request.source === "legacy") {
    console.error(
      "Invalid legacy:\n- legacy handoffs are unsupported; rerun plan-ready",
    );
    process.exit(1);
  }

  requireValue(request.status, "status", errors);
  requireValue(request.artifact_type, "artifact_type", errors);
  requireValue(request.artifact_ref, "artifact_ref", errors);

  if (request.source === "plan_review_request") {
    requireValue(request.review_goal, "review_goal", errors);

    if (request.status && !includes(REQUEST_STATUSES, request.status)) {
      errors.push(`status must be one of: ${REQUEST_STATUSES.join(", ")}`);
    }

    if (request.requested_reviewers.length === 0) {
      errors.push("requested_reviewers must include at least one reviewer");
    }

    for (const reviewer of request.requested_reviewers) {
      if (!includes(REQUESTED_REVIEWERS, reviewer)) {
        errors.push(`unknown requested reviewer: ${reviewer}`);
      }
    }
  } else {
    if (request.status && request.status !== "ready") {
      errors.push("plan_delivery_handoff status must be ready");
    }

    if (request.blockers.length > 0) {
      errors.push("plan_delivery_handoff blockers must be empty");
    }
  }

  if (
    request.artifact_type &&
    !includes(ARTIFACT_TYPES, request.artifact_type)
  ) {
    errors.push(`artifact_type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (request.unresolved_blockers.length > 0) {
    errors.push(
      "unresolved_blockers must be empty before publishing for review",
    );
  }

  if (errors.length > 0) {
    console.error(
      `Invalid ${request.source}:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log(`${request.source} valid`);
}

function validateLedger(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_review_gate_ledger");
  const errors: string[] = [];

  for (const gate of LEDGER_GATES) {
    const gateSection = findSection(section, gate);
    if (!gateSection) {
      errors.push(`${gate} is required`);
      continue;
    }

    const status = scalar(gateSection, "status");
    const evidence = scalar(gateSection, "evidence");

    if (!status) {
      errors.push(`${gate}.status is required`);
    } else if (!includes(LEDGER_STATUSES, status)) {
      errors.push(
        `${gate}.status must be one of: ${LEDGER_STATUSES.join(", ")}`,
      );
    } else if (
      status === "not_applicable" &&
      !includes(LEDGER_NOT_APPLICABLE_GATES, gate)
    ) {
      errors.push(`${gate}.status cannot be not_applicable`);
    }

    if (!evidence || evidence.startsWith("<")) {
      errors.push(`${gate}.evidence is required`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid plan_review_gate_ledger:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("plan_review_gate_ledger valid");
}

function parseRequest(input: string): ParsedRequest {
  const body = extractYaml(input);
  const reviewSection = findSection(body, "plan_review_request");
  const handoffSection = findSection(body, "plan_delivery_handoff");
  const legacySection = findSection(body, "plan_ready_handoff");
  const legacyCoordinateHandoff = findSection(body, "plan_coordinate_handoff");
  const legacyReviewedSlices = /^\s*reviewed_slices:\s*/m.test(body);

  if (reviewSection && handoffSection) {
    return {
      source: "ambiguous",
      requested_reviewers: [],
      unresolved_blockers: [],
      blockers: [],
    };
  }

  if (legacySection || legacyCoordinateHandoff || legacyReviewedSlices) {
    return {
      source: "legacy",
      requested_reviewers: [],
      unresolved_blockers: [],
      blockers: [],
    };
  }

  if (reviewSection) {
    return {
      source: "plan_review_request",
      status: scalar(reviewSection, "status"),
      artifact_type: scalar(reviewSection, "artifact_type"),
      artifact_ref: scalar(reviewSection, "artifact_ref"),
      review_goal: scalar(reviewSection, "review_goal"),
      requested_reviewers: list(reviewSection, "requested_reviewers"),
      unresolved_blockers: list(reviewSection, "unresolved_blockers"),
      blockers: [],
    };
  }

  const handoffBody = handoffSection ?? body;
  const artifact = findSection(handoffBody, "artifact") ?? "";
  return {
    source: "plan_delivery_handoff",
    status: scalar(handoffBody, "status"),
    artifact_type: scalar(artifact, "type"),
    artifact_ref: scalar(artifact, "ref"),
    review_goal: scalar(handoffBody, "review_goal"),
    requested_reviewers: list(handoffBody, "requested_reviewers"),
    unresolved_blockers: list(handoffBody, "unresolved_blockers"),
    blockers: list(handoffBody, "blockers"),
  };
}

function extractYaml(input: string): string {
  const fenced = input.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
  return (fenced?.[1] ?? input).trim();
}

function extractSection(input: string, sectionName: string): string {
  return findSection(input, sectionName) ?? input;
}

function findSection(input: string, sectionName: string): string | null {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return null;
  }

  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
}

function scalar(input: string, key: string): string | undefined {
  const match = input.match(
    new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"),
  );
  if (!match) {
    return undefined;
  }

  return cleanScalar(match[1]);
}

function list(input: string, key: string): string[] {
  const inline = input.match(
    new RegExp(`^${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"),
  );
  if (inline) {
    const raw = inline[1].trim();
    return raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
  }

  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return [];
  }

  const values: string[] = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (!line.startsWith("  ")) {
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
  key: string,
  errors: string[],
): void {
  if (!value || value.startsWith("<")) {
    errors.push(`${key} is required`);
  }
}

function includes<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value as T[number]);
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "request-template",
    "validate-request",
    "gate-template",
    "validate-ledger",
  ].includes(command ?? "");
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
