#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  fail,
  legacyPlanContractErrors,
  readInput,
  validatePlanningReviewContract,
} from "../../../scripts/planning-contracts.ts";

type Command =
  | "detect"
  | "plan-review-request-template"
  | "validate-planning-review"
  | "validate-openspec-change";

main();

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-orchestrator.ts <detect|plan-review-request-template|validate-planning-review|validate-openspec-change> [--file path|change-id]",
    );
  }

  if (command === "detect") {
    detect();
    return;
  }

  if (command === "plan-review-request-template") {
    printPlanReviewRequestTemplate();
    return;
  }

  if (command === "validate-planning-review") {
    validatePlanningReview(readInput(args));
    return;
  }

  validateOpenSpecChange(args[0]);
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
        plans_dir_present: existsSync(join(repoRoot, ".agents", "plans")),
        openspec_present: existsSync(join(repoRoot, "openspec")),
      },
      null,
      2,
    ),
  );
}

function printPlanReviewRequestTemplate(): void {
  console.log(`## Readable Summary

- Status: ready to publish planning-only hosted review.
- Artifact: openspec/changes/example-change.
- Review goal: validate planning before implementation.
- Next action: run plan-review and wait for planning_review.

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

function validatePlanningReview(input: string): void {
  const errors = legacyPlanContractErrors(input);
  validatePlanningReviewContract(input, errors);

  if (errors.length > 0) {
    console.error(
      `Invalid planning_review:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("planning_review valid");
}

function validateOpenSpecChange(changeId: string | undefined): void {
  if (!changeId) {
    fail("validate-openspec-change requires a change id");
  }

  const result = spawnSync(
    "openspec",
    ["validate", changeId, "--strict", "--no-interactive"],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status ?? 1);
  }

  process.stdout.write(result.stdout);
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "plan-review-request-template",
    "validate-planning-review",
    "validate-openspec-change",
  ].includes(command ?? "");
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}
