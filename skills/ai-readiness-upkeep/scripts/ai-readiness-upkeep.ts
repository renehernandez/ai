#!/usr/bin/env tsx
import { readFileSync } from "node:fs";

const VERDICTS = ["passed", "findings", "blocked", "not_applicable"] as const;
const LANES = ["task_command", "local_hook", "ci", "release_or_deploy", "scheduled", "manual", "none"] as const;
const ACTION_TYPES = ["add_verification", "wire_automation", "update_intent", "create_skill", "defer"] as const;
const BLOCKING_REQUIRED_FIELDS = [
  "title",
  "contract",
  "evidence",
  "required_change",
  "action_type",
  "lane",
  "target_surface",
] as const;
const NONBLOCKING_REQUIRED_FIELDS = ["title", "evidence", "suggestion", "action_type", "lane"] as const;
const DEFERRED_REQUIRED_FIELDS = ["item", "reason"] as const;

type Command = "report-template" | "validate-report";
type Finding = Record<string, string>;

function main(): void {
  const [command, ...args] = process.argv.slice(2);

  if (!isCommand(command)) {
    fail("Usage: ai-readiness-upkeep.ts <report-template|validate-report> [--file path]");
  }

  if (command === "report-template") {
    printReportTemplate();
    return;
  }

  validateReport(readInput(args));
}

function printReportTemplate(): void {
  console.log(`ai_readiness_upkeep_report:
  verdict: passed | findings | blocked | not_applicable
  checked:
    surfaces:
      - source
      - tests
      - task_commands
      - hooks
      - ci
      - generated_artifacts
      - schemas_or_contracts
      - infra_or_deploy
      - agent_instructions
      - review_rubrics
    evidence:
      - path-or-command: why checked
  findings:
    blocking:
      - title: <short title>
        contract: <new or changed expectation>
        evidence: <diff, file, review comment, failure, or plan section>
        required_change: <implementer action>
        action_type: add_verification | wire_automation | update_intent | create_skill | defer
        lane: task_command | local_hook | ci | release_or_deploy | scheduled
        target_surface: <path, command, or config>
    nonblocking:
      - title: <short title>
        evidence: <evidence>
        suggestion: <implementer action>
        action_type: add_verification | wire_automation | update_intent | create_skill | defer
        lane: task_command | local_hook | ci | release_or_deploy | scheduled | manual | none
  deferred:
    - item: <candidate>
      reason: <why not part of this slice>
`);
}

function validateReport(input: string): void {
  const body = extractYaml(input);
  const section = extractSection(body, "ai_readiness_upkeep_report");
  const errors: string[] = [];
  const checkedSection = nestedSection(section, "checked");
  const findingsSection = nestedSection(section, "findings");
  const verdict = scalar(section, "verdict");
  const surfaces = checkedSection.found ? listValues(checkedSection.body, "surfaces") : [];
  const evidence = checkedSection.found ? listValues(checkedSection.body, "evidence") : [];
  const blockingFindings = findingsSection.found ? objectList(findingsSection.body, "blocking") : [];
  const nonblockingFindings = findingsSection.found ? objectList(findingsSection.body, "nonblocking") : [];
  const deferredItems = objectList(section, "deferred");

  if (!verdict) {
    errors.push("verdict is required");
  } else if (!includes(VERDICTS, verdict)) {
    errors.push(`verdict must be one of: ${VERDICTS.join(", ")}`);
  }

  if (!checkedSection.found) {
    errors.push("checked is required");
  } else if (surfaces.length === 0) {
    errors.push("checked.surfaces must include at least one surface");
  }

  if (checkedSection.found && evidence.length === 0) {
    errors.push("checked.evidence must include at least one evidence item");
  }

  if (!findingsSection.found) {
    errors.push("findings is required");
  } else {
    if (!hasKey(findingsSection.body, "blocking")) {
      errors.push("findings.blocking is required");
    }
    if (!hasKey(findingsSection.body, "nonblocking")) {
      errors.push("findings.nonblocking is required");
    }
  }

  if (!hasKey(section, "deferred")) {
    errors.push("deferred is required");
  }

  validateFindings("blocking", blockingFindings, BLOCKING_REQUIRED_FIELDS, errors);
  validateFindings("nonblocking", nonblockingFindings, NONBLOCKING_REQUIRED_FIELDS, errors);
  validateFindings("deferred", deferredItems, DEFERRED_REQUIRED_FIELDS, errors);

  for (const finding of [...blockingFindings, ...nonblockingFindings]) {
    validateKnownValue(finding, "lane", LANES, "lane", errors);
    validateKnownValue(finding, "action_type", ACTION_TYPES, "action_type", errors);
  }

  for (const finding of blockingFindings) {
    if (finding.lane === "manual" || finding.lane === "none") {
      errors.push(`blocking finding lane must be enforceable, not ${finding.lane}: ${finding.title}`);
    }
  }

  if ((verdict === "passed" || verdict === "findings" || verdict === "not_applicable") && blockingFindings.length > 0) {
    errors.push(`${verdict} reports must not include blocking findings`);
  }

  if ((verdict === "passed" || verdict === "not_applicable") && nonblockingFindings.length > 0) {
    errors.push(`${verdict} reports must not include nonblocking findings`);
  }

  if ((verdict === "passed" || verdict === "not_applicable") && deferredItems.length > 0) {
    errors.push(`${verdict} reports must not include deferred items`);
  }

  if (verdict === "blocked" && blockingFindings.length === 0) {
    errors.push("blocked reports must include at least one blocking finding");
  }

  if (errors.length > 0) {
    console.error(`Invalid ai_readiness_upkeep_report:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exit(1);
  }

  console.log("ai_readiness_upkeep_report valid");
}

function validateFindings(
  label: string,
  findings: Finding[],
  requiredFields: readonly string[],
  errors: string[],
): void {
  for (const [index, finding] of findings.entries()) {
    for (const field of requiredFields) {
      if (!finding[field] || finding[field].startsWith("<")) {
        errors.push(`${label}[${index}].${field} is required`);
      }
    }
  }
}

function validateKnownValue<const T extends readonly string[]>(
  finding: Finding,
  key: string,
  values: T,
  label: string,
  errors: string[],
): void {
  const value = finding[key];
  if (value && !includes(values, value)) {
    errors.push(`${label} must be one of: ${values.join(", ")} (${value})`);
  }
}

function objectList(input: string, key: string): Finding[] {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(?:\\[\\])?\\s*$`)));
  if (keyIndex === -1 || lines[keyIndex].includes("[]")) {
    return [];
  }

  const keyIndent = indentOf(lines[keyIndex]);
  const findings: Finding[] = [];
  let current: Finding | null = null;
  let itemIndent = 0;

  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }

    const indent = indentOf(line);
    if (indent <= keyIndent) {
      break;
    }

    const item = line.match(/^\s*-\s+([a-zA-Z0-9_]+):\s*(.*?)\s*$/);
    if (item) {
      current = { [item[1]]: cleanScalar(item[2]) };
      itemIndent = indent;
      findings.push(current);
      continue;
    }

    if (!current || indent <= itemIndent) {
      continue;
    }

    const field = line.match(/^\s*([a-zA-Z0-9_]+):\s*(.*?)\s*$/);
    if (field) {
      current[field[1]] = cleanScalar(field[2]);
    }
  }

  return findings;
}

function nestedSection(input: string, key: string): { body: string; found: boolean } {
  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(?:\\[\\])?\\s*$`)));
  if (keyIndex === -1 || lines[keyIndex].includes("[]")) {
    return { body: "", found: keyIndex !== -1 };
  }

  const keyIndent = indentOf(lines[keyIndex]);
  const childIndent = keyIndent + 2;
  const nestedLines: string[] = [];

  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      nestedLines.push("");
      continue;
    }

    const indent = indentOf(line);
    if (indent <= keyIndent) {
      break;
    }

    nestedLines.push(line.startsWith(" ".repeat(childIndent)) ? line.slice(childIndent) : line.trimStart());
  }

  return { body: nestedLines.join("\n"), found: true };
}

function hasKey(input: string, key: string): boolean {
  return input.split(/\r?\n/).some((line) => line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(?:\\[\\])?\\s*$`)));
}

function listValues(input: string, key: string): string[] {
  const inline = input.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"));
  if (inline) {
    const raw = inline[1].trim();
    return raw ? raw.split(",").map(cleanScalar).filter(Boolean) : [];
  }

  const lines = input.split(/\r?\n/);
  const keyIndex = lines.findIndex((line) => line.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`)));
  if (keyIndex === -1) {
    return [];
  }

  const keyIndent = indentOf(lines[keyIndex]);
  const values: string[] = [];
  for (const line of lines.slice(keyIndex + 1)) {
    if (line.trim() === "") {
      continue;
    }

    const indent = indentOf(line);
    if (indent <= keyIndent) {
      break;
    }

    const item = line.match(/^\s*-\s+(.+?)\s*$/);
    if (item) {
      values.push(cleanScalar(item[1]));
    }
  }

  return values.filter(Boolean);
}

function scalar(input: string, key: string): string | undefined {
  const match = input.match(new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"));
  if (!match) {
    return undefined;
  }

  return cleanScalar(match[1]);
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

function isCommand(command: string | undefined): command is Command {
  return ["report-template", "validate-report"].includes(command ?? "");
}

function includes<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value as T[number]);
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function indentOf(line: string): number {
  return line.match(/^ */)?.[0].length ?? 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

main();
