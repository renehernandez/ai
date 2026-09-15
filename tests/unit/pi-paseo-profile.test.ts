import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("ax.config.json", "utf8"));

test("DeepSeek reviewer pins V4 Flash with a bounded output and medium reasoning effort", () => {
  const entries = config.runtime.configs.paseo.managedPaths;
  const reviewer = entries.find(
    (entry) => entry.path.join(".") === "agents.providers.ax-review-deepseek",
  );
  assert.ok(reviewer);
  assert.equal(
    reviewer.value.command[4],
    "workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731",
  );
  assert.equal(reviewer.value.command[5], "medium");
  const overrides = config.runtime.configs.piModels.managedPaths.filter(
    (entry) =>
      entry.path.includes("workers-ai/@cf/deepseek-ai/deepseek-v4-flash-0731"),
  );
  assert.equal(
    overrides.find((entry) => entry.path.at(-1) === "maxTokens")?.value,
    32768,
  );
  assert.equal(
    overrides.find((entry) => entry.path.at(-1) === "supportsReasoningEffort")
      ?.value,
    true,
  );
  const workflow = readFileSync(
    "skills/handoff-brief/scripts/paseo-workflow-state.ts",
    "utf8",
  );
  assert.match(workflow, /planning: \["review-glm", "review-deepseek"\]/);
  assert.match(
    workflow,
    /implementation: \["review-glm", "review-deepseek", "review-astra"\]/,
  );
  assert.doesNotMatch(JSON.stringify(config), /kimi-k3|deepseek-v4-pro/);
});

test("Paseo hosted relay is explicit and keeps pairing identity machine-local", () => {
  const relay = Object.fromEntries(
    config.runtime.configs.paseo.managedPaths
      .filter((entry) => entry.path.slice(0, 2).join(".") === "daemon.relay")
      .map((entry) => [entry.path[2], entry.value]),
  );
  assert.deepEqual(relay, {
    enabled: true,
    endpoint: "relay.paseo.sh:443",
    publicEndpoint: "relay.paseo.sh:443",
    useTls: true,
    publicUseTls: true,
  });
  assert.ok(
    Object.values(config.runtime.configs).every(
      (tool) => !tool.target.includes("daemon-keypair"),
    ),
  );
});

test("Pi and Paseo roles are configured without a model selection step", () => {
  const entries = config.runtime.configs.paseo.managedPaths;
  const providers = entries.filter(
    (entry) => entry.path.slice(0, 2).join(".") === "agents.providers",
  );
  assert.equal(providers.length, 5);
  for (const entry of providers) {
    const provider = entry.value;
    assert.equal(provider.extends, "pi");
    assert.equal(provider.models.length, 1);
    assert.equal(provider.command[1], "~/.agents/hooks/pi/launch.ts");
    assert.equal(
      `${provider.command[3]}/${provider.command[4]}`,
      provider.models[0].id,
    );
    assert.equal(provider.command[5], provider.models[0].thinkingOptions[0].id);
    assert.equal(entry.expandHome, true);
  }
  assert.ok(config.runtime.skillSymlinkTargets.includes("~/.pi/agent/skills"));
  assert.equal(config.runtime.instructionSymlinkTargets.pi, "~/.pi/agent");
});

test("Pi model overrides correct the live Gateway limit without managing credentials", () => {
  const entries = config.runtime.configs.piModels.managedPaths;
  const limit = entries.find(
    (entry) =>
      entry.path.at(-1) === "maxTokens" &&
      entry.path.includes("workers-ai/@cf/zai-org/glm-5.3"),
  );
  assert.equal(limit.value, 32768);
  assert.ok(limit.path.includes("workers-ai/@cf/zai-org/glm-5.3"));
  for (const tool of Object.values(config.runtime.configs)) {
    assert.notEqual(tool.target, "~/.pi/agent/auth.json");
  }
});
