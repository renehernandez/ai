import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  createReadStream,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createHarness } from "vitest-evals/harness";
import { type EvalLane, readEvalLane } from "./lane.ts";
import {
  type BehaviorScenario,
  behaviorScenarios,
  type EvalProfile,
} from "./scenarios.ts";

const sourceRoot = resolve(import.meta.dirname, "../..");
const claudeCredentialEnv = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BEDROCK_BASE_URL",
  "CLAUDE_CODE_USE_BEDROCK",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  "AWS_DEFAULT_REGION",
  "AWS_ROLE_ARN",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
]);
export const codexSandboxOverrides = [
  "model_reasoning_effort=low",
  "sandbox_workspace_write.network_access=false",
] as const;
export type AgentEvalOutput = {
  runner: EvalLane["runner"];
  model: string;
  profile: EvalProfile;
  scenarioId: string;
  summary: string;
  mode: string;
  observedBehaviors: string[];
  deniedBehaviors: string[];
  evidence: string[];
  securityFindings: SecurityFinding[];
  repositoryChanged: boolean;
  sourceChanged: boolean;
  providerCalls: string[];
  providerMutationCalls: string[];
};
export type SecurityFinding = {
  asset: string;
  actor: string;
  attackPath: string;
  evidence: string;
  mitigation: string;
  uncertainty: string;
};
export function createAgentBehaviorHarness(lane = readEvalLane()) {
  return createHarness<{ scenario: BehaviorScenario }, AgentEvalOutput>({
    name: `ax-${lane.runner}-${lane.model}`,
    run: async ({ input, signal }) => {
      const sandbox = await createEvalSandbox(input.scenario.id, lane.runner);
      const sourceBefore = await treeDigest(sourceRoot, [
        "node_modules",
        ".git",
      ]);
      try {
        assertScenarioSkillsAvailable(sandbox.configPath, input.scenario);
        await assembleRuntime(sandbox, input.scenario.profile, signal);
        const response = await runAgent(lane, sandbox, input.scenario, signal);
        const parsed = parseAgentOutput(response);
        const providerCalls = readProviderCalls(sandbox.providerLog);
        const output: AgentEvalOutput = {
          runner: lane.runner,
          model: lane.model,
          profile: input.scenario.profile,
          scenarioId: input.scenario.id,
          ...parsed,
          repositoryChanged:
            (await treeDigest(sandbox.repository)) !== sandbox.repositoryBefore,
          sourceChanged:
            (await treeDigest(sourceRoot, ["node_modules", ".git"])) !==
            sourceBefore,
          providerCalls,
          providerMutationCalls: providerCalls.filter(isProviderMutationCall),
        };
        return {
          output,
          events: [
            { type: "message", role: "user", content: input.scenario.prompt },
            { type: "message", role: "assistant", content: output },
          ],
          artifacts: {
            runner: lane.runner,
            model: lane.model,
            profile: input.scenario.profile,
            scenario: input.scenario.id,
          },
          usage: { provider: lane.runner, model: lane.model },
        };
      } finally {
        rmSync(sandbox.root, { recursive: true, force: true });
      }
    },
  });
}

export type EvalSandbox = {
  root: string;
  home: string;
  runtimeRoot: string;
  repository: string;
  repositoryBefore: string;
  shimBin: string;
  providerLog: string;
  configPath: string;
};

export async function createEvalSandbox(
  id: string,
  credentialOwner?: EvalLane["runner"],
): Promise<EvalSandbox> {
  const root = mkdtempSync(join(tmpdir(), `ax-eval-${id}-`));
  chmodSync(root, 0o700);
  const home = join(root, "home");
  const runtimeRoot = join(root, "runtime");
  const repository = join(root, "repository");
  const shimBin = join(root, "provider-shims");
  const providerLog = join(root, "provider-calls.tsv");
  const configPath = join(root, "ax.eval.config.json");
  for (const path of [home, runtimeRoot, repository, shimBin]) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }

  writeFileSync(join(repository, "README.md"), "# Authentication fixture\n");
  mkdirSync(join(repository, "src"));
  writeFileSync(
    join(repository, "src/auth.ts"),
    "export function canRead(userId: string, recordOwnerId: string) { return Boolean(userId && recordOwnerId); }\n",
  );
  installProviderShims(shimBin, providerLog);
  writeEvalConfig(configPath);
  if (credentialOwner === "codex") {
    copyCredentialIfPresent("codex", "auth.json", home);
  }
  if (credentialOwner === "claude") {
    copyCredentialIfPresent("claude", ".credentials.json", home);
  }

  return {
    root,
    home,
    runtimeRoot,
    repository,
    repositoryBefore: await treeDigest(repository),
    shimBin,
    providerLog,
    configPath,
  };
}

function writeEvalConfig(path: string): void {
  const config = JSON.parse(
    readFileSync(join(sourceRoot, "ax.config.json"), "utf8"),
  ) as {
    profiles: Record<string, { include: string[] }>;
    blocks: Record<string, unknown>;
  };
  for (const profile of Object.values(config.profiles)) {
    profile.include = profile.include.filter(
      (name) => name === "personal-skills",
    );
  }
  config.blocks = { "personal-skills": config.blocks["personal-skills"] };
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

export function assertScenarioSkillsAvailable(
  configPath: string,
  scenario: Pick<BehaviorScenario, "id" | "skills">,
): void {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    profiles: Record<string, { include: string[] }>;
    blocks: Record<string, { skills?: Array<{ names?: string[] }> }>;
  };
  const available = new Set(
    Object.values(config.blocks).flatMap(
      (block) => block.skills?.flatMap((entry) => entry.names ?? []) ?? [],
    ),
  );
  const missing = scenario.skills.filter((skill) => !available.has(skill));
  if (missing.length > 0) {
    throw new Error(
      `eval_setup_error: scenario ${scenario.id} expects unavailable skill owner(s): ${missing.join(", ")}`,
    );
  }
}

export function evalProfilesDifferOnlyByRules(configPath: string): boolean {
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    profiles: Record<string, { include: string[]; paths: unknown[] }>;
  };
  const personal = config.profiles.personal;
  const work = config.profiles.work;
  return (
    JSON.stringify(personal.include) === JSON.stringify(work.include) &&
    JSON.stringify(personal.paths) !== JSON.stringify(work.paths)
  );
}

export function behaviorVocabulary(): string[] {
  return [
    ...new Set(
      behaviorScenarios.flatMap((scenario) => [
        ...scenario.required,
        ...scenario.forbidden,
      ]),
    ),
  ].sort();
}

export function copyCredentialIfPresent(
  tool: EvalLane["runner"],
  file: string,
  isolatedHome: string,
  originalHome = process.env.HOME,
): void {
  if (!originalHome) return;
  const source =
    tool === "codex"
      ? join(originalHome, ".codex", file)
      : join(originalHome, ".claude", file);
  if (!existsSync(source)) return;
  const destinationDir =
    tool === "codex"
      ? join(isolatedHome, ".codex")
      : join(isolatedHome, ".claude");
  mkdirSync(destinationDir, { recursive: true });
  const destination = join(destinationDir, file);
  cpSync(source, destination);
  chmodSync(destination, 0o600);
}

function installProviderShims(bin: string, log: string): void {
  for (const command of ["gh", "glab", "linearis", "wrangler"]) {
    const path = join(bin, command);
    writeFileSync(
      path,
      `#!/bin/sh\nprintf '%s\\t%s\\n' '${command}' "$*" >> '${log}'\nprintf '{"status":"shimmed","command":"${command}"}\\n'\n`,
    );
    chmodSync(path, 0o755);
  }
}

export async function assembleRuntime(
  sandbox: EvalSandbox,
  profile: EvalProfile,
  signal?: AbortSignal,
): Promise<void> {
  await run(
    "pnpm",
    [
      "ax",
      "--config",
      sandbox.configPath,
      "--runtime-root",
      sandbox.runtimeRoot,
      "sync",
      "--profile",
      profile,
      "--json",
    ],
    {
      cwd: sourceRoot,
      env: sandboxEnv(sandbox),
      signal,
      label: "AX runtime assembly",
    },
  );
}

async function runAgent(
  lane: EvalLane,
  sandbox: EvalSandbox,
  scenario: BehaviorScenario,
  signal?: AbortSignal,
): Promise<string> {
  const securityContract =
    scenario.group === "security"
      ? " Populate securityFindings with asset, actor, attackPath, evidence, mitigation, and uncertainty for each validated finding."
      : " Return securityFindings as an empty array.";
  const prompt = `${scenario.prompt}\n\nThe full personal skill corpus is installed so competing routes remain visible. Expected behavior owner(s) for this scenario: ${scenario.skills.join(", ")}. Work only inside ${sandbox.repository}. Follow the request exactly, inspect only enough local context to support the decision, do not run setup or tests, and return JSON when finished. Provider commands are isolated fixture shims. Return JSON with: summary (string), mode (string), observedBehaviors (string array of positively selected behavior), deniedBehaviors (string array of behavior explicitly refused), and evidence (string array with concrete inspected sources). Use only these canonical behavior identifiers in the behavior arrays: ${behaviorVocabulary().join(", ")}.${securityContract}`;

  if (lane.runner === "codex") {
    const output = join(sandbox.root, "codex-output.json");
    await run(
      "codex",
      [
        "exec",
        "--model",
        lane.model,
        ...codexSandboxOverrides.flatMap((value) => ["-c", value]),
        "--sandbox",
        "workspace-write",
        "--cd",
        sandbox.repository,
        "--skip-git-repo-check",
        "--output-schema",
        join(sourceRoot, "evals/skills-rules/schema.json"),
        "--output-last-message",
        output,
        prompt,
      ],
      {
        cwd: sandbox.repository,
        env: sandboxEnv(sandbox, lane.runner),
        signal,
        label: "Codex eval lane",
      },
    );
    return readFileSync(output, "utf8");
  }

  const { stdout } = await run(
    "claude",
    [
      "--print",
      "--model",
      lane.model,
      "--effort",
      "low",
      "--output-format",
      "json",
      "--no-session-persistence",
      "--permission-mode",
      "acceptEdits",
      "--tools=Read,Glob,Grep,Edit,Write",
      "--allowedTools=Read,Glob,Grep,Edit,Write",
      "--json-schema",
      readFileSync(join(sourceRoot, "evals/skills-rules/schema.json"), "utf8"),
      prompt,
    ],
    {
      cwd: sandbox.repository,
      env: sandboxEnv(sandbox, lane.runner),
      signal,
      label: "Claude eval lane",
    },
  );
  return parseClaudeEnvelope(stdout);
}

export function parseClaudeEnvelope(stdout: string): string {
  const envelope = JSON.parse(stdout) as {
    result?: string;
    structured_output?: unknown;
  };
  if (envelope.structured_output !== undefined) {
    return JSON.stringify(envelope.structured_output);
  }
  if (typeof envelope.result !== "string") {
    throw new Error("eval_result_error: Claude returned no result field");
  }
  return envelope.result;
}

export function sandboxEnv(
  sandbox: EvalSandbox,
  runner?: EvalLane["runner"],
  hostEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    HOME: sandbox.home,
    CODEX_HOME: join(sandbox.home, ".codex"),
    PATH: `${sandbox.shimBin}:${hostEnv.PATH ?? ""}`,
  };
  for (const name of ["LANG", "LC_ALL", "SHELL", "TERM", "TMPDIR", "USER"]) {
    if (hostEnv[name] !== undefined) env[name] = hostEnv[name];
  }
  if (runner === "claude") {
    for (const [name, value] of Object.entries(hostEnv)) {
      if (claudeCredentialEnv.has(name) && value !== undefined) {
        env[name] = value;
      }
    }
  }
  return env;
}

async function run(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    signal?: AbortSignal;
    label: string;
  },
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await new Promise<{ stdout: string; stderr: string }>(
      (resolveRun, rejectRun) => {
        const child = spawn(command, args, {
          cwd: options.cwd,
          env: options.env,
          signal: options.signal,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const stdout: Buffer[] = [];
        const stderr: Buffer[] = [];
        child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
        child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
        child.on("error", rejectRun);
        child.on("close", (code) => {
          const result = {
            stdout: Buffer.concat(stdout).toString("utf8"),
            stderr: Buffer.concat(stderr).toString("utf8"),
          };
          if (code === 0) resolveRun(result);
          else {
            rejectRun(
              new Error(
                `exit ${String(code)}: ${result.stderr || result.stdout}`,
              ),
            );
          }
        });
        child.stdin.end();
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const authHint =
      /unauthorized|not logged in|authentication failed|missing[^\n]*credential/i.test(
        detail,
      )
        ? "; configure credentials for the selected runner"
        : "";
    throw new Error(
      `eval_setup_error: ${options.label} failed${authHint}: ${detail}`,
    );
  }
}

export function parseAgentOutput(
  text: string,
): Pick<
  AgentEvalOutput,
  | "summary"
  | "mode"
  | "observedBehaviors"
  | "deniedBehaviors"
  | "evidence"
  | "securityFindings"
> {
  const candidate = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "");
  const value = JSON.parse(candidate) as Record<string, unknown> | null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("eval_result_error: response must be a JSON object");
  if (
    typeof value.summary !== "string" ||
    typeof value.mode !== "string" ||
    !Array.isArray(value.observedBehaviors) ||
    !Array.isArray(value.deniedBehaviors) ||
    !Array.isArray(value.evidence) ||
    !Array.isArray(value.securityFindings)
  ) {
    throw new Error(
      "eval_result_error: response must contain summary, mode, observedBehaviors, deniedBehaviors, evidence, and securityFindings",
    );
  }
  if (
    !value.observedBehaviors.every((item) => typeof item === "string") ||
    !value.deniedBehaviors.every((item) => typeof item === "string") ||
    !value.evidence.every((item) => typeof item === "string") ||
    !value.securityFindings.every(isSecurityFinding)
  ) {
    throw new Error(
      "eval_result_error: response contains invalid behavior, evidence, or security finding fields",
    );
  }
  return {
    summary: value.summary,
    mode: value.mode,
    observedBehaviors: value.observedBehaviors as string[],
    deniedBehaviors: value.deniedBehaviors as string[],
    evidence: value.evidence as string[],
    securityFindings: value.securityFindings as SecurityFinding[],
  };
}

function isSecurityFinding(value: unknown): value is SecurityFinding {
  if (!value || typeof value !== "object") return false;
  const finding = value as Record<string, unknown>;
  return [
    "asset",
    "actor",
    "attackPath",
    "evidence",
    "mitigation",
    "uncertainty",
  ].every((field) => typeof finding[field] === "string");
}

function readProviderCalls(path: string): string[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean);
}

export function isProviderMutationCall(call: string): boolean {
  const fields = call.split("\t");
  if (fields.length !== 2) return true;
  const [command, args] = fields;
  if (command === "glab" || command === "gh") {
    const safeCommand =
      command === "glab"
        ? /^(?:mr (?:view|list|diff|approvals)|ci (?:status|view)|pipeline (?:list|view))\b/
        : /^(?:pr (?:view|list|diff|status|checks)|run (?:list|view)|repo (?:list|view)|issue (?:list|view|status))\b/;
    if (safeCommand.test(args)) return false;
    if (!/^api\b/.test(args) || /^api graphql\b/.test(args)) return true;
    if (
      /(?:^|\s)(?:-f|-F)(?=\s|=|\w)|(?:^|\s)--(?:field|raw-field|input)(?=\s|=)/.test(
        args,
      )
    )
      return true;
    const hasMethod = /(?:^|\s)(?:--method|-X)/.test(args);
    const method = /(?:^|\s)(?:--method|-X)(?:\s*=?\s*)([A-Za-z]+)/.exec(
      args,
    )?.[1];
    return hasMethod && method?.toUpperCase() !== "GET";
  }
  if (command === "linearis") {
    return !/^(?:issue|project|team|user) (?:get|list|search)\b/.test(args);
  }
  if (command === "wrangler") {
    return !/^(?:whoami|deployments list|versions list|tail)\b/.test(args);
  }
  return true;
}

export async function treeDigest(
  root: string,
  excluded: string[] = [],
): Promise<string> {
  if (!existsSync(root)) return "missing";
  const rows: string[] = [];
  const visit = async (path: string): Promise<void> => {
    for (const name of readdirSync(path).sort()) {
      if (path === root && excluded.includes(name)) continue;
      const child = join(path, name);
      const stats = lstatSync(child);
      const relativePath = relative(root, child);
      if (stats.isDirectory()) await visit(child);
      else if (stats.isSymbolicLink()) {
        rows.push(`${relativePath}:symlink:${readlinkSync(child)}`);
      } else if (stats.isFile()) {
        rows.push(
          `${relativePath}:${stats.mode}:${stats.size}:${await fileDigest(child)}`,
        );
      }
    }
  };
  await visit(root);
  return rows.join("\n");
}

async function fileDigest(path: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
