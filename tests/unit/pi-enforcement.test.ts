import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import enforcement from "../../hooks/pi/enforcement.ts";
import { launchArguments, launchEnvironment } from "../../hooks/pi/launch.ts";
import {
  findDependencyChange,
  parseContract,
  runtimeDenial,
  toolDenial,
} from "../../hooks/pi/policy.ts";

const orchestratorRoles = ["orchestrator", "planner"];
const writeRoles = [...orchestratorRoles, "implementer"];
const baseArgs = [
  "review-correctness",
  "openai-codex",
  "gpt-6.1-sol",
  "medium",
];
const contract = parseContract({
  role: "review-astra",
  provider: "openai-codex",
  model: "gpt-6-astra",
  thinking: "low",
  nonce: "test",
});

test("managed arguments preserve caller extensions and enforce the fixed route", () => {
  const result = launchArguments([
    ...baseArgs,
    "--model",
    "openai-codex/gpt-6.1-sol",
    "--thinking",
    "medium",
    "-e",
    "/tmp/caller.ts",
    "--session",
    "/tmp/session.jsonl",
  ]);
  assert.ok(result.args.includes("/tmp/caller.ts"));
  assert.ok(result.args.includes("/tmp/session.jsonl"));
  assert.ok(result.args.includes("--no-extensions"));
  assert.ok(result.args.some((v) => v.endsWith("/pi/enforcement.ts")));
  assert.equal(result.args.at(-1), "read,grep,find,ls");
  assert.ok(!result.args.some((v) => v.includes("pi-mcp-adapter")));
  const implementation = launchArguments([
    "implementer",
    "claude-bridge",
    "claude-opus-5-5",
    "medium",
  ]);
  assert.ok(implementation.args.includes("npm:pi-mcp-adapter@7.0.0"));
  for (const tail of [
    ["--model", "gpt-6-astra"],
    ["--thinking=high"],
    ["--provider", "anthropic"],
    ["--tools", "bash"],
    ["--mode", "text"],
    ["--print"],
    ["a prompt"],
  ]) {
    assert.throws(() => launchArguments([...baseArgs, ...tail]));
  }
  assert.throws(() => launchArguments(["unknown", ...baseArgs.slice(1)]));
  // The launcher runs Pi only interactively in a herdr-core terminal; RPC mode is refused.
  const interactive = launchArguments(baseArgs);
  assert.ok(!interactive.args.includes("--mode"));
  assert.ok(interactive.args.includes("--no-approve"));
  assert.throws(
    () => launchArguments([...baseArgs, "--mode", "rpc"]),
    /Unsupported managed Pi argument: --mode/,
  );
  assert.throws(
    () =>
      launchArguments([
        "review-correctness",
        "openai-codex",
        "gpt-6.1-sol",
        "high",
      ]),
    /differ from routes.json/,
  );
  assert.throws(
    () =>
      launchArguments(baseArgs, {
        "review-correctness": {
          label: "x",
          routes: ["openai-codex/gpt-6.1-terra:medium"],
        },
      }),
    /differ from routes.json/,
  );
});

const orchestratorRoutes = [
  "orchestrator",
  "claude-bridge/claude-opus-5-5:medium",
  "openai-codex/gpt-6-astra:medium",
];
const route = ({ contract }: ReturnType<typeof launchArguments>) => [
  contract.role,
  contract.provider,
  contract.model,
  contract.thinking,
];

test("the orchestrator launches on the listed route the caller selects, Opus by default, and refuses others", () => {
  const opus = ["orchestrator", "claude-bridge", "claude-opus-5-5", "medium"];
  const astra = ["orchestrator", "openai-codex", "gpt-6-astra", "medium"];
  for (const [tail, expected] of [
    [[], opus],
    [["--thinking", "medium"], opus],
    [["--model", "claude-bridge/claude-opus-5-5"], opus],
    [["--model", "openai-codex/gpt-6-astra", "--thinking", "medium"], astra],
    [["--model=gpt-6-astra"], astra],
    [["--provider", "openai-codex"], astra],
  ] as const) {
    const result = launchArguments([...orchestratorRoutes, ...tail]);
    assert.deepEqual(route(result), expected, tail.join(" "));
    const at = result.args.indexOf("--model");
    assert.deepEqual(result.args.slice(at - 2, at + 4), [
      "--provider",
      expected[1],
      "--model",
      expected[2],
      "--thinking",
      "medium",
    ]);
    assert.equal(
      result.args.includes("npm:pi-claude-bridge@0.9.3"),
      expected[1] === "claude-bridge",
    );
    assert.ok(result.args.includes("npm:pi-mcp-adapter@7.0.0"));
    assert.equal(result.args.at(-1), "read,grep,find,ls,bash,edit,write,mcp");
  }
  for (const [tail, message] of [
    [["--model", "openai-codex/gpt-6.1-sol"], /Model override/],
    [["--model", "gpt-6-astra", "--thinking", "high"], /Thinking override/],
    [["--thinking", "low"], /Thinking override/],
    [["--provider", "anthropic"], /Provider override/],
    [["--model", "claude-opus-5-5", "--provider", "openai-codex"], /Provider/],
    [["--model", "claude-opus-5-5", "--model", "gpt-6-astra"], /Model/],
  ] as const)
    assert.throws(
      () => launchArguments([...orchestratorRoutes, ...tail]),
      message,
      tail.join(" "),
    );
  for (const argv of [
    ["orchestrator"],
    ["orchestrator", "claude-bridge", "claude-opus-5-5", "medium"],
    ["orchestrator", "claude-bridge/claude-opus-5-5"],
    ["orchestrator", "claude-bridge/claude-opus-5-5:fast"],
    [...orchestratorRoutes, "a prompt"],
  ])
    assert.throws(() => launchArguments(argv), argv.join(" "));

  const chosen = launchArguments([
    ...orchestratorRoutes,
    "--model",
    "openai-codex/gpt-6-astra",
  ]).contract;
  assert.ok(
    runtimeDenial(
      chosen,
      { provider: "claude-bridge", id: "claude-opus-5-5" },
      "medium",
    ),
  );
  assert.equal(
    runtimeDenial(
      chosen,
      { provider: "openai-codex", id: "gpt-6-astra" },
      "medium",
    ),
    undefined,
  );
});

test("implementer, reviewer, and planner alias routes stay single and fixed", () => {
  for (const fixed of [
    ["implementer", "claude-bridge", "claude-opus-5-5", "medium"],
    ["planner", "claude-bridge", "claude-opus-5-5", "medium"],
    ["review-correctness", "openai-codex", "gpt-6.1-sol", "medium"],
    ["review-quality", "claude-bridge", "claude-sonnet-5-5", "medium"],
    ["review-architecture", "openai-codex", "gpt-6.1-terra", "medium"],
    ["review-contract", "claude-bridge", "claude-sonnet-5-5", "medium"],
  ]) {
    assert.deepEqual(route(launchArguments([...fixed])), fixed);
    for (const tail of [
      ["--model", "openai-codex/gpt-6-astra"],
      ["--thinking", "high"],
      ["--provider", "anthropic"],
    ])
      assert.throws(
        () => launchArguments([...fixed, ...tail]),
        /override rejected/,
      );
    assert.throws(() =>
      launchArguments([
        fixed[0],
        "claude-bridge/claude-opus-5-5:medium",
        "openai-codex/gpt-6-astra:medium",
      ]),
    );
  }
});

test("each focused reviewer is read-only without MCP and only Sonnet loads the Claude bridge", () => {
  for (const [role, provider, model] of [
    ["review-correctness", "openai-codex", "gpt-6.1-sol"],
    ["review-quality", "claude-bridge", "claude-sonnet-5-5"],
    ["review-architecture", "openai-codex", "gpt-6.1-terra"],
    ["review-contract", "claude-bridge", "claude-sonnet-5-5"],
  ]) {
    const { contract, args } = launchArguments([
      role,
      provider,
      model,
      "medium",
    ]);
    assert.equal(contract.role, role);
    assert.equal(args.at(-1), "read,grep,find,ls", role);
    assert.ok(!args.some((v) => v.includes("pi-mcp-adapter")), role);
    assert.equal(
      args.includes("npm:pi-claude-bridge@0.9.3"),
      provider === "claude-bridge",
      role,
    );
    assert.throws(
      () =>
        launchArguments([
          role,
          provider,
          model,
          "medium",
          "--mcp-config",
          "/tmp/mcp.json",
        ]),
      /Unsupported managed Pi argument/,
      role,
    );
  }
  const env = launchEnvironment("claude-bridge", {
    ANTHROPIC_AUTH_TOKEN: "secret",
    CLAUDE_CODE_USE_VERTEX: "1",
  });
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.CLAUDE_CODE_USE_VERTEX, undefined);
  for (const name of ["bash", "edit", "write", "mcp", "mcp__agents__run"])
    assert.match(
      toolDenial("review-quality", name, { command: "ls" }, process.cwd()) ??
        "",
      /unavailable for fixed role review-quality/,
    );
  assert.equal(
    toolDenial("review-quality", "read", { path: "README.md" }, process.cwd()),
    undefined,
  );
});

test("consult planners have read tools plus MCP and no shell, fixed to one route, and only Fable loads the Claude bridge", () => {
  for (const [role, provider, model] of [
    ["planner-astra", "openai-codex", "gpt-6-astra"],
    ["planner-fable", "claude-bridge", "claude-fable-5-1"],
  ]) {
    const fixed = [role, provider, model, "medium"];
    const { contract, args } = launchArguments([...fixed]);
    assert.deepEqual(route({ contract, args }), fixed);
    assert.equal(args.at(-1), "read,grep,find,ls,mcp", role);
    assert.ok(args.includes("npm:pi-mcp-adapter@7.0.0"), role);
    assert.equal(
      args.includes("npm:pi-claude-bridge@0.9.3"),
      provider === "claude-bridge",
      role,
    );
    for (const tail of [
      ["--model", "claude-bridge/claude-opus-5-5"],
      ["--thinking", "high"],
      ["--provider", "anthropic"],
    ])
      assert.throws(
        () => launchArguments([...fixed, ...tail]),
        /override rejected/,
        `${role} ${tail.join(" ")}`,
      );
    for (const name of ["bash", "edit", "write"])
      assert.match(
        toolDenial(role, name, { command: "ls", path: "x" }, process.cwd()) ??
          "",
        new RegExp(`unavailable for fixed role ${role}`),
      );
    assert.equal(
      toolDenial(role, "read", { path: "README.md" }, process.cwd()),
      undefined,
    );
    assert.equal(
      toolDenial(role, "mcp", { search: "docs" }, process.cwd()),
      undefined,
    );
    assert.match(
      toolDenial(role, "mcp", { action: "install" }, process.cwd()) ?? "",
      /explicit operator handling/,
    );
    assert.match(
      toolDenial(
        role,
        "mcp",
        { tool: "mcp__agents__create_agent" },
        process.cwd(),
      ) ?? "",
      /bounded workflow runner/u,
    );
    assert.equal(
      toolDenial(role, "mcp__context7__query-docs", {}, process.cwd()),
      undefined,
    );
  }
  // Orchestrator and implementer MCP behavior is unchanged.
  for (const role of ["planner", "implementer"])
    assert.equal(
      toolDenial(role, "mcp", { tool: "agents_list_agents" }, process.cwd()),
      undefined,
    );
  assert.equal(
    launchArguments([
      "planner",
      "claude-bridge",
      "claude-opus-5-5",
      "medium",
    ]).args.at(-1),
    "read,grep,find,ls,bash,edit,write,mcp",
  );
  const env = launchEnvironment("claude-bridge", {
    ANTHROPIC_API_KEY: "secret",
    CLAUDE_CODE_USE_FOUNDRY: "1",
  });
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
  assert.equal(env.CLAUDE_CODE_USE_FOUNDRY, undefined);
});

test("runtime model and thinking drift and unsupported reviewer tools are denied", () => {
  assert.equal(
    runtimeDenial(
      contract,
      { provider: contract.provider, id: contract.model },
      "low",
    ),
    undefined,
  );
  assert.ok(
    runtimeDenial(
      contract,
      { provider: contract.provider, id: "other" },
      "low",
    ),
  );
  assert.ok(
    runtimeDenial(
      contract,
      { provider: contract.provider, id: contract.model },
      "medium",
    ),
  );
  for (const name of [
    "bash",
    "write",
    "edit",
    "mcp",
    "mcp__agents__list_agents",
    "mcpScript",
    "agents_create_agent",
    "tool_search",
    "codemode",
    "unknown",
  ])
    assert.ok(toolDenial(contract.role, name, {}, process.cwd()));
  assert.equal(toolDenial(contract.role, "read", {}, process.cwd()), undefined);
  assert.ok(
    toolDenial(
      "implementer",
      "bash",
      { command: "git push --force" },
      process.cwd(),
    ),
  );
  assert.ok(
    toolDenial(
      "implementer",
      "bash",
      { command: "rm /tmp/outside" },
      process.cwd(),
    ),
  );
  assert.equal(
    toolDenial("implementer", "bash", { command: "git status" }, process.cwd()),
    undefined,
  );
  for (const tool of [
    "create_agent",
    "agents_create_agent",
    "agents.update_agent",
    "mcp__agents__respond_to_permission",
  ])
    assert.ok(toolDenial("orchestrator", "mcp", { tool }, process.cwd()));
  for (const role of writeRoles) {
    for (const name of [
      "mcp__agents__create_agent",
      "mcp__agents__update_agent",
      "mcp__agents__respond_to_permission",
    ])
      assert.match(
        toolDenial(role, name, {}, process.cwd()) ?? "",
        /bounded workflow runner/u,
      );
    assert.equal(
      toolDenial(role, "mcp__agents__list_agents", { action: "x" }, "/"),
      undefined,
    );
    for (const name of ["mcp__agents", "tool_search", "codemode"])
      assert.ok(toolDenial(role, name, {}, process.cwd()));
  }
  assert.ok(
    toolDenial("orchestrator", "mcp", { action: "install" }, process.cwd()),
  );
  assert.equal(
    toolDenial(
      "orchestrator",
      "mcp",
      { tool: "agents_list_agents" },
      process.cwd(),
    ),
    undefined,
  );
});

test("managed roles keep runner and quoted commands available", () => {
  for (const command of [
    'grep -n "hc run" skills/herdr-orchestration/references/workflow.md',
    "echo 'hc send t1; hc run task'",
    "node ~/.agents/skills/herdr-orchestration/scripts/workflow.ts state.json review input.json",
    '"$EDITOR" notes.md',
  ])
    for (const role of writeRoles)
      assert.equal(
        toolDenial(role, "bash", { command }, process.cwd()),
        undefined,
        command,
      );
});

test("herdr-core and the Herdr app are default-deny allow-lists for every managed role", () => {
  const cwd = process.cwd();
  const allowed = [
    "hc ls --json",
    "hc ls --all --label ax.workflow=w1",
    "hc get --json t1",
    "hc read --lines 40 t1",
    "hc wait t1 --timeout 10",
    "hc events",
    "hc templates",
    "hc schema",
    "hc machine ls",
    "hc file read t1 notes.md",
    "hc server status",
    "hc --help",
    "hc --skill",
    "hc -V",
    "herdr-core get --json t1",
    "~/.local/bin/hc ls",
    '"$HOME/.local/bin/hc" get t1',
    "env HC_SESSION=x hc ls",
    "sh -c 'hc ls --json'",
    "herdr-app ls",
    "herdr-app status",
    "herdr-app commands",
    "herdr-app shot /tmp/frame.png",
    "herdr-app --help",
    "herdr-app --skill",
    "herdr-app --version",
    '"$EDITOR" notes.md',
    '"$EDITOR" --wait notes.md',
    "$H --session x ls",
  ];
  const denied = [
    "hc",
    "hc run --bg -- pi",
    "hc send t1 hello",
    "hc keys t1 Enter",
    "hc interrupt t1",
    "hc kill t1",
    "hc rm t1",
    "hc label t1 a=b",
    "hc keep t1",
    "hc put t1 x",
    "hc exec t1 ls",
    "hc attach t1",
    "hc file write t1 notes.md",
    "hc file edit t1 notes.md",
    "hc server stop",
    "hc server restart",
    "hc update",
    "hc machine add box",
    "hc frobnicate",
    "hc --session x ls",
    "hc --help run",
    "hc $SUB t1",
    "herdr-core run -- pi",
    "/Users/me/.local/bin/hc send t1 x",
    '"$H" interrupt t1',
    "$H kill t1",
    "$H",
    "$H --session x run --bg -- pi",
    "$H --session=x run --bg -- pi",
    "$H --session x --verbose -q send t1 hi",
    '"$H" -q kill t1',
    "$H --session x $SUB t1",
    "env -S 'hc kill t1'",
    "sh -c 'hc run -- pi'",
    'sh -c "$PAYLOAD"',
    "herdr-app",
    "herdr-app do new-tab",
    "herdr-app check mods/x",
    "herdr-app feedback text",
    "herdr-app --frob ls",
    "herdr-app open",
  ];
  for (const role of writeRoles) {
    for (const command of allowed)
      assert.equal(
        toolDenial(role, "bash", { command }, cwd, "user"),
        undefined,
        `${role}: ${command}`,
      );
    for (const command of denied)
      assert.match(
        toolDenial(role, "bash", { command }, cwd, "user") ?? "",
        /^herdr-core policy: .*the workflow runner is the only dispatcher/u,
        `${role}: ${command}`,
      );
  }
});

test("write roles are denied compound shell commands, including nested shell payloads", () => {
  for (const command of [
    "git add a && git commit -m b",
    "git status || true",
    "git status; git diff",
    "git log | head",
    "sleep 5 &",
    "echo $(git rev-parse HEAD)",
    'echo "$(git rev-parse HEAD)"',
    "echo `git rev-parse HEAD`",
    "(cd /tmp)",
    "git status\ngit diff",
    "git commit -F - <<EOF\nsubject\nEOF",
    "sh -c 'a && b'",
    "bash -lc 'a; b'",
    "env -S 'git status; git diff'",
    'sh -c "$SCRIPT"',
  ]) {
    for (const role of writeRoles)
      assert.match(
        toolDenial(role, "bash", { command }, process.cwd()) ?? "",
        /^Shell discipline .*one command per tool call/u,
        command,
      );
  }
  for (const command of [
    "git status",
    "sh -c 'git status'",
    "echo 'a && b; c | d'",
    'grep -n "a;b" notes.md',
    "pnpm run test:unit 2>&1",
    "git status &>/dev/null",
    "git status\n",
    'echo "$HOME"',
    "find . -name '*.ts' -exec true {} \\;",
    "printf '%s' '$(literal)'",
    "echo '`literal`'",
  ])
    for (const role of writeRoles)
      assert.equal(
        toolDenial(role, "bash", { command }, process.cwd()),
        undefined,
        command,
      );
  assert.match(
    toolDenial(
      "implementer",
      "bash",
      { command: "git status && git push --force" },
      process.cwd(),
    ) ?? "",
    /^Force-push policy/u,
  );
  assert.match(
    toolDenial(
      "implementer",
      "bash",
      { command: "git status && rm /tmp/outside" },
      process.cwd(),
    ) ?? "",
    /^Deletion policy/u,
  );
});

test("the orchestrator and its planner alias write only the plan and private task files outside Git work trees", () => {
  const cwd = process.cwd();
  const otherRepo = mkdtempSync(join(tmpdir(), "planner-other-repo-"));
  mkdirSync(join(otherRepo, ".git"));
  const task = mkdtempSync(join(tmpdir(), "planner-task-"));
  const cases = orchestratorRoles.flatMap((role) =>
    ["edit", "write"].map((name) => [role, name]),
  );
  try {
    for (const [role, name] of cases) {
      for (const path of [
        ".agents/plans/next-change.md",
        join(cwd, ".agents/plans/next-change.md"),
        join(task, "brief.md"),
      ])
        assert.equal(toolDenial(role, name, { path }, cwd), undefined, path);
      for (const path of [
        "hooks/pi/policy.ts",
        ".agents/plans/../../hooks/pi/policy.ts",
        ".agents/plan-notes.md",
        join(otherRepo, "src/index.ts"),
      ])
        assert.match(
          toolDenial(role, name, { path }, cwd) ?? "",
          /^Orchestrator policy: .* runner handoff or repair/u,
          path,
        );
      assert.match(toolDenial(role, name, {}, cwd) ?? "", /explicit path/u);
      assert.equal(
        toolDenial("implementer", name, { path: "hooks/pi/policy.ts" }, cwd),
        undefined,
      );
    }
  } finally {
    rmSync(otherRepo, { recursive: true, force: true });
    rmSync(task, { recursive: true, force: true });
  }
});

test("the orchestrator and its planner alias cannot change branch content through git, but keep read-only git and publication", () => {
  const cwd = process.cwd();
  for (const command of [
    "git commit -m change",
    "git -C /repo add .",
    "git -c core.editor=true merge main",
    "git rebase main",
    "git pull",
    "git pull origin main",
    "git stash push -u -m tag",
    "git checkout -b topic",
    "git switch main",
    "git restore notes.md",
    "git reset --hard HEAD",
    "git cherry-pick abc123",
    "git revert abc123",
    "git am fix.patch",
    "git apply fix.patch",
    "git rm notes.md",
    "git mv a.md b.md",
    "git commit-tree HEAD^{tree} -m change",
    "git update-ref refs/heads/topic abc123",
    "git read-tree HEAD",
    "git checkout-index -a",
    "sh -c 'git commit -m change'",
    "env GIT_AUTHOR_NAME=x git commit -m change",
    '"$GIT" commit -m change',
  ])
    for (const role of orchestratorRoles)
      assert.match(
        toolDenial(role, "bash", { command }, cwd) ?? "",
        /^Orchestrator policy: `git [a-z-]+` changes branch content/u,
        command,
      );
  for (const command of [
    "git status",
    "git diff --stat",
    "git log --oneline -5",
    "git rev-parse HEAD",
    "git fetch origin",
    "git pull --ff-only origin main",
    "git push -u origin HEAD",
    "gh pr create --draft --title change --body-file body.md",
    "echo 'git commit -m change'",
  ])
    for (const role of orchestratorRoles)
      assert.equal(
        toolDenial(role, "bash", { command }, cwd),
        undefined,
        command,
      );
  assert.equal(
    toolDenial("implementer", "bash", { command: "git commit -m x" }, cwd),
    undefined,
  );
  for (const role of orchestratorRoles) {
    assert.equal(
      toolDenial(role, "bash", { command: "git commit -m x" }, cwd, "user"),
      undefined,
    );
    assert.match(
      toolDenial(role, "bash", { command: "git add a && git commit" }, cwd) ??
        "",
      /^Shell discipline/u,
    );
  }
});

test("the orchestrator and its planner alias cannot change dependencies, but keep scripts and tools", () => {
  const cwd = process.cwd();
  const denied = [
    "pnpm install",
    "pnpm i",
    "pnpm add left-pad",
    "pnpm remove left-pad",
    "pnpm rm left-pad",
    "pnpm uninstall left-pad",
    "pnpm update",
    "pnpm up --latest",
    "npm install",
    "npm i left-pad",
    "npm ci",
    "npm uninstall left-pad",
    "npm update",
    "npm --prefix packages/app install",
    "npm --prefix=packages/app install",
    "npm -g install left-pad",
    "pnpm --dir packages/app add left-pad",
    "pnpm -C packages/app add left-pad",
    "pnpm --filter app add left-pad",
    "pnpm -r --filter app update",
    "/usr/local/bin/pnpm add left-pad",
    "env CI=1 pnpm install",
    "sh -c 'pnpm add left-pad'",
    "bash -lc 'npm --prefix app ci'",
    "env -S 'pnpm add left-pad'",
    "pnpm $ACTION left-pad",
    '"$PM" install left-pad',
    '"$PM" --filter app add left-pad',
    '"$PM" --prefix app install',
    '"$PM" -r up',
    "pnpm --unknown-option add left-pad",
    "npm --unknown value install",
    "pnpm --unknown=value run test",
    "npm --unknown=value run build",
    "pnpm -Cpackages/app add left-pad",
    "pnpm --dir $X run test",
    'pnpm -C "$X" run test',
    "pnpm --filter $PKG run build",
    "npm --prefix $X run test",
    "pnpm --dir",
  ];
  for (const role of orchestratorRoles)
    for (const command of denied)
      assert.match(
        toolDenial(role, "bash", { command }, cwd) ?? "",
        /^Orchestrator policy: package-manager `[^`]+` changes dependencies/u,
        command,
      );
  for (const command of [
    "pnpm run test:unit",
    "pnpm exec biome check .",
    "pnpm dlx cowsay hi",
    "npm run build",
    "npx tsc --noEmit",
    "pnpm --dir packages/app run test",
    "pnpm --dir=packages/app run test",
    "npm --prefix=packages/app run build",
    "pnpm -C packages/app exec tsc",
    "pnpm --filter app run build",
    "npm --prefix packages/app run build",
    "pnpm --dir app run test",
    "npm --prefix app run test",
    "pnpm --version",
    "npm -v",
    "pnpm list",
    "npm view left-pad version",
    "echo 'pnpm add left-pad'",
  ])
    for (const role of writeRoles)
      assert.equal(
        toolDenial(role, "bash", { command }, cwd),
        undefined,
        command,
      );
  // The herdr-core policy separately denies a dynamic executable followed, even after options, by a herdr subcommand such as `run`, `exec`, or `update`.
  assert.equal(findDependencyChange('"$PM" run test'), undefined);
  assert.equal(findDependencyChange('"$PM" exec vitest'), undefined);
  for (const role of writeRoles)
    for (const command of ['"$PM" exec vitest', '"$PM" -r update'])
      assert.match(
        toolDenial(role, "bash", { command }, cwd) ?? "",
        /^herdr-core policy/u,
        `${role}: ${command}`,
      );
  for (const command of [
    ...denied.filter((command) => !command.includes("$")),
    '"$PM" --filter app add left-pad',
    '"$PM" --prefix app install',
    '"$PM" -r up',
  ])
    assert.equal(
      toolDenial("implementer", "bash", { command }, cwd),
      undefined,
      command,
    );
  assert.equal(
    toolDenial("orchestrator", "bash", { command: "pnpm add x" }, cwd, "user"),
    undefined,
  );
});

test("compound denial applies to agent shell calls, not a person's own commands", () => {
  const f = fixture();
  const savedContract = process.env.AX_PI_CONTRACT;
  const savedWorkflow = process.env.AX_PI_WORKFLOW_FILE;
  try {
    const implementer = parseContract({
      ...contract,
      role: "implementer",
      model: "gpt-6.1-sol",
      thinking: "medium",
    });
    process.env.AX_PI_CONTRACT = JSON.stringify(implementer);
    process.env.AX_PI_WORKFLOW_FILE = join(
      f.root,
      "skills/herdr-orchestration/references/workflow.md",
    );
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    enforcement({
      on: (name, handler) =>
        handlers.set(name, handler as (...args: unknown[]) => unknown),
      getThinkingLevel: () => "medium",
      getAllTools: () => [],
      setActiveTools: () => {},
    });
    const ctx = {
      cwd: f.root,
      model: { provider: implementer.provider, id: implementer.model },
    };
    const compound = "git status && git diff";
    assert.equal(
      handlers.get("user_bash")?.({ command: compound }, ctx),
      undefined,
    );
    const agent = handlers.get("tool_call")?.(
      { toolName: "bash", input: { command: compound } },
      ctx,
    ) as { block: boolean; reason: string };
    assert.equal(agent.block, true);
    assert.match(agent.reason, /^Shell discipline/u);
    const dispatch = handlers.get("user_bash")?.(
      { command: "hc run task" },
      ctx,
    ) as { result: { output: string; exitCode: number } };
    assert.equal(dispatch.result.exitCode, 1);
    assert.match(dispatch.result.output, /^herdr-core policy/u);
  } finally {
    if (savedContract === undefined) delete process.env.AX_PI_CONTRACT;
    else process.env.AX_PI_CONTRACT = savedContract;
    if (savedWorkflow === undefined) delete process.env.AX_PI_WORKFLOW_FILE;
    else process.env.AX_PI_WORKFLOW_FILE = savedWorkflow;
    rmSync(f.root, { recursive: true, force: true });
  }
});

function fixture(): { root: string; launcher: string; env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(join(tmpdir(), "pi-enforcement-"));
  cpSync(resolve("hooks"), join(root, "hooks"), { recursive: true });
  const references = join(root, "skills/herdr-orchestration/references");
  mkdirSync(references, { recursive: true });
  writeFileSync(
    join(references, "workflow.md"),
    "One local review pass. Publish Ready. Never merge.",
  );
  mkdirSync(join(root, "bin"));
  const fake = join(root, "bin/pi");
  writeFileSync(
    fake,
    `#!${process.execPath}
const fs = require('node:fs');
if (process.env.FAKE_PI_MODE === 'no-handshake') { setTimeout(() => process.exit(0), 30); }
else {
 const c = JSON.parse(process.env.AX_PI_CONTRACT);
 fs.writeSync(3, JSON.stringify({ready:true,nonce:c.nonce})+'\\n');
 setTimeout(() => process.exit(0), 30);
}
`,
  );
  chmodSync(fake, 0o755);
  return {
    root,
    launcher: join(root, "hooks/pi/launch.ts"),
    env: {
      ...process.env,
      PATH: `${join(root, "bin")}:${process.env.PATH}`,
      AX_PI_CONTRACT: "untrusted override",
      AX_PI_WORKFLOW_FILE: "/missing",
    },
  };
}

test("interactive launch waits for the adapter handshake and fails closed without it", () => {
  const f = fixture();
  try {
    const result = spawnSync(process.execPath, [f.launcher, ...baseArgs], {
      env: f.env,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(result.status, 0, result.stderr);
    const missing = spawnSync(process.execPath, [f.launcher, ...baseArgs], {
      env: { ...f.env, FAKE_PI_MODE: "no-handshake" },
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(missing.status, 78, missing.stderr);
    assert.match(missing.stderr, /without mandatory adapter/u);
    rmSync(join(f.root, "hooks/pi/enforcement.ts"));
    const absent = spawnSync(process.execPath, [f.launcher, ...baseArgs], {
      env: f.env,
      encoding: "utf8",
      timeout: 5000,
    });
    assert.equal(absent.status, 78);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("MCP config reaches the pinned adapter only for nonreview roles", () => {
  for (const fixed of [
    ["planner", "openai-codex", "gpt-6-astra", "medium"],
    ["implementer", "claude-bridge", "claude-opus-5-5", "medium"],
    ["planner-astra", "openai-codex", "gpt-6-astra", "medium"],
  ]) {
    for (const tail of [
      ["--mcp-config", "/tmp/caller mcp.json"],
      ["--mcp-config=/tmp/caller mcp.json"],
    ]) {
      const result = launchArguments([...fixed, ...tail]);
      const index = result.args.indexOf("--mcp-config");
      assert.notEqual(index, -1);
      assert.equal(result.args[index + 1], "/tmp/caller mcp.json");
      assert.ok(result.args.includes("npm:pi-mcp-adapter@7.0.0"));
    }
    assert.throws(
      () => launchArguments([...fixed, "--mcp-config"]),
      /Missing value/,
    );
  }
  assert.throws(
    () =>
      launchArguments([
        "review-correctness",
        "openai-codex",
        "gpt-6.1-sol",
        "medium",
        "--mcp-config",
        "/tmp/mcp.json",
      ]),
    /Unsupported managed Pi argument/,
  );
});

test("adapter injects the canonical workflow section once and retains other prompt sections", () => {
  const f = fixture();
  const savedContract = process.env.AX_PI_CONTRACT;
  const savedWorkflow = process.env.AX_PI_WORKFLOW_FILE;
  try {
    process.env.AX_PI_CONTRACT = JSON.stringify(contract);
    process.env.AX_PI_WORKFLOW_FILE = join(
      f.root,
      "skills/herdr-orchestration/references/workflow.md",
    );
    const handlers = new Map<string, (...args: unknown[]) => unknown>();
    enforcement({
      on: (name, handler) =>
        handlers.set(name, handler as (...args: unknown[]) => unknown),
      getThinkingLevel: () => "low",
      getAllTools: () => [],
      setActiveTools: () => {},
    });
    const ctx = {
      cwd: f.root,
      model: { provider: contract.provider, id: contract.model },
    };
    const sections: Record<string, string> = { host: "Host original" };
    handlers.get("before_agent_start")?.(
      { systemPromptOptions: { sections } },
      ctx,
    );
    handlers.get("before_agent_start")?.(
      { systemPromptOptions: { sections } },
      ctx,
    );
    assert.equal(sections.host, "Host original");
    assert.match(
      sections["ax-herdr-workflow"],
      /^Active fixed Pi\/herdr-core role: review-astra\./u,
    );
    assert.match(sections["ax-herdr-workflow"], /Publish Ready/u);
    assert.equal(
      sections["ax-herdr-workflow"].split("Active fixed Pi/herdr-core role")
        .length,
      2,
    );
    const blocked = handlers.get("tool_call")?.(
      { toolName: "bash", input: { command: "git status" } },
      ctx,
    ) as { block: boolean };
    assert.equal(blocked.block, true);
  } finally {
    if (savedContract === undefined) delete process.env.AX_PI_CONTRACT;
    else process.env.AX_PI_CONTRACT = savedContract;
    if (savedWorkflow === undefined) delete process.env.AX_PI_WORKFLOW_FILE;
    else process.env.AX_PI_WORKFLOW_FILE = savedWorkflow;
    rmSync(f.root, { recursive: true, force: true });
  }
});
