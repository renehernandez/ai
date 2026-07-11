import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { parse } from "smol-toml";
import { renderAgentRuntime } from "../../scripts/ax/agent-runtime.ts";
import {
  type CoordinatorPolicy,
  evaluateCoordinatorTool,
} from "../../scripts/ax/coordinator-policy.ts";
import {
  readCoordinatorRegistration,
  renderCoordinatorProjects,
  validateCoordinatorRegistration,
  writeCoordinatorRegistration,
} from "../../scripts/ax/coordinator-project-runtime.ts";

function withTempDir(callback: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "coordinator-runtime-"));
  try {
    callback(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function policy(kind: "delivery" | "operations"): CoordinatorPolicy {
  return {
    policyVersion: "1.0.0",
    kind,
    promptRoles: kind === "delivery" ? ["delivery-ea"] : ["operations-ea"],
    apps: kind === "delivery" ? ["linear"] : ["gmail", "linear"],
    linear: {
      team: "Rene",
      teamId: "team-id",
      project: "Rene — Work Portfolio",
      projectId: "project-id",
      issuePrefix: "RENE-",
      recordFields: {
        root: [
          "record_type",
          "id",
          "created_at",
          "classification",
          "summary",
          "rendered_prompt_sha256",
        ],
        memory: [
          "record_type",
          "id",
          "created_at",
          "classification",
          "summary",
        ],
        workstream: [
          "record_type",
          "id",
          "created_at",
          "classification",
          "summary",
        ],
        run: ["record_type", "id", "created_at", "classification", "summary"],
        decision: [
          "record_type",
          "id",
          "created_at",
          "classification",
          "summary",
        ],
        escalation: [
          "record_type",
          "id",
          "created_at",
          "classification",
          "summary",
        ],
      },
    },
  };
}

function preCreatePrompt(
  projectId = "saved-project",
  kind: "delivery" | "operations" = "delivery",
): string {
  const activation = JSON.stringify({
    activation_phase: "pre_create",
    codex_task_id: null,
    prompt_contract_version: "3.0.0",
    control_project_kind: kind,
    control_project_id: projectId,
    control_project_path: `/control/${kind}`,
    control_policy_sha256: "a".repeat(64),
    control_source_sha256: "b".repeat(64),
    control_permission_profile: "coordinator-readonly",
    rendered_prompt_sha256: "c".repeat(64),
  });
  return `Load .agents/prompts/delivery-ea.md\nAGENT_CONTEXT_V2\nACTIVATION ${Buffer.byteLength(activation, "utf-8")}\n${activation}\n`;
}

test("renders both exact coordinator projects with pinned prompt bundles", () => {
  withTempDir((root) => {
    const agents = join(root, "agents");
    const projects = join(root, "projects");
    renderAgentRuntime({ sourceDir: resolve("agents"), outputDir: agents });
    const targets = {
      delivery: join(projects, "delivery"),
      operations: join(projects, "operations"),
    };
    const result = renderCoordinatorProjects({
      sourceDir: resolve("coordinator-projects"),
      agentSourceDir: resolve("agents"),
      renderedAgentsDir: agents,
      outputDir: projects,
      targets,
    });

    assert.deepEqual(result.projects, ["delivery", "operations"]);
    assert.match(result.policyHashes.delivery, /^[a-f0-9]{64}$/);
    assert.deepEqual(
      readdirSync(join(projects, "delivery", ".agents", "prompts")).sort(),
      [
        "delivery-ea.md",
        "gitlab-project-manager.md",
        "linear-project-manager.md",
        "squad-lead.md",
      ],
    );
    assert.deepEqual(
      readdirSync(join(projects, "operations", ".agents", "prompts")),
      ["operations-ea.md"],
    );
    const config = parse(
      readFileSync(
        join(projects, "delivery", ".codex", "config.toml"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    assert.equal(config.default_permissions, "coordinator-readonly");
    assert.equal(config.approval_policy, "never");
    const deliveryApps = config.apps as Record<string, Record<string, unknown>>;
    const linear = deliveryApps.asdk_app_69a089a326dc8191b32a3f2553f5be2c;
    assert.equal(linear.destructive_enabled, true);
    assert.equal(
      (linear.tools as Record<string, Record<string, unknown>>)
        .linear_save_issue.approval_mode,
      "auto",
    );
    assert.equal(
      (linear.tools as Record<string, Record<string, unknown>>)
        .linear_save_comment.approval_mode,
      "auto",
    );
    assert.equal(deliveryApps._default.destructive_enabled, false);
    const deliveryPolicy = JSON.parse(
      readFileSync(join(projects, "delivery", "policy.json"), "utf-8"),
    ) as {
      policy: { linear: { recordFields: Record<string, string[]> } };
    };
    assert.ok(
      deliveryPolicy.policy.linear.recordFields.root.includes(
        "rendered_prompt_sha256",
      ),
    );
    assert.ok(
      deliveryPolicy.policy.linear.recordFields.root.includes(
        "control_policy_sha256",
      ),
    );
    assert.ok(
      deliveryPolicy.policy.linear.recordFields.root.includes(
        "control_source_sha256",
      ),
    );
    const operationsConfig = parse(
      readFileSync(
        join(projects, "operations", ".codex", "config.toml"),
        "utf-8",
      ),
    ) as Record<string, unknown>;
    const operationsApps = operationsConfig.apps as Record<
      string,
      Record<string, unknown>
    >;
    assert.equal(
      operationsApps.asdk_app_69a089a326dc8191b32a3f2553f5be2c
        .destructive_enabled,
      true,
    );
    assert.equal(
      operationsApps.connector_2128aebfecb84f64a069897515042a44
        .destructive_enabled,
      false,
    );
    assert.equal(
      operationsApps.asdk_app_69a1d78e929881919bba0dbda1f6436d
        .destructive_enabled,
      false,
    );
    assert.equal(
      operationsApps.connector_947e0d954944416db111db556030eea6
        .destructive_enabled,
      false,
    );
    const marker = JSON.parse(
      readFileSync(join(projects, "delivery", ".ax-managed.json"), "utf-8"),
    ) as Record<string, unknown>;
    assert.equal(marker.target, targets.delivery);
    assert.equal(marker.policy_sha256, result.policyHashes.delivery);

    const discovery = execFileSync(
      process.execPath,
      [
        join(projects, "delivery", ".codex", "hooks", "coordinator-policy.mjs"),
        "--agent-discovery",
      ],
      { encoding: "utf-8" },
    );
    assert.equal(
      JSON.parse(discovery).policySha256,
      result.policyHashes.delivery,
    );
    const hookDecision = execFileSync(
      process.execPath,
      [join(projects, "delivery", ".codex", "hooks", "coordinator-policy.mjs")],
      {
        encoding: "utf-8",
        input: JSON.stringify({
          tool_name: "Bash",
          tool_input: { command: "glab mr merge 1" },
        }),
      },
    );
    assert.equal(
      JSON.parse(hookDecision).hookSpecificOutput.permissionDecision,
      "deny",
    );

    const registration = writeCoordinatorRegistration({
      runtimeRoot: join(root, "runtime-state"),
      targets,
      projectIds: {
        delivery: "desktop-delivery",
        operations: "desktop-operations",
      },
      now: new Date("2026-07-11T20:00:00Z"),
    });
    assert.equal(
      registration.projects[0].registered_at,
      "2026-07-11T20:00:00.000Z",
    );
    assert.deepEqual(
      validateCoordinatorRegistration({
        registration: readCoordinatorRegistration(join(root, "runtime-state")),
        targets,
      }),
      [],
    );
    assert.deepEqual(
      validateCoordinatorRegistration({
        registration: {
          ...registration,
          projects: [...registration.projects, registration.projects[0]],
        },
        targets,
      }),
      ["coordinator_registration_inventory_invalid"],
    );
  });
});

test("delivery policy allows typed control records and denies authority expansion", () => {
  const delivery = policy("delivery");
  const rootBody = [
    "- `record_type`: root",
    "- `id`: root-1",
    "- `created_at`: 2026-07-11T20:00:00Z",
    "- `classification`: internal",
    "- `summary`: Delivery root",
    `- \`rendered_prompt_sha256\`: ${"a".repeat(64)}`,
  ].join("\n");
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: {
          team: "Rene",
          project: "project-id",
          title: "Root Agent Record",
          description: rootBody,
        },
      },
      delivery,
    ).decision,
    "allow",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: { id: "RENE-3", description: rootBody },
      },
      delivery,
    ).decision,
    "allow",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: { id: "RENE-3", labels: ["record:root"] },
      },
      delivery,
    ).decision,
    "allow",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: { id: "RENE-3", labels: ["priority:urgent"] },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: { id: "RENE-3", labels: [] },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: {
          id: "RENE-3",
          labels: ["record:root", "record:root"],
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: { id: "RENE-not-an-id", description: rootBody },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: { id: "RENE-3", state: "Canceled" },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: {
          team: "Rene",
          project: "project-id",
          title: "Root Agent Record",
          description: rootBody,
          blockedBy: ["RENE-1"],
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: {
          team: "Rene",
          project: "project-id",
          title: " ",
          description: rootBody,
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_bulk_linear_save_issue",
        tool_input: {
          team: "Rene",
          project: "project-id",
          title: "Root Agent Record",
          description: rootBody,
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: {
          team: "Other",
          project: "project-id",
          title: "Escape",
          description: rootBody,
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      { tool_name: "Bash", tool_input: { command: "glab mr merge 1" } },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__linear_save_issue",
        tool_input: {
          team: "Rene",
          project: "project-id",
          title: "Incomplete record",
          description: "- `record_type`: root",
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "codex_app__create_thread",
        tool_input: {
          prompt: preCreatePrompt(),
          target: { type: "project", projectId: "saved-project" },
        },
      },
      delivery,
    ).decision,
    "allow",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "codex_app__create_thread",
        tool_input: { prompt: "start", target: { type: "projectless" } },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "codex_app__create_thread",
        tool_input: {
          prompt:
            'Comment only: PROMPT_CONTRACT_VERSION=3.0.0 {"activation_phase":"pre_create"}',
          target: { type: "project", projectId: "saved-project" },
        },
      },
      delivery,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "codex_app__create_thread",
        tool_input: {
          prompt: preCreatePrompt("registered-project"),
          target: { type: "project", projectId: "different-project" },
        },
      },
      delivery,
    ).decision,
    "deny",
  );
});

test("operations policy permits provider reads but no provider writes", () => {
  const operations = policy("operations");
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__gmail_search_emails",
        tool_input: { query: "after:2026/07/10" },
      },
      operations,
    ).decision,
    "allow",
  );
  assert.equal(
    evaluateCoordinatorTool(
      {
        tool_name: "mcp__codex_apps__slack_send_message",
        tool_input: { channel: "C1", message: "send" },
      },
      operations,
    ).decision,
    "deny",
  );
  assert.equal(
    evaluateCoordinatorTool(
      { tool_name: undefined, tool_input: {} },
      operations,
    ).decision,
    "deny",
  );
});

test("coordinator policies fail closed across declared tool classes", () => {
  const cases: Array<{
    name: string;
    kind: "delivery" | "operations";
    tool_name: string;
    tool_input: Record<string, unknown>;
    expected: "allow" | "deny";
  }> = [
    {
      name: "delivery Linear read",
      kind: "delivery",
      tool_name: "mcp__codex_apps__linear_list_issues",
      tool_input: { project: "project-id" },
      expected: "allow",
    },
    {
      name: "delivery Linear control comment",
      kind: "delivery",
      tool_name: "mcp__codex_apps__linear_save_comment",
      tool_input: { issueId: "RENE-12", body: "Activation evidence" },
      expected: "allow",
    },
    {
      name: "delivery Linear comment write lookalike",
      kind: "delivery",
      tool_name: "mcp__codex_apps__linear_bulk_linear_save_comment",
      tool_input: { issueId: "RENE-12", body: "Activation evidence" },
      expected: "deny",
    },
    {
      name: "delivery foreign Linear comment",
      kind: "delivery",
      tool_name: "mcp__codex_apps__linear_save_comment",
      tool_input: { issueId: "ENG-12", body: "Escape" },
      expected: "deny",
    },
    {
      name: "delivery Linear comment with unsupported field",
      kind: "delivery",
      tool_name: "mcp__codex_apps__linear_save_comment",
      tool_input: {
        issueId: "RENE-12",
        body: "Activation evidence",
        id: "comment-1",
      },
      expected: "deny",
    },
    {
      name: "delivery unsupported Linear mutation",
      kind: "delivery",
      tool_name: "mcp__codex_apps__linear_delete_issue",
      tool_input: { id: "RENE-12" },
      expected: "deny",
    },
    {
      name: "delivery task read",
      kind: "delivery",
      tool_name: "codex_app__list_projects",
      tool_input: {},
      expected: "allow",
    },
    {
      name: "delivery task message",
      kind: "delivery",
      tool_name: "codex_app__send_message_to_thread",
      tool_input: { threadId: "task-1", message: "ASSIGN" },
      expected: "allow",
    },
    {
      name: "delivery external provider read",
      kind: "delivery",
      tool_name: "mcp__codex_apps__gmail_search_emails",
      tool_input: { query: "newer_than:1d" },
      expected: "deny",
    },
    {
      name: "delivery file mutation",
      kind: "delivery",
      tool_name: "Write",
      tool_input: { file_path: "/tmp/a", content: "x" },
      expected: "deny",
    },
    {
      name: "operations Gmail read",
      kind: "operations",
      tool_name: "mcp__codex_apps__gmail_search_emails",
      tool_input: { query: "newer_than:1d" },
      expected: "allow",
    },
    {
      name: "operations Slack read",
      kind: "operations",
      tool_name: "mcp__codex_apps__slack_slack_search_public",
      tool_input: { query: "follow up" },
      expected: "allow",
    },
    {
      name: "operations Calendar read",
      kind: "operations",
      tool_name: "mcp__codex_apps__google_calendar_search_events",
      tool_input: {},
      expected: "allow",
    },
    {
      name: "operations Gmail write",
      kind: "operations",
      tool_name: "mcp__codex_apps__gmail_send_email",
      tool_input: { to: ["person@example.com"] },
      expected: "deny",
    },
    {
      name: "operations Slack write",
      kind: "operations",
      tool_name: "mcp__codex_apps__slack_slack_send_message",
      tool_input: { channel: "C1", message: "send" },
      expected: "deny",
    },
    {
      name: "operations Calendar write",
      kind: "operations",
      tool_name: "mcp__codex_apps__google_calendar_create_event",
      tool_input: { summary: "Meeting" },
      expected: "deny",
    },
    {
      name: "unknown tool",
      kind: "operations",
      tool_name: "mcp__codex_apps__unknown_fetch",
      tool_input: {},
      expected: "deny",
    },
    {
      name: "compound Gmail read and write name",
      kind: "operations",
      tool_name: "mcp__codex_apps__gmail_search_and_delete",
      tool_input: {},
      expected: "deny",
    },
    {
      name: "nonlinear read lookalike",
      kind: "delivery",
      tool_name: "mcp__codex_apps__my_nonlinear_search",
      tool_input: {},
      expected: "deny",
    },
  ];

  for (const fixture of cases) {
    assert.equal(
      evaluateCoordinatorTool(
        { tool_name: fixture.tool_name, tool_input: fixture.tool_input },
        policy(fixture.kind),
      ).decision,
      fixture.expected,
      fixture.name,
    );
  }
});
