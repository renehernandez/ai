import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { launchArguments, readRoutes } from "../../hooks/pi/launch.ts";
import { herdrTemplates } from "../../scripts/ax/herdr-templates.ts";

const repository = join(import.meta.dirname, "../..");

function frontmatter(content: string): Record<string, string> {
  const [, header] = content.split("---\n");
  return Object.fromEntries(
    header
      .trim()
      .split("\n")
      .map((line) => [
        line.slice(0, line.indexOf(":")),
        line.slice(line.indexOf(":") + 2),
      ]),
  );
}

test("herdr-core templates are generated from routes.json and launch on a listed route", () => {
  const table = readRoutes(join(repository, "hooks/pi/routes.json"));
  const templates = herdrTemplates(table);
  assert.deepEqual(
    templates.map((template) => template.file),
    [
      "ax-orchestrator.md",
      "ax-orchestrator-gpt-6-astra.md",
      "ax-planner-astra.md",
      "ax-planner-fable.md",
    ],
  );
  const selected = templates.map((template) => {
    const header = frontmatter(template.content);
    assert.equal(`${header.name}.md`, template.file);
    // herdr-core would send a nonempty body as an unrequested first prompt.
    assert.ok(template.content.endsWith("\n---\n"));
    const [node, launcher, ...argv] = header.command.split(" ");
    assert.deepEqual(
      [node, launcher],
      ["node", "~/.agents/hooks/pi/launch.ts"],
    );
    const { contract, rpc } = launchArguments(argv, table);
    assert.equal(rpc, false);
    return `${contract.role} ${contract.provider}/${contract.model}:${contract.thinking}`;
  });
  assert.deepEqual(selected, [
    ...table.orchestrator.routes.map((spec) => `orchestrator ${spec}`),
    `planner-astra ${table["planner-astra"].routes[0]}`,
    `planner-fable ${table["planner-fable"].routes[0]}`,
  ]);
});
