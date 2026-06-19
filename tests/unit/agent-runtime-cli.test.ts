import assert from "node:assert/strict";
import test from "node:test";
import type { Command } from "commander";

import { createProgram } from "../../scripts/agent-runtime.ts";

type ParsedCommand = {
  scope?: string;
  command: string;
  agentName?: string;
  profileNames?: string[];
  allProfiles?: boolean;
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
  const [parsed] = parseCommand([
    "skills",
    "validate",
    "--profile",
    "work",
    "--config",
    "custom.json",
  ]);

  assert.equal(parsed.scope, "skills");
  assert.equal(parsed.command, "validate");
  assert.deepEqual(parsed.profileNames, ["work"]);
  assert.equal(parsed.configPath, "custom.json");
});

test("Commander dispatches scoped agent filters", () => {
  const [parsed] = parseCommand([
    "agents",
    "status",
    "--agent",
    "implementation-review-agent",
  ]);

  assert.equal(parsed.scope, "agents");
  assert.equal(parsed.command, "status");
  assert.equal(parsed.agentName, "implementation-review-agent");
});

test("Commander dispatches top-level wrapper commands", () => {
  const [parsed] = parseCommand([
    "status",
    "--agent",
    "github-review-agent",
    "--profile",
    "personal",
  ]);

  assert.equal(parsed.scope, undefined);
  assert.equal(parsed.command, "status");
  assert.equal(parsed.agentName, "github-review-agent");
  assert.deepEqual(parsed.profileNames, ["personal"]);
});

test("Commander dispatches all selection flags", () => {
  const [parsed] = parseCommand(["install", "--all-profiles"]);

  assert.equal(parsed.command, "install");
  assert.equal(parsed.allProfiles, true);
});

test("Commander rejects agent flags on skills commands", () => {
  const error = parseInvalidCommand([
    "skills",
    "status",
    "--agent",
    "implementation-review-agent",
  ]);

  assert.match(error.message, /unknown option '--agent'/);
});

test("Commander rejects removed skillset flags", () => {
  const error = parseInvalidCommand(["status", "--skillset", "work"]);

  assert.match(error.message, /unknown option '--skillset'/);
});

test("Commander rejects removed harness flags", () => {
  const error = parseInvalidCommand([
    "agents",
    "status",
    "--harness",
    "claude",
  ]);

  assert.match(error.message, /unknown option '--harness'/);
});
