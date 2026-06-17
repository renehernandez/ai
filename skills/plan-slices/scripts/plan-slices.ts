#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REVIEW_STATUSES = ["pass", "blocked"] as const;
const REVIEW_MODES = ["create", "audit"] as const;
const REVIEW_MODE_RATIONALE_SOURCES = [
  "created_from_unsliced_artifact",
  "existing_sliced_plan",
  "atomic_change",
] as const;
const GATE_STATUSES = ["pass", "blocked"] as const;
const MIN_CREATED_SLICES = 3;
const BROAD_SINGLE_SLICE_TERMS = [
  "v1",
  "roadmap",
  "platform",
  "foundation",
  "feature",
  "generation",
  "architecture",
  "framework",
] as const;
const BROAD_SINGLE_SLICE_TERMS_MESSAGE = BROAD_SINGLE_SLICE_TERMS.join(", ");
const SLICE_GATES = [
  "observable_outcome",
  "bounded_scope",
  "sequencing",
  "verification",
  "refactoring_reuse",
  "delivery_fit",
] as const;

type Command = "fingerprint" | "review-template" | "validate-review";

type ParsedSlice = {
  id?: string;
  title?: string;
} & Partial<Record<(typeof SLICE_GATES)[number], string>>;

type ParsedReview = {
  status?: string;
  artifact_ref?: string;
  artifact_fingerprint?: string;
  mode?: string;
  review_mode_rationale: {
    source?: string;
    reason?: string;
  };
  slices: ParsedSlice[];
  blocking_findings: string[];
  warnings: string[];
};

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail(
      "Usage: plan-slices.ts <fingerprint artifact-ref|review-template|validate-review> [--file path]",
    );
  }

  if (command === "fingerprint") {
    const artifactRef = args[0];
    if (!artifactRef) {
      fail("fingerprint requires artifact-ref");
    }
    console.log(fingerprint(artifactRef));
    return;
  }

  if (command === "review-template") {
    printReviewTemplate();
    return;
  }

  validateReview(readInput(args));
}

function printReviewTemplate(): void {
  console.log(`slice_plan_review:
  status: pass
  artifact_ref: docs/plans/example.md
  artifact_fingerprint: <sha256 of artifact_ref>
  mode: create
  review_mode_rationale:
    source: created_from_unsliced_artifact
    reason: <why this plan needed a new multi-slice breakdown>
  slices:
    - id: slice-01
      title: <first end-to-end sliver>
      observable_outcome: pass
      bounded_scope: pass
      sequencing: pass
      verification: pass
      refactoring_reuse: pass
      delivery_fit: pass
    - id: slice-02
      title: <next bounded capability>
      observable_outcome: pass
      bounded_scope: pass
      sequencing: pass
      verification: pass
      refactoring_reuse: pass
      delivery_fit: pass
    - id: slice-03
      title: <third bounded capability>
      observable_outcome: pass
      bounded_scope: pass
      sequencing: pass
      verification: pass
      refactoring_reuse: pass
      delivery_fit: pass
  blocking_findings: []
  warnings: []
`);
}

function validateReview(input: string): void {
  const errors = validateSliceReviewInput(input);

  if (errors.length > 0) {
    console.error(
      `Invalid slice_plan_review:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
    process.exit(1);
  }

  console.log("slice_plan_review valid");
}

export function validateSliceReviewInput(input: string): string[] {
  return validateParsedReview(parseReview(input));
}

export function sliceIdsFromReviewInput(input: string): string[] {
  return parseReview(input)
    .slices.map((slice) => slice.id)
    .filter((id): id is string => Boolean(id));
}

function validateParsedReview(review: ParsedReview): string[] {
  const errors: string[] = [];

  requireValue(review.status, "status", errors);
  requireValue(review.artifact_ref, "artifact_ref", errors);
  requireValue(review.artifact_fingerprint, "artifact_fingerprint", errors);
  requireValue(review.mode, "mode", errors);
  requireValue(
    review.review_mode_rationale.source,
    "review_mode_rationale.source",
    errors,
  );
  requireValue(
    review.review_mode_rationale.reason,
    "review_mode_rationale.reason",
    errors,
  );

  if (review.status && !includes(REVIEW_STATUSES, review.status)) {
    errors.push(`status must be one of: ${REVIEW_STATUSES.join(", ")}`);
  }

  if (review.mode && !includes(REVIEW_MODES, review.mode)) {
    errors.push(`mode must be one of: ${REVIEW_MODES.join(", ")}`);
  }

  if (
    review.review_mode_rationale.source &&
    !includes(
      REVIEW_MODE_RATIONALE_SOURCES,
      review.review_mode_rationale.source,
    )
  ) {
    errors.push(
      `review_mode_rationale.source must be one of: ${REVIEW_MODE_RATIONALE_SOURCES.join(", ")}`,
    );
  }

  validateReviewModeRationale(review, errors);

  if (review.artifact_ref && !existsSync(review.artifact_ref)) {
    errors.push(`artifact_ref file is unavailable: ${review.artifact_ref}`);
  }

  if (
    review.artifact_ref &&
    existsSync(review.artifact_ref) &&
    review.artifact_fingerprint &&
    review.artifact_fingerprint !== fingerprint(review.artifact_ref)
  ) {
    errors.push("artifact_fingerprint must match current artifact_ref content");
  }

  if (review.slices.length === 0) {
    errors.push("slices must include at least one slice");
  }

  if (
    review.status === "pass" &&
    review.review_mode_rationale.source === "created_from_unsliced_artifact" &&
    review.slices.length < MIN_CREATED_SLICES
  ) {
    errors.push(
      `created_from_unsliced_artifact pass reviews must include at least ${MIN_CREATED_SLICES} implementation slices`,
    );
  }

  let blockedGateCount = 0;
  const seenSliceIds = new Set<string>();
  review.slices.forEach((slice, index) => {
    requireValue(slice.id, `slices[${index}].id`, errors);
    requireValue(slice.title, `slices[${index}].title`, errors);

    if (slice.id) {
      if (seenSliceIds.has(slice.id)) {
        errors.push(`slices must not include duplicate ids: ${slice.id}`);
      }
      seenSliceIds.add(slice.id);
    }

    for (const gate of SLICE_GATES) {
      const value = slice[gate];
      requireValue(value, `slices[${index}].${gate}`, errors);

      if (value && !includes(GATE_STATUSES, value)) {
        errors.push(
          `slices[${index}].${gate} must be one of: ${GATE_STATUSES.join(", ")}`,
        );
      }

      if (value === "blocked") {
        blockedGateCount += 1;
      }
    }
  });

  if (review.status === "pass") {
    if (review.blocking_findings.length > 0) {
      errors.push("pass reviews must not include blocking_findings");
    }
    if (blockedGateCount > 0) {
      errors.push("pass reviews must not include blocked slice gates");
    }
    if (
      review.slices.length === 1 &&
      review.review_mode_rationale.source ===
        "created_from_unsliced_artifact" &&
      looksBroadSingleSlice(review.slices[0].title)
    ) {
      errors.push(
        `created_from_unsliced_artifact one-slice reviews must not use broad title terms: ${BROAD_SINGLE_SLICE_TERMS_MESSAGE}`,
      );
    }
  }

  if (
    review.status === "blocked" &&
    review.blocking_findings.length === 0 &&
    blockedGateCount === 0
  ) {
    errors.push(
      "blocked reviews require blocking_findings or at least one blocked slice gate",
    );
  }

  return errors;
}

function parseReview(input: string): ParsedReview {
  const body = extractYaml(input);
  const section = extractSection(body, "slice_plan_review");

  return {
    status: scalar(section, "status"),
    artifact_ref: scalar(section, "artifact_ref"),
    artifact_fingerprint: scalar(section, "artifact_fingerprint"),
    mode: scalar(section, "mode"),
    review_mode_rationale: parseReviewModeRationale(section),
    slices: listObjects(section, "slices").map(parseSlice),
    blocking_findings: list(section, "blocking_findings"),
    warnings: list(section, "warnings"),
  };
}

function parseReviewModeRationale(
  input: string,
): ParsedReview["review_mode_rationale"] {
  const section = extractSection(input, "review_mode_rationale");

  return {
    source: scalar(section, "source"),
    reason: scalar(section, "reason"),
  };
}

function validateReviewModeRationale(
  review: ParsedReview,
  errors: string[],
): void {
  const source = review.review_mode_rationale.source;

  if (!source || !review.mode) {
    return;
  }

  if (source === "created_from_unsliced_artifact" && review.mode !== "create") {
    errors.push("created_from_unsliced_artifact requires mode create metadata");
  }

  if (
    (source === "existing_sliced_plan" || source === "atomic_change") &&
    review.mode !== "audit"
  ) {
    errors.push(`${source} requires mode audit metadata`);
  }

  if (source === "atomic_change" && review.slices.length > 1) {
    errors.push("atomic_change rationale requires exactly one slice");
  }
}

function looksBroadSingleSlice(title?: string): boolean {
  const normalizedTitle = (title ?? "").toLowerCase();

  return BROAD_SINGLE_SLICE_TERMS.some((term) =>
    normalizedTitle.includes(term),
  );
}

function parseSlice(input: string): ParsedSlice {
  return {
    id: scalar(input, "id"),
    title: scalar(input, "title"),
    observable_outcome: scalar(input, "observable_outcome"),
    bounded_scope: scalar(input, "bounded_scope"),
    sequencing: scalar(input, "sequencing"),
    verification: scalar(input, "verification"),
    refactoring_reuse: scalar(input, "refactoring_reuse"),
    delivery_fit: scalar(input, "delivery_fit"),
  };
}

export function fingerprint(artifactRef: string): string {
  return createHash("sha256").update(readFileSync(artifactRef)).digest("hex");
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

function listObjects(input: string, key: string): string[] {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) =>
    line.match(new RegExp(`^${escapeRegExp(key)}:\\s*$`)),
  );
  if (keyIndex === -1) {
    return [];
  }

  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines.slice(keyIndex + 1)) {
    if (!line.startsWith("  ")) {
      break;
    }

    const item = line.match(/^ {2}- (.+)$/);
    if (item) {
      current = [item[1]];
      blocks.push(current);
      continue;
    }

    if (current && line.startsWith("    ")) {
      current.push(line.replace(/^ {4}/, ""));
    }
  }

  return blocks.map((block) => block.join("\n"));
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
  return ["fingerprint", "review-template", "validate-review"].includes(
    command ?? "",
  );
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main();
}
