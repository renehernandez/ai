import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const collectorPath = fileURLToPath(
  new URL(
    "../../skills/nitro-review-feedback/scripts/gitlab-evidence-collect.ts",
    import.meta.url,
  ),
);
function parsePageCli(input: string, args: string[] = []) {
  return spawnSync(process.execPath, [collectorPath, "--parse-page", ...args], {
    input,
    encoding: "utf8",
    env: { ...process.env, PATH: "" },
  });
}
test("owner CLI parses stdin pagination without provider access", () => {
  const result = parsePageCli(
    'HTTP/2 200 OK\r\nX-Page: 2\r\nX-Next-Page: \r\n\r\n[{"id":7}]',
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    page: 2,
    next_page: "",
    items: [{ id: 7 }],
  });
});
test("owner CLI rejects truncated evidence and extra arguments", () => {
  const invalid = parsePageCli("HTTP/2 200 OK\n\n[]");
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.stderr, /gitlab_evidence_pagination_headers_invalid/);
  assert.equal(invalid.stdout, "");
  const extra = parsePageCli("", ["unexpected"]);
  assert.notEqual(extra.status, 0);
  assert.match(extra.stderr, /usage: gitlab-evidence-collect --parse-page/);
});
