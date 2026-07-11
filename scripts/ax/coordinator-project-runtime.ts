import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { parse } from "smol-toml";
import {
  canonicalJson,
  sha256,
} from "../../skills/agent-workspace/scripts/prompt-contract.ts";
import {
  type CoordinatorKind,
  type CoordinatorPolicy,
  coordinatorPolicySha256,
  renderCoordinatorPolicyHook,
} from "./coordinator-policy.ts";
import { hashPath } from "./source-snapshot.ts";

type CoordinatorSourceManifest = {
  schema_version: 1;
  policy_version: string;
  linear_control_plane: {
    team: string;
    team_id: string;
    project: string;
    project_id: string;
    issue_prefix: string;
  };
  projects: Array<{
    kind: CoordinatorKind;
    display_name: string;
    prompt_roles: string[];
    apps: string[];
  }>;
};

export type CoordinatorTargets = Record<CoordinatorKind, string>;

export type CoordinatorRenderResult = {
  policyHashes: Record<CoordinatorKind, string>;
  projects: CoordinatorKind[];
};

const EXPECTED_PROJECTS: CoordinatorKind[] = ["delivery", "operations"];

export function renderCoordinatorProjects(input: {
  sourceDir: string;
  agentSourceDir: string;
  renderedAgentsDir: string;
  outputDir: string;
  targets: CoordinatorTargets;
}): CoordinatorRenderResult {
  const sourceDir = resolve(input.sourceDir);
  const outputDir = resolve(input.outputDir);
  const manifest = JSON.parse(
    readFileSync(join(sourceDir, "manifest.json"), "utf-8"),
  ) as CoordinatorSourceManifest;
  validateManifest(manifest, sourceDir, input.renderedAgentsDir);
  rmSync(outputDir, { force: true, recursive: true });
  mkdirSync(outputDir, { recursive: true });
  const policyHashes = {} as Record<CoordinatorKind, string>;
  const recordFields = readRecordFields(input.agentSourceDir);

  for (const project of [...manifest.projects].sort((left, right) =>
    left.kind.localeCompare(right.kind),
  )) {
    const projectRoot = join(outputDir, project.kind);
    cpSync(join(sourceDir, project.kind), projectRoot, { recursive: true });
    const promptsRoot = join(projectRoot, ".agents", "prompts");
    mkdirSync(promptsRoot, { recursive: true });
    for (const role of [...project.prompt_roles].sort()) {
      cpSync(
        join(input.renderedAgentsDir, "pinned", `${role}.md`),
        join(promptsRoot, `${role}.md`),
      );
    }
    const policy: CoordinatorPolicy = {
      policyVersion: manifest.policy_version,
      kind: project.kind,
      promptRoles: [...project.prompt_roles].sort(),
      apps: [...project.apps].sort(),
      linear: {
        team: manifest.linear_control_plane.team,
        teamId: manifest.linear_control_plane.team_id,
        project: manifest.linear_control_plane.project,
        projectId: manifest.linear_control_plane.project_id,
        issuePrefix: manifest.linear_control_plane.issue_prefix,
        recordFields,
      },
    };
    const policyHash = coordinatorPolicySha256(policy);
    policyHashes[project.kind] = policyHash;
    const codexRoot = join(projectRoot, ".codex");
    mkdirSync(join(codexRoot, "hooks"), { recursive: true });
    writeFileSync(
      join(codexRoot, "config.toml"),
      renderConfig(project.apps),
      "utf-8",
    );
    const hookPath = join(
      resolve(input.targets[project.kind]),
      ".codex",
      "hooks",
      "coordinator-policy.mjs",
    );
    writeFileSync(
      join(codexRoot, "hooks.json"),
      `${JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher:
                  "^(Bash|apply_patch|Edit|Write|mcp__.*|codex_app__.*)$",
                hooks: [
                  {
                    type: "command",
                    command: `node ${shellQuote(hookPath)}`,
                    timeout: 30,
                    statusMessage: "Checking coordinator authority",
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
      join(codexRoot, "hooks", "coordinator-policy.mjs"),
      renderCoordinatorPolicyHook(policy),
      "utf-8",
    );
    writeFileSync(
      join(projectRoot, "policy.json"),
      `${JSON.stringify({ schema_version: 1, policy, policy_sha256: policyHash }, null, 2)}\n`,
      "utf-8",
    );
    const managedEntries = coordinatorManagedEntries(projectRoot);
    writeFileSync(
      join(projectRoot, ".ax-managed.json"),
      `${JSON.stringify(
        {
          schema_version: 1,
          asset: "coordinator-project",
          kind: project.kind,
          target: resolve(input.targets[project.kind]),
          policy_sha256: policyHash,
          source_fingerprint: sha256(canonicalJson(managedEntries)),
          managed_entries: managedEntries,
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
  }
  return { policyHashes, projects: [...EXPECTED_PROJECTS] };
}

function readRecordFields(agentSourceDir: string): Record<string, string[]> {
  const templatesDir = join(resolve(agentSourceDir), "templates", "linear");
  const result: Record<string, string[]> = {};
  for (const filename of readdirSync(templatesDir).sort()) {
    if (!filename.endsWith(".md")) {
      continue;
    }
    const fields = [
      ...readFileSync(join(templatesDir, filename), "utf-8").matchAll(
        /^- `([a-z_]+)`:/gmu,
      ),
    ]
      .map((match) => match[1])
      .filter((field): field is string => Boolean(field));
    const recordTypeLine = /^- `record_type`:\s*([a-z]+)$/mu.exec(
      readFileSync(join(templatesDir, filename), "utf-8"),
    );
    const recordType = recordTypeLine?.[1];
    if (!recordType || !RECORD_TYPES_FOR_TEMPLATES.has(recordType)) {
      throw new Error(`coordinator_record_template_invalid: ${filename}`);
    }
    if (new Set(fields).size !== fields.length || fields.length === 0) {
      throw new Error(
        `coordinator_record_template_fields_invalid: ${filename}`,
      );
    }
    result[recordType] = fields;
  }
  if (
    Object.keys(result).sort().join("\0") !==
    [...RECORD_TYPES_FOR_TEMPLATES].sort().join("\0")
  ) {
    throw new Error("coordinator_record_template_inventory_invalid");
  }
  return result;
}

const RECORD_TYPES_FOR_TEMPLATES = new Set([
  "root",
  "memory",
  "workstream",
  "run",
  "decision",
  "escalation",
]);

export function coordinatorManagedEntries(root: string): Array<{
  path: string;
  hash: string;
}> {
  const absoluteRoot = resolve(root);
  const paths: string[] = [];
  const visit = (path: string): void => {
    const rel = relative(absoluteRoot, path);
    if (rel === ".ax-managed.json") {
      return;
    }
    paths.push(path);
    if (!lstatSync(path).isDirectory()) {
      return;
    }
    for (const entry of readdirSync(path).sort()) {
      visit(join(path, entry));
    }
  };
  for (const entry of readdirSync(absoluteRoot).sort()) {
    visit(join(absoluteRoot, entry));
  }
  return paths.map((path) => ({
    path: relative(absoluteRoot, path),
    hash: hashPath(path),
  }));
}

function validateManifest(
  manifest: CoordinatorSourceManifest,
  sourceDir: string,
  renderedAgentsDir: string,
): void {
  if (manifest.schema_version !== 1 || !manifest.policy_version) {
    throw new Error("coordinator_manifest_invalid");
  }
  const kinds = manifest.projects.map((project) => project.kind).sort();
  if (kinds.join("\0") !== EXPECTED_PROJECTS.join("\0")) {
    throw new Error(
      `coordinator_project_inventory_invalid: ${kinds.join(",")}`,
    );
  }
  for (const project of manifest.projects) {
    if (!existsSync(join(sourceDir, project.kind, "AGENTS.md"))) {
      throw new Error(`coordinator_project_source_missing: ${project.kind}`);
    }
    if (project.prompt_roles.length === 0) {
      throw new Error(`coordinator_prompt_inventory_empty: ${project.kind}`);
    }
    for (const role of project.prompt_roles) {
      if (!existsSync(join(renderedAgentsDir, "pinned", `${role}.md`))) {
        throw new Error(`coordinator_pinned_prompt_missing: ${role}`);
      }
    }
  }
}

function renderConfig(apps: string[]): string {
  const lines = [
    'default_permissions = "coordinator-readonly"',
    'approval_policy = "never"',
    "",
    "[features]",
    "hooks = true",
    "",
    "[shell_environment_policy]",
    'inherit = "core"',
    "",
    "[permissions.coordinator-readonly]",
    'description = "Read-only coordinator project with no local network access."',
    'extends = ":read-only"',
    "",
    "[apps._default]",
    "enabled = false",
    "destructive_enabled = false",
    "open_world_enabled = false",
    'default_tools_approval_mode = "auto"',
  ];
  for (const app of [...apps].sort()) {
    lines.push(
      "",
      `[apps.${JSON.stringify(app)}]`,
      "enabled = true",
      `destructive_enabled = ${app === "linear" ? "true" : "false"}`,
      "open_world_enabled = false",
      'default_tools_approval_mode = "auto"',
    );
  }
  const config = `${lines.join("\n")}\n`;
  parse(config);
  return config;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function coordinatorRegistrationPath(runtimeRoot: string): string {
  return join(resolve(runtimeRoot), "control-projects.json");
}

export type CoordinatorRegistration = {
  schema_version: 1;
  projects: Array<{
    kind: CoordinatorKind;
    canonical_path: string;
    desktop_project_id: string;
    source_fingerprint: string;
    policy_sha256: string;
    registered_at: string;
  }>;
};

export function writeCoordinatorRegistration(input: {
  runtimeRoot: string;
  targets: CoordinatorTargets;
  projectIds: Record<CoordinatorKind, string>;
  now?: Date;
}): CoordinatorRegistration {
  const registeredAt = (input.now ?? new Date()).toISOString();
  const projects = EXPECTED_PROJECTS.map((kind) => {
    const canonicalPath = resolve(input.targets[kind]);
    const marker = JSON.parse(
      readFileSync(join(canonicalPath, ".ax-managed.json"), "utf-8"),
    ) as Record<string, unknown>;
    if (
      marker.kind !== kind ||
      marker.target !== canonicalPath ||
      typeof marker.source_fingerprint !== "string" ||
      typeof marker.policy_sha256 !== "string"
    ) {
      throw new Error(`coordinator_registration_target_invalid: ${kind}`);
    }
    const desktopProjectId = input.projectIds[kind]?.trim();
    if (!desktopProjectId) {
      throw new Error(`coordinator_registration_project_id_missing: ${kind}`);
    }
    return {
      kind,
      canonical_path: canonicalPath,
      desktop_project_id: desktopProjectId,
      source_fingerprint: marker.source_fingerprint,
      policy_sha256: marker.policy_sha256,
      registered_at: registeredAt,
    };
  });
  const registration: CoordinatorRegistration = {
    schema_version: 1,
    projects,
  };
  const path = coordinatorRegistrationPath(input.runtimeRoot);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(
      temporary,
      `${JSON.stringify(registration, null, 2)}\n`,
      "utf-8",
    );
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
  return registration;
}

export function validateCoordinatorRegistration(input: {
  registration: unknown;
  targets: CoordinatorTargets;
}): string[] {
  const findings: string[] = [];
  const registration = input.registration as Partial<CoordinatorRegistration>;
  if (
    registration?.schema_version !== 1 ||
    !Array.isArray(registration.projects)
  ) {
    return ["coordinator_registration_invalid: unsupported document shape"];
  }
  const byKind = new Map(
    registration.projects.map((project) => [project.kind, project]),
  );
  if (
    registration.projects.length !== EXPECTED_PROJECTS.length ||
    byKind.size !== registration.projects.length
  ) {
    findings.push("coordinator_registration_inventory_invalid");
  }
  for (const kind of EXPECTED_PROJECTS) {
    const project = byKind.get(kind);
    const target = resolve(input.targets[kind]);
    if (!project) {
      findings.push(`coordinator_registration_missing_project: ${kind}`);
      continue;
    }
    let marker: Record<string, unknown>;
    try {
      marker = JSON.parse(
        readFileSync(join(target, ".ax-managed.json"), "utf-8"),
      ) as Record<string, unknown>;
    } catch {
      findings.push(`coordinator_registration_target_missing: ${kind}`);
      continue;
    }
    if (
      project.canonical_path !== target ||
      typeof project.desktop_project_id !== "string" ||
      project.desktop_project_id.trim() === "" ||
      project.source_fingerprint !== marker.source_fingerprint ||
      project.policy_sha256 !== marker.policy_sha256
    ) {
      findings.push(`coordinator_registration_stale: ${kind}`);
    }
  }
  return findings;
}

export function readCoordinatorRegistration(
  runtimeRoot: string,
): unknown | undefined {
  const path = coordinatorRegistrationPath(runtimeRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function ensureCoordinatorParent(target: string): void {
  mkdirSync(dirname(resolve(target)), { recursive: true });
}
