import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  launchArguments,
  launchEnvironment,
  readRoutes,
} from "../../hooks/pi/launch.ts";

const config = JSON.parse(readFileSync("ax.config.json", "utf8"));
const routes = readRoutes();

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
    ["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-2"],
  );
  assert.deepEqual(
    Object.entries(routes)
      .filter(
        ([role]) => role.startsWith("review-") && role !== "review-deepseek",
      )
      .map(([role, route]) => [role, route.label, route.routes]),
    [
      [
        "review-correctness",
        "Sol · Correctness Review",
        ["openai-codex/gpt-6.1-sol:medium"],
      ],
      [
        "review-quality",
        "Sonnet · Risk & Quality Review",
        ["claude-bridge/claude-sonnet-5-5:medium"],
      ],
      [
        "review-architecture",
        "Terra · Architecture Review",
        ["openai-codex/gpt-6.1-terra:medium"],
      ],
      [
        "review-contract",
        "Sonnet · Contract Review",
        ["claude-bridge/claude-sonnet-5-5:medium"],
      ],
    ],
  );

  const launch = launchArguments([
    "implementer",
    "claude-bridge",
    "claude-opus-5-5",
    "medium",
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

test("Astra and Fable consult planners have fixed medium routes", () => {
  assert.deepEqual(routes["planner-astra"], {
    label: "Astra · Consult Planner",
    routes: ["openai-codex/gpt-6-astra:medium"],
  });
  assert.deepEqual(routes["planner-fable"], {
    label: "Fable · Consult Planner",
    routes: ["claude-bridge/claude-fable-5-2:medium"],
  });
});

test("one Orchestrator route offers Opus and Astra while worker roles keep one fixed model", () => {
  const [first, ...workers] = Object.entries(routes);
  assert.deepEqual(first, [
    "orchestrator",
    {
      label: "Orchestrator",
      routes: [
        "claude-bridge/claude-opus-5-5:medium",
        "openai-codex/gpt-6-astra:medium",
      ],
    },
  ]);
  assert.equal(workers.length, 8);
  for (const [, route] of workers) {
    assert.equal(route.routes.length, 1);
    assert.match(route.routes[0], /^[^/]+\/.+:medium$/u);
  }
  assert.ok(config.runtime.skillSymlinkTargets.includes("~/.pi/agent/skills"));
  assert.equal(config.runtime.instructionSymlinkTargets.pi, "~/.pi/agent");
});

test("AX manages no Paseo config target or relay identity", () => {
  assert.equal(config.runtime.configs.paseo, undefined);
  assert.ok(
    Object.values(config.runtime.configs).every(
      (tool) => !tool.target.includes(".paseo"),
    ),
  );
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
