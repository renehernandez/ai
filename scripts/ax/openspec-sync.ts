import { spawnSync } from "node:child_process";
import {
  accessSync,
  cpSync,
  existsSync,
  constants as fsConstants,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  delimiter,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import {
  ABSENT_HASH,
  copyPath,
  hashPath,
  sha256Bytes,
} from "./source-snapshot.ts";
import {
  applyTransaction,
  inspectMutationLock,
  inspectTransactions,
  recoverTransactions,
  resolveRecovery,
  type TransactionOperationInput,
  withMutationLock,
} from "./transaction-engine.ts";

export type OpenSpecSetupState =
  | "missing"
  | "configured"
  | "partial_repairable"
  | "partial_context_required";

export type OpenSpecConfig = {
  tools?: string[];
  schema?: string;
  profile?: string;
  delivery?: string;
  workflows?: string[];
  context?: string;
  rules?: Record<string, string[]>;
  canonicalSkillsDir?: string;
  canonicalCommandsDir?: string;
  skillTargets?: Record<string, string>;
  commandTargets?: Record<string, string>;
};

export type OpenSpecPaths = {
  adminRoot: string;
  transactionsRoot: string;
  backupsRoot: string;
  lockPath: string;
};

export type OpenSpecStatusReport = {
  ok: boolean;
  state: OpenSpecSetupState;
  targetRoot: string;
  configPath: string;
  cli: {
    path?: string;
    version?: string;
    available: boolean;
    guidance?: string;
  };
  paths: OpenSpecPaths;
  skillNames: string[];
  commandNames: string[];
  findings: string[];
  transactions: ReturnType<typeof inspectTransactions>;
  lock?: Record<string, unknown>;
};

export type OpenSpecSyncOptions = {
  targetRoot: string;
  config: OpenSpecConfig;
  contextFile?: string;
  reviewConfig?: boolean;
  acceptConfigChanges?: boolean;
  recoveryFile?: string;
  interactive?: boolean;
  confirm?: (message: string) => boolean;
  beforeTransactionApply?: () => void;
};

export type OpenSpecSyncResult = {
  status: "synchronized" | "current" | "recovered";
  state: OpenSpecSetupState;
  changedPaths: string[];
  cliPath?: string;
  cliVersion?: string;
  configReview?: {
    current: string;
    proposed: string;
    applied: boolean;
  };
};

type ResolvedOpenSpecConfig = Required<
  Pick<
    OpenSpecConfig,
    "tools" | "schema" | "profile" | "delivery" | "workflows"
  >
> & {
  context: string;
  rules: Record<string, string[]>;
  canonicalSkillsDir: string;
  canonicalCommandsDir: string;
  skillTargets: Record<string, string>;
  commandTargets: Record<string, string>;
  contextWasConfigured: boolean;
  rulesWereConfigured: boolean;
};

const DEFAULT_TOOLS = ["codex", "claude"];
const DEFAULT_WORKFLOWS = ["propose", "explore", "apply", "archive"];
const SUPPORTED_DELIVERIES = new Set(["both", "skills", "commands"]);
const SUPPORTED_PROFILES = new Set(["custom"]);
const SCHEMA_ARTIFACTS: Record<string, readonly string[]> = {
  "spec-driven": ["proposal", "specs", "design", "tasks"],
};
const WORKFLOW_ASSETS: Record<
  string,
  { skillName: string; commandName: string }
> = {
  propose: { skillName: "openspec-propose", commandName: "propose.md" },
  explore: { skillName: "openspec-explore", commandName: "explore.md" },
  new: { skillName: "openspec-new-change", commandName: "new.md" },
  continue: {
    skillName: "openspec-continue-change",
    commandName: "continue.md",
  },
  apply: {
    skillName: "openspec-apply-change",
    commandName: "apply.md",
  },
  ff: { skillName: "openspec-ff-change", commandName: "ff.md" },
  sync: { skillName: "openspec-sync-specs", commandName: "sync.md" },
  archive: {
    skillName: "openspec-archive-change",
    commandName: "archive.md",
  },
  "bulk-archive": {
    skillName: "openspec-bulk-archive-change",
    commandName: "bulk-archive.md",
  },
  verify: {
    skillName: "openspec-verify-change",
    commandName: "verify.md",
  },
  onboard: {
    skillName: "openspec-onboard",
    commandName: "onboard.md",
  },
};
const OPENSPEC_INSTALL_GUIDANCE =
  "Install the OpenSpec CLI separately and ensure the `openspec` executable is on PATH.";
const EXPLICIT_ONLY_DESCRIPTION =
  "Explicit-only developer command. Invoke only when the user explicitly names this OpenSpec adapter or its /opsx command.";
const EXPLICIT_ONLY_BOUNDARY =
  "Do not infer this adapter from ordinary language. Route ordinary work through the owning lifecycle mode.";
const LIFECYCLE_OVERLAYS = {
  explore:
    "This adapter runs only inside Explore. It is read-only and must not create or update OpenSpec artifacts, repository files, trackers, or providers. Return evidence and route any durable artifact to Plan.",
  propose:
    "This adapter runs only inside Plan. It may create the selected OpenSpec planning artifacts, but it does not implement, publish, merge, deploy, or clean up.",
  apply:
    "This adapter runs only inside Execute after the OpenSpec proposal and POC checkpoint are accepted. Preserve one repository writer, implement final units independently from POC commits, and return provider or terminal actions to Finish.",
  archive:
    "This adapter runs only in the last final Execute unit. Incomplete artifacts or tasks hard-block archival. Synchronize delta specs into canonical specs before moving the verified change to the dated archive; Finish does not perform archival as cleanup.",
} as const;
const LIFECYCLE_ASSETS: Record<string, keyof typeof LIFECYCLE_OVERLAYS> = {
  "apply.md": "apply",
  "archive.md": "archive",
  "explore.md": "explore",
  "openspec-apply-change": "apply",
  "openspec-archive-change": "archive",
  "openspec-explore": "explore",
  "openspec-propose": "propose",
  "propose.md": "propose",
};
const CONTENT_HASH_MARKER = "ax-openspec-content-sha256";

type ParsedProjectConfig = {
  schema?: string;
  context: string;
  rules: Record<string, string[]>;
  findings: string[];
};

type ExpectedOpenSpecInventory = {
  skillNames: string[];
  commandNames: string[];
};

export function openspecPaths(targetRoot: string): OpenSpecPaths {
  const target = resolve(targetRoot);
  const identityResult = git(target, ["rev-parse", "--show-toplevel"]);
  if (identityResult.status !== 0 || !identityResult.stdout.trim()) {
    throw new Error(
      `openspec_git_identity_unavailable: ${gitFailure(identityResult)}`,
    );
  }
  const gitPath = git(target, ["rev-parse", "--git-path", "ax-openspec"]);
  if (gitPath.status !== 0 || !gitPath.stdout.trim()) {
    throw new Error(
      `openspec_git_identity_unavailable: ${gitFailure(gitPath)}`,
    );
  }
  const base = resolve(target, gitPath.stdout.trim());
  const identity = sha256Bytes(realPathOrResolved(target)).slice(
    "sha256:".length,
    "sha256:".length + 16,
  );
  const adminRoot = join(base, identity);
  return {
    adminRoot,
    transactionsRoot: join(adminRoot, "transactions"),
    backupsRoot: join(adminRoot, "backups"),
    lockPath: join(adminRoot, "mutation.lock"),
  };
}

export function inspectOpenSpec(input: {
  targetRoot: string;
  config: OpenSpecConfig;
}): OpenSpecStatusReport {
  const targetRoot = resolve(input.targetRoot);
  const config = resolveConfig(input.config);
  const paths = openspecPaths(targetRoot);
  const findings: string[] = [];
  const configPath = join(targetRoot, "openspec", "config.yaml");
  const projectPathFindings = validateOpenSpecProjectPaths(targetRoot);
  const hasConfig =
    projectPathFindings.length === 0 && isRegularFile(configPath);
  const configFindings = [
    ...validateResolvedConfig(targetRoot, config),
    ...projectPathFindings,
  ];
  findings.push(...configFindings);
  const pathsAreSafe =
    projectPathFindings.length === 0 &&
    !configFindings.some(
      (finding) =>
        finding.startsWith("openspec_path_") ||
        finding.startsWith("openspec_symlink_parent_"),
    );
  const skillNames = pathsAreSafe ? openSpecSkillNames(targetRoot, config) : [];
  const commandNames = pathsAreSafe
    ? openSpecCommandNames(targetRoot, config)
    : [];
  const projectFootprint =
    pathsAreSafe && directoryHasEntries(join(targetRoot, "openspec"));
  const generatedFootprint = skillNames.length > 0 || commandNames.length > 0;
  let state: OpenSpecSetupState;
  if (configFindings.length > 0) {
    state = "partial_context_required";
  } else if (!hasConfig && !projectFootprint && !generatedFootprint) {
    state = "missing";
  } else if (!hasConfig) {
    state = "partial_context_required";
    findings.push(`missing_openspec_config: ${configPath}`);
  } else {
    const parsed = parseProjectConfig(
      readOpenSpecConfig(targetRoot),
      configPath,
    );
    const projectConfigFindings = validateProjectConfig(
      parsed,
      config,
      configPath,
    );
    findings.push(...projectConfigFindings);
    if (projectConfigFindings.length > 0) {
      state = "partial_context_required";
    } else {
      const generatedFindings = validateGeneratedAssets(targetRoot, config);
      findings.push(...generatedFindings);
      state =
        generatedFindings.length === 0 ? "configured" : "partial_repairable";
    }
  }
  const cli = resolveOpenSpecCli();
  const transactions = inspectTransactions(paths.transactionsRoot);
  for (const transaction of transactions) {
    findings.push(`${transaction.phase}: ${transaction.transactionId}`);
  }
  return {
    ok:
      (state === "configured" || state === "missing") &&
      transactions.length === 0,
    state,
    targetRoot,
    configPath,
    cli,
    paths,
    skillNames,
    commandNames,
    findings,
    transactions,
    lock: inspectMutationLock(paths.lockPath),
  };
}

export function validateOpenSpec(input: {
  targetRoot: string;
  config: OpenSpecConfig;
}): OpenSpecStatusReport {
  const report = inspectOpenSpec(input);
  if (report.state !== "configured" || report.findings.length > 0) {
    throw new Error(
      `openspec_validation_failed:\n${report.findings.map((finding) => `- ${finding}`).join("\n")}`,
    );
  }
  return report;
}

export function syncOpenSpec(options: OpenSpecSyncOptions): OpenSpecSyncResult {
  const targetRoot = resolve(options.targetRoot);
  const config = resolveConfig(options.config);
  const paths = openspecPaths(targetRoot);
  const resolvedConfigFindings = validateResolvedConfig(targetRoot, config);
  if (resolvedConfigFindings.length > 0) {
    throw new Error(
      `openspec_config_invalid:\n${resolvedConfigFindings.map((finding) => `- ${finding}`).join("\n")}`,
    );
  }
  assertOpenSpecProjectPaths(targetRoot, "openspec_project_paths_invalid");
  if (options.recoveryFile) {
    resolveRecovery({
      lockPath: paths.lockPath,
      transactionsRoot: paths.transactionsRoot,
      backupsRoot: paths.backupsRoot,
      recoveryFile: options.recoveryFile,
      targetRoots: [targetRoot],
    });
    return {
      status: "recovered",
      state: inspectOpenSpec({ targetRoot, config }).state,
      changedPaths: [],
    };
  }
  return withMutationLock(
    {
      lockPath: paths.lockPath,
      domain: `openspec:${targetRoot}`,
      root: targetRoot,
    },
    () => {
      recoverTransactions({
        transactionsRoot: paths.transactionsRoot,
        backupsRoot: paths.backupsRoot,
        targetRoots: [targetRoot],
      });
      gitDirtyPaths(targetRoot);
      const initial = inspectOpenSpec({ targetRoot, config });
      const cli = requireOpenSpecCli(probeOpenSpecCli(initial.cli));
      const context = confirmedContext(initial.state, options, config);
      const candidateRoot = mkdtempSync(
        join(tmpdir(), "ax-openspec-candidate-"),
      );
      try {
        let configReview: OpenSpecSyncResult["configReview"];
        copyRepositoryCandidate(targetRoot, candidateRoot);
        assertOpenSpecProjectPaths(
          candidateRoot,
          "openspec_candidate_paths_invalid",
        );
        const candidatePathFindings = validateConfiguredPaths(
          candidateRoot,
          config,
        );
        if (candidatePathFindings.length > 0) {
          throw new Error(
            `openspec_candidate_paths_invalid:\n${candidatePathFindings.map((finding) => `- ${finding}`).join("\n")}`,
          );
        }
        if (
          initial.state === "missing" ||
          initial.state === "partial_context_required"
        ) {
          writeOpenSpecConfig(candidateRoot, config, context);
        } else if (options.reviewConfig) {
          configReview = reviewCandidateConfig(candidateRoot, config, options);
          if (configReview && !configReview.applied) {
            return {
              status: "current",
              state: initial.state,
              changedPaths: [],
              cliPath: cli.path,
              cliVersion: cli.version,
              configReview,
            };
          }
        }
        const confirmedConfigPath = join(
          candidateRoot,
          "openspec",
          "config.yaml",
        );
        const confirmedConfig = isRegularFile(confirmedConfigPath)
          ? readOpenSpecConfig(candidateRoot)
          : undefined;
        runOpenSpecGenerator({
          cliPath: cli.path,
          candidateRoot,
          config,
          initialize:
            initial.state === "missing" ||
            initial.state === "partial_context_required",
        });
        if (confirmedConfig !== undefined) {
          writeOpenSpecConfigContent(candidateRoot, confirmedConfig);
        }
        normalizeOpenSpecCandidate(candidateRoot, config);
        const validation = validateOpenSpecPaths(candidateRoot, config);
        if (validation.length > 0) {
          throw new Error(
            `openspec_candidate_invalid:\n${validation.map((finding) => `- ${finding}`).join("\n")}`,
          );
        }
        const operations = planOpenSpecOperations({
          targetRoot,
          candidateRoot,
          config,
        });
        if (operations.length === 0) {
          return {
            status: "current",
            state: "configured",
            changedPaths: [],
            cliPath: cli.path,
            cliVersion: cli.version,
            configReview,
          };
        }
        const dirtyPaths = gitDirtyPaths(targetRoot);
        for (const operation of operations) {
          const relativePath = normalizeRelative(
            relative(targetRoot, operation.path),
          );
          if (dirtyPaths.some((dirty) => pathTouches(dirty, relativePath))) {
            throw new Error(
              `openspec_dirty_path: refusing to overwrite locally changed ${relativePath}`,
            );
          }
        }
        options.beforeTransactionApply?.();
        applyTransaction({
          domain: `openspec:${targetRoot}`,
          root: targetRoot,
          lockPath: paths.lockPath,
          lockHeld: true,
          transactionsRoot: paths.transactionsRoot,
          backupsRoot: paths.backupsRoot,
          operations,
          targetRoots: [targetRoot],
          initialDirtyPaths: dirtyPaths,
          metadata: {
            worktreeIdentity: realPathOrResolved(targetRoot),
          },
          validateApplied: () => {
            const findings = validateOpenSpecPaths(targetRoot, config);
            if (findings.length > 0) {
              throw new Error(
                `openspec_post_apply_invalid:\n${findings.join("\n")}`,
              );
            }
          },
        });
        return {
          status: "synchronized",
          state: "configured",
          changedPaths: operations.map((operation) => operation.path).sort(),
          cliPath: cli.path,
          cliVersion: cli.version,
          configReview,
        };
      } finally {
        rmSync(candidateRoot, { force: true, recursive: true });
      }
    },
  );
}

export function resolveOpenSpecCli(): OpenSpecStatusReport["cli"] {
  for (const directory of (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)) {
    const candidate = join(directory, "openspec");
    try {
      accessSync(candidate, fsConstants.X_OK);
    } catch {
      continue;
    }
    return {
      path: candidate,
      available: true,
    };
  }
  return {
    available: false,
    guidance: OPENSPEC_INSTALL_GUIDANCE,
  };
}

function probeOpenSpecCli(
  located: OpenSpecStatusReport["cli"],
): OpenSpecStatusReport["cli"] {
  if (!located.available || !located.path) {
    return located;
  }
  const version = spawnSync(located.path, ["--version"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (version.status === 0 && version.stdout.trim()) {
    return { ...located, version: version.stdout.trim() };
  }
  return {
    path: located.path,
    available: false,
    guidance: `${OPENSPEC_INSTALL_GUIDANCE} The executable did not return a version.`,
  };
}

function requireOpenSpecCli(cli: OpenSpecStatusReport["cli"]): {
  path: string;
  version: string;
} {
  if (!cli.available || !cli.path || !cli.version) {
    throw new Error(
      `openspec_cli_unavailable: ${cli.guidance ?? OPENSPEC_INSTALL_GUIDANCE}`,
    );
  }
  return { path: cli.path, version: cli.version };
}

function confirmedContext(
  state: OpenSpecSetupState,
  options: OpenSpecSyncOptions,
  config: ResolvedOpenSpecConfig,
): string {
  if (state !== "missing" && state !== "partial_context_required") {
    return config.context;
  }
  if (options.contextFile) {
    const content = readFileSync(resolve(options.contextFile), "utf-8").trim();
    if (!content) {
      throw new Error(`openspec_context_empty: ${options.contextFile}`);
    }
    return content;
  }
  const interactive =
    options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  if (!interactive) {
    throw new Error(
      "openspec_context_required: headless missing/partial setup requires --context-file <path>",
    );
  }
  const inferred = config.context || "Repository-local OpenSpec project";
  if (!options.confirm?.(renderSetupPreview(config, inferred))) {
    throw new Error("openspec_context_not_confirmed: no files were changed");
  }
  return inferred;
}

function renderSetupPreview(
  config: ResolvedOpenSpecConfig,
  context: string,
): string {
  return [
    "OpenSpec sync setup preview:",
    `tools: ${config.tools.join(", ")}`,
    `schema: ${config.schema}`,
    `workflow profile: ${config.profile}`,
    `delivery: ${config.delivery}`,
    `workflows: ${config.workflows.join(", ")}`,
    "project context:",
    context,
  ].join("\n");
}

function runOpenSpecGenerator(input: {
  cliPath: string;
  candidateRoot: string;
  config: ResolvedOpenSpecConfig;
  initialize: boolean;
}): void {
  const configHome = mkdtempSync(join(tmpdir(), "ax-openspec-config-"));
  try {
    mkdirSync(join(configHome, "openspec"), { recursive: true });
    writeFileSync(
      join(configHome, "openspec", "config.json"),
      `${JSON.stringify(
        {
          profile: input.config.profile,
          delivery: input.config.delivery,
          workflows: input.config.workflows,
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    const args = input.initialize
      ? [
          "init",
          ".",
          "--tools",
          input.config.tools.join(","),
          "--profile",
          input.config.profile,
        ]
      : ["update", "."];
    const result = spawnSync(input.cliPath, args, {
      cwd: input.candidateRoot,
      encoding: "utf-8",
      env: {
        ...process.env,
        XDG_CONFIG_HOME: configHome,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    if (result.status !== 0) {
      throw new Error(
        `openspec_generation_failed: ${result.stderr || result.stdout || `exit ${String(result.status)}`}`,
      );
    }
  } finally {
    rmSync(configHome, { force: true, recursive: true });
  }
}

function normalizeOpenSpecCandidate(
  root: string,
  config: ResolvedOpenSpecConfig,
): void {
  const expected = expectedOpenSpecInventory(config);
  const canonicalSkills = join(root, config.canonicalSkillsDir);
  const activeSkillTargets = activeTargets(
    config.skillTargets,
    config.tools,
  ).map(([name, path]) => [name, join(root, path)] as const);
  const allSkillTargets = Object.entries(config.skillTargets).map(
    ([name, path]) => [name, join(root, path)] as const,
  );
  const expectedSkills = new Set(expected.skillNames);
  for (const directory of [
    canonicalSkills,
    ...allSkillTargets.map(([, path]) => path),
  ]) {
    for (const name of openSpecNames([directory])) {
      if (!expectedSkills.has(name)) {
        rmSync(join(directory, name), { force: true, recursive: true });
      }
    }
  }
  for (const skillName of expected.skillNames) {
    const canonical = join(canonicalSkills, skillName);
    if (!isRealDirectory(canonical)) {
      const source = activeSkillTargets
        .map(([, path]) => join(path, skillName))
        .find((path) => isContainedDirectory(root, path));
      const sourcePath = source ? realPathOrResolved(source) : undefined;
      rmSync(canonical, { force: true, recursive: true });
      if (!sourcePath || !existsSync(sourcePath)) {
        continue;
      }
      copyPath(sourcePath, canonical);
    }
    if (!isRealDirectory(canonical)) {
      continue;
    }
    normalizeExplicitOnlyAdapter(canonical, skillName);
    for (const [, targetRoot] of activeSkillTargets) {
      replaceRelativeSymlink(root, canonical, join(targetRoot, skillName));
    }
    for (const [tool, targetRoot] of allSkillTargets) {
      if (!config.tools.includes(tool)) {
        rmSync(join(targetRoot, skillName), { force: true, recursive: true });
      }
    }
  }

  const canonicalCommands = join(root, config.canonicalCommandsDir, "opsx");
  const activeCommandTargets = activeTargets(
    config.commandTargets,
    config.tools,
  ).map(([name, path]) => [name, join(root, path, "opsx")] as const);
  const allCommandTargets = Object.entries(config.commandTargets).map(
    ([name, path]) => [name, join(root, path, "opsx")] as const,
  );
  if (expected.commandNames.length === 0) {
    rmSync(canonicalCommands, { force: true, recursive: true });
    for (const [, target] of allCommandTargets) {
      rmSync(target, { force: true, recursive: true });
    }
    return;
  }
  if (!isRealDirectory(canonicalCommands)) {
    const source = activeCommandTargets
      .map(([, path]) => path)
      .find((path) => isContainedDirectory(root, path));
    const sourcePath = source ? realPathOrResolved(source) : undefined;
    rmSync(canonicalCommands, { force: true, recursive: true });
    if (sourcePath && existsSync(sourcePath)) {
      copyPath(sourcePath, canonicalCommands);
    }
  }
  if (isRealDirectory(canonicalCommands)) {
    const expectedCommands = new Set(expected.commandNames);
    for (const entry of readdirSync(canonicalCommands)) {
      if (!expectedCommands.has(entry)) {
        rmSync(join(canonicalCommands, entry), {
          force: true,
          recursive: true,
        });
      }
    }
    for (const commandName of expected.commandNames) {
      const commandPath = join(canonicalCommands, commandName);
      if (isRegularFile(commandPath)) {
        normalizeExplicitOnlyCommand(commandPath, commandName);
      }
    }
    for (const [, target] of activeCommandTargets) {
      replaceRelativeSymlink(root, canonicalCommands, target);
    }
  }
  for (const [tool, target] of allCommandTargets) {
    if (!config.tools.includes(tool)) {
      rmSync(target, { force: true, recursive: true });
    }
  }
}

function normalizeExplicitOnlyAdapter(
  skillRoot: string,
  skillName: string,
): void {
  const skillPath = join(skillRoot, "SKILL.md");
  if (!existsSync(skillPath)) {
    return;
  }
  let content = stripContentHashMarker(readFileSync(skillPath, "utf-8"));
  if (/^description:/m.test(content)) {
    content = content.replace(
      /^description:.*$/m,
      `description: ${EXPLICIT_ONLY_DESCRIPTION}`,
    );
  }
  if (!content.includes("## Explicit Invocation Boundary")) {
    content = `${content.trimEnd()}\n\n## Explicit Invocation Boundary\n\n${EXPLICIT_ONLY_BOUNDARY}\n`;
  }
  const identity = `<!-- ax-openspec-skill: ${skillName}; explicit-only -->`;
  if (!content.includes(identity)) {
    content = `${content.trimEnd()}\n\n${identity}\n`;
  }
  content = normalizeLifecycleOverlay(content, skillName);
  writeFileSync(skillPath, withContentHashMarker(content), "utf-8");
}

function normalizeExplicitOnlyCommand(path: string, commandName: string): void {
  let content = stripContentHashMarker(readFileSync(path, "utf-8"));
  const command = commandName.replace(/\.md$/, "");
  const identity = `<!-- ax-openspec-command: ${commandName}; explicit-only -->`;
  const boundary = `<!-- Invoke only as /opsx:${command}; do not infer from ordinary language. -->`;
  if (!content.includes(identity)) {
    content = `${content.trimEnd()}\n\n${identity}\n`;
  }
  if (!content.includes(boundary)) {
    content = `${content.trimEnd()}\n${boundary}\n`;
  }
  content = normalizeLifecycleOverlay(content, commandName);
  writeFileSync(path, withContentHashMarker(content), "utf-8");
}

export function normalizeLifecycleOverlay(
  content: string,
  assetName: string,
): string {
  const lifecycle = lifecycleForAsset(assetName);
  if (!lifecycle) return content;
  const hasOwnedOverlay = content.includes(
    "<!-- ax-openspec-lifecycle: Execute -->",
  );

  let normalized = content.replace(
    /\n## AX Lifecycle Overlay\n[\s\S]*?<!-- ax-openspec-lifecycle: (?:Explore|Plan|Execute) -->\n?/g,
    "\n",
  );
  if (lifecycle === "explore") {
    normalized = normalized.replace(
      /You MAY create OpenSpec artifacts[^\n]*(?:\n[^\n]*)?that's capturing thinking, not implementing\./g,
      "OpenSpec artifacts require Plan authority; remain read-only in this adapter.",
    );
  }
  if (lifecycle === "archive") {
    normalized = applyArchiveTransforms(
      normalized,
      assetName,
      !hasOwnedOverlay,
    );
  }

  const mode = lifecycle === "propose" ? "Plan" : "Execute";
  const markerMode = lifecycle === "explore" ? "Explore" : mode;
  return `${normalized.trimEnd()}\n\n## AX Lifecycle Overlay\n\n${LIFECYCLE_OVERLAYS[lifecycle]}\n\n<!-- ax-openspec-lifecycle: ${markerMode} -->\n`;
}

const archiveTransforms = [
  {
    name: "incomplete-work override",
    pattern:
      /^.*(?:Proceed if user confirms|confirm user wants to proceed|confirmation to continue).*$/gim,
    replacement: "   - STOP; incomplete work blocks archival",
    requiredOnFreshUpstream: true,
  },
  {
    name: "spec-sync bypass",
    pattern:
      /"?Archive without syncing"?|Proceed to archive regardless of choice\.|Sync skipped/gi,
    replacement: '"Cancel"',
    requiredOnFreshUpstream: true,
  },
  {
    name: "warning-only completion",
    pattern:
      /^.*(?:Don't block archive on warnings|Output On Success With Warnings).*$/gim,
    replacement: "- Incomplete artifacts or tasks block archival",
    requiredOnFreshUpstream: true,
  },
  {
    name: "stop indentation",
    pattern: /^- STOP; incomplete work blocks archival$/gim,
    replacement: "   - STOP; incomplete work blocks archival",
    requiredOnFreshUpstream: false,
  },
  {
    name: "sync-stop wording",
    pattern: /- STOP unless required delta specs are synchronized\./gi,
    replacement: "Do not archive unless required delta specs are synchronized.",
    requiredOnFreshUpstream: false,
  },
  {
    name: "no-delta formatting",
    pattern: / \(or "No delta specs" \)/g,
    replacement: ' or "No delta specs"',
    requiredOnFreshUpstream: false,
  },
  {
    name: "warning summary",
    pattern: /- Note about any warnings \(incomplete artifacts\/tasks\)/gi,
    replacement: "- Confirmation that all artifacts and tasks are complete",
    requiredOnFreshUpstream: false,
  },
  {
    name: "incomplete-work override suffix",
    pattern:
      /^\s*-?\s*Incomplete artifacts or tasks block archival without an override\s*$/gim,
    replacement: "- Incomplete artifacts or tasks block archival",
    requiredOnFreshUpstream: false,
  },
] as const;

function applyArchiveTransforms(
  content: string,
  assetName: string,
  requireFreshAnchors: boolean,
): string {
  let transformed = content;
  for (const transform of archiveTransforms) {
    const expectedCount = [...transformed.matchAll(transform.pattern)].length;
    if (
      requireFreshAnchors &&
      transform.requiredOnFreshUpstream &&
      expectedCount === 0
    ) {
      throw new Error(
        `openspec_overlay_drift: ${assetName} required transform ${transform.name} applied 0 times`,
      );
    }
    transformed = transformed.replace(transform.pattern, transform.replacement);
    const remainingCount = [...transformed.matchAll(transform.pattern)].length;
    if (remainingCount !== 0) {
      throw new Error(
        `openspec_overlay_drift: ${assetName} required transform ${transform.name} left ${remainingCount} of ${expectedCount} matches`,
      );
    }
  }
  return transformed;
}

export function archiveTransformViolations(content: string): string[] {
  return archiveTransforms
    .filter(({ pattern }) => [...content.matchAll(pattern)].length > 0)
    .map(({ name }) => name);
}

function lifecycleForAsset(
  assetName: string,
): keyof typeof LIFECYCLE_OVERLAYS | undefined {
  return LIFECYCLE_ASSETS[assetName];
}

export function lifecycleOverlayValid(
  content: string,
  assetName: string,
): boolean {
  const lifecycle = lifecycleForAsset(assetName);
  if (!lifecycle) return true;
  const markerMode =
    lifecycle === "explore"
      ? "Explore"
      : lifecycle === "propose"
        ? "Plan"
        : "Execute";
  if (
    !content.includes(LIFECYCLE_OVERLAYS[lifecycle]) ||
    !content.includes(`<!-- ax-openspec-lifecycle: ${markerMode} -->`)
  ) {
    return false;
  }
  if (
    lifecycle === "explore" &&
    /MAY create OpenSpec artifacts|capturing thinking, not implementing/i.test(
      content,
    )
  ) {
    return false;
  }
  return (
    lifecycle !== "archive" || archiveTransformViolations(content).length === 0
  );
}

function planOpenSpecOperations(input: {
  targetRoot: string;
  candidateRoot: string;
  config: ResolvedOpenSpecConfig;
}): TransactionOperationInput[] {
  const relativePaths = new Set<string>([
    join("openspec", "config.yaml"),
    ...managedOpenSpecPaths(input.targetRoot, input.config),
    ...managedOpenSpecPaths(input.candidateRoot, input.config),
  ]);
  const operations: TransactionOperationInput[] = [];
  for (const relativePath of [...relativePaths].sort()) {
    const live = join(input.targetRoot, relativePath);
    const candidate = join(input.candidateRoot, relativePath);
    const liveHash = hashPath(live);
    const candidateHash = hashPath(candidate);
    if (liveHash === candidateHash) {
      continue;
    }
    operations.push(
      candidateHash === ABSENT_HASH
        ? {
            path: live,
            asset: `openspec/${normalizeRelative(relativePath)}`,
            expectedPreviousHash: liveHash,
            delete: true,
          }
        : {
            path: live,
            asset: `openspec/${normalizeRelative(relativePath)}`,
            expectedPreviousHash: liveHash,
            candidatePath: candidate,
          },
    );
  }
  return operations;
}

function validateOpenSpecPaths(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const findings = validateResolvedConfig(root, config);
  if (findings.length > 0) {
    return findings;
  }
  const configPath = join(root, "openspec", "config.yaml");
  const projectPathFindings = validateOpenSpecProjectPaths(root);
  findings.push(...projectPathFindings);
  if (projectPathFindings.length > 0) {
    return findings;
  }
  if (!isRegularFile(configPath)) {
    findings.push(`missing_openspec_config: ${configPath}`);
    return findings;
  }
  const parsed = parseProjectConfig(readOpenSpecConfig(root), configPath);
  findings.push(...validateProjectConfig(parsed, config, configPath));
  if (findings.length > 0) {
    return findings;
  }
  findings.push(...validateGeneratedAssets(root, config));
  return findings;
}

function validateResolvedConfig(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const findings: string[] = [];
  if (!SCHEMA_ARTIFACTS[config.schema]) {
    findings.push(`openspec_config_unknown_schema: ${config.schema}`);
  }
  if (!SUPPORTED_PROFILES.has(config.profile)) {
    findings.push(`openspec_config_unknown_profile: ${config.profile}`);
  }
  if (!SUPPORTED_DELIVERIES.has(config.delivery)) {
    findings.push(`openspec_config_unknown_delivery: ${config.delivery}`);
  }
  if (config.tools.length === 0) {
    findings.push("openspec_config_tools_empty");
  }
  for (const duplicate of duplicateValues(config.tools)) {
    findings.push(`openspec_config_duplicate_tool: ${duplicate}`);
  }
  const configuredTools = new Set([
    ...Object.keys(config.skillTargets),
    ...Object.keys(config.commandTargets),
  ]);
  for (const tool of configuredTools) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(tool)) {
      findings.push(`openspec_config_unknown_tool: ${tool}`);
    }
  }
  for (const tool of config.tools) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(tool) || !configuredTools.has(tool)) {
      findings.push(`openspec_config_unknown_tool: ${tool}`);
    }
  }
  if (config.workflows.length === 0) {
    findings.push("openspec_config_workflows_empty");
  }
  for (const duplicate of duplicateValues(config.workflows)) {
    findings.push(`openspec_config_duplicate_workflow: ${duplicate}`);
  }
  for (const workflow of config.workflows) {
    if (!WORKFLOW_ASSETS[workflow]) {
      findings.push(`openspec_config_unknown_workflow: ${workflow}`);
    }
  }
  const allowedArtifacts = new Set(SCHEMA_ARTIFACTS[config.schema] ?? []);
  for (const artifact of Object.keys(config.rules)) {
    if (!allowedArtifacts.has(artifact)) {
      findings.push(`openspec_config_unknown_rule_artifact: ${artifact}`);
    }
  }
  if (
    config.delivery !== "commands" &&
    activeTargets(config.skillTargets, config.tools).length === 0
  ) {
    findings.push("openspec_config_skill_targets_empty");
  }
  if (
    config.delivery !== "skills" &&
    activeTargets(config.commandTargets, config.tools).length === 0
  ) {
    findings.push("openspec_config_command_targets_empty");
  }
  findings.push(...validateConfiguredPaths(root, config));
  findings.push(...validateConfiguredPathCollisions(root, config));
  return findings;
}

function validateConfiguredPathCollisions(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const findings: string[] = [];
  const canonicalSkills = resolve(root, config.canonicalSkillsDir);
  for (const [tool, target] of activeTargets(
    config.skillTargets,
    config.tools,
  )) {
    if (resolve(root, target) === canonicalSkills) {
      findings.push(
        `openspec_path_collision: skillTargets.${tool} equals canonicalSkillsDir`,
      );
    }
  }
  const canonicalCommands = resolve(root, config.canonicalCommandsDir, "opsx");
  for (const [tool, target] of activeTargets(
    config.commandTargets,
    config.tools,
  )) {
    if (resolve(root, target, "opsx") === canonicalCommands) {
      findings.push(
        `openspec_path_collision: commandTargets.${tool}/opsx equals canonical commands`,
      );
    }
  }
  return findings;
}

function validateConfiguredPaths(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const expected = expectedOpenSpecInventory(config);
  const configuredPaths: Array<{
    label: string;
    path: string;
    checkLeaf?: boolean;
  }> = [
    { label: "canonicalSkillsDir", path: config.canonicalSkillsDir },
    { label: "canonicalCommandsDir", path: config.canonicalCommandsDir },
    ...Object.entries(config.skillTargets).map(([tool, path]) => ({
      label: `skillTargets.${tool}`,
      path,
    })),
    ...Object.entries(config.commandTargets).map(([tool, path]) => ({
      label: `commandTargets.${tool}`,
      path,
    })),
  ];
  for (const skillName of expected.skillNames) {
    configuredPaths.push({
      label: `canonical skill ${skillName}`,
      path: join(config.canonicalSkillsDir, skillName),
      checkLeaf: false,
    });
    for (const [tool, target] of Object.entries(config.skillTargets)) {
      configuredPaths.push({
        label: `skill target ${tool}/${skillName}`,
        path: join(target, skillName),
        checkLeaf: false,
      });
    }
  }
  const canonicalOpsx = join(config.canonicalCommandsDir, "opsx");
  configuredPaths.push({ label: "canonical opsx", path: canonicalOpsx });
  for (const commandName of expected.commandNames) {
    configuredPaths.push({
      label: `canonical opsx/${commandName}`,
      path: join(canonicalOpsx, commandName),
      checkLeaf: false,
    });
  }
  for (const [tool, target] of Object.entries(config.commandTargets)) {
    configuredPaths.push({
      label: `command target ${tool}/opsx`,
      path: join(target, "opsx"),
      checkLeaf: false,
    });
  }
  const findings: string[] = [];
  for (const configuredPath of configuredPaths) {
    findings.push(...validateRepoContainedPath(root, configuredPath));
  }
  return [...new Set(findings)];
}

function validateRepoContainedPath(
  root: string,
  input: { label: string; path: string; checkLeaf?: boolean },
): string[] {
  const findings: string[] = [];
  if (
    !input.path.trim() ||
    input.path.includes("\0") ||
    input.path.includes("\\") ||
    isAbsolute(input.path)
  ) {
    return [`openspec_path_invalid: ${input.label}=${input.path}`];
  }
  const rootPath = resolve(root);
  const candidate = resolve(rootPath, input.path);
  if (candidate === rootPath) {
    return [`openspec_path_invalid: ${input.label}=${input.path}`];
  }
  if (!pathIsWithin(rootPath, candidate)) {
    return [`openspec_path_escape: ${input.label}=${input.path}`];
  }
  const rootReal = realPathOrResolved(rootPath);
  const segments = normalizeRelative(relative(rootPath, candidate))
    .split("/")
    .filter(Boolean);
  let current = rootPath;
  const checkedSegments =
    input.checkLeaf === false ? segments.length - 1 : segments.length;
  for (let index = 0; index < checkedSegments; index += 1) {
    current = join(current, segments[index]);
    if (!existsOrSymlink(current)) {
      continue;
    }
    let currentReal: string;
    try {
      currentReal = realpathSync(current);
    } catch {
      findings.push(`openspec_symlink_parent_broken: ${current}`);
      break;
    }
    if (!pathIsWithin(rootReal, currentReal)) {
      findings.push(`openspec_symlink_parent_escape: ${current}`);
      break;
    }
    if (index < segments.length - 1 && !lstatSync(currentReal).isDirectory()) {
      findings.push(`openspec_path_parent_not_directory: ${current}`);
      break;
    }
  }
  return findings;
}

function validateProjectConfig(
  parsed: ParsedProjectConfig,
  config: ResolvedOpenSpecConfig,
  configPath: string,
): string[] {
  const findings = [...parsed.findings];
  if (!parsed.schema) {
    findings.push(`openspec_config_missing_schema: ${configPath}`);
    return findings;
  }
  const artifacts = SCHEMA_ARTIFACTS[parsed.schema];
  if (!artifacts) {
    findings.push(`openspec_config_unknown_schema: ${parsed.schema}`);
    return findings;
  }
  if (parsed.schema !== config.schema) {
    findings.push(
      `openspec_config_schema_mismatch: expected ${config.schema}, found ${parsed.schema}`,
    );
  }
  if (parsed.context.length > 24_000) {
    findings.push(`openspec_config_context_too_large: ${configPath}`);
  }
  const allowedArtifacts = new Set(artifacts);
  for (const artifact of Object.keys(parsed.rules)) {
    if (!allowedArtifacts.has(artifact)) {
      findings.push(`openspec_config_unknown_rule_artifact: ${artifact}`);
    }
  }
  return findings;
}

function validateGeneratedAssets(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const findings: string[] = [];
  const expected = expectedOpenSpecInventory(config);
  const canonicalSkills = join(root, config.canonicalSkillsDir);
  const canonicalNames = openSpecNames([canonicalSkills]);
  compareInventory(
    "openspec_skill",
    canonicalSkills,
    expected.skillNames,
    canonicalNames,
    findings,
  );
  for (const name of expected.skillNames) {
    const canonical = join(canonicalSkills, name);
    if (
      !isRealDirectory(canonical) ||
      !existsSync(join(canonical, "SKILL.md"))
    ) {
      findings.push(`openspec_skill_missing: ${canonical}`);
      continue;
    }
    const content = readFileSync(join(canonical, "SKILL.md"), "utf-8");
    if (
      !content.includes(`name: ${name}`) ||
      !content.includes(`description: ${EXPLICIT_ONLY_DESCRIPTION}`) ||
      !content.includes(EXPLICIT_ONLY_BOUNDARY) ||
      !content.includes(`<!-- ax-openspec-skill: ${name}; explicit-only -->`)
    ) {
      findings.push(`openspec_adapter_not_explicit_only: ${canonical}`);
    }
    if (!lifecycleOverlayValid(content, name)) {
      findings.push(`openspec_adapter_lifecycle_overlay_invalid: ${canonical}`);
    }
    validateManagedContentHash(content, join(canonical, "SKILL.md"), findings);
    if (hasContradictoryTrigger(content)) {
      findings.push(
        `openspec_adapter_contradictory_trigger: ${join(canonical, "SKILL.md")}`,
      );
    }
    for (const [, target] of activeTargets(config.skillTargets, config.tools)) {
      validateRelativeSymlink(canonical, join(root, target, name), findings);
    }
  }
  for (const [tool, target] of Object.entries(config.skillTargets)) {
    const actual = openSpecNames([join(root, target)]);
    const targetExpected = config.tools.includes(tool)
      ? expected.skillNames
      : [];
    compareInventory(
      "openspec_skill_target",
      join(root, target),
      targetExpected,
      actual,
      findings,
    );
  }

  const canonicalCommands = join(root, config.canonicalCommandsDir, "opsx");
  if (expected.commandNames.length === 0) {
    if (existsOrSymlink(canonicalCommands)) {
      findings.push(`openspec_commands_unexpected: ${canonicalCommands}`);
    }
  } else if (!isRealDirectory(canonicalCommands)) {
    findings.push(`openspec_commands_missing: ${canonicalCommands}`);
  } else {
    const actualCommands = commandEntries(canonicalCommands);
    compareInventory(
      "openspec_command",
      canonicalCommands,
      expected.commandNames,
      actualCommands,
      findings,
    );
    for (const commandName of expected.commandNames) {
      const commandPath = join(canonicalCommands, commandName);
      const command = commandName.replace(/\.md$/, "");
      if (!isRegularFile(commandPath)) {
        findings.push(`openspec_command_stale: ${commandPath}`);
        continue;
      }
      const content = readFileSync(commandPath, "utf-8");
      if (
        !content.includes(
          `<!-- ax-openspec-command: ${commandName}; explicit-only -->`,
        ) ||
        !content.includes(
          `<!-- Invoke only as /opsx:${command}; do not infer from ordinary language. -->`,
        )
      ) {
        findings.push(`openspec_command_stale: ${commandPath}`);
      }
      if (!lifecycleOverlayValid(content, commandName)) {
        findings.push(
          `openspec_command_lifecycle_overlay_invalid: ${commandPath}`,
        );
      }
      validateManagedContentHash(content, commandPath, findings);
    }
    for (const [, target] of activeTargets(
      config.commandTargets,
      config.tools,
    )) {
      validateRelativeSymlink(
        canonicalCommands,
        join(root, target, "opsx"),
        findings,
      );
    }
  }
  for (const [tool, target] of Object.entries(config.commandTargets)) {
    const targetPath = join(root, target, "opsx");
    if (
      existsOrSymlink(targetPath) &&
      (expected.commandNames.length === 0 || !config.tools.includes(tool))
    ) {
      findings.push(`openspec_command_target_unexpected: ${targetPath}`);
    }
  }
  return findings;
}

function withContentHashMarker(content: string): string {
  const base = `${content.trimEnd()}\n`;
  return `${base}\n<!-- ${CONTENT_HASH_MARKER}: ${sha256Bytes(base)} -->\n`;
}

function stripContentHashMarker(content: string): string {
  return content.replace(
    /\n?<!-- ax-openspec-content-sha256: sha256:[a-f0-9]{64} -->\s*$/,
    "",
  );
}

function validateManagedContentHash(
  content: string,
  path: string,
  findings: string[],
): void {
  const match = content.match(
    /<!-- ax-openspec-content-sha256: (sha256:[a-f0-9]{64}) -->\s*$/,
  );
  if (!match || match.index === undefined) {
    findings.push(`openspec_generated_identity_missing: ${path}`);
    return;
  }
  const base = `${content.slice(0, match.index).trimEnd()}\n`;
  if (sha256Bytes(base) !== match[1]) {
    findings.push(`openspec_generated_content_stale: ${path}`);
  }
}

function hasContradictoryTrigger(content: string): boolean {
  const withoutBoundary = stripContentHashMarker(content)
    .replace(EXPLICIT_ONLY_BOUNDARY, "")
    .replace(/<!-- ax-openspec-skill: [^>]+ -->/g, "");
  const frontmatter =
    withoutBoundary.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? "";
  const metadata = frontmatter
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:name|description):/.test(line))
    .join("\n");
  if (
    /^\s*(?:trigger|triggers|auto-?invoke|ordinary-language)\s*:/im.test(
      metadata,
    )
  ) {
    return true;
  }
  const body = withoutBoundary.replace(/^---\r?\n[\s\S]*?\r?\n---/, "");
  return /\b(?:automatically|auto-?invoke)\b.{0,80}\b(?:use|invoke|select|trigger)\b/i.test(
    body,
  );
}

function reviewCandidateConfig(
  candidateRoot: string,
  config: ResolvedOpenSpecConfig,
  options: OpenSpecSyncOptions,
): OpenSpecSyncResult["configReview"] {
  const path = join(candidateRoot, "openspec", "config.yaml");
  assertOpenSpecProjectPaths(candidateRoot, "openspec_config_review_invalid");
  if (!isRegularFile(path)) {
    return undefined;
  }
  const current = readOpenSpecConfig(candidateRoot);
  const parsed = parseProjectConfig(current, path);
  const validation = validateProjectConfig(parsed, config, path);
  if (validation.length > 0) {
    throw new Error(
      `openspec_config_review_invalid:\n${validation.join("\n")}`,
    );
  }
  const proposedContext = config.contextWasConfigured
    ? config.context
    : parsed.context;
  const proposedRules = config.rulesWereConfigured
    ? config.rules
    : parsed.rules;
  const semanticallyChanged =
    parsed.schema !== config.schema ||
    parsed.context !== proposedContext ||
    !rulesEqual(parsed.rules, proposedRules);
  if (!semanticallyChanged) {
    return undefined;
  }
  const proposed = renderOpenSpecConfig(
    { ...config, rules: proposedRules },
    proposedContext,
  );
  const interactive =
    options.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const authorized = interactive
    ? options.confirm?.(
        [
          "Apply reviewed OpenSpec config changes?",
          "Current:",
          current.trimEnd(),
          "Proposed:",
          proposed.trimEnd(),
        ].join("\n"),
      )
    : options.acceptConfigChanges;
  if (authorized) {
    writeOpenSpecConfigContent(candidateRoot, proposed);
  }
  return { current, proposed, applied: Boolean(authorized) };
}

function rulesEqual(
  left: Record<string, string[]>,
  right: Record<string, string[]>,
): boolean {
  return (
    JSON.stringify(sortedRules(left)) === JSON.stringify(sortedRules(right))
  );
}

function sortedRules(
  rules: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(rules)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([artifact, entries]) => [artifact, [...entries]]),
  );
}

function writeOpenSpecConfig(
  root: string,
  config: ResolvedOpenSpecConfig,
  context: string,
): void {
  writeOpenSpecConfigContent(root, renderOpenSpecConfig(config, context));
}

function renderOpenSpecConfig(
  config: ResolvedOpenSpecConfig,
  context: string,
): string {
  const lines = [
    `schema: ${config.schema}`,
    "context: |",
    ...context.split(/\r?\n/).map((line) => `  ${line}`),
    "rules:",
  ];
  for (const [artifact, rules] of Object.entries(config.rules).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    lines.push(`  ${artifact}:`);
    for (const rule of rules) {
      lines.push(`    - ${JSON.stringify(rule)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function resolveConfig(config: OpenSpecConfig): ResolvedOpenSpecConfig {
  const raw = config as Record<string, unknown>;
  assertOptionalStringArray(raw.tools, "tools");
  assertOptionalString(raw.schema, "schema");
  assertOptionalString(raw.profile, "profile");
  assertOptionalString(raw.delivery, "delivery");
  assertOptionalStringArray(raw.workflows, "workflows");
  assertOptionalString(raw.context, "context");
  assertOptionalRules(raw.rules);
  assertOptionalString(raw.canonicalSkillsDir, "canonicalSkillsDir");
  assertOptionalString(raw.canonicalCommandsDir, "canonicalCommandsDir");
  assertOptionalStringRecord(raw.skillTargets, "skillTargets");
  assertOptionalStringRecord(raw.commandTargets, "commandTargets");
  return {
    tools: [...(config.tools ?? DEFAULT_TOOLS)],
    schema: config.schema ?? "spec-driven",
    profile: config.profile ?? "custom",
    delivery: config.delivery ?? "both",
    workflows: [...(config.workflows ?? DEFAULT_WORKFLOWS)],
    context: config.context ?? "",
    rules: Object.fromEntries(
      Object.entries(config.rules ?? {}).map(([artifact, rules]) => [
        artifact,
        [...rules],
      ]),
    ),
    canonicalSkillsDir: config.canonicalSkillsDir ?? ".agents/skills",
    canonicalCommandsDir: config.canonicalCommandsDir ?? ".agents/commands",
    skillTargets: {
      ...(config.skillTargets ?? {
        codex: ".codex/skills",
        claude: ".claude/skills",
      }),
    },
    commandTargets: {
      ...(config.commandTargets ?? { claude: ".claude/commands" }),
    },
    contextWasConfigured: Object.hasOwn(raw, "context"),
    rulesWereConfigured: Object.hasOwn(raw, "rules"),
  };
}

function assertOptionalString(value: unknown, field: string): void {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`openspec_config_invalid_${field}: expected string`);
  }
}

function assertOptionalStringArray(value: unknown, field: string): void {
  if (
    value !== undefined &&
    (!Array.isArray(value) || value.some((entry) => typeof entry !== "string"))
  ) {
    throw new Error(`openspec_config_invalid_${field}: expected string array`);
  }
}

function assertOptionalStringRecord(value: unknown, field: string): void {
  if (
    value !== undefined &&
    (!isPlainRecord(value) ||
      Object.values(value).some((entry) => typeof entry !== "string"))
  ) {
    throw new Error(`openspec_config_invalid_${field}: expected path map`);
  }
}

function assertOptionalRules(value: unknown): void {
  if (
    value !== undefined &&
    (!isPlainRecord(value) ||
      Object.values(value).some(
        (rules) =>
          !Array.isArray(rules) ||
          rules.some((rule) => typeof rule !== "string"),
      ))
  ) {
    throw new Error(
      "openspec_config_invalid_rules: expected artifact string arrays",
    );
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function managedOpenSpecPaths(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const paths = new Set<string>();
  const expected = expectedOpenSpecInventory(config);
  const skillNames = new Set([
    ...expected.skillNames,
    ...openSpecSkillNames(root, config),
  ]);
  for (const name of skillNames) {
    paths.add(join(config.canonicalSkillsDir, name));
    for (const target of Object.values(config.skillTargets)) {
      paths.add(join(target, name));
    }
  }
  const commandNames = openSpecCommandNames(root, config);
  if (
    expected.commandNames.length > 0 ||
    commandNames.length > 0 ||
    existsOrSymlink(join(root, config.canonicalCommandsDir, "opsx"))
  ) {
    paths.add(join(config.canonicalCommandsDir, "opsx"));
    for (const target of Object.values(config.commandTargets)) {
      paths.add(join(target, "opsx"));
    }
  }
  return [...paths].sort();
}

function openSpecSkillNames(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  return openSpecNames([
    join(root, config.canonicalSkillsDir),
    ...Object.values(config.skillTargets).map((target) => join(root, target)),
  ]);
}

function openSpecCommandNames(
  root: string,
  config: ResolvedOpenSpecConfig,
): string[] {
  const names = new Set<string>();
  const directories = [
    join(root, config.canonicalCommandsDir, "opsx"),
    ...Object.values(config.commandTargets).map((target) =>
      join(root, target, "opsx"),
    ),
  ];
  for (const directory of directories) {
    if (!existsOrSymlink(directory)) {
      continue;
    }
    const resolved = realPathOrResolved(directory);
    if (!existsSync(resolved) || !lstatSync(resolved).isDirectory()) {
      continue;
    }
    for (const entry of readdirSync(resolved, { withFileTypes: true })) {
      if (entry.isFile() || entry.isSymbolicLink()) {
        names.add(entry.name);
      }
    }
  }
  return [...names].sort();
}

function openSpecNames(directories: string[]): string[] {
  const names = new Set<string>();
  for (const directory of directories) {
    if (!existsOrSymlink(directory)) {
      continue;
    }
    const resolved = realPathOrResolved(directory);
    if (!existsSync(resolved) || !lstatSync(resolved).isDirectory()) {
      continue;
    }
    for (const entry of readdirSync(resolved, { withFileTypes: true })) {
      if (entry.name.startsWith("openspec-")) {
        names.add(entry.name);
      }
    }
  }
  return [...names].sort();
}

function expectedOpenSpecInventory(
  config: ResolvedOpenSpecConfig,
): ExpectedOpenSpecInventory {
  const assets = config.workflows
    .map((workflow) => WORKFLOW_ASSETS[workflow])
    .filter(
      (asset): asset is { skillName: string; commandName: string } =>
        asset !== undefined,
    );
  return {
    skillNames:
      config.delivery === "commands"
        ? []
        : [...new Set(assets.map((asset) => asset.skillName))].sort(),
    commandNames:
      config.delivery === "skills"
        ? []
        : [...new Set(assets.map((asset) => asset.commandName))].sort(),
  };
}

function activeTargets(
  targets: Record<string, string>,
  tools: readonly string[],
): Array<[string, string]> {
  const selected = new Set(tools);
  return Object.entries(targets).filter(([tool]) => selected.has(tool));
}

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
}

function compareInventory(
  kind: string,
  root: string,
  expected: readonly string[],
  actual: readonly string[],
  findings: string[],
): void {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  for (const name of expected) {
    if (!actualSet.has(name)) {
      findings.push(`${kind}_missing: ${join(root, name)}`);
    }
  }
  for (const name of actual) {
    if (!expectedSet.has(name)) {
      findings.push(`${kind}_unexpected: ${join(root, name)}`);
    }
  }
}

function commandEntries(root: string): string[] {
  if (!isRealDirectory(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .map((entry) => entry.name)
    .sort();
}

function parseProjectConfig(
  content: string,
  configPath: string,
): ParsedProjectConfig {
  const parsed: ParsedProjectConfig = {
    context: "",
    rules: {},
    findings: [],
  };
  if (content.length > 64_000) {
    parsed.findings.push(`openspec_config_too_large: ${configPath}`);
    return parsed;
  }
  const lines = content.split(/\r?\n/);
  const seenTopLevel = new Set<string>();
  let index = 0;
  while (index < lines.length) {
    const raw = lines[index];
    const visible = stripYamlComment(raw);
    if (!visible.trim()) {
      index += 1;
      continue;
    }
    if (leadingSpaces(raw) !== 0) {
      parsed.findings.push(
        `openspec_config_invalid_yaml: ${configPath}:${String(index + 1)}`,
      );
      index += 1;
      continue;
    }
    const entry = parseYamlMappingEntry(visible);
    if (!entry) {
      parsed.findings.push(
        `openspec_config_invalid_yaml: ${configPath}:${String(index + 1)}`,
      );
      index += 1;
      continue;
    }
    const [key, rawValue] = entry;
    const value = rawValue.trim();
    if (seenTopLevel.has(key)) {
      parsed.findings.push(`openspec_config_duplicate_key: ${key}`);
    }
    seenTopLevel.add(key);
    if (key === "schema") {
      parsed.schema = parseYamlScalar(
        value,
        configPath,
        index + 1,
        parsed.findings,
      );
      index += 1;
      continue;
    }
    if (key === "context") {
      if (/^[|>][+-]?$/.test(value)) {
        const contextLines: string[] = [];
        index += 1;
        while (index < lines.length) {
          const contextLine = lines[index];
          if (contextLine.trim() && leadingSpaces(contextLine) === 0) {
            break;
          }
          if (contextLine.trim() && leadingSpaces(contextLine) < 2) {
            parsed.findings.push(
              `openspec_config_invalid_context: ${configPath}:${String(index + 1)}`,
            );
            index += 1;
            continue;
          }
          contextLines.push(contextLine.trim() ? contextLine.slice(2) : "");
          index += 1;
        }
        while (contextLines.at(-1) === "") {
          contextLines.pop();
        }
        parsed.context = value.startsWith(">")
          ? foldYamlBlock(contextLines)
          : contextLines.join("\n");
        continue;
      }
      parsed.context = parseYamlScalar(
        value,
        configPath,
        index + 1,
        parsed.findings,
      );
      index += 1;
      continue;
    }
    if (key === "rules") {
      if (value === "{}") {
        index += 1;
        continue;
      }
      if (value) {
        parsed.findings.push(
          `openspec_config_invalid_rules: ${configPath}:${String(index + 1)}`,
        );
      }
      index = parseRules(lines, index + 1, configPath, parsed);
      continue;
    }
    parsed.findings.push(`openspec_config_unknown_field: ${key}`);
    index += 1;
  }
  return parsed;
}

function parseRules(
  lines: string[],
  startIndex: number,
  configPath: string,
  parsed: ParsedProjectConfig,
): number {
  let index = startIndex;
  while (index < lines.length) {
    const raw = lines[index];
    const visible = stripYamlComment(raw);
    if (!visible.trim()) {
      index += 1;
      continue;
    }
    const indent = leadingSpaces(raw);
    if (indent === 0) {
      return index;
    }
    const artifactEntry =
      indent === 2 ? parseYamlMappingEntry(visible.slice(2)) : undefined;
    if (!artifactEntry || artifactEntry[1].trim()) {
      parsed.findings.push(
        `openspec_config_invalid_rules: ${configPath}:${String(index + 1)}`,
      );
      index += 1;
      continue;
    }
    const artifact = artifactEntry[0];
    if (Object.hasOwn(parsed.rules, artifact)) {
      parsed.findings.push(
        `openspec_config_duplicate_rule_artifact: ${artifact}`,
      );
    }
    const rules: string[] = [];
    index += 1;
    while (index < lines.length) {
      const ruleRaw = lines[index];
      const ruleVisible = stripYamlComment(ruleRaw);
      if (!ruleVisible.trim()) {
        index += 1;
        continue;
      }
      const ruleIndent = leadingSpaces(ruleRaw);
      if (ruleIndent <= 2) {
        break;
      }
      const ruleEntry = ruleVisible.match(/^ {4,}-\s+(.+)$/);
      if (!ruleEntry) {
        parsed.findings.push(
          `openspec_config_invalid_rule: ${configPath}:${String(index + 1)}`,
        );
        index += 1;
        continue;
      }
      rules.push(
        parseYamlScalar(
          ruleEntry[1].trim(),
          configPath,
          index + 1,
          parsed.findings,
        ),
      );
      index += 1;
    }
    parsed.rules[artifact] = rules;
  }
  return index;
}

function parseYamlMappingEntry(value: string): [string, string] | undefined {
  const unquoted = value.match(/^([A-Za-z][A-Za-z0-9_-]*):(?:\s*(.*))?$/);
  if (unquoted) {
    return [unquoted[1], unquoted[2] ?? ""];
  }
  const singleQuoted = value.match(/^'((?:[^']|'')+)':(?:\s*(.*))?$/);
  if (singleQuoted) {
    return [singleQuoted[1].replaceAll("''", "'"), singleQuoted[2] ?? ""];
  }
  const doubleQuoted = value.match(/^("(?:\\.|[^"\\])*"):(?:\s*(.*))?$/);
  if (!doubleQuoted) {
    return undefined;
  }
  try {
    const key = JSON.parse(doubleQuoted[1]) as unknown;
    return typeof key === "string" ? [key, doubleQuoted[2] ?? ""] : undefined;
  } catch {
    return undefined;
  }
}

function foldYamlBlock(lines: string[]): string {
  let result = "";
  for (const line of lines) {
    if (!line) {
      result += "\n";
    } else {
      if (result && !result.endsWith("\n")) {
        result += " ";
      }
      result += line;
    }
  }
  return result;
}

function parseYamlScalar(
  value: string,
  configPath: string,
  line: number,
  findings: string[],
): string {
  if (!value) {
    return "";
  }
  if (value.startsWith('"')) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === "string") {
        return parsed;
      }
    } catch {
      // Report the common scalar error below.
    }
    findings.push(
      `openspec_config_invalid_scalar: ${configPath}:${String(line)}`,
    );
    return "";
  }
  if (value.startsWith("'")) {
    if (value.length >= 2 && value.endsWith("'")) {
      return value.slice(1, -1).replaceAll("''", "'");
    }
    findings.push(
      `openspec_config_invalid_scalar: ${configPath}:${String(line)}`,
    );
    return "";
  }
  return stripYamlComment(value).trim();
}

function stripYamlComment(value: string): string {
  let singleQuoted = false;
  let doubleQuoted = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && doubleQuoted) {
      escaped = true;
      continue;
    }
    if (character === "'" && !doubleQuoted) {
      singleQuoted = !singleQuoted;
      continue;
    }
    if (character === '"' && !singleQuoted) {
      doubleQuoted = !doubleQuoted;
      continue;
    }
    if (
      character === "#" &&
      !singleQuoted &&
      !doubleQuoted &&
      (index === 0 || /\s/.test(value[index - 1]))
    ) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function leadingSpaces(value: string): number {
  return value.match(/^ */)?.[0].length ?? 0;
}

function directoryHasEntries(path: string): boolean {
  if (!existsSync(path) || !lstatSync(path).isDirectory()) {
    return false;
  }
  return readdirSync(path).length > 0;
}

function validateOpenSpecProjectPaths(root: string): string[] {
  const resolvedRoot = resolve(root);
  const realRoot = realPathOrResolved(resolvedRoot);
  const openspecRoot = join(resolvedRoot, "openspec");
  const configPath = join(openspecRoot, "config.yaml");
  const findings: string[] = [];

  if (!pathIsWithin(resolvedRoot, openspecRoot)) {
    findings.push(`openspec_path_escape: openspec=${openspecRoot}`);
    return findings;
  }
  if (existsOrSymlink(openspecRoot)) {
    const stats = lstatSync(openspecRoot);
    if (stats.isSymbolicLink()) {
      findings.push(`openspec_path_parent_symlink: ${openspecRoot}`);
      return findings;
    }
    if (!stats.isDirectory()) {
      findings.push(`openspec_path_parent_not_directory: ${openspecRoot}`);
      return findings;
    }
    const physicalRoot = realpathSync(openspecRoot);
    if (!pathIsWithin(realRoot, physicalRoot)) {
      findings.push(`openspec_path_physical_escape: ${openspecRoot}`);
      return findings;
    }
  }

  if (!existsOrSymlink(configPath)) {
    return findings;
  }
  const configStats = lstatSync(configPath);
  if (configStats.isSymbolicLink()) {
    findings.push(`openspec_path_config_symlink: ${configPath}`);
    return findings;
  }
  if (!configStats.isFile()) {
    findings.push(`openspec_path_config_not_regular_file: ${configPath}`);
    return findings;
  }
  if (!pathIsWithin(realRoot, realpathSync(configPath))) {
    findings.push(`openspec_path_physical_escape: ${configPath}`);
  }
  return findings;
}

function assertOpenSpecProjectPaths(root: string, errorCode: string): void {
  const findings = validateOpenSpecProjectPaths(root);
  if (findings.length > 0) {
    throw new Error(`${errorCode}:\n${findings.join("\n")}`);
  }
}

function readOpenSpecConfig(root: string): string {
  assertOpenSpecProjectPaths(root, "openspec_config_read_unsafe");
  const path = join(resolve(root), "openspec", "config.yaml");
  if (!isRegularFile(path)) {
    throw new Error(`openspec_config_missing: ${path}`);
  }
  return readFileSync(path, "utf-8");
}

function writeOpenSpecConfigContent(root: string, content: string): void {
  assertOpenSpecProjectPaths(root, "openspec_config_write_unsafe");
  const path = join(resolve(root), "openspec", "config.yaml");
  mkdirSync(dirname(path), { recursive: true });
  assertOpenSpecProjectPaths(root, "openspec_config_write_unsafe");
  writeFileSync(path, content, "utf-8");
  assertOpenSpecProjectPaths(root, "openspec_config_write_unsafe");
}

function isRegularFile(path: string): boolean {
  return (
    existsOrSymlink(path) &&
    !lstatSync(path).isSymbolicLink() &&
    lstatSync(path).isFile()
  );
}

function isRealDirectory(path: string): boolean {
  return (
    existsOrSymlink(path) &&
    !lstatSync(path).isSymbolicLink() &&
    lstatSync(path).isDirectory()
  );
}

function isContainedDirectory(root: string, path: string): boolean {
  if (!existsOrSymlink(path)) {
    return false;
  }
  try {
    const resolvedPath = realpathSync(path);
    return (
      pathIsWithin(realPathOrResolved(root), resolvedPath) &&
      lstatSync(resolvedPath).isDirectory()
    );
  } catch {
    return false;
  }
}

function pathIsWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(resolve(root), resolve(candidate));
  return (
    pathFromRoot === "" ||
    (!pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot))
  );
}

function replaceRelativeSymlink(
  root: string,
  target: string,
  linkPath: string,
): void {
  const findings = [
    ...validateRepoContainedPath(root, {
      label: "symlink target",
      path: relative(root, target),
    }),
    ...validateRepoContainedPath(root, {
      label: "symlink path",
      path: relative(root, linkPath),
      checkLeaf: false,
    }),
  ];
  if (findings.length > 0) {
    throw new Error(`openspec_symlink_unsafe: ${findings.join("; ")}`);
  }
  rmSync(linkPath, { force: true, recursive: true });
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(relative(dirname(linkPath), target), linkPath);
}

function validateRelativeSymlink(
  target: string,
  linkPath: string,
  findings: string[],
): void {
  if (!existsOrSymlink(linkPath)) {
    findings.push(`openspec_link_missing: ${linkPath}`);
    return;
  }
  const stats = lstatSync(linkPath);
  if (!stats.isSymbolicLink()) {
    findings.push(`openspec_link_not_symlink: ${linkPath}`);
    return;
  }
  const expected = relative(dirname(linkPath), target);
  if (readlinkSync(linkPath) !== expected) {
    findings.push(`openspec_link_misdirected: ${linkPath}`);
    return;
  }
  try {
    if (realpathSync(linkPath) !== realpathSync(target)) {
      findings.push(`openspec_link_stale: ${linkPath}`);
    }
  } catch {
    findings.push(`openspec_link_broken: ${linkPath}`);
  }
}

function copyRepositoryCandidate(source: string, target: string): void {
  assertOpenSpecProjectPaths(source, "openspec_candidate_copy_source_unsafe");
  assertOpenSpecProjectPaths(target, "openspec_candidate_copy_target_unsafe");
  cpSync(source, target, {
    recursive: true,
    dereference: false,
    force: true,
    verbatimSymlinks: true,
    filter: (path) => {
      const relativePath = normalizeRelative(relative(source, path));
      return ![".git", "node_modules", ".ax"].some(
        (ignored) =>
          relativePath === ignored || relativePath.startsWith(`${ignored}/`),
      );
    },
  });
  assertOpenSpecProjectPaths(target, "openspec_candidate_copy_target_unsafe");
}

export function gitDirtyPaths(targetRoot: string): string[] {
  const result = git(targetRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  if (result.status !== 0) {
    throw new Error(`openspec_git_status_failed: ${gitFailure(result)}`);
  }
  return parseGitPorcelainZ(result.stdout);
}

export function parseGitPorcelainZ(output: string): string[] {
  const records = output.split("\0");
  if (records.at(-1) === "") {
    records.pop();
  }
  const paths = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length < 3 || record[2] !== " ") {
      throw new Error(`openspec_git_status_malformed: record ${String(index)}`);
    }
    const status = record.slice(0, 2);
    const path = normalizeRelative(record.slice(3));
    if (!path) {
      throw new Error(
        `openspec_git_status_malformed: empty path ${String(index)}`,
      );
    }
    paths.add(path);
    if (/[RC]/.test(status)) {
      index += 1;
      const source = records[index];
      if (!source) {
        throw new Error(
          `openspec_git_status_malformed: rename source ${String(index)}`,
        );
      }
      paths.add(normalizeRelative(source));
    }
  }
  return [...paths].sort();
}

function pathTouches(left: string, right: string): boolean {
  return (
    left === right ||
    left.startsWith(`${right}/`) ||
    right.startsWith(`${left}/`)
  );
}

function normalizeRelative(path: string): string {
  return path.split("\\").join("/").replace(/^\.\//, "");
}

function realPathOrResolved(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function existsOrSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function git(
  cwd: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function gitFailure(result: {
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}): string {
  return (
    result.error?.message ||
    result.stderr.trim() ||
    result.stdout.trim() ||
    `git exited with ${String(result.status)}`
  );
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}
