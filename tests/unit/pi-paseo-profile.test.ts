import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = JSON.parse(readFileSync("ax.config.json", "utf8"));

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
  const limit = entries.find((entry) => entry.path.at(-1) === "maxTokens");
  assert.equal(limit.value, 32768);
  assert.ok(limit.path.includes("workers-ai/@cf/zai-org/glm-5.3"));
  for (const tool of Object.values(config.runtime.configs)) {
    assert.notEqual(tool.target, "~/.pi/agent/auth.json");
  }
});
