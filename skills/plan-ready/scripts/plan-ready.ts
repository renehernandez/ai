#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
] as const;

const OPTIONAL_REVIEWER_DESCRIPTIONS = {
  "security-and-auth": "auth, authorization, secrets, token handling, sensitive data, webhooks, dependency trust",
  "data-migration-and-backfill": "schema changes, data corrections, reprocessing, idempotency, rollback, irreversible writes",
  "ci-and-release-impact": "CI config, package publishing, deployment, release automation, branch protection, required checks",
  "frontend-ux-accessibility": "UI flows, responsive layout, accessibility, visual verification, interaction states",
  "infra-and-cloud": "Terraform, Kubernetes, Cloudflare, AWS, DNS, queues, storage, environment config",
  "docs-and-agent-alignment": "docs, agent instructions, skill/rule updates, automation prompts, background-review rubrics, PR description expectations",
  "performance-and-scale": "hot paths, concurrency, caching, queues, rate limits, batch behavior, operational limits",
  "agent-runtime-and-skill-compatibility": "Codex/Claude skill structure, SKILL.md conventions, agents/openai.yaml, install/update paths, bundled scripts, runtime compatibility",
} as const;

const OPTIONAL_REVIEWERS = Object.keys(OPTIONAL_REVIEWER_DESCRIPTIONS) as Array<
  keyof typeof OPTIONAL_REVIEWER_DESCRIPTIONS
>;

const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;

type Command = "detect" | "reviewer-template" | "validate-selection" | "handoff-template" | "validate-handoff";

type ParsedHandoff = {
  status?: string;
  artifact_type?: string;
  artifact_ref?: string;
  approved_slice?: string;
  required_reviewers: string[];
  optional_reviewers_selected: string[];
  unresolved_blockers: string[];
  scrutiny_verdict?: string;
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-ready.ts <detect|reviewer-template|handoff-template|validate-handoff> [artifact-ref] [--file path]",
    );
  }

  if (command === "detect") {
    detect(args[0]);
    return;
  }

  if (command === "reviewer-template") {
    printReviewerTemplate();
    return;
  }

  if (command === "validate-selection") {
    validateSelection(readInput(args));
    return;
  }

  if (command === "handoff-template") {
    printHandoffTemplate();
    return;
  }

  validateHandoff(readInput(args));
}

function detect(artifactRef?: string): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const relativeArtifact = artifactRef ? toRepoRelative(repoRoot, artifactRef) : "";
  const artifactType = inferArtifactType(relativeArtifact || artifactRef || "");

  const result = {
    repo_root: repoRoot,
    branch,
    head_sha: headSha,
    remotes: remotes.split("\n").filter(Boolean),
    openspec_present: existsSync(join(repoRoot, "openspec")),
    plan_directories: ["docs/plans", "plans", "specs", "docs/specs"].filter((path) =>
      existsSync(join(repoRoot, path)),
    ),
    artifact_ref: artifactRef ?? null,
    artifact_type_hint: artifactType,
  };

  console.log(JSON.stringify(result, null, 2));
}

function printReviewerTemplate(): void {
  console.log(`reviewer_selection_judge:
  verdict: baseline_sufficient | add_optional_reviewers
  baseline_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `    - ${reviewer}`).join("\n")}
  optional_reviewer_catalog:
${OPTIONAL_REVIEWERS.map((reviewer) => `    - ${reviewer}: ${OPTIONAL_REVIEWER_DESCRIPTIONS[reviewer]}`).join("\n")}
  selected_optional_reviewers: []
  rationale:
    <optional-reviewer-name>: <why this reviewer is needed>

selection_rules:
  - Select docs-and-agent-alignment for reusable workflow, docs, skills, rules, automation prompt, background review, or PR/MR description contract changes.
  - Select agent-runtime-and-skill-compatibility for skill folder structure, skill metadata, bundled script, Codex/Claude adapter, install/update, or agent runtime changes.
  - Select only from optional_reviewer_catalog; do not invent reviewer names.
  - Use baseline_sufficient only after explaining why no optional catalog reviewer is needed.
`);
}

function printHandoffTemplate(): void {
  console.log(`plan_ready_handoff:
  status: ready
  artifact_type: plan
  artifact_ref: <path, OpenSpec change id/path, Linear issue key, or URL>
  approved_slice: <short implementation slice>
  required_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `    - ${reviewer}`).join("\n")}
  optional_reviewers_selected: []
  unresolved_blockers: []
  scrutiny_verdict: ship
`);
}

function validateHandoff(input: string): void {
  const handoff = parseHandoff(input);
  const errors: string[] = [];

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.artifact_type, "artifact_type", errors);
  requireValue(handoff.artifact_ref, "artifact_ref", errors);
  requireValue(handoff.approved_slice, "approved_slice", errors);
  requireValue(handoff.scrutiny_verdict, "scrutiny_verdict", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }

  if (handoff.artifact_type && !includes(ARTIFACT_TYPES, handoff.artifact_type)) {
    errors.push(`artifact_type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (handoff.scrutiny_verdict && handoff.scrutiny_verdict !== "ship") {
    errors.push("scrutiny_verdict must be ship");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!handoff.required_reviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of [...handoff.required_reviewers, ...handoff.optional_reviewers_selected]) {
    if (!isKnownReviewer(reviewer)) {
      errors.push(`unknown reviewer: ${reviewer}`);
    }
  }

  for (const reviewer of handoff.optional_reviewers_selected) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(`optional_reviewers_selected can include only optional reviewers: ${reviewer}`);
    }
  }

  if (handoff.unresolved_blockers.length > 0) {
    errors.push("unresolved_blockers must be empty before status ready");
  }

  if (errors.length > 0) {
    console.error(`Invalid plan_ready_handoff:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }

  console.log("plan_ready_handoff valid");
}

function validateSelection(input: string): void {
  const selection = parseSelection(input);
  const errors: string[] = [];

  if (!selection.verdict) {
    errors.push("reviewer_selection_judge.verdict is required");
  } else if (!["baseline_sufficient", "add_optional_reviewers"].includes(selection.verdict)) {
    errors.push("reviewer_selection_judge.verdict must be baseline_sufficient or add_optional_reviewers");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!selection.baseline_reviewers.includes(reviewer)) {
      errors.push(`baseline_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of selection.baseline_reviewers) {
    if (!includes(BASELINE_REVIEWERS, reviewer)) {
      errors.push(`baseline_reviewers can include only baseline reviewers: ${reviewer}`);
    }
  }

  if (selection.baseline_reviewers.length !== BASELINE_REVIEWERS.length) {
    errors.push(`baseline_reviewers must contain exactly: ${BASELINE_REVIEWERS.join(", ")}`);
  }

  for (const reviewer of selection.selected_optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(`selected_optional_reviewers can include only optional reviewers: ${reviewer}`);
    }
  }

  if (selection.verdict === "add_optional_reviewers" && selection.selected_optional_reviewers.length === 0) {
    errors.push("add_optional_reviewers requires at least one selected_optional_reviewer");
  }

  if (selection.verdict === "baseline_sufficient" && selection.selected_optional_reviewers.length > 0) {
    errors.push("baseline_sufficient must not include selected_optional_reviewers");
  }

  if (!selection.rationalePresent) {
    errors.push("rationale is required");
  }

  if (errors.length > 0) {
    console.error(`Invalid reviewer_selection_judge:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }

  console.log("reviewer_selection_judge valid");
}

function parseHandoff(input: string): ParsedHandoff {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_ready_handoff");

  return {
    status: scalar(section, "status"),
    artifact_type: scalar(section, "artifact_type"),
    artifact_ref: scalar(section, "artifact_ref"),
    approved_slice: scalar(section, "approved_slice"),
    required_reviewers: list(section, "required_reviewers"),
    optional_reviewers_selected: list(section, "optional_reviewers_selected"),
    unresolved_blockers: list(section, "unresolved_blockers"),
    scrutiny_verdict: scalar(section, "scrutiny_verdict"),
  };
}

function parseSelection(input: string): {
  verdict?: string;
  baseline_reviewers: string[];
  selected_optional_reviewers: string[];
  rationalePresent: boolean;
} {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_selection_judge");

  return {
    verdict: scalar(section, "verdict"),
    baseline_reviewers: list(section, "baseline_reviewers"),
    selected_optional_reviewers: list(section, "selected_optional_reviewers"),
    rationalePresent: /^rationale:\s*$/m.test(section) || /^rationale:\s*.+$/m.test(section),
  };
}

function extractYaml(input: string): string {
  const fenced = input.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
  return (fenced?.[1] ?? input).trim();
}

function extractSection(input: string, sectionName: string): string {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return input;
  }

  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
}

function scalar(input: string, key: string): string | undefined {
  const match = input.match(new RegExp(`^${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"));
  if (!match) {
    return undefined;
  }

  return cleanScalar(match[1]);
}

function list(input: string, key: string): string[] {
  const inline = input.match(new RegExp(`^${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"));
  if (inline) {
    const raw = inline[1].trim();
    return raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
  }

  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => line.match(new RegExp(`^${escapeRegExp(key)}:\\s*$`)));
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

function inferArtifactType(artifactRef: string): string | null {
  if (!artifactRef) {
    return null;
  }

  if (artifactRef.includes("openspec/changes/") || artifactRef.startsWith("openspec:")) {
    return "openspec";
  }

  if (/^[A-Z][A-Z0-9]+-\d+$/.test(artifactRef) || artifactRef.includes("linear.app")) {
    return "linear";
  }

  if (artifactRef.endsWith(".md") || artifactRef.includes("docs/plans/") || artifactRef.includes("plans/")) {
    return "plan";
  }

  return null;
}

function toRepoRelative(repoRoot: string, artifactRef: string): string {
  const absolute = resolve(artifactRef);
  if (!absolute.startsWith(repoRoot)) {
    return artifactRef;
  }
  return relative(repoRoot, absolute) || basename(absolute);
}

function requireValue(value: string | undefined, key: string, errors: string[]): void {
  if (!value || value.startsWith("<")) {
    errors.push(`${key} is required`);
  }
}

function isKnownReviewer(reviewer: string): boolean {
  return includes(BASELINE_REVIEWERS, reviewer) || includes(OPTIONAL_REVIEWERS, reviewer);
}

function includes<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function isCommand(command: string | undefined): command is Command {
  return ["detect", "reviewer-template", "validate-selection", "handoff-template", "validate-handoff"].includes(command ?? "");
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

main();
