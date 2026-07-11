import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Command } from "commander";
import { assertSchemaValid } from "../../skills/agent-workspace/scripts/prompt-contract.ts";

export type WorkspaceCommandInput = {
  command:
    | "configure"
    | "bootstrap"
    | "status"
    | "send"
    | "records-list"
    | "records-show"
    | "run-once"
    | "linear-export"
    | "linear-acknowledge";
  url?: string;
  workspace?: string;
  file?: string;
  to?: string;
  message?: string;
  id?: string;
  type?: string;
  repo?: string;
  workspaceWrite?: boolean;
  json?: boolean;
};

export type WorkspaceExecutor = (
  input: WorkspaceCommandInput,
) => void | Promise<void>;

type WorkspaceConnection = { url: string; workspace: string };

export function addWorkspaceCommands(
  program: Command,
  execute: WorkspaceExecutor,
): void {
  const workspace = program
    .command("workspace")
    .description("Operate the Cloudflare agent workspace");
  workspace
    .command("configure")
    .description("Configure the workspace endpoint and personal workspace key")
    .requiredOption("--url <url>", "Cloudflare workspace Worker URL")
    .requiredOption("--workspace <key>", "Personal workspace key")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "configure", ...options }),
    );
  workspace
    .command("bootstrap")
    .description("Create a fresh workspace from the tracked executive roles")
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "bootstrap", ...options }),
    );
  workspace
    .command("status")
    .description("Show workspace activation, queues, and projection state")
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "status", ...options }),
    );
  workspace
    .command("send")
    .description("Send work to an organizational agent")
    .option("--to <agent-key>", "Target agent key", "delivery-ea")
    .option("--message <text>", "Message text")
    .option("--file <path>", "Read message text from a file")
    .option("--repo <path>", "Authorized local repository path")
    .option(
      "--workspace-write",
      "Grant local workspace-write sandbox authority",
    )
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "send", ...options }),
    );
  const records = workspace
    .command("records")
    .description("Inspect authoritative workspace records");
  records
    .command("list")
    .option("--type <record-type>", "Filter by record type")
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "records-list", ...options }),
    );
  records
    .command("show <id>")
    .option("--json", "Emit structured JSON")
    .action((id: string, options: WorkspaceCommandInput) =>
      execute({ command: "records-show", id, ...options }),
    );
  workspace
    .command("run")
    .description("Run queued work locally through Flue")
    .requiredOption("--once", "Claim and execute at most one queued operation")
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "run-once", ...options }),
    );
  const linear = workspace
    .command("linear")
    .description("Project durable outputs to Linear");
  linear
    .command("export")
    .description("Export unacknowledged Linear projection records")
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "linear-export", ...options }),
    );
  linear
    .command("acknowledge")
    .description("Acknowledge projection IDs after successful Linear writes")
    .requiredOption("--file <path>", "JSON file containing projection_ids")
    .option("--json", "Emit structured JSON")
    .action((options: WorkspaceCommandInput) =>
      execute({ command: "linear-acknowledge", ...options }),
    );
}

export async function executeWorkspaceCommand(
  input: WorkspaceCommandInput,
): Promise<void> {
  if (input.command === "configure") {
    configure(input.url, input.workspace);
    print(
      { configured: true, url: input.url, workspace: input.workspace },
      input.json,
    );
    return;
  }
  const connection = readConnection();
  if (input.command === "bootstrap") {
    const records = buildWorkspaceBootstrap(
      connection.workspace,
      new Date().toISOString(),
    );
    for (const record of records) assertSchemaValid("workspaceRecord", record);
    print(
      await request(connection, "/bootstrap", {
        method: "POST",
        body: { records },
      }),
      input.json,
    );
    return;
  }
  if (input.command === "status") {
    print(await request(connection, "/status"), input.json);
    return;
  }
  if (input.command === "send") {
    const objective = messageText(input);
    print(
      await request(connection, "/messages", {
        method: "POST",
        body: {
          to: input.to ?? "delivery-ea",
          objective,
          repo_path: input.repo ? resolve(input.repo) : null,
          mode: input.workspaceWrite ? "Execute" : "Explore",
          authority_grant: input.workspaceWrite
            ? [
                `delegate-local-workspace-write:${input.repo ? resolve(input.repo) : process.cwd()}`,
              ]
            : [],
          sandbox_mode: "read-only",
        },
      }),
      input.json,
    );
    return;
  }
  if (input.command === "records-list") {
    const query = input.type ? `?type=${encodeURIComponent(input.type)}` : "";
    print(await request(connection, `/records${query}`), input.json);
    return;
  }
  if (input.command === "records-show") {
    print(
      await request(
        connection,
        `/records/${encodeURIComponent(input.id ?? "")}`,
      ),
      input.json,
    );
    return;
  }
  if (input.command === "linear-export") {
    print(await request(connection, "/linear/export"), input.json);
    return;
  }
  if (input.command === "linear-acknowledge") {
    print(
      await request(connection, "/linear/acknowledge", {
        method: "POST",
        body: readJsonFile(input.file),
      }),
      input.json,
    );
    return;
  }
  if (input.command === "run-once") {
    print(await runOnce(connection), input.json);
  }
}

export function buildWorkspaceBootstrap(
  workspaceKey: string,
  createdAt: string,
): Array<Record<string, unknown>> {
  const sourceRoot = resolve(import.meta.dirname, "../..");
  const manifest = JSON.parse(
    readFileSync(resolve(sourceRoot, "agents/manifest.json"), "utf-8"),
  ) as {
    prompt_contract_version: string;
    shared_contract: string;
    roles: Array<{
      id: string;
      description: string;
      lifecycle: string;
      reports_to: string;
      charter: string;
      model_profile: string;
      required_skills: string[];
    }>;
  };
  const scopes: Record<string, string> = {
    "delivery-ea": "global-software-delivery-portfolio",
    "operations-ea": "executive-operations",
  };
  return manifest.roles
    .filter((role) => ["delivery-ea", "operations-ea"].includes(role.id))
    .flatMap((role) => {
      const rootId = `${workspaceKey}:${role.id}`;
      const memoryId = `${rootId}:memory:1`;
      const workstreamId = `${rootId}:bootstrap`;
      const renderedPrompt = [
        readFileSync(
          resolve(sourceRoot, "agents", manifest.shared_contract),
          "utf-8",
        ),
        readFileSync(resolve(sourceRoot, "agents", role.charter), "utf-8"),
        ...role.required_skills.map((skill) =>
          readFileSync(
            resolve(sourceRoot, "skills", skill, "SKILL.md"),
            "utf-8",
          ),
        ),
      ].join("\n\n");
      const root = {
        record_type: "root",
        id: rootId,
        created_at: createdAt,
        classification: "internal",
        summary: role.description,
        agent_key: role.id,
        agent_role: role.id,
        reports_to: role.reports_to,
        owned_scope: scopes[role.id],
        workspace_generation: 1,
        activation_state: "active",
        prompt_contract_version: manifest.prompt_contract_version,
        rendered_prompt_sha256: createHash("sha256")
          .update(renderedPrompt)
          .digest("hex"),
        model_profile: role.model_profile,
        runtime_backend: "cloudflare-flue-v1",
        workspace_key: workspaceKey,
        runtime_agent_id: rootId,
        codex_task_id: null,
        memory_epoch_id: memoryId,
        authority_exclusions: [
          "merge",
          "deploy",
          "cleanup",
          "ready-state",
          "external-provider-mutation",
        ],
      };
      const memory = {
        record_type: "memory",
        id: memoryId,
        created_at: createdAt,
        classification: "internal",
        summary: `Initial ${role.id} memory.`,
        epoch: 1,
        current: true,
        prompt_contract_version: manifest.prompt_contract_version,
        charter_summary: role.description,
        constraints: [
          "Cloudflare owns operational coordination state.",
          "Work executes on Rene's local machine through Codex and Flue.",
          "Linear is readable context and the durable integration output.",
        ],
        decisions: ["Start from a fresh Cloudflare-native workspace."],
        workstream_ids: [workstreamId],
        prior_epoch_id: null,
      };
      const workstream = {
        record_type: "workstream",
        id: workstreamId,
        created_at: createdAt,
        classification: "internal",
        summary: `Bootstrap the ${role.id} workspace.`,
        outcome: `${role.id} is ready for new intake.`,
        status: "complete",
        owner: role.id,
        scope: scopes[role.id],
        acceptance: ["Root and memory are authoritative in Cloudflare."],
        dependencies: [],
        risks: [],
        next_action: "Accept new intake.",
      };
      return [root, memory, workstream];
    });
}

async function runOnce(connection: WorkspaceConnection): Promise<unknown> {
  const defaultModel = process.env.AX_FLUE_MODEL;
  if (!defaultModel)
    throw new Error("AX_FLUE_MODEL is required for ax workspace run --once");
  const claimed = (await request(connection, "/operations/claim", {
    method: "POST",
    body: {
      runner_id: `${process.env.USER ?? "local"}@${process.env.HOST ?? "localhost"}`,
    },
  })) as {
    operation?: Record<string, unknown> | null;
    claim_token?: string;
    context?: Array<Record<string, unknown>>;
  };
  if (!claimed.operation) return { executed: false, reason: "queue_empty" };
  if (!claimed.claim_token) throw new Error("workspace_claim_token_missing");
  try {
    assertSchemaValid("workspaceOperation", claimed.operation);
    const claimedProfile = String(claimed.operation.model_profile ?? "");
    const profileModelKey = `AX_FLUE_MODEL_${claimedProfile
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")}`;
    const model = process.env[profileModelKey] ?? defaultModel;
    const operation = {
      ...claimed.operation,
      repo_path: claimed.operation.repo_path,
    };
    if (
      operation.sandbox_mode === "workspace-write" &&
      (typeof operation.repo_path !== "string" ||
        !isAbsolute(operation.repo_path) ||
        !existsSync(operation.repo_path) ||
        !statSync(operation.repo_path).isDirectory())
    ) {
      throw new Error("workspace_repo_path_invalid");
    }
    const instructions = loadAgentInstructions(claimed.context ?? []);
    const root = resolve(import.meta.dirname, "../../workspace/flue");
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "flue",
        "run",
        "workflow:workspace-operation",
        "--target",
        "node",
        "--root",
        root,
        "--input",
        JSON.stringify({
          operation,
          context: claimed.context ?? [],
          instructions,
        }),
      ],
      {
        cwd: root,
        env: {
          ...workspaceRunnerEnvironment(process.env),
          AX_FLUE_MODEL: model,
          AX_WORKSPACE_REPO_PATH: String(operation.repo_path ?? process.cwd()),
          AX_WORKSPACE_SANDBOX_MODE: String(
            operation.sandbox_mode ?? "read-only",
          ),
        },
        encoding: "utf-8",
      },
    );
    if (result.status !== 0) throw new Error("flue_process_failed");
    const parsed = JSON.parse(result.stdout) as unknown;
    assertSchemaValid("workspaceResult", parsed);
    for (const mutation of (
      parsed as { record_mutations: Array<{ record?: unknown }> }
    ).record_mutations) {
      if (mutation.record)
        assertSchemaValid("workspaceRecord", mutation.record);
    }
    await request(
      connection,
      `/operations/${encodeURIComponent(String(operation.operation_id))}/complete`,
      {
        method: "POST",
        body: parsed,
        headers: { "x-ax-claim-token": claimed.claim_token },
      },
    );
    return {
      executed: true,
      operation_id: operation.operation_id,
      result: parsed,
    };
  } catch (error) {
    const reason =
      error instanceof Error && /^[a-z][a-z0-9_]+$/.test(error.message)
        ? error.message
        : "local_execution_failed";
    return settleFailure(
      connection,
      claimed.operation,
      claimed.claim_token,
      `Local Flue execution failed (${reason}).`,
    );
  }
}

async function settleFailure(
  connection: WorkspaceConnection,
  operation: Record<string, unknown>,
  claimToken: string,
  response: string,
): Promise<unknown> {
  const failed = {
    schema_version: 1,
    operation_id: String(operation.operation_id),
    workspace_generation: Number(operation.workspace_generation),
    state: "failed",
    response,
    checkpoints: [],
    record_mutations: [],
    messages: [],
    projection_record_ids: [],
  };
  assertSchemaValid("workspaceResult", failed);
  await request(
    connection,
    `/operations/${encodeURIComponent(String(operation.operation_id))}/complete`,
    {
      method: "POST",
      body: failed,
      headers: { "x-ax-claim-token": claimToken },
    },
  );
  return {
    executed: true,
    operation_id: operation.operation_id,
    result: failed,
  };
}

export function workspaceRunnerEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const allowed = [
    "ANTHROPIC_API_KEY",
    "AWS_ACCESS_KEY_ID",
    "AWS_DEFAULT_REGION",
    "AWS_PROFILE",
    "AWS_REGION",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "AZURE_OPENAI_API_KEY",
    "AZURE_OPENAI_ENDPOINT",
    "COHERE_API_KEY",
    "DEEPSEEK_API_KEY",
    "FIREWORKS_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GROQ_API_KEY",
    "HOME",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "LANG",
    "LC_ALL",
    "MISTRAL_API_KEY",
    "NODE_EXTRA_CA_CERTS",
    "NO_PROXY",
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "PATH",
    "PERPLEXITY_API_KEY",
    "SHELL",
    "SSL_CERT_FILE",
    "TERM",
    "TMPDIR",
    "TOGETHER_AI_API_KEY",
    "USER",
    "XAI_API_KEY",
  ];
  return Object.fromEntries(
    allowed.flatMap((name) =>
      source[name] === undefined ? [] : [[name, source[name]]],
    ),
  );
}

async function request(
  connection: WorkspaceConnection,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<unknown> {
  const headers = new Headers({ accept: "application/json" });
  const clientId = process.env.AX_WORKSPACE_ACCESS_CLIENT_ID;
  const clientSecret = process.env.AX_WORKSPACE_ACCESS_CLIENT_SECRET;
  if (Boolean(clientId) !== Boolean(clientSecret))
    throw new Error("workspace_access_service_token_incomplete");
  if (clientId && clientSecret) {
    headers.set("cf-access-client-id", clientId);
    headers.set("cf-access-client-secret", clientSecret);
  }
  if (process.env.AX_WORKSPACE_DEV_TOKEN) {
    headers.set("x-ax-dev-token", process.env.AX_WORKSPACE_DEV_TOKEN);
  }
  if (options.body !== undefined)
    headers.set("content-type", "application/json");
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }
  const response = await fetch(
    `${connection.url}/v1/workspaces/${encodeURIComponent(connection.workspace)}${path}`,
    {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    },
  );
  const body = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(body.error ?? `workspace_http_${response.status}`);
  return body;
}

function configure(
  url: string | undefined,
  workspace: string | undefined,
): void {
  if (!url || !workspace) throw new Error("workspace_configuration_invalid");
  const parsedUrl = new URL(url);
  if (
    parsedUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname)
  ) {
    throw new Error("workspace_url_requires_https");
  }
  const normalized = parsedUrl.toString().replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(workspace))
    throw new Error("workspace_key_invalid");
  const path = connectionPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify({ url: normalized, workspace }, null, 2)}\n`,
    { mode: 0o600 },
  );
  chmodSync(path, 0o600);
}

function readConnection(): WorkspaceConnection {
  const path = connectionPath();
  if (!existsSync(path))
    throw new Error(`workspace_not_configured: run ax workspace configure`);
  return JSON.parse(readFileSync(path, "utf-8")) as WorkspaceConnection;
}

function connectionPath(): string {
  return resolve(
    process.env.AX_WORKSPACE_CONFIG ?? `${homedir()}/.config/ax/workspace.json`,
  );
}

function readJsonFile(path: string | undefined): unknown {
  if (!path) throw new Error("workspace_file_required");
  return JSON.parse(readFileSync(resolve(path), "utf-8")) as unknown;
}

function messageText(input: WorkspaceCommandInput): string {
  if (input.message && input.file)
    throw new Error("workspace_message_source_conflict");
  const value = input.file
    ? readFileSync(resolve(input.file), "utf-8")
    : input.message;
  if (!value?.trim()) throw new Error("workspace_message_required");
  return value.trim();
}

function loadAgentInstructions(
  context: Array<Record<string, unknown>>,
): string {
  const identity =
    context.find((record) => record.record_type === "root") ??
    context.find((record) => record.record_type === "run");
  const roleId = String(identity?.agent_role ?? identity?.role_variant ?? "");
  const sourceRoot = resolve(import.meta.dirname, "../..");
  const manifest = JSON.parse(
    readFileSync(resolve(sourceRoot, "agents/manifest.json"), "utf-8"),
  ) as {
    roles: Array<{ id: string; charter: string; required_skills: string[] }>;
  };
  const role = manifest.roles.find(
    (candidate) =>
      candidate.id === roleId || roleId.startsWith(`${candidate.id}:`),
  );
  if (!role) throw new Error(`workspace_role_not_found: ${roleId}`);
  const requiredSkills = role.required_skills.map((skill) =>
    readFileSync(resolve(sourceRoot, "skills", skill, "SKILL.md"), "utf-8"),
  );
  return [
    readFileSync(resolve(sourceRoot, "agents/shared-contract.md"), "utf-8"),
    readFileSync(resolve(sourceRoot, "agents", role.charter), "utf-8"),
    ...requiredSkills,
  ].join("\n\n");
}

function print(value: unknown, structured?: boolean): void {
  if (structured) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (typeof value !== "object" || value === null) {
    console.log(String(value));
    return;
  }
  const entries = Object.entries(value).map(([key, item]) => {
    const rendered =
      typeof item === "object" && item !== null
        ? JSON.stringify(item, null, 2)
        : String(item);
    return `${key}: ${rendered}`;
  });
  console.log(entries.join("\n"));
}
