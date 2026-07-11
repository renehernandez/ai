import Ajv2020 from "ajv/dist/2020.js";
import workspaceRecordSchema from "../../agents/schemas/workspace-record.schema.json" with {
  type: "json",
};
import workspaceResultSchema from "../../agents/schemas/workspace-result.schema.json" with {
  type: "json",
};

export const WORKSPACE_BACKEND = "cloudflare-flue-v1" as const;

const schemaValidator = new Ajv2020({ allErrors: false, strict: true });
const validateWorkspaceRecord = schemaValidator.compile(workspaceRecordSchema);
const validateWorkspaceResult = schemaValidator.compile(workspaceResultSchema);

export type WorkspaceRecord = Record<string, unknown> & {
  record_type:
    | "root"
    | "memory"
    | "workstream"
    | "run"
    | "decision"
    | "escalation";
  id: string;
  created_at: string;
  classification: "public" | "internal" | "confidential" | "restricted";
  summary: string;
};

export type WorkspaceOperation = {
  schema_version: 1;
  operation_id: string;
  workspace_key: string;
  agent_key: string;
  workspace_generation: number;
  message_type:
    | "ASSIGN"
    | "CHECKPOINT"
    | "DECISION_REQUEST"
    | "BLOCKED"
    | "URGENT"
    | "HANDOFF"
    | "COMPLETE"
    | "CANCEL";
  objective: string;
  mode: "Explore" | "Plan" | "Execute" | "Review" | "Finish";
  authority_grant: string[];
  canonical_sources: string[];
  acceptance: string[];
  verification: string[];
  stop_condition: string;
  escalation_route: string;
  model_profile: string;
  sandbox_mode: "read-only" | "workspace-write";
  repo_path?: string | null;
  correlation_id?: string | null;
  idempotency_id?: string | null;
  created_at: string;
};

export type WorkspaceResult = {
  schema_version: 1;
  operation_id: string;
  workspace_generation: number;
  state: "complete" | "waiting" | "blocked" | "failed";
  response: string;
  checkpoints: string[];
  record_mutations: Array<{
    action: "upsert" | "delete";
    record?: WorkspaceRecord;
    record_id?: string;
  }>;
  messages: Array<{
    to: string;
    message_type: WorkspaceOperation["message_type"];
    objective: string;
    correlation_id?: string | null;
    idempotency_id?: string | null;
  }>;
  projection_record_ids: string[];
};

export type WorkspaceEnv = {
  WORKSPACES: DurableObjectNamespace;
  AX_ACCESS_TEAM_DOMAIN?: string;
  AX_ACCESS_AUD?: string;
  AX_WORKSPACE_ENVIRONMENT?: string;
  AX_WORKSPACE_DEV_TOKEN?: string;
  AX_WORKSPACE_KEY?: string;
};

export function isRecord(value: unknown): value is WorkspaceRecord {
  return validateWorkspaceRecord(value);
}

export function isWorkspaceResult(value: unknown): value is WorkspaceResult {
  if (!validateWorkspaceResult(value)) return false;
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    result.schema_version === 1 &&
    typeof result.operation_id === "string" &&
    Number.isInteger(result.workspace_generation) &&
    ["complete", "waiting", "blocked", "failed"].includes(
      String(result.state),
    ) &&
    typeof result.response === "string" &&
    Array.isArray(result.checkpoints) &&
    result.checkpoints.every((item) => typeof item === "string") &&
    Array.isArray(result.record_mutations) &&
    result.record_mutations.every(isRecordMutation) &&
    Array.isArray(result.messages) &&
    result.messages.every(isResultMessage) &&
    Array.isArray(result.projection_record_ids) &&
    result.projection_record_ids.every((item) => typeof item === "string")
  );
}

function isRecordMutation(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const mutation = value as Record<string, unknown>;
  return mutation.action === "upsert"
    ? isRecord(mutation.record) && mutation.record_id === undefined
    : mutation.action === "delete"
      ? typeof mutation.record_id === "string" && mutation.record === undefined
      : false;
}

function isResultMessage(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.to === "string" &&
    typeof message.objective === "string" &&
    [
      "ASSIGN",
      "CHECKPOINT",
      "DECISION_REQUEST",
      "BLOCKED",
      "URGENT",
      "HANDOFF",
      "COMPLETE",
      "CANCEL",
    ].includes(String(message.message_type))
  );
}

export function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}
