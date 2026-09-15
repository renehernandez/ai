import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { userInfo } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  isScalar,
  parseJsonDocument,
  resolveJsonPaths,
  updateJsonDocument,
  valueAtPath,
} from "./json-config.ts";
import {
  type AxRuntimeConfig,
  sourceIsVerifiedForLiveMutation,
} from "./runtime-sync.ts";
import { hashPath, type ObservedHash } from "./source-snapshot.ts";
import {
  flattenManagedLeaves,
  parseToml,
  runCodexConfigValidator,
  updateTomlDocument,
  validateWithCodex,
} from "./toml-config.ts";
import {
  applyTransaction,
  type TransactionOperationInput,
} from "./transaction-engine.ts";

export type ManagedConfigScalar = string | number | boolean;
export type ManagedJsonValue =
  | ManagedConfigScalar
  | null
  | ManagedJsonValue[]
  | { [key: string]: ManagedJsonValue };
export type ManagedConfigDeclaration = {
  target: string;
  managed?: Record<string, unknown>;
  managedPaths?: Array<{
    path: string[];
    value: ManagedJsonValue;
    expandHome?: boolean;
  }>;
};

export type ManagedConfigDrift = {
  path: string;
  expected: ManagedJsonValue;
  actual?: unknown;
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

export type ManagedLeaf = {
  path: string[];
  value: ManagedJsonValue;
};

type ResolvedToolConfig = {
  name: "codex" | "pi" | "piModels" | "paseo";
  target: string;
  home: string;
  leaves: ManagedLeaf[];
};

type PreparedCandidate = {
  tool: ResolvedToolConfig;
  original?: string;
  originalMode?: number;
  originalHash: ObservedHash;
  candidate: string;
  report: ManagedConfigToolReport;
};

export type PreparedManagedConfigs = {
  candidates: PreparedCandidate[];
  report: ManagedConfigReport;
  runtimeRoot: string;
};

const CODEX_TARGET = "~/.codex/config.toml";
const CONFIG_TARGETS = {
  codex: CODEX_TARGET,
  pi: "~/.pi/agent/settings.json",
  piModels: "~/.pi/agent/models.json",
  paseo: "~/.paseo/config.json",
} as const;

export function inspectManagedConfigs(
  input: ManagedConfigOptions,
): ManagedConfigReport {
  const tools: Record<string, ManagedConfigToolReport> = {};
  const findings: string[] = [];
  try {
    for (const tool of resolveToolConfigs(input)) {
      const observed = readObserved(tool);
      const parsed = parseDocument(observed.content ?? "", tool);
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
  mkdirSync(prepared.runtimeRoot, { recursive: true });
  const staging = mkdtempSync(join(prepared.runtimeRoot, ".configs-"));
  try {
    for (const entry of prepared.candidates)
      if (entry.candidate !== (entry.original ?? ""))
        hooks.beforeApply?.(entry.tool.target);
    const operations = stageManagedConfigs(prepared, staging);
    if (operations.length > 0)
      applyTransaction({
        domain: `runtime:${prepared.runtimeRoot}`,
        root: prepared.runtimeRoot,
        lockPath: join(prepared.runtimeRoot, "mutation.lock"),
        transactionsRoot: join(prepared.runtimeRoot, "transactions"),
        backupsRoot: join(prepared.runtimeRoot, "backups"),
        operations,
        exactTargetPaths: operations.map((operation) => operation.path),
      });
    return {
      status: "synchronized",
      changedPaths: operations.map((operation) => operation.path),
      tools: prepared.report.tools,
    };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

export function stageManagedConfigs(
  prepared: PreparedManagedConfigs,
  staging: string,
): TransactionOperationInput[] {
  const operations: TransactionOperationInput[] = [];
  for (const [index, entry] of prepared.candidates.entries()) {
    assertOriginalUnchanged(entry);
    if (entry.candidate === (entry.original ?? "")) continue;
    const candidatePath = join(staging, `managed-config-${index}`);
    writeFileSync(candidatePath, entry.candidate, {
      mode: entry.originalMode ?? 0o600,
    });
    chmodSync(candidatePath, entry.originalMode ?? 0o600);
    operations.push({
      path: entry.tool.target,
      asset: `config/${entry.tool.name}`,
      candidatePath,
      expectedPreviousHash: entry.originalHash,
    });
  }
  return operations;
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
    const observed = readObserved(tool);
    const parsed = parseDocument(observed.content ?? "", tool);
    const drift = compareLeaves(parsed, tool.leaves);
    const candidate =
      drift.length === 0
        ? (observed.content ?? "")
        : tool.name === "codex"
          ? updateTomlDocument(observed.content ?? "", parsed, tool.leaves)
          : updateJsonDocument(parsed, tool.leaves);
    const parsedCandidate = parseDocument(candidate, tool);
    const candidateDrift = compareLeaves(parsedCandidate, tool.leaves);
    if (candidateDrift.length > 0) {
      throw new Error(
        `managed_config_candidate_drift: ${candidateDrift
          .map((entry) => entry.path)
          .join(", ")}`,
      );
    }
    if (tool.name === "codex")
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
      originalHash: hashPath(tool.target),
      candidate,
      report,
    });
  }
  return {
    candidates,
    report: { ok: true, tools, findings: [] },
    runtimeRoot: resolve(
      input.runtimeRoot ??
        join(
          input.home ?? process.env.HOME ?? userInfo().homedir,
          ".agents/runtime",
        ),
    ),
  };
}

function resolveToolConfigs(input: ManagedConfigOptions): ResolvedToolConfig[] {
  const configured = input.config.runtime.configs ?? {};
  const home = resolve(input.home ?? process.env.HOME ?? userInfo().homedir);
  const resolved: ResolvedToolConfig[] = [];
  for (const [name, declaration] of Object.entries(configured).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    if (!Object.hasOwn(CONFIG_TARGETS, name)) {
      throw new Error(`managed_config_tool_unsupported: ${name}`);
    }
    if (!declaration || typeof declaration !== "object") {
      throw new Error(`managed_config_invalid: ${name} declaration`);
    }
    const supportedName = name as ResolvedToolConfig["name"];
    const expectedTarget = CONFIG_TARGETS[supportedName];
    if (declaration.target !== expectedTarget) {
      throw new Error(
        `managed_config_target_invalid: ${name} must target ${expectedTarget}`,
      );
    }
    const target = join(home, expectedTarget.slice(2));
    assertTargetSafe(target, home);
    const leaves =
      name === "codex"
        ? flattenManagedLeaves(name, declaration.managed)
        : resolveJsonPaths(name, declaration, home);
    if (leaves.length === 0) {
      throw new Error(`managed_config_empty: ${name}`);
    }
    resolved.push({ name: supportedName, target, home, leaves });
  }
  return resolved;
}

function parseDocument(
  content: string,
  tool: ResolvedToolConfig,
): Record<string, unknown> {
  return tool.name === "codex"
    ? parseToml(content, tool.target)
    : parseJsonDocument(content, tool.target);
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
    } else if (!isDeepStrictEqual(observed.value, leaf.value)) {
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
  const expected = resolve(target);
  if (
    !Object.values(CONFIG_TARGETS).some(
      (path) => expected === join(absoluteHome, path.slice(2)),
    )
  ) {
    throw new Error(`managed_config_target_invalid: ${target}`);
  }
  for (
    let parent = dirname(expected);
    parent !== absoluteHome;
    parent = dirname(parent)
  ) {
    const stats = lstatIfExists(parent);
    if (!stats) continue;
    if (stats.isSymbolicLink() || !stats.isDirectory()) {
      throw new Error(`managed_config_parent_invalid: ${parent}`);
    }
    const physicalHome = lstatIfExists(absoluteHome)
      ? realpathSync(absoluteHome)
      : absoluteHome;
    if (!pathWithin(physicalHome, realpathSync(parent))) {
      throw new Error(`managed_config_parent_escape: ${parent}`);
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

function readObserved({ target, home }: ResolvedToolConfig): {
  content?: string;
  mode?: number;
} {
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
  const observed = readObserved(entry.tool);
  if (
    observed.content !== entry.original ||
    observed.mode !== entry.originalMode ||
    hashPath(entry.tool.target) !== entry.originalHash
  ) {
    throw new Error(`managed_config_target_changed: ${entry.tool.target}`);
  }
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
