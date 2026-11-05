import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { launchArguments, launchEnvironment } from "../../hooks/pi/launch.ts";

const config = JSON.parse(readFileSync("ax.config.json", "utf8"));

const reviewRoutes = [
  [
    "ax-review-correctness",
    "Sol · Correctness Review",
    "openai-codex/gpt-6.1-sol",
  ],
  [
    "ax-review-quality",
    "Sonnet · Risk & Quality Review",
    "claude-bridge/claude-sonnet-5-5",
  ],
  [
    "ax-review-architecture",
    "Terra · Architecture Review",
    "openai-codex/gpt-6.1-terra",
  ],
  [
    "ax-review-contract",
    "Sonnet · Contract Review",
    "claude-bridge/claude-sonnet-5-5",
  ],
];

test("Opus is the subscription-backed default and four focused reviewers span Sol, Sonnet, and Terra", () => {
  const pi = Object.fromEntries(
    config.runtime.configs.pi.managedPaths.map((entry) => [
      entry.path.join("."),
      entry.value,
    ]),
  );
  assert.equal(pi.defaultProvider, "claude-bridge");
  assert.equal(pi.defaultModel, "claude-opus-5-5");
  assert.equal(pi.defaultThinkingLevel, "medium");
  assert.equal(pi.packages, "npm:pi-claude-bridge@0.9.3");
  const bridge = config.runtime.configs.piClaudeBridge.managedPaths;
  assert.equal(
    bridge.find((entry) => entry.path.join(".") === "askClaude.enabled")?.value,
    false,
  );
  assert.equal(
    bridge.find(
      (entry) => entry.path.join(".") === "provider.longContextExtraUsage",
    )?.value,
    false,
  );
  assert.deepEqual(
    bridge.find((entry) => entry.path.join(".") === "provider.forceTwoHundredK")
      ?.value,
    ["claude-opus-5-5", "claude-sonnet-5-5"],
  );
  const profiles = config.runtime.configs.paseo.managedPaths.find(
    (entry) => entry.path.join(".") === "daemon.agentProfiles",
  ).value;
  assert.deepEqual(
    profiles
      .filter((profile) => profile.name.includes("Review"))
      .map((profile) => [
        profile.id,
        profile.name,
        profile.model,
        profile.provider === profile.id && profile.thinkingOptionId,
      ]),
    reviewRoutes.map((route) => [...route, "medium"]),
  );
  const providers = Object.fromEntries(
    config.runtime.configs.paseo.managedPaths
      .filter(
        (entry) => entry.path.slice(0, 2).join(".") === "agents.providers",
      )
      .map((entry) => [entry.path[2], entry.value]),
  );
  for (const [id, label, model] of reviewRoutes) {
    const provider = providers[id];
    assert.equal(provider.label, label);
    assert.deepEqual(provider.command.slice(2), [
      id.slice(3),
      ...model.split("/"),
      "medium",
    ]);
    assert.deepEqual(provider.paseoTools, { enabled: false });
  }
  const orchestrators = profiles.filter(
    (profile) => !/Review|Implement/u.test(profile.name),
  );
  assert.deepEqual(orchestrators, [
    {
      id: "ax-orchestrator",
      name: "Orchestrator",
      provider: "ax-orchestrator",
      model: "claude-bridge/claude-opus-5-5",
      thinkingOptionId: "medium",
    },
  ]);

  const launch = launchArguments([
    "implementer",
    "claude-bridge",
    "claude-opus-5-5",
    "medium",
    "--mode",
    "rpc",
  ]);
  assert.ok(launch.args.includes("npm:pi-claude-bridge@0.9.3"));
  assert.ok(launch.args.includes("--no-extensions"));
  const env = launchEnvironment("claude-bridge", {
    ANTHROPIC_API_KEY: "secret",
    ANTHROPIC_BASE_URL: "https://gateway.example",
    CLAUDE_CODE_USE_BEDROCK: "1",
    SAFE: "kept",
  });
  assert.equal(env.SAFE, "kept");
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_BASE_URL, undefined);
  assert.equal(env.CLAUDE_CODE_USE_BEDROCK, undefined);
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

test("one Orchestrator profile offers Opus and Astra while worker roles keep one fixed model", () => {
  const entries = config.runtime.configs.paseo.managedPaths;
  const providers = entries.filter(
    (entry) => entry.path.slice(0, 2).join(".") === "agents.providers",
  );
  assert.equal(providers.length, 7);
  const [orchestrator, ...workers] = providers;
  assert.deepEqual(orchestrator.path, [
    "agents",
    "providers",
    "ax-orchestrator",
  ]);
  assert.equal(orchestrator.value.label, "Orchestrator");
  assert.deepEqual(orchestrator.value.command.slice(1), [
    "~/.agents/hooks/pi/launch.ts",
    "orchestrator",
    "claude-bridge/claude-opus-5-5:medium",
    "openai-codex/gpt-6-astra:medium",
  ]);
  assert.deepEqual(
    orchestrator.value.models.map((model) => [
      model.id,
      model.isDefault === true,
      model.thinkingOptions.map((option) => option.id),
    ]),
    [
      ["claude-bridge/claude-opus-5-5", true, ["medium"]],
      ["openai-codex/gpt-6-astra", false, ["medium"]],
    ],
  );
  for (const entry of workers) {
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
  assert.equal(orchestrator.expandHome, true);
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
