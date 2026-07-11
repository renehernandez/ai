import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  executeWorkspaceCommand,
  workspaceRunnerEnvironment,
} from "../../scripts/ax/workspace-client.ts";

test("workspace configure stores only a secure non-secret connection", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "ax-workspace-client-"));
  const path = join(root, "workspace.json");
  const previous = process.env.AX_WORKSPACE_CONFIG;
  process.env.AX_WORKSPACE_CONFIG = path;
  t.mock.method(console, "log", () => undefined);
  try {
    await executeWorkspaceCommand({
      command: "configure",
      url: "https://workspace.example.com",
      workspace: "rene",
    });
    assert.deepEqual(JSON.parse(readFileSync(path, "utf-8")), {
      url: "https://workspace.example.com",
      workspace: "rene",
    });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    assert.doesNotMatch(
      readFileSync(path, "utf-8"),
      /client[_-]?secret|access[_-]?client/i,
    );
  } finally {
    if (previous === undefined) delete process.env.AX_WORKSPACE_CONFIG;
    else process.env.AX_WORKSPACE_CONFIG = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test("workspace configure requires HTTPS outside local development", async () => {
  await assert.rejects(
    executeWorkspaceCommand({
      command: "configure",
      url: "http://workspace.example.com",
      workspace: "rene",
    }),
    /workspace_url_requires_https/,
  );
});

test("workspace runner excludes provider-control credentials", () => {
  const environment = workspaceRunnerEnvironment({
    PATH: "/usr/bin",
    OPENAI_API_KEY: "model-secret",
    AX_WORKSPACE_ACCESS_CLIENT_SECRET: "access-secret",
    GITLAB_TOKEN: "provider-secret",
    LINEAR_API_KEY: "provider-secret",
  });
  assert.deepEqual(environment, {
    OPENAI_API_KEY: "model-secret",
    PATH: "/usr/bin",
  });
});
