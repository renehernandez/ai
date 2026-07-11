import {
  canonicalJson,
  sha256,
} from "../../skills/agent-workspace/scripts/prompt-contract.ts";

export type CoordinatorKind = "delivery" | "operations";

export type CoordinatorPolicy = {
  policyVersion: string;
  kind: CoordinatorKind;
  promptRoles: string[];
  apps: string[];
  linear: {
    team: string;
    teamId: string;
    project: string;
    projectId: string;
    issuePrefix: string;
    recordFields: Record<string, string[]>;
  };
};

export type CoordinatorToolInput = {
  tool_name?: unknown;
  tool_input?: unknown;
};

export type CoordinatorToolDecision = {
  decision: "allow" | "deny";
  reason: string;
};

const RECORD_TYPES = new Set([
  "root",
  "memory",
  "workstream",
  "run",
  "decision",
  "escalation",
]);

const LINEAR_READ_TOOLS = new Set([
  "mcp__codex_apps__linear_fetch",
  "mcp__codex_apps__linear_get_attachment",
  "mcp__codex_apps__linear_get_document",
  "mcp__codex_apps__linear_get_initiative",
  "mcp__codex_apps__linear_get_issue",
  "mcp__codex_apps__linear_get_issue_status",
  "mcp__codex_apps__linear_get_milestone",
  "mcp__codex_apps__linear_get_project",
  "mcp__codex_apps__linear_get_status_updates",
  "mcp__codex_apps__linear_get_team",
  "mcp__codex_apps__linear_get_user",
  "mcp__codex_apps__linear_list_comments",
  "mcp__codex_apps__linear_list_customers",
  "mcp__codex_apps__linear_list_cycles",
  "mcp__codex_apps__linear_list_documents",
  "mcp__codex_apps__linear_list_initiatives",
  "mcp__codex_apps__linear_list_issue_labels",
  "mcp__codex_apps__linear_list_issue_statuses",
  "mcp__codex_apps__linear_list_issues",
  "mcp__codex_apps__linear_list_milestones",
  "mcp__codex_apps__linear_list_project_labels",
  "mcp__codex_apps__linear_list_projects",
  "mcp__codex_apps__linear_list_teams",
  "mcp__codex_apps__linear_list_users",
  "mcp__codex_apps__linear_search",
  "mcp__codex_apps__linear_search_documentation",
]);

const OPERATIONS_READ_TOOLS = new Set([
  "mcp__codex_apps__gmail_batch_read_email",
  "mcp__codex_apps__gmail_batch_read_email_threads",
  "mcp__codex_apps__gmail_get_profile",
  "mcp__codex_apps__gmail_list_drafts",
  "mcp__codex_apps__gmail_list_labels",
  "mcp__codex_apps__gmail_read_attachment",
  "mcp__codex_apps__gmail_read_email",
  "mcp__codex_apps__gmail_read_email_thread",
  "mcp__codex_apps__gmail_search_email_ids",
  "mcp__codex_apps__gmail_search_emails",
  "mcp__codex_apps__google_calendar_batch_read_event",
  "mcp__codex_apps__google_calendar_fetch",
  "mcp__codex_apps__google_calendar_get_availability",
  "mcp__codex_apps__google_calendar_get_profile",
  "mcp__codex_apps__google_calendar_read_event",
  "mcp__codex_apps__google_calendar_search",
  "mcp__codex_apps__google_calendar_search_events",
  "mcp__codex_apps__slack_slack_get_reactions",
  "mcp__codex_apps__slack_slack_list_channel_members",
  "mcp__codex_apps__slack_slack_list_starred_items",
  "mcp__codex_apps__slack_slack_list_user_conversations",
  "mcp__codex_apps__slack_slack_list_user_groups",
  "mcp__codex_apps__slack_slack_list_workspaces",
  "mcp__codex_apps__slack_slack_read_canvas",
  "mcp__codex_apps__slack_slack_read_channel",
  "mcp__codex_apps__slack_slack_read_file",
  "mcp__codex_apps__slack_slack_read_thread",
  "mcp__codex_apps__slack_slack_read_user_profile",
  "mcp__codex_apps__slack_slack_search_channels",
  "mcp__codex_apps__slack_slack_search_emojis",
  "mcp__codex_apps__slack_slack_search_public",
  "mcp__codex_apps__slack_slack_search_public_and_private",
  "mcp__codex_apps__slack_slack_search_users",
]);

const DELIVERY_TASK_READS = new Set([
  "codex_app__list_projects",
  "codex_app__list_threads",
  "codex_app__read_thread",
]);

const DELIVERY_TASK_WRITES = new Set([
  "codex_app__create_thread",
  "codex_app__navigate_to_codex_page",
  "codex_app__send_message_to_thread",
  "codex_app__set_thread_pinned",
  "codex_app__set_thread_title",
]);

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function allowed(reason: string): CoordinatorToolDecision {
  return { decision: "allow", reason };
}

function denied(reason: string): CoordinatorToolDecision {
  return { decision: "deny", reason };
}

function matchesControlValue(
  value: unknown,
  name: string,
  id: string,
): boolean {
  return value === name || value === id;
}

function hasOnlyKeys(
  input: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(input).every((key) => allowed.has(key));
}

function isControlIssueId(value: unknown, prefix: string): value is string {
  return (
    typeof value === "string" &&
    value.startsWith(prefix) &&
    /^[1-9][0-9]*$/u.test(value.slice(prefix.length))
  );
}

function isControlLabelArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every(
      (item) =>
        typeof item === "string" &&
        /^(?:record|role|attention|domain):[a-z0-9][a-z0-9-]*$/u.test(item),
    )
  );
}

function typedRecordBody(value: unknown, policy: CoordinatorPolicy): boolean {
  if (typeof value !== "string") {
    return false;
  }
  const fields = new Map<string, string>();
  for (const match of value.matchAll(/^- `([a-z0-9_]+)`:\s*(.*)$/gmu)) {
    const [, field, fieldValue] = match;
    if (!field || fieldValue === undefined || fields.has(field)) {
      return false;
    }
    fields.set(field, fieldValue.trim());
  }
  const recordType = fields.get("record_type");
  if (!recordType || !RECORD_TYPES.has(recordType)) {
    return false;
  }
  const expectedFields = policy.linear.recordFields[recordType];
  if (!expectedFields || fields.size !== expectedFields.length) {
    return false;
  }
  return expectedFields.every(
    (field) => fields.has(field) && fields.get(field) !== "",
  );
}

function linearIssueDecision(
  input: Record<string, unknown>,
  policy: CoordinatorPolicy,
): CoordinatorToolDecision {
  const id = input.id;
  if (typeof id === "string") {
    if (!hasOnlyKeys(input, ["id", "description", "labels"])) {
      return denied(
        "Linear updates may change only the typed record body or labels.",
      );
    }
    if (!isControlIssueId(id, policy.linear.issuePrefix)) {
      return denied("Linear updates must target a RENE control-plane issue.");
    }
    if (input.description === undefined && input.labels === undefined) {
      return denied("Linear updates require a typed record body or labels.");
    }
    if (
      input.description !== undefined &&
      !typedRecordBody(input.description, policy)
    ) {
      return denied(
        "Linear record bodies must use a tracked typed-record shape.",
      );
    }
    if (input.labels !== undefined && !isControlLabelArray(input.labels)) {
      return denied(
        "Linear labels must use the record, role, attention, or domain vocabulary.",
      );
    }
    return allowed("Typed update to an existing Rene control-plane issue.");
  }

  if (
    !hasOnlyKeys(input, [
      "title",
      "team",
      "project",
      "parentId",
      "assignee",
      "description",
      "labels",
    ])
  ) {
    return denied("Linear creation contains unsupported issue fields.");
  }

  if (
    !matchesControlValue(
      input.team,
      policy.linear.team,
      policy.linear.teamId,
    ) ||
    !matchesControlValue(
      input.project,
      policy.linear.project,
      policy.linear.projectId,
    )
  ) {
    return denied(
      "Linear creation requires the exact Rene team and personal control project.",
    );
  }
  if (
    typeof input.title !== "string" ||
    input.title.trim() === "" ||
    !typedRecordBody(input.description, policy)
  ) {
    return denied("Linear creation requires a title and typed record body.");
  }
  if (
    input.parentId !== undefined &&
    !isControlIssueId(input.parentId, policy.linear.issuePrefix)
  ) {
    return denied("Linear child records require a RENE parent issue.");
  }
  if (input.assignee !== undefined && input.assignee !== "me") {
    return denied("Linear control records may only be assigned to the caller.");
  }
  if (input.labels !== undefined && !isControlLabelArray(input.labels)) {
    return denied(
      "Linear labels must use the record, role, attention, or domain vocabulary.",
    );
  }
  return allowed("Typed creation in the Rene control plane.");
}

function linearCommentDecision(
  input: Record<string, unknown>,
  policy: CoordinatorPolicy,
): CoordinatorToolDecision {
  if (!hasOnlyKeys(input, ["issueId", "body"])) {
    return denied("Only issueId and body are allowed for new comments.");
  }
  if (!isControlIssueId(input.issueId, policy.linear.issuePrefix)) {
    return denied("Linear comments must name a RENE control-plane issue.");
  }
  if (typeof input.body !== "string" || input.body.trim() === "") {
    return denied("Linear comments require a non-empty body.");
  }
  return allowed("New comment on a Rene control-plane issue.");
}

function preCreateActivationContext(
  prompt: string,
): Record<string, unknown> | undefined {
  const contextMarker = "AGENT_CONTEXT_V2\n";
  const contextStart = prompt.indexOf(contextMarker);
  if (contextStart < 0) {
    return undefined;
  }
  const context = prompt.slice(contextStart + contextMarker.length);
  const header = /(?:^|\n)ACTIVATION ([1-9][0-9]*)\n/u.exec(context);
  if (!header?.[1] || header.index === undefined) {
    return undefined;
  }
  const byteLength = Number(header[1]);
  const payloadStart = header.index + header[0].length;
  const remaining = Buffer.from(context.slice(payloadStart), "utf-8");
  if (
    !Number.isSafeInteger(byteLength) ||
    remaining.length <= byteLength ||
    remaining[byteLength] !== 10
  ) {
    return undefined;
  }
  const encoded = remaining.subarray(0, byteLength).toString("utf-8");
  if (Buffer.byteLength(encoded, "utf-8") !== byteLength) {
    return undefined;
  }
  try {
    return asObject(JSON.parse(encoded));
  } catch {
    return undefined;
  }
}

function taskWriteDecision(
  tool: string,
  input: Record<string, unknown>,
  policy: CoordinatorPolicy,
): CoordinatorToolDecision {
  if (tool !== "codex_app__create_thread") {
    return allowed("Bounded delivery task coordination operation.");
  }
  if (typeof input.prompt !== "string") {
    return denied(
      "Pinned task creation requires the versioned pre-create activation tuple.",
    );
  }
  const activation = preCreateActivationContext(input.prompt);
  if (
    activation?.activation_phase !== "pre_create" ||
    activation.codex_task_id !== null ||
    activation.prompt_contract_version !== "2.0.0" ||
    activation.control_project_kind !== policy.kind ||
    activation.control_permission_profile !== "coordinator-readonly" ||
    typeof activation.control_project_id !== "string" ||
    typeof activation.control_project_path !== "string" ||
    !/^[a-f0-9]{64}$/u.test(String(activation.control_policy_sha256)) ||
    !/^[a-f0-9]{64}$/u.test(String(activation.control_source_sha256)) ||
    !/^[a-f0-9]{64}$/u.test(String(activation.rendered_prompt_sha256))
  ) {
    return denied(
      "Pinned task creation requires the versioned pre-create activation tuple.",
    );
  }
  const target = asObject(input.target);
  if (
    target?.type !== "project" ||
    target.projectId !== activation.control_project_id
  ) {
    return denied("Task creation requires an explicit saved-project ID.");
  }
  return allowed("Versioned pinned-task pre-create operation.");
}

export function evaluateCoordinatorTool(
  payload: CoordinatorToolInput,
  policy: CoordinatorPolicy,
): CoordinatorToolDecision {
  if (typeof payload.tool_name !== "string") {
    return denied("Malformed hook payload: tool_name is required.");
  }
  const tool = payload.tool_name;
  const input = asObject(payload.tool_input);
  if (!input) {
    return denied("Malformed hook payload: tool_input must be an object.");
  }
  if (
    tool === "Bash" ||
    tool === "apply_patch" ||
    tool === "Edit" ||
    tool === "Write"
  ) {
    return denied(
      "Coordinator projects do not allow shell or file mutation tools.",
    );
  }

  if (tool.startsWith("mcp__codex_apps__linear_")) {
    if (LINEAR_READ_TOOLS.has(tool)) {
      return allowed("Read-only Linear operation.");
    }
    if (tool === "mcp__codex_apps__linear_save_issue") {
      return linearIssueDecision(input, policy);
    }
    if (tool === "mcp__codex_apps__linear_save_comment") {
      return linearCommentDecision(input, policy);
    }
    return denied("Unsupported Linear mutation.");
  }

  if (policy.kind === "delivery") {
    if (DELIVERY_TASK_READS.has(tool)) {
      return allowed("Read-only Codex task discovery operation.");
    }
    if (DELIVERY_TASK_WRITES.has(tool)) {
      return taskWriteDecision(tool, input, policy);
    }
    return denied("Tool is outside the Delivery Coordination allowlist.");
  }

  if (OPERATIONS_READ_TOOLS.has(tool)) {
    return allowed("Read-only Executive Operations source access.");
  }
  return denied("Tool is outside the Executive Operations allowlist.");
}

export function coordinatorPolicySha256(policy: CoordinatorPolicy): string {
  return sha256(
    `${canonicalJson(policy)}\n${renderCoordinatorPolicyEngineSource()}`,
  );
}

function renderCoordinatorPolicyEngineSource(): string {
  const source = evaluateCoordinatorTool
    .toString()
    .replace(
      "function evaluateCoordinatorTool",
      "function evaluateCoordinatorTool",
    );
  return `const RECORD_TYPES = new Set(${JSON.stringify([...RECORD_TYPES])});\nconst LINEAR_READ_TOOLS = new Set(${JSON.stringify([...LINEAR_READ_TOOLS])});\nconst OPERATIONS_READ_TOOLS = new Set(${JSON.stringify([...OPERATIONS_READ_TOOLS])});\nconst DELIVERY_TASK_READS = new Set(${JSON.stringify([...DELIVERY_TASK_READS])});\nconst DELIVERY_TASK_WRITES = new Set(${JSON.stringify([...DELIVERY_TASK_WRITES])});\n${asObject.toString()}\n${allowed.toString()}\n${denied.toString()}\n${matchesControlValue.toString()}\n${hasOnlyKeys.toString()}\n${isControlIssueId.toString()}\n${isControlLabelArray.toString()}\n${typedRecordBody.toString()}\n${linearIssueDecision.toString()}\n${linearCommentDecision.toString()}\n${preCreateActivationContext.toString()}\n${taskWriteDecision.toString()}\n${source}`;
}

export function renderCoordinatorPolicyHook(policy: CoordinatorPolicy): string {
  // The standalone hook intentionally serializes these functions. Keep this
  // module on the repository's direct TSX path; bundling or minification would
  // invalidate that source contract and must fail the execution fixture.
  const policyJson = JSON.stringify(policy);
  const policyEngineSource = renderCoordinatorPolicyEngineSource();
  return `// Generated by AX. Do not edit.\nconst POLICY = ${policyJson};\n${policyEngineSource}\nconst policySha256 = ${JSON.stringify(coordinatorPolicySha256(policy))};\nfunction output(decision) { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: decision.decision, permissionDecisionReason: decision.reason } }) + "\\n"); }\nif (process.argv.includes("--agent-discovery") || process.argv.includes("--hook-info")) { process.stdout.write(JSON.stringify({ name: "coordinator-policy", event: "PreToolUse", policyKind: POLICY.kind, policySha256, failureBehavior: "deny" }) + "\\n"); } else { let raw = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (chunk) => { raw += chunk; }); process.stdin.on("end", () => { try { output(evaluateCoordinatorTool(JSON.parse(raw), POLICY)); } catch (error) { output({ decision: "deny", reason: "Malformed coordinator hook input: " + String(error) }); } }); }\n`;
}
