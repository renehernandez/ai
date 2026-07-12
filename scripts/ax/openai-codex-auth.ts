import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { stdin as input, stderr as output } from "node:process";
import { createInterface } from "node:readline/promises";
import {
  type Credential,
  type CredentialStore,
  createModels,
} from "@earendil-works/pi-ai";
import { openaiCodexProvider } from "@earendil-works/pi-ai/providers/openai-codex";
import type { Command } from "commander";
import { writeJsonAtomic } from "./json-state.ts";
import { subscriptionHostEnvironment } from "./model-runner-environment.ts";
import {
  acquireMutationLock,
  releaseMutationLock,
} from "./transaction-engine.ts";

const PROVIDER_ID = "openai-codex";
const DEFAULT_AUTH_MODEL = "openai-codex/gpt-5.4";
const DEFAULT_TEST_MODEL = "openai-codex/gpt-5.6-sol";
const LOCK_TIMEOUT_MS = 10_000;
const LOCK_RETRY_MS = 50;
const THINKING_LEVELS = ["minimal", "low", "medium", "high", "xhigh"] as const;

type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export type AuthCommandInput = {
  command: "login" | "logout" | "status" | "test";
  provider: string;
  deviceCode?: boolean;
  model?: string;
  reasoning?: string;
  json?: boolean;
};

export type AuthExecutor = (input: AuthCommandInput) => void | Promise<void>;

type StoredCredentials = {
  version: 1;
  credentials: Record<string, Credential>;
};

type SpawnResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type AuthDependencies = {
  store?: CredentialStore;
  resolveAccessToken?: (options: {
    store: CredentialStore;
    model: string;
  }) => Promise<string>;
  spawnFlue?: (options: {
    model: string;
    reasoning: ThinkingLevel;
    nonce: string;
    accessToken: string;
  }) => SpawnResult;
  prompt?: (prompt: {
    type: "text" | "secret" | "select" | "manual_code";
    message: string;
    options?: readonly { id: string; label: string }[];
    signal?: AbortSignal;
  }) => Promise<string>;
  notify?: (message: string) => void;
};

export function addAuthCommands(program: Command, execute: AuthExecutor): void {
  const auth = program
    .command("auth")
    .description("Manage AX model authentication");
  auth
    .command("login <provider>")
    .description("Authenticate a model provider")
    .option("--device-code", "Use the headless device-code OAuth flow")
    .option("--json", "Emit structured JSON")
    .action(
      (
        provider: string,
        options: Omit<AuthCommandInput, "command" | "provider">,
      ) => execute({ command: "login", provider, ...options }),
    );
  auth
    .command("status <provider>")
    .description("Inspect stored provider authentication without refreshing it")
    .option("--json", "Emit structured JSON")
    .action(
      (
        provider: string,
        options: Omit<AuthCommandInput, "command" | "provider">,
      ) => execute({ command: "status", provider, ...options }),
    );
  auth
    .command("logout <provider>")
    .description("Delete locally stored provider authentication")
    .option("--json", "Emit structured JSON")
    .action(
      (
        provider: string,
        options: Omit<AuthCommandInput, "command" | "provider">,
      ) => execute({ command: "logout", provider, ...options }),
    );
  auth
    .command("test <provider>")
    .description("Run a live provider request through the pinned Flue beta")
    .option("--model <provider/model>", "Model to exercise", DEFAULT_TEST_MODEL)
    .option("--reasoning <level>", "Reasoning effort", "low")
    .option("--json", "Emit structured JSON")
    .action(
      (
        provider: string,
        options: Omit<AuthCommandInput, "command" | "provider">,
      ) => execute({ command: "test", provider, ...options }),
    );
}

export async function executeAuthCommand(
  command: AuthCommandInput,
  dependencies: AuthDependencies = {},
): Promise<void> {
  assertProvider(command.provider);
  const store = dependencies.store ?? new FileCredentialStore();
  if (command.command === "logout") {
    await store.delete(PROVIDER_ID);
    printAuthResult(
      { authenticated: false, provider: PROVIDER_ID },
      command.json,
    );
    return;
  }
  if (command.command === "status") {
    const credential = await store.read(PROVIDER_ID);
    printAuthResult(statusResult(credential), command.json);
    return;
  }
  if (command.command === "login") {
    const provider = openaiCodexProvider();
    const oauth = provider.auth.oauth;
    if (!oauth) throw new Error("openai_codex_oauth_unavailable");
    const prompt = dependencies.prompt ?? interactivePrompt;
    const notify =
      dependencies.notify ?? ((message: string) => console.error(message));
    const credential = await oauth.login({
      prompt: async (request) => {
        if (request.type === "select") {
          return command.deviceCode ? "device_code" : "browser";
        }
        return prompt(request);
      },
      notify: (event) => {
        if (event.type === "auth_url") {
          notify(`Open this URL to authenticate:\n${event.url}`);
        } else if (event.type === "device_code") {
          notify(
            `Open ${event.verificationUri} and enter code ${event.userCode}`,
          );
        } else {
          notify(event.message);
        }
      },
    });
    await store.modify(PROVIDER_ID, async () => credential);
    printAuthResult(statusResult(credential), command.json);
    return;
  }

  const model = command.model ?? DEFAULT_TEST_MODEL;
  const reasoning = parseThinkingLevel(command.reasoning ?? "low");
  const resolveAccessToken =
    dependencies.resolveAccessToken ?? resolveOpenAICodexAccessToken;
  const accessToken = await resolveAccessToken({
    store,
    model,
  });
  const nonce = `AX_PI_OAUTH_SMOKE_${randomUUID()}`;
  const spawnFlue = dependencies.spawnFlue ?? runFlueSmoke;
  const result = spawnFlue({ model, reasoning, nonce, accessToken });
  if (result.status !== 0) {
    throw new Error("flue_subscription_test_failed");
  }
  const parsed = JSON.parse(result.stdout) as { nonce?: unknown };
  if (parsed.nonce !== nonce)
    throw new Error("flue_subscription_nonce_mismatch");
  printAuthResult(
    {
      authenticated: true,
      provider: PROVIDER_ID,
      auth_source: "OAuth",
      model,
      reasoning,
      flue_version: "1.0.0-beta.9",
      credential_persisted: true,
      response_received: true,
      result: "PASS",
    },
    command.json,
  );
}

export class FileCredentialStore implements CredentialStore {
  readonly path: string;

  constructor(path = credentialsPath()) {
    this.path = resolve(path);
  }

  async read(providerId: string): Promise<Credential | undefined> {
    return readStoredCredentials(this.path).credentials[providerId];
  }

  async modify(
    providerId: string,
    mutate: (
      current: Credential | undefined,
    ) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined> {
    return withCredentialLock(this.path, async () => {
      const stored = readStoredCredentials(this.path);
      const next = await mutate(stored.credentials[providerId]);
      if (next === undefined) return stored.credentials[providerId];
      stored.credentials[providerId] = next;
      writeStoredCredentials(this.path, stored);
      return next;
    });
  }

  async delete(providerId: string): Promise<void> {
    await withCredentialLock(this.path, async () => {
      const stored = readStoredCredentials(this.path);
      delete stored.credentials[providerId];
      writeStoredCredentials(this.path, stored);
    });
  }
}

export async function resolveOpenAICodexAccessToken(
  options: { store?: CredentialStore; model?: string } = {},
): Promise<string> {
  const store = options.store ?? new FileCredentialStore();
  const provider = openaiCodexProvider();
  const models = createModels({ credentials: store });
  models.setProvider(provider);
  const { modelId } = parseModelSpecifier(options.model ?? DEFAULT_AUTH_MODEL);
  const authModel =
    models.getModel(PROVIDER_ID, modelId) ?? models.getModels(PROVIDER_ID)[0];
  if (!authModel) throw new Error("openai_codex_auth_model_unavailable");
  const resolved = await models.getAuth(authModel);
  const accessToken = resolved?.auth.apiKey;
  if (!accessToken || resolved.source !== "OAuth")
    throw new Error("openai_codex_not_authenticated");
  return accessToken;
}

function runFlueSmoke(options: {
  model: string;
  reasoning: ThinkingLevel;
  nonce: string;
  accessToken: string;
}): SpawnResult {
  const root = resolve(import.meta.dirname, "../../workspace/flue");
  const environment = subscriptionRunnerEnvironment(
    process.env,
    options.accessToken,
  );
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "flue",
      "run",
      "workflow:provider-smoke",
      "--target",
      "node",
      "--root",
      root,
      "--input",
      JSON.stringify({ nonce: options.nonce }),
    ],
    {
      cwd: root,
      env: {
        ...environment,
        AX_FLUE_MODEL: options.model,
        AX_FLUE_REASONING: options.reasoning,
      },
      encoding: "utf-8",
    },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export function subscriptionRunnerEnvironment(
  source: NodeJS.ProcessEnv,
  accessToken: string,
): NodeJS.ProcessEnv {
  const environment = subscriptionHostEnvironment(source);
  environment.AX_OPENAI_CODEX_ACCESS_TOKEN = accessToken;
  return environment;
}

function credentialsPath(): string {
  return resolve(
    process.env.AX_CREDENTIALS_FILE ??
      `${homedir()}/.config/ax/credentials.json`,
  );
}

function readStoredCredentials(path: string): StoredCredentials {
  if (!existsSync(path)) return { version: 1, credentials: {} };
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as unknown;
  if (!isStoredCredentials(parsed)) throw new Error("ax_credentials_invalid");
  return parsed;
}

function writeStoredCredentials(path: string, stored: StoredCredentials): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeJsonAtomic(path, stored);
  chmodSync(path, 0o600);
}

async function withCredentialLock<T>(
  path: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = `${path}.mutation.lock`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const started = Date.now();
  let lock: ReturnType<typeof acquireMutationLock>;
  while (true) {
    try {
      lock = acquireMutationLock(lockPath, "ax-credentials", dirname(path));
      break;
    } catch (error) {
      if (!isMutationLockContention(error)) throw error;
      if (Date.now() - started >= LOCK_TIMEOUT_MS)
        throw new Error("ax_credentials_lock_timeout");
      await delay(LOCK_RETRY_MS);
    }
  }
  try {
    return await operation();
  } finally {
    releaseMutationLock(lockPath, lock);
  }
}

function isStoredCredentials(value: unknown): value is StoredCredentials {
  if (!value || typeof value !== "object") return false;
  const record = value as { version?: unknown; credentials?: unknown };
  if (
    record.version !== 1 ||
    !record.credentials ||
    typeof record.credentials !== "object"
  )
    return false;
  return Object.values(record.credentials).every(isCredential);
}

function isCredential(value: unknown): value is Credential {
  if (!value || typeof value !== "object") return false;
  const credential = value as Record<string, unknown>;
  if (credential.type === "api_key") {
    return credential.key === undefined || typeof credential.key === "string";
  }
  return (
    credential.type === "oauth" &&
    typeof credential.access === "string" &&
    typeof credential.refresh === "string" &&
    typeof credential.expires === "number" &&
    Number.isFinite(credential.expires)
  );
}

function statusResult(
  credential: Credential | undefined,
): Record<string, unknown> {
  if (!credential) return { authenticated: false, provider: PROVIDER_ID };
  if (credential.type !== "oauth")
    throw new Error("openai_codex_credential_type_invalid");
  return {
    authenticated: true,
    provider: PROVIDER_ID,
    auth_source: "OAuth",
    ...(typeof credential.accountId === "string"
      ? { account_id: credential.accountId }
      : {}),
    expires_at: new Date(credential.expires).toISOString(),
    expired: credential.expires <= Date.now(),
  };
}

async function interactivePrompt(request: {
  type: "text" | "secret" | "select" | "manual_code";
  message: string;
  options?: readonly { id: string; label: string }[];
  signal?: AbortSignal;
}): Promise<string> {
  if (request.type === "select") return request.options?.[0]?.id ?? "";
  const terminal = createInterface({ input, output });
  try {
    return await terminal.question(`${request.message} `, {
      signal: request.signal,
    });
  } finally {
    terminal.close();
  }
}

function parseThinkingLevel(value: string): ThinkingLevel {
  if ((THINKING_LEVELS as readonly string[]).includes(value))
    return value as ThinkingLevel;
  throw new Error(`openai_codex_reasoning_invalid: ${value}`);
}

function parseModelSpecifier(value: string): {
  providerId: string;
  modelId: string;
} {
  const separator = value.indexOf("/");
  if (separator <= 0 || separator === value.length - 1)
    throw new Error("openai_codex_model_invalid");
  const providerId = value.slice(0, separator);
  const modelId = value.slice(separator + 1);
  if (providerId !== PROVIDER_ID)
    throw new Error(`openai_codex_model_provider_invalid: ${providerId}`);
  return { providerId, modelId };
}

function assertProvider(provider: string): void {
  if (provider !== PROVIDER_ID)
    throw new Error(`auth_provider_unsupported: ${provider}`);
}

function printAuthResult(
  value: Record<string, unknown>,
  structured?: boolean,
): void {
  if (structured) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  console.log(
    Object.entries(value)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join("\n"),
  );
}

function isMutationLockContention(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^(mutation_lock_active|mutation_lock_reclaim_active|mutation_lock_contention):/.test(
      error.message,
    )
  );
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
