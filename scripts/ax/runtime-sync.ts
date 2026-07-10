import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
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
import {
  type AdoptionAction,
  adoptionActionFor,
  type InteractiveProfileSelector,
  type ManagedRuntimeManifest,
  manifestHash,
  type ProfileSelection,
  readAdoptionFile,
  readManagedRuntimeManifest,
  resolveProfileSelection,
  stableJson,
  validateManagedRuntimeManifest,
  writeManagedRuntimeManifestAtomic,
} from "./runtime-state.ts";
import {
  ABSENT_HASH,
  type ContentHash,
  copyPath,
  HASH_VERSION,
  hashPath,
  type ObservedHash,
  SourceSnapshotManager,
} from "./source-snapshot.ts";
import {
  applyTransaction,
  inspectMutationLock,
  inspectTransactions,
  type JournalTargetAuthorizer,
  type OwnershipRecord,
  type RecoveryAction,
  recoverTransactions,
  resolveRecovery,
  type TransactionJournal,
  type TransactionOperationInput,
  withMutationLock,
} from "./transaction-engine.ts";

export type RuntimeSurface = "skills" | "instructions" | "hooks";

export type SkillSourceConfig =
  | { localPath: string; names: string[] }
  | { url: string; ref: string; basePath: string; names: string[] };

export type InstructionPathConfig =
  | string
  | { sourcePath: string; targetPath: string };

export type AxRuntimeConfig = {
  version: 1;
  runtime: {
    canonicalSkillsDir: string;
    skillSymlinkTargets: string[];
    instructionSymlinkTargets?: Record<string, string>;
    hooks?: {
      sourceDir?: string;
      canonicalDir?: string;
      targets?: Record<string, string>;
    };
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
  manifestPath: string;
  cacheRoot: string;
  transactionsRoot: string;
  backupsRoot: string;
  lockPath: string;
};

export type RuntimeSyncOptions = {
  sourceRoot: string;
  config: AxRuntimeConfig;
  runtimeRoot?: string;
  surface?: RuntimeSurface;
  profiles?: string[];
  allProfiles?: boolean;
  policyProfile?: string;
  profileSelectionFile?: string;
  adoptionFile?: string;
  recoveryFile?: string;
  interactive?: boolean;
  confirm?: (message: string) => boolean;
  selectProfileSelection?: InteractiveProfileSelector;
};

export type RuntimeSyncResult = {
  status: "synchronized" | "current" | "recovered";
  manifestPath: string;
  installedProfiles: string[];
  policyProfile: string;
  changedPaths: string[];
  sources: Array<{
    source: string;
    resolvedCommit?: string;
    contentHash: ContentHash;
  }>;
};

export type RuntimeStatusReport = {
  ok: boolean;
  sourceRoot: string;
  paths: RuntimePaths;
  installedProfiles: string[];
  policyProfile?: string;
  desiredPaths: string[];
  managedPaths: string[];
  observed: Record<string, ObservedHash>;
  cache: "present" | "missing";
  remoteRefFreshness: "unknown_until_sync";
  lock?: Record<string, unknown>;
  transactions: ReturnType<typeof inspectTransactions>;
  findings: string[];
  warnings: string[];
};

type CandidateEntry = {
  path: string;
  surface: RuntimeSurface;
  candidatePath: string;
  hash: ContentHash;
  asset: string;
};

type RuntimeTransactionMetadata = {
  previousProfiles: string[] | null;
  previousPolicyProfile: string | null;
  candidateProfiles: string[];
  candidatePolicyProfile: string;
  previousInventory: Record<string, string[]>;
  candidateInventory: Record<string, string[]>;
};

type RuntimeTargetPolicy = {
  targetRoots: string[];
  directChildTargetRoots: string[];
  exactTargetPaths: string[];
};

const REQUIRED_MODE_NAMES = [
  "execute",
  "explore",
  "finish",
  "plan",
  "review",
] as const;
const RETIRED_LIFECYCLE_NAMES = [
  "brainstorming",
  "change-request-create",
  "codex-review-feedback",
  "github-adapter-review",
  "github-pr-create",
  "gitlab-adapter-review",
  "glab-mr-create",
  "merge-followthrough",
  "nitro-review-feedback",
  "openspec-tasks",
  "plan-coordinate",
  "plan-delivery",
  "plan-orchestrator",
  "plan-poc",
  "plan-ready",
  "plan-review",
  "plan-to-review",
  "plan-unit-delivery",
  "plan-unit-sequencer",
  "review-feedback-routing",
  "session-start",
  "start-project",
] as const;

export function runtimePaths(runtimeRoot?: string): RuntimePaths {
  const root = resolve(runtimeRoot ?? defaultRuntimeRoot());
  return {
    runtimeRoot: root,
    manifestPath: join(root, "managed-runtime.json"),
    cacheRoot: join(root, "cache"),
    transactionsRoot: join(root, "transactions"),
    backupsRoot: join(root, "backups"),
    lockPath: join(root, "mutation.lock"),
  };
}

export function syncRuntime(options: RuntimeSyncOptions): RuntimeSyncResult {
  const sourceRoot = resolve(options.sourceRoot);
  const paths = runtimePaths(options.runtimeRoot);
  validateRuntimeSupportPaths(paths);
  validateRuntimeAssetRoots(options.config, sourceRoot);
  const recoveryTargetPolicy = runtimeRecoveryTargetPolicy(
    options.config,
    sourceRoot,
    paths,
  );

  if (options.recoveryFile) {
    resolveRuntimeRecovery({
      paths,
      recoveryFile: options.recoveryFile,
      targetPolicy: recoveryTargetPolicy,
    });
    const recovered = readManagedRuntimeManifest(paths.manifestPath);
    return {
      status: "recovered",
      manifestPath: paths.manifestPath,
      installedProfiles: recovered?.installedProfiles ?? [],
      policyProfile: recovered?.policyProfile ?? "",
      changedPaths: [],
      sources: [],
    };
  }

  validateConfig(options.config, sourceRoot);

  return withMutationLock(
    { lockPath: paths.lockPath, domain: "runtime", root: paths.runtimeRoot },
    () => {
      recoverTransactions({
        transactionsRoot: paths.transactionsRoot,
        backupsRoot: paths.backupsRoot,
        ...recoveryTargetPolicy,
        authorizeJournalTarget: authorizeRuntimeJournalTarget,
      });
      assertVerifiedLiveSource(sourceRoot, paths.runtimeRoot);
      const existing = readManagedRuntimeManifest(paths.manifestPath);
      if (options.surface && !existing) {
        throw new Error(
          `runtime_not_initialized: ax ${options.surface} sync requires ${paths.manifestPath}; run ax sync first`,
        );
      }
      if (
        options.surface &&
        ((options.profiles?.length ?? 0) > 0 ||
          options.allProfiles ||
          options.policyProfile ||
          options.profileSelectionFile)
      ) {
        throw new Error(
          `scoped_profile_selection_forbidden: ax ${options.surface} sync consumes managed-runtime.json selection`,
        );
      }
      const selection = options.surface
        ? {
            installedProfiles: [...(existing?.installedProfiles ?? [])],
            policyProfile: existing?.policyProfile ?? "",
          }
        : resolveProfileSelection({
            availableProfiles: Object.keys(options.config.profiles),
            manifest: existing,
            requestedProfiles: options.profiles,
            allProfiles: options.allProfiles,
            requestedPolicyProfile: options.policyProfile,
            profileSelectionFile: options.profileSelectionFile,
            interactive:
              options.interactive ??
              Boolean(process.stdin.isTTY && process.stdout.isTTY),
            confirm: options.confirm,
            selectProfileSelection: options.selectProfileSelection,
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
        const desired = built.entries;
        const adoption = options.adoptionFile
          ? readAdoptionFile(options.adoptionFile)
          : undefined;
        const plan = planRuntimeOperations({
          config: options.config,
          sourceRoot,
          desired,
          existing,
          selection,
          surface: options.surface,
          adoption,
          interactive:
            options.interactive ??
            Boolean(process.stdin.isTTY && process.stdout.isTTY),
          confirm: options.confirm,
        });
        const candidateManifestPath = join(stagingRoot, "managed-runtime.json");
        writeManagedRuntimeManifestAtomic(candidateManifestPath, plan.manifest);
        const unchangedManifest =
          manifestHash(existing) === manifestHash(plan.manifest);
        if (plan.operations.length === 0 && unchangedManifest) {
          return {
            status: "current",
            manifestPath: paths.manifestPath,
            installedProfiles: selection.installedProfiles,
            policyProfile: selection.policyProfile,
            changedPaths: [],
            sources: built.sources,
          };
        }
        const metadata: RuntimeTransactionMetadata = {
          previousProfiles: existing?.installedProfiles ?? null,
          previousPolicyProfile: existing?.policyProfile ?? null,
          candidateProfiles: selection.installedProfiles,
          candidatePolicyProfile: selection.policyProfile,
          previousInventory: manifestInventoryByProfile(existing),
          candidateInventory: inventoryByProfile(
            options.config,
            selection.installedProfiles,
            sourceRoot,
          ),
        };
        applyTransaction({
          domain: "runtime",
          root: paths.runtimeRoot,
          lockPath: paths.lockPath,
          lockHeld: true,
          transactionsRoot: paths.transactionsRoot,
          backupsRoot: paths.backupsRoot,
          operations: plan.operations,
          targetRoots: [],
          directChildTargetRoots: [],
          exactTargetPaths: [
            ...plan.operations.map((operation) => operation.path),
            paths.manifestPath,
          ],
          manifestPath: paths.manifestPath,
          candidateManifestPath,
          metadata,
          validateApplied: () => {
            const applied = readManagedRuntimeManifest(paths.manifestPath);
            if (
              !applied ||
              manifestHash(applied) !== manifestHash(plan.manifest)
            ) {
              throw new Error("runtime_post_apply_manifest_mismatch");
            }
            for (const [path, hash] of Object.entries(applied.ownedPaths)) {
              if (hashPath(path) !== hash) {
                throw new Error(`runtime_post_apply_hash_mismatch: ${path}`);
              }
            }
          },
        });
        return {
          status: "synchronized",
          manifestPath: paths.manifestPath,
          installedProfiles: selection.installedProfiles,
          policyProfile: selection.policyProfile,
          changedPaths: plan.operations
            .map((operation) => operation.path)
            .sort(),
          sources: built.sources,
        };
      } finally {
        snapshots.dispose();
        rmSync(stagingRoot, { force: true, recursive: true });
      }
    },
  );
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
  let manifest: ManagedRuntimeManifest | undefined;
  try {
    validateConfig(input.config, sourceRoot);
    validateRuntimeSupportPaths(paths);
    manifest = readManagedRuntimeManifest(paths.manifestPath);
  } catch (error) {
    findings.push(error instanceof Error ? error.message : String(error));
  }
  if (!manifest) {
    findings.push(
      "profile_selection_required: managed-runtime.json is missing; run ax sync",
    );
  }
  const profiles = manifest?.installedProfiles ?? [];
  const desired = configuredDesiredPaths(input.config, profiles, sourceRoot);
  const desiredPaths = [...desired]
    .filter(
      (path) =>
        !input.surface ||
        pathBelongsToSurface(input.config, path, input.surface, sourceRoot),
    )
    .sort();
  const managedPaths = Object.keys(manifest?.ownedPaths ?? {})
    .filter(
      (path) =>
        !input.surface ||
        pathBelongsToSurface(input.config, path, input.surface, sourceRoot),
    )
    .sort();
  const observed: Record<string, ObservedHash> = {};
  for (const path of [...new Set([...desiredPaths, ...managedPaths])].sort()) {
    const hash = hashPath(path);
    observed[path] = hash;
    const managedHash = manifest?.ownedPaths[path];
    if (managedHash && managedHash !== hash) {
      findings.push(
        `managed_content_drift: ${path} expected ${managedHash}, observed ${hash}`,
      );
    } else if (!managedHash && hash !== ABSENT_HASH) {
      findings.push(
        `unmanaged_collision: ${path} is occupied without manifest ownership`,
      );
    } else if (managedHash && !desired.has(path)) {
      findings.push(
        `managed_desired_drift: ${path} is owned but no longer desired`,
      );
    }
  }
  for (const path of retiredLifecyclePaths(input.config, sourceRoot)) {
    if (hashPath(path) !== ABSENT_HASH && !manifest?.ownedPaths[path]) {
      findings.push(`unmanaged_lifecycle_conflict: ${path}`);
    }
  }
  const transactions = inspectTransactions(paths.transactionsRoot);
  if (transactions.length > 0) {
    for (const transaction of transactions) {
      findings.push(
        `${transaction.phase === "manifest_committed" ? "incomplete_transaction" : transaction.phase}: ${transaction.transactionId}`,
      );
    }
  }
  const lock = inspectMutationLock(paths.lockPath);
  if (lock) {
    warnings.push(`mutation_lock_active: pid=${String(lock.pid ?? "unknown")}`);
  }
  if (!existsSync(paths.cacheRoot)) {
    warnings.push(
      "cache_missing: disposable source cache will be recreated by sync",
    );
  }
  warnings.push(
    "remote_ref_freshness_unknown: run ax sync to resolve configured refs",
  );
  return {
    ok: findings.length === 0,
    sourceRoot,
    paths,
    installedProfiles: profiles,
    policyProfile: manifest?.policyProfile,
    desiredPaths,
    managedPaths,
    observed,
    cache: existsSync(paths.cacheRoot) ? "present" : "missing",
    remoteRefFreshness: "unknown_until_sync",
    lock,
    transactions,
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
  selection: ProfileSelection;
  stagingRoot: string;
  snapshots: SourceSnapshotManager;
  surface?: RuntimeSurface;
}): {
  entries: Map<string, CandidateEntry>;
  sources: RuntimeSyncResult["sources"];
} {
  const entries = new Map<string, CandidateEntry>();
  const sources: RuntimeSyncResult["sources"] = [];
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
      contentHash: sourceSnapshot.contentHash,
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
                  contentHash: remote.contentHash,
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
          if (
            RETIRED_LIFECYCLE_NAMES.includes(
              name as (typeof RETIRED_LIFECYCLE_NAMES)[number],
            )
          ) {
            throw new Error(`retired_lifecycle_configured: ${name}`);
          }
          skillNames.add(name);
          const skillSource = join(snapshot.path, name);
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
  return { entries, sources: deduplicateSources(sources) };
}

function planRuntimeOperations(input: {
  config: AxRuntimeConfig;
  sourceRoot: string;
  desired: Map<string, CandidateEntry>;
  existing?: ManagedRuntimeManifest;
  selection: ProfileSelection;
  surface?: RuntimeSurface;
  adoption?: ReturnType<typeof readAdoptionFile>;
  interactive: boolean;
  confirm?: (message: string) => boolean;
}): {
  operations: TransactionOperationInput[];
  manifest: ManagedRuntimeManifest;
} {
  const operations: TransactionOperationInput[] = [];
  const previousOwned = input.existing?.ownedPaths ?? {};
  const nextOwned: Record<string, ContentHash> = input.surface
    ? { ...previousOwned }
    : {};
  const usedAdoptions = new Set<string>();
  for (const [path, candidate] of input.desired) {
    const observed = hashPath(path);
    const previousHash = previousOwned[path];
    if (previousHash && observed !== previousHash) {
      throw new Error(
        `managed_content_drift: ${path} expected ${previousHash}, observed ${observed}`,
      );
    }
    if (!previousHash && observed !== ABSENT_HASH) {
      const action: AdoptionAction =
        observed === candidate.hash ? "manage" : "replace-managed";
      authorizeAdoption(input, path, observed, action, usedAdoptions);
    }
    nextOwned[path] = candidate.hash;
    if (observed !== candidate.hash || previousHash !== candidate.hash) {
      operations.push({
        path,
        asset: candidate.asset,
        candidatePath: candidate.candidatePath,
        expectedPreviousHash: observed,
        previousOwnership: previousHash ? { hash: previousHash } : null,
        candidateOwnership: { hash: candidate.hash },
      });
    }
  }
  const ownedCandidates = Object.keys(previousOwned).filter((path) =>
    input.surface
      ? pathBelongsToSurface(
          input.config,
          path,
          input.surface,
          input.sourceRoot,
        )
      : true,
  );
  for (const path of ownedCandidates) {
    if (input.desired.has(path)) {
      continue;
    }
    const observed = hashPath(path);
    if (observed !== previousOwned[path]) {
      throw new Error(
        `managed_content_drift: refusing to prune ${path}; expected ${previousOwned[path]}, observed ${observed}`,
      );
    }
    delete nextOwned[path];
    operations.push({
      path,
      asset: "managed-prune",
      delete: true,
      expectedPreviousHash: observed,
      previousOwnership: { hash: previousOwned[path] },
      candidateOwnership: null,
    });
  }
  if (!input.surface || input.surface === "skills") {
    for (const retiredPath of retiredLifecyclePaths(
      input.config,
      input.sourceRoot,
    )) {
      if (input.desired.has(retiredPath) || previousOwned[retiredPath]) {
        continue;
      }
      const observed = hashPath(retiredPath);
      if (observed === ABSENT_HASH) {
        continue;
      }
      authorizeAdoption(input, retiredPath, observed, "remove", usedAdoptions);
      operations.push({
        path: retiredPath,
        asset: "retired-lifecycle",
        delete: true,
        expectedPreviousHash: observed,
        previousOwnership: null,
        candidateOwnership: null,
      });
    }
  }
  for (const entry of input.adoption?.actions ?? []) {
    if (!usedAdoptions.has(entry.path)) {
      throw new Error(`unused_adoption_approval: ${entry.path}`);
    }
  }
  return {
    operations,
    manifest: validateManagedRuntimeManifest({
      schemaVersion: 1,
      hashVersion: HASH_VERSION,
      installedProfiles: input.selection.installedProfiles,
      policyProfile: input.selection.policyProfile,
      ownedPaths: nextOwned,
    }),
  };
}

function authorizeAdoption(
  input: {
    adoption?: ReturnType<typeof readAdoptionFile>;
    interactive: boolean;
    confirm?: (message: string) => boolean;
  },
  path: string,
  observed: ObservedHash,
  action: AdoptionAction,
  used: Set<string>,
): void {
  const approved = adoptionActionFor(input.adoption, path, observed, action);
  if (approved) {
    used.add(path);
    return;
  }
  if (
    input.interactive &&
    input.confirm?.(`${action} ${path} observed=${observed}`)
  ) {
    return;
  }
  throw new Error(
    `adoption_required: ${action} ${path} observed=${observed}; confirm interactively or provide --adoption-file`,
  );
}

function resolveRuntimeRecovery(input: {
  paths: RuntimePaths;
  recoveryFile: string;
  targetPolicy: RuntimeTargetPolicy;
}): void {
  resolveRecovery({
    lockPath: input.paths.lockPath,
    transactionsRoot: input.paths.transactionsRoot,
    backupsRoot: input.paths.backupsRoot,
    recoveryFile: input.recoveryFile,
    ...input.targetPolicy,
    authorizeJournalTarget: authorizeRuntimeJournalTarget,
    validateDerived: ({ journal, actions, profileSelectionState }) => {
      const metadata = runtimeMetadata(journal);
      const selectionChanged =
        stableJson(metadata.previousProfiles) !==
          stableJson(metadata.candidateProfiles) ||
        metadata.previousPolicyProfile !== metadata.candidatePolicyProfile;
      if (selectionChanged && !profileSelectionState) {
        throw new Error(
          "recovery_profile_selection_required: choose profileSelectionState previous|candidate",
        );
      }
      const selectedProfiles =
        profileSelectionState === "previous"
          ? metadata.previousProfiles
          : metadata.candidateProfiles;
      if (!selectedProfiles) {
        for (const operation of journal.operations) {
          const action = actions[operation.path] ?? "apply-candidate";
          if (action === "apply-candidate" && operation.candidateOwnership) {
            throw new Error(
              `recovery_ownership_invalid: first-sync previous state cannot own ${operation.path}`,
            );
          }
        }
        return;
      }
      for (const operation of journal.operations) {
        const action = actions[operation.path] ?? "apply-candidate";
        const ownership =
          action === "restore-previous"
            ? operation.previousOwnership
            : action === "apply-candidate"
              ? operation.candidateOwnership
              : null;
        const inventoryBySelectedProfile =
          action === "restore-previous"
            ? metadata.previousInventory
            : metadata.candidateInventory;
        const inventory = new Set(
          selectedProfiles.flatMap(
            (profile) => inventoryBySelectedProfile[profile] ?? [],
          ),
        );
        if (ownership && !inventory.has(operation.path)) {
          throw new Error(
            `recovery_ownership_out_of_inventory: ${operation.path}`,
          );
        }
      }
    },
    deriveManifest: ({ journal, actions, profileSelectionState }) => {
      const previous = readRetainedManifest(journal.manifest?.previousPayload);
      const candidate = readRetainedManifest(
        journal.manifest?.candidatePayload,
      );
      const selected =
        profileSelectionState === "previous" ? previous : candidate;
      if (!selected) {
        return undefined;
      }
      const ownedPaths = { ...selected.ownedPaths };
      for (const operation of journal.operations) {
        const action: RecoveryAction =
          actions[operation.path] ?? "apply-candidate";
        const ownership: OwnershipRecord =
          action === "restore-previous"
            ? operation.previousOwnership
            : action === "apply-candidate"
              ? operation.candidateOwnership
              : null;
        if (ownership) {
          ownedPaths[operation.path] = ownership.hash;
        } else {
          delete ownedPaths[operation.path];
        }
      }
      return validateManagedRuntimeManifest({ ...selected, ownedPaths });
    },
    validateResolved: ({ journal, profileSelectionState, derivedManifest }) => {
      const metadata = runtimeMetadata(journal);
      if (derivedManifest === undefined) {
        const restoresFirstSyncAbsence =
          profileSelectionState === "previous" &&
          metadata.previousProfiles === null &&
          metadata.previousPolicyProfile === null;
        if (!restoresFirstSyncAbsence) {
          throw new Error(
            "runtime_recovery_manifest_invalid: absent manifest is allowed only for first-sync previous state",
          );
        }
        if (readManagedRuntimeManifest(input.paths.manifestPath)) {
          throw new Error(
            "runtime_recovery_manifest_invalid: managed-runtime.json should be absent",
          );
        }
        return;
      }
      const expected = validateManagedRuntimeManifest(
        derivedManifest,
        "derived managed-runtime.json",
      );
      const applied = readManagedRuntimeManifest(input.paths.manifestPath);
      if (!applied || manifestHash(applied) !== manifestHash(expected)) {
        throw new Error(
          "runtime_recovery_manifest_invalid: installed manifest differs from derived recovery state",
        );
      }
      for (const [path, expectedHash] of Object.entries(applied.ownedPaths)) {
        const observed = hashPath(path);
        if (observed !== expectedHash) {
          throw new Error(
            `runtime_recovery_owned_hash_mismatch: ${path} expected ${expectedHash}, observed ${observed}`,
          );
        }
      }
    },
  });
}

function runtimeMetadata(
  journal: TransactionJournal,
): RuntimeTransactionMetadata {
  const metadata = journal.metadata as RuntimeTransactionMetadata | undefined;
  if (!metadata?.candidateProfiles || !metadata.candidateInventory) {
    throw new Error(
      `runtime_transaction_metadata_missing: ${journal.transactionId}`,
    );
  }
  return metadata;
}

function readRetainedManifest(
  path: string | null | undefined,
): ManagedRuntimeManifest | undefined {
  if (!path) {
    return undefined;
  }
  return validateManagedRuntimeManifest(
    JSON.parse(readFileSync(path, "utf-8")) as unknown,
    path,
  );
}

const authorizeRuntimeJournalTarget: JournalTargetAuthorizer = ({
  journal,
  targetPath,
  kind,
}) => {
  if (kind !== "operation" || journal.domain !== "runtime") {
    return false;
  }
  const operation = journal.operations.find(
    (candidate) => candidate.path === targetPath,
  );
  if (!operation) {
    return false;
  }
  const previous = readRetainedManifest(journal.manifest?.previousPayload);
  if (
    operation.previousOwnership &&
    previous?.ownedPaths[targetPath] === operation.previousOwnership.hash
  ) {
    return true;
  }
  const candidate = readRetainedManifest(journal.manifest?.candidatePayload);
  return Boolean(
    operation.candidateOwnership &&
      candidate?.ownedPaths[targetPath] === operation.candidateOwnership.hash,
  );
};

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
    hash: requireContentHash(hashPath(candidatePath)),
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
    hash: requireContentHash(hashPath(candidatePath)),
    asset: input.asset,
  });
}

function registerCandidate(
  entries: Map<string, CandidateEntry>,
  entry: CandidateEntry,
): void {
  const existing = entries.get(entry.path);
  if (existing && existing.hash !== entry.hash) {
    throw new Error(
      `candidate_collision: ${entry.path} differs between ${existing.asset} and ${entry.asset}`,
    );
  }
  entries.set(entry.path, entry);
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
  return paths;
}

function inventoryByProfile(
  config: AxRuntimeConfig,
  profiles: string[],
  sourceRoot: string,
): Record<string, string[]> {
  return Object.fromEntries(
    profiles.map((profile) => [
      profile,
      [...configuredDesiredPaths(config, [profile], sourceRoot)].sort(),
    ]),
  );
}

function manifestInventoryByProfile(
  manifest: ManagedRuntimeManifest | undefined,
): Record<string, string[]> {
  if (!manifest) {
    return {};
  }
  const ownedPaths = Object.keys(manifest.ownedPaths).sort();
  return Object.fromEntries(
    manifest.installedProfiles.map((profile) => [profile, [...ownedPaths]]),
  );
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
  if (surface === "skills") {
    return skillRoots.some((root) => isDirectChild(absolute, root));
  }
  if (surface === "hooks") {
    return hookRoots.some((root) => absolute === root);
  }
  if (
    skillRoots.some((root) => pathWithin(absolute, root)) ||
    hookRoots.some((root) => pathWithin(absolute, root))
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
    RETIRED_LIFECYCLE_NAMES.map((name) =>
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
}

function validateRuntimeSupportPaths(paths: RuntimePaths): void {
  assertRuntimeAssetRoot(paths.runtimeRoot, "runtime root");
  for (const [label, path] of Object.entries({
    manifest: paths.manifestPath,
    cache: paths.cacheRoot,
    transactions: paths.transactionsRoot,
    backups: paths.backupsRoot,
    lock: paths.lockPath,
  })) {
    assertRuntimeTargetContained(
      paths.runtimeRoot,
      path,
      `runtime_support_path_escape: ${label}`,
    );
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
  validateIndependentRuntimeRoots(skillRoots, "skills");
  validateIndependentRuntimeRoots(instructionRoots, "instructions");
  validateIndependentRuntimeRoots(hookRoots, "hooks");
  for (const skillRoot of skillRoots) {
    assertRuntimeAssetRoot(skillRoot, "runtime skill root");
    for (const hookRoot of hookRoots) {
      if (pathWithin(skillRoot, hookRoot) || pathWithin(hookRoot, skillRoot)) {
        throw new Error(
          `runtime_root_overlap: skill root ${skillRoot} conflicts with hook root ${hookRoot}`,
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
}

function runtimeRecoveryTargetPolicy(
  config: AxRuntimeConfig,
  sourceRoot: string,
  paths: RuntimePaths,
): RuntimeTargetPolicy {
  const exactTargetPaths = [
    ...configuredInstructionTargetPaths(config, sourceRoot),
    ...runtimeHookRoots(config, sourceRoot),
    ...retiredLifecyclePaths(config, sourceRoot),
    ...ownedPathsForRecoveryAuthorization(paths.manifestPath),
    paths.manifestPath,
  ]
    .map((path) => resolve(path))
    .filter((path, index, values) => values.indexOf(path) === index)
    .sort((left, right) => left.localeCompare(right));
  return {
    targetRoots: [],
    directChildTargetRoots: runtimeSkillRoots(config, sourceRoot),
    exactTargetPaths,
  };
}

function configuredInstructionTargetPaths(
  config: AxRuntimeConfig,
  sourceRoot: string,
): string[] {
  const roots = Object.values(
    config.runtime.instructionSymlinkTargets ?? {},
  ).map((root) => expandPath(root, sourceRoot));
  const targets = new Set<string>();
  for (const profile of Object.values(config.profiles ?? {})) {
    for (const instruction of profile.paths ?? []) {
      const targetPath = instructionTargetPath(instruction);
      assertSafeRelativePath(
        targetPath,
        "instruction_target_path_invalid: recovery authorization",
        false,
      );
      for (const root of roots) {
        targets.add(join(root, targetPath));
      }
    }
  }
  return [...targets];
}

function ownedPathsForRecoveryAuthorization(manifestPath: string): string[] {
  try {
    return Object.keys(
      readManagedRuntimeManifest(manifestPath)?.ownedPaths ?? {},
    );
  } catch {
    return [];
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
  const conflictingRoot = [
    ...runtimeSkillRoots(config, sourceRoot),
    ...runtimeHookRoots(config, sourceRoot),
  ].find((root) => {
    if (pathWithin(absoluteTarget, root)) {
      return true;
    }
    const physicalRoot = resolveThroughExistingAncestors(
      root,
      "runtime_root_invalid",
    );
    return pathWithin(physicalTarget, physicalRoot);
  });
  if (conflictingRoot) {
    throw new Error(
      `instruction_target_surface_conflict: ${relativeTarget} resolves inside ${conflictingRoot}`,
    );
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

function assertVerifiedLiveSource(
  sourceRoot: string,
  runtimeRoot: string,
): void {
  if (
    process.env.AX_ISOLATED_RUNTIME === "1" ||
    resolve(runtimeRoot) !== resolve(defaultRuntimeRoot())
  ) {
    return;
  }
  if (sourceRoot.includes(`${join(".codex", "worktrees")}`)) {
    throw new Error(
      "unverified_live_source: disposable worktree requires an isolated runtime root",
    );
  }
  const branch = git(sourceRoot, ["branch", "--show-current"]);
  const status = git(sourceRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);
  const head = git(sourceRoot, ["rev-parse", "HEAD"]);
  const upstream = git(sourceRoot, ["rev-parse", "@{upstream}"]);
  if (
    branch.status !== 0 ||
    !["main", "master"].includes(branch.stdout.trim()) ||
    status.status !== 0 ||
    status.stdout.trim() !== "" ||
    head.status !== 0 ||
    upstream.status !== 0 ||
    head.stdout.trim() !== upstream.stdout.trim()
  ) {
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

function requireContentHash(hash: ObservedHash): ContentHash {
  if (hash === ABSENT_HASH) {
    throw new Error("candidate_path_absent");
  }
  return hash;
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
