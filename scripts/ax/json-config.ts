import { join } from "node:path";
import type {
  ManagedConfigDeclaration,
  ManagedConfigScalar,
  ManagedJsonValue,
  ManagedLeaf,
} from "./config-sync.ts";

export function resolveJsonPaths(
  name: string,
  declaration: ManagedConfigDeclaration,
  home: string,
): ManagedLeaf[] {
  if (
    declaration.managed !== undefined ||
    !Array.isArray(declaration.managedPaths)
  )
    throw new Error(`managed_config_paths_invalid: ${name}`);
  const leaves: ManagedLeaf[] = [];
  for (const entry of declaration.managedPaths) {
    if (
      !entry ||
      !Array.isArray(entry.path) ||
      entry.path.length === 0 ||
      entry.path.some(
        (key) =>
          typeof key !== "string" ||
          !key ||
          ["__proto__", "constructor", "prototype"].includes(key),
      )
    )
      throw new Error(`managed_config_path_invalid: ${name}`);
    if (entry.expandHome !== undefined && typeof entry.expandHome !== "boolean")
      throw new Error(`managed_config_paths_invalid: ${name}`);
    const value = jsonValue(entry.value, home, entry.expandHome === true);
    if (
      leaves.some(
        (leaf) =>
          isPrefix(leaf.path, entry.path) || isPrefix(entry.path, leaf.path),
      )
    )
      throw new Error(
        `managed_config_path_overlap: ${name}.${entry.path.join(".")}`,
      );
    leaves.push({ path: [...entry.path], value });
  }
  return leaves;
}

function isPrefix(left: string[], right: string[]): boolean {
  return (
    left.length <= right.length &&
    left.every((part, index) => part === right[index])
  );
}

function jsonValue(
  value: unknown,
  home: string,
  expand: boolean,
): ManagedJsonValue {
  if (typeof value === "string")
    return expand && value.startsWith("~/")
      ? join(home, value.slice(2))
      : value;
  if (value === null || isScalar(value)) return value;
  if (Array.isArray(value))
    return value.map((entry) => jsonValue(entry, home, expand));
  if (!isPlainObject(value))
    throw new Error("managed_config_value_invalid: expected JSON value");
  const result: Record<string, ManagedJsonValue> = {};
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error(`managed_config_key_invalid: ${key}`);
    result[key] = jsonValue(child, home, expand);
  }
  return result;
}

export function updateJsonDocument(
  parsed: Record<string, unknown>,
  leaves: ManagedLeaf[],
): string {
  const result = structuredClone(parsed);
  for (const leaf of leaves) {
    let parent = result;
    for (const part of leaf.path.slice(0, -1)) {
      if (!Object.hasOwn(parent, part)) parent[part] = {};
      if (!isPlainObject(parent[part]))
        throw new Error(
          `managed_config_parent_invalid: ${leaf.path.join(".")}`,
        );
      parent = parent[part] as Record<string, unknown>;
    }
    parent[leaf.path[leaf.path.length - 1]] = structuredClone(leaf.value);
  }
  return `${JSON.stringify(result, null, 2)}\n`;
}

export function valueAtPath(
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

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isScalar(value: unknown): value is ManagedConfigScalar {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

export function parseJsonDocument(
  content: string,
  path: string,
): Record<string, unknown> {
  if (content === "") return {};
  try {
    const value: unknown = JSON.parse(content);
    if (!isPlainObject(value)) throw new Error("expected object");
    return value;
  } catch (error) {
    throw new Error(
      `managed_config_json_invalid: ${path}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
