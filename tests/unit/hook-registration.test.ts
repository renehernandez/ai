import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertRegistrationTargetSafe,
  type HookRegistrationDeclaration,
  inspectHookRegistration,
  registrationFindings,
  renderHookRegistrationDocument,
} from "../../scripts/ax/hook-registration.ts";

const declaration: HookRegistrationDeclaration = {
  id: "block-delete-outside-cwd",
  event: "PreToolUse",
  matcher: "^Bash$",
  command: "pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts",
  targets: {
    claude: "~/.claude/settings.json",
    codex: "~/.codex/hooks.json",
  },
};

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "hook-registration-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

test("rendering preserves unrelated settings and converges one owned registration", () => {
  withTempDir((root) => {
    const path = join(root, "settings.json");
    writeFileSync(
      path,
      JSON.stringify({
        model: "fable",
        permissions: { allow: ["Bash(git status)"] },
        hooks: {
          Stop: [{ hooks: [{ type: "command", command: "notify" }] }],
          Notification: [{ matcher: "idle", hooks: [] }],
          PreToolUse: [
            {
              matcher: "^Bash$",
              hooks: [
                { type: "command", command: "unrelated" },
                {
                  type: "command",
                  command:
                    "old ~/.agents/hooks/block-delete-outside-cwd.ts --stale",
                },
              ],
            },
            {
              matcher: "Other",
              hooks: [
                {
                  type: "command",
                  command:
                    "pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts",
                },
              ],
            },
          ],
        },
      }),
    );

    const first = renderHookRegistrationDocument({ path, declaration });
    writeFileSync(path, first);
    const second = renderHookRegistrationDocument({ path, declaration });
    assert.equal(second, first);

    const document = JSON.parse(first) as {
      model: string;
      permissions: { allow: string[] };
      hooks: Record<string, Array<{ matcher?: string; hooks: unknown[] }>>;
    };
    assert.equal(document.model, "fable");
    assert.deepEqual(document.permissions.allow, ["Bash(git status)"]);
    assert.equal(document.hooks.Stop.length, 1);
    assert.deepEqual(document.hooks.Notification, [
      { matcher: "idle", hooks: [] },
    ]);
    assert.deepEqual(document.hooks.PreToolUse, [
      {
        matcher: "^Bash$",
        hooks: [
          { type: "command", command: "unrelated" },
          { type: "command", command: declaration.command },
        ],
      },
    ]);
  });
});

test("inspection reports drift and leaves Codex trust app-owned", () => {
  withTempDir((root) => {
    const hooksJsonPath = join(root, "hooks.json");
    writeFileSync(hooksJsonPath, "{}\n");
    const missing = inspectHookRegistration({
      path: hooksJsonPath,
      target: "codex",
      declaration,
    });
    assert.deepEqual(registrationFindings(missing), [
      "hook_registration_missing: codex/block-delete-outside-cwd",
    ]);

    writeFileSync(
      hooksJsonPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "^Bash$",
              hooks: [
                { type: "command", command: declaration.command },
                { type: "command", command: declaration.command },
              ],
            },
          ],
          Stop: [
            {
              hooks: [
                {
                  type: "command",
                  command:
                    "old ~/.agents/hooks/block-delete-outside-cwd.ts --stale",
                },
              ],
            },
          ],
        },
      }),
    );
    const drift = inspectHookRegistration({
      path: hooksJsonPath,
      target: "codex",
      declaration,
    });
    assert.deepEqual(registrationFindings(drift), [
      "hook_registration_duplicate: codex/block-delete-outside-cwd",
      "hook_registration_stale: codex/block-delete-outside-cwd",
    ]);

    writeFileSync(
      hooksJsonPath,
      renderHookRegistrationDocument({ path: hooksJsonPath, declaration }),
    );
    const clean = inspectHookRegistration({
      path: hooksJsonPath,
      target: "codex",
      declaration,
    });
    assert.deepEqual(registrationFindings(clean), []);
    assert.equal(clean.trust, "unverified_app_owned");
  });
});

test("stale matcher cleanup cannot inherit a positional Codex trust claim", () => {
  withTempDir((root) => {
    const hooksJsonPath = join(root, "hooks.json");
    writeFileSync(
      hooksJsonPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Stale",
              hooks: [
                {
                  type: "command",
                  command:
                    "old ~/.agents/hooks/block-delete-outside-cwd.ts --stale",
                },
              ],
            },
            {
              matcher: "Other",
              hooks: [{ type: "command", command: "unrelated" }],
            },
          ],
        },
      }),
    );
    writeFileSync(
      hooksJsonPath,
      renderHookRegistrationDocument({ path: hooksJsonPath, declaration }),
    );

    const status = inspectHookRegistration({
      path: hooksJsonPath,
      target: "codex",
      declaration,
    });
    assert.equal(status.locations[0].matcherIndex, 1);
    assert.equal(status.trust, "unverified_app_owned");
  });
});

test("registration targets are fixed to the isolated home harness files", () => {
  withTempDir((home) => {
    const codexPath = join(home, ".codex", "hooks.json");
    mkdirSync(join(home, ".codex"), { recursive: true });
    assert.doesNotThrow(() =>
      assertRegistrationTargetSafe({
        path: codexPath,
        target: "codex",
        home,
      }),
    );
    assert.throws(
      () =>
        assertRegistrationTargetSafe({
          path: join(home, "other.json"),
          target: "codex",
          home,
        }),
      /hook_registration_target_invalid/u,
    );
  });
});

test("malformed unrelated hook structures fail closed before mutation", () => {
  withTempDir((root) => {
    const path = join(root, "settings.json");
    writeFileSync(path, JSON.stringify({ hooks: { PreToolUse: "invalid" } }));
    assert.throws(
      () => renderHookRegistrationDocument({ path, declaration }),
      /hook_registration_event_invalid/u,
    );
  });
});
