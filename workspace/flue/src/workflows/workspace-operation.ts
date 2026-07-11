import { defineAgent, defineWorkflow } from "@flue/runtime";
import { local } from "@flue/runtime/node";
import * as v from "valibot";

const operationSchema = v.object({
  schema_version: v.literal(1),
  operation_id: v.string(),
  workspace_key: v.string(),
  agent_key: v.string(),
  workspace_generation: v.number(),
  message_type: v.string(),
  objective: v.string(),
  mode: v.string(),
  authority_grant: v.array(v.string()),
  canonical_sources: v.array(v.string()),
  acceptance: v.array(v.string()),
  verification: v.array(v.string()),
  stop_condition: v.string(),
  escalation_route: v.string(),
  model_profile: v.string(),
  sandbox_mode: v.string(),
  repo_path: v.optional(v.nullable(v.string())),
  correlation_id: v.optional(v.nullable(v.string())),
  idempotency_id: v.optional(v.nullable(v.string())),
  created_at: v.string(),
});

const recordSchema = v.record(v.string(), v.unknown());
const resultSchema = v.object({
  schema_version: v.literal(1),
  operation_id: v.string(),
  workspace_generation: v.number(),
  state: v.picklist(["complete", "waiting", "blocked", "failed"]),
  response: v.string(),
  checkpoints: v.array(v.string()),
  record_mutations: v.array(
    v.object({
      action: v.picklist(["upsert", "delete"]),
      record: v.optional(recordSchema),
      record_id: v.optional(v.string()),
    }),
  ),
  messages: v.array(
    v.object({
      to: v.string(),
      message_type: v.picklist([
        "ASSIGN",
        "CHECKPOINT",
        "DECISION_REQUEST",
        "BLOCKED",
        "URGENT",
        "HANDOFF",
        "COMPLETE",
        "CANCEL",
      ]),
      objective: v.string(),
      correlation_id: v.optional(v.nullable(v.string())),
      idempotency_id: v.optional(v.nullable(v.string())),
    }),
  ),
  projection_record_ids: v.array(v.string()),
});

const model = process.env.AX_FLUE_MODEL;
if (!model) throw new Error("AX_FLUE_MODEL is required");
const writable = process.env.AX_WORKSPACE_SANDBOX_MODE === "workspace-write";
const repoPath = process.env.AX_WORKSPACE_REPO_PATH;

const agent = defineAgent(() => ({
  model,
  ...(writable ? { sandbox: local(), cwd: repoPath } : {}),
  instructions: [
    "You are executing one operation from Rene's durable organizational agent workspace.",
    "Respect the operation's mode, authority_grant, canonical_sources, stop_condition, and sandbox_mode exactly.",
    "Do not perform external writes, merge, deploy, or expand authority unless the operation explicitly grants it.",
    "Return only the requested structured result. Route additional work through messages instead of inventing hidden state.",
  ].join(" "),
}));

export default defineWorkflow({
  agent,
  input: v.object({
    operation: operationSchema,
    context: v.array(recordSchema),
    instructions: v.string(),
  }),
  output: resultSchema,
  async run({ harness, input }) {
    const session = await harness.session();
    const response = await session.prompt(
      [
        "Execute this workspace operation:",
        JSON.stringify(input.operation, null, 2),
        "Authoritative workspace context:",
        JSON.stringify(input.context, null, 2),
        "Tracked role and shared contract:",
        input.instructions,
        "For every upsert, provide a complete record matching one of the root, memory, workstream, run, decision, or escalation contracts.",
        "Use record_mutations only for durable state changes. Use messages to delegate through the declared hierarchy.",
        "Set operation_id and workspace_generation exactly from the input. Keep projection_record_ids empty; the control plane assigns them.",
      ].join("\n\n"),
      { result: resultSchema },
    );
    return response.data;
  },
});
