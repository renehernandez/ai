// charter-contracts: hook-registration
import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRegistrationTargetSafe,
  renderHookRegistrationDocument,
} from "../../scripts/ax/hook-registration.ts";

test("RED hook-registration: force-push guard rejects an unowned target", () => {
  assert.throws(
    () =>
      assertRegistrationTargetSafe({
        path: "/tmp/human-git-hooks/pre-push",
        target: "codex",
        home: "/tmp/isolated-home",
      }),
    /hook_registration_target_invalid/u,
  );
});

test("GREEN hook-registration: force-push guard targets both agent harnesses", () => {
  const document = renderHookRegistrationDocument({
    path: "/tmp/nonexistent-force-push-hook-settings.json",
    declaration: {
      id: "block-agent-force-push",
      event: "PreToolUse",
      matcher: "^Bash$",
      command: "pnpm exec tsx ~/.agents/hooks/block-agent-force-push.ts",
      targets: {
        claude: "~/.claude/settings.json",
        codex: "~/.codex/hooks.json",
      },
    },
  });

  assert.match(document, /block-agent-force-push/u);
  assert.match(document, /block-agent-force-push\.ts/u);
  assert.match(document, /PreToolUse/u);
  assert.match(document, /Bash/u);
  assert.match(
    document,
    /pnpm exec tsx ~\/\.agents\/hooks\/block-agent-force-push\.ts/u,
  );
});

test("RED hook-registration: registration rejects an unowned target", () => {
  assert.throws(
    () =>
      assertRegistrationTargetSafe({
        path: "/tmp/unowned-hooks.json",
        target: "codex",
        home: "/tmp/isolated-home",
      }),
    /hook_registration_target_invalid/u,
  );
  assert.throws(
    () =>
      assertRegistrationTargetSafe({
        path: "/tmp/isolated-home-sibling/.codex/hooks.json",
        target: "codex",
        home: "/tmp/isolated-home",
      }),
    /hook_registration_target_invalid/u,
  );
});

test("GREEN hook-registration: registration renders the declared hook", () => {
  assert.match(
    renderHookRegistrationDocument({
      path: "/tmp/nonexistent-hook-registration-settings.json",
      declaration: {
        id: "block-delete-outside-cwd",
        event: "PreToolUse",
        matcher: "^Bash$",
        command: "pnpm exec tsx ~/.agents/hooks/block-delete-outside-cwd.ts",
        targets: {
          claude: "~/.claude/settings.json",
          codex: "~/.codex/hooks.json",
        },
      },
    }),
    /block-delete-outside-cwd/u,
  );
});
