import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import {
  type ContentHash,
  HASH_VERSION,
  type ObservedHash,
  sha256Bytes,
} from "./source-snapshot.ts";

export const MANIFEST_SCHEMA_VERSION = 1 as const;
export const PROFILE_SELECTION_SCHEMA_VERSION = 1 as const;
export const ADOPTION_SCHEMA_VERSION = 1 as const;

export type ManagedRuntimeManifest = {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  hashVersion: typeof HASH_VERSION;
  installedProfiles: string[];
  policyProfile: string;
  ownedPaths: Record<string, ContentHash>;
};

export type ProfileSelection = {
  installedProfiles: string[];
  policyProfile: string;
};

export type InteractiveProfileSelectionInput = {
  availableProfiles: string[];
  requestedProfiles: string[];
  requestedPolicyProfile?: string;
};

export type InteractiveProfileSelector = (
  input: InteractiveProfileSelectionInput,
) => ProfileSelection;

export type ProfileSelectionFile = {
  schemaVersion: typeof PROFILE_SELECTION_SCHEMA_VERSION;
  hashVersion: typeof HASH_VERSION;
  currentManifestHash: ContentHash;
  installedProfiles: string[];
  policyProfile: string;
};

export type AdoptionAction = "manage" | "replace-managed" | "remove";

export type AdoptionEntry = {
  path: string;
  observedHash: ObservedHash;
  action: AdoptionAction;
};

export type AdoptionFile = {
  schemaVersion: typeof ADOPTION_SCHEMA_VERSION;
  hashVersion: typeof HASH_VERSION;
  actions: AdoptionEntry[];
};

export type ResolveProfileSelectionInput = {
  availableProfiles: string[];
  manifest?: ManagedRuntimeManifest;
  requestedProfiles?: string[];
  allProfiles?: boolean;
  requestedPolicyProfile?: string;
  profileSelectionFile?: string;
  interactive: boolean;
  confirm?: (message: string) => boolean;
  selectProfileSelection?: InteractiveProfileSelector;
};

export function readManagedRuntimeManifest(
  path: string,
): ManagedRuntimeManifest | undefined {
  if (!existsSync(path)) {
    return undefined;
  }
  const value = readJson(path);
  return validateManagedRuntimeManifest(value, path);
}

export function validateManagedRuntimeManifest(
  value: unknown,
  source = "managed-runtime.json",
): ManagedRuntimeManifest {
  const record = requireRecord(value, source);
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "hashVersion",
      "installedProfiles",
      "policyProfile",
      "ownedPaths",
    ],
    source,
  );
  if (record.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    throw new Error(
      `unsupported_manifest_schema: ${source} uses schemaVersion ${String(record.schemaVersion)}`,
    );
  }
  assertHashVersion(record.hashVersion, source);
  const installedProfiles = normalizedProfileSet(
    record.installedProfiles,
    `${source}.installedProfiles`,
  );
  const policyProfile = requireNonEmptyString(
    record.policyProfile,
    `${source}.policyProfile`,
  );
  validatePolicyProfile(installedProfiles, policyProfile);
  const rawOwnedPaths = requireRecord(
    record.ownedPaths,
    `${source}.ownedPaths`,
  );
  const ownedPaths: Record<string, ContentHash> = {};
  for (const [path, hash] of Object.entries(rawOwnedPaths).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    const absolutePath = resolve(path);
    if (path !== absolutePath) {
      throw new Error(
        `invalid_manifest_path: ${source}.ownedPaths key must be absolute: ${path}`,
      );
    }
    ownedPaths[path] = requireContentHash(
      hash,
      `${source}.ownedPaths[${path}]`,
    );
  }
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    hashVersion: HASH_VERSION,
    installedProfiles,
    policyProfile,
    ownedPaths,
  };
}

export function writeManagedRuntimeManifestAtomic(
  path: string,
  manifest: ManagedRuntimeManifest,
): void {
  const normalized = validateManagedRuntimeManifest(manifest);
  writeJsonAtomic(path, normalized);
}

export function manifestHash(
  manifest: ManagedRuntimeManifest | undefined,
): ContentHash | "absent" {
  return manifest ? sha256Bytes(stableJson(manifest)) : "absent";
}

export function resolveProfileSelection(
  input: ResolveProfileSelectionInput,
): ProfileSelection {
  const available = normalizedProfileSet(
    input.availableProfiles,
    "availableProfiles",
  );
  if (available.length === 0) {
    throw new Error(
      "profile_selection_required: no runtime profiles are configured",
    );
  }

  if (!input.manifest) {
    if (input.profileSelectionFile) {
      throw new Error(
        "profile_selection_invalid: --profile-selection-file is only valid after managed-runtime.json exists",
      );
    }
    let requested = requestedProfileSet(input, available);
    let policyProfile = input.requestedPolicyProfile;
    if (
      input.interactive &&
      (requested.length === 0 || !policyProfile) &&
      input.selectProfileSelection
    ) {
      const selected = input.selectProfileSelection({
        availableProfiles: [...available],
        requestedProfiles: [...requested],
        requestedPolicyProfile: policyProfile,
      });
      requested = normalizedProfileSet(
        selected.installedProfiles,
        "interactive installed profiles",
      );
      policyProfile = requireNonEmptyString(
        selected.policyProfile,
        "interactive policy profile",
      );
    }
    if (requested.length === 0 || !policyProfile) {
      if (!input.interactive) {
        throw new Error(
          "profile_selection_required: first headless sync requires --profile <name> or --all-profiles plus --policy-profile <name>",
        );
      }
      throw new Error(
        "profile_selection_required: interactive sync must select installed profiles and one policy profile",
      );
    }
    validateSelectionAgainstAvailable(requested, policyProfile, available);
    if (
      input.interactive &&
      !(input.confirm ?? (() => false))(
        selectionPreview(
          "Initialize runtime profiles",
          requested,
          policyProfile,
        ),
      )
    ) {
      throw new Error(
        "profile_selection_cancelled: runtime profile selection was not confirmed",
      );
    }
    return { installedProfiles: requested, policyProfile };
  }

  const current: ProfileSelection = {
    installedProfiles: [...input.manifest.installedProfiles],
    policyProfile: input.manifest.policyProfile,
  };
  const explicitSelectionRequested =
    Boolean(input.allProfiles) ||
    (input.requestedProfiles?.length ?? 0) > 0 ||
    Boolean(input.requestedPolicyProfile) ||
    Boolean(input.profileSelectionFile);
  if (!explicitSelectionRequested) {
    return current;
  }

  let requested: ProfileSelection;
  if (input.profileSelectionFile) {
    requested = selectionFromFile(input.profileSelectionFile, input.manifest);
  } else {
    requested = {
      installedProfiles:
        requestedProfileSet(input, available).length > 0
          ? requestedProfileSet(input, available)
          : current.installedProfiles,
      policyProfile: input.requestedPolicyProfile ?? current.policyProfile,
    };
  }
  validateSelectionAgainstAvailable(
    requested.installedProfiles,
    requested.policyProfile,
    available,
  );
  if (sameSelection(current, requested)) {
    return current;
  }
  if (!input.interactive && !input.profileSelectionFile) {
    throw new Error(
      "profile_selection_file_required: later headless profile changes require --profile-selection-file <path>",
    );
  }
  if (
    input.interactive &&
    !(input.confirm ?? (() => false))(
      selectionPreview(
        `Replace ${current.installedProfiles.join(", ")} (${current.policyProfile})`,
        requested.installedProfiles,
        requested.policyProfile,
      ),
    )
  ) {
    throw new Error(
      "profile_selection_cancelled: runtime profile replacement was not confirmed",
    );
  }
  return requested;
}

export function readAdoptionFile(path: string): AdoptionFile {
  const record = requireRecord(readJson(path), path);
  requireExactKeys(record, ["schemaVersion", "hashVersion", "actions"], path);
  if (record.schemaVersion !== ADOPTION_SCHEMA_VERSION) {
    throw new Error(`unsupported_adoption_schema: ${path}`);
  }
  assertHashVersion(record.hashVersion, path);
  if (!Array.isArray(record.actions)) {
    throw new Error(`invalid_adoption_file: ${path}.actions must be an array`);
  }
  const seen = new Set<string>();
  const actions = record.actions.map((value, index): AdoptionEntry => {
    const entry = requireRecord(value, `${path}.actions[${index}]`);
    requireExactKeys(
      entry,
      ["path", "observedHash", "action"],
      `${path}.actions[${index}]`,
    );
    const targetPath = resolve(
      requireNonEmptyString(entry.path, `${path}.actions[${index}].path`),
    );
    if (targetPath !== entry.path) {
      throw new Error(`invalid_adoption_path: ${entry.path} must be absolute`);
    }
    if (seen.has(targetPath)) {
      throw new Error(`duplicate_adoption_path: ${targetPath}`);
    }
    seen.add(targetPath);
    const action = entry.action;
    if (
      action !== "manage" &&
      action !== "replace-managed" &&
      action !== "remove"
    ) {
      throw new Error(`invalid_adoption_action: ${String(action)}`);
    }
    const observedHash = requireObservedHash(
      entry.observedHash,
      `${path}.actions[${index}].observedHash`,
    );
    return { path: targetPath, observedHash, action };
  });
  return {
    schemaVersion: ADOPTION_SCHEMA_VERSION,
    hashVersion: HASH_VERSION,
    actions,
  };
}

export function adoptionActionFor(
  adoption: AdoptionFile | undefined,
  path: string,
  observedHash: ObservedHash,
  action: AdoptionAction,
): AdoptionEntry | undefined {
  const entry = adoption?.actions.find((candidate) => candidate.path === path);
  if (!entry) {
    return undefined;
  }
  if (entry.observedHash !== observedHash) {
    throw new Error(
      `adoption_hash_changed: ${path} expected ${entry.observedHash}, observed ${observedHash}`,
    );
  }
  if (entry.action !== action) {
    throw new Error(
      `adoption_action_mismatch: ${path} requires ${action}, file selects ${entry.action}`,
    );
  }
  return entry;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function writeJsonAtomic(path: string, value: unknown): void {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  try {
    writeFileSync(temporary, stableJson(value), {
      encoding: "utf-8",
      mode: 0o600,
    });
    renameSync(temporary, target);
  } finally {
    rmSync(temporary, { force: true });
  }
}

function selectionFromFile(
  path: string,
  manifest: ManagedRuntimeManifest,
): ProfileSelection {
  const record = requireRecord(readJson(path), path);
  requireExactKeys(
    record,
    [
      "schemaVersion",
      "hashVersion",
      "currentManifestHash",
      "installedProfiles",
      "policyProfile",
    ],
    path,
  );
  if (record.schemaVersion !== PROFILE_SELECTION_SCHEMA_VERSION) {
    throw new Error(`unsupported_profile_selection_schema: ${path}`);
  }
  assertHashVersion(record.hashVersion, path);
  const expectedHash = requireContentHash(
    record.currentManifestHash,
    `${path}.currentManifestHash`,
  );
  const currentHash = manifestHash(manifest);
  if (currentHash !== expectedHash) {
    throw new Error(
      `profile_selection_stale: ${path} expects ${expectedHash}, current manifest is ${currentHash}`,
    );
  }
  return {
    installedProfiles: normalizedProfileSet(
      record.installedProfiles,
      `${path}.installedProfiles`,
    ),
    policyProfile: requireNonEmptyString(
      record.policyProfile,
      `${path}.policyProfile`,
    ),
  };
}

function requestedProfileSet(
  input: ResolveProfileSelectionInput,
  available: string[],
): string[] {
  if (input.allProfiles && (input.requestedProfiles?.length ?? 0) > 0) {
    throw new Error(
      "profile_selection_invalid: use --all-profiles or --profile, not both",
    );
  }
  if (input.allProfiles) {
    return [...available];
  }
  return normalizedProfileSet(input.requestedProfiles ?? [], "--profile");
}

function validateSelectionAgainstAvailable(
  installedProfiles: string[],
  policyProfile: string,
  available: string[],
): void {
  if (installedProfiles.length === 0) {
    throw new Error(
      "profile_selection_required: select at least one installed profile",
    );
  }
  const availableSet = new Set(available);
  for (const profile of installedProfiles) {
    if (!availableSet.has(profile)) {
      throw new Error(`unknown_profile: ${profile}`);
    }
  }
  validatePolicyProfile(installedProfiles, policyProfile);
}

function validatePolicyProfile(
  installedProfiles: string[],
  policyProfile: string,
): void {
  if (!policyProfile || !installedProfiles.includes(policyProfile)) {
    throw new Error(
      `policy_profile_ambiguous: policyProfile '${policyProfile || "(missing)"}' must name exactly one installed profile`,
    );
  }
}

function sameSelection(
  left: ProfileSelection,
  right: ProfileSelection,
): boolean {
  return (
    left.policyProfile === right.policyProfile &&
    left.installedProfiles.length === right.installedProfiles.length &&
    left.installedProfiles.every(
      (profile, index) => profile === right.installedProfiles[index],
    )
  );
}

function selectionPreview(
  prefix: string,
  installedProfiles: string[],
  policyProfile: string,
): string {
  return `${prefix}; installedProfiles=[${installedProfiles.join(", ")}], policyProfile=${policyProfile}`;
}

function normalizedProfileSet(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  const profiles = value.map((entry, index) =>
    requireNonEmptyString(entry, `${label}[${index}]`),
  );
  const unique = [...new Set(profiles)].sort((left, right) =>
    left.localeCompare(right),
  );
  if (unique.length !== profiles.length) {
    throw new Error(`${label} contains duplicate profiles`);
  }
  return unique;
}

function assertHashVersion(
  value: unknown,
  source: string,
): asserts value is typeof HASH_VERSION {
  if (value !== HASH_VERSION) {
    throw new Error(
      `unsupported_hash_version: ${source} uses ${String(value)}`,
    );
  }
}

function requireContentHash(value: unknown, label: string): ContentHash {
  if (typeof value !== "string" || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a sha256 content hash`);
  }
  return value as ContentHash;
}

function requireObservedHash(value: unknown, label: string): ObservedHash {
  return value === "absent" ? "absent" : requireContentHash(value, label);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(resolve(path), "utf-8")) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid_json: ${path}: ${message}`);
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requireExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  label: string,
): void {
  const expectedSet = new Set(expected);
  const unexpected = Object.keys(value).filter((key) => !expectedSet.has(key));
  const missing = expected.filter((key) => !(key in value));
  if (unexpected.length > 0 || missing.length > 0) {
    throw new Error(
      `${label} has invalid keys; missing=[${missing.join(", ")}], unexpected=[${unexpected.join(", ")}]`,
    );
  }
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}
