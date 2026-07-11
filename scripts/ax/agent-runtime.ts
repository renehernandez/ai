import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { parse, stringify } from "smol-toml";
import {
  assertSchemaValid,
  canonicalJson,
  PROMPT_CONTRACT_VERSION,
  sha256,
} from "../../skills/agent-workspace/scripts/prompt-contract.ts";
import {
  generateAgentRolePoliciesSource,
  generateAgentValidatorsSource,
  roleToolPolicySha256,
} from "./generate-agent-validators.ts";

type ReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max" | "ultra";

type ModelProfile = {
  model: string;
  reasoning_effort: ReasoningEffort;
  automatic_ceiling: ReasoningEffort;
  manual_only: boolean;
};

type AgentRole = {
  id: string;
  description: string;
  lifecycle: "pinned" | "ephemeral";
  reports_to: string | null;
  charter: string;
  model_profile: string;
  allowed_profiles: string[];
  sandbox_mode: "read-only" | "workspace-write";
  capabilities: string[];
  required_skills: string[];
};

type ReviewerOverlay = { id: string; path: string };
type AgentOutput = {
  name: string;
  role: string;
  kind: "pinned_prompt_bundle" | "codex_custom_agent";
  model_profile?: string;
  reviewer_overlays?: string[];
};

type JsonSchema = {
  $defs?: Record<string, JsonSchema>;
  $ref?: string;
  allOf?: JsonSchema[];
  properties?: Record<string, unknown>;
  required?: string[];
};

export type AgentManifest = {
  schema_version: 1;
  prompt_contract_version: string;
  shared_contract: string;
  model_profiles: Record<string, ModelProfile>;
  roles: AgentRole[];
  reviewer_overlays: ReviewerOverlay[];
  outputs: AgentOutput[];
};

export type AgentValidationResult = {
  promptContractVersion: string;
  agentNames: string[];
  pinnedPromptNames: string[];
  automaticCeiling: "xhigh";
  manifest: AgentManifest;
};

export function hashStaticAgentDescriptor(value: unknown): string {
  return sha256(canonicalJson(value));
}

const REQUIRED_OUTPUTS = [
  "delivery-ea",
  "gitlab-project-manager",
  "implementer-quick",
  "implementer-standard",
  "linear-project-manager",
  "operations-ea",
  "operations-specialist",
  "researcher",
  "reviewer-migration-data",
  "reviewer-production",
  "reviewer-security",
  "reviewer-standard",
  "squad-lead",
];

const REQUIRED_PINNED_ROLES = [
  "delivery-ea",
  "gitlab-project-manager",
  "linear-project-manager",
  "operations-ea",
  "squad-lead",
];

const LINEAR_TEMPLATES: Record<string, string> = {
  root: "root-agent-record.md",
  memory: "memory-epoch.md",
  workstream: "workstream.md",
  run: "agent-run.md",
  decision: "decision.md",
  escalation: "escalation.md",
};

const EFFORT_ORDER: Record<ReasoningEffort, number> = {
  low: 0,
  medium: 1,
  high: 2,
  xhigh: 3,
  max: 4,
  ultra: 5,
};

export function validateAgentSource(
  sourceDir: string,
  overrides: { generatedPolicies?: string } = {},
): AgentValidationResult {
  const root = resolve(sourceDir);
  const manifestPath = join(root, "manifest.json");
  const manifest = readJson(manifestPath) as AgentManifest;
  const generatedValidators = readFileSync(
    resolve(
      import.meta.dirname,
      "../../skills/agent-workspace/scripts/generated-validators.cjs",
    ),
    "utf-8",
  );
  let expectedValidators: string;
  try {
    expectedValidators = generateAgentValidatorsSource(root);
  } catch (error) {
    throw new Error(`agent_schema_compile_failed: ${String(error)}`);
  }
  if (generatedValidators !== expectedValidators) {
    throw new Error("agent_schema_validator_drift");
  }
  assertSchemaValid("manifest", manifest);
  const generatedPolicies = readFileSync(
    resolve(
      import.meta.dirname,
      "../../skills/agent-workspace/scripts/generated-role-policies.json",
    ),
    "utf-8",
  );
  if (
    (overrides.generatedPolicies ?? generatedPolicies) !==
    generateAgentRolePoliciesSource(root)
  ) {
    throw new Error("agent_role_policy_projection_drift");
  }
  validateLinearTemplates(
    root,
    readJson(
      join(root, "schemas", "workspace-record.schema.json"),
    ) as JsonSchema,
  );
  if (manifest.prompt_contract_version !== PROMPT_CONTRACT_VERSION) {
    throw new Error(
      `prompt_contract_version_mismatch: ${manifest.prompt_contract_version} != ${PROMPT_CONTRACT_VERSION}`,
    );
  }

  const roles = uniqueMap(manifest.roles, "role");
  const overlays = uniqueMap(manifest.reviewer_overlays, "reviewer overlay");
  const outputs = uniqueMap(manifest.outputs, "agent output", "name");
  assertExactInventory(
    [...outputs.keys()].sort(),
    REQUIRED_OUTPUTS,
    "agent output",
  );
  for (const required of REQUIRED_PINNED_ROLES) {
    if (roles.get(required)?.lifecycle !== "pinned") {
      throw new Error(`required_pinned_role_missing: ${required}`);
    }
  }

  const shared = safeSourceFile(root, manifest.shared_contract);
  if (!existsSync(shared)) {
    throw new Error(`agent_fragment_missing: ${manifest.shared_contract}`);
  }
  for (const role of roles.values()) {
    safeExistingMarkdown(root, role.charter);
    assertProfileReferences(manifest, role);
    if (
      role.reports_to !== null &&
      role.reports_to !== "rene" &&
      !roles.has(role.reports_to)
    ) {
      throw new Error(
        `agent_role_unknown_reporting_line: ${role.id} -> ${role.reports_to}`,
      );
    }
  }
  for (const overlay of overlays.values()) {
    safeExistingMarkdown(root, overlay.path);
  }
  for (const output of outputs.values()) {
    const role = roles.get(output.role);
    if (!role) {
      throw new Error(
        `agent_output_unknown_role: ${output.name} -> ${output.role}`,
      );
    }
    const profileName = output.model_profile ?? role.model_profile;
    const profile = manifest.model_profiles[profileName];
    if (!profile || !role.allowed_profiles.includes(profileName)) {
      throw new Error(
        `agent_output_invalid_profile: ${output.name} -> ${profileName}`,
      );
    }
    if (
      profile.manual_only ||
      ["max", "ultra"].includes(profile.reasoning_effort)
    ) {
      throw new Error(
        `agent_output_manual_profile: ${output.name} -> ${profileName}`,
      );
    }
    const expectedKind =
      role.lifecycle === "pinned"
        ? "pinned_prompt_bundle"
        : "codex_custom_agent";
    if (output.kind !== expectedKind) {
      throw new Error(
        `agent_output_lifecycle_kind_mismatch: ${output.name} -> ${output.kind}`,
      );
    }
    for (const overlay of output.reviewer_overlays ?? []) {
      if (!overlays.has(overlay)) {
        throw new Error(
          `agent_output_unknown_overlay: ${output.name} -> ${overlay}`,
        );
      }
    }
  }

  return {
    promptContractVersion: manifest.prompt_contract_version,
    agentNames: [...outputs.values()]
      .filter((output) => output.kind === "codex_custom_agent")
      .map((output) => output.name)
      .sort(),
    pinnedPromptNames: [...outputs.values()]
      .filter((output) => output.kind === "pinned_prompt_bundle")
      .map((output) => output.name)
      .sort(),
    automaticCeiling: "xhigh",
    manifest,
  };
}

export function renderAgentRuntime(input: {
  sourceDir: string;
  outputDir: string;
}): {
  agentNames: string[];
  pinnedPromptNames: string[];
  staticHash: string;
} {
  const sourceDir = resolve(input.sourceDir);
  const outputDir = resolve(input.outputDir);
  const validated = validateAgentSource(sourceDir);
  rmSync(outputDir, { force: true, recursive: true });
  mkdirSync(outputDir, { recursive: true });
  for (const entry of readdirSync(sourceDir)) {
    cpSync(join(sourceDir, entry), join(outputDir, entry), { recursive: true });
  }
  const codexDir = join(outputDir, "codex");
  mkdirSync(codexDir, { recursive: true });
  const pinnedDir = join(outputDir, "pinned");
  mkdirSync(pinnedDir, { recursive: true });

  const roles = new Map(
    validated.manifest.roles.map((role) => [role.id, role]),
  );
  const overlays = new Map(
    validated.manifest.reviewer_overlays.map((overlay) => [
      overlay.id,
      overlay,
    ]),
  );
  const shared = readFileSync(
    safeSourceFile(sourceDir, validated.manifest.shared_contract),
    "utf-8",
  ).trim();
  const hashes: Record<string, string> = {};

  for (const output of [...validated.manifest.outputs].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const role = roles.get(output.role);
    if (!role) {
      throw new Error(`agent_output_unknown_role: ${output.name}`);
    }
    const profileName = output.model_profile ?? role.model_profile;
    const profile = validated.manifest.model_profiles[profileName];
    const charter = readFileSync(
      safeSourceFile(sourceDir, role.charter),
      "utf-8",
    ).trim();
    const reviewText = (output.reviewer_overlays ?? [])
      .map((id) => {
        const overlay = overlays.get(id);
        if (!overlay) {
          throw new Error(
            `agent_output_unknown_overlay: ${output.name} -> ${id}`,
          );
        }
        return readFileSync(
          safeSourceFile(sourceDir, overlay.path),
          "utf-8",
        ).trim();
      })
      .join("\n\n");
    const body = [shared, charter, reviewText].filter(Boolean).join("\n\n");
    const promptHash = hashStaticAgentDescriptor({
      capabilities: [...role.capabilities].sort(),
      description: role.description,
      lifecycle: role.lifecycle,
      modelProfile: profileName,
      modelProfileValue: profile,
      name: output.name,
      promptBody: body,
      promptContractVersion: validated.promptContractVersion,
      reportsTo: role.reports_to,
      requiredSkills: [...role.required_skills].sort(),
      reviewerOverlays: [...(output.reviewer_overlays ?? [])].sort(),
      role: role.id,
      sandboxMode: role.sandbox_mode,
    });
    const developerInstructions = [
      `STATIC_PROMPT_HASH=${promptHash}`,
      `PROMPT_CONTRACT_VERSION=${validated.promptContractVersion}`,
      `ROLE_ID=${role.id}`,
      `REPORTS_TO=${role.reports_to ?? "none"}`,
      `CAPABILITIES=${role.capabilities.join(",") || "none"}`,
      `TOOL_POLICY_SHA256=${roleToolPolicySha256(role)}`,
      `REQUIRED_SKILLS=${role.required_skills.join(",") || "none"}`,
      "",
      `Before acting, load and follow the required skills: ${role.required_skills.join(", ")}.`,
      "",
      body,
    ].join("\n");
    if (output.kind === "codex_custom_agent") {
      const toml = stringify({
        name: output.name,
        description: role.description,
        developer_instructions: developerInstructions,
        model: profile.model,
        model_reasoning_effort: profile.reasoning_effort,
        sandbox_mode: role.sandbox_mode,
      });
      validateGeneratedToml(output.name, toml);
      writeFileSync(join(codexDir, `${output.name}.toml`), toml, "utf-8");
    } else {
      writeFileSync(
        join(pinnedDir, `${output.name}.md`),
        `${developerInstructions}\n`,
        "utf-8",
      );
    }
    hashes[output.name] = promptHash;
  }
  writeFileSync(
    join(outputDir, "rendered-manifest.json"),
    `${JSON.stringify(
      {
        schema_version: 1,
        prompt_contract_version: validated.promptContractVersion,
        prompts: hashes,
        outputs: Object.fromEntries(
          [...validated.manifest.outputs]
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((output) => [output.name, output.kind]),
        ),
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  return {
    agentNames: validated.agentNames,
    pinnedPromptNames: validated.pinnedPromptNames,
    staticHash: sha256(canonicalJson(hashes)),
  };
}

function validateGeneratedToml(name: string, toml: string): void {
  const parsed = parse(toml) as Record<string, unknown>;
  for (const field of ["name", "description", "developer_instructions"]) {
    if (typeof parsed[field] !== "string" || parsed[field] === "") {
      throw new Error(`generated_agent_invalid: ${name} missing ${field}`);
    }
  }
  if (parsed.name !== name) {
    throw new Error(`generated_agent_name_mismatch: ${name}`);
  }
}

function assertProfileReferences(
  manifest: AgentManifest,
  role: AgentRole,
): void {
  if (!manifest.model_profiles[role.model_profile]) {
    throw new Error(
      `agent_role_unknown_profile: ${role.id} -> ${role.model_profile}`,
    );
  }
  if (!role.allowed_profiles.includes(role.model_profile)) {
    throw new Error(`agent_role_default_not_allowed: ${role.id}`);
  }
  for (const name of role.allowed_profiles) {
    const profile = manifest.model_profiles[name];
    if (!profile) {
      throw new Error(`agent_role_unknown_profile: ${role.id} -> ${name}`);
    }
    if (
      !profile.manual_only &&
      EFFORT_ORDER[profile.automatic_ceiling] > EFFORT_ORDER.xhigh
    ) {
      throw new Error(`agent_profile_automatic_ceiling_invalid: ${name}`);
    }
    if (
      !profile.manual_only &&
      EFFORT_ORDER[profile.reasoning_effort] >
        EFFORT_ORDER[profile.automatic_ceiling]
    ) {
      throw new Error(`agent_profile_default_exceeds_ceiling: ${name}`);
    }
  }
}

function uniqueMap<T extends Record<string, unknown>>(
  values: T[],
  label: string,
  key: keyof T = "id",
): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = String(value[key]);
    if (result.has(id)) {
      throw new Error(`duplicate_${label.replaceAll(" ", "_")}: ${id}`);
    }
    result.set(id, value);
  }
  return result;
}

function assertExactInventory(
  actual: string[],
  expected: string[],
  label: string,
): void {
  if (actual.join("\0") !== expected.join("\0")) {
    throw new Error(
      `${label.replaceAll(" ", "_")}_inventory_invalid: ${actual.join(",")}`,
    );
  }
}

function safeExistingMarkdown(root: string, path: string): void {
  const resolved = safeSourceFile(root, path);
  if (!existsSync(resolved)) {
    throw new Error(`agent_fragment_missing: ${path}`);
  }
  if (basename(resolved) === "" || !resolved.endsWith(".md")) {
    throw new Error(`agent_fragment_invalid: ${path}`);
  }
}

function safeSourceFile(root: string, path: string): string {
  const target = resolve(root, path);
  const rel = relative(root, target);
  if (
    rel === ".." ||
    rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
  ) {
    throw new Error(`agent_source_path_escape: ${path}`);
  }
  return target;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function validateLinearTemplates(root: string, schema: JsonSchema): void {
  for (const [recordType, filename] of Object.entries(LINEAR_TEMPLATES)) {
    const variant = resolveSchemaRef(schema, schema.$defs?.[recordType]);
    if (!variant) {
      throw new Error(`agent_workspace_schema_missing: ${recordType}`);
    }
    const expected = new Set<string>();
    for (const part of variant.allOf ?? [variant]) {
      const resolved = resolveSchemaRef(schema, part);
      for (const field of Object.keys(resolved?.properties ?? {})) {
        expected.add(field);
      }
    }
    const template = readFileSync(
      join(root, "templates", "linear", filename),
      "utf-8",
    );
    const actual = [...template.matchAll(/^- `([a-z0-9_]+)`:/gm)].map(
      (match) => match[1],
    );
    assertExactInventory(
      [...new Set(actual)].sort(),
      [...expected].sort(),
      `linear template ${recordType}`,
    );
    if (!template.includes(`- \`record_type\`: ${recordType}`)) {
      throw new Error(
        `linear_template_record_type_invalid: ${filename} -> ${recordType}`,
      );
    }
  }
}

function resolveSchemaRef(
  root: JsonSchema,
  schema: JsonSchema | undefined,
): JsonSchema | undefined {
  if (!schema?.$ref) {
    return schema;
  }
  const match = schema.$ref.match(/^#\/\$defs\/([^/]+)$/);
  return match ? root.$defs?.[match[1]] : undefined;
}
