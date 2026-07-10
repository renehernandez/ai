import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  HASH_VERSION,
  hashPath,
  type ObservedHash,
} from "../../scripts/ax/source-snapshot.ts";
import {
  applyTransaction,
  inspectTransactions,
  RECOVERY_SCHEMA_VERSION,
  recoverTransactions,
  resolveRecovery,
  TransactionInterruption,
  withMutationLock,
} from "../../scripts/ax/transaction-engine.ts";

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "ax-transaction-recovery-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function recoveryDocument(input: {
  transactionId: string;
  domain: string;
  manifestHash: ObservedHash;
  targetHashes: Record<string, ObservedHash>;
  actions: Record<string, string>;
  profileSelectionState?: "previous" | "candidate";
}): Record<string, unknown> {
  return {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    hashVersion: HASH_VERSION,
    transactionId: input.transactionId,
    domain: input.domain,
    currentManifestHash: input.manifestHash,
    currentTargetHashes: input.targetHashes,
    actions: input.actions,
    ...(input.profileSelectionState
      ? { profileSelectionState: input.profileSelectionState }
      : {}),
  };
}

test("failed preparation leaves no published or orphan transaction", () => {
  withTempDir((root) => {
    const transactionsRoot = join(root, "transactions");
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");

    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot: join(root, "backups"),
          operations: [
            { path: target, asset: "first", candidatePath: candidate },
            {
              path: join(root, "second.txt"),
              asset: "second",
              candidatePath: join(root, "missing.txt"),
            },
          ],
        }),
      /transaction_candidate_missing/,
    );

    assert.deepEqual(readdirSync(transactionsRoot), []);
    assert.doesNotThrow(() =>
      recoverTransactions({
        transactionsRoot,
        backupsRoot: join(root, "backups"),
      }),
    );
  });
});

test("target preflight rejects duplicates and overlaps before publishing a journal", () => {
  withTempDir((root) => {
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const lockPath = join(root, "lock");
    const parentTarget = join(root, "managed");
    const childTarget = join(parentTarget, "child.txt");
    const candidate = join(root, "candidate.txt");
    const candidateManifest = join(root, "candidate-manifest.json");
    mkdirSync(parentTarget, { recursive: true });
    writeFileSync(childTarget, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    writeFileSync(candidateManifest, "{}\n", "utf-8");

    assert.throws(
      () =>
        applyTransaction({
          domain: "duplicate",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: childTarget, asset: "first", candidatePath: candidate },
            { path: childTarget, asset: "second", candidatePath: candidate },
          ],
        }),
      /transaction_target_duplicate/,
    );
    assert.equal(existsSync(transactionsRoot), false);

    assert.throws(
      () =>
        applyTransaction({
          domain: "operation-overlap",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: parentTarget, asset: "parent", candidatePath: candidate },
            { path: childTarget, asset: "child", candidatePath: candidate },
          ],
        }),
      /transaction_target_overlap/,
    );
    assert.equal(existsSync(transactionsRoot), false);

    assert.throws(
      () =>
        applyTransaction({
          domain: "manifest-overlap",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: childTarget, asset: "child", candidatePath: candidate },
          ],
          manifestPath: parentTarget,
          candidateManifestPath: candidateManifest,
        }),
      /transaction_target_overlap/,
    );
    assert.equal(existsSync(transactionsRoot), false);
  });
});

test("target containment is validated before target or candidate retention", () => {
  withTempDir((root) => {
    const allowedRoot = join(root, "allowed");
    const outsideTarget = join(root, "outside", "target.txt");
    const transactionsRoot = join(root, "transactions");
    mkdirSync(allowedRoot, { recursive: true });
    mkdirSync(join(root, "outside"), { recursive: true });
    writeFileSync(outsideTarget, "sensitive\n", "utf-8");

    assert.throws(
      () =>
        applyTransaction({
          domain: "containment",
          root,
          targetRoots: [allowedRoot],
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot: join(root, "backups"),
          operations: [
            {
              path: outsideTarget,
              asset: "outside",
              candidatePath: join(root, "missing-candidate.txt"),
            },
          ],
        }),
      /outside declared target policy/,
    );
    assert.equal(existsSync(transactionsRoot), false);
    assert.equal(readFileSync(outsideTarget, "utf-8"), "sensitive\n");
  });
});

test("preparation rejects targets changed after planning before retention", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    writeFileSync(target, "planned\n", "utf-8");
    writeFileSync(candidate, "candidate\n", "utf-8");
    const plannedHash = hashPath(target);
    writeFileSync(target, "changed-after-plan\n", "utf-8");

    assert.throws(
      () =>
        applyTransaction({
          domain: "precondition",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot: join(root, "backups"),
          operations: [
            {
              path: target,
              asset: "target",
              candidatePath: candidate,
              expectedPreviousHash: plannedHash,
            },
          ],
        }),
      /transaction_previous_hash_mismatch/,
    );
    assert.deepEqual(readdirSync(transactionsRoot), []);
    assert.equal(readFileSync(target, "utf-8"), "changed-after-plan\n");

    const absentAtPlan = join(root, "absent-at-plan.txt");
    writeFileSync(absentAtPlan, "appeared-after-plan\n", "utf-8");
    assert.throws(
      () =>
        applyTransaction({
          domain: "absent-precondition",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot: join(root, "backups"),
          operations: [
            {
              path: absentAtPlan,
              asset: "absent-target",
              candidatePath: candidate,
              expectedPreviousHash: "absent",
            },
          ],
        }),
      /transaction_previous_hash_mismatch/,
    );
    assert.deepEqual(readdirSync(transactionsRoot), []);
    assert.equal(readFileSync(absentAtPlan, "utf-8"), "appeared-after-plan\n");
  });
});

test("ownership hashes must match retained previous and candidate content", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const lockPath = join(root, "lock");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    const previousHash = hashPath(target);
    const candidateHash = hashPath(candidate);
    assert.notEqual(previousHash, candidateHash);
    assert.notEqual(previousHash, "absent");
    assert.notEqual(candidateHash, "absent");

    assert.throws(
      () =>
        applyTransaction({
          domain: "ownership-input",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            {
              path: target,
              asset: "target",
              candidatePath: candidate,
              previousOwnership: { hash: candidateHash },
              candidateOwnership: { hash: candidateHash },
            },
          ],
        }),
      /transaction_ownership_hash_mismatch/,
    );
    assert.deepEqual(readdirSync(transactionsRoot), []);

    assert.throws(
      () =>
        applyTransaction({
          domain: "ownership-journal",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            {
              path: target,
              asset: "target",
              candidatePath: candidate,
              previousOwnership: { hash: previousHash },
              candidateOwnership: { hash: candidateHash },
            },
          ],
          fault: (point) => {
            if (point === "after-prepared") {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    const [transactionId] = readdirSync(transactionsRoot);
    assert.ok(transactionId);
    const journalPath = join(transactionsRoot, transactionId, "journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
      operations: Array<{ candidateOwnership: { hash: ObservedHash } }>;
    };
    const operation = journal.operations[0];
    assert.ok(operation);
    operation.candidateOwnership.hash = previousHash;
    writeFileSync(journalPath, JSON.stringify(journal), "utf-8");

    assert.throws(
      () => inspectTransactions(transactionsRoot),
      /transaction_ownership_hash_mismatch/,
    );
  });
});

test("recovery requires an explicit valid action for null-ownership operations", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const lockPath = join(root, "lock");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    assert.throws(
      () =>
        applyTransaction({
          domain: `openspec:${root}`,
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: target, asset: "openspec", candidatePath: candidate },
          ],
          metadata: {
            previousProfiles: null,
            previousPolicyProfile: null,
            candidateProfiles: ["personal"],
            candidatePolicyProfile: "personal",
          },
          fault: (point) => {
            if (point.startsWith("after-target:")) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    writeFileSync(target, "external\n", "utf-8");
    assert.throws(
      () => recoverTransactions({ transactionsRoot, backupsRoot }),
      /recovery_conflict/,
    );
    const [inspection] = inspectTransactions(transactionsRoot);
    assert.deepEqual(inspection?.allowedActions[target], [
      "restore-previous",
      "apply-candidate",
      "preserve-unmanaged",
    ]);
    assert.equal(inspection?.profileSelectionRequired, true);

    const missingAction = join(root, "missing-action.json");
    writeFileSync(
      missingAction,
      JSON.stringify(
        recoveryDocument({
          transactionId: inspection.transactionId,
          domain: inspection.domain,
          manifestHash: inspection.manifestHash,
          targetHashes: inspection.targetHashes,
          actions: {},
        }),
      ),
      "utf-8",
    );
    assert.throws(
      () =>
        resolveRecovery({
          lockPath,
          transactionsRoot,
          backupsRoot,
          recoveryFile: missingAction,
        }),
      /recovery_path_set_mismatch|recovery_action_missing/,
    );

    const unknownAction = join(root, "unknown-action.json");
    writeFileSync(
      unknownAction,
      JSON.stringify(
        recoveryDocument({
          transactionId: inspection.transactionId,
          domain: inspection.domain,
          manifestHash: inspection.manifestHash,
          targetHashes: inspection.targetHashes,
          actions: { [target]: "apply-candiate" },
        }),
      ),
      "utf-8",
    );
    assert.throws(
      () =>
        resolveRecovery({
          lockPath,
          transactionsRoot,
          backupsRoot,
          recoveryFile: unknownAction,
        }),
      /invalid_recovery_action/,
    );
    assert.equal(readFileSync(target, "utf-8"), "external\n");
  });
});

test("mixed recovery derives and validates the selected manifest before cleanup", () => {
  withTempDir((root) => {
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const lockPath = join(root, "lock");
    const manifestPath = join(root, "managed-runtime.json");
    const candidateManifestPath = join(root, "candidate-manifest.json");
    const targets = ["restore", "apply", "preserve"].map((name) =>
      join(root, `${name}.txt`),
    );
    const candidates = targets.map((target) => `${target}.candidate`);
    for (const [index, target] of targets.entries()) {
      writeFileSync(target, `old-${String(index)}\n`, "utf-8");
      writeFileSync(candidates[index] ?? "", `new-${String(index)}\n`, "utf-8");
    }
    const previousOwnedPaths = Object.fromEntries(
      targets.map((target) => [target, hashPath(target)]),
    );
    const candidateOwnedPaths = Object.fromEntries(
      targets.map((target, index) => [
        target,
        hashPath(candidates[index] ?? ""),
      ]),
    );
    writeFileSync(
      manifestPath,
      JSON.stringify({ selection: "previous", ownedPaths: previousOwnedPaths }),
      "utf-8",
    );
    writeFileSync(
      candidateManifestPath,
      JSON.stringify({
        selection: "candidate",
        ownedPaths: candidateOwnedPaths,
      }),
      "utf-8",
    );

    assert.throws(
      () =>
        applyTransaction({
          domain: "runtime",
          root,
          lockPath,
          transactionsRoot,
          backupsRoot,
          operations: targets.map((target, index) => ({
            path: target,
            asset: `target-${String(index)}`,
            candidatePath: candidates[index],
            previousOwnership: { hash: previousOwnedPaths[target] },
            candidateOwnership: { hash: candidateOwnedPaths[target] },
          })),
          manifestPath,
          candidateManifestPath,
          metadata: {
            previousProfiles: ["previous"],
            previousPolicyProfile: "previous",
            candidateProfiles: ["candidate"],
            candidatePolicyProfile: "candidate",
          },
          fault: (point) => {
            if (point === `after-target:${targets[2]}`) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    const preserveTarget = targets[2];
    assert.ok(preserveTarget);
    writeFileSync(preserveTarget, "external-preserved\n", "utf-8");
    assert.throws(
      () => recoverTransactions({ transactionsRoot, backupsRoot }),
      /recovery_conflict/,
    );
    const [inspection] = inspectTransactions(transactionsRoot);
    assert.ok(inspection);
    assert.equal(inspection.profileSelectionRequired, true);
    const recoveryFile = join(root, "mixed-recovery.json");
    writeFileSync(
      recoveryFile,
      JSON.stringify(
        recoveryDocument({
          transactionId: inspection.transactionId,
          domain: inspection.domain,
          manifestHash: inspection.manifestHash,
          targetHashes: inspection.targetHashes,
          actions: {
            [targets[0] ?? ""]: "restore-previous",
            [targets[1] ?? ""]: "apply-candidate",
            [preserveTarget]: "preserve-unmanaged",
          },
          profileSelectionState: "candidate",
        }),
      ),
      "utf-8",
    );

    let validatedBeforeCleanup = false;
    resolveRecovery({
      lockPath,
      transactionsRoot,
      backupsRoot,
      recoveryFile,
      deriveManifest: ({ journal, actions, profileSelectionState }) => {
        assert.equal(profileSelectionState, "candidate");
        const retainedCandidate = journal.manifest?.candidatePayload;
        assert.ok(retainedCandidate);
        const selected = JSON.parse(
          readFileSync(retainedCandidate, "utf-8"),
        ) as { selection: string; ownedPaths: Record<string, ObservedHash> };
        const ownedPaths = { ...selected.ownedPaths };
        for (const operation of journal.operations) {
          const action = actions[operation.path];
          const ownership =
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
        return { ...selected, ownedPaths };
      },
      validateResolved: ({ journal, derivedManifest }) => {
        assert.equal(
          existsSync(join(transactionsRoot, journal.transactionId)),
          true,
        );
        assert.deepEqual(
          JSON.parse(readFileSync(manifestPath, "utf-8")),
          derivedManifest,
        );
        const manifest = derivedManifest as {
          selection: string;
          ownedPaths: Record<string, ObservedHash>;
        };
        assert.equal(manifest.selection, "candidate");
        for (const [path, ownedHash] of Object.entries(manifest.ownedPaths)) {
          assert.equal(hashPath(path), ownedHash);
        }
        assert.equal(manifest.ownedPaths[preserveTarget], undefined);
        validatedBeforeCleanup = true;
      },
    });

    assert.equal(readFileSync(targets[0] ?? "", "utf-8"), "old-0\n");
    assert.equal(readFileSync(targets[1] ?? "", "utf-8"), "new-1\n");
    assert.equal(readFileSync(preserveTarget, "utf-8"), "external-preserved\n");
    assert.equal(validatedBeforeCleanup, true);
    assert.deepEqual(inspectTransactions(transactionsRoot), []);
  });
});

test("retained manifest ownership can authorize a removed target before recovery mutation", () => {
  withTempDir((root) => {
    const target = join(root, "retired.txt");
    const manifestPath = join(root, "managed-runtime.json");
    const candidateManifestPath = join(root, "candidate-manifest.json");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    writeFileSync(target, "owned\n", "utf-8");
    const ownedHash = hashPath(target);
    assert.notEqual(ownedHash, "absent");
    writeFileSync(
      manifestPath,
      JSON.stringify({ ownedPaths: { [target]: ownedHash } }),
      "utf-8",
    );
    writeFileSync(
      candidateManifestPath,
      JSON.stringify({ ownedPaths: {} }),
      "utf-8",
    );

    assert.throws(
      () =>
        applyTransaction({
          domain: "runtime",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot,
          targetRoots: [],
          exactTargetPaths: [target, manifestPath],
          operations: [
            {
              path: target,
              asset: "retired",
              delete: true,
              previousOwnership: { hash: ownedHash },
              candidateOwnership: null,
            },
          ],
          manifestPath,
          candidateManifestPath,
          fault: (point) => {
            if (point === "after-manifest") {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    assert.equal(existsSync(target), false);

    let fallbackCalls = 0;
    recoverTransactions({
      transactionsRoot,
      backupsRoot,
      targetRoots: [],
      exactTargetPaths: [manifestPath],
      authorizeJournalTarget: ({ journal, targetPath, kind }) => {
        fallbackCalls += 1;
        assert.equal(kind, "operation");
        assert.equal(targetPath, target);
        const previousManifestPath = journal.manifest?.previousPayload;
        assert.ok(previousManifestPath);
        const previousManifest = JSON.parse(
          readFileSync(previousManifestPath, "utf-8"),
        ) as { ownedPaths: Record<string, ObservedHash> };
        const operation = journal.operations.find(
          (entry) => entry.path === targetPath,
        );
        return (
          operation?.previousOwnership?.hash ===
            previousManifest.ownedPaths[targetPath] &&
          previousManifest.ownedPaths[targetPath] === ownedHash
        );
      },
    });

    assert.equal(fallbackCalls, 1);
    assert.equal(existsSync(target), false);
    assert.deepEqual(inspectTransactions(transactionsRoot), []);
  });
});

test("recovery rejects transaction-id traversal before reading a journal", () => {
  withTempDir((root) => {
    const recoveryFile = join(root, "recovery.json");
    writeFileSync(
      recoveryFile,
      JSON.stringify(
        recoveryDocument({
          transactionId: "../outside",
          domain: "test",
          manifestHash: "absent",
          targetHashes: {},
          actions: {},
        }),
      ),
      "utf-8",
    );
    assert.throws(
      () =>
        resolveRecovery({
          lockPath: join(root, "lock"),
          transactionsRoot: join(root, "transactions"),
          backupsRoot: join(root, "backups"),
          recoveryFile,
        }),
      /invalid_transaction_id/,
    );
  });
});

test("recovery rejects a symlink-parent escape from the declared target root", () => {
  withTempDir((root) => {
    const allowedRoot = join(root, "allowed");
    const targetParent = join(allowedRoot, "nested");
    const target = join(targetParent, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    const outside = join(root, "outside");
    mkdirSync(targetParent, { recursive: true });
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          targetRoots: [allowedRoot],
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: target, asset: "target", candidatePath: candidate },
          ],
          fault: (point) => {
            if (point === "after-prepared") {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    renameSync(targetParent, outside);
    symlinkSync(outside, targetParent);
    assert.throws(
      () =>
        recoverTransactions({
          transactionsRoot,
          backupsRoot,
          targetRoots: [allowedRoot],
        }),
      /outside declared target roots/,
    );
    assert.equal(readFileSync(join(outside, "target.txt"), "utf-8"), "old\n");
  });
});

test("replacement interruption after displacement restores the preimage", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const candidate = join(root, "candidate.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    writeFileSync(target, "old\n", "utf-8");
    writeFileSync(candidate, "new\n", "utf-8");
    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot,
          operations: [
            { path: target, asset: "target", candidatePath: candidate },
          ],
          fault: (point) => {
            if (point === `after-displace:${target}`) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    assert.equal(existsSync(target), false);
    recoverTransactions({ transactionsRoot, backupsRoot });
    assert.equal(readFileSync(target, "utf-8"), "old\n");
    assert.deepEqual(inspectTransactions(transactionsRoot), []);
  });
});

test("delete interruption after displacement finalizes the retained deletion marker", () => {
  withTempDir((root) => {
    const target = join(root, "target.txt");
    const transactionsRoot = join(root, "transactions");
    const backupsRoot = join(root, "backups");
    writeFileSync(target, "old\n", "utf-8");
    assert.throws(
      () =>
        applyTransaction({
          domain: "test",
          root,
          lockPath: join(root, "lock"),
          transactionsRoot,
          backupsRoot,
          operations: [{ path: target, asset: "target", delete: true }],
          fault: (point) => {
            if (point === `after-displace:${target}`) {
              throw new TransactionInterruption();
            }
          },
        }),
      TransactionInterruption,
    );
    recoverTransactions({ transactionsRoot, backupsRoot });
    assert.equal(existsSync(target), false);
    assert.deepEqual(inspectTransactions(transactionsRoot), []);
  });
});

test("mutation lock rejects a live owner and reclaims a dead owner", () => {
  withTempDir((root) => {
    const lockPath = join(root, "mutation.lock");
    withMutationLock({ lockPath, domain: "outer", root }, () => {
      assert.throws(
        () =>
          withMutationLock(
            { lockPath, domain: "inner", root },
            () => undefined,
          ),
        /mutation_lock_active/,
      );
    });
    writeFileSync(
      lockPath,
      JSON.stringify({
        pid: 999_999_999,
        processStartIdentity: "dead",
        domain: "stale",
        root,
      }),
      "utf-8",
    );
    assert.doesNotThrow(() =>
      withMutationLock(
        { lockPath, domain: "replacement", root },
        () => undefined,
      ),
    );
    assert.equal(existsSync(lockPath), false);
  });
});
