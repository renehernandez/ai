import { createHash } from "node:crypto";
import { createRequire } from "node:module";

export const PROMPT_CONTRACT_VERSION = "3.0.0";

type SchemaName =
  | "activationContext"
  | "invocationEnvelope"
  | "manifest"
  | "workspaceOperation"
  | "workspaceRecord"
  | "workspaceResult";

type StandaloneValidator = {
  (value: unknown): boolean;
  errors?: Array<{
    instancePath?: string;
    message?: string;
  }> | null;
};

const require = createRequire(import.meta.url);
const validators = require("./generated-validators.cjs") as Record<
  SchemaName,
  StandaloneValidator
>;

export function assertSchemaValid(name: SchemaName, value: unknown): void {
  const validate = validators[name];
  if (validate(value)) {
    return;
  }
  const details = (validate.errors ?? [])
    .map(
      (error) =>
        `${error.instancePath || "/"} ${error.message ?? "is invalid"}`,
    )
    .join("; ");
  throw new Error(`agent_${name}_invalid: ${details}`);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeTimestamp(key, nested)]),
    );
  }
  return value;
}

export function lengthPrefixed(label: string, value: unknown): string {
  const json = canonicalJson(value);
  return `${label} ${Buffer.byteLength(json, "utf-8")}\n${json}\n`;
}

function normalizeTimestamp(key: string, value: unknown): unknown {
  if (
    typeof value === "string" &&
    (key.endsWith("_at") || key === "deadline")
  ) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().replace(".000Z", "Z");
    }
  }
  return normalize(value);
}
