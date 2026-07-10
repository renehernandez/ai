import assert from "node:assert/strict";
import test from "node:test";
import type { Command } from "commander";
import { createProgram } from "../../scripts/ax.ts";

type Parsed = {
  scope?: string;
  command: string;
  configPath: string;
  runtimeRoot?: string;
  profileNames?: string[];
  allProfiles?: boolean;
  policyProfile?: string;
  profileSelectionFile?: string;
  adoptionFile?: string;
  recoveryFile?: string;
  contextFile?: string;
};

function parse(args: string[]): Parsed[] {
  const parsed: Parsed[] = [];
  const program = createProgram((input) => parsed.push(input));
  configure(program);
  program.parse(["node", "ax", ...args], { from: "node" });
  return parsed;
}

function parseError(args: string[]): Error {
  const program = createProgram(() => undefined);
  configure(program);
  try {
    program.parse(["node", "ax", ...args], { from: "node" });
  } catch (error) {
    assert.ok(error instanceof Error);
    return error;
  }
  assert.fail("Expected command parsing to fail");
}

function configure(command: Command): void {
  command.exitOverride();
  command.configureOutput({
    writeOut: () => undefined,
    writeErr: () => undefined,
  });
  for (const child of command.commands) {
    configure(child);
  }
}

test("AX exposes sync/status/validate surfaces and keeps workflow commands absent", () => {
  const program = createProgram(() => undefined);
  const help = program.helpInformation();
  assert.match(help, /sync/);
  assert.match(help, /status/);
  assert.match(help, /validate/);
  assert.doesNotMatch(help, /\binstall\b/);
  assert.doesNotMatch(help, /\bupdate\b/);
  assert.doesNotMatch(help, /\bcommit\b/);
  assert.doesNotMatch(help, /review-gate/);
  assert.doesNotMatch(help, /plans artifact/);
});

test("top-level sync parses first and later selection/recovery inputs", () => {
  const [parsed] = parse([
    "--config",
    "/tmp/config.json",
    "--runtime-root",
    "/tmp/runtime",
    "sync",
    "--profile",
    "personal",
    "--profile",
    "work",
    "--policy-profile",
    "work",
    "--profile-selection-file",
    "/tmp/selection.json",
    "--adoption-file",
    "/tmp/adoption.json",
    "--recovery-file",
    "/tmp/recovery.json",
  ]);
  assert.equal(parsed.command, "sync");
  assert.equal(parsed.scope, undefined);
  assert.deepEqual(parsed.profileNames, ["personal", "work"]);
  assert.equal(parsed.policyProfile, "work");
  assert.equal(parsed.runtimeRoot, "/tmp/runtime");
  assert.equal(parsed.profileSelectionFile, "/tmp/selection.json");
  assert.equal(parsed.adoptionFile, "/tmp/adoption.json");
  assert.equal(parsed.recoveryFile, "/tmp/recovery.json");
});

test("scoped runtime sync does not expose profile-selection flags", () => {
  const error = parseError(["skills", "sync", "--profile", "personal"]);
  assert.match(error.message, /unknown option '--profile'/);
  const [parsed] = parse([
    "instructions",
    "sync",
    "--adoption-file",
    "/tmp/adopt.json",
  ]);
  assert.equal(parsed.scope, "instructions");
  assert.equal(parsed.command, "sync");
});

test("OpenSpec sync parses convergence and config-review inputs", () => {
  const [parsed] = parse([
    "openspec",
    "sync",
    "--context-file",
    "/tmp/context.md",
    "--review-config",
    "--accept-config-changes",
    "--recovery-file",
    "/tmp/recovery.json",
  ]);
  assert.equal(parsed.scope, "openspec");
  assert.equal(parsed.command, "sync");
  assert.equal(parsed.contextFile, "/tmp/context.md");
  assert.equal(parsed.recoveryFile, "/tmp/recovery.json");
});

test("legacy runtime mutation verbs fail with sync guidance", () => {
  assert.match(parseError(["install"]).message, /Use ax sync/);
  assert.match(parseError(["skills", "update"]).message, /Use ax skills sync/);
  assert.match(
    parseError(["openspec", "install"]).message,
    /Use ax openspec sync/,
  );
});

test("removed workflow commands are unavailable", () => {
  assert.match(
    parseError(["commit", "-m", "message"]).message,
    /unknown command/,
  );
  assert.match(
    parseError(["review-gate", "status"]).message,
    /unknown command/,
  );
  assert.match(
    parseError(["plans", "artifact", "list"]).message,
    /unknown command/,
  );
});
