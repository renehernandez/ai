import { DurableObject } from "cloudflare:workers";
import {
  isRecord,
  isWorkspaceResult,
  json,
  WORKSPACE_BACKEND,
  type WorkspaceEnv,
  type WorkspaceOperation,
  type WorkspaceRecord,
  type WorkspaceResult,
} from "./contracts.ts";

type JsonRow = { id: string; json: string };
type AgentRow = { agent_key: string; generation: number; root_json: string };
type ExecutionTarget = AgentRow;
type OperationRow = {
  id: string;
  json: string;
  status: string;
  claim_token?: string | null;
};

export class AgentWorkspace extends DurableObject<WorkspaceEnv> {
  private readonly sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: WorkspaceEnv) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  async fetch(request: Request): Promise<Response> {
    const workspaceKey = request.headers.get("x-ax-workspace-key");
    if (!workspaceKey) return json({ error: "workspace_key_missing" }, 400);
    const url = new URL(request.url);
    const prefix = `/v1/workspaces/${encodeURIComponent(workspaceKey)}`;
    const path = url.pathname.slice(prefix.length) || "/";

    try {
      if (request.method === "GET" && path === "/status") {
        return json(this.status(workspaceKey));
      }
      if (request.method === "POST" && path === "/import") {
        return json(await this.importRecords(request, workspaceKey), 201);
      }
      if (request.method === "POST" && path === "/activate") {
        return json(this.activate(workspaceKey));
      }
      if (request.method === "POST" && path === "/messages") {
        return json(await this.send(request, workspaceKey), 202);
      }
      if (request.method === "GET" && path === "/records") {
        return json(this.listRecords(url.searchParams.get("type")));
      }
      if (request.method === "GET" && path.startsWith("/records/")) {
        return this.showRecord(decodeURIComponent(path.slice(9)));
      }
      if (request.method === "POST" && path === "/operations/claim") {
        return json(await this.claim(request));
      }
      const complete = path.match(/^\/operations\/([^/]+)\/complete$/);
      if (request.method === "POST" && complete) {
        return json(
          await this.complete(
            request,
            decodeURIComponent(complete[1]),
            workspaceKey,
          ),
        );
      }
      if (request.method === "GET" && path === "/linear/export") {
        return json(this.exportProjections());
      }
      if (request.method === "POST" && path === "/linear/acknowledge") {
        return json(await this.acknowledgeProjections(request));
      }
      return json({ error: "route_not_found" }, 404);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "workspace_error";
      const code = /^[a-z][a-z0-9_]+$/.test(message)
        ? message
        : "workspace_error";
      const status =
        code === "request_body_too_large"
          ? 413
          : code.endsWith("_not_found")
            ? 404
            : code.endsWith("_conflict")
              ? 409
              : 400;
      return json({ error: code }, status);
    }
  }

  private migrate(): void {
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(`CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS agents (
        agent_key TEXT PRIMARY KEY,
        generation INTEGER NOT NULL,
        root_json TEXT NOT NULL
      )`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS records (
        id TEXT PRIMARY KEY,
        record_type TEXT NOT NULL,
        json TEXT NOT NULL,
        imported INTEGER NOT NULL DEFAULT 0,
        authoritative INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      )`);
      this.sql.exec(
        `CREATE INDEX IF NOT EXISTS records_type ON records(record_type)`,
      );
      this.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        from_agent TEXT,
        to_agent TEXT NOT NULL,
        message_type TEXT NOT NULL,
        objective TEXT NOT NULL,
        correlation_id TEXT,
        operation_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS operations (
        id TEXT PRIMARY KEY,
        agent_key TEXT NOT NULL,
        generation INTEGER NOT NULL,
        status TEXT NOT NULL,
        json TEXT NOT NULL,
        claimed_by TEXT,
        claimed_at TEXT,
        claim_token TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      )`);
      const operationColumns = this.sql
        .exec<{ name: string }>("PRAGMA table_info(operations)")
        .toArray();
      if (!operationColumns.some((column) => column.name === "claim_token")) {
        this.sql.exec("ALTER TABLE operations ADD COLUMN claim_token TEXT");
      }
      this.sql.exec(`CREATE UNIQUE INDEX IF NOT EXISTS operations_idempotency
        ON operations(json_extract(json, '$.idempotency_id'))
        WHERE json_extract(json, '$.idempotency_id') IS NOT NULL`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS results (
        operation_id TEXT PRIMARY KEY,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`);
      this.sql.exec(`CREATE TABLE IF NOT EXISTS projections (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        acknowledged_at TEXT
      )`);
      this.sql.exec(
        "INSERT OR IGNORE INTO metadata(key, value) VALUES ('schema_version', '1')",
      );
    });
  }

  private status(workspaceKey: string): Record<string, unknown> {
    const count = (table: string, where = "") =>
      Number(
        this.sql.exec(`SELECT COUNT(*) AS count FROM ${table} ${where}`).one()
          .count,
      );
    return {
      workspace_key: workspaceKey,
      backend: WORKSPACE_BACKEND,
      active: this.metadata("active") === "true",
      activated_at: this.metadata("activated_at"),
      agents: count("agents"),
      records: count("records", "WHERE authoritative = 1"),
      imported_records: count("records", "WHERE imported = 1"),
      queued_operations: count("operations", "WHERE status = 'queued'"),
      running_operations: count("operations", "WHERE status = 'running'"),
      pending_projections: count(
        "projections",
        "WHERE acknowledged_at IS NULL",
      ),
    };
  }

  private async importRecords(
    request: Request,
    workspaceKey: string,
  ): Promise<Record<string, unknown>> {
    if (this.metadata("active") === "true")
      throw new Error("workspace_already_active_conflict");
    const body = await readJson<{ records?: unknown[] } | unknown[]>(request);
    const records = Array.isArray(body) ? body : body.records;
    if (!Array.isArray(records) || records.length === 0)
      throw new Error("import_records_invalid");
    const invalid = records.find((record) => !isRecord(record));
    if (invalid) throw new Error("import_record_invalid");
    const ids = new Set<string>();
    for (const record of records as WorkspaceRecord[]) {
      if (ids.has(record.id))
        throw new Error("import_record_duplicate_conflict");
      ids.add(record.id);
    }
    const now = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        "DELETE FROM records WHERE imported = 1 AND authoritative = 0",
      );
      for (const record of records as WorkspaceRecord[]) {
        this.sql.exec(
          `INSERT INTO records(id, record_type, json, imported, authoritative, updated_at)
           VALUES (?, ?, ?, 1, 0, ?)
           ON CONFLICT(id) DO UPDATE SET record_type=excluded.record_type, json=excluded.json,
             imported=1, authoritative=0, updated_at=excluded.updated_at`,
          record.id,
          record.record_type,
          JSON.stringify(record),
          now,
        );
      }
      this.setMetadata("workspace_key", workspaceKey);
      this.setMetadata("imported_at", now);
    });
    return { imported: records.length, authoritative: false };
  }

  private activate(workspaceKey: string): Record<string, unknown> {
    if (this.metadata("active") === "true") return this.status(workspaceKey);
    const roots = this.sql
      .exec<JsonRow>(
        "SELECT id, json FROM records WHERE imported = 1 AND record_type = 'root'",
      )
      .toArray();
    if (roots.length === 0) throw new Error("imported_roots_not_found");
    const now = new Date().toISOString();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("UPDATE records SET authoritative = 1 WHERE imported = 1");
      const agentKeys = new Set<string>();
      for (const row of roots) {
        const legacy = JSON.parse(row.json) as WorkspaceRecord &
          Record<string, unknown>;
        if (
          legacy.runtime_backend !== undefined &&
          legacy.runtime_backend !== "linear-codex-v1"
        ) {
          throw new Error("root_runtime_backend_conflict");
        }
        const agentKey = String(legacy.agent_key ?? "");
        if (!agentKey) throw new Error("root_agent_key_invalid");
        if (agentKeys.has(agentKey))
          throw new Error("root_agent_key_duplicate_conflict");
        agentKeys.add(agentKey);
        const priorGeneration = Number(legacy.workspace_generation ?? 0);
        if (!Number.isInteger(priorGeneration) || priorGeneration < 1)
          throw new Error("root_workspace_generation_invalid");
        const generation = priorGeneration + 1;
        const provenance = {
          runtime_backend: "linear-codex-v1",
          workspace_generation: Math.max(priorGeneration, 1),
          codex_task_id: legacy.codex_task_id ?? null,
          ...copyFields(legacy, [
            "control_project_kind",
            "control_project_id",
            "control_project_path",
            "control_policy_sha256",
            "control_source_sha256",
            "control_permission_profile",
          ]),
        };
        const root = removeFields(
          {
            ...legacy,
            runtime_backend: WORKSPACE_BACKEND,
            workspace_key: workspaceKey,
            runtime_agent_id: `${workspaceKey}:${agentKey}`,
            workspace_generation: generation,
            activation_state: "active",
            codex_task_id: null,
            legacy_runtime_provenance: provenance,
          },
          [
            "control_project_kind",
            "control_project_id",
            "control_project_path",
            "control_policy_sha256",
            "control_source_sha256",
            "control_permission_profile",
          ],
        );
        const encoded = JSON.stringify(root);
        this.sql.exec(
          "UPDATE records SET json = ?, updated_at = ? WHERE id = ?",
          encoded,
          now,
          row.id,
        );
        this.sql.exec(
          `INSERT INTO agents(agent_key, generation, root_json) VALUES (?, ?, ?)
           ON CONFLICT(agent_key) DO UPDATE SET generation=excluded.generation, root_json=excluded.root_json`,
          agentKey,
          generation,
          encoded,
        );
      }
      this.setMetadata("active", "true");
      this.setMetadata("activated_at", now);
    });
    return this.status(workspaceKey);
  }

  private async send(
    request: Request,
    workspaceKey: string,
  ): Promise<Record<string, unknown>> {
    this.assertActive();
    const body = await readJson<
      Partial<WorkspaceOperation> & {
        to?: string;
        from?: string;
      }
    >(request);
    const agentKey = body.to ?? body.agent_key ?? "delivery-ea";
    const agent = this.agent(agentKey);
    const objective = String(body.objective ?? "").trim();
    if (!objective) throw new Error("message_objective_invalid");
    const operationId = body.operation_id || crypto.randomUUID();
    if (!operationId.trim()) throw new Error("operation_id_invalid");
    const createdAt = new Date().toISOString();
    if (body.idempotency_id) {
      const existing = this.sql
        .exec<{ id: string; agent_key: string }>(
          "SELECT id, agent_key FROM operations WHERE json_extract(json, '$.idempotency_id') = ?",
          body.idempotency_id,
        )
        .toArray()[0];
      if (existing) {
        return {
          accepted: true,
          duplicate: true,
          operation_id: existing.id,
          agent_key: existing.agent_key,
        };
      }
    }
    const messageType = body.message_type ?? "ASSIGN";
    if (!MESSAGE_TYPES.includes(messageType))
      throw new Error("message_type_invalid");
    const mode = body.mode ?? "Explore";
    if (!MODES.includes(mode)) throw new Error("operation_mode_invalid");
    const operation: WorkspaceOperation = {
      schema_version: 1,
      operation_id: operationId,
      workspace_key: workspaceKey,
      agent_key: agentKey,
      workspace_generation: agent.generation,
      message_type: messageType,
      objective,
      mode,
      authority_grant: stringArray(body.authority_grant),
      canonical_sources: stringArray(body.canonical_sources),
      acceptance: stringArray(body.acceptance),
      verification: stringArray(body.verification),
      stop_condition: String(
        body.stop_condition ??
          "Return a structured result after the objective is handled or blocked.",
      ),
      escalation_route: String(body.escalation_route ?? "delivery-ea"),
      model_profile: String(
        body.model_profile ?? modelProfile(agent.root_json),
      ),
      sandbox_mode: "read-only",
      repo_path: typeof body.repo_path === "string" ? body.repo_path : null,
      correlation_id:
        typeof body.correlation_id === "string" ? body.correlation_id : null,
      idempotency_id:
        typeof body.idempotency_id === "string" ? body.idempotency_id : null,
      created_at: createdAt,
    };
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        `INSERT INTO operations(id, agent_key, generation, status, json, created_at)
         VALUES (?, ?, ?, 'queued', ?, ?)`,
        operationId,
        agentKey,
        agent.generation,
        JSON.stringify(operation),
        createdAt,
      );
      this.sql.exec(
        `INSERT INTO messages(id, from_agent, to_agent, message_type, objective, correlation_id, operation_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        crypto.randomUUID(),
        body.from ?? null,
        agentKey,
        operation.message_type,
        objective,
        operation.correlation_id ?? null,
        operationId,
        createdAt,
      );
    });
    return { accepted: true, operation_id: operationId, agent_key: agentKey };
  }

  private listRecords(type: string | null): Record<string, unknown> {
    const rows = type
      ? this.sql
          .exec<JsonRow>(
            "SELECT id, json FROM records WHERE authoritative = 1 AND record_type = ? ORDER BY updated_at DESC",
            type,
          )
          .toArray()
      : this.sql
          .exec<JsonRow>(
            "SELECT id, json FROM records WHERE authoritative = 1 ORDER BY updated_at DESC",
          )
          .toArray();
    return { records: rows.map((row) => JSON.parse(row.json)) };
  }

  private showRecord(id: string): Response {
    const row = this.sql
      .exec<JsonRow>(
        "SELECT id, json FROM records WHERE id = ? AND authoritative = 1",
        id,
      )
      .toArray()[0];
    return row
      ? json(JSON.parse(row.json))
      : json({ error: "record_not_found" }, 404);
  }

  private async claim(request: Request): Promise<Record<string, unknown>> {
    this.assertActive();
    const body = await readJson<{
      runner_id?: string;
    }>(request, {});
    const runnerId = String(body.runner_id ?? "local");
    this.sql.exec(
      `UPDATE operations
       SET status = 'queued', claimed_by = NULL, claimed_at = NULL, claim_token = NULL
       WHERE status = 'running'
         AND strftime('%s', claimed_at) < strftime('%s', 'now') - 7200`,
    );
    const row = this.sql
      .exec<OperationRow>(
        "SELECT id, json, status FROM operations WHERE status = 'queued' ORDER BY created_at LIMIT 1",
      )
      .toArray()[0];
    if (!row) return { operation: null };
    const now = new Date().toISOString();
    const claimToken = crypto.randomUUID();
    const operation = JSON.parse(row.json) as WorkspaceOperation;
    this.ctx.storage.transactionSync(() => {
      this.sql.exec(
        "UPDATE operations SET status = 'running', claimed_by = ?, claimed_at = ?, claim_token = ? WHERE id = ? AND status = 'queued'",
        runnerId,
        now,
        claimToken,
        row.id,
      );
      this.markRunActive(operation.agent_key, now);
    });
    return {
      operation,
      claim_token: claimToken,
      context: this.agentContext(operation.agent_key),
    };
  }

  private async complete(
    request: Request,
    operationId: string,
    workspaceKey: string,
  ): Promise<Record<string, unknown>> {
    const candidate = await readJson<unknown>(request);
    if (!isWorkspaceResult(candidate))
      throw new Error("workspace_result_invalid");
    const result = candidate;
    if (result.operation_id !== operationId)
      throw new Error("result_operation_mismatch_conflict");
    const operationRow = this.sql
      .exec<OperationRow>(
        "SELECT id, json, status, claim_token FROM operations WHERE id = ?",
        operationId,
      )
      .toArray()[0];
    if (!operationRow) throw new Error("operation_not_found");
    const claimToken = request.headers.get("x-ax-claim-token");
    if (!claimToken || claimToken !== operationRow.claim_token)
      throw new Error("operation_claim_conflict");
    if (operationRow.status === "complete")
      return { accepted: true, duplicate: true };
    if (operationRow.status !== "running")
      throw new Error("operation_state_conflict");
    const operation = JSON.parse(operationRow.json) as WorkspaceOperation;
    const target = this.target(operation.agent_key);
    if (
      result.workspace_generation !== operation.workspace_generation ||
      target.generation !== operation.workspace_generation
    ) {
      throw new Error("workspace_generation_conflict");
    }
    const now = new Date().toISOString();
    const mutatedRecordIds = new Set(
      result.record_mutations
        .filter((mutation) => mutation.action === "upsert")
        .map((mutation) => mutation.record?.id)
        .filter((id): id is string => Boolean(id)),
    );
    this.ctx.storage.transactionSync(() => {
      for (const mutation of result.record_mutations ?? []) {
        if (mutation.action === "delete") {
          if (!mutation.record_id) throw new Error("record_delete_invalid");
          this.sql.exec("DELETE FROM records WHERE id = ?", mutation.record_id);
          continue;
        }
        if (!mutation.record || !isRecord(mutation.record))
          throw new Error("record_upsert_invalid");
        this.upsertRecord(mutation.record, now);
        if (shouldProject(mutation.record)) {
          this.addProjection(
            mutation.record.record_type,
            mutation.record.id,
            redactRestrictedRecord(mutation.record),
            now,
          );
        }
      }
      for (const message of result.messages ?? []) {
        this.enqueueDerivedMessage(message, operation, workspaceKey, now);
      }
      const settledRun = this.settleRun(operation.agent_key, result.state, now);
      if (
        settledRun &&
        !mutatedRecordIds.has(settledRun.id) &&
        ["complete", "failed", "canceled"].includes(String(settledRun.state))
      ) {
        this.addProjection(
          "run",
          settledRun.id,
          redactRestrictedRecord(settledRun),
          now,
        );
      }
      this.sql.exec(
        "INSERT INTO results(operation_id, json, created_at) VALUES (?, ?, ?)",
        operationId,
        JSON.stringify(result),
        now,
      );
      this.sql.exec(
        "UPDATE operations SET status = 'complete', completed_at = ? WHERE id = ?",
        now,
        operationId,
      );
      const targetDescriptor = JSON.parse(target.root_json) as Record<
        string,
        unknown
      >;
      const restrictedTarget = targetDescriptor.classification === "restricted";
      this.addProjection(
        "operation_result",
        operationId,
        {
          operation_id: operationId,
          agent_key: operation.agent_key,
          state: result.state,
          response: restrictedTarget
            ? "Restricted operation result. Open an authorized canonical source explicitly."
            : result.response,
          checkpoints: restrictedTarget ? [] : result.checkpoints,
          completed_at: now,
        },
        now,
      );
    });
    return { accepted: true, operation_id: operationId };
  }

  private exportProjections(): Record<string, unknown> {
    const rows = this.sql
      .exec<{
        id: string;
        entity_type: string;
        entity_id: string;
        payload_json: string;
        created_at: string;
      }>(
        "SELECT id, entity_type, entity_id, payload_json, created_at FROM projections WHERE acknowledged_at IS NULL ORDER BY created_at",
      )
      .toArray();
    return {
      projections: rows.map((row) => ({
        ...row,
        payload: JSON.parse(row.payload_json),
        payload_json: undefined,
      })),
    };
  }

  private async acknowledgeProjections(
    request: Request,
  ): Promise<Record<string, unknown>> {
    const body = await readJson<{ projection_ids?: string[] }>(request);
    if (!Array.isArray(body.projection_ids))
      throw new Error("projection_ids_invalid");
    const now = new Date().toISOString();
    for (const id of body.projection_ids) {
      this.sql.exec(
        "UPDATE projections SET acknowledged_at = ? WHERE id = ?",
        now,
        id,
      );
    }
    return { acknowledged: body.projection_ids.length };
  }

  private enqueueDerivedMessage(
    message: WorkspaceResult["messages"][number],
    parent: WorkspaceOperation,
    workspaceKey: string,
    now: string,
  ): void {
    if (message.idempotency_id) {
      const existing = this.sql
        .exec<{ id: string }>(
          "SELECT id FROM operations WHERE json_extract(json, '$.idempotency_id') = ?",
          message.idempotency_id,
        )
        .toArray()[0];
      if (existing) return;
    }
    const target = this.target(message.to);
    const descriptor = JSON.parse(target.root_json) as Record<string, unknown>;
    const runTarget = descriptor.record_type === "run";
    const id = crypto.randomUUID();
    const operation: WorkspaceOperation = {
      ...parent,
      operation_id: id,
      agent_key: message.to,
      workspace_generation: target.generation,
      message_type: message.message_type,
      objective: message.objective,
      workspace_key: workspaceKey,
      correlation_id: message.correlation_id ?? parent.operation_id,
      idempotency_id: message.idempotency_id ?? null,
      model_profile: modelProfile(target.root_json),
      mode: runTarget
        ? (descriptor.mode as WorkspaceOperation["mode"])
        : parent.mode,
      authority_grant: runTarget
        ? stringArray(descriptor.authority_grant)
        : parent.authority_grant,
      canonical_sources: runTarget
        ? stringArray(descriptor.canonical_sources)
        : parent.canonical_sources,
      acceptance: runTarget
        ? stringArray(descriptor.acceptance)
        : parent.acceptance,
      verification: runTarget
        ? stringArray(descriptor.verification)
        : parent.verification,
      stop_condition: runTarget
        ? String(descriptor.stop_condition)
        : parent.stop_condition,
      escalation_route: runTarget
        ? String(descriptor.escalation_route)
        : parent.escalation_route,
      sandbox_mode: runTarget
        ? (descriptor.sandbox_mode as WorkspaceOperation["sandbox_mode"])
        : parent.sandbox_mode,
      repo_path: runTarget
        ? typeof descriptor.worktree === "string"
          ? descriptor.worktree
          : null
        : parent.repo_path,
      created_at: now,
    };
    this.sql.exec(
      "INSERT INTO operations(id, agent_key, generation, status, json, created_at) VALUES (?, ?, ?, 'queued', ?, ?)",
      id,
      message.to,
      target.generation,
      JSON.stringify(operation),
      now,
    );
    this.sql.exec(
      `INSERT INTO messages(id, from_agent, to_agent, message_type, objective, correlation_id, operation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      parent.agent_key,
      message.to,
      message.message_type,
      message.objective,
      operation.correlation_id ?? null,
      id,
      now,
    );
  }

  private upsertRecord(record: WorkspaceRecord, now: string): void {
    this.sql.exec(
      `INSERT INTO records(id, record_type, json, imported, authoritative, updated_at)
       VALUES (?, ?, ?, 0, 1, ?)
       ON CONFLICT(id) DO UPDATE SET record_type=excluded.record_type, json=excluded.json,
         authoritative=1, updated_at=excluded.updated_at`,
      record.id,
      record.record_type,
      JSON.stringify(record),
      now,
    );
  }

  private addProjection(
    entityType: string,
    entityId: string,
    payload: unknown,
    now: string,
  ): void {
    this.sql.exec(
      "INSERT INTO projections(id, entity_type, entity_id, payload_json, created_at) VALUES (?, ?, ?, ?, ?)",
      crypto.randomUUID(),
      entityType,
      entityId,
      JSON.stringify(payload),
      now,
    );
  }

  private agent(agentKey: string): AgentRow {
    const row = this.sql
      .exec<AgentRow>(
        "SELECT agent_key, generation, root_json FROM agents WHERE agent_key = ?",
        agentKey,
      )
      .toArray()[0];
    if (!row) throw new Error("agent_not_found");
    return row;
  }

  private target(targetKey: string): ExecutionTarget {
    const agent = this.sql
      .exec<AgentRow>(
        "SELECT agent_key, generation, root_json FROM agents WHERE agent_key = ?",
        targetKey,
      )
      .toArray()[0];
    if (agent) return agent;
    const recordId = targetKey.startsWith("run:")
      ? targetKey.slice(4)
      : targetKey;
    const row = this.sql
      .exec<JsonRow>(
        "SELECT id, json FROM records WHERE id = ? AND record_type = 'run' AND authoritative = 1",
        recordId,
      )
      .toArray()[0];
    if (!row) throw new Error("agent_not_found");
    const run = JSON.parse(row.json) as Record<string, unknown>;
    if (!["reserved", "spawned", "active"].includes(String(run.state)))
      throw new Error("agent_run_terminal_conflict");
    const generation = Number(run.workspace_generation);
    if (!Number.isInteger(generation) || generation < 1)
      throw new Error("agent_run_generation_invalid");
    return {
      agent_key: `run:${row.id}`,
      generation,
      root_json: row.json,
    };
  }

  private markRunActive(targetKey: string, now: string): void {
    const recordId = targetKey.startsWith("run:")
      ? targetKey.slice(4)
      : targetKey;
    const row = this.sql
      .exec<JsonRow>(
        "SELECT id, json FROM records WHERE id = ? AND record_type = 'run' AND authoritative = 1",
        recordId,
      )
      .toArray()[0];
    if (!row) return;
    const run = JSON.parse(row.json) as WorkspaceRecord &
      Record<string, unknown>;
    if (!["reserved", "spawned", "active"].includes(String(run.state)))
      throw new Error("agent_run_terminal_conflict");
    if (run.state === "active") return;
    run.state = "active";
    this.sql.exec(
      "UPDATE records SET json = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(run),
      now,
      recordId,
    );
  }

  private settleRun(
    targetKey: string,
    resultState: WorkspaceResult["state"],
    now: string,
  ): (WorkspaceRecord & Record<string, unknown>) | null {
    const recordId = targetKey.startsWith("run:")
      ? targetKey.slice(4)
      : targetKey;
    const row = this.sql
      .exec<JsonRow>(
        "SELECT id, json FROM records WHERE id = ? AND record_type = 'run' AND authoritative = 1",
        recordId,
      )
      .toArray()[0];
    if (!row) return null;
    const run = JSON.parse(row.json) as WorkspaceRecord &
      Record<string, unknown>;
    if (resultState === "complete") run.state = "complete";
    if (resultState === "failed") run.state = "failed";
    this.sql.exec(
      "UPDATE records SET json = ?, updated_at = ? WHERE id = ?",
      JSON.stringify(run),
      now,
      recordId,
    );
    return run;
  }

  private agentContext(agentKey: string): WorkspaceRecord[] {
    const root = JSON.parse(
      this.target(agentKey).root_json,
    ) as WorkspaceRecord & Record<string, unknown>;
    const linkedIds = new Set<string>([root.id]);
    if (typeof root.memory_epoch_id === "string")
      linkedIds.add(root.memory_epoch_id);
    for (const source of Array.isArray(root.canonical_sources)
      ? root.canonical_sources
      : []) {
      if (typeof source === "string") linkedIds.add(source);
    }
    const all = this.sql
      .exec<JsonRow>(
        "SELECT id, json FROM records WHERE authoritative = 1 ORDER BY updated_at",
      )
      .toArray()
      .map(
        (row) =>
          JSON.parse(row.json) as WorkspaceRecord & Record<string, unknown>,
      );
    for (const record of all) {
      if (
        record.agent_key === agentKey ||
        record.owner === agentKey ||
        record.root_record_id === root.id
      ) {
        linkedIds.add(record.id);
      }
      if (record.record_type === "memory" && linkedIds.has(record.id)) {
        for (const id of Array.isArray(record.workstream_ids)
          ? record.workstream_ids
          : []) {
          if (typeof id === "string") linkedIds.add(id);
        }
      }
    }
    return all
      .filter((record) => linkedIds.has(record.id))
      .map(redactRestrictedRecord);
  }

  private assertActive(): void {
    if (this.metadata("active") !== "true")
      throw new Error("workspace_not_active_conflict");
  }

  private metadata(key: string): string | null {
    const row = this.sql
      .exec<{ value: string }>("SELECT value FROM metadata WHERE key = ?", key)
      .toArray()[0];
    return row?.value ?? null;
  }

  private setMetadata(key: string, value: string): void {
    this.sql.exec(
      "INSERT INTO metadata(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      value,
    );
  }
}

function shouldProject(record: WorkspaceRecord): boolean {
  if (["memory", "decision", "escalation"].includes(record.record_type))
    return true;
  if (record.record_type === "run") {
    return ["complete", "failed", "canceled"].includes(String(record.state));
  }
  if (record.record_type === "workstream") {
    return ["complete", "canceled"].includes(String(record.status));
  }
  return false;
}

function modelProfile(rootJson: string): string {
  const root = JSON.parse(rootJson) as { model_profile?: string };
  return root.model_profile ?? "pinned-standard";
}

function copyFields(
  source: Record<string, unknown>,
  fields: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    fields
      .filter((field) => source[field] !== undefined)
      .map((field) => [field, source[field]]),
  );
}

function removeFields<T extends Record<string, unknown>>(
  source: T,
  fields: string[],
): T {
  const copy = { ...source };
  for (const field of fields) delete copy[field];
  return copy;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

const MESSAGE_TYPES: WorkspaceOperation["message_type"][] = [
  "ASSIGN",
  "CHECKPOINT",
  "DECISION_REQUEST",
  "BLOCKED",
  "URGENT",
  "HANDOFF",
  "COMPLETE",
  "CANCEL",
];

const MODES: WorkspaceOperation["mode"][] = [
  "Explore",
  "Plan",
  "Execute",
  "Review",
  "Finish",
];

function redactRestrictedRecord(record: WorkspaceRecord): WorkspaceRecord {
  if (record.classification !== "restricted") return record;
  const source = record as Record<string, unknown>;
  return {
    record_type: record.record_type,
    id: record.id,
    created_at: record.created_at,
    classification: record.classification,
    summary:
      "Restricted record. Open an authorized canonical source explicitly.",
    ...copyFields(source, [
      "agent_key",
      "agent_role",
      "reports_to",
      "workspace_generation",
      "runtime_backend",
      "runtime_agent_id",
      "role_variant",
      "model_profile",
      "sandbox_mode",
      "mode",
      "state",
    ]),
  };
}

async function readJson<T>(request: Request, empty?: T): Promise<T> {
  const limit = 1_000_000;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit)
    throw new Error("request_body_too_large");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error("request_body_too_large");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  if (!text && empty !== undefined) return empty;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("request_json_invalid");
  }
}
