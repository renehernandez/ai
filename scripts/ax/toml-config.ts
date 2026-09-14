import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import type {
  CodexConfigValidator,
  ManagedJsonValue,
  ManagedLeaf,
} from "./config-sync.ts";
import { isPlainObject, isScalar, valueAtPath } from "./json-config.ts";

export function flattenManagedLeaves(
  tool: string,
  value: unknown,
  path: string[] = [],
): ManagedLeaf[] {
  if (isScalar(value)) {
    if (path.length < 2) {
      throw new Error(
        `managed_config_path_invalid: ${tool}.${path.join(".") || "<root>"}`,
      );
    }
    return [{ path, value }];
  }
  if (!isPlainObject(value)) {
    throw new Error(
      `managed_config_value_invalid: ${tool}.${path.join(".") || "<root>"}`,
    );
  }
  const leaves: ManagedLeaf[] = [];
  for (const [key, child] of Object.entries(value).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (!/^[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error(
        `managed_config_key_invalid: ${tool}.${[...path, key].join(".")}`,
      );
    }
    leaves.push(...flattenManagedLeaves(tool, child, [...path, key]));
  }
  return leaves;
}

export function updateTomlDocument(
  content: string,
  parsed: Record<string, unknown>,
  leaves: ManagedLeaf[],
): string {
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content === "" ? [] : content.split(/\r?\n/);
  if (lines.at(-1) === "") {
    lines.pop();
  }
  const grouped = new Map<string, ManagedLeaf[]>();
  for (const leaf of leaves) {
    const table = leaf.path.slice(0, -1).join(".");
    grouped.set(table, [...(grouped.get(table) ?? []), leaf]);
  }
  for (const [table, tableLeaves] of [...grouped.entries()].sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    updateTomlTable(lines, table, tableLeaves, parsed);
  }
  return `${lines.join(eol)}${eol}`;
}

function updateTomlTable(
  lines: string[],
  table: string,
  leaves: ManagedLeaf[],
  parsed: Record<string, unknown>,
): void {
  const headers = tableHeaders(lines).filter((header) => header.name === table);
  if (headers.length > 1) {
    throw new Error(`managed_config_table_ambiguous: ${table}`);
  }
  if (headers.length === 0) {
    for (const leaf of leaves) {
      if (valueAtPath(parsed, leaf.path).found) {
        throw new Error(
          `managed_config_path_uneditable: ${leaf.path.join(".")}`,
        );
      }
    }
    if (lines.length > 0 && lines.at(-1)?.trim() !== "") {
      lines.push("");
    }
    lines.push(`[${table}]`);
    for (const leaf of leaves) {
      lines.push(`${leaf.path.at(-1)} = ${renderScalar(leaf.value)}`);
    }
    return;
  }

  for (const leaf of leaves) {
    const header = tableHeaders(lines).find((entry) => entry.name === table);
    if (!header) {
      throw new Error(`managed_config_table_missing: ${table}`);
    }
    const end = tableEnd(lines, header.line);
    const key = leaf.path.at(-1) ?? "";
    const matches: number[] = [];
    for (let line = header.line + 1; line < end; line += 1) {
      if (directKey(lines[line]) === key) {
        matches.push(line);
      }
    }
    if (matches.length > 1) {
      throw new Error(`managed_config_path_ambiguous: ${leaf.path.join(".")}`);
    }
    if (matches.length === 1) {
      lines[matches[0]] = replaceScalarAssignment(
        lines[matches[0]],
        key,
        leaf.value,
        leaf.path.join("."),
      );
      continue;
    }
    if (valueAtPath(parsed, leaf.path).found) {
      throw new Error(`managed_config_path_uneditable: ${leaf.path.join(".")}`);
    }
    let insertion = end;
    while (insertion > header.line + 1 && lines[insertion - 1]?.trim() === "") {
      insertion -= 1;
    }
    lines.splice(insertion, 0, `${key} = ${renderScalar(leaf.value)}`);
  }
}

function tableHeaders(lines: string[]): Array<{ name: string; line: number }> {
  const headers: Array<{ name: string; line: number }> = [];
  for (const [line, content] of lines.entries()) {
    const match = content.match(/^\s*\[([^[]+)]\s*(?:#.*)?$/);
    if (match) {
      headers.push({ name: match[1].trim(), line });
    }
  }
  return headers;
}

function tableEnd(lines: string[], headerLine: number): number {
  const nextHeader = lines.findIndex(
    (line, index) => index > headerLine && isTableBoundary(line),
  );
  return nextHeader === -1 ? lines.length : nextHeader;
}

function isTableBoundary(line: string): boolean {
  return /^\s*(?:\[\[.*\]\]|\[.*\])\s*(?:#.*)?$/.test(line);
}

function directKey(line: string): string | undefined {
  return line.match(/^\s*([A-Za-z0-9_-]+)\s*=/)?.[1];
}

function replaceScalarAssignment(
  line: string,
  key: string,
  value: ManagedJsonValue,
  path: string,
): string {
  const match = line.match(
    new RegExp(`^(\\s*${escapeRegExp(key)}\\s*=\\s*)(.*)$`),
  );
  if (!match) {
    throw new Error(`managed_config_path_uneditable: ${path}`);
  }
  const comment = tomlCommentSuffix(match[2]);
  const current = match[2].slice(0, match[2].length - comment.length).trim();
  if (
    current.startsWith("[") ||
    current.startsWith("{") ||
    current.startsWith('"""') ||
    current.startsWith("'''")
  ) {
    throw new Error(`managed_config_path_uneditable: ${path}`);
  }
  return `${match[1]}${renderScalar(value)}${comment}`;
}

function tomlCommentSuffix(value: string): string {
  let quote: '"' | "'" | undefined;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote === '"' && escaped) {
      escaped = false;
      continue;
    }
    if (quote === '"' && character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = quote === character ? undefined : (quote ?? character);
      continue;
    }
    if (character === "#" && !quote) {
      let start = index;
      while (start > 0 && /\s/.test(value[start - 1])) {
        start -= 1;
      }
      return value.slice(start);
    }
  }
  return "";
}

function renderScalar(value: ManagedJsonValue): string {
  if (!isScalar(value))
    throw new Error("managed_config_value_invalid: TOML requires scalar");
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function validateWithCodex(
  content: string,
  validator: CodexConfigValidator,
): void {
  const candidateHome = mkdtempSync(join(tmpdir(), "ax-codex-config-"));
  try {
    writeFileSync(join(candidateHome, "config.toml"), content, {
      encoding: "utf-8",
      mode: 0o600,
    });
    const result = validator(candidateHome);
    if (result.status !== 0) {
      const detail =
        result.error ||
        result.stderr?.trim() ||
        result.stdout?.trim() ||
        "unknown failure";
      throw new Error(`managed_config_validator_failed: ${detail}`);
    }
  } finally {
    rmSync(candidateHome, { force: true, recursive: true });
  }
}

export function runCodexConfigValidator(
  candidateHome: string,
): ReturnType<CodexConfigValidator> {
  const result = spawnSync("codex", ["features", "list"], {
    encoding: "utf-8",
    env: {
      ...process.env,
      CODEX_HOME: candidateHome,
      TERM: process.env.TERM || "xterm-256color",
    },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 60_000,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error?.message,
  };
}

export function parseToml(
  content: string,
  path: string,
): Record<string, unknown> {
  if (content === "") {
    return {};
  }
  try {
    return parse(content) as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `managed_config_toml_invalid: ${path}: ${errorMessage(error)}`,
    );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
