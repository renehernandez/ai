import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { CredentialStore } from "@earendil-works/pi-ai";
import { local } from "@flue/runtime/node";
import {
  executeAuthCommand,
  FileCredentialStore,
  resolveOpenAICodexAccessToken,
  subscriptionRunnerEnvironment,
} from "../../scripts/ax/openai-codex-auth.ts";

test("credential store persists private credentials and serializes modifications", async () => {
  const root = mkdtempSync(join(tmpdir(), "ax-openai-codex-auth-"));
  const path = join(root, "credentials.json");
  const store = new FileCredentialStore(path);
  try {
    await store.modify("counter", async () => ({ type: "api_key", key: "0" }));
    await Promise.all(
      Array.from({ length: 20 }, () =>
        store.modify("counter", async (current) => ({
          type: "api_key",
          key: String(
            Number(current?.type === "api_key" ? current.key : "0") + 1,
          ),
        })),
      ),
    );
    assert.deepEqual(await store.read("counter"), {
      type: "api_key",
      key: "20",
    });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.doesNotMatch(
      readFileSync(path, "utf-8"),
      /OPENAI_API_KEY|CODEX_HOME/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("subscription runner removes API and Codex credentials", () => {
  assert.deepEqual(
    subscriptionRunnerEnvironment(
      {
        PATH: "/usr/bin",
        OPENAI_API_KEY: "api-secret",
        CODEX_API_KEY: "codex-secret",
        CODEX_HOME: "/secret/codex",
        FLUE_OPENAI_CODEX_AUTH_JSON: "copied-secret",
        GITLAB_TOKEN: "provider-secret",
        ANTHROPIC_API_KEY: "other-model-secret",
      },
      "oauth-secret",
    ),
    {
      PATH: "/usr/bin",
      AX_OPENAI_CODEX_ACCESS_TOKEN: "oauth-secret",
    },
  );
});

test("pinned Flue local sandbox does not inherit the subscription token", async () => {
  const previous = process.env.AX_OPENAI_CODEX_ACCESS_TOKEN;
  process.env.AX_OPENAI_CODEX_ACCESS_TOKEN = "host-oauth-secret";
  try {
    const sandbox = local();
    const session = await sandbox.createSessionEnv({ id: "token-isolation" });
    const result = await session.exec(
      'if [ -z "$AX_OPENAI_CODEX_ACCESS_TOKEN" ]; then printf absent; else printf present; fi',
    );
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "absent");
    assert.doesNotMatch(result.stderr, /host-oauth-secret/);
  } finally {
    if (previous === undefined) {
      delete process.env.AX_OPENAI_CODEX_ACCESS_TOKEN;
    } else {
      process.env.AX_OPENAI_CODEX_ACCESS_TOKEN = previous;
    }
  }
});

test("auth status never prints stored tokens", async (t) => {
  const messages: string[] = [];
  t.mock.method(console, "log", (message: string) => messages.push(message));
  const store = memoryStore({
    type: "oauth",
    access: "access-secret",
    refresh: "refresh-secret",
    expires: Date.now() + 60_000,
  });
  await executeAuthCommand(
    { command: "status", provider: "openai-codex", json: true },
    { store },
  );
  const rendered = messages.join("\n");
  assert.match(rendered, /"authenticated": true/);
  assert.doesNotMatch(rendered, /access-secret|refresh-secret/);
});

test("auth logout removes the local credential", async (t) => {
  const messages: string[] = [];
  t.mock.method(console, "log", (message: string) => messages.push(message));
  const store = memoryStore({
    type: "oauth",
    access: "access-secret",
    refresh: "refresh-secret",
    expires: Date.now() + 60_000,
  });
  await executeAuthCommand(
    { command: "logout", provider: "openai-codex", json: true },
    { store },
  );
  assert.equal(await store.read("openai-codex"), undefined);
  assert.match(messages.join("\n"), /"authenticated": false/);
});

test("valid OAuth resolves for a model newer than Pi's catalog without refreshing", async () => {
  const credential = {
    type: "oauth" as const,
    access: "current-access-token",
    refresh: "unused-refresh-token",
    expires: Date.now() + 60_000,
  };
  const store: CredentialStore = {
    async read() {
      return credential;
    },
    async modify() {
      throw new Error("valid credentials must not be refreshed");
    },
    async delete() {},
  };

  assert.equal(
    await resolveOpenAICodexAccessToken({
      store,
      model: "openai-codex/gpt-5.6-sol",
    }),
    "current-access-token",
  );
});

test("auth test reports the pinned Flue beta after a nonce round trip", async (t) => {
  const messages: string[] = [];
  t.mock.method(console, "log", (message: string) => messages.push(message));
  await executeAuthCommand(
    {
      command: "test",
      provider: "openai-codex",
      model: "openai-codex/gpt-5.6-sol",
      reasoning: "high",
      json: true,
    },
    {
      store: memoryStore(),
      resolveAccessToken: async ({ model }) => {
        assert.equal(model, "openai-codex/gpt-5.6-sol");
        return "oauth-secret";
      },
      spawnFlue: ({ nonce, accessToken, reasoning }) => {
        assert.equal(accessToken, "oauth-secret");
        assert.equal(reasoning, "high");
        return { status: 0, stdout: JSON.stringify({ nonce }), stderr: "" };
      },
    },
  );
  const rendered = messages.join("\n");
  assert.match(rendered, /"result": "PASS"/);
  assert.match(rendered, /"flue_version": "1.0.0-beta.9"/);
  assert.doesNotMatch(rendered, /oauth-secret/);
});

function memoryStore(
  initial?: Awaited<ReturnType<CredentialStore["read"]>>,
): CredentialStore {
  let credential = initial;
  return {
    async read() {
      return credential;
    },
    async modify(_providerId, mutate) {
      credential = (await mutate(credential)) ?? credential;
      return credential;
    },
    async delete() {
      credential = undefined;
    },
  };
}
