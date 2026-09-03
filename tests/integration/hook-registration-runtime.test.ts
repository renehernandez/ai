import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  type AxRuntimeConfig,
  inspectRuntime,
  syncRuntime,
  validateRuntime,
} from "../../scripts/ax/runtime-sync.ts";

const repoRoot = process.cwd();
const tsxLoader = pathToFileURL(
  join(repoRoot, "node_modules", "tsx", "dist", "loader.mjs"),
).href;

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "hook-registration-runtime-"));
  const originalHome = process.env.HOME;
  const originalIsolated = process.env.AX_ISOLATED_RUNTIME;
  try {
    process.env.HOME = join(root, "home");
    process.env.AX_ISOLATED_RUNTIME = "1";
    callback(root);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalIsolated === undefined) delete process.env.AX_ISOLATED_RUNTIME;
    else process.env.AX_ISOLATED_RUNTIME = originalIsolated;
    rmSync(root, { force: true, recursive: true });
  }
}

function fixture(root: string): {
  sourceRoot: string;
  runtimeRoot: string;
  config: AxRuntimeConfig;
} {
  const sourceRoot = join(root, "source");
  const runtimeRoot = join(root, "runtime");
  const home = join(root, "home");
  mkdirSync(runtimeRoot, { recursive: true });
  writeFileSync(
    join(runtimeRoot, "selected-profile.json"),
    '{"schemaVersion":1,"selectedProfile":"personal"}\n',
  );
  mkdirSync(join(sourceRoot, "hooks"), { recursive: true });
  writeFileSync(
    join(sourceRoot, "hooks", "block-delete-outside-cwd.ts"),
    readFileSync(
      join(repoRoot, "hooks", "block-delete-outside-cwd.ts"),
      "utf-8",
    ),
  );
  writeFileSync(
    join(sourceRoot, "hooks", "shell-command.ts"),
    readFileSync(join(repoRoot, "hooks", "shell-command.ts"), "utf-8"),
  );
  mkdirSync(join(home, ".codex"), { recursive: true });
  mkdirSync(join(home, ".claude"), { recursive: true });
  writeFileSync(
    join(home, ".codex", "hooks.json"),
    JSON.stringify({
      schemaVersion: 1,
      hooks: { Stop: [{ hooks: [{ type: "command", command: "notify" }] }] },
    }),
  );
  writeFileSync(
    join(home, ".claude", "settings.json"),
    JSON.stringify({
      model: "fable",
      hooks: {
        Notification: [
          { hooks: [{ type: "command", command: "notification" }] },
        ],
      },
    }),
  );
  writeFileSync(join(home, ".codex", "config.toml"), 'model = "gpt"\n');

  return {
    sourceRoot,
    runtimeRoot,
    config: {
      version: 1,
      runtime: {
        canonicalSkillsDir: join(home, ".agents", "skills"),
        skillSymlinkTargets: [],
        hooks: {
          sourceDir: "hooks",
          canonicalDir: join(home, ".agents", "hooks"),
          targets: {
            codex: join(home, ".codex", "hooks"),
            claude: join(home, ".claude", "hooks"),
          },
          registrations: [
            {
              id: "block-delete-outside-cwd",
              event: "PreToolUse",
              matcher: "^Bash$",
              command:
                "pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts",
              targets: {
                codex: "~/.codex/hooks.json",
                claude: "~/.claude/settings.json",
              },
            },
          ],
        },
      },
      profiles: { personal: { include: [], paths: [] } },
      blocks: {},
    },
  };
}

test("isolated hook sync converges registrations and status detects drift", () => {
  withTempDir((root) => {
    const input = fixture(root);
    const first = syncRuntime({ ...input, surface: "hooks" });
    assert.ok(
      first.changedPaths.includes(join(root, "home", ".codex", "hooks.json")),
    );
    assert.ok(
      first.changedPaths.includes(
        join(root, "home", ".claude", "settings.json"),
      ),
    );

    const codex = JSON.parse(
      readFileSync(join(root, "home", ".codex", "hooks.json"), "utf-8"),
    ) as Record<string, unknown>;
    const claude = JSON.parse(
      readFileSync(join(root, "home", ".claude", "settings.json"), "utf-8"),
    ) as Record<string, unknown>;
    assert.equal(codex.schemaVersion, 1);
    assert.equal(claude.model, "fable");
    assert.match(JSON.stringify(codex), /block-delete-outside-cwd/u);
    assert.match(JSON.stringify(claude), /block-delete-outside-cwd/u);

    const installedHook = join(
      root,
      "home",
      ".agents",
      "hooks",
      "block-delete-outside-cwd.ts",
    );
    const workspace = join(root, "workspace");
    mkdirSync(workspace);
    const allowed = runInstalledHook(installedHook, {
      cwd: workspace,
      tool_input: { command: "rm nested/file" },
    });
    assert.equal(allowed.stdout, "", allowed.stderr);
    const denied = runInstalledHook(installedHook, {
      cwd: workspace,
      tool_input: { command: "rm ../outside" },
    });
    assert.match(denied.stdout, /"permissionDecision":"deny"/u);

    const report = inspectRuntime({ ...input, surface: "hooks" });
    assert.equal(report.ok, true, report.findings.join("\n"));
    assert.ok(
      report.warnings.includes(
        "codex_hook_trust_unverified: block-delete-outside-cwd",
      ),
    );
    assert.doesNotThrow(() => validateRuntime({ ...input, surface: "hooks" }));

    writeFileSync(
      join(root, "home", ".codex", "hooks.json"),
      JSON.stringify({ hooks: {} }),
    );
    const drift = inspectRuntime({ ...input, surface: "hooks" });
    assert.equal(drift.ok, false);
    assert.ok(
      drift.findings.includes(
        "hook_registration_missing: codex/block-delete-outside-cwd",
      ),
    );
    assert.throws(
      () => validateRuntime({ ...input, surface: "hooks" }),
      /hook_registration_missing/u,
    );

    syncRuntime({ ...input, surface: "hooks" });
    const second = syncRuntime({ ...input, surface: "hooks" });
    assert.equal(
      second.changedPaths.filter((path) => path.endsWith("hooks.json")).length,
      1,
    );
    assert.equal(inspectRuntime({ ...input, surface: "hooks" }).ok, true);
  });
});

function runInstalledHook(
  hookPath: string,
  payload: Record<string, unknown>,
): { stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ["--import", tsxLoader, hookPath],
    {
      cwd: repoRoot,
      encoding: "utf-8",
      input: JSON.stringify(payload),
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { stdout: result.stdout, stderr: result.stderr };
}
