import assert from "node:assert/strict";
import test from "node:test";
import type { Command } from "commander";

import { createProgram } from "../../scripts/agent-runtime.ts";

type ParsedCommand = {
  scope?: string;
  command: string;
  skillsetName?: string;
  agentName?: string;
  harnessName?: string;
  configPath: string;
};

function parseCommand(args: string[]): ParsedCommand[] {
  const commands: ParsedCommand[] = [];
  const program = createProgram((input) => {
    commands.push(input);
  });
  configureProgramForTest(program);
  program.parse(["node", "agent-runtime", ...args], { from: "node" });
  return commands;
}

function parseInvalidCommand(args: string[]): Error {
  const program = createProgram(() => undefined);
  configureProgramForTest(program);

  try {
    program.parse(["node", "agent-runtime", ...args], { from: "node" });
  } catch (error) {
    assert.ok(error instanceof Error);
    return error;
  }
  assert.fail("Expected command parsing to fail");
}

function configureProgramForTest(command: Command): void {
  command.exitOverride();
  command.configureOutput({
    writeOut: () => undefined,
    writeErr: () => undefined,
  });
  for (const subcommand of command.commands) {
    configureProgramForTest(subcommand);
  }
}

test("Commander dispatches scoped skills commands", () => {
  const [parsed] = parseCommand(["skills", "validate", "--skillset", "work", "--config", "custom.json"]);

  assert.equal(parsed.scope, "skills");
  assert.equal(parsed.command, "validate");
  assert.equal(parsed.skillsetName, "work");
  assert.equal(parsed.configPath, "custom.json");
});

test("Commander dispatches scoped agent filters", () => {
  const [parsed] = parseCommand(["agents", "status", "--agent", "local-review", "--harness", "claude"]);

  assert.equal(parsed.scope, "agents");
  assert.equal(parsed.command, "status");
  assert.equal(parsed.agentName, "local-review");
  assert.equal(parsed.harnessName, "claude");
});

test("Commander dispatches top-level wrapper commands", () => {
  const [parsed] = parseCommand(["status", "--agent", "github-review", "--harness", "codex", "--skillset", "work"]);

  assert.equal(parsed.scope, undefined);
  assert.equal(parsed.command, "status");
  assert.equal(parsed.agentName, "github-review");
  assert.equal(parsed.harnessName, "codex");
  assert.equal(parsed.skillsetName, "work");
});

test("Commander rejects agent flags on skills commands", () => {
  const error = parseInvalidCommand(["skills", "status", "--agent", "local-review"]);

  assert.match(error.message, /unknown option '--agent'/);
});

test("Commander rejects skillset flags on agent commands", () => {
  const error = parseInvalidCommand(["agents", "status", "--skillset", "work"]);

  assert.match(error.message, /unknown option '--skillset'/);
});

test("Commander rejects skillset flags on instruction commands", () => {
  const error = parseInvalidCommand(["instructions", "validate", "--skillset", "work"]);

  assert.match(error.message, /unknown option '--skillset'/);
});
