import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stableJson } from "./json-state.ts";

const PROFILE_STATE_SCHEMA_VERSION = 1 as const;

export type SelectedProfileState = {
  schemaVersion: typeof PROFILE_STATE_SCHEMA_VERSION;
  selectedProfile: string;
};

export function selectedProfilePath(runtimeRoot: string): string {
  return join(runtimeRoot, "selected-profile.json");
}

export function readSelectedProfile(
  runtimeRoot: string,
): SelectedProfileState | undefined {
  const path = selectedProfilePath(runtimeRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error(
      `selected_profile_invalid: ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`selected_profile_invalid: ${path} must contain an object`);
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== PROFILE_STATE_SCHEMA_VERSION) {
    throw new Error(
      `selected_profile_invalid: ${path}.schemaVersion must be ${String(PROFILE_STATE_SCHEMA_VERSION)}`,
    );
  }
  if (
    typeof record.selectedProfile !== "string" ||
    record.selectedProfile.trim() === ""
  ) {
    throw new Error(
      `selected_profile_invalid: ${path}.selectedProfile must be a non-empty string`,
    );
  }
  const unexpected = Object.keys(record).filter(
    (key) => key !== "schemaVersion" && key !== "selectedProfile",
  );
  if (unexpected.length > 0) {
    throw new Error(
      `selected_profile_invalid: ${path} has unsupported keys: ${unexpected.sort().join(", ")}`,
    );
  }
  return {
    schemaVersion: PROFILE_STATE_SCHEMA_VERSION,
    selectedProfile: record.selectedProfile,
  };
}

export function selectedProfilePayload(selectedProfile: string): string {
  return stableJson({
    schemaVersion: PROFILE_STATE_SCHEMA_VERSION,
    selectedProfile,
  } satisfies SelectedProfileState);
}
