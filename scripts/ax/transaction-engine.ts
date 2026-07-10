import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { createVerifiedBackup } from "./backup-store.ts";
import { stableJson, writeJsonAtomic } from "./runtime-state.ts";
import {
  ABSENT_HASH,
  type ContentHash,
  copyPath,
  HASH_VERSION,
  hashPath,
  type ObservedHash,
} from "./source-snapshot.ts";

export const TRANSACTION_SCHEMA_VERSION = 1 as const;
export const RECOVERY_SCHEMA_VERSION = 1 as const;

export type TransactionPhase =
  | "prepared"
  | "applying"
  | "manifest_committed"
  | "recovery_conflict"
  | "recovery_failed";

export type OwnershipRecord = { hash: ContentHash } | null;

export type TransactionOperationInput = {
  path: string;
  asset: string;
  candidatePath?: string;
  delete?: boolean;
  expectedPreviousHash?: ObservedHash;
  previousOwnership?: OwnershipRecord;
  candidateOwnership?: OwnershipRecord;
};

export type TransactionOperation = {
  path: string;
  asset: string;
  previousHash: ObservedHash;
  candidateHash: ObservedHash;
  previousPayload: string | null;
  candidatePayload: string | null;
  stagedPath: string;
  displacedPath: string;
  previousOwnership: OwnershipRecord;
  candidateOwnership: OwnershipRecord;
};

export type TransactionManifestState = {
  path: string;
  previousHash: ObservedHash;
  candidateHash: ObservedHash;
  previousPayload: string | null;
  candidatePayload: string | null;
  stagedPath: string;
  displacedPath: string;
};

export type TransactionJournal = {
  schemaVersion: typeof TRANSACTION_SCHEMA_VERSION;
  hashVersion: typeof HASH_VERSION;
  transactionId: string;
  domain: string;
  root: string;
  targetRoots: string[];
  directChildTargetRoots: string[];
  exactTargetPaths: string[];
  phase: TransactionPhase;
  operations: TransactionOperation[];
  manifest?: TransactionManifestState;
  initialDirtyPaths: string[];
  metadata?: unknown;
  failure?: string;
};

export type TransactionFaultPoint =
  | "after-prepared"
  | "after-applying"
  | `after-stage:${string}`
  | `after-displace:${string}`
  | `after-target:${string}`
  | "after-manifest"
  | "after-manifest-committed";

export type ApplyTransactionInput = {
  domain: string;
  root: string;
  lockPath: string;
  transactionsRoot: string;
  backupsRoot: string;
  operations: TransactionOperationInput[];
  targetRoots?: string[];
  directChildTargetRoots?: string[];
  exactTargetPaths?: string[];
  manifestPath?: string;
  candidateManifestPath?: string;
  deleteManifest?: boolean;
  initialDirtyPaths?: string[];
  metadata?: unknown;
  validateApplied?: () => void;
  fault?: (point: TransactionFaultPoint, journal: TransactionJournal) => void;
  lockHeld?: boolean;
};

export type TransactionInspection = {
  transactionId: string;
  domain: string;
  root: string;
  phase: TransactionPhase;
  manifestHash: ObservedHash;
  targetHashes: Record<string, ObservedHash>;
  allowedActions: Record<
    string,
    Array<"restore-previous" | "apply-candidate" | "preserve-unmanaged">
  >;
  profileSelectionRequired: boolean;
};

export type RecoveryAction =
  | "restore-previous"
  | "apply-candidate"
  | "preserve-unmanaged";

export type RecoveryFile = {
  schemaVersion: typeof RECOVERY_SCHEMA_VERSION;
  hashVersion: typeof HASH_VERSION;
  transactionId: string;
  domain: string;
  currentManifestHash: ObservedHash;
  currentTargetHashes: Record<string, ObservedHash>;
  actions: Record<string, RecoveryAction>;
  profileSelectionState?: "previous" | "candidate";
};

export type ResolveRecoveryInput = {
  lockPath: string;
  transactionsRoot: string;
  backupsRoot: string;
  recoveryFile: string;
  targetRoots?: string[];
  directChildTargetRoots?: string[];
  exactTargetPaths?: string[];
  authorizeJournalTarget?: JournalTargetAuthorizer;
  deriveManifest?: (input: {
    journal: TransactionJournal;
    actions: Record<string, RecoveryAction>;
    profileSelectionState?: "previous" | "candidate";
  }) => unknown | undefined;
  validateDerived?: (input: {
    journal: TransactionJournal;
    actions: Record<string, RecoveryAction>;
    profileSelectionState?: "previous" | "candidate";
  }) => void;
  validateResolved?: (input: {
    journal: TransactionJournal;
    actions: Record<string, RecoveryAction>;
    profileSelectionState?: "previous" | "candidate";
    derivedManifest: unknown | undefined;
  }) => void;
};

export type JournalTargetAuthorizer = (input: {
  journal: TransactionJournal;
  targetPath: string;
  kind: "operation" | "manifest";
}) => boolean;

type TargetPolicy = {
  targetRoots: string[];
  directChildTargetRoots: string[];
  exactTargetPaths: string[];
};

export class TransactionInterruption extends Error {
  constructor(message = "simulated transaction interruption") {
    super(message);
    this.name = "TransactionInterruption";
  }
}

export function applyTransaction(
  input: ApplyTransactionInput,
): TransactionJournal {
  const lock = input.lockHeld
    ? undefined
    : acquireMutationLock(input.lockPath, input.domain, input.root);
  try {
    recoverTransactions({
      transactionsRoot: input.transactionsRoot,
      backupsRoot: input.backupsRoot,
      targetRoots: input.targetRoots,
      directChildTargetRoots: input.directChildTargetRoots,
      exactTargetPaths: input.exactTargetPaths,
    });
    const prepared = prepareTransaction(input);
    try {
      input.fault?.("after-prepared", prepared.journal);
      applyPreparedTransaction(prepared.transactionRoot, prepared.journal, {
        backupsRoot: input.backupsRoot,
        validateApplied: input.validateApplied,
        fault: input.fault,
      });
      return prepared.journal;
    } catch (error) {
      if (error instanceof TransactionInterruption) {
        throw error;
      }
      const rollback = rollbackTransaction(
        prepared.transactionRoot,
        prepared.journal,
      );
      if (rollback === "restored") {
        rmSync(prepared.transactionRoot, { force: true, recursive: true });
      }
      throw error;
    }
  } finally {
    if (lock) {
      releaseMutationLock(input.lockPath, lock);
    }
  }
}

export function withMutationLock<T>(
  input: { lockPath: string; domain: string; root: string },
  callback: () => T,
): T {
  const lock = acquireMutationLock(input.lockPath, input.domain, input.root);
  try {
    return callback();
  } finally {
    releaseMutationLock(input.lockPath, lock);
  }
}

export function recoverTransactions(input: {
  transactionsRoot: string;
  backupsRoot: string;
  targetRoots?: string[];
  directChildTargetRoots?: string[];
  exactTargetPaths?: string[];
  authorizeJournalTarget?: JournalTargetAuthorizer;
}): void {
  const root = resolve(input.transactionsRoot);
  if (!existsSync(root)) {
    return;
  }
  for (const entry of readdirSync(root).sort()) {
    const transactionRoot = join(root, entry);
    if (entry.startsWith(".prepare-")) {
      rmSync(transactionRoot, { force: true, recursive: true });
      continue;
    }
    const journal = readJournal(
      transactionRoot,
      expectedTargetPolicy(input),
      input.authorizeJournalTarget,
    );
    if (
      journal.phase === "recovery_conflict" ||
      journal.phase === "recovery_failed"
    ) {
      throw new Error(
        `${journal.phase}: transaction ${journal.transactionId} requires --recovery-file`,
      );
    }
    if (candidateMatches(journal)) {
      cleanupJournalIntermediates(journal);
      rmSync(transactionRoot, { force: true, recursive: true });
      continue;
    }
    const rollback = rollbackTransaction(transactionRoot, journal);
    if (rollback === "restored") {
      rmSync(transactionRoot, { force: true, recursive: true });
      continue;
    }
    throw new Error(
      `${journal.phase}: transaction ${journal.transactionId} requires --recovery-file`,
    );
  }
}

export function inspectTransactions(
  transactionsRoot: string,
): TransactionInspection[] {
  const root = resolve(transactionsRoot);
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root)
    .filter((entry) => !entry.startsWith(".prepare-"))
    .sort()
    .map((entry) => readJournal(join(root, entry)))
    .map((journal) => ({
      transactionId: journal.transactionId,
      domain: journal.domain,
      root: journal.root,
      phase: journal.phase,
      manifestHash: journal.manifest
        ? hashPath(journal.manifest.path)
        : ABSENT_HASH,
      targetHashes: Object.fromEntries(
        journal.operations.map((operation) => [
          operation.path,
          hashPath(operation.path),
        ]),
      ),
      allowedActions: Object.fromEntries(
        journal.operations.map((operation) => [
          operation.path,
          ["restore-previous", "apply-candidate", "preserve-unmanaged"],
        ]),
      ),
      profileSelectionRequired: profileSelectionChanged(journal.metadata),
    }));
}

export function inspectMutationLock(
  lockPath: string,
): Record<string, unknown> | undefined {
  if (!existsSync(lockPath)) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(lockPath, "utf-8")) as Record<
      string,
      unknown
    >;
  } catch {
    return { invalid: true, path: resolve(lockPath) };
  }
}

export function resolveRecovery(input: ResolveRecoveryInput): void {
  if (input.deriveManifest && !input.validateResolved) {
    throw new Error(
      "recovery_resolved_validator_required: derived manifests require final validation",
    );
  }
  const recovery = readRecoveryFile(input.recoveryFile);
  const transactionsRoot = resolve(input.transactionsRoot);
  const transactionRoot = join(transactionsRoot, recovery.transactionId);
  assertPathWithin(transactionRoot, transactionsRoot, "recovery transaction");
  const journal = readJournal(
    transactionRoot,
    expectedTargetPolicy(input),
    input.authorizeJournalTarget,
  );
  if (
    journal.transactionId !== recovery.transactionId ||
    journal.domain !== recovery.domain
  ) {
    throw new Error(
      "recovery_identity_mismatch: recovery file does not identify the journal domain",
    );
  }
  const lock = acquireMutationLock(
    input.lockPath,
    journal.domain,
    journal.root,
  );
  try {
    assertRecoveryHashes(journal, recovery);
    assertExactPathSet(
      Object.keys(recovery.currentTargetHashes),
      journal.operations.map((operation) => operation.path),
      "recovery target hashes",
    );
    assertExactPathSet(
      Object.keys(recovery.actions),
      journal.operations.map((operation) => operation.path),
      "recovery actions",
    );
    for (const operation of journal.operations) {
      if (!recovery.actions[operation.path]) {
        throw new Error(`recovery_action_missing: ${operation.path}`);
      }
    }
    input.validateDerived?.({
      journal,
      actions: recovery.actions,
      profileSelectionState: recovery.profileSelectionState,
    });
    const derivedManifest = input.deriveManifest?.({
      journal,
      actions: recovery.actions,
      profileSelectionState: recovery.profileSelectionState,
    });
    const derived = deriveResolutionTransaction(
      transactionRoot,
      journal,
      recovery,
      derivedManifest,
    );
    applyPreparedTransaction(transactionRoot, derived, {
      backupsRoot: input.backupsRoot,
      validateApplied: input.validateResolved
        ? () =>
            input.validateResolved?.({
              journal: derived,
              actions: recovery.actions,
              profileSelectionState: recovery.profileSelectionState,
              derivedManifest,
            })
        : undefined,
    });
  } finally {
    releaseMutationLock(input.lockPath, lock);
  }
}

function prepareTransaction(input: ApplyTransactionInput): {
  transactionRoot: string;
  journal: TransactionJournal;
} {
  const root = resolve(input.root);
  const declaredTargetPolicy = normalizeTargetPolicy({
    targetRoots: input.targetRoots ?? [root],
    directChildTargetRoots: input.directChildTargetRoots ?? [],
    exactTargetPaths: input.exactTargetPaths ?? [],
  });
  const normalizedOperations = input.operations.map((operation) => ({
    ...operation,
    path: resolve(operation.path),
  }));
  const normalizedManifestPath = input.manifestPath
    ? resolve(input.manifestPath)
    : undefined;
  const targets = [
    ...normalizedOperations.map((operation, index) => ({
      path: operation.path,
      label: `transaction operation ${String(index)}`,
    })),
    ...(normalizedManifestPath
      ? [{ path: normalizedManifestPath, label: "transaction manifest" }]
      : []),
  ];
  assertNonOverlappingTargets(targets);
  const usedTargetPolicy = selectUsedTargetPolicy(
    targets.map((target) => target.path),
    declaredTargetPolicy,
  );

  const transactionId = randomUUID();
  const transactionsRoot = resolve(input.transactionsRoot);
  const transactionRoot = join(transactionsRoot, transactionId);
  const preparationRoot = join(
    transactionsRoot,
    `.prepare-${transactionId}-${randomUUID()}`,
  );
  mkdirSync(transactionsRoot, { recursive: true });
  mkdirSync(preparationRoot);
  try {
    const operations = normalizedOperations.map((operation, index) =>
      retainOperation(
        preparationRoot,
        transactionRoot,
        transactionId,
        operation,
        index,
      ),
    );
    let manifest: TransactionManifestState | undefined;
    if (normalizedManifestPath) {
      manifest = retainManifestState(
        preparationRoot,
        transactionRoot,
        transactionId,
        {
          path: normalizedManifestPath,
          candidatePath: input.candidateManifestPath,
          delete: input.deleteManifest,
        },
      );
    }
    const journal: TransactionJournal = {
      schemaVersion: TRANSACTION_SCHEMA_VERSION,
      hashVersion: HASH_VERSION,
      transactionId,
      domain: input.domain,
      root,
      ...usedTargetPolicy,
      phase: "prepared",
      operations,
      manifest,
      initialDirtyPaths: [...(input.initialDirtyPaths ?? [])].sort(),
      metadata: input.metadata,
    };
    writeJournal(preparationRoot, journal);
    renameSync(preparationRoot, transactionRoot);
    return { transactionRoot, journal };
  } catch (error) {
    rmSync(preparationRoot, { force: true, recursive: true });
    throw error;
  }
}

function retainOperation(
  preparationRoot: string,
  transactionRoot: string,
  transactionId: string,
  input: TransactionOperationInput,
  index: number,
): TransactionOperation {
  const target = resolve(input.path);
  if (Boolean(input.candidatePath) === Boolean(input.delete)) {
    throw new Error(
      `transaction_candidate_invalid: ${target} needs payload or deletion`,
    );
  }
  const previousHash = hashPath(target);
  if (input.expectedPreviousHash !== undefined) {
    const expectedPreviousHash = requireObservedHash(
      input.expectedPreviousHash,
      `transaction operation ${String(index)} expected previous hash`,
    );
    if (previousHash !== expectedPreviousHash) {
      throw new Error(
        `transaction_previous_hash_mismatch: ${target} expected ${expectedPreviousHash}, observed ${previousHash}`,
      );
    }
  }
  const candidateHash = input.delete
    ? ABSENT_HASH
    : hashPath(resolve(input.candidatePath ?? ""));
  if (!input.delete && candidateHash === ABSENT_HASH) {
    throw new Error(`transaction_candidate_missing: ${input.candidatePath}`);
  }
  const previousOwnership = requireOwnershipMatchingHash(
    input.previousOwnership ?? null,
    previousHash,
    `transaction operation ${String(index)} previous ownership`,
  );
  const candidateOwnership = requireOwnershipMatchingHash(
    input.candidateOwnership ?? null,
    candidateHash,
    `transaction operation ${String(index)} candidate ownership`,
  );
  const retainedPrevious = retainPath(
    target,
    join(preparationRoot, "preimages", String(index)),
  );
  verifyRetainedPayload(target, retainedPrevious, previousHash, "preimage");
  const retainedCandidate = input.delete
    ? null
    : retainPath(
        resolve(input.candidatePath ?? ""),
        join(preparationRoot, "candidates", String(index)),
      );
  verifyRetainedPayload(target, retainedCandidate, candidateHash, "candidate");
  const previousPayload = relocateRetainedPath(
    retainedPrevious,
    preparationRoot,
    transactionRoot,
  );
  const candidatePayload = relocateRetainedPath(
    retainedCandidate,
    preparationRoot,
    transactionRoot,
  );
  const intermediates = intermediatePaths(target, transactionId, String(index));
  return {
    path: target,
    asset: input.asset,
    previousHash,
    candidateHash,
    previousPayload,
    candidatePayload,
    ...intermediates,
    previousOwnership,
    candidateOwnership,
  };
}

function retainManifestState(
  preparationRoot: string,
  transactionRoot: string,
  transactionId: string,
  input: { path: string; candidatePath?: string; delete?: boolean },
): TransactionManifestState {
  const path = resolve(input.path);
  if (Boolean(input.candidatePath) === Boolean(input.delete)) {
    throw new Error(
      `transaction_manifest_candidate_invalid: ${path} needs payload or deletion`,
    );
  }
  const previousHash = hashPath(path);
  const retainedPrevious = retainPath(
    path,
    join(preparationRoot, "manifest", "previous"),
  );
  verifyRetainedPayload(path, retainedPrevious, previousHash, "preimage");
  const candidateHash = input.delete
    ? ABSENT_HASH
    : hashPath(resolve(input.candidatePath ?? ""));
  if (!input.delete && candidateHash === ABSENT_HASH) {
    throw new Error("transaction_manifest_candidate_missing");
  }
  const retainedCandidate = input.delete
    ? null
    : retainPath(
        resolve(input.candidatePath ?? ""),
        join(preparationRoot, "manifest", "candidate"),
      );
  verifyRetainedPayload(path, retainedCandidate, candidateHash, "candidate");
  return {
    path,
    previousHash,
    candidateHash,
    previousPayload: relocateRetainedPath(
      retainedPrevious,
      preparationRoot,
      transactionRoot,
    ),
    candidatePayload: relocateRetainedPath(
      retainedCandidate,
      preparationRoot,
      transactionRoot,
    ),
    ...intermediatePaths(path, transactionId, "manifest"),
  };
}

function applyPreparedTransaction(
  transactionRoot: string,
  journal: TransactionJournal,
  input: {
    backupsRoot: string;
    validateApplied?: () => void;
    fault?: (point: TransactionFaultPoint, journal: TransactionJournal) => void;
  },
): void {
  const targetPolicy = journalTargetPolicy(journal);
  journal.phase = "applying";
  delete journal.failure;
  writeJournal(transactionRoot, journal);
  input.fault?.("after-applying", journal);
  for (const operation of journal.operations) {
    assertTargetAuthorized(
      operation.path,
      targetPolicy,
      `transaction target ${operation.path}`,
    );
    const current = hashPath(operation.path);
    if (!stateIsRecognized(operation)) {
      journal.phase = "recovery_conflict";
      journal.failure = `external edit at ${operation.path}: ${current}`;
      writeJournal(transactionRoot, journal);
      throw new Error(
        `recovery_conflict: ${operation.path} changed externally`,
      );
    }
    if (current !== operation.candidateHash) {
      createVerifiedBackup({
        backupsRoot: input.backupsRoot,
        asset: operation.asset,
        targetPath: operation.path,
      });
      replaceFromRetained(
        operation,
        operation.candidatePayload,
        operation.candidateHash,
        {
          afterStage: () =>
            input.fault?.(`after-stage:${operation.path}`, journal),
          afterDisplace: () =>
            input.fault?.(`after-displace:${operation.path}`, journal),
        },
      );
    } else {
      cleanupStateIntermediates(operation);
    }
    input.fault?.(`after-target:${operation.path}`, journal);
  }
  if (journal.manifest) {
    assertTargetAuthorized(
      journal.manifest.path,
      targetPolicy,
      `transaction manifest ${journal.manifest.path}`,
    );
    const current = hashPath(journal.manifest.path);
    if (!stateIsRecognized(journal.manifest)) {
      journal.phase = "recovery_conflict";
      journal.failure = `external manifest edit at ${journal.manifest.path}: ${current}`;
      writeJournal(transactionRoot, journal);
      throw new Error(`recovery_conflict: manifest changed externally`);
    }
    if (current !== journal.manifest.candidateHash) {
      replaceManifestFromRetained(
        journal.manifest,
        journal.manifest.candidatePayload,
        journal.manifest.candidateHash,
      );
    } else {
      cleanupStateIntermediates(journal.manifest);
    }
    input.fault?.("after-manifest", journal);
  }
  input.validateApplied?.();
  journal.phase = "manifest_committed";
  writeJournal(transactionRoot, journal);
  input.fault?.("after-manifest-committed", journal);
  rmSync(transactionRoot, { force: true, recursive: true });
}

function rollbackTransaction(
  transactionRoot: string,
  journal: TransactionJournal,
): "restored" | "conflict" | "failed" {
  try {
    const targetPolicy = journalTargetPolicy(journal);
    if (journal.manifest) {
      assertTargetAuthorized(
        journal.manifest.path,
        targetPolicy,
        `transaction manifest ${journal.manifest.path}`,
      );
      const current = hashPath(journal.manifest.path);
      if (!stateIsRecognized(journal.manifest)) {
        journal.phase = "recovery_conflict";
        journal.failure = `external manifest edit at ${journal.manifest.path}: ${current}`;
        writeJournal(transactionRoot, journal);
        return "conflict";
      }
    }
    for (const operation of journal.operations) {
      assertTargetAuthorized(
        operation.path,
        targetPolicy,
        `transaction target ${operation.path}`,
      );
      const current = hashPath(operation.path);
      if (!stateIsRecognized(operation)) {
        journal.phase = "recovery_conflict";
        journal.failure = `external edit at ${operation.path}: ${current}`;
        writeJournal(transactionRoot, journal);
        return "conflict";
      }
    }
    for (const operation of [...journal.operations].reverse()) {
      replaceFromRetained(
        operation,
        operation.previousPayload,
        operation.previousHash,
      );
    }
    if (journal.manifest) {
      replaceManifestFromRetained(
        journal.manifest,
        journal.manifest.previousPayload,
        journal.manifest.previousHash,
      );
    }
    return "restored";
  } catch (error) {
    journal.phase = "recovery_failed";
    journal.failure = error instanceof Error ? error.message : String(error);
    writeJournal(transactionRoot, journal);
    return "failed";
  }
}

function candidateMatches(journal: TransactionJournal): boolean {
  return (
    journal.operations.every(
      (operation) =>
        stateIsRecognized(operation) &&
        hashPath(operation.path) === operation.candidateHash,
    ) &&
    (!journal.manifest ||
      (stateIsRecognized(journal.manifest) &&
        hashPath(journal.manifest.path) === journal.manifest.candidateHash))
  );
}

function deriveResolutionTransaction(
  transactionRoot: string,
  journal: TransactionJournal,
  recovery: RecoveryFile,
  derivedManifest: unknown | undefined,
): TransactionJournal {
  writeFileSync(
    join(transactionRoot, "base-journal.json"),
    stableJson(journal),
    "utf-8",
  );
  const derivedOperations = journal.operations.map((operation, index) => {
    const action = recovery.actions[operation.path];
    if (!action) {
      throw new Error(`recovery_action_missing: ${operation.path}`);
    }
    const currentHash = hashPath(operation.path);
    const currentPayload = retainPath(
      operation.path,
      join(transactionRoot, "resolution", "preimages", String(index)),
    );
    verifyRetainedPayload(
      operation.path,
      currentPayload,
      currentHash,
      "preimage",
    );
    const previousOwnership = ownershipForObservedHash(operation, currentHash);
    let candidateHash: ObservedHash;
    let sourcePayload: string | null;
    let candidateOwnership: OwnershipRecord;
    if (action === "restore-previous") {
      candidateHash = operation.previousHash;
      sourcePayload = operation.previousPayload;
      candidateOwnership = operation.previousOwnership;
    } else if (action === "apply-candidate") {
      candidateHash = operation.candidateHash;
      sourcePayload = operation.candidatePayload;
      candidateOwnership = operation.candidateOwnership;
    } else {
      candidateHash = currentHash;
      sourcePayload = currentPayload;
      candidateOwnership = null;
    }
    const candidatePayload = sourcePayload
      ? retainPath(
          sourcePayload,
          join(transactionRoot, "resolution", "candidates", String(index)),
        )
      : null;
    verifyRetainedPayload(
      operation.path,
      candidatePayload,
      candidateHash,
      "candidate",
    );
    assertOwnershipMatchesHash(
      previousOwnership,
      currentHash,
      `derived previous ownership for ${operation.path}`,
    );
    assertOwnershipMatchesHash(
      candidateOwnership,
      candidateHash,
      `derived candidate ownership for ${operation.path}`,
    );
    return {
      ...operation,
      previousHash: currentHash,
      previousPayload: currentPayload,
      previousOwnership,
      candidateHash,
      candidatePayload,
      candidateOwnership,
    };
  });

  let manifest: TransactionManifestState | undefined;
  if (journal.manifest) {
    const currentHash = hashPath(journal.manifest.path);
    const previousPayload = retainPath(
      journal.manifest.path,
      join(transactionRoot, "resolution", "manifest", "previous"),
    );
    let candidatePayload: string | null = null;
    let candidateHash: ObservedHash = ABSENT_HASH;
    if (derivedManifest !== undefined) {
      const derivedPath = join(
        transactionRoot,
        "resolution",
        "derived-manifest.json",
      );
      mkdirSync(dirname(derivedPath), { recursive: true });
      writeFileSync(derivedPath, stableJson(derivedManifest), "utf-8");
      candidatePayload = derivedPath;
      candidateHash = hashPath(derivedPath);
    }
    manifest = {
      path: journal.manifest.path,
      previousHash: currentHash,
      candidateHash,
      previousPayload,
      candidatePayload,
      stagedPath: journal.manifest.stagedPath,
      displacedPath: journal.manifest.displacedPath,
    };
  }

  const derived: TransactionJournal = {
    ...journal,
    phase: "prepared",
    operations: derivedOperations,
    manifest,
    failure: undefined,
  };
  writeJournal(transactionRoot, derived);
  return derived;
}

function assertRecoveryHashes(
  journal: TransactionJournal,
  recovery: RecoveryFile,
): void {
  const manifestHash = journal.manifest
    ? hashPath(journal.manifest.path)
    : ABSENT_HASH;
  if (manifestHash !== recovery.currentManifestHash) {
    throw new Error(
      `recovery_state_stale: manifest expected ${recovery.currentManifestHash}, observed ${manifestHash}`,
    );
  }
  for (const operation of journal.operations) {
    const authorized = recovery.currentTargetHashes[operation.path];
    const current = hashPath(operation.path);
    if (!authorized) {
      throw new Error(`recovery_hash_missing: ${operation.path}`);
    }
    if (authorized !== current) {
      throw new Error(
        `recovery_state_stale: ${operation.path} expected ${authorized}, observed ${current}`,
      );
    }
  }
}

function readRecoveryFile(path: string): RecoveryFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(resolve(path), "utf-8")) as unknown;
  } catch (error) {
    throw new Error(
      `invalid_recovery_file: ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const value = requireRecord(parsed, path);
  requireExactKeys(
    value,
    [
      "schemaVersion",
      "hashVersion",
      "transactionId",
      "domain",
      "currentManifestHash",
      "currentTargetHashes",
      "actions",
    ],
    ["profileSelectionState"],
    path,
  );
  if (value.schemaVersion !== RECOVERY_SCHEMA_VERSION) {
    throw new Error(`unsupported_recovery_schema: ${path}`);
  }
  if (value.hashVersion !== HASH_VERSION) {
    throw new Error(`unsupported_hash_version: ${path}`);
  }
  const transactionId = requireTransactionId(value.transactionId, path);
  const domain = requireNonEmptyString(value.domain, `${path}.domain`);
  const currentManifestHash = requireObservedHash(
    value.currentManifestHash,
    `${path}.currentManifestHash`,
  );
  const rawTargetHashes = requireRecord(
    value.currentTargetHashes,
    `${path}.currentTargetHashes`,
  );
  const currentTargetHashes: Record<string, ObservedHash> = {};
  for (const [target, hash] of Object.entries(rawTargetHashes)) {
    const normalized = requireAbsolutePath(
      target,
      `${path}.currentTargetHashes`,
    );
    currentTargetHashes[normalized] = requireObservedHash(
      hash,
      `${path}.currentTargetHashes[${target}]`,
    );
  }
  const rawActions = requireRecord(value.actions, `${path}.actions`);
  const actions: Record<string, RecoveryAction> = {};
  for (const [target, action] of Object.entries(rawActions)) {
    const normalized = requireAbsolutePath(target, `${path}.actions`);
    if (
      action !== "restore-previous" &&
      action !== "apply-candidate" &&
      action !== "preserve-unmanaged"
    ) {
      throw new Error(
        `invalid_recovery_action: ${path}.actions[${target}] is ${String(action)}`,
      );
    }
    actions[normalized] = action;
  }
  let profileSelectionState: "previous" | "candidate" | undefined;
  if (value.profileSelectionState !== undefined) {
    if (
      value.profileSelectionState !== "previous" &&
      value.profileSelectionState !== "candidate"
    ) {
      throw new Error(
        `invalid_recovery_profile_selection: ${String(value.profileSelectionState)}`,
      );
    }
    profileSelectionState = value.profileSelectionState;
  }
  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    hashVersion: HASH_VERSION,
    transactionId,
    domain,
    currentManifestHash,
    currentTargetHashes,
    actions,
    ...(profileSelectionState ? { profileSelectionState } : {}),
  };
}

function retainPath(source: string, destination: string): string | null {
  if (!existsOrSymlink(source)) {
    return null;
  }
  rmSync(destination, { force: true, recursive: true });
  copyPath(source, destination);
  return destination;
}

type RetainedState = Pick<
  TransactionOperation,
  "path" | "previousHash" | "candidateHash" | "stagedPath" | "displacedPath"
>;

function replaceFromRetained(
  state: RetainedState,
  retained: string | null,
  expectedHash: ObservedHash,
  callbacks: { afterStage?: () => void; afterDisplace?: () => void } = {},
): void {
  const destination = resolve(state.path);
  assertRecognizedState(state);
  if (hashPath(destination) === expectedHash) {
    cleanupStateIntermediates(state);
    return;
  }

  clearRecognizedIntermediate(state.stagedPath, state);
  if (expectedHash === ABSENT_HASH) {
    displaceCurrentTarget(state, callbacks.afterDisplace);
    if (hashPath(destination) !== ABSENT_HASH) {
      throw new Error(`transaction_delete_failed: ${destination}`);
    }
    cleanupStateIntermediates(state);
    return;
  }
  if (!retained || hashPath(retained) !== expectedHash) {
    throw new Error(`transaction_payload_invalid: ${destination}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  const copyingPath = stagedCopyingPath(state);
  rmSync(copyingPath, { force: true, recursive: true });
  copyPath(retained, copyingPath);
  if (hashPath(copyingPath) !== expectedHash) {
    throw new Error(`transaction_copy_verification_failed: ${destination}`);
  }
  renameSync(copyingPath, state.stagedPath);
  if (hashPath(state.stagedPath) !== expectedHash) {
    throw new Error(`transaction_copy_verification_failed: ${destination}`);
  }
  callbacks.afterStage?.();
  displaceCurrentTarget(state, callbacks.afterDisplace);
  renameSync(state.stagedPath, destination);
  if (hashPath(destination) !== expectedHash) {
    throw new Error(`transaction_apply_verification_failed: ${destination}`);
  }
  cleanupStateIntermediates(state);
}

function replaceManifestFromRetained(
  state: RetainedState,
  retained: string | null,
  expectedHash: ObservedHash,
): void {
  const destination = resolve(state.path);
  assertRecognizedState(state);
  if (hashPath(destination) === expectedHash) {
    cleanupStateIntermediates(state);
    return;
  }
  clearRecognizedIntermediate(state.stagedPath, state);
  clearRecognizedIntermediate(state.displacedPath, state);
  if (expectedHash === ABSENT_HASH) {
    rmSync(destination, { force: true });
    if (hashPath(destination) !== ABSENT_HASH) {
      throw new Error(`transaction_manifest_delete_failed: ${destination}`);
    }
    return;
  }
  if (!retained || hashPath(retained) !== expectedHash) {
    throw new Error(`transaction_manifest_payload_invalid: ${destination}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  const copyingPath = stagedCopyingPath(state);
  rmSync(copyingPath, { force: true, recursive: true });
  copyPath(retained, copyingPath);
  if (hashPath(copyingPath) !== expectedHash) {
    throw new Error(
      `transaction_manifest_copy_verification_failed: ${destination}`,
    );
  }
  renameSync(copyingPath, state.stagedPath);
  if (hashPath(state.stagedPath) !== expectedHash) {
    throw new Error(
      `transaction_manifest_copy_verification_failed: ${destination}`,
    );
  }
  // managed-runtime.json is a regular file; rename over its existing path is
  // the atomic commit point and intentionally has no target-absent window.
  renameSync(state.stagedPath, destination);
  if (hashPath(destination) !== expectedHash) {
    throw new Error(`transaction_manifest_apply_failed: ${destination}`);
  }
}

function displaceCurrentTarget(
  state: RetainedState,
  afterDisplace?: () => void,
): void {
  if (hashPath(state.path) === ABSENT_HASH) {
    return;
  }
  clearRecognizedIntermediate(state.displacedPath, state);
  mkdirSync(dirname(state.displacedPath), { recursive: true });
  renameSync(state.path, state.displacedPath);
  afterDisplace?.();
}

function stateIsRecognized(state: RetainedState): boolean {
  const allowed = new Set<ObservedHash>([
    ABSENT_HASH,
    state.previousHash,
    state.candidateHash,
  ]);
  const current = hashPath(state.path);
  const staged = hashPath(state.stagedPath);
  const displaced = hashPath(state.displacedPath);
  if (!allowed.has(staged) || !allowed.has(displaced)) {
    return false;
  }
  if (current === state.previousHash || current === state.candidateHash) {
    return true;
  }
  return (
    current === ABSENT_HASH &&
    (staged !== ABSENT_HASH || displaced !== ABSENT_HASH)
  );
}

function assertRecognizedState(state: RetainedState): void {
  if (!stateIsRecognized(state)) {
    throw new Error(
      `recovery_conflict: unrecognized transaction state for ${state.path}`,
    );
  }
}

function clearRecognizedIntermediate(path: string, state: RetainedState): void {
  const observed = hashPath(path);
  if (observed === ABSENT_HASH) {
    return;
  }
  if (observed !== state.previousHash && observed !== state.candidateHash) {
    throw new Error(
      `recovery_conflict: unrecognized transaction intermediate ${path}`,
    );
  }
  rmSync(path, { force: true, recursive: true });
}

function cleanupStateIntermediates(state: RetainedState): void {
  rmSync(stagedCopyingPath(state), { force: true, recursive: true });
  clearRecognizedIntermediate(state.stagedPath, state);
  clearRecognizedIntermediate(state.displacedPath, state);
}

function stagedCopyingPath(state: RetainedState): string {
  return `${state.stagedPath}.copying`;
}

function cleanupJournalIntermediates(journal: TransactionJournal): void {
  for (const operation of journal.operations) {
    cleanupStateIntermediates(operation);
  }
  if (journal.manifest) {
    cleanupStateIntermediates(journal.manifest);
  }
}

function intermediatePaths(
  target: string,
  transactionId: string,
  suffix: string,
): Pick<TransactionOperation, "stagedPath" | "displacedPath"> {
  const name = basename(target);
  if (!name) {
    throw new Error(`transaction_target_invalid: ${target}`);
  }
  const stem = `.${name}.ax-${transactionId}-${suffix}`;
  return {
    stagedPath: join(dirname(target), `${stem}-staged`),
    displacedPath: join(dirname(target), `${stem}-displaced`),
  };
}

function verifyRetainedPayload(
  target: string,
  retained: string | null,
  expectedHash: ObservedHash,
  kind: "preimage" | "candidate",
): void {
  if (expectedHash === ABSENT_HASH) {
    if (retained !== null) {
      throw new Error(`transaction_${kind}_unexpected: ${target}`);
    }
    return;
  }
  if (!retained || hashPath(retained) !== expectedHash) {
    throw new Error(`transaction_${kind}_hash_mismatch: ${target}`);
  }
}

function relocateRetainedPath(
  path: string | null,
  preparationRoot: string,
  transactionRoot: string,
): string | null {
  if (!path) {
    return null;
  }
  assertPathWithin(path, preparationRoot, "prepared payload");
  return join(transactionRoot, relative(preparationRoot, path));
}

function acquireMutationLock(
  lockPath: string,
  domain: string,
  root: string,
): { pid: number; processStartIdentity: string } {
  const path = resolve(lockPath);
  const reclaimPath = `${path}.reclaim`;
  mkdirSync(dirname(path), { recursive: true });
  const identity = {
    pid: process.pid,
    processStartIdentity: processStartIdentity(process.pid),
  };
  const document = { ...identity, domain, root: resolve(root) };
  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (existsSync(reclaimPath)) {
      const reclaimer = readLock(reclaimPath);
      if (lockOwnerIsLive(reclaimer)) {
        throw new Error(
          `mutation_lock_reclaim_active: pid=${String(reclaimer.pid)} start=${String(reclaimer.processStartIdentity)}`,
        );
      }
      rmSync(reclaimPath, { force: true });
      continue;
    }

    if (tryCreateLockFile(path, document)) {
      if (existsSync(reclaimPath)) {
        releaseMutationLock(path, identity);
        continue;
      }
      return identity;
    }

    const owner = readLock(path);
    if (lockOwnerIsLive(owner)) {
      throw new Error(
        `mutation_lock_active: pid=${String(owner.pid)} start=${String(owner.processStartIdentity)}`,
      );
    }
    if (!tryCreateLockFile(reclaimPath, document)) {
      continue;
    }
    try {
      const currentOwner = existsSync(path) ? readLock(path) : {};
      if (lockOwnerIsLive(currentOwner)) {
        throw new Error(
          `mutation_lock_active: pid=${String(currentOwner.pid)} start=${String(currentOwner.processStartIdentity)}`,
        );
      }
      rmSync(path, { force: true });
      if (!tryCreateLockFile(path, document)) {
        continue;
      }
      return identity;
    } finally {
      releaseMutationLock(reclaimPath, identity);
    }
  }
  throw new Error(`mutation_lock_contention: could not acquire ${path}`);
}

function tryCreateLockFile(
  path: string,
  document: Record<string, unknown>,
): boolean {
  const claimPath = `${path}.claim-${process.pid}-${randomUUID()}`;
  try {
    writeFileSync(claimPath, stableJson(document), {
      encoding: "utf-8",
      flag: "wx",
      mode: 0o600,
    });
    try {
      linkSync(claimPath, path);
      return true;
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
      ) {
        return false;
      }
      throw error;
    }
  } finally {
    rmSync(claimPath, { force: true });
  }
}

function releaseMutationLock(
  lockPath: string,
  identity: { pid: number; processStartIdentity: string },
): void {
  const path = resolve(lockPath);
  if (!existsSync(path)) {
    return;
  }
  const owner = readLock(path);
  if (
    owner.pid === identity.pid &&
    owner.processStartIdentity === identity.processStartIdentity
  ) {
    rmSync(path, { force: true });
  }
}

function readLock(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function lockOwnerIsLive(owner: Record<string, unknown>): boolean {
  if (
    typeof owner.pid !== "number" ||
    typeof owner.processStartIdentity !== "string"
  ) {
    return false;
  }
  try {
    process.kill(owner.pid, 0);
  } catch {
    return false;
  }
  return processStartIdentity(owner.pid) === owner.processStartIdentity;
}

function processStartIdentity(pid: number): string {
  const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const value =
    result.status === 0 ? result.stdout.trim().replace(/\s+/g, " ") : "";
  return value || `pid:${pid}`;
}

function readJournal(
  transactionRoot: string,
  expectedPolicy?: TargetPolicy,
  authorizeJournalTarget?: JournalTargetAuthorizer,
): TransactionJournal {
  const path = join(transactionRoot, "journal.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  } catch (error) {
    throw new Error(
      `invalid_transaction_journal: ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const value = requireRecord(parsed, path);
  requireExactKeys(
    value,
    [
      "schemaVersion",
      "hashVersion",
      "transactionId",
      "domain",
      "root",
      "targetRoots",
      "directChildTargetRoots",
      "exactTargetPaths",
      "phase",
      "operations",
      "initialDirtyPaths",
    ],
    ["manifest", "metadata", "failure"],
    path,
  );
  if (
    value.schemaVersion !== TRANSACTION_SCHEMA_VERSION ||
    value.hashVersion !== HASH_VERSION
  ) {
    throw new Error(`invalid_transaction_journal: ${path}`);
  }
  const transactionId = requireTransactionId(value.transactionId, path);
  if (transactionId !== basename(resolve(transactionRoot))) {
    throw new Error(
      `invalid_transaction_journal: ${path} transactionId does not match directory`,
    );
  }
  const domain = requireNonEmptyString(value.domain, `${path}.domain`);
  const root = requireAbsolutePath(value.root, `${path}.root`);
  const targetPolicy = requireTargetPolicy(value, path);
  const phase = requireTransactionPhase(value.phase, `${path}.phase`);
  if (!Array.isArray(value.operations)) {
    throw new Error(`invalid_transaction_journal: ${path}.operations`);
  }
  const seenTargets = new Set<string>();
  const operations = value.operations.map((raw, index) => {
    const operation = requireRecord(raw, `${path}.operations[${index}]`);
    requireExactKeys(
      operation,
      [
        "path",
        "asset",
        "previousHash",
        "candidateHash",
        "previousPayload",
        "candidatePayload",
        "stagedPath",
        "displacedPath",
        "previousOwnership",
        "candidateOwnership",
      ],
      [],
      `${path}.operations[${index}]`,
    );
    const target = requireAbsolutePath(
      operation.path,
      `${path}.operations[${index}].path`,
    );
    if (seenTargets.has(target)) {
      throw new Error(
        `invalid_transaction_journal: duplicate target ${target}`,
      );
    }
    seenTargets.add(target);
    assertTargetAuthorized(
      target,
      targetPolicy,
      `${path}.operations[${index}].path`,
    );
    const expectedIntermediates = intermediatePaths(
      target,
      transactionId,
      String(index),
    );
    const stagedPath = requireAbsolutePath(
      operation.stagedPath,
      `${path}.operations[${index}].stagedPath`,
    );
    const displacedPath = requireAbsolutePath(
      operation.displacedPath,
      `${path}.operations[${index}].displacedPath`,
    );
    if (
      stagedPath !== expectedIntermediates.stagedPath ||
      displacedPath !== expectedIntermediates.displacedPath
    ) {
      throw new Error(
        `invalid_transaction_journal: unexpected intermediate path for ${target}`,
      );
    }
    const previousHash = requireObservedHash(
      operation.previousHash,
      `${path}.operations[${index}].previousHash`,
    );
    const candidateHash = requireObservedHash(
      operation.candidateHash,
      `${path}.operations[${index}].candidateHash`,
    );
    const previousPayload = requireRetainedPayloadPath(
      operation.previousPayload,
      transactionRoot,
      previousHash,
      `${path}.operations[${index}].previousPayload`,
    );
    const candidatePayload = requireRetainedPayloadPath(
      operation.candidatePayload,
      transactionRoot,
      candidateHash,
      `${path}.operations[${index}].candidatePayload`,
    );
    return {
      path: target,
      asset: requireNonEmptyString(
        operation.asset,
        `${path}.operations[${index}].asset`,
      ),
      previousHash,
      candidateHash,
      previousPayload,
      candidatePayload,
      stagedPath,
      displacedPath,
      previousOwnership: requireOwnershipMatchingHash(
        operation.previousOwnership,
        previousHash,
        `${path}.operations[${index}].previousOwnership`,
      ),
      candidateOwnership: requireOwnershipMatchingHash(
        operation.candidateOwnership,
        candidateHash,
        `${path}.operations[${index}].candidateOwnership`,
      ),
    } satisfies TransactionOperation;
  });
  let manifest: TransactionManifestState | undefined;
  if (value.manifest !== undefined) {
    const rawManifest = requireRecord(value.manifest, `${path}.manifest`);
    requireExactKeys(
      rawManifest,
      [
        "path",
        "previousHash",
        "candidateHash",
        "previousPayload",
        "candidatePayload",
        "stagedPath",
        "displacedPath",
      ],
      [],
      `${path}.manifest`,
    );
    const manifestPath = requireAbsolutePath(
      rawManifest.path,
      `${path}.manifest.path`,
    );
    assertTargetAuthorized(manifestPath, targetPolicy, `${path}.manifest.path`);
    const expectedIntermediates = intermediatePaths(
      manifestPath,
      transactionId,
      "manifest",
    );
    const stagedPath = requireAbsolutePath(
      rawManifest.stagedPath,
      `${path}.manifest.stagedPath`,
    );
    const displacedPath = requireAbsolutePath(
      rawManifest.displacedPath,
      `${path}.manifest.displacedPath`,
    );
    if (
      stagedPath !== expectedIntermediates.stagedPath ||
      displacedPath !== expectedIntermediates.displacedPath
    ) {
      throw new Error(
        `invalid_transaction_journal: unexpected manifest intermediate path`,
      );
    }
    const previousHash = requireObservedHash(
      rawManifest.previousHash,
      `${path}.manifest.previousHash`,
    );
    const candidateHash = requireObservedHash(
      rawManifest.candidateHash,
      `${path}.manifest.candidateHash`,
    );
    manifest = {
      path: manifestPath,
      previousHash,
      candidateHash,
      previousPayload: requireRetainedPayloadPath(
        rawManifest.previousPayload,
        transactionRoot,
        previousHash,
        `${path}.manifest.previousPayload`,
      ),
      candidatePayload: requireRetainedPayloadPath(
        rawManifest.candidatePayload,
        transactionRoot,
        candidateHash,
        `${path}.manifest.candidatePayload`,
      ),
      stagedPath,
      displacedPath,
    };
  }
  if (!Array.isArray(value.initialDirtyPaths)) {
    throw new Error(`invalid_transaction_journal: ${path}.initialDirtyPaths`);
  }
  const initialDirtyPaths = value.initialDirtyPaths.map((entry, index) =>
    requireSafeRelativePath(
      entry,
      `${path}.initialDirtyPaths[${String(index)}]`,
    ),
  );
  const failure =
    value.failure === undefined
      ? undefined
      : requireNonEmptyString(value.failure, `${path}.failure`);
  assertNonOverlappingTargets([
    ...operations.map((operation, index) => ({
      path: operation.path,
      label: `${path}.operations[${String(index)}].path`,
    })),
    ...(manifest
      ? [{ path: manifest.path, label: `${path}.manifest.path` }]
      : []),
  ]);
  assertMinimalTargetPolicy(
    [
      ...operations.map((operation) => operation.path),
      ...(manifest ? [manifest.path] : []),
    ],
    targetPolicy,
    path,
  );
  const journal: TransactionJournal = {
    schemaVersion: TRANSACTION_SCHEMA_VERSION,
    hashVersion: HASH_VERSION,
    transactionId,
    domain,
    root,
    ...targetPolicy,
    phase,
    operations,
    ...(manifest ? { manifest } : {}),
    initialDirtyPaths,
    ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
    ...(failure ? { failure } : {}),
  };
  assertExpectedTargetCoverage(
    journal,
    expectedPolicy,
    authorizeJournalTarget,
    path,
  );
  return journal;
}

function writeJournal(
  transactionRoot: string,
  journal: TransactionJournal,
): void {
  writeJsonAtomic(join(transactionRoot, "journal.json"), journal);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`invalid_transaction_data: ${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  required: string[],
  optional: string[],
  label: string,
): void {
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !(key in value));
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `invalid_transaction_data: ${label} keys missing=[${missing.join(", ")}] unexpected=[${unexpected.join(", ")}]`,
    );
  }
}

function requireTransactionId(value: unknown, label: string): string {
  const transactionId = requireNonEmptyString(value, `${label}.transactionId`);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      transactionId,
    )
  ) {
    throw new Error(`invalid_transaction_id: ${transactionId}`);
  }
  return transactionId;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    value.includes("\0")
  ) {
    throw new Error(`invalid_transaction_data: ${label} must be non-empty`);
  }
  return value;
}

function requireAbsolutePath(value: unknown, label: string): string {
  const path = requireNonEmptyString(value, label);
  if (!isAbsolute(path) || resolve(path) !== path || path === resolve("/")) {
    throw new Error(
      `invalid_transaction_path: ${label} must be normalized and absolute`,
    );
  }
  return path;
}

function requireSafeRelativePath(value: unknown, label: string): string {
  const path = requireNonEmptyString(value, label).replaceAll("\\", "/");
  if (
    isAbsolute(path) ||
    path === ".." ||
    path.startsWith("../") ||
    path.split("/").includes("..")
  ) {
    throw new Error(`invalid_transaction_path: ${label} escapes its root`);
  }
  return path;
}

function requireObservedHash(value: unknown, label: string): ObservedHash {
  if (value === ABSENT_HASH) {
    return ABSENT_HASH;
  }
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`invalid_transaction_hash: ${label}`);
  }
  return value as ContentHash;
}

function requireOwnershipRecord(
  value: unknown,
  label: string,
): OwnershipRecord {
  if (value === null) {
    return null;
  }
  const ownership = requireRecord(value, label);
  requireExactKeys(ownership, ["hash"], [], label);
  const hash = requireObservedHash(ownership.hash, `${label}.hash`);
  if (hash === ABSENT_HASH) {
    throw new Error(`invalid_transaction_hash: ${label}.hash cannot be absent`);
  }
  return { hash };
}

function requireOwnershipMatchingHash(
  value: unknown,
  contentHash: ObservedHash,
  label: string,
): OwnershipRecord {
  const ownership = requireOwnershipRecord(value, label);
  assertOwnershipMatchesHash(ownership, contentHash, label);
  return ownership;
}

function assertOwnershipMatchesHash(
  ownership: OwnershipRecord,
  contentHash: ObservedHash,
  label: string,
): void {
  if (ownership && ownership.hash !== contentHash) {
    throw new Error(
      `transaction_ownership_hash_mismatch: ${label} owns ${ownership.hash}, content is ${contentHash}`,
    );
  }
}

function ownershipForObservedHash(
  operation: TransactionOperation,
  observedHash: ObservedHash,
): OwnershipRecord {
  const previousMatches = operation.previousHash === observedHash;
  const candidateMatches = operation.candidateHash === observedHash;
  if (previousMatches && candidateMatches) {
    return stableJson(operation.previousOwnership) ===
      stableJson(operation.candidateOwnership)
      ? operation.previousOwnership
      : null;
  }
  if (previousMatches) {
    return operation.previousOwnership;
  }
  if (candidateMatches) {
    return operation.candidateOwnership;
  }
  return null;
}

function requireRetainedPayloadPath(
  value: unknown,
  transactionRoot: string,
  expectedHash: ObservedHash,
  label: string,
): string | null {
  if (expectedHash === ABSENT_HASH) {
    if (value !== null) {
      throw new Error(`invalid_transaction_payload: ${label} must be null`);
    }
    return null;
  }
  const payload = requireAbsolutePath(value, label);
  assertPathWithin(payload, transactionRoot, label);
  let realRoot: string;
  let realParent: string;
  try {
    realRoot = realpathSync(transactionRoot);
    realParent = realpathSync(dirname(payload));
  } catch (error) {
    throw new Error(
      `invalid_transaction_payload: ${label} parent cannot be resolved: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  assertPathWithin(realParent, realRoot, `${label} real parent`);
  if (hashPath(payload) !== expectedHash) {
    throw new Error(`invalid_transaction_payload: ${label} hash mismatch`);
  }
  return payload;
}

function requireTransactionPhase(
  value: unknown,
  label: string,
): TransactionPhase {
  if (
    value !== "prepared" &&
    value !== "applying" &&
    value !== "manifest_committed" &&
    value !== "recovery_conflict" &&
    value !== "recovery_failed"
  ) {
    throw new Error(`invalid_transaction_phase: ${label}`);
  }
  return value;
}

function assertPathWithin(path: string, root: string, label: string): void {
  const normalizedRoot = resolve(root);
  const normalizedPath = resolve(path);
  const rel = relative(normalizedRoot, normalizedPath);
  if (
    rel === ".." ||
    rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(
      `invalid_transaction_path: ${label} escapes ${normalizedRoot}`,
    );
  }
}

function normalizePathSet(values: unknown[], label: string): string[] {
  const paths = values.map((value, index) =>
    requireAbsolutePath(value, `${label}[${String(index)}]`),
  );
  return [...new Set(paths)].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function normalizeTargetPolicy(input: {
  targetRoots: unknown[];
  directChildTargetRoots: unknown[];
  exactTargetPaths: unknown[];
}): TargetPolicy {
  return {
    targetRoots: normalizePathSet(input.targetRoots, "targetRoots"),
    directChildTargetRoots: normalizePathSet(
      input.directChildTargetRoots,
      "directChildTargetRoots",
    ),
    exactTargetPaths: normalizePathSet(
      input.exactTargetPaths,
      "exactTargetPaths",
    ),
  };
}

function requireTargetPolicy(
  value: Record<string, unknown>,
  label: string,
): TargetPolicy {
  for (const key of [
    "targetRoots",
    "directChildTargetRoots",
    "exactTargetPaths",
  ] as const) {
    if (!Array.isArray(value[key])) {
      throw new Error(`invalid_transaction_journal: ${label}.${key}`);
    }
  }
  return normalizeTargetPolicy({
    targetRoots: value.targetRoots as unknown[],
    directChildTargetRoots: value.directChildTargetRoots as unknown[],
    exactTargetPaths: value.exactTargetPaths as unknown[],
  });
}

function expectedTargetPolicy(input: {
  targetRoots?: string[];
  directChildTargetRoots?: string[];
  exactTargetPaths?: string[];
}): TargetPolicy | undefined {
  if (
    input.targetRoots === undefined &&
    input.directChildTargetRoots === undefined &&
    input.exactTargetPaths === undefined
  ) {
    return undefined;
  }
  return normalizeTargetPolicy({
    targetRoots: input.targetRoots ?? [],
    directChildTargetRoots: input.directChildTargetRoots ?? [],
    exactTargetPaths: input.exactTargetPaths ?? [],
  });
}

function journalTargetPolicy(journal: TransactionJournal): TargetPolicy {
  return {
    targetRoots: journal.targetRoots,
    directChildTargetRoots: journal.directChildTargetRoots,
    exactTargetPaths: journal.exactTargetPaths,
  };
}

function assertExpectedTargetCoverage(
  journal: TransactionJournal,
  expectedPolicy: TargetPolicy | undefined,
  authorizeJournalTarget: JournalTargetAuthorizer | undefined,
  label: string,
): void {
  if (!expectedPolicy) {
    return;
  }
  const targets = [
    ...journal.operations.map((operation) => ({
      path: operation.path,
      kind: "operation" as const,
    })),
    ...(journal.manifest
      ? [{ path: journal.manifest.path, kind: "manifest" as const }]
      : []),
  ];
  for (const target of targets) {
    if (hasLexicalTargetAuthorization(target.path, expectedPolicy)) {
      assertTargetAuthorized(
        target.path,
        expectedPolicy,
        `${label} ${target.kind} ${target.path} against current target policy`,
      );
      continue;
    }
    if (
      authorizeJournalTarget?.({
        journal,
        targetPath: target.path,
        kind: target.kind,
      }) === true
    ) {
      continue;
    }
    throw new Error(
      `invalid_transaction_path: ${label} ${target.kind} ${target.path} is outside current target policy`,
    );
  }
}

function hasLexicalTargetAuthorization(
  path: string,
  policy: TargetPolicy,
): boolean {
  return (
    policy.exactTargetPaths.includes(path) ||
    policy.directChildTargetRoots.some((root) => dirname(path) === root) ||
    policy.targetRoots.some((root) => isLexicallyWithin(path, root))
  );
}

function selectUsedTargetPolicy(
  targets: string[],
  policy: TargetPolicy,
): TargetPolicy {
  const selected: TargetPolicy = {
    targetRoots: [],
    directChildTargetRoots: [],
    exactTargetPaths: [],
  };
  for (const target of targets) {
    const authorization = selectTargetAuthorization(
      target,
      policy,
      `transaction target ${target}`,
    );
    selected[authorization.kind].push(authorization.path);
  }
  return normalizeTargetPolicy(selected);
}

function selectTargetAuthorization(
  path: string,
  policy: TargetPolicy,
  label: string,
): { kind: keyof TargetPolicy; path: string } {
  if (policy.exactTargetPaths.includes(path)) {
    return { kind: "exactTargetPaths", path };
  }

  const directRoot = policy.directChildTargetRoots.find(
    (root) => dirname(path) === root,
  );
  if (directRoot) {
    assertPathWithinAny(path, [directRoot], label);
    return { kind: "directChildTargetRoots", path: directRoot };
  }

  const recursiveRoots = policy.targetRoots
    .filter((root) => isLexicallyWithin(path, root))
    .sort(
      (left, right) => right.length - left.length || left.localeCompare(right),
    );
  const recursiveRoot = recursiveRoots[0];
  if (recursiveRoot) {
    assertPathWithinAny(path, [recursiveRoot], label);
    return { kind: "targetRoots", path: recursiveRoot };
  }

  throw new Error(
    `invalid_transaction_path: ${label} is outside declared target policy`,
  );
}

function assertTargetAuthorized(
  path: string,
  policy: TargetPolicy,
  label: string,
): void {
  selectTargetAuthorization(path, policy, label);
}

function assertMinimalTargetPolicy(
  targets: string[],
  policy: TargetPolicy,
  label: string,
): void {
  const selected = selectUsedTargetPolicy(targets, policy);
  if (
    stableJson(selected.targetRoots) !== stableJson(policy.targetRoots) ||
    stableJson(selected.directChildTargetRoots) !==
      stableJson(policy.directChildTargetRoots) ||
    stableJson(selected.exactTargetPaths) !==
      stableJson(policy.exactTargetPaths)
  ) {
    throw new Error(
      `invalid_transaction_journal: ${label} contains unused target policy entries`,
    );
  }
}

function assertNonOverlappingTargets(
  targets: Array<{ path: string; label: string }>,
): void {
  for (let leftIndex = 0; leftIndex < targets.length; leftIndex += 1) {
    const left = targets[leftIndex];
    if (!left) {
      continue;
    }
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < targets.length;
      rightIndex += 1
    ) {
      const right = targets[rightIndex];
      if (!right || !pathsOverlap(left.path, right.path)) {
        continue;
      }
      const relationship = left.path === right.path ? "duplicate" : "overlap";
      throw new Error(
        `transaction_target_${relationship}: ${left.label} ${left.path} conflicts with ${right.label} ${right.path}`,
      );
    }
  }
}

function pathsOverlap(left: string, right: string): boolean {
  return isLexicallyWithin(left, right) || isLexicallyWithin(right, left);
}

function isLexicallyWithin(path: string, root: string): boolean {
  const rel = relative(root, path);
  return (
    rel === "" ||
    (rel !== ".." &&
      !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
  );
}

function assertPathWithinAny(
  path: string,
  roots: string[],
  label: string,
): void {
  for (const root of roots) {
    const rel = relative(root, path);
    if (
      rel === "" ||
      (rel !== ".." &&
        !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
    ) {
      const realPath = resolvePathWithoutDereferencingLeaf(path);
      const realRoot = rel === "" ? realPath : resolveDeclaredRoot(root);
      const realRel = relative(realRoot, realPath);
      if (
        realRel === "" ||
        (realRel !== ".." &&
          !realRel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`))
      ) {
        return;
      }
    }
  }
  throw new Error(
    `invalid_transaction_path: ${label} is outside declared target roots`,
  );
}

function resolveDeclaredRoot(root: string): string {
  if (existsOrSymlink(root)) {
    try {
      return realpathSync(root);
    } catch (error) {
      throw new Error(
        `invalid_transaction_path: declared target root ${root} cannot be resolved: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return resolvePathWithoutDereferencingLeaf(root);
}

function resolvePathWithoutDereferencingLeaf(path: string): string {
  const parent = dirname(path);
  let existing = parent;
  while (!existsOrSymlink(existing)) {
    const next = dirname(existing);
    if (next === existing) {
      throw new Error(
        `invalid_transaction_path: no existing parent for ${path}`,
      );
    }
    existing = next;
  }
  let realExisting: string;
  try {
    realExisting = realpathSync(existing);
  } catch (error) {
    throw new Error(
      `invalid_transaction_path: parent of ${path} cannot be resolved: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return join(realExisting, relative(existing, parent), basename(path));
}

function profileSelectionChanged(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }
  const record = metadata as Record<string, unknown>;
  const previousProfiles = normalizedMetadataProfiles(record.previousProfiles);
  const candidateProfiles = normalizedMetadataProfiles(
    record.candidateProfiles,
  );
  const previousPolicy = normalizedMetadataPolicy(record.previousPolicyProfile);
  const candidatePolicy = normalizedMetadataPolicy(
    record.candidatePolicyProfile,
  );
  if (
    previousProfiles === undefined ||
    candidateProfiles === undefined ||
    previousPolicy === undefined ||
    candidatePolicy === undefined
  ) {
    return false;
  }
  return (
    stableJson(previousProfiles) !== stableJson(candidateProfiles) ||
    previousPolicy !== candidatePolicy
  );
}

function normalizedMetadataProfiles(
  value: unknown,
): string[] | null | undefined {
  if (value === null) {
    return null;
  }
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.trim() === "")
  ) {
    return undefined;
  }
  return [...value].sort();
}

function normalizedMetadataPolicy(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function assertExactPathSet(
  actual: string[],
  expected: string[],
  label: string,
): void {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = [...expectedSet].filter((path) => !actualSet.has(path));
  const unexpected = [...actualSet].filter((path) => !expectedSet.has(path));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `recovery_path_set_mismatch: ${label} missing=[${missing.join(", ")}] unexpected=[${unexpected.join(", ")}]`,
    );
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
