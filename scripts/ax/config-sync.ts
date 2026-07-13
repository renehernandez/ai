import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse } from "smol-toml";
import {
  type AxRuntimeConfig,
  sourceIsVerifiedForLiveMutation,
} from "./runtime-sync.ts";

export type ManagedConfigScalar = string | number | boolean;

export type ManagedConfigDrift = {
  path: string;
  expected: ManagedConfigScalar;
  actual?: ManagedConfigScalar | null;
  reason: "missing" | "different";
};

export type ManagedConfigToolReport = {
  target: string;
  managedPaths: string[];
  drift: ManagedConfigDrift[];
  validator: "not_run" | "passed";
};

export type ManagedConfigReport = {
  ok: boolean;
  tools: Record<string, ManagedConfigToolReport>;
  findings: string[];
};

export type ManagedConfigSyncResult = {
  status: "synchronized";
  changedPaths: string[];
  tools: Record<string, ManagedConfigToolReport>;
};

export type CodexConfigValidator = (candidateHome: string) => {
  status: number | null;
  stdout?: string;
  stderr?: string;
  error?: string;
};

export type ManagedConfigOptions = {
  sourceRoot: string;
  config: AxRuntimeConfig;
  runtimeRoot?: string;
  home?: string;
  liveHome?: string;
  sourceVerified?: boolean;
  validator?: CodexConfigValidator;
};

type ManagedLeaf = {
  path: string[];
  value: ManagedConfigScalar;
};

type ResolvedToolConfig = {
  name: "codex";
  target: string;
  leaves: ManagedLeaf[];
};

type PreparedCandidate = {
  tool: ResolvedToolConfig;
  original?: string;
  originalMode?: number;
  candidate: string;
  report: ManagedConfigToolReport;
};

export type PreparedManagedConfigs = {
  candidates: PreparedCandidate[];
  report: ManagedConfigReport;
};

const CODEX_TARGET = "~/.codex/config.toml";

export function inspectManagedConfigs(
  input: ManagedConfigOptions,
): ManagedConfigReport {
  const tools: Record<string, ManagedConfigToolReport> = {};
  const findings: string[] = [];
  try {
    for (const tool of resolveToolConfigs(input)) {
      const observed = readObserved(tool.target);
      const parsed = parseToml(observed.content ?? "", tool.target);
      const drift = compareLeaves(parsed, tool.leaves);
      tools[tool.name] = {
        target: tool.target,
        managedPaths: tool.leaves.map((leaf) => leaf.path.join(".")),
        drift,
        validator: "not_run",
      };
      for (const entry of drift) {
        findings.push(
          `managed_config_drift: ${tool.name}.${entry.path} is ${entry.reason}`,
        );
      }
    }
  } catch (error) {
    findings.push(errorMessage(error));
  }
  return { ok: findings.length === 0, tools, findings };
}

export function validateManagedConfigs(
  input: ManagedConfigOptions,
): ManagedConfigReport {
  const report = inspectManagedConfigs(input);
  if (!report.ok) {
    return report;
  }
  const prepared = prepareCore(input, false);
  return prepared.report;
}

export function prepareManagedConfigs(
  input: ManagedConfigOptions,
): PreparedManagedConfigs {
  return prepareCore(input, true);
}

export function applyPreparedManagedConfigs(
  prepared: PreparedManagedConfigs,
  hooks: { beforeApply?: (target: string) => void } = {},
): ManagedConfigSyncResult {
  const changedPaths: string[] = [];
  for (const entry of prepared.candidates) {
    if (entry.candidate === (entry.original ?? "")) {
      continue;
    }
    hooks.beforeApply?.(entry.tool.target);
    assertOriginalUnchanged(entry);
    mkdirSync(dirname(entry.tool.target), { recursive: true });
    assertTargetSafe(
      entry.tool.target,
      resolveHomeFromTarget(entry.tool.target),
    );
    const temporary = join(
      dirname(entry.tool.target),
      `.config.toml.ax-sync-${process.pid}-${Math.random().toString(16).slice(2)}`,
    );
    try {
      writeFileSync(temporary, entry.candidate, {
        encoding: "utf-8",
        mode: entry.originalMode ?? 0o600,
      });
      chmodSync(temporary, entry.originalMode ?? 0o600);
      assertOriginalUnchanged(entry);
      renameSync(temporary, entry.tool.target);
      changedPaths.push(entry.tool.target);
    } finally {
      rmSync(temporary, { force: true });
    }
  }
  return {
    status: "synchronized",
    changedPaths,
    tools: prepared.report.tools,
  };
}

export function syncManagedConfigs(
  input: ManagedConfigOptions,
): ManagedConfigSyncResult {
  return applyPreparedManagedConfigs(prepareManagedConfigs(input));
}

function prepareCore(
  input: ManagedConfigOptions,
  mutation: boolean,
): PreparedManagedConfigs {
  const candidates: PreparedCandidate[] = [];
  const tools: Record<string, ManagedConfigToolReport> = {};
  const configs = resolveToolConfigs(input);
  if (mutation && configs.length > 0) {
    assertConfigMutationSource(input, configs);
  }
  for (const tool of configs) {
    const observed = readObserved(tool.target);
    const parsed = parseToml(observed.content ?? "", tool.target);
    const drift = compareLeaves(parsed, tool.leaves);
    const candidate =
      drift.length === 0
        ? (observed.content ?? "")
        : updateTomlDocument(observed.content ?? "", parsed, tool.leaves);
    const parsedCandidate = parseToml(candidate, `${tool.target} candidate`);
    const candidateDrift = compareLeaves(parsedCandidate, tool.leaves);
    if (candidateDrift.length > 0) {
      throw new Error(
        `managed_config_candidate_drift: ${candidateDrift
          .map((entry) => entry.path)
          .join(", ")}`,
      );
    }
    validateWithCodex(candidate, input.validator ?? runCodexConfigValidator);
    const report: ManagedConfigToolReport = {
      target: tool.target,
      managedPaths: tool.leaves.map((leaf) => leaf.path.join(".")),
      drift,
      validator: "passed",
    };
    tools[tool.name] = report;
    candidates.push({
      tool,
      original: observed.content,
      originalMode: observed.mode,
      candidate,
      report,
    });
  }
  return {
    candidates,
    report: { ok: true, tools, findings: [] },
  };
}

function resolveToolConfigs(input: ManagedConfigOptions): ResolvedToolConfig[] {
  const configured = input.config.runtime.configs ?? {};
  const home = resolve(input.home ?? process.env.HOME ?? userInfo().homedir);
  const resolved: ResolvedToolConfig[] = [];
  for (const [name, declaration] of Object.entries(configured).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (name !== "codex") {
      throw new Error(`managed_config_tool_unsupported: ${name}`);
    }
    if (!declaration || typeof declaration !== "object") {
      throw new Error(`managed_config_invalid: ${name} declaration`);
    }
    if (declaration.target !== CODEX_TARGET) {
      throw new Error(
        `managed_config_target_invalid: ${name} must target ${CODEX_TARGET}`,
      );
    }
    const target = join(home, ".codex", "config.toml");
    assertTargetSafe(target, home);
    const leaves = flattenManagedLeaves(name, declaration.managed);
    if (leaves.length === 0) {
      throw new Error(`managed_config_empty: ${name}`);
    }
    resolved.push({ name, target, leaves });
  }
  return resolved;
}

function flattenManagedLeaves(
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

function compareLeaves(
  parsed: Record<string, unknown>,
  leaves: ManagedLeaf[],
): ManagedConfigDrift[] {
  const drift: ManagedConfigDrift[] = [];
  for (const leaf of leaves) {
    const observed = valueAtPath(parsed, leaf.path);
    if (!observed.found) {
      drift.push({
        path: leaf.path.join("."),
        expected: leaf.value,
        reason: "missing",
      });
    } else if (!Object.is(observed.value, leaf.value)) {
      drift.push({
        path: leaf.path.join("."),
        expected: leaf.value,
        actual: isScalar(observed.value) ? observed.value : null,
        reason: "different",
      });
    }
  }
  return drift;
}

function updateTomlDocument(
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
  value: ManagedConfigScalar,
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

function renderScalar(value: ManagedConfigScalar): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  return String(value);
}

function validateWithCodex(
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

function runCodexConfigValidator(
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

function assertConfigMutationSource(
  input: ManagedConfigOptions,
  configs: ResolvedToolConfig[],
): void {
  const verified =
    input.sourceVerified ?? sourceIsVerifiedForLiveMutation(input.sourceRoot);
  if (verified) {
    return;
  }
  const effectiveHome = resolve(
    input.home ?? process.env.HOME ?? userInfo().homedir,
  );
  const liveHome = resolve(input.liveHome ?? userInfo().homedir);
  const runtimeRoot = resolve(
    input.runtimeRoot ?? join(effectiveHome, ".agents", "runtime"),
  );
  const liveRuntimeRoot = join(liveHome, ".agents", "runtime");
  const physicalLiveHome = physicalConfiguredPath(liveHome);
  const targetsLiveHome = configs.some((config) =>
    pathWithin(physicalLiveHome, physicalConfiguredPath(config.target)),
  );
  if (
    targetsLiveHome ||
    physicalConfiguredPath(runtimeRoot) ===
      physicalConfiguredPath(liveRuntimeRoot)
  ) {
    throw new Error(
      "unverified_live_source: config sync requires isolated HOME and runtime roots",
    );
  }
}

function assertTargetSafe(target: string, home: string): void {
  const absoluteHome = resolve(home);
  const expected = join(absoluteHome, ".codex", "config.toml");
  if (resolve(target) !== expected) {
    throw new Error(`managed_config_target_invalid: ${target}`);
  }
  const codexDir = dirname(expected);
  const codexDirStats = lstatIfExists(codexDir);
  if (codexDirStats) {
    const stats = codexDirStats;
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`managed_config_parent_invalid: ${codexDir}`);
    }
    const physicalHome = lstatIfExists(absoluteHome)
      ? realpathSync(absoluteHome)
      : absoluteHome;
    if (!pathWithin(physicalHome, realpathSync(codexDir))) {
      throw new Error(`managed_config_parent_escape: ${codexDir}`);
    }
  }
  const targetStats = lstatIfExists(expected);
  if (!targetStats) {
    return;
  }
  const stats = targetStats;
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`managed_config_target_unsafe: ${expected}`);
  }
}

function readObserved(target: string): { content?: string; mode?: number } {
  const home = resolveHomeFromTarget(target);
  assertTargetSafe(target, home);
  const stats = lstatIfExists(target);
  if (!stats) {
    return {};
  }
  return {
    content: readFileSync(target, "utf-8"),
    mode: stats.mode & 0o777,
  };
}

function assertOriginalUnchanged(entry: PreparedCandidate): void {
  const observed = readObserved(entry.tool.target).content;
  if (observed !== entry.original) {
    throw new Error(`managed_config_target_changed: ${entry.tool.target}`);
  }
}

function resolveHomeFromTarget(target: string): string {
  return dirname(dirname(resolve(target)));
}

function parseToml(content: string, path: string): Record<string, unknown> {
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

function valueAtPath(
  root: Record<string, unknown>,
  path: string[],
): { found: boolean; value?: unknown } {
  let value: unknown = root;
  for (const segment of path) {
    if (!isPlainObject(value) || !Object.hasOwn(value, segment)) {
      return { found: false };
    }
    value = value[segment];
  }
  return { found: true, value };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isScalar(value: unknown): value is ManagedConfigScalar {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function pathWithin(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate));
  return (
    rel === "" ||
    (rel !== ".." &&
      !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}

function physicalConfiguredPath(path: string): string {
  let existing = resolve(path);
  const suffix: string[] = [];
  while (!lstatIfExists(existing)) {
    const parent = dirname(existing);
    if (parent === existing) {
      return resolve(path);
    }
    suffix.unshift(basename(existing));
    existing = parent;
  }
  return join(realpathSync(existing), ...suffix);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function lstatIfExists(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}
