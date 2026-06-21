#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { nitroFeedbackGateErrors } from "../../../scripts/nitro-feedback-gate.ts";
import {
  extractSection,
  extractYaml,
  fail,
  findSection,
  includes,
  legacyPlanContractErrors,
  list,
  readInput,
  requireValue,
  scalar,
  validatePlanningReviewContract,
} from "../../../scripts/planning-contracts.ts";

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
  | "planning-review-template"
  | "validate-planning-review"
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
      "Usage: plan-review.ts <detect|request-template|validate-request|gate-template|validate-ledger> [--file path]",
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

  if (command === "planning-review-template") {
    printPlanningReviewTemplate();
    return;
  }

  const input = readInput(args);
  if (command === "validate-request") {
    validateRequest(input);
    return;
  }

  if (command === "validate-planning-review") {
    validatePlanningReview(input);
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
  console.log(`## Readable Summary

- Status: ready for hosted plan review.
- Artifact: openspec/changes/example-change.
- Review goal: validate the plan before implementation.
- Requested reviewers: Nitro and developers.

\`\`\`yaml
plan_review_request:
  status: ready_for_review
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_goal: "Validate the plan before implementation."
  requested_reviewers:
    - nitro
    - developers
  unresolved_blockers: []
\`\`\`
`);
}

function printGateTemplate(): void {
  console.log(`## Readable Summary

- Review state: every plan-review gate has a verdict and evidence.
- Hosted artifact: PR or MR is planning-only.
- Finish condition: developer review is pending, feedback is incorporated, or the plan review is blocked with evidence.

\`\`\`yaml
plan_review_gate_ledger:
${LEDGER_GATES.map(
  (gate) => `  ${gate}:
    status: passed
    evidence: <evidence>`,
).join("\n")}
\`\`\`
`);
}

function printPlanningReviewTemplate(): void {
  console.log(`## Readable Summary

- Status: reviewed planning is ready for implementation sequencing.
- Artifact: openspec/changes/example-change.
- Mode: stacked delivery from the reviewed planning PR or MR head.
- Gate: hosted planning review is complete and the planning head is ready for stack-based implementation.

\`\`\`yaml
nitro_feedback_gate:
  artifact: <Fullscript GitLab planning MR URL>
  head_sha: <planning artifact head sha>
  request:
    required: true
    requested_after_latest_push: true
    evidence:
      - <request command, note URL, or discussion evidence>
  start:
    status: started
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - <Nitro acknowledgement or review-start evidence>
  completion:
    status: clean
    evidence:
      - <Nitro latest-head completion evidence>
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed

planning_review:
  status: reviewed
  artifact_type: openspec
  artifact_ref: openspec/changes/example-change
  review_artifact: <planning PR or MR URL>
  mode: stacked_delivery
  gate_outcome: ready_for_stack
  target_branch: main
  target_base_sha: <target branch sha reviewed by planning artifact>
  planning_branch: <planning branch name>
  reviewed_head: <planning artifact head sha>
  stack_base_ref: <planning PR or MR branch/ref>
  stack_base_evidence: <latest-head review evidence proving this head is the stack base>
  stack_identity:
    expected_base_ref: <planning PR or MR branch/ref>
    expected_base_sha: <planning artifact head sha>
    predecessor_artifact:
    restack_required: false
  task_state_fingerprint: <sha256 of reviewed plan or OpenSpec task state>
  validation:
    evidence:
      - openspec validate example-change --strict --no-interactive
  review:
    evidence:
      - planning PR or MR latest-head feedback completed with no unresolved actionable findings
  blockers: []
\`\`\`
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
  const legacyErrors = legacyPlanContractErrors(input);

  if (reviewSection && handoffSection) {
    return {
      source: "ambiguous",
      requested_reviewers: [],
      unresolved_blockers: [],
      blockers: [],
    };
  }

  if (legacyErrors.length > 0) {
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

function validatePlanningReview(input: string): void {
  const errors = legacyPlanContractErrors(input);
  validatePlanningReviewContract(input, errors);
  errors.push(
    ...nitroFeedbackGateErrors(input).map((error) =>
      error.startsWith("nitro_feedback_gate.")
        ? error
        : `nitro_feedback_gate.${error}`,
    ),
  );

  if (errors.length > 0) {
    console.error(
      `Invalid planning_review:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("planning_review valid");
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "request-template",
    "validate-request",
    "planning-review-template",
    "validate-planning-review",
    "gate-template",
    "validate-ledger",
  ].includes(command ?? "");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}
