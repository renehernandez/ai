import { spawnSync } from "node:child_process";
import {
  existsSync,
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
import { homedir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { parse } from "smol-toml";
import { renderAgentRuntime, validateAgentSource } from "./agent-runtime.ts";
import {
  type CoordinatorTargets,
  coordinatorManagedEntries,
  readCoordinatorRegistration,
  renderCoordinatorProjects,
  validateCoordinatorRegistration,
} from "./coordinator-project-runtime.ts";
import {
  readSelectedProfile,
  selectedProfilePath,
  selectedProfilePayload,
} from "./profile-state.ts";
import { copyPath, SourceSnapshotManager } from "./source-snapshot.ts";
import {
  applyTransaction,
  type TransactionOperationInput,
} from "./transaction-engine.ts";

export type RuntimeSurface =
  | "skills"
  | "instructions"
  | "hooks"
  | "agents"
  | "coordinators";

export type SkillSourceConfig =
  | { localPath: string; names: string[] }
  | { url: string; ref: string; basePath: string; names: string[] };

export type InstructionPathConfig =
  | string
  | { sourcePath: string; targetPath: string };

export type AxRuntimeConfig = {
  version: 1;
  runtime: {
    retiredSkills?: string[];
    canonicalSkillsDir: string;
    skillSymlinkTargets: string[];
    instructionSymlinkTargets?: Record<string, string>;
    hooks?: {
      sourceDir?: string;
      canonicalDir?: string;
      targets?: Record<string, string>;
    };
    agents?: {
      sourceDir?: string;
      canonicalDir?: string;
      targets?: Record<string, string>;
    };
    coordinatorProjects?: {
      sourceDir?: string;
      targets: CoordinatorTargets;
    };
    configs?: Record<
      string,
      {
        target: string;
        managed: Record<string, unknown>;
      }
    >;
    openspec?: Record<string, unknown>;
  };
  profiles: Record<
    string,
    { include: string[]; paths: InstructionPathConfig[] }
  >;
  blocks: Record<string, { skills?: SkillSourceConfig[] }>;
};

export type RuntimePaths = {
  runtimeRoot: string;
  cacheRoot: string;
  transactionsRoot: string;
  backupsRoot: string;
  lockPath: string;
  selectedProfilePath: string;
};

export type RuntimeSyncOptions = {
  sourceRoot: string;
  config: AxRuntimeConfig;
  runtimeRoot?: string;
  surface?: RuntimeSurface;
  profile?: string;
  transactionFault?: Parameters<typeof applyTransaction>[0]["fault"];
};

export type RuntimeSyncResult = {
  status: "synchronized";
  selectedProfile: string;
  changedPaths: string[];
  sources: Array<{
    source: string;
    resolvedCommit?: string;
  }>;
};

export type RuntimeStatusReport = {
  ok: boolean;
  sourceRoot: string;
  paths: RuntimePaths;
  selectedProfile?: string;
  desiredPaths: string[];
  observed: Record<string, "missing" | "file" | "directory" | "symlink">;
  cache: "present" | "missing";
  remoteRefFreshness: "unknown_until_sync";
  findings: string[];
  warnings: string[];
};

type CandidateEntry = {
  path: string;
  surface: RuntimeSurface;
  candidatePath: string;
  asset: string;
};

type RuntimeSelection = {
  selectedProfile: string;
  installedProfiles: string[];
};

const REQUIRED_MODE_NAMES = [
  "execute",
  "explore",
  "finish",
  "plan",
  "review",
] as const;
export function runtimePaths(runtimeRoot?: string): RuntimePaths {
  const root = resolve(runtimeRoot ?? defaultRuntimeRoot());
  return {
    runtimeRoot: root,
    cacheRoot: join(root, "cache"),
    transactionsRoot: join(root, "transactions"),
    backupsRoot: join(root, "backups"),
    lockPath: join(root, "mutation.lock"),
    selectedProfilePath: selectedProfilePath(root),
  };
}

export function syncRuntime(options: RuntimeSyncOptions): RuntimeSyncResult {
  const sourceRoot = resolve(options.sourceRoot);
  const paths = runtimePaths(options.runtimeRoot);
  if (options.surface && options.profile) {
    throw new Error(
      "profile_selection_scoped: use top-level ax sync --profile <name>",
    );
  }
  assertAgentTargetsSafe(options.config, sourceRoot, options.surface);
  assertCoordinatorTargetsSafe(options.config, sourceRoot, options.surface);
  validateConfig(options.config, sourceRoot);
  assertVerifiedLiveSource(sourceRoot, paths.runtimeRoot);
  mkdirSync(paths.runtimeRoot, { recursive: true });
  const previousSelection = persistedRuntimeSelection(options.config, paths);
  const selection = resolveRuntimeSelection({
    config: options.config,
    persisted: previousSelection,
    requestedProfile: options.profile,
  });
  const stagingRoot = mkdtempSync(join(paths.runtimeRoot, ".candidate-"));
  const snapshots = new SourceSnapshotManager({
    cacheRoot: paths.cacheRoot,
    temporaryRoot: stagingRoot,
  });
  try {
    const built = buildRuntimeCandidate({
      config: options.config,
      sourceRoot,
      selection,
      stagingRoot,
      snapshots,
      surface: options.surface,
    });
    const operations = runtimeTransactionOperations({
      config: options.config,
      sourceRoot,
      desired: built.entries,
      previousSelection,
      selection,
      surface: options.surface,
      runtimeRoot: paths.runtimeRoot,
    });
    const candidateSelectionPath = options.surface
      ? undefined
      : join(stagingRoot, "selected-profile.json");
    if (candidateSelectionPath) {
      writeFileSync(
        candidateSelectionPath,
        selectedProfilePayload(selection.selectedProfile),
        { encoding: "utf-8", mode: 0o600 },
      );
    }
    const exactTargetPaths = [
      ...operations.map((operation) => operation.path),
      ...(options.surface ? [] : [paths.selectedProfilePath]),
    ];
    applyTransaction({
      domain: `runtime:${paths.runtimeRoot}`,
      root: paths.runtimeRoot,
      lockPath: paths.lockPath,
      transactionsRoot: paths.transactionsRoot,
      backupsRoot: paths.backupsRoot,
      operations,
      exactTargetPaths,
      manifestPath: options.surface ? undefined : paths.selectedProfilePath,
      candidateManifestPath: candidateSelectionPath,
      metadata: {
        previousProfile: previousSelection?.selectedProfile ?? null,
        selectedProfile: selection.selectedProfile,
        surface: options.surface ?? null,
      },
      validateApplied: () => {
        const report = inspectRuntime(options);
        if (!report.ok) {
          throw new Error(
            `runtime_post_sync_validation_failed:\n${report.findings.map((finding) => `- ${finding}`).join("\n")}`,
          );
        }
      },
      fault: options.transactionFault,
    });
    const changedPaths = operations
      .map((operation) => operation.path)
      .sort((left, right) => left.localeCompare(right));
    const report = inspectRuntime(options);
    if (!report.ok) {
      throw new Error(
        `runtime_post_sync_validation_failed:\n${report.findings.map((finding) => `- ${finding}`).join("\n")}`,
      );
    }
    return {
      status: "synchronized",
      selectedProfile: selection.selectedProfile,
      changedPaths,
      sources: built.sources,
    };
  } finally {
    snapshots.dispose();
    rmSync(stagingRoot, { force: true, recursive: true });
  }
}

export function inspectRuntime(input: {
  sourceRoot: string;
  config: AxRuntimeConfig;
  runtimeRoot?: string;
  surface?: RuntimeSurface;
}): RuntimeStatusReport {
  const sourceRoot = resolve(input.sourceRoot);
  const paths = runtimePaths(input.runtimeRoot);
  const findings: string[] = [];
  const warnings: string[] = [];
  let selection: RuntimeSelection | undefined;
  try {
    validateConfig(input.config, sourceRoot);
    selection = persistedRuntimeSelection(input.config, paths);
    if (!selection) {
      findings.push(profileInitializationFinding(input.config));
    }
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
  const profiles = selection?.installedProfiles ?? [];
  const desired = selection
    ? configuredDesiredPaths(input.config, profiles, sourceRoot)
    : new Set<string>();
  const desiredPaths = [...desired]
    .filter(
      (path) =>
        !input.surface ||
        pathBelongsToSurface(input.config, path, input.surface, sourceRoot),
    )
    .sort();
  const observed: RuntimeStatusReport["observed"] = {};
  for (const path of desiredPaths) {
    observed[path] = pathKind(path);
    if (observed[path] === "missing") {
      findings.push(`runtime_path_missing: ${path}`);
    }
  }
  if (selection && (!input.surface || input.surface === "skills")) {
    const canonicalSkills = expandPath(
      input.config.runtime.canonicalSkillsDir,
      sourceRoot,
    );
    for (const name of configuredSkillNames(
      input.config,
      profiles,
      sourceRoot,
    )) {
      const skillPath = join(canonicalSkills, name);
      const skillFile = join(skillPath, "SKILL.md");
      if (pathKind(skillPath) !== "missing" && !existsSync(skillFile)) {
        findings.push(`runtime_skill_invalid: ${skillFile} is missing`);
      }
    }
  }
  if (selection) {
    for (const [path, target] of expectedRuntimeLinks(
      input.config,
      profiles,
      sourceRoot,
      input.surface,
    )) {
      if (pathKind(path) === "missing") {
        continue;
      }
      if (pathKind(path) !== "symlink") {
        findings.push(`runtime_link_invalid: ${path} is not a symlink`);
        continue;
      }
      const observedTarget = resolve(dirname(path), readlinkSync(path));
      if (observedTarget !== resolve(target)) {
        findings.push(
          `runtime_link_target_invalid: ${path} points to ${observedTarget}, expected ${resolve(target)}`,
        );
      }
    }
  }
  if (selection && (!input.surface || input.surface === "skills")) {
    for (const path of retiredLifecyclePaths(input.config, sourceRoot)) {
      if (existsOrSymlink(path)) {
        findings.push(`retired_runtime_path_present: ${path}`);
      }
    }
  }
  if (!existsSync(paths.cacheRoot)) {
    warnings.push(
      "cache_missing: disposable source cache will be recreated by sync",
    );
  }
  warnings.push(
    "remote_ref_freshness_unknown: run ax sync to resolve configured refs",
  );
  if (
    selection &&
    input.config.runtime.coordinatorProjects &&
    (!input.surface || input.surface === "coordinators")
  ) {
    const registration = readCoordinatorRegistration(paths.runtimeRoot);
    if (registration === undefined) {
      warnings.push(
        "coordinator_registration_missing: register both saved Codex project IDs before activation",
      );
    } else {
      const targets = Object.fromEntries(
        Object.entries(input.config.runtime.coordinatorProjects.targets).map(
          ([kind, target]) => [kind, expandPath(target, sourceRoot)],
        ),
      ) as CoordinatorTargets;
      findings.push(
        ...validateCoordinatorRegistration({ registration, targets }),
      );
    }
  }
  return {
    ok: findings.length === 0,
    sourceRoot,
    paths,
    selectedProfile: selection?.selectedProfile,
    desiredPaths,
    observed,
    cache: existsSync(paths.cacheRoot) ? "present" : "missing",
    remoteRefFreshness: "unknown_until_sync",
    findings,
    warnings,
  };
}

export function validateRuntime(input: {
  sourceRoot: string;
  config: AxRuntimeConfig;
  runtimeRoot?: string;
  surface?: RuntimeSurface;
}): RuntimeStatusReport {
  const report = inspectRuntime(input);
  if (
    input.config.runtime.agents &&
    (!input.surface || input.surface === "agents")
  ) {
    const sourceDir = input.config.runtime.agents.sourceDir ?? "agents";
    validateAgentSource(resolve(input.sourceRoot, sourceDir));
  }
  if (
    input.config.runtime.coordinatorProjects &&
    (!input.surface || input.surface === "coordinators")
  ) {
    validateCoordinatorTargets(input.config, input.sourceRoot);
  }
  if (!report.ok) {
    throw new Error(
      `runtime_validation_failed:\n${report.findings.map((finding) => `- ${finding}`).join("\n")}`,
    );
  }
  return report;
}

function buildRuntimeCandidate(input: {
  config: AxRuntimeConfig;
  sourceRoot: string;
  selection: RuntimeSelection;
  stagingRoot: string;
  snapshots: SourceSnapshotManager;
  surface?: RuntimeSurface;
}): {
  entries: Map<string, CandidateEntry>;
  sources: RuntimeSyncResult["sources"];
} {
  const entries = new Map<string, CandidateEntry>();
  const sources: RuntimeSyncResult["sources"] = [];
  const skillSources = new Map<string, string>();
  let candidateSequence = 0;
  let localSnapshotRoot: string | undefined;
  const includeSurface = (surface: RuntimeSurface): boolean =>
    !input.surface || input.surface === surface;
  const getLocalSnapshotRoot = (): string => {
    if (localSnapshotRoot) {
      return localSnapshotRoot;
    }
    const sourceSnapshot = input.snapshots.snapshotLocal(input.sourceRoot);
    sources.push({
      source: input.sourceRoot,
      resolvedCommit: sourceSnapshot.resolvedCommit,
    });
    localSnapshotRoot = sourceSnapshot.path;
    return localSnapshotRoot;
  };
  const localRelative = (path: string): string => {
    const absolute = resolve(input.sourceRoot, path);
    const rel = relative(input.sourceRoot, absolute);
    if (
      rel === ".." ||
      rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    ) {
      throw new Error(`source_path_escape: ${path}`);
    }
    assertExistingSourceContained(
      input.sourceRoot,
      absolute,
      `source_path_escape: ${path}`,
    );
    const snapshotRoot = getLocalSnapshotRoot();
    const snapshotPath = join(snapshotRoot, rel);
    assertExistingSourceContained(
      snapshotRoot,
      snapshotPath,
      `source_path_escape: ${path}`,
    );
    return snapshotPath;
  };

  if (includeSurface("skills")) {
    const skillNames = new Set<string>();
    for (const profileName of input.selection.installedProfiles) {
      for (const source of selectedSkillSources(input.config, profileName)) {
        const snapshot =
          "localPath" in source
            ? {
                root: getLocalSnapshotRoot(),
                path: localRelative(source.localPath),
                source: resolve(input.sourceRoot, source.localPath),
              }
            : (() => {
                const remote = input.snapshots.snapshotRemote(
                  source.url,
                  source.ref,
                );
                sources.push({
                  source: `${source.url}#${source.ref}`,
                  resolvedCommit: remote.resolvedCommit,
                });
                const basePath = join(remote.path, source.basePath);
                assertExistingSourceContained(
                  remote.path,
                  basePath,
                  `remote_base_path_escape: ${source.basePath}`,
                );
                return {
                  root: remote.path,
                  path: basePath,
                  source: `${source.url}#${source.ref}`,
                };
              })();
        const names = expandSkillNames(snapshot.path, source.names);
        for (const name of names) {
          validateSkillName(name, "skill name");
          if (input.config.runtime.retiredSkills?.includes(name)) {
            throw new Error(`retired_lifecycle_configured: ${name}`);
          }
          skillNames.add(name);
          const skillSource = join(snapshot.path, name);
          const previousSource = skillSources.get(name);
          if (previousSource && previousSource !== skillSource) {
            throw new Error(
              `candidate_collision: skill ${name} is declared by ${previousSource} and ${skillSource}`,
            );
          }
          skillSources.set(name, skillSource);
          assertExistingSourceContained(
            snapshot.root,
            skillSource,
            `skill_source_escape: ${name} from ${snapshot.source}`,
          );
          if (!existsSync(join(skillSource, "SKILL.md"))) {
            throw new Error(`skill_missing: ${name} from ${snapshot.source}`);
          }
          const canonicalRoot = expandPath(
            input.config.runtime.canonicalSkillsDir,
            input.sourceRoot,
          );
          const canonicalTarget = join(canonicalRoot, name);
          assertRuntimeTargetContained(
            canonicalRoot,
            canonicalTarget,
            `runtime_target_escape: skills/${name}`,
          );
          registerCopiedCandidate(entries, {
            stagingRoot: input.stagingRoot,
            candidateIndex: candidateSequence++,
            path: canonicalTarget,
            sourcePath: skillSource,
            surface: "skills",
            asset: `skills/${name}`,
          });
          for (const targetRoot of input.config.runtime.skillSymlinkTargets) {
            const expandedRoot = expandPath(targetRoot, input.sourceRoot);
            const targetPath = join(expandedRoot, name);
            assertRuntimeTargetContained(
              expandedRoot,
              targetPath,
              `runtime_target_escape: skill-link/${name}`,
            );
            registerSymlinkCandidate(entries, {
              stagingRoot: input.stagingRoot,
              candidateIndex: candidateSequence++,
              path: targetPath,
              target: canonicalTarget,
              surface: "skills",
              asset: `skill-link/${name}`,
            });
          }
        }
      }
    }
    for (const mode of REQUIRED_MODE_NAMES) {
      if (!skillNames.has(mode)) {
        throw new Error(
          `mode_inventory_invalid: selected profiles are missing ${mode}`,
        );
      }
    }
  }

  if (includeSurface("instructions")) {
    const instructions = selectedInstructionPaths(
      input.config,
      input.selection.installedProfiles,
    );
    if (instructions.length > 0) {
      const instructionTargets =
        input.config.runtime.instructionSymlinkTargets ?? {};
      const canonicalInstructionTarget =
        canonicalTargetName(instructionTargets);
      for (const instruction of instructions) {
        const sourcePath = localRelative(instructionSourcePath(instruction));
        if (!existsOrSymlink(sourcePath)) {
          throw new Error(
            `instruction_missing: ${instructionSourcePath(instruction)}`,
          );
        }
        const targetRelative = instructionTargetPath(instruction);
        const canonicalRoot = expandPath(
          instructionTargets[canonicalInstructionTarget],
          input.sourceRoot,
        );
        const canonicalPath = join(canonicalRoot, targetRelative);
        assertRuntimeTargetContained(
          canonicalRoot,
          canonicalPath,
          `runtime_target_escape: instructions/${targetRelative}`,
        );
        assertInstructionTargetIsIndependent(
          input.config,
          input.sourceRoot,
          canonicalPath,
          targetRelative,
        );
        registerCopiedCandidate(entries, {
          stagingRoot: input.stagingRoot,
          candidateIndex: candidateSequence++,
          path: canonicalPath,
          sourcePath,
          surface: "instructions",
          asset: `instructions/${targetRelative}`,
        });
        for (const [targetName, targetRoot] of Object.entries(
          instructionTargets,
        )) {
          if (targetName === canonicalInstructionTarget) {
            continue;
          }
          const expandedRoot = expandPath(targetRoot, input.sourceRoot);
          const targetPath = join(expandedRoot, targetRelative);
          assertRuntimeTargetContained(
            expandedRoot,
            targetPath,
            `runtime_target_escape: instruction-link/${targetName}/${targetRelative}`,
          );
          assertInstructionTargetIsIndependent(
            input.config,
            input.sourceRoot,
            targetPath,
            targetRelative,
          );
          registerSymlinkCandidate(entries, {
            stagingRoot: input.stagingRoot,
            candidateIndex: candidateSequence++,
            path: targetPath,
            target: canonicalPath,
            surface: "instructions",
            asset: `instruction-link/${targetName}/${targetRelative}`,
          });
        }
      }
    }
  }

  const hooks = includeSurface("hooks")
    ? input.config.runtime.hooks
    : undefined;
  if (hooks) {
    const sourceDir = hooks.sourceDir ?? "hooks";
    if (isAbsolute(sourceDir)) {
      throw new Error(
        "hooks_source_must_be_repository_relative: runtime.hooks.sourceDir",
      );
    }
    const hookSource = localRelative(sourceDir);
    if (!existsSync(hookSource)) {
      throw new Error(`hooks_source_missing: ${sourceDir}`);
    }
    const canonicalHooks = expandPath(
      hooks.canonicalDir ?? "~/.agents/hooks",
      input.sourceRoot,
    );
    assertRuntimeAssetRoot(canonicalHooks, "runtime hook root");
    registerCopiedCandidate(entries, {
      stagingRoot: input.stagingRoot,
      candidateIndex: candidateSequence++,
      path: canonicalHooks,
      sourcePath: hookSource,
      surface: "hooks",
      asset: "hooks",
    });
    for (const [targetName, targetPath] of Object.entries(
      hooks.targets ?? {},
    )) {
      const expandedTarget = expandPath(targetPath, input.sourceRoot);
      assertRuntimeAssetRoot(
        expandedTarget,
        `runtime hook target ${targetName}`,
      );
      registerSymlinkCandidate(entries, {
        stagingRoot: input.stagingRoot,
        candidateIndex: candidateSequence++,
        path: expandedTarget,
        target: canonicalHooks,
        surface: "hooks",
        asset: `hook-link/${targetName}`,
      });
    }
  }

  const agents = includeSurface("agents")
    ? input.config.runtime.agents
    : undefined;
  if (agents) {
    const sourceDir = agents.sourceDir ?? "agents";
    if (isAbsolute(sourceDir)) {
      throw new Error(
        "agents_source_must_be_repository_relative: runtime.agents.sourceDir",
      );
    }
    const agentSource = localRelative(sourceDir);
    const renderedAgents = join(input.stagingRoot, "rendered-agents");
    renderAgentRuntime({ sourceDir: agentSource, outputDir: renderedAgents });
    const canonicalAgents = expandPath(
      agents.canonicalDir ?? "~/.agents/agents",
      input.sourceRoot,
    );
    assertRuntimeAssetRoot(canonicalAgents, "runtime agent root");
    registerCopiedCandidate(entries, {
      stagingRoot: input.stagingRoot,
      candidateIndex: candidateSequence++,
      path: canonicalAgents,
      sourcePath: renderedAgents,
      surface: "agents",
      asset: "agents",
    });
    for (const [targetName, targetPath] of Object.entries(
      agents.targets ?? {},
    )) {
      if (targetName !== "codex") {
        throw new Error(`unsupported_agent_target: ${targetName}`);
      }
      const expandedTarget = expandPath(targetPath, input.sourceRoot);
      assertRuntimeAssetRoot(
        expandedTarget,
        `runtime agent target ${targetName}`,
      );
      registerSymlinkCandidate(entries, {
        stagingRoot: input.stagingRoot,
        candidateIndex: candidateSequence++,
        path: expandedTarget,
        target: join(canonicalAgents, targetName),
        surface: "agents",
        asset: `agent-link/${targetName}`,
      });
    }
  }

  const coordinators = includeSurface("coordinators")
    ? input.config.runtime.coordinatorProjects
    : undefined;
  if (coordinators) {
    const coordinatorSourceDir =
      coordinators.sourceDir ?? "coordinator-projects";
    const coordinatorSource = localRelative(coordinatorSourceDir);
    const agentSourceDir = input.config.runtime.agents?.sourceDir ?? "agents";
    const agentSource = localRelative(agentSourceDir);
    const renderedAgents = join(
      input.stagingRoot,
      "coordinator-rendered-agents",
    );
    renderAgentRuntime({ sourceDir: agentSource, outputDir: renderedAgents });
    const renderedProjects = join(input.stagingRoot, "rendered-coordinators");
    const targets = Object.fromEntries(
      Object.entries(coordinators.targets).map(([kind, target]) => [
        kind,
        expandPath(target, input.sourceRoot),
      ]),
    ) as CoordinatorTargets;
    renderCoordinatorProjects({
      sourceDir: coordinatorSource,
      agentSourceDir: agentSource,
      renderedAgentsDir: renderedAgents,
      outputDir: renderedProjects,
      targets,
    });
    for (const kind of ["delivery", "operations"] as const) {
      registerCopiedCandidate(entries, {
        stagingRoot: input.stagingRoot,
        candidateIndex: candidateSequence++,
        path: targets[kind],
        sourcePath: join(renderedProjects, kind),
        surface: "coordinators",
        asset: `coordinator-project/${kind}`,
      });
    }
  }
  return { entries, sources: deduplicateSources(sources) };
}

function runtimeTransactionOperations(input: {
  config: AxRuntimeConfig;
  sourceRoot: string;
  desired: Map<string, CandidateEntry>;
  previousSelection?: RuntimeSelection;
  selection: RuntimeSelection;
  surface?: RuntimeSurface;
  runtimeRoot: string;
}): TransactionOperationInput[] {
  const operations = [...input.desired.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, candidate]) => ({
      path,
      asset: candidate.asset,
      candidatePath: candidate.candidatePath,
    })) satisfies TransactionOperationInput[];
  const desiredPaths = configuredDesiredPaths(
    input.config,
    input.selection.installedProfiles,
    input.sourceRoot,
  );
  const removalPaths = new Set<string>();
  if (input.previousSelection) {
    for (const path of configuredDesiredPaths(
      input.config,
      input.previousSelection.installedProfiles,
      input.sourceRoot,
    )) {
      if (
        !desiredPaths.has(path) &&
        (!input.surface ||
          pathBelongsToSurface(
            input.config,
            path,
            input.surface,
            input.sourceRoot,
          ))
      ) {
        removalPaths.add(path);
      }
    }
  }
  if (!input.surface || input.surface === "skills") {
    for (const path of retiredLifecyclePaths(input.config, input.sourceRoot)) {
      removalPaths.add(path);
    }
  }
  if (!input.surface) {
    removalPaths.add(join(input.runtimeRoot, "managed-runtime.json"));
  }
  const desiredOperationPaths = new Set(operations.map(({ path }) => path));
  for (const path of [...removalPaths].sort()) {
    if (desiredOperationPaths.has(path) || !existsOrSymlink(path)) {
      continue;
    }
    operations.push({
      path,
      asset: `runtime removal ${path}`,
      delete: true,
    });
  }
  return operations;
}

function persistedRuntimeSelection(
  config: AxRuntimeConfig,
  paths: RuntimePaths,
): RuntimeSelection | undefined {
  const state = readSelectedProfile(paths.runtimeRoot);
  if (!state) {
    return undefined;
  }
  return selectionForProfile(config, state.selectedProfile);
}

function resolveRuntimeSelection(input: {
  config: AxRuntimeConfig;
  persisted?: RuntimeSelection;
  requestedProfile?: string;
}): RuntimeSelection {
  if (input.requestedProfile) {
    return selectionForProfile(input.config, input.requestedProfile);
  }
  if (input.persisted) {
    return input.persisted;
  }
  throw new Error(profileInitializationFinding(input.config));
}

function selectionForProfile(
  config: AxRuntimeConfig,
  selectedProfile: string,
): RuntimeSelection {
  if (!config.profiles[selectedProfile]) {
    throw new Error(
      `selected_profile_unknown: '${selectedProfile}'. Available profiles: ${availableProfiles(config).join(", ")}`,
    );
  }
  return {
    selectedProfile,
    installedProfiles: [selectedProfile],
  };
}

function availableProfiles(config: AxRuntimeConfig): string[] {
  return Object.keys(config.profiles).sort();
}

function profileInitializationFinding(config: AxRuntimeConfig): string {
  return `runtime_profile_uninitialized: run ax sync --profile <name>. Available profiles: ${availableProfiles(config).join(", ")}`;
}

function pathKind(path: string): "missing" | "file" | "directory" | "symlink" {
  if (!existsOrSymlink(path)) {
    return "missing";
  }
  const stats = lstatSync(path);
  if (stats.isSymbolicLink()) {
    return "symlink";
  }
  if (stats.isDirectory()) {
    return "directory";
  }
  return "file";
}

function expectedRuntimeLinks(
  config: AxRuntimeConfig,
  profiles: string[],
  sourceRoot: string,
  surface?: RuntimeSurface,
): Map<string, string> {
  const links = new Map<string, string>();
  const canonicalSkills = expandPath(
    config.runtime.canonicalSkillsDir,
    sourceRoot,
  );
  for (const name of configuredSkillNames(config, profiles, sourceRoot)) {
    const canonicalTarget = join(canonicalSkills, name);
    for (const targetRoot of config.runtime.skillSymlinkTargets) {
      links.set(
        join(expandPath(targetRoot, sourceRoot), name),
        canonicalTarget,
      );
    }
  }

  const instructionTargets = config.runtime.instructionSymlinkTargets ?? {};
  if (Object.keys(instructionTargets).length > 0) {
    const canonicalName = canonicalTargetName(instructionTargets);
    const canonicalRoot = expandPath(
      instructionTargets[canonicalName],
      sourceRoot,
    );
    for (const instruction of selectedInstructionPaths(config, profiles)) {
      const targetRelative = instructionTargetPath(instruction);
      const canonicalTarget = join(canonicalRoot, targetRelative);
      for (const [targetName, targetRoot] of Object.entries(
        instructionTargets,
      )) {
        if (targetName !== canonicalName) {
          links.set(
            join(expandPath(targetRoot, sourceRoot), targetRelative),
            canonicalTarget,
          );
        }
      }
    }
  }

  const hooks = config.runtime.hooks;
  if (hooks) {
    const canonicalHooks = expandPath(
      hooks.canonicalDir ?? "~/.agents/hooks",
      sourceRoot,
    );
    for (const target of Object.values(hooks.targets ?? {})) {
      links.set(expandPath(target, sourceRoot), canonicalHooks);
    }
  }

  const agents = config.runtime.agents;
  if (agents) {
    const canonicalAgents = expandPath(
      agents.canonicalDir ?? "~/.agents/agents",
      sourceRoot,
    );
    for (const [targetName, target] of Object.entries(agents.targets ?? {})) {
      links.set(
        expandPath(target, sourceRoot),
        join(canonicalAgents, targetName),
      );
    }
  }

  if (!surface) {
    return links;
  }
  return new Map(
    [...links].filter(([path]) =>
      pathBelongsToSurface(config, path, surface, sourceRoot),
    ),
  );
}
function registerCopiedCandidate(
  entries: Map<string, CandidateEntry>,
  input: {
    stagingRoot: string;
    candidateIndex: number;
    path: string;
    sourcePath: string;
    surface: RuntimeSurface;
    asset: string;
  },
): void {
  const candidatePath = join(
    input.stagingRoot,
    "entries",
    `${input.candidateIndex.toString().padStart(5, "0")}-${sanitize(input.asset)}`,
  );
  copyPath(input.sourcePath, candidatePath);
  registerCandidate(entries, {
    path: resolve(input.path),
    surface: input.surface,
    candidatePath,
    asset: input.asset,
  });
}

function registerSymlinkCandidate(
  entries: Map<string, CandidateEntry>,
  input: {
    stagingRoot: string;
    candidateIndex: number;
    path: string;
    target: string;
    surface: RuntimeSurface;
    asset: string;
  },
): void {
  const candidatePath = join(
    input.stagingRoot,
    "entries",
    `${input.candidateIndex.toString().padStart(5, "0")}-${sanitize(input.asset)}`,
  );
  mkdirSync(dirname(candidatePath), { recursive: true });
  symlinkSync(resolve(input.target), candidatePath);
  registerCandidate(entries, {
    path: resolve(input.path),
    surface: input.surface,
    candidatePath,
    asset: input.asset,
  });
}

function registerCandidate(
  entries: Map<string, CandidateEntry>,
  entry: CandidateEntry,
): void {
  const existing = entries.get(entry.path);
  if (existing && existing.asset !== entry.asset) {
    throw new Error(
      `candidate_collision: ${entry.path} is declared by ${existing.asset} and ${entry.asset}`,
    );
  }
  if (!existing) {
    entries.set(entry.path, entry);
  }
}

function selectedSkillSources(
  config: AxRuntimeConfig,
  profileName: string,
): SkillSourceConfig[] {
  const profile = config.profiles[profileName];
  if (!profile) {
    throw new Error(`unknown_profile: ${profileName}`);
  }
  return profile.include.flatMap((blockName) => {
    const block = config.blocks[blockName];
    if (!block) {
      throw new Error(`unknown_block: ${blockName}`);
    }
    return block.skills ?? [];
  });
}

function selectedInstructionPaths(
  config: AxRuntimeConfig,
  profiles: string[],
): InstructionPathConfig[] {
  const paths = new Map<string, InstructionPathConfig>();
  for (const profileName of profiles) {
    const profile = config.profiles[profileName];
    if (!profile) {
      throw new Error(`unknown_profile: ${profileName}`);
    }
    for (const instruction of profile.paths) {
      paths.set(instructionTargetPath(instruction), instruction);
    }
  }
  return [...paths.values()].sort((left, right) =>
    instructionTargetPath(left).localeCompare(instructionTargetPath(right)),
  );
}

function configuredDesiredPaths(
  config: AxRuntimeConfig,
  profiles: string[],
  sourceRoot: string,
): Set<string> {
  const paths = new Set<string>();
  const names = configuredSkillNames(config, profiles, sourceRoot);
  for (const name of names) {
    paths.add(
      join(expandPath(config.runtime.canonicalSkillsDir, sourceRoot), name),
    );
    for (const target of config.runtime.skillSymlinkTargets) {
      paths.add(join(expandPath(target, sourceRoot), name));
    }
  }
  const instructionTargets = config.runtime.instructionSymlinkTargets ?? {};
  for (const instruction of selectedInstructionPaths(config, profiles)) {
    for (const target of Object.values(instructionTargets)) {
      paths.add(
        join(
          expandPath(target, sourceRoot),
          instructionTargetPath(instruction),
        ),
      );
    }
  }
  if (config.runtime.hooks) {
    paths.add(
      expandPath(
        config.runtime.hooks.canonicalDir ?? "~/.agents/hooks",
        sourceRoot,
      ),
    );
    for (const target of Object.values(config.runtime.hooks.targets ?? {})) {
      paths.add(expandPath(target, sourceRoot));
    }
  }
  if (config.runtime.agents) {
    paths.add(
      expandPath(
        config.runtime.agents.canonicalDir ?? "~/.agents/agents",
        sourceRoot,
      ),
    );
    for (const target of Object.values(config.runtime.agents.targets ?? {})) {
      paths.add(expandPath(target, sourceRoot));
    }
  }
  if (config.runtime.coordinatorProjects) {
    for (const target of Object.values(
      config.runtime.coordinatorProjects.targets,
    )) {
      paths.add(expandPath(target, sourceRoot));
    }
  }
  return paths;
}

function configuredSkillNames(
  config: AxRuntimeConfig,
  profiles: string[],
  sourceRoot: string,
): Set<string> {
  const names = new Set<string>();
  for (const profile of profiles) {
    for (const source of selectedSkillSources(config, profile)) {
      for (const name of source.names) {
        if (name !== "*") {
          names.add(name);
        } else if ("localPath" in source) {
          for (const discovered of expandSkillNames(
            expandPath(source.localPath, sourceRoot),
            source.names,
          )) {
            names.add(discovered);
          }
        }
      }
    }
  }
  return names;
}

function pathBelongsToSurface(
  config: AxRuntimeConfig,
  path: string,
  surface: RuntimeSurface,
  sourceRoot: string,
): boolean {
  const absolute = resolve(path);
  const skillRoots = runtimeSkillRoots(config, sourceRoot);
  const hookRoots = runtimeHookRoots(config, sourceRoot);
  const agentRoots = runtimeAgentRoots(config, sourceRoot);
  const coordinatorRoots = runtimeCoordinatorRoots(config, sourceRoot);
  if (surface === "skills") {
    return skillRoots.some((root) => isDirectChild(absolute, root));
  }
  if (surface === "hooks") {
    return hookRoots.some((root) => absolute === root);
  }
  if (surface === "agents") {
    return agentRoots.some((root) => absolute === root);
  }
  if (surface === "coordinators") {
    return coordinatorRoots.some((root) => absolute === root);
  }
  if (
    skillRoots.some((root) => pathWithin(absolute, root)) ||
    hookRoots.some((root) => pathWithin(absolute, root)) ||
    agentRoots.some((root) => pathWithin(absolute, root)) ||
    coordinatorRoots.some((root) => pathWithin(absolute, root))
  ) {
    return false;
  }
  return Object.values(config.runtime.instructionSymlinkTargets ?? {}).some(
    (root) => pathWithin(absolute, expandPath(root, sourceRoot)),
  );
}

function retiredLifecyclePaths(
  config: AxRuntimeConfig,
  sourceRoot: string,
): string[] {
  const roots = [
    config.runtime.canonicalSkillsDir,
    ...config.runtime.skillSymlinkTargets,
  ];
  return roots.flatMap((root) =>
    (config.runtime.retiredSkills ?? []).map((name) =>
      join(expandPath(root, sourceRoot), name),
    ),
  );
}

function expandSkillNames(root: string, names: string[]): string[] {
  if (!names.includes("*")) {
    return [...new Set(names)].sort();
  }
  if (!existsSync(root)) {
    throw new Error(`skill_source_missing: ${root}`);
  }
  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && existsSync(join(root, entry.name, "SKILL.md")),
    )
    .map((entry) => entry.name)
    .sort();
}

function validateConfig(config: AxRuntimeConfig, sourceRoot: string): void {
  if (config.version !== 1) {
    throw new Error(`unsupported_config_version: ${String(config.version)}`);
  }
  if (
    !config.runtime?.canonicalSkillsDir ||
    !Array.isArray(config.runtime.skillSymlinkTargets)
  ) {
    throw new Error("invalid_config: runtime skill targets are required");
  }
  if (!config.profiles || Object.keys(config.profiles).length === 0) {
    throw new Error("invalid_config: profiles are required");
  }
  for (const name of config.runtime.retiredSkills ?? []) {
    validateSkillName(name, "retired_skill_name_invalid");
  }
  if (
    new Set(config.runtime.retiredSkills ?? []).size !==
    (config.runtime.retiredSkills ?? []).length
  ) {
    throw new Error("invalid_config: runtime.retiredSkills has duplicates");
  }
  validateRuntimeAssetRoots(config, sourceRoot);
  const instructionRoots = Object.values(
    config.runtime.instructionSymlinkTargets ?? {},
  ).map((root) => expandPath(root, sourceRoot));
  for (const [profileName, profile] of Object.entries(config.profiles)) {
    if (!Array.isArray(profile.include) || !Array.isArray(profile.paths)) {
      throw new Error(`invalid_config: profile ${profileName} is malformed`);
    }
    for (const instruction of profile.paths) {
      assertSafeRelativePath(
        instructionSourcePath(instruction),
        `instruction_source_path_invalid: ${profileName}`,
        false,
      );
      const targetPath = instructionTargetPath(instruction);
      assertSafeRelativePath(
        targetPath,
        `instruction_target_path_invalid: ${profileName}`,
        false,
      );
      for (const root of instructionRoots) {
        const target = join(root, targetPath);
        assertRuntimeTargetContained(
          root,
          target,
          `runtime_target_escape: instructions/${targetPath}`,
        );
        assertInstructionTargetIsIndependent(
          config,
          sourceRoot,
          target,
          targetPath,
        );
      }
    }
  }

  for (const [blockName, block] of Object.entries(config.blocks ?? {})) {
    for (const source of block.skills ?? []) {
      if (!Array.isArray(source.names) || source.names.length === 0) {
        throw new Error(
          `invalid_config: block ${blockName} has no skill names`,
        );
      }
      for (const name of source.names) {
        validateSkillName(name, `skill_name_invalid: ${blockName}`, true);
      }
      if ("localPath" in source) {
        assertSafeRelativePath(
          source.localPath,
          `local_skill_path_invalid: ${blockName}`,
          true,
        );
      } else {
        if (!source.url || !source.ref) {
          throw new Error(
            `invalid_config: remote skill source ${blockName} needs url and ref`,
          );
        }
        assertSafeRelativePath(
          source.basePath,
          `remote_base_path_invalid: ${blockName}`,
          true,
        );
      }
    }
  }

  const hookSource = config.runtime.hooks?.sourceDir;
  if (hookSource !== undefined) {
    assertSafeRelativePath(
      hookSource,
      "hooks_source_must_be_repository_relative: runtime.hooks.sourceDir",
      true,
    );
  }
  const agents = config.runtime.agents;
  if (agents) {
    if (agents.sourceDir !== undefined) {
      assertSafeRelativePath(
        agents.sourceDir,
        "agents_source_must_be_repository_relative: runtime.agents.sourceDir",
        true,
      );
    }
    for (const targetName of Object.keys(agents.targets ?? {})) {
      if (targetName !== "codex") {
        throw new Error(`unsupported_agent_target: ${targetName}`);
      }
    }
  }
  const coordinators = config.runtime.coordinatorProjects;
  if (coordinators) {
    if (coordinators.sourceDir !== undefined) {
      assertSafeRelativePath(
        coordinators.sourceDir,
        "coordinator_source_must_be_repository_relative: runtime.coordinatorProjects.sourceDir",
        true,
      );
    }
    const kinds = Object.keys(coordinators.targets).sort();
    if (kinds.join("\0") !== "delivery\0operations") {
      throw new Error(
        `coordinator_target_inventory_invalid: ${kinds.join(",")}`,
      );
    }
  }
}

function validateRuntimeAssetRoots(
  config: AxRuntimeConfig,
  sourceRoot: string,
): void {
  if (
    !config.runtime?.canonicalSkillsDir ||
    !Array.isArray(config.runtime.skillSymlinkTargets)
  ) {
    throw new Error("invalid_config: runtime skill targets are required");
  }
  const skillRoots = runtimeSkillRoots(config, sourceRoot);
  const instructionRoots = Object.values(
    config.runtime.instructionSymlinkTargets ?? {},
  ).map((root) => expandPath(root, sourceRoot));
  const hookRoots = runtimeHookRoots(config, sourceRoot);
  const agentRoots = runtimeAgentRoots(config, sourceRoot);
  const coordinatorRoots = runtimeCoordinatorRoots(config, sourceRoot);
  validateIndependentRuntimeRoots(skillRoots, "skills");
  validateIndependentRuntimeRoots(instructionRoots, "instructions");
  validateIndependentRuntimeRoots(hookRoots, "hooks");
  validateIndependentRuntimeRoots(agentRoots, "agents");
  validateIndependentRuntimeRoots(coordinatorRoots, "coordinators");
  for (const skillRoot of skillRoots) {
    assertRuntimeAssetRoot(skillRoot, "runtime skill root");
    for (const hookRoot of hookRoots) {
      if (pathWithin(skillRoot, hookRoot) || pathWithin(hookRoot, skillRoot)) {
        throw new Error(
          `runtime_root_overlap: skill root ${skillRoot} conflicts with hook root ${hookRoot}`,
        );
      }
    }
    for (const agentRoot of agentRoots) {
      if (
        pathWithin(skillRoot, agentRoot) ||
        pathWithin(agentRoot, skillRoot)
      ) {
        throw new Error(
          `runtime_root_overlap: skill root ${skillRoot} conflicts with agent root ${agentRoot}`,
        );
      }
    }
  }
  for (const instructionRoot of instructionRoots) {
    assertRuntimeAssetRoot(instructionRoot, "runtime instruction root");
  }
  for (const hookRoot of hookRoots) {
    assertRuntimeAssetRoot(hookRoot, "runtime hook root");
  }
  for (const agentRoot of agentRoots) {
    assertRuntimeAssetRoot(agentRoot, "runtime agent root");
    for (const hookRoot of hookRoots) {
      if (pathWithin(agentRoot, hookRoot) || pathWithin(hookRoot, agentRoot)) {
        throw new Error(
          `runtime_root_overlap: agent root ${agentRoot} conflicts with hook root ${hookRoot}`,
        );
      }
    }
  }
  for (const coordinatorRoot of coordinatorRoots) {
    assertRuntimeAssetRoot(coordinatorRoot, "runtime coordinator root");
    for (const otherRoot of [
      ...skillRoots,
      ...instructionRoots,
      ...hookRoots,
      ...agentRoots,
    ]) {
      if (
        pathWithin(coordinatorRoot, otherRoot) ||
        pathWithin(otherRoot, coordinatorRoot)
      ) {
        throw new Error(
          `runtime_root_overlap: coordinator root ${coordinatorRoot} conflicts with ${otherRoot}`,
        );
      }
    }
  }
}

function runtimeSkillRoots(
  config: AxRuntimeConfig,
  sourceRoot: string,
): string[] {
  return [
    config.runtime.canonicalSkillsDir,
    ...config.runtime.skillSymlinkTargets,
  ].map((root) => expandPath(root, sourceRoot));
}

function runtimeHookRoots(
  config: AxRuntimeConfig,
  sourceRoot: string,
): string[] {
  if (!config.runtime.hooks) {
    return [];
  }
  return [
    config.runtime.hooks.canonicalDir ?? "~/.agents/hooks",
    ...Object.values(config.runtime.hooks.targets ?? {}),
  ].map((root) => expandPath(root, sourceRoot));
}

function runtimeAgentRoots(
  config: AxRuntimeConfig,
  sourceRoot: string,
): string[] {
  if (!config.runtime.agents) {
    return [];
  }
  return [
    config.runtime.agents.canonicalDir ?? "~/.agents/agents",
    ...Object.values(config.runtime.agents.targets ?? {}),
  ].map((root) => expandPath(root, sourceRoot));
}

function runtimeCoordinatorRoots(
  config: AxRuntimeConfig,
  sourceRoot: string,
): string[] {
  return Object.values(config.runtime.coordinatorProjects?.targets ?? {}).map(
    (root) => expandPath(root, sourceRoot),
  );
}

function validateIndependentRuntimeRoots(
  roots: string[],
  surface: RuntimeSurface,
): void {
  const physical = roots.map((root) => ({
    configured: root,
    physical: resolveConfiguredRootLocation(root, "runtime_root_invalid"),
  }));
  for (let left = 0; left < physical.length; left += 1) {
    for (let right = left + 1; right < physical.length; right += 1) {
      const first = physical[left];
      const second = physical[right];
      if (
        pathWithin(first.physical, second.physical) ||
        pathWithin(second.physical, first.physical)
      ) {
        throw new Error(
          `runtime_root_overlap: ${surface} roots ${first.configured} and ${second.configured}`,
        );
      }
    }
  }
}

function assertRuntimeAssetRoot(path: string, label: string): void {
  const absolute = resolve(path);
  const physical = resolveConfiguredRootLocation(
    absolute,
    "runtime_root_invalid",
  );
  if (absolute === dirname(absolute) || physical === dirname(physical)) {
    throw new Error(`${label}: filesystem root is not a valid managed root`);
  }
}

function resolveConfiguredRootLocation(path: string, error: string): string {
  const absolute = resolve(path);
  return join(
    resolveThroughExistingAncestors(dirname(absolute), error),
    basename(absolute),
  );
}

function assertRuntimeTargetContained(
  root: string,
  target: string,
  error: string,
): void {
  const absoluteRoot = resolve(root);
  const absoluteTarget = resolve(target);
  if (!pathWithin(absoluteTarget, absoluteRoot)) {
    throw new Error(error);
  }
  const physicalRoot = resolveThroughExistingAncestors(
    absoluteRoot,
    "runtime_root_invalid",
  );
  const physicalParent = resolveThroughExistingAncestors(
    dirname(absoluteTarget),
    "runtime_target_parent_invalid",
  );
  const physicalTarget = join(physicalParent, basename(absoluteTarget));
  if (!pathWithin(physicalTarget, physicalRoot)) {
    throw new Error(error);
  }
}

function assertExistingSourceContained(
  root: string,
  source: string,
  error: string,
): void {
  if (!existsOrSymlink(source)) {
    return;
  }
  const physicalRoot = resolveThroughExistingAncestors(
    root,
    "source_root_invalid",
  );
  let physicalSource: string;
  try {
    physicalSource = realpathSync(source);
  } catch {
    throw new Error(error);
  }
  if (!pathWithin(physicalSource, physicalRoot)) {
    throw new Error(error);
  }
}

function resolveThroughExistingAncestors(path: string, error: string): string {
  let cursor = resolve(path);
  const suffix: string[] = [];
  for (;;) {
    try {
      return resolve(realpathSync(cursor), ...suffix);
    } catch {
      if (existsOrSymlink(cursor)) {
        throw new Error(`${error}: cannot resolve ${cursor}`);
      }
      const parent = dirname(cursor);
      if (parent === cursor) {
        throw new Error(`${error}: cannot resolve ${path}`);
      }
      suffix.unshift(basename(cursor));
      cursor = parent;
    }
  }
}

function assertInstructionTargetIsIndependent(
  config: AxRuntimeConfig,
  sourceRoot: string,
  target: string,
  relativeTarget: string,
): void {
  const absoluteTarget = resolve(target);
  const physicalTarget = join(
    resolveThroughExistingAncestors(
      dirname(absoluteTarget),
      "runtime_target_parent_invalid",
    ),
    basename(absoluteTarget),
  );
  const agentRoots = new Set(runtimeAgentRoots(config, sourceRoot));
  const conflictingRoot = [
    ...runtimeSkillRoots(config, sourceRoot),
    ...runtimeHookRoots(config, sourceRoot),
    ...runtimeAgentRoots(config, sourceRoot),
  ].find((root) => {
    if (pathWithin(absoluteTarget, root)) {
      return true;
    }
    let physicalRoot: string;
    try {
      physicalRoot = resolveThroughExistingAncestors(
        root,
        "runtime_root_invalid",
      );
    } catch (error) {
      if (agentRoots.has(root) && pathKind(root) === "symlink") {
        return false;
      }
      throw error;
    }
    return pathWithin(physicalTarget, physicalRoot);
  });
  if (conflictingRoot) {
    throw new Error(
      `instruction_target_surface_conflict: ${relativeTarget} resolves inside ${conflictingRoot}`,
    );
  }
}

function assertAgentTargetsSafe(
  config: AxRuntimeConfig,
  sourceRoot: string,
  surface?: RuntimeSurface,
): void {
  const agents = config.runtime.agents;
  if (!agents || (surface && surface !== "agents")) {
    return;
  }
  const canonical = expandPath(
    agents.canonicalDir ?? "~/.agents/agents",
    sourceRoot,
  );
  for (const [targetName, target] of Object.entries(agents.targets ?? {})) {
    const path = expandPath(target, sourceRoot);
    const kind = pathKind(path);
    if (kind === "missing") {
      continue;
    }
    if (kind !== "symlink") {
      throw new Error(`unmanaged_agent_target: ${path} is ${kind}`);
    }
    const observed = resolve(dirname(path), readlinkSync(path));
    const expected = resolve(join(canonical, targetName));
    if (observed !== expected) {
      throw new Error(
        `unmanaged_agent_target: ${path} points to ${observed}, expected ${expected}`,
      );
    }
  }
}

function assertCoordinatorTargetsSafe(
  config: AxRuntimeConfig,
  sourceRoot: string,
  surface?: RuntimeSurface,
): void {
  const coordinators = config.runtime.coordinatorProjects;
  if (!coordinators || (surface && surface !== "coordinators")) {
    return;
  }
  for (const [kind, configuredTarget] of Object.entries(coordinators.targets)) {
    const target = expandPath(configuredTarget, sourceRoot);
    const targetKind = pathKind(target);
    if (targetKind === "missing") {
      continue;
    }
    if (targetKind !== "directory") {
      throw new Error(
        `unmanaged_coordinator_target: ${target} is ${targetKind}`,
      );
    }
    const markerPath = join(target, ".ax-managed.json");
    if (!existsSync(markerPath)) {
      throw new Error(
        `unmanaged_coordinator_target: ${target} has no AX ownership marker`,
      );
    }
    let marker: Record<string, unknown>;
    try {
      marker = JSON.parse(readFileSync(markerPath, "utf-8")) as Record<
        string,
        unknown
      >;
    } catch {
      throw new Error(
        `unmanaged_coordinator_target: ${target} has an invalid AX ownership marker`,
      );
    }
    if (
      marker.asset !== "coordinator-project" ||
      marker.kind !== kind ||
      resolve(String(marker.target)) !== resolve(target)
    ) {
      throw new Error(
        `unmanaged_coordinator_target: ${target} ownership marker does not match`,
      );
    }
    if (
      JSON.stringify(marker.managed_entries) !==
      JSON.stringify(coordinatorManagedEntries(target))
    ) {
      throw new Error(
        `unmanaged_coordinator_target: ${target} content differs from its AX ownership marker`,
      );
    }
  }
}

function validateCoordinatorTargets(
  config: AxRuntimeConfig,
  sourceRoot: string,
): void {
  for (const [kind, configuredTarget] of Object.entries(
    config.runtime.coordinatorProjects?.targets ?? {},
  )) {
    const target = expandPath(configuredTarget, sourceRoot);
    if (pathKind(target) === "missing") {
      continue;
    }
    const marker = JSON.parse(
      readFileSync(join(target, ".ax-managed.json"), "utf-8"),
    ) as Record<string, unknown>;
    const policy = JSON.parse(
      readFileSync(join(target, "policy.json"), "utf-8"),
    ) as Record<string, unknown>;
    if (
      marker.kind !== kind ||
      marker.policy_sha256 !== policy.policy_sha256 ||
      JSON.stringify(marker.managed_entries) !==
        JSON.stringify(coordinatorManagedEntries(target))
    ) {
      throw new Error(`coordinator_policy_attestation_invalid: ${target}`);
    }
    parse(readFileSync(join(target, ".codex", "config.toml"), "utf-8"));
  }
}

function assertSafeRelativePath(
  value: string,
  label: string,
  allowDot: boolean,
): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}: path must be non-empty`);
  }
  const normalized = value.replace(/\\/g, "/");
  if (
    isAbsolute(value) ||
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith("/")
  ) {
    throw new Error(`${label}: path must be repository-relative: ${value}`);
  }
  if (allowDot && normalized === ".") {
    return;
  }
  const segments = normalized.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    throw new Error(`${label}: path escapes its configured root: ${value}`);
  }
}

function validateSkillName(
  name: string,
  label: string,
  allowWildcard = false,
): void {
  if (allowWildcard && name === "*") {
    return;
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new Error(`${label}: invalid skill name '${name}'`);
  }
}

function isDirectChild(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    dirname(rel) === "."
  );
}

export function sourceIsVerifiedForLiveMutation(sourceRoot: string): boolean {
  if (sourceRoot.includes(`${join(".codex", "worktrees")}`)) {
    return false;
  }
  const branch = git(sourceRoot, ["branch", "--show-current"]);
  const status = git(sourceRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const head = git(sourceRoot, ["rev-parse", "HEAD"]);
  const upstream = git(sourceRoot, ["rev-parse", "@{upstream}"]);
  return (
    branch.status === 0 &&
    ["main", "master"].includes(branch.stdout.trim()) &&
    status.status === 0 &&
    status.stdout.trim() === "" &&
    head.status === 0 &&
    upstream.status === 0 &&
    head.stdout.trim() === upstream.stdout.trim()
  );
}

export function assertVerifiedLiveSource(
  sourceRoot: string,
  runtimeRoot: string,
): void {
  if (
    process.env.AX_ISOLATED_RUNTIME === "1" ||
    resolve(runtimeRoot) !== resolve(defaultRuntimeRoot())
  ) {
    return;
  }
  if (
    sourceRoot.includes(`${join(".codex", "worktrees")}`) &&
    resolve(runtimeRoot) === resolve(defaultRuntimeRoot())
  ) {
    throw new Error(
      "unverified_live_source: disposable worktree requires an isolated runtime root",
    );
  }
  if (!sourceIsVerifiedForLiveMutation(sourceRoot)) {
    throw new Error(
      "unverified_live_source: canonical live runtime requires a clean default-branch source matching its hosted upstream",
    );
  }
}

function git(
  cwd: string,
  args: string[],
): { status: number | null; stdout: string } {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf-8",
    env: withoutGitRepositoryEnv(),
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { status: result.status, stdout: result.stdout ?? "" };
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  delete env.GIT_INDEX_FILE;
  return env;
}

function expandPath(path: string, sourceRoot: string): string {
  if (path === "~") {
    return effectiveHome();
  }
  if (path.startsWith("~/")) {
    return join(effectiveHome(), path.slice(2));
  }
  return isAbsolute(path) ? resolve(path) : resolve(sourceRoot, path);
}

function effectiveHome(): string {
  return resolve(process.env.HOME || homedir());
}

function defaultRuntimeRoot(): string {
  return join(effectiveHome(), ".agents", "runtime");
}

function instructionSourcePath(path: InstructionPathConfig): string {
  return typeof path === "string" ? path : path.sourcePath;
}

function instructionTargetPath(path: InstructionPathConfig): string {
  return typeof path === "string" ? path : path.targetPath;
}

function canonicalTargetName(targets: Record<string, string>): string {
  const names = Object.keys(targets).sort();
  if (names.length === 0) {
    throw new Error("instruction_targets_missing");
  }
  return names.includes("agents") ? "agents" : names[0];
}

function deduplicateSources(
  sources: RuntimeSyncResult["sources"],
): RuntimeSyncResult["sources"] {
  return [
    ...new Map(sources.map((source) => [source.source, source])).values(),
  ].sort((left, right) => left.source.localeCompare(right.source));
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function existsOrSymlink(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

function pathWithin(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return (
    rel === "" ||
    (rel !== ".." &&
      !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}
