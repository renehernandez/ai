import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { stableJson } from "./runtime-state.ts";
import {
  ABSENT_HASH,
  type ContentHash,
  copyPath,
  HASH_VERSION,
  hashPath,
  sha256Bytes,
} from "./source-snapshot.ts";

export const BACKUP_SCHEMA_VERSION = 1 as const;
export const BACKUP_RETENTION = 7 as const;

export type BackupRecord = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  hashVersion: typeof HASH_VERSION;
  asset: string;
  targetPath: string;
  contentHash: ContentHash;
  entryKind: "directory" | "file" | "symlink";
  backupId: string;
};

export type CreateBackupInput = {
  backupsRoot: string;
  asset: string;
  targetPath: string;
  retention?: number;
};

export function createVerifiedBackup(
  input: CreateBackupInput,
): BackupRecord | undefined {
  const targetPath = resolve(input.targetPath);
  const observed = hashPath(targetPath);
  if (observed === ABSENT_HASH) {
    return undefined;
  }
  const backupSet = backupSetPath(input.backupsRoot, input.asset, targetPath);
  mkdirSync(backupSet, { recursive: true });
  const backupId = `${Date.now().toString(36)}-${randomUUID()}`;
  const entryRoot = join(backupSet, backupId);
  const payload = join(entryRoot, "payload");
  mkdirSync(entryRoot, { recursive: true });
  copyPath(targetPath, payload);
  const copied = hashPath(payload);
  if (copied !== observed) {
    rmSync(entryRoot, { force: true, recursive: true });
    throw new Error(
      `backup_verification_failed: ${targetPath} expected ${observed}, copied ${copied}`,
    );
  }
  const stats = lstatSync(targetPath);
  const record: BackupRecord = {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    hashVersion: HASH_VERSION,
    asset: input.asset,
    targetPath,
    contentHash: observed,
    entryKind: stats.isSymbolicLink()
      ? "symlink"
      : stats.isDirectory()
        ? "directory"
        : "file",
    backupId,
  };
  writeFileSync(join(entryRoot, "metadata.json"), stableJson(record), "utf-8");
  rotateBackups(backupSet, input.retention ?? BACKUP_RETENTION);
  return record;
}

export function listVerifiedBackups(
  backupsRoot: string,
  asset: string,
  targetPath: string,
): BackupRecord[] {
  const backupSet = backupSetPath(backupsRoot, asset, resolve(targetPath));
  if (!existsSync(backupSet)) {
    return [];
  }
  return readdirSync(backupSet)
    .sort((left, right) => right.localeCompare(left))
    .map((entry) => readBackupRecord(join(backupSet, entry)))
    .filter((record): record is BackupRecord => Boolean(record));
}

export function restoreVerifiedBackup(
  backupsRoot: string,
  asset: string,
  targetPath: string,
  backupId: string,
): void {
  const entryRoot = join(
    backupSetPath(backupsRoot, asset, resolve(targetPath)),
    backupId,
  );
  const record = readBackupRecord(entryRoot);
  if (!record) {
    throw new Error(`backup_missing: ${entryRoot}`);
  }
  const payload = join(entryRoot, "payload");
  const payloadHash = hashPath(payload);
  if (payloadHash !== record.contentHash) {
    throw new Error(
      `backup_corrupt: ${entryRoot} expected ${record.contentHash}, observed ${payloadHash}`,
    );
  }
  rmSync(record.targetPath, { force: true, recursive: true });
  copyPath(payload, record.targetPath);
  const restored = hashPath(record.targetPath);
  if (restored !== record.contentHash) {
    throw new Error(
      `backup_restore_failed: ${record.targetPath} expected ${record.contentHash}, observed ${restored}`,
    );
  }
}

function rotateBackups(backupSet: string, retention: number): void {
  if (!Number.isInteger(retention) || retention < 1) {
    throw new Error(`invalid_backup_retention: ${retention}`);
  }
  const entries = readdirSync(backupSet).sort((left, right) =>
    right.localeCompare(left),
  );
  for (const stale of entries.slice(retention)) {
    rmSync(join(backupSet, stale), { force: true, recursive: true });
  }
}

function backupSetPath(
  backupsRoot: string,
  asset: string,
  targetPath: string,
): string {
  const assetName = asset.replace(/[^a-zA-Z0-9._-]+/g, "-") || "asset";
  const targetIdentity = sha256Bytes(targetPath).slice("sha256:".length);
  return join(
    resolve(backupsRoot),
    assetName,
    `${basename(targetPath)}-${targetIdentity}`,
  );
}

function readBackupRecord(entryRoot: string): BackupRecord | undefined {
  const metadataPath = join(entryRoot, "metadata.json");
  const payloadPath = join(entryRoot, "payload");
  if (!existsSync(metadataPath) || !existsSync(payloadPath)) {
    return undefined;
  }
  try {
    const value = JSON.parse(
      readFileSync(metadataPath, "utf-8"),
    ) as BackupRecord;
    if (
      value.schemaVersion !== BACKUP_SCHEMA_VERSION ||
      value.hashVersion !== HASH_VERSION ||
      hashPath(payloadPath) !== value.contentHash
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}
