import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Command } from "commander";

import {
  claudeStartupHookStatus,
  codexStartupHookStatus,
  createProgram,
  createRuntimeBackup,
  registerClaudeStartupHook,
  registerCodexStartupHook,
} from "../../scripts/agent-runtime.ts";

type ParsedCommand = {
  scope?: string;
  command: string;
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

function withTempDir(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "agent-runtime-unit-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

test("Commander routes scoped skills commands", () => {
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

test("Commander routes top-level wrapper commands", () => {
  const [parsed] = parseCommand(["status", "--profile", "personal"]);

  assert.equal(parsed.scope, undefined);
  assert.equal(parsed.command, "status");
  assert.deepEqual(parsed.profileNames, ["personal"]);
});

test("Commander routes scoped OpenSpec commands", () => {
  const [parsed] = parseCommand([
    "openspec",
    "install",
    "--config",
    "custom.json",
  ]);

  assert.equal(parsed.scope, "openspec");
  assert.equal(parsed.command, "install");
  assert.equal(parsed.configPath, "custom.json");
});

test("Commander routes scoped hooks commands", () => {
  const [parsed] = parseCommand([
    "hooks",
    "install",
    "--config",
    "custom.json",
  ]);

  assert.equal(parsed.scope, "hooks");
  assert.equal(parsed.command, "install");
  assert.equal(parsed.configPath, "custom.json");
});

test("Commander routes all selection flags", () => {
  const [parsed] = parseCommand(["install", "--all-profiles"]);

  assert.equal(parsed.command, "install");
  assert.equal(parsed.allProfiles, true);
});

test("Commander rejects agent flags on skills commands", () => {
  const error = parseInvalidCommand([
    "skills",
    "status",
    "--agent",
    "example-agent",
  ]);

  assert.match(error.message, /unknown option '--agent'/);
});

test("Commander rejects profile flags on OpenSpec commands", () => {
  const error = parseInvalidCommand([
    "openspec",
    "status",
    "--profile",
    "work",
  ]);

  assert.match(error.message, /unknown option '--profile'/);
});

test("Commander rejects profile flags on hooks commands", () => {
  const error = parseInvalidCommand(["hooks", "status", "--profile", "work"]);

  assert.match(error.message, /unknown option '--profile'/);
});

test("Commander rejects removed skillset flags", () => {
  const error = parseInvalidCommand(["status", "--skillset", "work"]);

  assert.match(error.message, /unknown option '--skillset'/);
});

test("Commander rejects removed agents commands", () => {
  const error = parseInvalidCommand(["agents", "status"]);

  assert.match(error.message, /unknown command 'agents'/);
});

test("registerCodexStartupHook preserves hooks JSON content and stays idempotent", () => {
  withTempDir((directory) => {
    const hooksJsonPath = join(directory, "hooks.json");
    const configTomlPath = join(directory, "config.toml");
    const command = "$HOME/.codex/hooks/git-sync.sh";
    writeFileSync(
      hooksJsonPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          hooks: {
            Stop: [
              {
                hooks: [
                  {
                    type: "command",
                    command: "afplay /System/Library/Sounds/Ping.aiff",
                  },
                ],
              },
            ],
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command: "$HOME/.codex/hooks/existing.sh",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
    writeFileSync(
      configTomlPath,
      'model = "gpt-5"\n\n[hooks.state]\n',
      "utf-8",
    );
    const originalToml = readFileSync(configTomlPath, "utf-8");

    const first = registerCodexStartupHook({
      hooksJsonPath,
      configTomlPath,
      command,
    });
    const second = registerCodexStartupHook({
      hooksJsonPath,
      configTomlPath,
      command,
    });
    const document = JSON.parse(readFileSync(hooksJsonPath, "utf-8"));

    assert.equal(first.changed, true);
    assert.deepEqual(first.location, {
      event: "SessionStart",
      eventKey: "session_start",
      matcherIndex: 0,
      hookIndex: 1,
    });
    assert.equal(second.changed, false);
    assert.deepEqual(second.location, first.location);
    assert.equal(document.schemaVersion, 1);
    assert.equal(document.hooks.Stop.length, 1);
    assert.deepEqual(document.hooks.SessionStart[0].hooks, [
      {
        type: "command",
        command: "$HOME/.codex/hooks/existing.sh",
      },
      {
        type: "command",
        command,
      },
    ]);
    assert.equal(readFileSync(configTomlPath, "utf-8"), originalToml);
  });
});

test("codexStartupHookStatus reports missing registration and trust gaps", () => {
  withTempDir((directory) => {
    const actualHooksJsonPath = join(directory, "hooks.json");
    const hooksJsonPath = join(directory, "nested", "..", "hooks.json");
    const configTomlPath = join(directory, "config.toml");
    const command = "$HOME/.codex/hooks/git-sync.sh";

    writeFileSync(
      actualHooksJsonPath,
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [] }] } }, null, 2),
      "utf-8",
    );
    writeFileSync(configTomlPath, "[hooks.state]\n", "utf-8");

    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: false,
        locations: [],
        trustState: "not_applicable",
        gaps: ["codex startup hook registration missing"],
      },
    );

    registerCodexStartupHook({ hooksJsonPath, configTomlPath, command });
    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: true,
        locations: [
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 0,
          },
        ],
        trustState: "missing",
        gaps: ["codex startup hook trust missing"],
      },
    );

    writeFileSync(
      configTomlPath,
      `[hooks.state]\n\n[hooks.state."${actualHooksJsonPath}:session_start:0:0"]\ntrusted_hash = "sha256:abc"\n`,
      "utf-8",
    );
    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: true,
        locations: [
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 0,
          },
        ],
        trustState: "trusted",
        gaps: [],
      },
    );

    writeFileSync(
      actualHooksJsonPath,
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command,
                  },
                  {
                    type: "command",
                    command,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    writeFileSync(
      configTomlPath,
      `[hooks.state]\n\n[hooks.state."${actualHooksJsonPath}:session_start:0:0"]\ntrusted_hash = "sha256:abc"\n\n[hooks.state."${actualHooksJsonPath}:session_start:0:1"]\ntrusted_hash = "sha256:def"\n`,
      "utf-8",
    );
    assert.deepEqual(
      codexStartupHookStatus({ hooksJsonPath, configTomlPath, command }),
      {
        registered: true,
        locations: [
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 0,
          },
          {
            event: "SessionStart",
            eventKey: "session_start",
            matcherIndex: 0,
            hookIndex: 1,
          },
        ],
        trustState: "trusted",
        gaps: ["codex startup hook duplicate registrations"],
      },
    );
  });
});

test("startup hook helpers reject malformed SessionStart registrations", () => {
  withTempDir((directory) => {
    const settingsJsonPath = join(directory, "settings.json");
    const command = "$HOME/.claude/hooks/git-sync.sh";
    writeFileSync(
      settingsJsonPath,
      JSON.stringify({ hooks: { SessionStart: [null] } }, null, 2),
      "utf-8",
    );

    assert.throws(
      () => registerClaudeStartupHook({ settingsJsonPath, command }),
      /Invalid SessionStart hook matcher at index 0/,
    );
    assert.throws(
      () => claudeStartupHookStatus({ settingsJsonPath, command }),
      /Invalid SessionStart hook matcher at index 0/,
    );

    writeFileSync(
      settingsJsonPath,
      JSON.stringify(
        { hooks: { SessionStart: [{ hooks: "not an array" }] } },
        null,
        2,
      ),
      "utf-8",
    );
    assert.throws(
      () => registerClaudeStartupHook({ settingsJsonPath, command }),
      /Invalid SessionStart hooks array at matcher index 0/,
    );
  });
});

test("registerClaudeStartupHook preserves settings JSON content and stays idempotent", () => {
  withTempDir((directory) => {
    const settingsJsonPath = join(directory, "settings.json");
    const command = "$HOME/.claude/hooks/git-sync.sh";
    writeFileSync(
      settingsJsonPath,
      `${JSON.stringify(
        {
          model: "fable",
          permissions: {
            allow: ["Bash(git status)"],
          },
          hooks: {
            Notification: [
              {
                matcher: "permission_prompt",
                hooks: [
                  {
                    type: "command",
                    command: "afplay /System/Library/Sounds/Glass.aiff",
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );

    const first = registerClaudeStartupHook({ settingsJsonPath, command });
    const second = registerClaudeStartupHook({ settingsJsonPath, command });
    const document = JSON.parse(readFileSync(settingsJsonPath, "utf-8"));

    assert.equal(first.changed, true);
    assert.deepEqual(first.location, {
      event: "SessionStart",
      eventKey: "session_start",
      matcherIndex: 0,
      hookIndex: 0,
    });
    assert.equal(second.changed, false);
    assert.equal(document.model, "fable");
    assert.deepEqual(document.permissions.allow, ["Bash(git status)"]);
    assert.equal(document.hooks.Notification.length, 1);
    assert.deepEqual(document.hooks.SessionStart, [
      {
        hooks: [
          {
            type: "command",
            command,
          },
        ],
      },
    ]);
  });
});

test("claudeStartupHookStatus reports registration gaps without trust state", () => {
  withTempDir((directory) => {
    const settingsJsonPath = join(directory, "settings.json");
    const command = "$HOME/.claude/hooks/git-sync.sh";
    writeFileSync(settingsJsonPath, JSON.stringify({ hooks: {} }), "utf-8");

    assert.deepEqual(claudeStartupHookStatus({ settingsJsonPath, command }), {
      registered: false,
      locations: [],
      trustState: "not_applicable",
      gaps: ["claude startup hook registration missing"],
    });

    registerClaudeStartupHook({ settingsJsonPath, command });
    assert.deepEqual(claudeStartupHookStatus({ settingsJsonPath, command }), {
      registered: true,
      locations: [
        {
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex: 0,
          hookIndex: 0,
        },
      ],
      trustState: "not_applicable",
      gaps: [],
    });

    writeFileSync(
      settingsJsonPath,
      JSON.stringify(
        {
          hooks: {
            SessionStart: [
              {
                hooks: [
                  {
                    type: "command",
                    command,
                  },
                  {
                    type: "command",
                    command,
                  },
                ],
              },
            ],
          },
        },
        null,
        2,
      ),
      "utf-8",
    );
    assert.deepEqual(claudeStartupHookStatus({ settingsJsonPath, command }), {
      registered: true,
      locations: [
        {
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex: 0,
          hookIndex: 0,
        },
        {
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex: 0,
          hookIndex: 1,
        },
      ],
      trustState: "not_applicable",
      gaps: ["claude startup hook duplicate registrations"],
    });
  });
});

test("createRuntimeBackup snapshots executable files", () => {
  withTempDir((directory) => {
    const source = join(directory, "hook.ts");
    writeFileSync(source, "console.log('ok');\n", "utf-8");
    chmodSync(source, 0o755);

    const backup = createRuntimeBackup({
      sourcePath: source,
      backupsRoot: join(directory, "backups"),
      assetKind: "hooks",
      targetName: "codex",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    assert.equal(backup.status, "created");
    assert.equal(backup.kind, "file");
    assert.equal(backup.verified, true);
    assert.equal(
      readFileSync(backup.targetBackupPath ?? "", "utf-8"),
      "console.log('ok');\n",
    );
    assert.ok((lstatSync(backup.targetBackupPath ?? "").mode & 0o111) > 0);
  });
});

test("createRuntimeBackup preserves directory symlinks without dereferencing", () => {
  withTempDir((directory) => {
    const source = join(directory, "source");
    const linked = join(directory, "linked.txt");
    mkdirSync(source);
    writeFileSync(linked, "linked\n", "utf-8");
    symlinkSync("../linked.txt", join(source, "link.txt"));

    const backup = createRuntimeBackup({
      sourcePath: source,
      backupsRoot: join(directory, "backups"),
      assetKind: "skills",
      targetName: "agents",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const backedUpLink = join(backup.targetBackupPath ?? "", "link.txt");

    assert.equal(backup.kind, "directory");
    assert.equal(lstatSync(backedUpLink).isSymbolicLink(), true);
    assert.equal(readlinkSync(backedUpLink), "../linked.txt");
  });
});

test("createRuntimeBackup snapshots dangling symlinks", () => {
  withTempDir((directory) => {
    const source = join(directory, "dangling");
    symlinkSync("missing-target", source);

    const backup = createRuntimeBackup({
      sourcePath: source,
      backupsRoot: join(directory, "backups"),
      assetKind: "hooks",
      targetName: "claude",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    assert.equal(backup.kind, "symlink");
    assert.equal(
      lstatSync(backup.targetBackupPath ?? "").isSymbolicLink(),
      true,
    );
    assert.equal(readlinkSync(backup.targetBackupPath ?? ""), "missing-target");
  });
});

test("createRuntimeBackup records missing targets without target content", () => {
  withTempDir((directory) => {
    const backup = createRuntimeBackup({
      sourcePath: join(directory, "missing"),
      backupsRoot: join(directory, "backups"),
      assetKind: "config",
      targetName: "codex",
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    const manifest = JSON.parse(readFileSync(backup.manifestPath, "utf-8")) as {
      status: string;
      kind: string;
    };

    assert.equal(backup.status, "missing");
    assert.equal(backup.kind, "missing");
    assert.equal(backup.targetBackupPath, undefined);
    assert.equal(manifest.status, "missing");
    assert.equal(manifest.kind, "missing");
  });
});

test("createRuntimeBackup keeps seven newest backups and disambiguates timestamp collisions", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");
    const firstTimestamp = new Date("2026-01-01T00:00:00.000Z");

    createRuntimeBackup({
      sourcePath: source,
      backupsRoot,
      assetKind: "config",
      targetName: "codex",
      now: firstTimestamp,
    });
    createRuntimeBackup({
      sourcePath: source,
      backupsRoot,
      assetKind: "config",
      targetName: "codex",
      now: firstTimestamp,
    });
    for (let index = 1; index <= 6; index += 1) {
      createRuntimeBackup({
        sourcePath: source,
        backupsRoot,
        assetKind: "config",
        targetName: "codex",
        now: new Date(`2026-01-01T00:00:0${index}.000Z`),
      });
    }

    const backups = readdirSync(targetRoot).sort();
    assert.equal(backups.length, 7);
    assert.ok(!backups.includes("2026-01-01T00-00-00-000Z"));
    assert.ok(backups.includes("2026-01-01T00-00-00-000Z-000002"));
  });
});

test("createRuntimeBackup prunes same-timestamp collisions by numeric order", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");
    const timestamp = new Date("2026-01-01T00:00:00.000Z");

    for (let index = 0; index < 11; index += 1) {
      createRuntimeBackup({
        sourcePath: source,
        backupsRoot,
        assetKind: "config",
        targetName: "codex",
        now: timestamp,
      });
    }

    assert.deepEqual(readdirSync(targetRoot).sort(), [
      "2026-01-01T00-00-00-000Z-000005",
      "2026-01-01T00-00-00-000Z-000006",
      "2026-01-01T00-00-00-000Z-000007",
      "2026-01-01T00-00-00-000Z-000008",
      "2026-01-01T00-00-00-000Z-000009",
      "2026-01-01T00-00-00-000Z-000010",
      "2026-01-01T00-00-00-000Z-000011",
    ]);
  });
});

test("createRuntimeBackup removes failed attempts without pruning old backups", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");
    mkdirSync(targetRoot, { recursive: true });
    for (let index = 0; index < 8; index += 1) {
      mkdirSync(join(targetRoot, `old-${index}`));
    }

    assert.throws(
      () =>
        createRuntimeBackup({
          sourcePath: "/dev/null",
          backupsRoot,
          assetKind: "config",
          targetName: "codex",
          now: new Date("2026-01-01T00:00:00.000Z"),
        }),
      /Unsupported backup target type/,
    );

    for (let index = 0; index < 8; index += 1) {
      assert.equal(existsSync(join(targetRoot, `old-${index}`)), true);
    }
    assert.equal(
      readdirSync(targetRoot).filter((name) => name.startsWith("2026-")).length,
      0,
    );
  });
});

test("createRuntimeBackup preserves seven successful backups after a failed attempt", () => {
  withTempDir((directory) => {
    const source = join(directory, "config.json");
    writeFileSync(source, "{}\n", "utf-8");
    const backupsRoot = join(directory, "backups");
    const targetRoot = join(backupsRoot, "config", "codex");

    assert.throws(
      () =>
        createRuntimeBackup({
          sourcePath: "/dev/null",
          backupsRoot,
          assetKind: "config",
          targetName: "codex",
          now: new Date("2026-01-01T00:00:00.000Z"),
        }),
      /Unsupported backup target type/,
    );

    for (let index = 1; index <= 7; index += 1) {
      createRuntimeBackup({
        sourcePath: source,
        backupsRoot,
        assetKind: "config",
        targetName: "codex",
        now: new Date(`2026-01-01T00:00:0${index}.000Z`),
      });
    }

    const backups = readdirSync(targetRoot).sort();
    assert.equal(backups.length, 7);
    assert.ok(!backups.includes("2026-01-01T00-00-00-000Z"));
  });
});
