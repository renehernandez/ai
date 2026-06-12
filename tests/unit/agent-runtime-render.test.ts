import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { renderAgent } from "../../scripts/agent-runtime.ts";

function withTempDir(callback: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "agent-runtime-render-"));
  try {
    callback(directory);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

test("renderAgent replaces model and adds reasoning", () => {
  withTempDir((directory) => {
    const sourcePath = join(directory, "agent.md");
    writeFileSync(
      sourcePath,
      `---
name: implementer-agent
model: sonnet
color: green
---

Body
`,
      "utf-8",
    );

    const rendered = renderAgent(sourcePath, { model: "gpt-5.4", reasoning: "high" });

    assert.match(rendered, /^model: gpt-5\.4$/m);
    assert.match(rendered, /^reasoning: high$/m);
    assert.match(rendered, /Body/);
  });
});

test("renderAgent removes stale reasoning when mapping omits it", () => {
  withTempDir((directory) => {
    const sourcePath = join(directory, "agent.md");
    writeFileSync(
      sourcePath,
      `---
name: implementation-review-agent
model: gpt-5.5
reasoning: xhigh
---

Body
`,
      "utf-8",
    );

    const rendered = renderAgent(sourcePath, { model: "opus" });

    assert.match(rendered, /^model: opus$/m);
    assert.doesNotMatch(rendered, /^reasoning:/m);
  });
});

test("renderAgent rejects files without frontmatter", () => {
  withTempDir((directory) => {
    const sourcePath = join(directory, "agent.md");
    writeFileSync(sourcePath, "Body only\n", "utf-8");

    assert.throws(() => renderAgent(sourcePath, { model: "opus" }), /missing frontmatter/);
  });
});
