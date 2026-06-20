#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  cleanScalar,
  escapeRegExp,
  extractSection,
  extractYaml,
  fail,
  hasKey,
  hasSection,
  includes,
  LEGACY_PLAN_KEYS,
  LEGACY_PLAN_ROOTS,
  list,
  readInput,
  requireValue,
  scalar,
} from "../../../scripts/planning-contracts.ts";

const BASELINE_REVIEWERS = [
  "implementation-readiness",
  "edge-cases-and-risks",
  "simplification-and-scope-control",
  "refactoring-opportunities",
] as const;

const OPTIONAL_REVIEWER_DESCRIPTIONS = {
  "security-and-auth":
    "auth, authorization, secrets, token handling, sensitive data, webhooks, dependency trust",
  "data-migration-and-backfill":
    "schema changes, data corrections, reprocessing, idempotency, rollback, irreversible writes",
  "ci-and-release-impact":
    "CI config, package publishing, deployment, release automation, branch protection, required checks",
  "frontend-ux-accessibility":
    "UI flows, responsive layout, accessibility, visual verification, interaction states",
  "infra-and-cloud":
    "Terraform, Kubernetes, Cloudflare, AWS, DNS, queues, storage, environment config",
  "docs-and-agent-alignment":
    "docs, agent instructions, skill/rule updates, automation prompts, background-review rubrics, PR description expectations",
  "performance-and-scale":
    "hot paths, concurrency, caching, queues, rate limits, batch behavior, operational limits",
  "agent-runtime-and-skill-compatibility":
    "skill structure, SKILL.md conventions, adapter prompts, install/update paths, bundled scripts, internal subagent routing, runtime compatibility",
} as const;

const OPTIONAL_REVIEWERS = Object.keys(OPTIONAL_REVIEWER_DESCRIPTIONS) as Array<
  keyof typeof OPTIONAL_REVIEWER_DESCRIPTIONS
>;
const ARTIFACT_TYPES = ["plan", "openspec", "linear"] as const;
const ROUTES = ["atomic_plan", "openspec_task"] as const;
const EXPECTED_HOSTS = ["github_pr", "gitlab_mr", "direct_publish"] as const;
type Command =
  | "detect"
  | "reviewer-template"
  | "validate-selection"
  | "handoff-template"
  | "validate-handoff"
  | "blueprint-template"
  | "validate-blueprint";

type ParsedHandoff = {
  status?: string;
  route?: string;
  artifact_type?: string;
  artifact_ref?: string;
  artifact_fingerprint?: string;
  approved_unit_id?: string;
  approved_unit_title?: string;
  approved_unit_scope?: string;
  acceptance: string[];
  verification: string[];
  files_or_areas: string[];
  out_of_scope: string[];
  expected_host?: string;
  completion_updates: string[];
  required_reviewers: string[];
  optional_reviewers: string[];
  blockers: string[];
};

type BlueprintTask = {
  id?: string;
  title?: string;
  deliverable?: string;
  acceptance: string[];
  verification: string[];
  dependencies: string[];
};

type ParsedBlueprint = {
  status?: string;
  suggested_id?: string;
  title?: string;
  objective?: string;
  scope_in: string[];
  scope_out: string[];
  affected_or_new_specs: string[];
  proposed_requirements: string[];
  tasks: BlueprintTask[];
  recommended_first_task?: string;
  reviewers_used: string[];
  findings: string[];
  risks: string[];
  blockers: string[];
  next_action?: string;
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-ready.ts <detect|reviewer-template|validate-selection|handoff-template|validate-handoff|blueprint-template|validate-blueprint> [artifact-ref] [--file path]",
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

  if (command === "blueprint-template") {
    printBlueprintTemplate();
    return;
  }

  if (command === "validate-blueprint") {
    validateBlueprint(readInput(args));
    return;
  }

  validateHandoff(readInput(args));
}

function detect(artifactRef?: string): void {
  const repoRoot = git(["rev-parse", "--show-toplevel"]) || process.cwd();
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const headSha = git(["rev-parse", "--short=12", "HEAD"]) || "unknown";
  const remotes = git(["remote", "-v"]) || "";
  const relativeArtifact = artifactRef
    ? toRepoRelative(repoRoot, artifactRef)
    : "";
  const artifactType = inferArtifactType(relativeArtifact || artifactRef || "");

  const result = {
    repo_root: repoRoot,
    branch,
    head_sha: headSha,
    remotes: remotes.split("\n").filter(Boolean),
    openspec_present: existsSync(join(repoRoot, "openspec")),
    plan_directories: [".agents/plans", "plans", "specs", "docs/specs"].filter(
      (path) => existsSync(join(repoRoot, path)),
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
    default: <why the selected reviewers are sufficient>

selection_rules:
  - Select docs-and-agent-alignment for reusable workflow, docs, skills, rules, automation prompt, background review, or PR/MR description contract changes.
  - Select agent-runtime-and-skill-compatibility for skill folder structure, skill metadata, bundled script, adapter prompt, internal subagent routing, install/update, or agent runtime changes.
  - Select only from optional_reviewer_catalog; do not invent reviewer names.
  - Use baseline_sufficient only after explaining why no optional catalog reviewer is needed.
`);
}

function printHandoffTemplate(): void {
  console.log(`## Readable Summary

- Status: ready for one atomic delivery unit.
- Route: atomic plan.
- Artifact: .agents/plans/example.md.
- Delivery: create one PR, MR, or direct-publish commit for the approved unit.
- Verification: run the listed checks before delivery.

\`\`\`yaml
plan_delivery_handoff:
  status: ready
  route: atomic_plan
  artifact:
    type: plan
    ref: .agents/plans/example.md
    fingerprint: <sha256 of artifact ref or current commit sha>
  approved_unit:
    id: atomic
    title: <short title>
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
    completion_updates: []
  review:
    required_reviewers:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    optional_reviewers: []
  blockers: []
\`\`\`
`);
}

function printBlueprintTemplate(): void {
  console.log(`## Readable Summary

- Status: ready to create an OpenSpec change.
- Change: <OpenSpec change title>.
- Scope: reviewed multi-deliverable work with explicit in/out boundaries.
- First task: 1.1.
- Next action: create the OpenSpec change files mechanically from this blueprint.

\`\`\`yaml
openspec_blueprint:
  status: ready_for_openspec
  change:
    suggested_id: <verb-noun-change-id>
    title: <OpenSpec change title>
    objective: <one paragraph objective>
  scope:
    in:
      - <included outcome>
    out:
      - <explicit non-goal>
  specs:
    affected_or_new:
      - <existing capability or new spec area>
    proposed_requirements:
      - <requirement summary for OpenSpec spec delta>
  tasks:
    - id: "1.1"
      title: <minor deliverable title>
      deliverable: <PR/MR-sized outcome>
      acceptance:
        - <observable result>
      verification:
        - <required command, check, or manual proof>
      dependencies: []
  recommended_first_task: "1.1"
  review:
    reviewers_used:
${BASELINE_REVIEWERS.map((reviewer) => `      - ${reviewer}`).join("\n")}
    findings:
      - <review finding that shaped the blueprint>
  risks:
    - <risk or rollout concern>
  blockers: []
  next_action: create_openspec_change
\`\`\`
`);
}

function validateHandoff(input: string): void {
  const errors = legacyErrors(input);
  const handoff = parseHandoff(input);

  requireValue(handoff.status, "status", errors);
  requireValue(handoff.route, "route", errors);
  requireValue(handoff.artifact_type, "artifact.type", errors);
  requireValue(handoff.artifact_ref, "artifact.ref", errors);
  requireValue(handoff.artifact_fingerprint, "artifact.fingerprint", errors);
  requireValue(handoff.approved_unit_id, "approved_unit.id", errors);
  requireValue(handoff.approved_unit_title, "approved_unit.title", errors);
  requireValue(handoff.approved_unit_scope, "approved_unit.scope", errors);
  requireValue(handoff.expected_host, "delivery.expected_host", errors);

  if (handoff.status && handoff.status !== "ready") {
    errors.push("status must be ready");
  }

  if (handoff.route && !includes(ROUTES, handoff.route)) {
    errors.push(`route must be one of: ${ROUTES.join(", ")}`);
  }

  if (
    handoff.artifact_type &&
    !includes(ARTIFACT_TYPES, handoff.artifact_type)
  ) {
    errors.push(`artifact.type must be one of: ${ARTIFACT_TYPES.join(", ")}`);
  }

  if (
    handoff.expected_host &&
    !includes(EXPECTED_HOSTS, handoff.expected_host)
  ) {
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

  if (handoff.files_or_areas.length === 0) {
    errors.push("constraints.files_or_areas must include at least one item");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!handoff.required_reviewers.includes(reviewer)) {
      errors.push(`required_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of [
    ...handoff.required_reviewers,
    ...handoff.optional_reviewers,
  ]) {
    if (!isKnownReviewer(reviewer)) {
      errors.push(`unknown reviewer: ${reviewer}`);
    }
  }

  for (const reviewer of handoff.optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(
        `optional_reviewers can include only optional reviewers: ${reviewer}`,
      );
    }
  }

  if (handoff.blockers.length > 0) {
    errors.push("blockers must be empty before status ready");
  }

  if (
    handoff.route === "atomic_plan" &&
    handoff.approved_unit_id !== "atomic"
  ) {
    errors.push("atomic_plan route requires approved_unit.id atomic");
  }

  if (handoff.route === "openspec_task") {
    if (handoff.artifact_type !== "openspec") {
      errors.push("openspec_task route requires artifact.type openspec");
    }
    if (handoff.completion_updates.length === 0) {
      errors.push(
        "openspec_task route requires delivery.completion_updates to mark the task checkbox complete in the same PR/MR",
      );
    }
  }

  if (handoff.artifact_ref && existsSync(handoff.artifact_ref)) {
    const expected = fingerprint(handoff.artifact_ref);
    if (
      handoff.artifact_fingerprint &&
      handoff.artifact_fingerprint !== expected
    ) {
      errors.push(
        "artifact.fingerprint must match current artifact.ref content",
      );
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

function validateBlueprint(input: string): void {
  const errors = legacyErrors(input);
  const blueprint = parseBlueprint(input);
  const taskIds = blueprint.tasks
    .map((task) => task.id)
    .filter((id): id is string => Boolean(id));

  requireValue(blueprint.status, "status", errors);
  requireValue(blueprint.suggested_id, "change.suggested_id", errors);
  requireValue(blueprint.title, "change.title", errors);
  requireValue(blueprint.objective, "change.objective", errors);
  requireValue(
    blueprint.recommended_first_task,
    "recommended_first_task",
    errors,
  );
  requireValue(blueprint.next_action, "next_action", errors);

  if (blueprint.status && blueprint.status !== "ready_for_openspec") {
    errors.push("status must be ready_for_openspec");
  }

  if (
    blueprint.suggested_id &&
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blueprint.suggested_id)
  ) {
    errors.push("change.suggested_id must be a lowercase kebab-case id");
  }

  if (blueprint.scope_in.length === 0) {
    errors.push("scope.in must include at least one item");
  }

  if (blueprint.affected_or_new_specs.length === 0) {
    errors.push("specs.affected_or_new must include at least one item");
  }

  if (blueprint.proposed_requirements.length === 0) {
    errors.push("specs.proposed_requirements must include at least one item");
  }

  if (blueprint.tasks.length === 0) {
    errors.push("tasks must include at least one minor deliverable");
  }

  const duplicateIds = taskIds.filter(
    (id, index) => taskIds.indexOf(id) !== index,
  );
  for (const id of new Set(duplicateIds)) {
    errors.push(`duplicate task id: ${id}`);
  }

  for (const [index, task] of blueprint.tasks.entries()) {
    const label = task.id ? `tasks.${task.id}` : `tasks[${index}]`;
    requireValue(task.id, `${label}.id`, errors);
    requireValue(task.title, `${label}.title`, errors);
    requireValue(task.deliverable, `${label}.deliverable`, errors);
    if (task.acceptance.length === 0) {
      errors.push(`${label}.acceptance must include at least one item`);
    }
    if (task.verification.length === 0) {
      errors.push(`${label}.verification must include at least one item`);
    }
    for (const dependency of task.dependencies) {
      if (!taskIds.includes(dependency)) {
        errors.push(
          `${label}.dependencies includes unknown task ${dependency}`,
        );
      }
    }
  }

  if (
    blueprint.recommended_first_task &&
    !taskIds.includes(blueprint.recommended_first_task)
  ) {
    errors.push("recommended_first_task must match an existing task id");
  }

  const recommendedTask = blueprint.tasks.find(
    (task) => task.id === blueprint.recommended_first_task,
  );
  if (recommendedTask && recommendedTask.dependencies.length > 0) {
    errors.push("recommended_first_task must not have dependencies");
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!blueprint.reviewers_used.includes(reviewer)) {
      errors.push(`reviewers_used must include ${reviewer}`);
    }
  }

  for (const reviewer of blueprint.reviewers_used) {
    if (!isKnownReviewer(reviewer)) {
      errors.push(`unknown reviewer: ${reviewer}`);
    }
  }

  if (blueprint.findings.length === 0) {
    errors.push("review.findings must include at least one item");
  }

  if (blueprint.blockers.length > 0) {
    errors.push("blockers must be empty before status ready_for_openspec");
  }

  if (
    blueprint.next_action &&
    blueprint.next_action !== "create_openspec_change"
  ) {
    errors.push("next_action must be create_openspec_change");
  }

  if (errors.length > 0) {
    console.error(
      `Invalid openspec_blueprint:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("openspec_blueprint valid");
}

function validateSelection(input: string): void {
  const selection = parseSelection(input);
  const errors: string[] = [];

  if (!selection.verdict) {
    errors.push("reviewer_selection_judge.verdict is required");
  } else if (
    !["baseline_sufficient", "add_optional_reviewers"].includes(
      selection.verdict,
    )
  ) {
    errors.push(
      "reviewer_selection_judge.verdict must be baseline_sufficient or add_optional_reviewers",
    );
  }

  for (const reviewer of BASELINE_REVIEWERS) {
    if (!selection.baseline_reviewers.includes(reviewer)) {
      errors.push(`baseline_reviewers must include ${reviewer}`);
    }
  }

  for (const reviewer of selection.baseline_reviewers) {
    if (!includes(BASELINE_REVIEWERS, reviewer)) {
      errors.push(
        `baseline_reviewers can include only baseline reviewers: ${reviewer}`,
      );
    }
  }

  if (selection.baseline_reviewers.length !== BASELINE_REVIEWERS.length) {
    errors.push(
      `baseline_reviewers must contain exactly: ${BASELINE_REVIEWERS.join(", ")}`,
    );
  }

  for (const reviewer of selection.selected_optional_reviewers) {
    if (!includes(OPTIONAL_REVIEWERS, reviewer)) {
      errors.push(
        `selected_optional_reviewers can include only optional reviewers: ${reviewer}`,
      );
    }
  }

  if (
    selection.verdict === "add_optional_reviewers" &&
    selection.selected_optional_reviewers.length === 0
  ) {
    errors.push(
      "add_optional_reviewers requires at least one selected_optional_reviewer",
    );
  }

  if (
    selection.verdict === "baseline_sufficient" &&
    selection.selected_optional_reviewers.length > 0
  ) {
    errors.push(
      "baseline_sufficient must not include selected_optional_reviewers",
    );
  }

  if (!selection.rationalePresent) {
    errors.push("rationale is required");
  }

  if (
    selection.verdict === "baseline_sufficient" &&
    !selection.rationale.default
  ) {
    errors.push("baseline_sufficient requires a rationale.default explanation");
  }

  for (const reviewer of selection.selected_optional_reviewers) {
    if (!selection.rationale[reviewer]) {
      errors.push(`selected optional reviewer requires rationale: ${reviewer}`);
    }
  }

  if (errors.length > 0) {
    console.error(
      `Invalid reviewer_selection_judge:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("reviewer_selection_judge valid");
}

function parseHandoff(input: string): ParsedHandoff {
  const body = extractYaml(input);
  const section = extractSection(body, "plan_delivery_handoff");
  const artifact = extractSection(section, "artifact");
  const approvedUnit = extractSection(section, "approved_unit");
  const constraints = extractSection(section, "constraints");
  const delivery = extractSection(section, "delivery");
  const review = extractSection(section, "review");

  return {
    status: scalar(section, "status"),
    route: scalar(section, "route"),
    artifact_type: scalar(artifact, "type"),
    artifact_ref: scalar(artifact, "ref"),
    artifact_fingerprint: scalar(artifact, "fingerprint"),
    approved_unit_id: scalar(approvedUnit, "id"),
    approved_unit_title: scalar(approvedUnit, "title"),
    approved_unit_scope: scalar(approvedUnit, "scope"),
    acceptance: list(approvedUnit, "acceptance"),
    verification: list(approvedUnit, "verification"),
    files_or_areas: list(constraints, "files_or_areas"),
    out_of_scope: list(constraints, "out_of_scope"),
    expected_host: scalar(delivery, "expected_host"),
    completion_updates: list(delivery, "completion_updates"),
    required_reviewers: list(review, "required_reviewers"),
    optional_reviewers: list(review, "optional_reviewers"),
    blockers: list(section, "blockers"),
  };
}

function parseBlueprint(input: string): ParsedBlueprint {
  const body = extractYaml(input);
  const section = extractSection(body, "openspec_blueprint");
  const change = extractSection(section, "change");
  const scope = extractSection(section, "scope");
  const specs = extractSection(section, "specs");
  const review = extractSection(section, "review");

  return {
    status: scalar(section, "status"),
    suggested_id: scalar(change, "suggested_id"),
    title: scalar(change, "title"),
    objective: scalar(change, "objective"),
    scope_in: list(scope, "in"),
    scope_out: list(scope, "out"),
    affected_or_new_specs: list(specs, "affected_or_new"),
    proposed_requirements: list(specs, "proposed_requirements"),
    tasks: parseBlueprintTasks(extractSection(section, "tasks")),
    recommended_first_task: scalar(section, "recommended_first_task"),
    reviewers_used: list(review, "reviewers_used"),
    findings: list(review, "findings"),
    risks: list(section, "risks"),
    blockers: list(section, "blockers"),
    next_action: scalar(section, "next_action"),
  };
}

function parseBlueprintTasks(input: string): BlueprintTask[] {
  const tasks: BlueprintTask[] = [];
  let current: BlueprintTask | undefined;
  let activeList:
    | keyof Pick<BlueprintTask, "acceptance" | "verification" | "dependencies">
    | null = null;

  for (const line of input.split(/\r?\n/)) {
    if (line.trim() === "") {
      continue;
    }

    const idMatch = line.match(/^- id:\s*(.+)$/);
    if (idMatch) {
      current = {
        id: cleanScalar(idMatch[1]),
        acceptance: [],
        dependencies: [],
        verification: [],
      };
      tasks.push(current);
      activeList = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const scalarMatch = line.match(/^ {2}(title|deliverable):\s*(.+)$/);
    if (scalarMatch) {
      current[scalarMatch[1] as "title" | "deliverable"] = cleanScalar(
        scalarMatch[2],
      );
      activeList = null;
      continue;
    }

    const inlineListMatch = line.match(
      /^ {2}(acceptance|verification|dependencies):\s*\[(.*?)\]\s*$/,
    );
    if (inlineListMatch) {
      const key = inlineListMatch[1] as
        | "acceptance"
        | "verification"
        | "dependencies";
      const raw = inlineListMatch[2].trim();
      current[key] = raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
      activeList = null;
      continue;
    }

    const listStartMatch = line.match(
      /^ {2}(acceptance|verification|dependencies):\s*$/,
    );
    if (listStartMatch) {
      activeList = listStartMatch[1] as typeof activeList;
      continue;
    }

    const itemMatch = line.match(/^ {4}- (.+)$/);
    if (itemMatch && activeList) {
      current[activeList].push(cleanScalar(itemMatch[1]));
    }
  }

  return tasks;
}

function parseSelection(input: string): {
  verdict?: string;
  baseline_reviewers: string[];
  selected_optional_reviewers: string[];
  rationalePresent: boolean;
  rationale: Record<string, string>;
} {
  const body = extractYaml(input);
  const section = extractSection(body, "reviewer_selection_judge");

  return {
    verdict: scalar(section, "verdict"),
    baseline_reviewers: list(section, "baseline_reviewers"),
    selected_optional_reviewers: list(section, "selected_optional_reviewers"),
    rationalePresent: hasRationale(section),
    rationale: map(section, "rationale"),
  };
}

function legacyErrors(input: string): string[] {
  const body = extractYaml(input);
  const errors: string[] = [];

  for (const root of LEGACY_PLAN_ROOTS) {
    if (hasSection(body, root)) {
      errors.push(
        `${root} is legacy; rerun plan-ready to produce plan_delivery_handoff or openspec_blueprint`,
      );
    }
  }

  for (const key of LEGACY_PLAN_KEYS) {
    if (hasKey(body, key)) {
      errors.push(
        `${key} is legacy; rerun plan-ready to produce plan_delivery_handoff or openspec_blueprint`,
      );
    }
  }

  return errors;
}

function fingerprint(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isCommand(command: string | undefined): command is Command {
  return [
    "detect",
    "reviewer-template",
    "validate-selection",
    "handoff-template",
    "validate-handoff",
    "blueprint-template",
    "validate-blueprint",
  ].includes(command ?? "");
}

function isKnownReviewer(reviewer: string): boolean {
  return (
    includes(BASELINE_REVIEWERS, reviewer) ||
    includes(OPTIONAL_REVIEWERS, reviewer)
  );
}

function inferArtifactType(artifactRef: string): string | null {
  if (!artifactRef) {
    return null;
  }

  if (
    artifactRef.includes("openspec/changes/") ||
    artifactRef.startsWith("openspec:")
  ) {
    return "openspec";
  }

  if (
    /^[A-Z][A-Z0-9]+-\d+$/.test(artifactRef) ||
    artifactRef.includes("linear.app")
  ) {
    return "linear";
  }

  if (
    artifactRef.endsWith(".md") ||
    artifactRef.includes(".agents/plans/") ||
    artifactRef.includes("plans/")
  ) {
    return "plan";
  }

  return null;
}

function toRepoRelative(repoRoot: string, artifactRef: string): string {
  const absolute = resolve(artifactRef);
  const relativePath = relative(repoRoot, absolute);
  return relativePath.startsWith("..") ? artifactRef : relativePath;
}

function git(args: string[]): string | null {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

function map(input: string, key: string): Record<string, string> {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return {};
  }

  const keyIndent = lines[keyIndex].match(/^(\s*)/)?.[1].length ?? 0;
  const values: Record<string, string> = {};
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }
    const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (indent <= keyIndent) {
      break;
    }
    const item = line.trim().match(/^([^:]+):\s*(.+)$/);
    if (item) {
      values[cleanScalar(item[1])] = cleanScalar(item[2]);
    }
  }

  return values;
}

function hasRationale(input: string): boolean {
  return Object.keys(map(input, "rationale")).length > 0;
}

main();
