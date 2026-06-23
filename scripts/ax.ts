#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import {
  basename,
  delimiter,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";
import ts from "typescript";
import {
  formatReviewGateStatus,
  hasStagedDiff,
  validateReviewGateForCommit,
} from "./review-gate.ts";

type Scope = "skills" | "instructions" | "openspec" | "hooks";
type RuntimeCommand = "install" | "update" | "validate" | "status";
type SkillCommand = Extract<RuntimeCommand, "install" | "update" | "validate">;
type ShimCommand = "install" | "status" | "uninstall";

const REQUIRE_REVIEW_GATE_FLAG = "--require-review-gate";

type RemoteSkillSource = {
  url: string;
  ref: string;
  basePath: string;
  names: string[];
};

type LocalSkillSource = {
  localPath: string;
  names: string[];
};

type SkillSource = RemoteSkillSource | LocalSkillSource;

type BlockConfig = {
  skills?: SkillSource[];
};

type SkillsetConfig = {
  include: string[];
};

type ProfileConfig = {
  include: string[];
  paths: InstructionPathConfig[];
};

type InstructionPathConfig =
  | string
  | {
      sourcePath: string;
      targetPath: string;
    };

type RuntimeFileConfig = InstructionPathConfig;

type Config = {
  version: 1;
  runtime: {
    canonicalSkillsDir: string;
    skillSymlinkTargets: string[];
    reusableScripts?: RuntimeFileConfig[];
    instructionSymlinkTargets?: Record<string, string>;
    backupsDir?: string;
    lockFile?: string;
    openspec?: OpenSpecConfig;
    hooks?: HooksConfig;
  };
  instructions?: {
    paths: InstructionPathConfig[];
  };
  instructionProfiles?: Record<string, InstructionProfileConfig>;
  profiles?: Record<string, ProfileConfig>;
  blocks: Record<string, BlockConfig>;
  skillsets?: Record<string, SkillsetConfig>;
};

type InstructionProfileConfig = {
  paths: InstructionPathConfig[];
};

type OpenSpecConfig = {
  tools?: string[];
  schema?: string;
  profile?: string;
  delivery?: string;
  workflows?: string[];
  context?: string;
  rules?: Record<string, string[]>;
  canonicalSkillsDir?: string;
  canonicalCommandsDir?: string;
  skillTargets?: Record<string, string>;
  commandTargets?: Record<string, string>;
};

type HooksConfig = {
  sourceDir?: string;
  canonicalDir?: string;
  targets?: Record<string, string>;
  allowDisposableSource?: boolean;
  registration?: HookRegistrationConfig;
  startupRemote?: HookStartupRemoteConfig;
};

type HookRegistrationConfig = {
  startupCommand?: string;
  codexHooksJsonPath?: string;
  codexConfigTomlPath?: string;
  claudeSettingsJsonPath?: string;
};

type HookStartupRemoteConfig = {
  name?: string;
  expectedUrl?: string;
};

type HookCommand = {
  type?: string;
  command?: string;
  [key: string]: unknown;
};

type HookMatcher = {
  matcher?: string;
  hooks?: HookCommand[];
  [key: string]: unknown;
};

type HookConfigDocument = {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
};

type StartupHookLocation = {
  event: "SessionStart";
  eventKey: "session_start";
  matcherIndex: number;
  hookIndex: number;
};

export type StartupHookRegistrationResult = {
  changed: boolean;
  location: StartupHookLocation;
};

export type StartupHookStatus = {
  registered: boolean;
  locations: StartupHookLocation[];
  staleLocations: StartupHookLocation[];
  trustState: "trusted" | "missing" | "not_applicable";
  gaps: string[];
};

export type CodexStartupHookRegistrationInput = {
  hooksJsonPath: string;
  configTomlPath: string;
  command: string;
};

export type ClaudeStartupHookRegistrationInput = {
  settingsJsonPath: string;
  command: string;
};

export type ResolvedOpenSpecConfig = {
  tools: string[];
  schema: string;
  profile: string;
  delivery: string;
  workflows: string[];
  context: string;
  rules: Record<string, string[]>;
  canonicalSkillsDir: string;
  canonicalCommandsDir: string;
  skillTargets: Record<string, string>;
  commandTargets: Record<string, string>;
  backupsRoot: string;
  reusableScripts: RuntimeFileConfig[];
};

export type OpenSpecSetupState = "missing" | "configured" | "partial";

export type OpenSpecStateReport = {
  state: OpenSpecSetupState;
  configPath: string;
  canonicalSkillsDir: string;
  canonicalCommandsDir: string;
  skillNames: string[];
  commandNames: string[];
  findings: string[];
};

export type OpenSpecInstallSetup = {
  tools: string[];
  schema: string;
  profile: string;
  delivery: string;
  workflows: string[];
  context: string;
  rules: Record<string, string[]>;
};

export type OpenSpecProjectSignalReport = {
  contextLines: string[];
  rules: Record<string, string[]>;
  inspectedPaths: string[];
  ignoredNames: string[];
};

type ResolvedHooksConfig = {
  sourceDir: string;
  canonicalDir: string;
  targets: Record<string, string>;
  backupsRoot: string;
  allowDisposableSource: boolean;
  registration: ResolvedHookRegistrationConfig;
  startupRemote: ResolvedHookStartupRemoteConfig;
};

type ResolvedHookRegistrationConfig = {
  startupCommand: string;
  codexHooksJsonPath: string;
  codexConfigTomlPath: string;
  claudeSettingsJsonPath: string;
};

type ResolvedHookStartupRemoteConfig = {
  name: string;
  expectedUrl?: string;
};

type ParsedArgs = {
  scope?: Scope;
  command: RuntimeCommand;
  shimCommand?: ShimCommand;
  profileNames?: string[];
  allProfiles?: boolean;
  configPath: string;
  runtimeContext?: RuntimeInvocationContext;
  openSpecOptions?: OpenSpecCommandOptions;
};

export type RuntimeInvocationContext = {
  sourceRoot: string;
  targetRoot: string;
  executablePath: string;
  configPath: string;
};

type RuntimeHealth = {
  failures: string[];
  warnings: string[];
};

type LockedSkill = {
  sourceType?: "git" | "local";
  url?: string;
  ref?: string;
  resolvedCommit?: string;
  localPath?: string;
  basePath?: string;
  skillPath: string;
  contentHash: string;
};

type SkillInstallPlan = {
  source: SkillSource;
  skillNames: string[];
};

type ProfileSelection = {
  profileNames: string[];
  interactive: boolean;
};

type OpenSpecCommandOptions = {
  contextFile?: string;
  reviewConfig?: boolean;
  acceptConfigChanges?: boolean;
};

type LockFile = {
  version: 1;
  skillsets: Record<
    string,
    {
      skills: Record<string, LockedSkill>;
    }
  >;
};

const CONFIG_FILE = "ax.config.json";
const LOCK_FILE = "ax.lock.json";
const CACHE_DIR = ".ax/cache";
const SHIM_PATH = "~/.local/bin/ax";
const SHIM_MARKER = "# AX_MANAGED_SHIM";
const SHIM_SOURCE_ROOT_PREFIX = "# AX_SOURCE_ROOT=";
const OPENSPEC_INSTALL_COMMAND = "npm install -g @fission-ai/openspec@latest";
const DEFAULT_OPENSPEC_SCHEMA = "spec-driven";
const DEFAULT_OPENSPEC_PROFILE = "custom";
const DEFAULT_OPENSPEC_DELIVERY = "both";
const DEFAULT_OPENSPEC_WORKFLOWS = [
  "propose",
  "explore",
  "apply",
  "archive",
] as const;
const KNOWN_OPENSPEC_SCHEMAS = new Set(["spec-driven", "workspace-planning"]);
const KNOWN_OPENSPEC_ARTIFACT_IDS = new Set([
  "proposal",
  "specs",
  "design",
  "tasks",
  "apply",
]);
const MAX_OPENSPEC_CONTEXT_LENGTH = 6000;
const DEFAULT_OPENSPEC_RULES: Record<string, string[]> = {
  proposal: [
    "State goals, non-goals, and user-visible behavior changes when they are relevant.",
  ],
  design: [
    "Record important tradeoffs, alternatives considered, and selected technical direction.",
  ],
  tasks: [
    "Keep implementation tasks independently verifiable and commit-sized.",
  ],
};
const PROJECT_SIGNAL_MAX_FILE_BYTES = 12_000;
const PROJECT_SIGNAL_MAX_DOC_LINES = 8;
const PROJECT_SIGNAL_DOC_FILES = [
  "README.md",
  "README",
  "AGENTS.md",
  "CLAUDE.md",
] as const;
const PROJECT_SIGNAL_IGNORED_NAMES = new Set([
  ".ax",
  ".cache",
  ".codex",
  ".git",
  ".next",
  ".turbo",
  ".venv",
  "backups",
  "build",
  "coverage",
  "dist",
  "logs",
  "node_modules",
  "openspec",
  "tmp",
  "ax.lock.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const PROJECT_SIGNAL_SECRET_PATTERNS = [
  /^\.env($|\.)/,
  /\.pem$/,
  /\.key$/,
  /secret/i,
  /credential/i,
] as const;
const RETIRED_MANAGED_SKILL_NAMES = [
  "agent-runtime-cli",
  "plan-to-review",
  "plan-coordinate",
  "plan-delivery",
  "research-router",
] as const;

export function main(): void {
  const program = createProgram();
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }
  program.parse(process.argv);
}

export function executeParsedCommand(input: ParsedArgs): void {
  const { scope, command, profileNames, allProfiles, configPath } = input;
  const runtimeContext =
    input.runtimeContext ?? createRuntimeInvocationContext(configPath);
  if (input.shimCommand) {
    runShim(input.shimCommand, runtimeContext);
    return;
  }
  const config = readJson<Config>(runtimeContext.configPath);
  if (scope !== "openspec") {
    process.chdir(runtimeContext.sourceRoot);
  }

  if (!scope) {
    if (command === "status") {
      runRuntimeStatus(config, runtimeContext, { profileNames, allProfiles });
      return;
    }
    const profileSelection = resolveProfileSelection(config, {
      profileNames,
      allProfiles,
    });
    preflightWrapperCommand(command, config, profileSelection);
    if (command === "install" || command === "update") {
      runHooks(command, config);
    }
    runSkills(command, config, profileSelection);
    runInstructions(command, config, profileSelection);
    if (command === "validate" || command === "status") {
      runHooks(command, config, { enforceValidate: false });
    }
    return;
  }

  const profileSelection = resolveProfileSelectionForScope(scope, config, {
    profileNames,
    allProfiles,
  });
  runScope(scope, {
    command,
    config,
    profileSelection,
    openSpecOptions: input.openSpecOptions,
  });
}

type CommandExecutor = (input: ParsedArgs) => void;

export function createProgram(
  execute: CommandExecutor = executeParsedCommand,
): Command {
  const program = new Command();
  program
    .name("ax")
    .description("Manage reusable local Agents Experience assets")
    .showHelpAfterError("(add --help for additional information)")
    .configureHelp({ sortSubcommands: true })
    .option("--config <path>", "Path to Agents Experience config", CONFIG_FILE);

  for (const command of runtimeCommands()) {
    addWrapperCommand(program, command, execute);
  }

  addSkillsCommands(program, execute);
  addInstructionsCommands(program, execute);
  addOpenSpecCommands(program, execute);
  addHooksCommands(program, execute);
  addReviewGateCommands(program);
  addCommitCommand(program);
  addShimCommands(program, execute);

  return program;
}

function addShimCommands(program: Command, execute: CommandExecutor): void {
  const shim = program
    .command("shim")
    .description("Manage the AX-owned global command shim");
  for (const shimCommand of shimCommands()) {
    shim
      .command(shimCommand)
      .description(`${labelForCommand(shimCommand)} the managed AX shim`)
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          command: "status",
          shimCommand,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

function addWrapperCommand(
  program: Command,
  command: RuntimeCommand,
  execute: CommandExecutor,
): void {
  program
    .command(command)
    .description(`${labelForCommand(command)} all runtime assets`)
    .option(
      "--profile <name>",
      "Apply work to one profile; repeat for multiple",
      collectOption,
    )
    .option("--all-profiles", "Apply work to all profiles")
    .option("--config <path>", "Path to Agents Experience config", CONFIG_FILE)
    .action((first: CommandOptions | Command, second?: Command) => {
      const { options, commandObject } = actionContext(first, second);
      execute({
        command,
        profileNames: options.profile,
        allProfiles: options.allProfiles,
        configPath: configPathFor(commandObject, options),
      });
    });
}

function addSkillsCommands(program: Command, execute: CommandExecutor): void {
  const skills = program
    .command("skills")
    .description("Manage skill installation and symlinks");
  for (const command of runtimeCommands()) {
    skills
      .command(command)
      .description(`${labelForCommand(command)} managed skills`)
      .option(
        "--profile <name>",
        "Apply the command to one profile; repeat for multiple",
        collectOption,
      )
      .option("--all-profiles", "Apply the command to all profiles")
      .option(
        "--config <path>",
        "Path to Agents Experience config",
        CONFIG_FILE,
      )
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "skills",
          command,
          profileNames: options.profile,
          allProfiles: options.allProfiles,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

function addInstructionsCommands(
  program: Command,
  execute: CommandExecutor,
): void {
  const instructions = program
    .command("instructions")
    .description("Manage AGENTS.md and rules symlinks");
  for (const command of runtimeCommands()) {
    instructions
      .command(command)
      .description(`${labelForCommand(command)} managed instructions`)
      .option(
        "--profile <name>",
        "Apply the command to one profile; repeat for multiple",
        collectOption,
      )
      .option("--all-profiles", "Apply the command to all profiles")
      .option(
        "--config <path>",
        "Path to Agents Experience config",
        CONFIG_FILE,
      )
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "instructions",
          command,
          profileNames: options.profile,
          allProfiles: options.allProfiles,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

function addOpenSpecCommands(program: Command, execute: CommandExecutor): void {
  const openspec = program
    .command("openspec")
    .description("Manage repo-local OpenSpec scaffolding");
  for (const command of runtimeCommands()) {
    const scopedCommand = openspec
      .command(command)
      .description(
        `${labelForCommand(command)} repo-local OpenSpec scaffolding`,
      )
      .option(
        "--config <path>",
        "Path to Agents Experience config",
        CONFIG_FILE,
      );
    if (command === "install") {
      scopedCommand.option(
        "--context-file <path>",
        "Confirmed project context file for headless first-time install",
      );
    }
    if (command === "update") {
      scopedCommand
        .option("--review-config", "Review inferred OpenSpec config changes")
        .option(
          "--accept-config-changes",
          "Apply inferred OpenSpec config changes in headless review mode",
        );
    }
    scopedCommand.action(
      (first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "openspec",
          command,
          configPath: configPathFor(commandObject, options),
          openSpecOptions: {
            contextFile: options.contextFile
              ? resolve(options.contextFile)
              : undefined,
            reviewConfig: options.reviewConfig,
            acceptConfigChanges: options.acceptConfigChanges,
          },
        });
      },
    );
  }
}

function addHooksCommands(program: Command, execute: CommandExecutor): void {
  const hooks = program
    .command("hooks")
    .description("Manage runtime hook symlinks");
  for (const command of runtimeCommands()) {
    hooks
      .command(command)
      .description(`${labelForCommand(command)} managed hooks`)
      .option(
        "--config <path>",
        "Path to Agents Experience config",
        CONFIG_FILE,
      )
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "hooks",
          command,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

function addReviewGateCommands(program: Command): void {
  const reviewGate = program
    .command("review-gate")
    .description("Inspect and validate local review gate state");

  reviewGate
    .command("status")
    .description("Show local review gate status for the current staged diff")
    .action(() => {
      const validation = validateReviewGateForCommit(process.cwd());
      process.stdout.write(formatReviewGateStatus(validation));
    });

  reviewGate
    .command("validate-commit")
    .description("Validate local review gate state for the current staged diff")
    .action(() => {
      const validation = validateReviewGateForCommit(process.cwd());
      if (!validation.ok) {
        process.stderr.write(formatReviewGateStatus(validation));
        process.exitCode = 1;
        return;
      }
      process.stdout.write(formatReviewGateStatus(validation));
    });
}

function addCommitCommand(program: Command): void {
  program
    .command("commit")
    .description("Validate the local review gate, then run git commit")
    .option(
      REQUIRE_REVIEW_GATE_FLAG,
      "Enable workflow-owned review-gate commit mode",
    )
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[args...]", "Supported git commit arguments")
    .action((args: string[]) => {
      const parsed = parseAxCommitArgs(args);
      if (parsed.errors.length > 0) {
        for (const error of parsed.errors) {
          console.error(error);
        }
        process.exitCode = 1;
        return;
      }
      let validation: ReturnType<typeof validateReviewGateForCommit>;
      try {
        if (!hasStagedDiff(process.cwd())) {
          console.error("No staged diff to commit.");
          process.exitCode = 1;
          return;
        }
        validation = validateReviewGateForCommit(process.cwd());
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `Unable to validate review gate: ${message.split(/\r?\n/, 1)[0]}`,
        );
        process.exitCode = 1;
        return;
      }

      if (!validation.ok) {
        process.stderr.write(formatReviewGateStatus(validation));
        process.exitCode = 1;
        return;
      }
      const result = spawnSync("git", ["commit", ...parsed.gitArgs], {
        cwd: process.cwd(),
        encoding: "utf-8",
        env: withoutGitRepositoryEnv(),
        stdio: "inherit",
      });
      process.exitCode = result.status ?? 1;
    });
}

function parseAxCommitArgs(args: string[]): {
  gitArgs: string[];
  errors: string[];
} {
  const errors: string[] = [];
  const gitArgs: string[] = [];
  const unsupported = new Set([
    "--amend",
    "-a",
    "--all",
    "--include",
    "-i",
    "--only",
    "-o",
    "--no-verify",
    "--fixup",
    "--squash",
    "-C",
    "-c",
    "--reuse-message",
    "--reedit-message",
  ]);
  const unsupportedPrefixes = [
    "--fixup=",
    "--squash=",
    "--reuse-message=",
    "--reedit-message=",
  ];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (
      unsupported.has(arg) ||
      unsupportedPrefixes.some((prefix) => arg.startsWith(prefix))
    ) {
      errors.push(`Unsupported ax commit mode: ${arg}`);
      continue;
    }
    if (arg === REQUIRE_REVIEW_GATE_FLAG) {
      continue;
    }
    if (arg === "-m" || arg === "--message") {
      const message = args[index + 1];
      if (!message) {
        errors.push(`${arg} requires a commit message`);
        if (index + 1 < args.length) {
          index += 1;
        }
      } else {
        gitArgs.push(arg, message);
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--message=")) {
      const message = arg.slice("--message=".length);
      if (!message) {
        errors.push("--message requires a commit message");
      } else {
        gitArgs.push("--message", message);
      }
      continue;
    }
    if (arg.startsWith("-")) {
      errors.push(`Unsupported ax commit option: ${arg}`);
      continue;
    }
    errors.push(`Pathspec commits are not supported by ax commit: ${arg}`);
  }

  if (!gitArgs.includes("-m") && !gitArgs.includes("--message")) {
    errors.push("ax commit currently requires -m or --message.");
  }

  return { gitArgs, errors };
}

function withoutGitRepositoryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_ALTERNATE_OBJECT_DIRECTORIES;
  delete env.GIT_DIR;
  delete env.GIT_INDEX_FILE;
  delete env.GIT_OBJECT_DIRECTORY;
  delete env.GIT_PREFIX;
  delete env.GIT_QUARANTINE_PATH;
  delete env.GIT_WORK_TREE;
  return env;
}

type CommandOptions = {
  config?: string;
  profile?: string[];
  allProfiles?: boolean;
  contextFile?: string;
  reviewConfig?: boolean;
  acceptConfigChanges?: boolean;
};

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function configPathFor(
  commandObject: Command,
  options: CommandOptions,
): string {
  if (
    commandObject.getOptionValueSourceWithGlobals("config") &&
    commandObject.getOptionValueSourceWithGlobals("config") !== "default"
  ) {
    return resolve(
      commandObject.optsWithGlobals<CommandOptions>().config ??
        options.config ??
        CONFIG_FILE,
    );
  }
  return join(runtimeSourceRoot(), CONFIG_FILE);
}

export function createRuntimeInvocationContext(
  configPath = join(runtimeSourceRoot(), CONFIG_FILE),
): RuntimeInvocationContext {
  return {
    sourceRoot: runtimeSourceRoot(),
    targetRoot: process.cwd(),
    executablePath:
      process.env.AX_EXECUTABLE_PATH || process.argv[1]
        ? resolve(process.env.AX_EXECUTABLE_PATH || process.argv[1])
        : "",
    configPath: resolve(configPath),
  };
}

function runtimeSourceRoot(): string {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

function actionContext(
  first: CommandOptions | Command,
  second?: Command,
): { options: CommandOptions; commandObject: Command } {
  if (first instanceof Command) {
    return {
      options: first.opts<CommandOptions>(),
      commandObject: first,
    };
  }
  if (!second) {
    throw new Error("Missing Commander command context");
  }
  return {
    options: first,
    commandObject: second,
  };
}

function runtimeCommands(): RuntimeCommand[] {
  return ["install", "update", "validate", "status"];
}

function shimCommands(): ShimCommand[] {
  return ["install", "status", "uninstall"];
}

function labelForCommand(command: RuntimeCommand | ShimCommand): string {
  return command[0].toUpperCase() + command.slice(1);
}

function resolveProfileSelectionForScope(
  scope: Scope,
  config: Config,
  input: { profileNames?: string[]; allProfiles?: boolean },
): ProfileSelection {
  if (scope === "openspec" || scope === "hooks") {
    if ((input.profileNames?.length ?? 0) > 0 || input.allProfiles) {
      throw new Error(
        "--profile can only be used with skills, instructions, or wrapper commands",
      );
    }
    return { profileNames: [], interactive: false };
  }
  return resolveProfileSelection(config, input);
}

function resolveProfileSelection(
  config: Config,
  input: { profileNames?: string[]; allProfiles?: boolean },
): ProfileSelection {
  const profileNames = configuredProfileNames(config);
  if (profileNames.length === 0) {
    if ((input.profileNames?.length ?? 0) > 0 || input.allProfiles) {
      throw new Error("Profiles are not configured");
    }
    return { profileNames: [], interactive: false };
  }

  const selectedProfileNames = uniqueNames(input.profileNames ?? []);
  if (input.allProfiles && selectedProfileNames.length > 0) {
    throw new Error("Use either --all-profiles or --profile <name>, not both");
  }
  if (input.allProfiles) {
    return { profileNames, interactive: false };
  }
  if (selectedProfileNames.length > 0) {
    return { profileNames: selectedProfileNames, interactive: false };
  }
  if (canPrompt()) {
    return {
      profileNames: promptSelection("profile", profileNames),
      interactive: true,
    };
  }
  throw new Error("Choose profiles with --all-profiles or --profile <name>");
}

function selectedInstructionPaths(
  config: Config,
  selection: ProfileSelection,
): InstructionPathConfig[] {
  if (config.profiles && Object.keys(config.profiles).length > 0) {
    validateProfileNames(config, selection.profileNames);
    return uniqueInstructionPaths(
      selection.profileNames.flatMap(
        (profileName) => config.profiles?.[profileName]?.paths ?? [],
      ),
    );
  }

  if (
    !config.instructionProfiles ||
    Object.keys(config.instructionProfiles).length === 0
  ) {
    return config.instructions?.paths ?? [];
  }

  validateInstructionProfileNames(config, selection.profileNames);
  return uniqueInstructionPaths(
    selection.profileNames.flatMap(
      (profileName) => config.instructionProfiles?.[profileName]?.paths ?? [],
    ),
  );
}

function instructionSourcePath(instructionPath: InstructionPathConfig): string {
  return typeof instructionPath === "string"
    ? instructionPath
    : instructionPath.sourcePath;
}

function instructionTargetPath(instructionPath: InstructionPathConfig): string {
  return typeof instructionPath === "string"
    ? instructionPath
    : instructionPath.targetPath;
}

function instructionLabel(instructionPath: InstructionPathConfig): string {
  const sourcePath = instructionSourcePath(instructionPath);
  const targetPath = instructionTargetPath(instructionPath);
  return sourcePath === targetPath
    ? sourcePath
    : `${sourcePath} -> ${targetPath}`;
}

function runtimeFileSourcePath(runtimeFile: RuntimeFileConfig): string {
  return instructionSourcePath(runtimeFile);
}

function runtimeFileTargetPath(runtimeFile: RuntimeFileConfig): string {
  return instructionTargetPath(runtimeFile);
}

function runtimeFileLabel(runtimeFile: RuntimeFileConfig): string {
  const sourcePath = runtimeFileSourcePath(runtimeFile);
  const targetPath = runtimeFileTargetPath(runtimeFile);
  return sourcePath === targetPath
    ? sourcePath
    : `${sourcePath} -> ${targetPath}`;
}

function uniqueInstructionPaths(
  instructionPaths: InstructionPathConfig[],
): InstructionPathConfig[] {
  const seen = new Set<string>();
  const selected: InstructionPathConfig[] = [];
  for (const instructionPath of instructionPaths) {
    const key = `${instructionSourcePath(instructionPath)}\0${instructionTargetPath(instructionPath)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    selected.push(instructionPath);
  }
  return selected;
}

function selectedSkillProfileNames(
  config: Config,
  selection: ProfileSelection,
): string[] {
  if (config.profiles && Object.keys(config.profiles).length > 0) {
    validateProfileNames(config, selection.profileNames);
    return selection.profileNames;
  }
  if (config.skillsets && Object.keys(config.skillsets).length > 0) {
    for (const profileName of selection.profileNames) {
      if (!config.skillsets[profileName]) {
        throw new Error(`Unknown profile '${profileName}'`);
      }
    }
    return selection.profileNames;
  }
  return [];
}

function configuredProfileNames(config: Config): string[] {
  if (config.profiles && Object.keys(config.profiles).length > 0) {
    return Object.keys(config.profiles).sort();
  }
  const legacyProfileNames = new Set<string>();
  for (const profileName of Object.keys(config.skillsets ?? {})) {
    legacyProfileNames.add(profileName);
  }
  for (const profileName of Object.keys(config.instructionProfiles ?? {})) {
    legacyProfileNames.add(profileName);
  }
  return [...legacyProfileNames].sort();
}

function validateProfileNames(config: Config, profileNames: string[]): void {
  for (const profileName of profileNames) {
    if (!config.profiles?.[profileName]) {
      throw new Error(`Unknown profile '${profileName}'`);
    }
  }
}

function validateInstructionProfileNames(
  config: Config,
  profileNames: string[],
): void {
  for (const profileName of profileNames) {
    if (!config.instructionProfiles?.[profileName]) {
      throw new Error(`Unknown profile '${profileName}'`);
    }
  }
}

function uniqueNames(values: string[]): string[] {
  return [...new Set(values)];
}

function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function promptSelection(label: string, options: string[]): string[] {
  if (options.length === 0) {
    throw new Error(`No ${label}s are configured`);
  }

  writeSync(1, `Select ${label}s to use:\n`);
  writeSync(1, "  all) All\n");
  options.forEach((option, index) => {
    writeSync(1, `  ${index + 1}) ${option}\n`);
  });
  writeSync(1, `Enter all, numbers, or names separated by commas: `);

  const answer = promptLine();
  if (answer.toLowerCase() === "all") {
    return options;
  }

  const selected = answer
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const index = Number(item);
      if (Number.isInteger(index) && index >= 1 && index <= options.length) {
        return options[index - 1];
      }
      return item;
    });

  if (selected.length === 0) {
    throw new Error(`No ${label}s selected`);
  }
  for (const value of selected) {
    if (!options.includes(value)) {
      throw new Error(`Unknown ${label} '${value}'`);
    }
  }
  return uniqueNames(selected);
}

function promptLine(): string {
  const buffer = Buffer.alloc(1);
  let input = "";
  while (true) {
    let bytesRead: number;
    try {
      bytesRead = readSync(0, buffer, 0, 1, null);
    } catch (error) {
      if (isRetryableReadError(error)) {
        sleep(25);
        continue;
      }
      throw error;
    }
    if (bytesRead === 0) {
      break;
    }
    const char = buffer.toString("utf-8", 0, bytesRead);
    if (char === "\n" || char === "\r") {
      break;
    }
    input += char;
  }
  return input.trim();
}

function isRetryableReadError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error.code === "EAGAIN" ||
        error.code === "EWOULDBLOCK" ||
        error.code === "EINTR"),
  );
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function runScope(
  scope: Scope,
  input: {
    command: RuntimeCommand;
    config: Config;
    profileSelection: ProfileSelection;
    openSpecOptions?: OpenSpecCommandOptions;
  },
): void {
  if (scope === "skills") {
    runSkills(input.command, input.config, input.profileSelection);
    return;
  }
  if (scope === "openspec") {
    runOpenSpec(input.command, input.config, input.openSpecOptions);
    return;
  }
  if (scope === "hooks") {
    runHooks(input.command, input.config);
    return;
  }
  runInstructions(input.command, input.config, input.profileSelection);
}

function runOpenSpec(
  command: RuntimeCommand,
  config: Config,
  options: OpenSpecCommandOptions = {},
): void {
  const openspec = resolvedOpenSpecConfig(config);
  const stateReport = inspectOpenSpecState(openspec);

  if (command === "status") {
    statusOpenSpec(openspec, stateReport);
    return;
  }

  assertOpenSpecCommandBoundary(command, stateReport);
  const installSetup =
    command === "install"
      ? resolveConfirmedOpenSpecInstallSetup(openspec, options)
      : undefined;
  ensureOpenSpecCli();

  if (command === "validate") {
    validateOpenSpec(openspec);
    console.log("Validated repo-local OpenSpec scaffolding.");
    return;
  }

  if (command === "install") {
    writeConfirmedOpenSpecConfig(installSetup);
    const confirmedConfig = readFileSync(
      join("openspec", "config.yaml"),
      "utf-8",
    );
    try {
      runOpenSpecGeneration(openspec, [
        "init",
        ".",
        "--tools",
        openspec.tools.join(","),
        "--profile",
        openspec.profile,
      ]);
      writeFileSync(join("openspec", "config.yaml"), confirmedConfig, "utf-8");
      normalizeOpenSpecScaffolding(openspec);
    } catch (error) {
      stabilizeOpenSpecGenerationFailure(openspec, confirmedConfig);
      throwOpenSpecGenerationError("install", error, openspec);
    }
    console.log("Installed repo-local OpenSpec scaffolding.");
    return;
  }

  if (options.reviewConfig && !reviewOpenSpecConfig(openspec, options)) {
    return;
  }

  const validationErrors = openSpecValidationErrors(openspec);
  if (validationErrors.length === 0) {
    console.log("OpenSpec generated assets are current.");
    return;
  }

  backupOpenSpecExternalTargets(openspec);
  try {
    runOpenSpecGeneration(openspec, ["update", "."]);
    normalizeOpenSpecScaffolding(openspec);
  } catch (error) {
    throwOpenSpecGenerationError("update", error, openspec);
  }
  console.log("Updated repo-local OpenSpec scaffolding.");
}

function resolveConfirmedOpenSpecInstallSetup(
  config: ResolvedOpenSpecConfig,
  options: OpenSpecCommandOptions,
): OpenSpecInstallSetup {
  const contextFile = options.contextFile;
  const contextFromFile = contextFile
    ? readConfirmedOpenSpecContextFile(contextFile)
    : "";
  const setup = createOpenSpecInstallSetup(config, {
    context: contextFromFile,
  });

  if (!canPrompt()) {
    if (!contextFile) {
      throw new Error(
        "confirmation_required: headless OpenSpec install requires `--context-file <path>` so project context is confirmed before files are written.",
      );
    }
    return setup;
  }

  printOpenSpecInstallPreview(setup);
  writeSync(1, "Write openspec/config.yaml and generate assets? [y/N] ");
  const answer = promptLine().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    throw new Error(
      "confirmation_required: OpenSpec install was not confirmed; no files were written.",
    );
  }
  return setup;
}

function readConfirmedOpenSpecContextFile(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing OpenSpec context file: ${path}`);
  }
  const context = readFileSync(path, "utf-8").trim();
  if (context.length === 0) {
    throw new Error(`OpenSpec context file is empty: ${path}`);
  }
  return context;
}

function printOpenSpecInstallPreview(setup: OpenSpecInstallSetup): void {
  console.log("OpenSpec install preview");
  console.log(`Tools: ${setup.tools.join(", ")}`);
  console.log(`Schema: ${setup.schema}`);
  console.log(`Profile: ${setup.profile}`);
  console.log(`Delivery: ${setup.delivery}`);
  console.log(`Workflows: ${setup.workflows.join(", ")}`);
  console.log("Context:");
  for (const line of setup.context.split(/\r?\n/)) {
    console.log(`  ${line}`);
  }
  console.log("Artifact rules:");
  for (const [artifact, rules] of Object.entries(setup.rules)) {
    console.log(`  ${artifact}:`);
    for (const rule of rules) {
      console.log(`    - ${rule}`);
    }
  }
}

function reviewOpenSpecConfig(
  config: ResolvedOpenSpecConfig,
  options: OpenSpecCommandOptions,
): boolean {
  const currentPath = join("openspec", "config.yaml");
  const currentConfig = existsSync(currentPath)
    ? readFileSync(currentPath, "utf-8")
    : "";
  const proposedConfig = renderOpenSpecConfigYaml(
    mergeOpenSpecConfigDocument(
      currentConfig,
      createOpenSpecInstallSetup(config),
    ),
  );

  if (currentConfig === proposedConfig) {
    console.log("OpenSpec config is current.");
    return true;
  }

  console.log("Proposed OpenSpec config changes:");
  console.log(proposedConfig.trimEnd());

  if (!canPrompt()) {
    if (!options.acceptConfigChanges) {
      console.log(
        "OpenSpec config review was not applied. Re-run with `--accept-config-changes` to write these changes headlessly.",
      );
      return false;
    }
    writeFileSync(currentPath, proposedConfig, "utf-8");
    console.log("Updated openspec/config.yaml from accepted config review.");
    return true;
  }

  writeSync(1, "Apply these OpenSpec config changes? [y/N] ");
  const answer = promptLine().toLowerCase();
  if (answer !== "y" && answer !== "yes") {
    console.log("OpenSpec config review was not applied.");
    return false;
  }
  writeFileSync(currentPath, proposedConfig, "utf-8");
  console.log("Updated openspec/config.yaml from config review.");
  return true;
}

function mergeOpenSpecConfigDocument(
  currentConfig: string,
  proposedSetup: OpenSpecInstallSetup,
): OpenSpecInstallSetup {
  const parsed = parseOpenSpecConfigDocument(currentConfig);
  return {
    ...proposedSetup,
    schema: parsed.schema || proposedSetup.schema,
    context: uniqueNonEmptyLines([
      ...parsed.contextLines,
      ...proposedSetup.context.split(/\r?\n/),
    ]).join("\n"),
    rules: mergeOpenSpecRules(parsed.rules, proposedSetup.rules),
  };
}

function parseOpenSpecConfigDocument(content: string): {
  schema: string;
  contextLines: string[];
  rules: Record<string, string[]>;
} {
  const lines = content.split(/\r?\n/);
  const rules: Record<string, string[]> = {};
  let schema = "";
  let mode: "root" | "context" | "rules" | "rule-values" = "root";
  let currentRule = "";
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    if (mode === "context" && rawLine.startsWith("  ")) {
      continue;
    }
    if (trimmed.startsWith("schema:")) {
      schema = unquoteYamlScalar(trimmed.slice("schema:".length).trim());
      mode = "root";
      continue;
    }
    if (trimmed.startsWith("context:")) {
      mode = "context";
      continue;
    }
    if (trimmed === "rules:") {
      mode = "rules";
      continue;
    }
    if (mode === "rules" && rawLine.startsWith("  ") && trimmed.endsWith(":")) {
      currentRule = unquoteYamlScalar(trimmed.slice(0, -1));
      rules[currentRule] = rules[currentRule] ?? [];
      mode = "rule-values";
      continue;
    }
    if (mode === "rule-values" && currentRule && rawLine.startsWith("    - ")) {
      rules[currentRule].push(unquoteYamlScalar(trimmed.slice(2).trim()));
    }
  }
  return {
    schema,
    contextLines: parseOpenSpecContextLines(content),
    rules,
  };
}

function parseOpenSpecContextLines(content: string): string[] {
  const lines = content.split(/\r?\n/);
  const selected: string[] = [];
  let inContext = false;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (trimmed.startsWith("context:")) {
      inContext = true;
      continue;
    }
    if (!inContext) {
      continue;
    }
    if (!rawLine.startsWith("  ")) {
      break;
    }
    selected.push(rawLine.slice(2));
  }
  return uniqueNonEmptyLines(selected);
}

function unquoteYamlScalar(value: string): string {
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1);
    }
  }
  return value;
}

function assertOpenSpecCommandBoundary(
  command: RuntimeCommand,
  stateReport: OpenSpecStateReport,
): void {
  if (command === "install") {
    if (stateReport.state === "missing") {
      return;
    }
    if (stateReport.state === "configured") {
      throw new Error(
        "Repo-local OpenSpec is already configured. Use `ax openspec update` to refresh generated assets.",
      );
    }
    throw new Error(formatOpenSpecPartialStateError("install", stateReport));
  }

  if (command === "update") {
    if (stateReport.state === "configured") {
      return;
    }
    if (stateReport.state === "missing") {
      throw new Error(
        "Repo-local OpenSpec is not configured. Use `ax openspec install` to create the initial scaffolding.",
      );
    }
    throw new Error(formatOpenSpecPartialStateError("update", stateReport));
  }
}

function formatOpenSpecPartialStateError(
  command: Extract<RuntimeCommand, "install" | "update">,
  stateReport: OpenSpecStateReport,
): string {
  const findings =
    stateReport.findings.length > 0
      ? stateReport.findings
      : ["OpenSpec setup has an incomplete generated asset footprint."];
  return [
    `Repo-local OpenSpec setup is partial. Repair these findings before running \`ax openspec ${command}\`:`,
    ...findings.map((finding) => `- ${finding}`),
  ].join("\n");
}

function runRuntimeStatus(
  config: Config,
  context: RuntimeInvocationContext,
  input: { profileNames?: string[]; allProfiles?: boolean } = {},
): void {
  const profileSelection =
    input.profileNames?.length || input.allProfiles
      ? resolveProfileSelection(config, input)
      : {
          profileNames: configuredProfileNames(config),
          interactive: false,
        };
  const health = createRuntimeHealth();

  console.log("AX");
  console.log(`Source root: ${context.sourceRoot}`);
  console.log(`Config path: ${context.configPath}`);
  console.log(`Lock path: ${runtimeRootedPath(context, lockFileFor(config))}`);
  console.log(`Cache path: ${runtimeRootedPath(context, CACHE_DIR)}`);
  console.log(`Target root: ${context.targetRoot}`);
  console.log(`Executable path: ${context.executablePath || "(unknown)"}`);
  if (!existsSync(context.sourceRoot)) {
    recordRuntimeFailure(health, `Missing source root: ${context.sourceRoot}`);
  }
  printExecutableLinkStatus(context);
  console.log("");

  console.log("Shim");
  statusShim(context, health);
  console.log("");

  console.log("Skills");
  const skillsOutput = captureConsoleOutput(() =>
    runSkills("status", config, profileSelection),
  );
  printCapturedOutput(skillsOutput);
  collectRuntimeSurfaceFindings(health, skillsOutput);
  console.log("");

  console.log("Instructions");
  const instructionsOutput = captureConsoleOutput(() =>
    runInstructions("status", config, profileSelection),
  );
  printCapturedOutput(instructionsOutput);
  collectRuntimeSurfaceFindings(health, instructionsOutput);
  console.log("");

  console.log("Hooks");
  const hooksOutput = captureConsoleOutput(() => runHooks("status", config));
  printCapturedOutput(hooksOutput);
  collectRuntimeSurfaceFindings(health, hooksOutput);
  console.log("");

  console.log("OpenSpec");
  let openSpecError: unknown;
  const openSpecOutput = captureConsoleOutput(() => {
    try {
      withWorkingDirectory(context.targetRoot, () => {
        runOpenSpec("status", config);
      });
    } catch (error) {
      openSpecError = error;
    }
  });
  printCapturedOutput(openSpecOutput);
  collectRuntimeSurfaceFindings(health, openSpecOutput);
  if (openSpecError) {
    const message =
      openSpecError instanceof Error
        ? openSpecError.message
        : String(openSpecError);
    recordRuntimeFailure(health, `OpenSpec status failed: ${message}`);
  }
  printRuntimeHealth(health);
  if (health.failures.length > 0) {
    throw new Error(
      `AX status detected runtime failures:\n${health.failures.map((failure) => `- ${failure}`).join("\n")}`,
    );
  }
}

function printExecutableLinkStatus(context: RuntimeInvocationContext): void {
  if (!context.executablePath) {
    console.log("[unknown] Executable link: unavailable");
    return;
  }

  const executableRealPath = realPathIfExists(context.executablePath);
  const sourceRealPath = realPathIfExists(context.sourceRoot);
  if (pathIsWithin(executableRealPath, sourceRealPath)) {
    console.log(`[ok] Executable link: ${executableRealPath}`);
    return;
  }
  console.log(`[external] Executable link: ${executableRealPath}`);
}

function runShim(
  command: ShimCommand,
  context: RuntimeInvocationContext,
): void {
  if (command === "install") {
    installShim(context);
    return;
  }
  if (command === "uninstall") {
    uninstallShim(context);
    return;
  }
  statusShim(context);
}

function installShim(context: RuntimeInvocationContext): void {
  const shimPath = managedShimPath();
  const existing = lstatIfExists(shimPath);
  if (existing && !isManagedShim(shimPath)) {
    throw new Error(
      `Refusing to overwrite unmanaged ax shim at ${shimPath}. Remove it or move it before running ax shim install.`,
    );
  }
  mkdirSync(dirname(shimPath), { recursive: true });
  writeFileSync(shimPath, renderManagedShim(context), "utf-8");
  chmodSync(shimPath, 0o755);
  console.log(`Installed managed AX shim: ${shimPath}`);
  statusShim(context);
}

function uninstallShim(context: RuntimeInvocationContext): void {
  const shimPath = managedShimPath();
  if (!existsSync(shimPath)) {
    console.log(`Managed AX shim is not installed: ${shimPath}`);
    return;
  }
  if (!isManagedShim(shimPath)) {
    throw new Error(`Refusing to remove unmanaged ax shim at ${shimPath}.`);
  }
  rmSync(shimPath);
  console.log(`Removed managed AX shim: ${shimPath}`);
  statusShim(context);
}

function statusShim(
  context: RuntimeInvocationContext,
  health?: RuntimeHealth,
): void {
  const shimPath = managedShimPath();
  const shimDirectory = dirname(shimPath);
  const stats = lstatIfExists(shimPath);
  const managed = stats ? isManagedShim(shimPath) : false;
  const executable = Boolean(stats && stats.mode & 0o111);
  const pathEntries = process.env.PATH?.split(delimiter).filter(Boolean) ?? [];
  const matchingAxEntries = pathEntries
    .map((entry) => join(entry, "ax"))
    .filter((entry) => {
      const entryStats = lstatIfExists(entry);
      return Boolean(entryStats && entryStats.mode & 0o111);
    });
  const firstAx = matchingAxEntries[0];

  console.log("AX Shim");
  console.log(`Shim path: ${shimPath}`);
  console.log(
    `${stats ? (managed ? "[ok]" : "[unmanaged]") : "[missing]"} Managed shim`,
  );
  if (!stats) {
    recordRuntimeWarning(health, `Managed shim is not installed: ${shimPath}`);
  } else if (!managed) {
    recordRuntimeFailure(health, `Unmanaged ax file exists at ${shimPath}`);
  }
  if (stats) {
    console.log(`${executable ? "[ok]" : "[not-executable]"} Executable bit`);
    if (!executable) {
      recordRuntimeFailure(
        health,
        `Managed shim is not executable: ${shimPath}`,
      );
    }
  }
  if (managed) {
    const sourceRoot = managedShimSourceRoot(shimPath);
    console.log(
      `${sourceRoot === context.sourceRoot ? "[ok]" : "[stale]"} Source root: ${sourceRoot}`,
    );
    console.log(`Expected source root: ${context.sourceRoot}`);
    if (sourceRoot !== context.sourceRoot) {
      recordRuntimeFailure(
        health,
        `Managed shim source root does not match this runtime: ${sourceRoot}`,
      );
    }
    if (sourceRoot !== "(unknown)" && !existsSync(sourceRoot)) {
      console.log(`[stale] Source root path missing: ${sourceRoot}`);
      recordRuntimeFailure(
        health,
        `Managed shim source root path is missing: ${sourceRoot}`,
      );
    }
    if (isDisposableWorktreePath(sourceRoot)) {
      console.log(
        `[detached] Source root appears to be a disposable worktree: ${sourceRoot}`,
      );
      recordRuntimeFailure(
        health,
        `Managed shim source root is a disposable worktree: ${sourceRoot}`,
      );
    }
  }
  console.log(
    `${pathEntries.includes(shimDirectory) ? "[ok]" : "[missing]"} PATH includes ${shimDirectory}`,
  );
  if (!pathEntries.includes(shimDirectory)) {
    recordRuntimeWarning(health, `${shimDirectory} is not on PATH`);
    console.log(
      `Add to your shell profile: export PATH="${shimDirectory}:$PATH"`,
    );
  }
  if (matchingAxEntries.length === 0) {
    console.log("[missing] PATH ax entries: none");
    return;
  }
  for (const [index, entry] of matchingAxEntries.entries()) {
    const prefix =
      entry === shimPath
        ? index === 0
          ? "[ok]"
          : "[shadowed]"
        : index === 0
          ? "[shadowing]"
          : "[external]";
    console.log(`${prefix} PATH ax entry: ${entry}`);
  }
  if (firstAx && firstAx !== shimPath) {
    console.log(`[warning] ${firstAx} shadows the managed AX shim.`);
    recordRuntimeWarning(health, `${firstAx} shadows ${shimPath}`);
  }
}

function managedShimPath(): string {
  return expandHome(SHIM_PATH);
}

function renderManagedShim(context: RuntimeInvocationContext): string {
  const executable = join(context.sourceRoot, "bin", "ax.mjs");
  return [
    "#!/bin/sh",
    SHIM_MARKER,
    `${SHIM_SOURCE_ROOT_PREFIX}${context.sourceRoot}`,
    `exec ${shellSingleQuote(executable)} "$@"`,
    "",
  ].join("\n");
}

function isManagedShim(path: string): boolean {
  return existsSync(path) && readFileSync(path, "utf-8").includes(SHIM_MARKER);
}

function managedShimSourceRoot(path: string): string {
  const line = readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .find((value) => value.startsWith(SHIM_SOURCE_ROOT_PREFIX));
  return line ? line.slice(SHIM_SOURCE_ROOT_PREFIX.length) : "(unknown)";
}

function shellSingleQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function isDisposableWorktreePath(path: string): boolean {
  return (
    path.split(sep).includes(".codex") && path.split(sep).includes("worktrees")
  );
}

function createRuntimeHealth(): RuntimeHealth {
  return { failures: [], warnings: [] };
}

function recordRuntimeFailure(
  health: RuntimeHealth | undefined,
  finding: string,
): void {
  health?.failures.push(finding);
}

function recordRuntimeWarning(
  health: RuntimeHealth | undefined,
  finding: string,
): void {
  health?.warnings.push(finding);
}

function runtimeRootedPath(
  context: RuntimeInvocationContext,
  path: string,
): string {
  return isAbsolute(path) ? path : resolve(context.sourceRoot, path);
}

function captureConsoleOutput(callback: () => void): string[] {
  const originalLog = console.log;
  const output: string[] = [];
  console.log = (...args: unknown[]) => {
    output.push(args.map(String).join(" "));
  };
  try {
    callback();
  } finally {
    console.log = originalLog;
  }
  return output;
}

function printCapturedOutput(output: string[]): void {
  for (const line of output) {
    console.log(line);
  }
}

function collectRuntimeSurfaceFindings(
  health: RuntimeHealth,
  output: string[],
): void {
  for (const line of output) {
    if (line.includes("[missing] Hook source")) {
      recordRuntimeFailure(health, line);
    }
    if (line.includes("[missing] Reusable script")) {
      recordRuntimeFailure(health, line);
    }
    if (line.includes("[not-symlink]")) {
      recordRuntimeFailure(health, line);
    }
    if (line.includes("[wrong-target]")) {
      recordRuntimeFailure(health, line);
    }
  }
}

function printRuntimeHealth(health: RuntimeHealth): void {
  console.log("");
  console.log("Health");
  if (health.failures.length === 0 && health.warnings.length === 0) {
    console.log("[ok] Runtime health");
    return;
  }
  for (const warning of health.warnings) {
    console.log(`[warning] ${warning}`);
  }
  for (const failure of health.failures) {
    console.log(`[failure] ${failure}`);
  }
}

function withWorkingDirectory<T>(directory: string, callback: () => T): T {
  const originalCwd = process.cwd();
  try {
    process.chdir(directory);
    return callback();
  } finally {
    process.chdir(originalCwd);
  }
}

function pathIsWithin(path: string, parent: string): boolean {
  const relativePath = relative(parent, path);
  return (
    relativePath.length === 0 ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function backupOpenSpecExternalTargets(config: ResolvedOpenSpecConfig): void {
  backupRuntimeTarget(join("openspec", "config.yaml"), {
    assetKind: "openspec",
    backupsRoot: config.backupsRoot,
    targetName: "config",
  });
  backupRuntimeTarget(resolve(config.canonicalSkillsDir), {
    assetKind: "openspec",
    backupsRoot: config.backupsRoot,
    targetName: "agents",
  });
  backupRuntimeTarget(join(resolve(config.canonicalCommandsDir), "opsx"), {
    assetKind: "openspec",
    backupsRoot: config.backupsRoot,
    targetName: "agents",
  });
  for (const [targetName, targetDir] of Object.entries(config.skillTargets)) {
    backupRuntimeTarget(resolve(targetDir), {
      assetKind: "openspec",
      backupsRoot: config.backupsRoot,
      targetName,
    });
  }
  for (const [targetName, targetRoot] of Object.entries(
    config.commandTargets,
  )) {
    backupRuntimeTarget(join(resolve(targetRoot), "opsx"), {
      assetKind: "openspec",
      backupsRoot: config.backupsRoot,
      targetName,
    });
  }
}

function resolvedOpenSpecConfig(config: Config): ResolvedOpenSpecConfig {
  const input = config.runtime.openspec ?? {};
  return {
    tools: nonEmptyStrings(input.tools, ["codex", "claude"]),
    schema: nonEmptyString(input.schema, DEFAULT_OPENSPEC_SCHEMA),
    profile: nonEmptyString(input.profile, DEFAULT_OPENSPEC_PROFILE),
    delivery: nonEmptyString(input.delivery, DEFAULT_OPENSPEC_DELIVERY),
    workflows: nonEmptyStrings(input.workflows, [
      ...DEFAULT_OPENSPEC_WORKFLOWS,
    ]),
    context: input.context?.trim() ?? "",
    rules: normalizeOpenSpecRules(input.rules),
    canonicalSkillsDir: input.canonicalSkillsDir ?? ".agents/skills",
    canonicalCommandsDir: input.canonicalCommandsDir ?? ".agents/commands",
    backupsRoot: runtimeBackupsRoot(config),
    reusableScripts: config.runtime.reusableScripts ?? [],
    skillTargets: nonEmptyRecord(
      input.skillTargets,
      {
        codex: ".codex/skills",
        claude: ".claude/skills",
      },
      "runtime.openspec.skillTargets",
    ),
    commandTargets: nonEmptyRecord(
      input.commandTargets,
      {
        claude: ".claude/commands",
      },
      "runtime.openspec.commandTargets",
    ),
  };
}

function nonEmptyString(value: string | undefined, fallback: string): string {
  const selected = value?.trim();
  return selected && selected.length > 0 ? selected : fallback;
}

function normalizeOpenSpecRules(
  rules: Record<string, string[]> | undefined,
): Record<string, string[]> {
  const merged: Record<string, string[]> = {
    ...DEFAULT_OPENSPEC_RULES,
  };
  for (const [artifact, values] of Object.entries(rules ?? {})) {
    const normalizedValues = values
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (normalizedValues.length > 0) {
      merged[artifact] = normalizedValues;
    }
  }
  return merged;
}

export function createOpenSpecInstallSetup(
  config: ResolvedOpenSpecConfig,
  input: { context?: string } = {},
): OpenSpecInstallSetup {
  const projectSignals = collectOpenSpecProjectSignals();
  const contextLines = [
    ...configuredOpenSpecContextLines(config),
    ...(input.context ? input.context.split(/\r?\n/) : []),
    ...projectSignals.contextLines,
  ];

  return {
    tools: config.tools,
    schema: config.schema,
    profile: config.profile,
    delivery: config.delivery,
    workflows: config.workflows,
    context: uniqueNonEmptyLines(contextLines).join("\n"),
    rules: mergeOpenSpecRules(config.rules, projectSignals.rules),
  };
}

function configuredOpenSpecContextLines(
  config: ResolvedOpenSpecConfig,
): string[] {
  const configuredContext = config.context.trim();
  return [
    `OpenSpec tools: ${config.tools.join(", ")}`,
    `OpenSpec profile: ${config.profile}`,
    `OpenSpec delivery: ${config.delivery}`,
    `OpenSpec workflows: ${config.workflows.join(", ")}`,
    ...(configuredContext.length > 0 ? configuredContext.split(/\r?\n/) : []),
  ];
}

export function collectOpenSpecProjectSignals(
  root = process.cwd(),
): OpenSpecProjectSignalReport {
  const lines: string[] = [];
  const rules: Record<string, string[]> = {};
  const inspectedPaths: string[] = [];
  const ignoredNames: string[] = [];
  const packageJsonPath = join(root, "package.json");
  if (existsSync(packageJsonPath)) {
    inspectedPaths.push("package.json");
    const packageJson = readJson<Record<string, unknown>>(packageJsonPath);
    const name = stringValue(packageJson.name);
    if (name) {
      lines.push(`Project: ${name}`);
    }
    const packageManager = stringValue(packageJson.packageManager);
    if (packageManager) {
      lines.push(`Package manager: ${packageManager}`);
    } else {
      const inferredPackageManager = inferPackageManager();
      if (inferredPackageManager) {
        lines.push(`Package manager: ${inferredPackageManager}`);
      }
    }
    const runtimeHints = packageRuntimeHints(root, packageJson);
    if (runtimeHints.length > 0) {
      lines.push(`Tech stack: ${runtimeHints.join(", ")}`);
    }
    const scripts = recordKeys(packageJson.scripts);
    if (scripts.length > 0) {
      lines.push(`Package scripts: ${scripts.sort().slice(0, 8).join(", ")}`);
    }
    if (scripts.some((script) => /^test(:|$)/.test(script))) {
      appendOpenSpecRule(
        rules,
        "tasks",
        "Include the relevant package-managed verification command for code changes.",
      );
    }
  }

  for (const docFile of PROJECT_SIGNAL_DOC_FILES) {
    const path = join(root, docFile);
    if (!existsSync(path) || fileSize(path) > PROJECT_SIGNAL_MAX_FILE_BYTES) {
      continue;
    }
    inspectedPaths.push(docFile);
    const excerpt = documentSignalExcerpt(path);
    if (excerpt.length > 0) {
      lines.push(`${docFile}: ${excerpt}`);
    }
  }

  const topLevelNames = projectTopLevelNames(root, ignoredNames);
  if (topLevelNames.length > 0) {
    lines.push(
      `Top-level project files: ${topLevelNames.slice(0, 16).join(", ")}`,
    );
  }
  if (
    topLevelNames.includes("lefthook.yml") ||
    topLevelNames.includes("lefthook.yaml")
  ) {
    appendOpenSpecRule(
      rules,
      "tasks",
      "Account for configured repository hooks when planning verification.",
    );
  }

  return {
    contextLines: uniqueNonEmptyLines(lines),
    rules,
    inspectedPaths,
    ignoredNames: uniqueNames(ignoredNames).sort(),
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function inferPackageManager(): string | undefined {
  if (existsSync("pnpm-lock.yaml")) {
    return "pnpm";
  }
  if (existsSync("yarn.lock")) {
    return "yarn";
  }
  if (existsSync("package-lock.json")) {
    return "npm";
  }
  return undefined;
}

function packageRuntimeHints(
  root: string,
  packageJson: Record<string, unknown>,
): string[] {
  const dependencyNames = new Set([
    ...recordKeys(packageJson.dependencies),
    ...recordKeys(packageJson.devDependencies),
  ]);
  const hints: string[] = [];
  if (
    dependencyNames.has("typescript") ||
    existsSync(join(root, "tsconfig.json"))
  ) {
    hints.push("TypeScript");
  }
  if (dependencyNames.has("tsx")) {
    hints.push("tsx");
  }
  if (dependencyNames.has("commander")) {
    hints.push("Commander CLI");
  }
  if (dependencyNames.has("@biomejs/biome")) {
    hints.push("Biome");
  }
  return hints;
}

function recordKeys(value: unknown): string[] {
  return value && typeof value === "object" && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

function fileSize(path: string): number {
  return lstatSync(path).size;
}

function documentSignalExcerpt(path: string): string {
  const content = readFileSync(path, "utf-8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("```"))
    .slice(0, PROJECT_SIGNAL_MAX_DOC_LINES);
  return lines.join(" ").slice(0, 600);
}

function projectTopLevelNames(root: string, ignoredNames: string[]): string[] {
  if (!existsSync(root)) {
    return [];
  }
  const names: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (shouldIgnoreProjectSignalName(entry.name)) {
      ignoredNames.push(entry.name);
      continue;
    }
    names.push(entry.name);
  }
  return names.sort();
}

function shouldIgnoreProjectSignalName(name: string): boolean {
  return (
    PROJECT_SIGNAL_IGNORED_NAMES.has(name) ||
    PROJECT_SIGNAL_SECRET_PATTERNS.some((pattern) => pattern.test(name))
  );
}

function appendOpenSpecRule(
  rules: Record<string, string[]>,
  artifact: string,
  rule: string,
): void {
  rules[artifact] = [...(rules[artifact] ?? []), rule];
}

function mergeOpenSpecRules(
  baseRules: Record<string, string[]>,
  inferredRules: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = {};
  for (const artifact of new Set([
    ...Object.keys(baseRules),
    ...Object.keys(inferredRules),
  ])) {
    merged[artifact] = uniqueNonEmptyLines([
      ...(baseRules[artifact] ?? []),
      ...(inferredRules[artifact] ?? []),
    ]);
  }
  return merged;
}

function uniqueNonEmptyLines(lines: string[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const normalized = line.trim();
    if (normalized.length > 0 && !seen.has(normalized)) {
      selected.push(normalized);
      seen.add(normalized);
    }
  }
  return selected;
}

function writeConfirmedOpenSpecConfig(setup: OpenSpecInstallSetup): void {
  mkdirSync("openspec", { recursive: true });
  writeFileSync(
    join("openspec", "config.yaml"),
    renderOpenSpecConfigYaml(setup),
    "utf-8",
  );
}

export function renderOpenSpecConfigYaml(setup: OpenSpecInstallSetup): string {
  const lines = [`schema: ${yamlScalar(setup.schema)}`];
  if (setup.context.trim().length > 0) {
    lines.push("context: |-");
    for (const line of setup.context.split(/\r?\n/)) {
      lines.push(`  ${line}`);
    }
  }

  const ruleEntries = Object.entries(setup.rules).filter(
    ([, values]) => values.length > 0,
  );
  if (ruleEntries.length > 0) {
    lines.push("rules:");
    for (const [artifact, values] of ruleEntries) {
      lines.push(`  ${yamlScalar(artifact)}:`);
      for (const value of values) {
        lines.push(`    - ${yamlScalar(value)}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function yamlScalar(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}

export function inspectOpenSpecState(
  config: ResolvedOpenSpecConfig,
): OpenSpecStateReport {
  const canonicalSkillsDir = resolve(config.canonicalSkillsDir);
  const canonicalCommandsDir = resolve(config.canonicalCommandsDir);
  const skillTargetDirs = Object.values(config.skillTargets).map((target) =>
    resolve(target),
  );
  const commandTargetDirs = Object.values(config.commandTargets).map((target) =>
    join(resolve(target), "opsx"),
  );
  const configPath = join("openspec", "config.yaml");
  const skillNames = openSpecSkillNames([
    canonicalSkillsDir,
    ...skillTargetDirs,
  ]);
  const commandNames = openSpecCommandNames([
    join(canonicalCommandsDir, "opsx"),
    ...commandTargetDirs,
  ]);
  const findings: string[] = [];
  const hasConfig = existsSync(configPath);
  const hasOpenSpecDirectory = existsSync("openspec");
  const hasGeneratedAssets = skillNames.length > 0 || commandNames.length > 0;
  const hasFootprint = hasConfig || hasOpenSpecDirectory || hasGeneratedAssets;

  if (!hasFootprint) {
    return {
      state: "missing",
      configPath,
      canonicalSkillsDir,
      canonicalCommandsDir,
      skillNames,
      commandNames,
      findings,
    };
  }

  if (!hasConfig) {
    findings.push(`Missing OpenSpec config: ${configPath}`);
  }
  if (skillNames.length === 0) {
    findings.push(
      `No managed OpenSpec skills found under ${canonicalSkillsDir}`,
    );
  }

  return {
    state: findings.length === 0 ? "configured" : "partial",
    configPath,
    canonicalSkillsDir,
    canonicalCommandsDir,
    skillNames,
    commandNames,
    findings,
  };
}

function nonEmptyStrings(
  values: string[] | undefined,
  defaults: string[],
): string[] {
  if (!values) {
    return defaults;
  }
  const selected = values.filter((value) => value.trim().length > 0);
  if (selected.length === 0) {
    throw new Error("runtime.openspec.tools must include at least one tool");
  }
  return selected;
}

function nonEmptyRecord(
  value: Record<string, string> | undefined,
  defaults: Record<string, string>,
  label = "target map",
): Record<string, string> {
  if (!value) {
    return defaults;
  }
  const entries = Object.entries(value).filter(
    ([, target]) => target.trim().length > 0,
  );
  if (entries.length === 0) {
    throw new Error(`${label} must not be empty`);
  }
  return Object.fromEntries(entries);
}

function ensureOpenSpecCli(): void {
  if (!openSpecCli()) {
    throw new Error(
      `OpenSpec CLI is not available. Install it with: ${OPENSPEC_INSTALL_COMMAND}`,
    );
  }
}

function openSpecCli(): { path: string; version: string } | undefined {
  const which = spawnSync("which", ["openspec"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (which.status !== 0) {
    return undefined;
  }

  const version = spawnSync("openspec", ["--version"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (version.status !== 0) {
    return undefined;
  }

  return {
    path: which.stdout.trim(),
    version: version.stdout.trim(),
  };
}

function runOpenSpecGeneration(
  config: ResolvedOpenSpecConfig,
  args: string[],
): void {
  const configHome = mkdtempSync(join(tmpdir(), "ax-openspec-"));
  const openSpecConfigDir = join(configHome, "openspec");
  mkdirSync(openSpecConfigDir, { recursive: true });
  writeFileSync(
    join(openSpecConfigDir, "config.json"),
    `${JSON.stringify(openSpecGlobalConfig(config), null, 2)}\n`,
    "utf-8",
  );

  try {
    runOpenSpecCliWithEnv(args, {
      XDG_CONFIG_HOME: configHome,
    });
  } finally {
    rmSync(configHome, { force: true, recursive: true });
  }
}

function openSpecGlobalConfig(config: ResolvedOpenSpecConfig): {
  profile: string;
  delivery: string;
  workflows: string[];
} {
  return {
    profile: config.profile,
    delivery: config.delivery,
    workflows: config.workflows,
  };
}

function runOpenSpecCliWithEnv(
  args: string[],
  env: Record<string, string>,
): void {
  run("openspec", args, { env });
}

function stabilizeOpenSpecGenerationFailure(
  config: ResolvedOpenSpecConfig,
  confirmedConfig?: string,
): void {
  if (confirmedConfig) {
    mkdirSync("openspec", { recursive: true });
    writeFileSync(join("openspec", "config.yaml"), confirmedConfig, "utf-8");
  }
  const stateReport = inspectOpenSpecState(config);
  if (stateReport.state === "partial") {
    for (const finding of stateReport.findings) {
      console.error(`repair_needed: ${finding}`);
    }
  }
}

function throwOpenSpecGenerationError(
  command: Extract<RuntimeCommand, "install" | "update">,
  cause: unknown,
  config: ResolvedOpenSpecConfig,
): never {
  const stateReport = inspectOpenSpecState(config);
  const findings =
    stateReport.findings.length > 0
      ? stateReport.findings
      : ["Inspect generated OpenSpec config, skills, commands, and symlinks."];
  const causeMessage = cause instanceof Error ? cause.message : String(cause);
  throw new Error(
    [
      `OpenSpec ${command} generation failed; repo-local setup is repairable.`,
      ...findings.map((finding) => `- ${finding}`),
      causeMessage,
    ].join("\n"),
  );
}

function normalizeOpenSpecScaffolding(config: ResolvedOpenSpecConfig): void {
  normalizeOpenSpecSkills(config);
  normalizeOpenSpecCommands(config);
}

function normalizeOpenSpecSkills(config: ResolvedOpenSpecConfig): void {
  const canonicalSkillsDir = resolve(config.canonicalSkillsDir);
  const targetEntries = Object.entries(config.skillTargets).map(
    ([targetName, target]) => [targetName, resolve(target)] as const,
  );
  const targetDirs = targetEntries.map(([, targetDir]) => targetDir);
  const skillNames = openSpecSkillNames([canonicalSkillsDir, ...targetDirs]);

  for (const skillName of skillNames) {
    const canonicalPath = join(canonicalSkillsDir, skillName);
    const sourcePath = firstExistingPath(
      targetDirs.map((targetDir) => join(targetDir, skillName)),
    );
    if (
      sourcePath &&
      realPathIfExists(sourcePath) !== realPathIfExists(canonicalPath)
    ) {
      replaceDirectory(sourcePath, canonicalPath, {
        assetKind: "openspec",
        backupsRoot: config.backupsRoot,
        targetName: "agents",
      });
    }

    for (const [targetName, targetDir] of targetEntries) {
      replaceRelativeSymlink(canonicalPath, join(targetDir, skillName), {
        assetKind: "openspec",
        backupsRoot: config.backupsRoot,
        targetName,
      });
    }
  }
}

function normalizeOpenSpecCommands(config: ResolvedOpenSpecConfig): void {
  const canonicalCommandsRoot = resolve(config.canonicalCommandsDir);
  for (const [targetName, targetRoot] of Object.entries(
    config.commandTargets,
  )) {
    const targetOpsxDir = join(resolve(targetRoot), "opsx");
    const canonicalOpsxDir = join(canonicalCommandsRoot, "opsx");
    const commandNames = openSpecCommandNames([
      canonicalOpsxDir,
      targetOpsxDir,
    ]);

    for (const commandName of commandNames) {
      const canonicalPath = join(canonicalOpsxDir, commandName);
      const sourcePath = firstExistingPath([join(targetOpsxDir, commandName)]);
      if (
        sourcePath &&
        realPathIfExists(sourcePath) !== realPathIfExists(canonicalPath)
      ) {
        replaceFile(sourcePath, canonicalPath, {
          assetKind: "openspec",
          backupsRoot: config.backupsRoot,
          targetName: "agents",
        });
      }
      replaceRelativeSymlink(canonicalPath, join(targetOpsxDir, commandName), {
        assetKind: "openspec",
        backupsRoot: config.backupsRoot,
        targetName,
      });
    }

    if (commandNames.length > 0) {
      console.log(`Normalized OpenSpec commands for ${targetName}`);
    }
  }
}

function validateOpenSpec(config: ResolvedOpenSpecConfig): void {
  const errors = openSpecValidationErrors(config);
  if (errors.length > 0) {
    throw new Error(
      `Invalid repo-local OpenSpec scaffolding:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}

function openSpecValidationErrors(config: ResolvedOpenSpecConfig): string[] {
  const errors: string[] = [];
  validateOpenSpecConfigQuality(errors);
  validateOpenSpecReusableScripts(config, errors);
  const canonicalSkillsDir = resolve(config.canonicalSkillsDir);
  const skillTargetDirs = Object.values(config.skillTargets).map((target) =>
    resolve(target),
  );
  const skillNames = openSpecSkillNames([
    canonicalSkillsDir,
    ...skillTargetDirs,
  ]);

  if (skillNames.length === 0) {
    errors.push("No repo-local OpenSpec skills found");
  }

  for (const skillName of skillNames) {
    const canonicalPath = join(canonicalSkillsDir, skillName);
    if (!lstatIfExists(canonicalPath)?.isDirectory()) {
      errors.push(`Missing canonical OpenSpec skill: ${canonicalPath}`);
    }
    for (const targetDir of skillTargetDirs) {
      validateSymlink({
        linkPath: join(targetDir, skillName),
        expectedTarget: canonicalPath,
        label: `OpenSpec skill ${skillName}`,
        errors,
      });
    }
  }

  for (const targetRoot of Object.values(config.commandTargets)) {
    const targetOpsxDir = join(resolve(targetRoot), "opsx");
    const canonicalOpsxDir = join(resolve(config.canonicalCommandsDir), "opsx");
    const commandNames = openSpecCommandNames([
      canonicalOpsxDir,
      targetOpsxDir,
    ]);
    for (const commandName of commandNames) {
      const canonicalPath = join(canonicalOpsxDir, commandName);
      if (!lstatIfExists(canonicalPath)?.isFile()) {
        errors.push(`Missing canonical OpenSpec command: ${canonicalPath}`);
      }
      validateSymlink({
        linkPath: join(targetOpsxDir, commandName),
        expectedTarget: canonicalPath,
        label: `OpenSpec command ${commandName}`,
        errors,
      });
    }
  }

  return errors;
}

function validateOpenSpecConfigQuality(errors: string[]): void {
  const configPath = join("openspec", "config.yaml");
  if (!existsSync(configPath)) {
    errors.push(`Missing OpenSpec config: ${configPath}`);
    return;
  }
  const content = readFileSync(configPath, "utf-8");
  const parsed = parseOpenSpecConfigDocument(content);
  if (!parsed.schema) {
    errors.push("OpenSpec config missing schema");
  } else if (!KNOWN_OPENSPEC_SCHEMAS.has(parsed.schema)) {
    errors.push(`Unknown OpenSpec schema: ${parsed.schema}`);
  }
  const contextLength = parsed.contextLines.join("\n").length;
  if (contextLength > MAX_OPENSPEC_CONTEXT_LENGTH) {
    errors.push(
      `OpenSpec context is too large: ${contextLength} characters exceeds ${MAX_OPENSPEC_CONTEXT_LENGTH}`,
    );
  }
  for (const artifact of Object.keys(parsed.rules)) {
    if (!KNOWN_OPENSPEC_ARTIFACT_IDS.has(artifact)) {
      errors.push(
        `OpenSpec config has rules for unknown artifact: ${artifact}`,
      );
    }
  }
}

function validateOpenSpecReusableScripts(
  config: ResolvedOpenSpecConfig,
  errors: string[],
): void {
  for (const runtimeFile of config.reusableScripts) {
    const sourcePath = runtimeFileSourcePath(runtimeFile);
    const targetPath = runtimeFileTargetPath(runtimeFile);
    if (!existsSync(sourcePath)) {
      errors.push(`Missing reusable runtime script source: ${sourcePath}`);
    }
    if (targetPath.trim().length === 0) {
      errors.push(`Reusable runtime script has empty target: ${sourcePath}`);
    }
  }
}

function statusOpenSpec(
  config: ResolvedOpenSpecConfig,
  stateReport = inspectOpenSpecState(config),
): void {
  const cli = openSpecCli();
  if (!cli) {
    throw new Error(
      `OpenSpec CLI is not available. Install it with: ${OPENSPEC_INSTALL_COMMAND}`,
    );
  }

  console.log(`OpenSpec CLI: ${cli.path} (${cli.version})`);
  console.log(`OpenSpec state: ${stateReport.state}`);
  for (const finding of stateReport.findings) {
    console.log(`  - ${finding}`);
  }
  printPathStatus("OpenSpec config", join("openspec", "config.yaml"));
  statusOpenSpecSkills(config);
  statusOpenSpecCommands(config);
}

function statusOpenSpecSkills(config: ResolvedOpenSpecConfig): void {
  const canonicalSkillsDir = resolve(config.canonicalSkillsDir);
  const targetEntries = Object.entries(config.skillTargets).map(
    ([targetName, targetPath]) => ({
      targetName,
      targetDir: resolve(targetPath),
    }),
  );
  const skillNames = openSpecSkillNames([
    canonicalSkillsDir,
    ...targetEntries.map((entry) => entry.targetDir),
  ]);

  for (const skillName of skillNames) {
    const canonicalPath = join(canonicalSkillsDir, skillName);
    printPathStatus(`OpenSpec skill ${skillName}`, canonicalPath);
    for (const entry of targetEntries) {
      printSymlinkStatus(
        `  ${entry.targetName}: ${join(entry.targetDir, skillName)}`,
        join(entry.targetDir, skillName),
        canonicalPath,
      );
    }
  }
}

function statusOpenSpecCommands(config: ResolvedOpenSpecConfig): void {
  const canonicalOpsxDir = join(resolve(config.canonicalCommandsDir), "opsx");
  for (const [targetName, targetRoot] of Object.entries(
    config.commandTargets,
  )) {
    const targetOpsxDir = join(resolve(targetRoot), "opsx");
    const commandNames = openSpecCommandNames([
      canonicalOpsxDir,
      targetOpsxDir,
    ]);
    for (const commandName of commandNames) {
      const canonicalPath = join(canonicalOpsxDir, commandName);
      printPathStatus(`OpenSpec command ${commandName}`, canonicalPath);
      printSymlinkStatus(
        `  ${targetName}: ${join(targetOpsxDir, commandName)}`,
        join(targetOpsxDir, commandName),
        canonicalPath,
      );
    }
  }
}

function runHooks(
  command: RuntimeCommand,
  config: Config,
  options: { enforceValidate?: boolean } = {},
): void {
  const hooks = resolvedHooksConfig(config);
  validateHookConfig(hooks);

  if (command === "status") {
    statusHooks(hooks);
    return;
  }

  if (command === "validate") {
    statusHooks(hooks);
    if (options.enforceValidate ?? true) {
      validateInstalledHooks(hooks);
      validateHookRegistrations(hooks);
    }
    console.log("Validated hook configuration.");
    return;
  }

  validateDurableHookSource(hooks);
  validateHookReplacementTargets(hooks);
  preflightHookRegistrations(hooks);
  installHookSymlinks(hooks);
  installHookRegistrations(hooks);
  console.log(
    `${command === "install" ? "Installed" : "Updated"} managed hooks.`,
  );
}

export function registerCodexStartupHook(
  input: CodexStartupHookRegistrationInput,
): StartupHookRegistrationResult {
  return registerStartupHookInJson(
    expandHome(input.hooksJsonPath),
    input.command,
  );
}

export function codexStartupHookStatus(
  input: CodexStartupHookRegistrationInput,
): StartupHookStatus {
  const hooksJsonPath = expandHome(input.hooksJsonPath);
  const configTomlPath = expandHome(input.configTomlPath);
  const document = readHookConfigDocument(hooksJsonPath);
  const locations = findStartupHookLocations(document, input.command);
  const staleLocations = findStaleManagedStartupHookLocations(
    document,
    input.command,
  );
  const gaps: string[] = [];
  if (locations.length === 0) {
    gaps.push("codex startup hook registration missing");
    return {
      registered: false,
      locations,
      staleLocations,
      trustState: "not_applicable",
      gaps,
    };
  }
  if (locations.length > 1) {
    gaps.push("codex startup hook duplicate registrations");
  }
  if (staleLocations.length > 0) {
    gaps.push("codex startup hook stale registrations");
  }

  const configToml = existsSync(configTomlPath)
    ? readFileSync(configTomlPath, "utf-8")
    : "";
  const untrustedLocations = locations.filter(
    (location) =>
      !codexHookLocationIsTrusted({
        configToml,
        hooksJsonPath,
        location,
      }),
  );
  if (untrustedLocations.length > 0) {
    gaps.push("codex startup hook trust missing");
  }

  return {
    registered: true,
    locations,
    staleLocations,
    trustState: untrustedLocations.length === 0 ? "trusted" : "missing",
    gaps,
  };
}

export function registerClaudeStartupHook(
  input: ClaudeStartupHookRegistrationInput,
): StartupHookRegistrationResult {
  return registerStartupHookInJson(
    expandHome(input.settingsJsonPath),
    input.command,
  );
}

export function claudeStartupHookStatus(
  input: ClaudeStartupHookRegistrationInput,
): StartupHookStatus {
  const settingsJsonPath = expandHome(input.settingsJsonPath);
  const document = readHookConfigDocument(settingsJsonPath);
  const locations = findStartupHookLocations(document, input.command);
  const staleLocations = findStaleManagedStartupHookLocations(
    document,
    input.command,
  );
  const gaps: string[] = [];
  if (locations.length === 0) {
    gaps.push("claude startup hook registration missing");
  }
  if (locations.length > 1) {
    gaps.push("claude startup hook duplicate registrations");
  }
  if (staleLocations.length > 0) {
    gaps.push("claude startup hook stale registrations");
  }
  return {
    registered: locations.length > 0,
    locations,
    staleLocations,
    trustState: "not_applicable",
    gaps,
  };
}

function registerStartupHookInJson(
  configPath: string,
  command: string,
): StartupHookRegistrationResult {
  const document = readHookConfigDocument(configPath);
  const staleChanged = removeStaleManagedStartupHooks(document, command);
  const existingLocations = findStartupHookLocations(document, command);
  if (existingLocations.length > 0) {
    const changed = removeDuplicateStartupHooks(document, command);
    if (staleChanged || changed) {
      mkdirSync(dirname(configPath), { recursive: true });
      writeJson(configPath, document);
    }
    return { changed: staleChanged || changed, location: existingLocations[0] };
  }

  const sessionStart = ensureSessionStartMatchers(document);
  let matcherIndex = sessionStart.findIndex(
    (entry) => entry.matcher === undefined,
  );
  if (matcherIndex === -1) {
    matcherIndex = sessionStart.length;
    sessionStart.push({ hooks: [] });
  }

  const matcher = sessionStart[matcherIndex];
  matcher.hooks ??= [];
  const hookIndex = matcher.hooks.length;
  matcher.hooks.push({ type: "command", command });
  mkdirSync(dirname(configPath), { recursive: true });
  writeJson(configPath, document);

  return {
    changed: true,
    location: {
      event: "SessionStart",
      eventKey: "session_start",
      matcherIndex,
      hookIndex,
    },
  };
}

function readHookConfigDocument(configPath: string): HookConfigDocument {
  if (!existsSync(configPath)) {
    return { hooks: {} };
  }
  const document = readJson<HookConfigDocument>(configPath);
  if (
    document === null ||
    typeof document !== "object" ||
    Array.isArray(document)
  ) {
    throw new Error(`Invalid hook config document: ${configPath}`);
  }
  if (document.hooks !== undefined && !isPlainRecord(document.hooks)) {
    throw new Error(`Invalid hooks object in ${configPath}`);
  }
  return document;
}

function ensureSessionStartMatchers(
  document: HookConfigDocument,
): HookMatcher[] {
  document.hooks ??= {};
  const sessionStart = document.hooks.SessionStart;
  if (sessionStart === undefined) {
    document.hooks.SessionStart = [];
    return document.hooks.SessionStart;
  }
  if (!Array.isArray(sessionStart)) {
    throw new Error("Invalid SessionStart hook registration");
  }
  for (const [matcherIndex, matcher] of sessionStart.entries()) {
    if (!isPlainRecord(matcher)) {
      throw new Error(
        `Invalid SessionStart hook matcher at index ${matcherIndex}`,
      );
    }
    if (matcher.hooks !== undefined && !Array.isArray(matcher.hooks)) {
      throw new Error(
        `Invalid SessionStart hooks array at matcher index ${matcherIndex}`,
      );
    }
    for (const [hookIndex, hook] of (matcher.hooks ?? []).entries()) {
      if (!isPlainRecord(hook)) {
        throw new Error(
          `Invalid SessionStart hook at matcher index ${matcherIndex}, hook index ${hookIndex}`,
        );
      }
    }
  }
  return sessionStart;
}

function removeDuplicateStartupHooks(
  document: HookConfigDocument,
  command: string,
): boolean {
  const sessionStart = ensureSessionStartMatchers(document);
  let found = false;
  let changed = false;
  for (const matcher of sessionStart) {
    if (!matcher.hooks) {
      continue;
    }
    matcher.hooks = matcher.hooks.filter((hook) => {
      if (hook.type !== "command" || hook.command !== command) {
        return true;
      }
      if (!found) {
        found = true;
        return true;
      }
      changed = true;
      return false;
    });
  }
  return changed;
}

function removeStaleManagedStartupHooks(
  document: HookConfigDocument,
  command: string,
): boolean {
  const staleLocations = findStaleManagedStartupHookLocations(
    document,
    command,
  );
  if (staleLocations.length === 0) {
    return false;
  }
  const sessionStart = ensureSessionStartMatchers(document);
  for (const matcher of sessionStart) {
    if (!matcher.hooks) {
      continue;
    }
    matcher.hooks = matcher.hooks.filter((hook) => {
      return !isStaleManagedStartupHook(hook, command);
    });
  }
  return true;
}

function findStartupHookLocations(
  document: HookConfigDocument,
  command: string,
): StartupHookLocation[] {
  const sessionStart = ensureSessionStartMatchers(document);

  const locations: StartupHookLocation[] = [];
  for (const [matcherIndex, matcher] of sessionStart.entries()) {
    if (!matcher.hooks) {
      continue;
    }
    for (const [hookIndex, hook] of matcher.hooks.entries()) {
      if (
        isPlainRecord(hook) &&
        hook.type === "command" &&
        hook.command === command
      ) {
        locations.push({
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex,
          hookIndex,
        });
      }
    }
  }
  return locations;
}

function findStaleManagedStartupHookLocations(
  document: HookConfigDocument,
  command: string,
): StartupHookLocation[] {
  const sessionStart = ensureSessionStartMatchers(document);

  const locations: StartupHookLocation[] = [];
  for (const [matcherIndex, matcher] of sessionStart.entries()) {
    if (!matcher.hooks) {
      continue;
    }
    for (const [hookIndex, hook] of matcher.hooks.entries()) {
      if (isPlainRecord(hook) && isStaleManagedStartupHook(hook, command)) {
        locations.push({
          event: "SessionStart",
          eventKey: "session_start",
          matcherIndex,
          hookIndex,
        });
      }
    }
  }
  return locations;
}

function isStaleManagedStartupHook(
  hook: HookCommand,
  command: string,
): boolean {
  return (
    hook.type === "command" &&
    hook.command !== command &&
    hook.command?.includes("startup-git-sync.ts") === true
  );
}

function codexHookLocationIsTrusted(input: {
  configToml: string;
  hooksJsonPath: string;
  location: StartupHookLocation;
}): boolean {
  const trustKey = [
    input.hooksJsonPath,
    input.location.eventKey,
    input.location.matcherIndex,
    input.location.hookIndex,
  ].join(":");
  const section = `[hooks.state."${tomlBasicStringEscape(trustKey)}"]`;
  let inSection = false;
  for (const line of input.configToml.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      inSection = trimmed === section;
      continue;
    }
    if (inSection && /^trusted_hash\s*=/u.test(trimmed)) {
      return true;
    }
  }
  return false;
}

function tomlBasicStringEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolvedHooksConfig(config: Config): ResolvedHooksConfig {
  const input = config.runtime.hooks ?? {};
  const sourceDir = input.sourceDir ?? "hooks";
  const startupRemoteName = input.startupRemote?.name ?? "origin";
  return {
    sourceDir,
    canonicalDir: input.canonicalDir ?? "~/.agents/hooks",
    targets: nonEmptyRecord(
      input.targets,
      {
        codex: "~/.codex/hooks",
        claude: "~/.claude/hooks",
      },
      "runtime.hooks.targets",
    ),
    backupsRoot: runtimeBackupsRoot(config),
    allowDisposableSource: input.allowDisposableSource === true,
    registration: {
      startupCommand:
        input.registration?.startupCommand ??
        startupGitSyncCommand(sourceDir, startupRemoteName),
      codexHooksJsonPath:
        input.registration?.codexHooksJsonPath ?? "~/.codex/hooks.json",
      codexConfigTomlPath:
        input.registration?.codexConfigTomlPath ?? "~/.codex/config.toml",
      claudeSettingsJsonPath:
        input.registration?.claudeSettingsJsonPath ?? "~/.claude/settings.json",
    },
    startupRemote: {
      name: startupRemoteName,
      expectedUrl: input.startupRemote?.expectedUrl,
    },
  };
}

function startupGitSyncCommand(sourceDir: string, remoteName: string): string {
  const scriptPath = join(
    resolve(expandHome(sourceDir)),
    "startup-git-sync.ts",
  );
  const loaderPath = pathToFileURL(
    join(
      dirname(resolve(expandHome(sourceDir))),
      "node_modules",
      "tsx",
      "dist",
      "loader.mjs",
    ),
  ).href;
  const argv = [
    process.execPath,
    "--import",
    loaderPath,
    scriptPath,
    "--remote",
    remoteName,
  ];
  return argv.map((arg) => JSON.stringify(arg)).join(" ");
}

function validateHookConfig(config: ResolvedHooksConfig): void {
  const sourceDir = resolve(expandHome(config.sourceDir));
  if (!lstatIfExists(sourceDir)?.isDirectory()) {
    throw new Error(`Missing hooks source directory: ${config.sourceDir}`);
  }

  if (config.canonicalDir.trim().length === 0) {
    throw new Error("runtime.hooks.canonicalDir must be configured");
  }
  if (Object.keys(config.targets).length === 0) {
    throw new Error("runtime.hooks.targets must configure at least one target");
  }
}

function validateHookReplacementTargets(config: ResolvedHooksConfig): void {
  const sourceDir = resolve(expandHome(config.sourceDir));
  validateHookReplacementTarget(expandHome(config.canonicalDir), sourceDir);
  for (const targetDir of Object.values(config.targets)) {
    validateHookReplacementTarget(
      expandHome(targetDir),
      expandHome(config.canonicalDir),
    );
  }
}

function validateHookReplacementTarget(linkPath: string, target: string): void {
  const stats = lstatIfExists(linkPath);
  if (!stats) {
    return;
  }
  if (
    stats.isSymbolicLink() &&
    realPathIfExists(linkPath) === realPathIfExists(target)
  ) {
    return;
  }
  if (stats.isSymbolicLink() || stats.isDirectory()) {
    return;
  }
  throw new Error(`Refusing to replace unsafe hook target: ${linkPath}`);
}

function validateDurableHookSource(config: ResolvedHooksConfig): void {
  if (config.allowDisposableSource) {
    return;
  }
  const sourceDir = resolve(expandHome(config.sourceDir));
  if (sourceDir.includes(`${sep}.codex${sep}worktrees${sep}`)) {
    throw new Error(
      `Refusing to install hooks from disposable worktree source: ${sourceDir}`,
    );
  }
}

function validateInstalledHooks(config: ResolvedHooksConfig): void {
  const sourceDir = resolve(expandHome(config.sourceDir));
  const canonicalDir = expandHome(config.canonicalDir);
  const errors: string[] = [];
  validateSymlink({
    linkPath: canonicalDir,
    expectedTarget: sourceDir,
    label: "canonical hooks",
    errors,
  });
  for (const [targetName, targetDir] of Object.entries(config.targets)) {
    validateSymlink({
      linkPath: expandHome(targetDir),
      expectedTarget: canonicalDir,
      label: `${targetName} hooks`,
      errors,
    });
  }
  if (errors.length > 0) {
    throw new Error(
      `Invalid managed hooks:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}

type HookSymlinkOperation = {
  targetName: string;
  target: string;
  linkPath: string;
};

function installHookSymlinks(config: ResolvedHooksConfig): void {
  const sourceDir = resolve(expandHome(config.sourceDir));
  const canonicalDir = expandHome(config.canonicalDir);
  const operations: HookSymlinkOperation[] = [
    {
      targetName: "agents",
      target: sourceDir,
      linkPath: canonicalDir,
    },
  ];
  for (const [targetName, targetDir] of Object.entries(config.targets)) {
    operations.push({
      targetName,
      target: canonicalDir,
      linkPath: expandHome(targetDir),
    });
  }

  for (const operation of operations) {
    backupHookSymlinkOperation(operation, config.backupsRoot);
  }
  for (const operation of operations) {
    replaceHookSymlink(operation);
  }
}

function installHookRegistrations(config: ResolvedHooksConfig): void {
  const targets = hookRegistrationTargets(config);
  for (const target of targets) {
    const status = target.status();
    if (!hookRegistrationNeedsMutation(status)) {
      continue;
    }
    backupRuntimeTarget(expandHome(target.backupPath), {
      assetKind: "config",
      backupsRoot: config.backupsRoot,
      targetName: target.targetName,
    });
    target.register();
  }
}

function preflightHookRegistrations(config: ResolvedHooksConfig): void {
  for (const target of hookRegistrationTargets(config)) {
    target.status();
  }
}

type HookRegistrationTarget = {
  targetName: "claude" | "codex";
  backupPath: string;
  status: () => StartupHookStatus;
  register: () => StartupHookRegistrationResult;
};

function hookRegistrationTargets(
  config: ResolvedHooksConfig,
): HookRegistrationTarget[] {
  const startupCommand = config.registration.startupCommand;
  const codexInput: CodexStartupHookRegistrationInput = {
    hooksJsonPath: config.registration.codexHooksJsonPath,
    configTomlPath: config.registration.codexConfigTomlPath,
    command: startupCommand,
  };
  const claudeInput: ClaudeStartupHookRegistrationInput = {
    settingsJsonPath: config.registration.claudeSettingsJsonPath,
    command: startupCommand,
  };
  return [
    {
      targetName: "claude",
      backupPath: claudeInput.settingsJsonPath,
      status: () => claudeStartupHookStatus(claudeInput),
      register: () => registerClaudeStartupHook(claudeInput),
    },
    {
      targetName: "codex",
      backupPath: codexInput.hooksJsonPath,
      status: () => codexStartupHookStatus(codexInput),
      register: () => registerCodexStartupHook(codexInput),
    },
  ];
}

function hookRegistrationNeedsMutation(status: StartupHookStatus): boolean {
  return (
    !status.registered ||
    status.locations.length > 1 ||
    status.staleLocations.length > 0
  );
}

function statusHooks(config: ResolvedHooksConfig): void {
  const sourceDir = resolve(expandHome(config.sourceDir));
  const canonicalDir = expandHome(config.canonicalDir);
  printPathStatus("Hook source", sourceDir);
  printSymlinkStatus("Canonical hooks", canonicalDir, sourceDir);
  for (const [targetName, targetDir] of Object.entries(config.targets)) {
    printSymlinkStatus(
      `${targetName} hooks`,
      expandHome(targetDir),
      canonicalDir,
    );
  }
  for (const target of hookRegistrationTargets(config)) {
    printHookRegistrationStatus(target.targetName, target.status());
  }
  printStartupRemoteStatus(config);
}

function printHookRegistrationStatus(
  targetName: "claude" | "codex",
  status: StartupHookStatus,
): void {
  if (!status.registered) {
    console.log(`[missing] ${targetName} startup hook registration`);
    return;
  }
  if (status.locations.length > 1) {
    console.log(`[duplicate] ${targetName} startup hook registration`);
  } else {
    console.log(`[ok] ${targetName} startup hook registration`);
  }
  if (targetName === "codex") {
    console.log(
      `[${status.trustState === "trusted" ? "trusted" : "untrusted"}] codex startup hook trust`,
    );
  }
}

function printStartupRemoteStatus(config: ResolvedHooksConfig): void {
  const selectedRemote = config.startupRemote.name;
  const remoteUrl = gitRemoteUrl(selectedRemote);
  if (!remoteUrl) {
    console.log(
      `[warning] startup Git sync remote ${selectedRemote}: unavailable`,
    );
    return;
  }
  if (
    config.startupRemote.expectedUrl &&
    remoteUrl !== config.startupRemote.expectedUrl
  ) {
    console.log(
      `[warning] startup Git sync remote ${selectedRemote}: ${remoteUrl} differs from expected ${config.startupRemote.expectedUrl}`,
    );
    return;
  }
  console.log(`[ok] startup Git sync remote ${selectedRemote}: ${remoteUrl}`);
}

function gitRemoteUrl(remoteName: string): string | undefined {
  const result = spawnSync("git", ["remote", "get-url", remoteName], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim();
}

function validateHookRegistrations(config: ResolvedHooksConfig): void {
  const errors: string[] = [];
  for (const target of hookRegistrationTargets(config)) {
    collectBlockingRegistrationGaps(target.targetName, target.status(), errors);
  }
  if (errors.length > 0) {
    throw new Error(
      `Invalid hook registrations:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}

function collectBlockingRegistrationGaps(
  targetName: "claude" | "codex",
  status: StartupHookStatus,
  errors: string[],
): void {
  if (!status.registered) {
    errors.push(
      `${targetName}: ${targetName} startup hook registration missing`,
    );
  }
  if (status.locations.length > 1) {
    errors.push(
      `${targetName}: ${targetName} startup hook duplicate registrations`,
    );
  }
  if (status.staleLocations.length > 0) {
    errors.push(
      `${targetName}: ${targetName} startup hook stale registrations`,
    );
  }
}

function replaceHookSymlink(operation: HookSymlinkOperation): void {
  const stats = lstatIfExists(operation.linkPath);
  if (
    stats?.isSymbolicLink() &&
    realPathIfExists(operation.linkPath) === realPathIfExists(operation.target)
  ) {
    return;
  }

  if (stats && !stats.isSymbolicLink() && !stats.isDirectory()) {
    throw new Error(
      `Refusing to replace unsafe hook target: ${operation.linkPath}`,
    );
  }
  rmSync(operation.linkPath, { force: true, recursive: true });
  mkdirSync(dirname(operation.linkPath), { recursive: true });
  symlinkSync(operation.target, operation.linkPath, "dir");
}

function backupHookSymlinkOperation(
  operation: HookSymlinkOperation,
  backupsRoot: string,
): void {
  const stats = lstatIfExists(operation.linkPath);
  if (
    stats?.isSymbolicLink() &&
    realPathIfExists(operation.linkPath) === realPathIfExists(operation.target)
  ) {
    return;
  }
  backupRuntimeTarget(operation.linkPath, {
    assetKind: "hooks",
    backupsRoot,
    targetName: operation.targetName,
  });
}

function validateSymlink(input: {
  linkPath: string;
  expectedTarget: string;
  label: string;
  errors: string[];
}): void {
  const stats = lstatIfExists(input.linkPath);
  if (!stats) {
    input.errors.push(`Missing ${input.label} symlink: ${input.linkPath}`);
    return;
  }
  if (!stats.isSymbolicLink()) {
    input.errors.push(`Expected symlink for ${input.label}: ${input.linkPath}`);
    return;
  }
  if (
    realPathIfExists(input.linkPath) !== realPathIfExists(input.expectedTarget)
  ) {
    input.errors.push(
      `Wrong target for ${input.label}: ${input.linkPath} -> ${readlinkSync(input.linkPath)}`,
    );
  }
}

function openSpecSkillNames(directories: string[]): string[] {
  return discoverNames(directories, (entry) => {
    if (!entry.name.startsWith("openspec-")) {
      return false;
    }
    const path = entry.path;
    const stats = lstatIfExists(path);
    if (!stats) {
      return false;
    }
    if (stats.isDirectory() || stats.isSymbolicLink()) {
      return true;
    }
    return false;
  });
}

function openSpecCommandNames(directories: string[]): string[] {
  return discoverNames(
    directories,
    (entry) => entry.name.endsWith(".md") && Boolean(lstatIfExists(entry.path)),
  );
}

function discoverNames(
  directories: string[],
  include: (entry: { name: string; path: string }) => boolean,
): string[] {
  const names = new Set<string>();
  for (const directory of directories) {
    if (!existsSync(directory)) {
      continue;
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (include({ name: entry.name, path })) {
        names.add(entry.name);
      }
    }
  }
  return [...names].sort();
}

function firstExistingPath(paths: string[]): string | undefined {
  return paths.find((path) => existsSync(path));
}

function replaceFile(
  source: string,
  destination: string,
  backup?: RuntimeBackupContext,
): void {
  const temporaryDestination = `${destination}.tmp-${process.pid}`;
  rmSync(temporaryDestination, { force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, temporaryDestination);
  backupRuntimeTarget(destination, backup);
  rmSync(destination, { force: true });
  renameSync(temporaryDestination, destination);
}

function replaceRelativeSymlink(
  target: string,
  linkPath: string,
  backup?: RuntimeBackupContext,
): void {
  const stats = lstatIfExists(linkPath);
  if (stats) {
    if (
      stats.isSymbolicLink() &&
      realPathIfExists(linkPath) === realPathIfExists(target)
    ) {
      return;
    }
    backupRuntimeTarget(linkPath, backup);
    rmSync(linkPath, { force: true, recursive: true });
  } else {
    backupRuntimeTarget(linkPath, backup);
  }
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(
    relative(dirname(linkPath), target),
    linkPath,
    symlinkType(target),
  );
}

function runSkills(
  command: RuntimeCommand,
  config: Config,
  selection: ProfileSelection,
): void {
  const profileNames = selectedSkillProfileNames(config, selection);

  if (command === "validate") {
    validateSkillConfig(config, profileNames);
    validateLockIfPresent(lockFileFor(config));
    return;
  }
  if (command === "status") {
    statusSkills(config, profileNames);
    return;
  }
  validateSkillConfig(config, profileNames);

  const lockFile = lockFileFor(config);
  const lock = readLock(lockFile);
  const backupsRoot = runtimeBackupsRoot(config);
  const canonicalSkillsDir = expandHome(config.runtime.canonicalSkillsDir);
  const symlinkTargets = resolveSkillSymlinkTargets(
    canonicalSkillsDir,
    config.runtime.skillSymlinkTargets.map(expandHome),
  );

  mkdirSync(canonicalSkillsDir, { recursive: true });
  for (const target of symlinkTargets) {
    mkdirSync(target, { recursive: true });
  }
  mkdirSync(CACHE_DIR, { recursive: true });

  installSkillUnion({
    command,
    config,
    lock,
    profileNames,
    canonicalSkillsDir,
    symlinkTargets,
    backupsRoot,
  });
  installReusableScripts(config, [canonicalSkillsDir, ...symlinkTargets]);
  pruneRetiredManagedSkills(
    lock,
    profileNames,
    [canonicalSkillsDir, ...symlinkTargets],
    backupsRoot,
  );

  backupRuntimeTarget(lockFile, {
    assetKind: "config",
    backupsRoot,
    targetName: "ax-lock",
  });
  writeJson(lockFile, lock);
}

function installSkillUnion(input: {
  command: SkillCommand;
  config: Config;
  lock: LockFile;
  profileNames: string[];
  canonicalSkillsDir: string;
  symlinkTargets: string[];
  backupsRoot: string;
}): void {
  const profileSources = new Map<string, SkillSource[]>();
  const installPlans = buildSkillInstallPlans(
    input.config,
    input.profileNames,
    profileSources,
  );
  const installedByKey = new Map<string, LockedSkill>();
  const verb = input.command === "install" ? "Installing" : "Updating";
  let resolvedWorkspaceCommit: string | undefined;

  console.log(
    `${verb} ${skillPlanCount(installPlans)} unique skill${skillPlanCount(installPlans) === 1 ? "" : "s"} ` +
      `from ${input.profileNames.length} profile${input.profileNames.length === 1 ? "" : "s"}`,
  );

  for (const plan of installPlans) {
    validateSource(plan.source);
    if (isLocalSource(plan.source)) {
      resolvedWorkspaceCommit ??= workspaceCommit();
      for (const skillName of plan.skillNames) {
        const lockedSkill = installLocalSkill({
          source: plan.source,
          skillName,
          resolvedCommit: resolvedWorkspaceCommit,
          canonicalSkillsDir: input.canonicalSkillsDir,
          symlinkTargets: input.symlinkTargets,
          backupsRoot: input.backupsRoot,
        });

        installedByKey.set(
          skillInstallKey(plan.source, skillName),
          lockedSkill,
        );
        console.log(
          `${input.command === "install" ? "Installed" : "Updated"} ${skillName}`,
        );
      }
      continue;
    }

    const repoDir = cachePathForSource(plan.source.url);
    const lockedCommit = lockedCommitForSourceAcross(
      input.lock,
      input.profileNames,
      plan.source,
    );
    ensureRepo(
      plan.source.url,
      repoDir,
      input.command === "update" || !lockedCommit,
    );

    const resolvedCommit =
      input.command === "install"
        ? (lockedCommit ?? resolveCommit(repoDir, plan.source.ref))
        : resolveCommit(repoDir, plan.source.ref);

    ensureCommitAvailable(repoDir, resolvedCommit);
    checkout(repoDir, resolvedCommit);

    for (const skillName of plan.skillNames) {
      const lockedSkill = installSkill({
        source: plan.source,
        skillName,
        resolvedCommit,
        canonicalSkillsDir: input.canonicalSkillsDir,
        symlinkTargets: input.symlinkTargets,
        backupsRoot: input.backupsRoot,
      });

      installedByKey.set(skillInstallKey(plan.source, skillName), lockedSkill);
      console.log(
        `${input.command === "install" ? "Installed" : "Updated"} ${skillName}`,
      );
    }
  }

  for (const profileName of input.profileNames) {
    const installedSkills: Record<string, LockedSkill> = {};
    for (const source of profileSources.get(profileName) ?? []) {
      for (const skillName of source.names) {
        const lockedSkill = installedByKey.get(
          skillInstallKey(source, skillName),
        );
        if (!lockedSkill) {
          throw new Error(
            `Internal error: missing installed skill '${skillName}' for profile '${profileName}'`,
          );
        }
        installedSkills[skillName] = lockedSkill;
      }
    }
    input.lock.skillsets[profileName] = {
      skills: sortRecord(installedSkills),
    };
  }
}

function pruneRetiredManagedSkills(
  lock: LockFile,
  profileNames: string[],
  skillDirs: string[],
  backupsRoot: string,
): void {
  for (const profileName of profileNames) {
    for (const retiredName of RETIRED_MANAGED_SKILL_NAMES) {
      delete lock.skillsets[profileName]?.skills[retiredName];
    }
  }

  for (const directory of skillDirs) {
    for (const retiredName of RETIRED_MANAGED_SKILL_NAMES) {
      removeRetiredManagedSkill(join(directory, retiredName), backupsRoot);
    }
  }
}

function removeRetiredManagedSkill(path: string, backupsRoot: string): void {
  if (!existsSync(path)) {
    return;
  }

  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    backupRuntimeTarget(path, {
      assetKind: "skills",
      backupsRoot,
      targetName: runtimeTargetName(path),
    });
    rmSync(path, { force: true });
    return;
  }

  if (stat.isDirectory() && existsSync(join(path, "SKILL.md"))) {
    backupRuntimeTarget(path, {
      assetKind: "skills",
      backupsRoot,
      targetName: runtimeTargetName(path),
    });
    rmSync(path, { force: true, recursive: true });
  }
}

function installSkill(input: {
  source: RemoteSkillSource;
  skillName: string;
  resolvedCommit: string;
  canonicalSkillsDir: string;
  symlinkTargets: string[];
  backupsRoot: string;
}): LockedSkill {
  const skillPath = join(input.source.basePath, input.skillName);
  const sourceSkillDir = join(cachePathForSource(input.source.url), skillPath);
  if (!existsSync(join(sourceSkillDir, "SKILL.md"))) {
    throw new Error(
      `Missing SKILL.md for '${input.skillName}' at ${input.source.url}:${skillPath}`,
    );
  }

  const destination = join(input.canonicalSkillsDir, input.skillName);
  replaceDirectory(sourceSkillDir, destination, {
    assetKind: "skills",
    backupsRoot: input.backupsRoot,
    targetName: runtimeTargetName(input.canonicalSkillsDir),
  });
  for (const target of input.symlinkTargets) {
    replaceSymlink(destination, join(target, input.skillName), {
      assetKind: "skills",
      backupsRoot: input.backupsRoot,
      targetName: runtimeTargetName(target),
    });
  }

  return {
    sourceType: "git",
    url: input.source.url,
    ref: input.source.ref,
    resolvedCommit: input.resolvedCommit,
    basePath: input.source.basePath,
    skillPath,
    contentHash: hashDirectory(sourceSkillDir),
  };
}

function installLocalSkill(input: {
  source: LocalSkillSource;
  skillName: string;
  resolvedCommit: string;
  canonicalSkillsDir: string;
  symlinkTargets: string[];
  backupsRoot: string;
}): LockedSkill {
  const skillPath = join(input.source.localPath, input.skillName);
  const sourceSkillDir = resolve(skillPath);
  if (!existsSync(join(sourceSkillDir, "SKILL.md"))) {
    throw new Error(
      `Missing SKILL.md for local skill '${input.skillName}' at ${skillPath}`,
    );
  }

  const destination = join(input.canonicalSkillsDir, input.skillName);
  replaceDirectory(sourceSkillDir, destination, {
    assetKind: "skills",
    backupsRoot: input.backupsRoot,
    targetName: runtimeTargetName(input.canonicalSkillsDir),
  });
  for (const target of input.symlinkTargets) {
    replaceSymlink(destination, join(target, input.skillName), {
      assetKind: "skills",
      backupsRoot: input.backupsRoot,
      targetName: runtimeTargetName(target),
    });
  }

  return {
    sourceType: "local",
    localPath: input.source.localPath,
    resolvedCommit: input.resolvedCommit,
    skillPath,
    contentHash: hashDirectory(sourceSkillDir),
  };
}

function buildSkillInstallPlans(
  config: Config,
  profileNames: string[],
  profileSources: Map<string, SkillSource[]>,
): SkillInstallPlan[] {
  const sourcePlans = new Map<string, SkillInstallPlan>();
  const skillSources = new Map<string, { key: string; label: string }>();

  for (const profileName of profileNames) {
    const sources = expandSkillSources(config, profileName);
    ensureUniqueSkillNames(sources);
    profileSources.set(profileName, sources);

    for (const source of sources) {
      validateSource(source);
      const sourceKey = skillSourceKey(source);
      let plan = sourcePlans.get(sourceKey);
      if (!plan) {
        plan = { source, skillNames: [] };
        sourcePlans.set(sourceKey, plan);
      }

      for (const skillName of source.names) {
        const key = skillInstallKey(source, skillName);
        const existing = skillSources.get(skillName);
        if (existing && existing.key !== key) {
          throw new Error(
            `Skill '${skillName}' is configured from multiple sources across selected profiles: ` +
              `${existing.label}, ${skillInstallLabel(source, skillName)}`,
          );
        }
        if (!existing) {
          skillSources.set(skillName, {
            key,
            label: skillInstallLabel(source, skillName),
          });
          plan.skillNames.push(skillName);
        }
      }
    }
  }

  return [...sourcePlans.values()].filter((plan) => plan.skillNames.length > 0);
}

function skillPlanCount(plans: SkillInstallPlan[]): number {
  return plans.reduce((count, plan) => count + plan.skillNames.length, 0);
}

function lockedCommitForSourceAcross(
  lock: LockFile,
  profileNames: string[],
  source: RemoteSkillSource,
): string | undefined {
  for (const profileName of profileNames) {
    const lockedCommit = lockedCommitForSource(
      lock.skillsets[profileName]?.skills,
      source,
    );
    if (lockedCommit) {
      return lockedCommit;
    }
  }
  return undefined;
}

function skillSourceKey(source: SkillSource): string {
  if (isLocalSource(source)) {
    return `local:${source.localPath}`;
  }
  return `git:${source.url}:${source.ref}:${source.basePath}`;
}

function skillInstallKey(source: SkillSource, skillName: string): string {
  return `${skillSourceKey(source)}:${skillName}`;
}

function skillInstallLabel(source: SkillSource, skillName: string): string {
  if (isLocalSource(source)) {
    return `${source.localPath}/${skillName}`;
  }
  return `${source.url}:${source.ref}:${join(source.basePath, skillName)}`;
}

function validateSkillConfig(config: Config, profileNames: string[]): void {
  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}`);
  }
  if (
    !config.runtime ||
    typeof config.runtime.canonicalSkillsDir !== "string"
  ) {
    throw new Error("runtime.canonicalSkillsDir must be configured");
  }
  if (
    !Array.isArray(config.runtime.skillSymlinkTargets) ||
    config.runtime.skillSymlinkTargets.some(
      (target) => typeof target !== "string" || target.length === 0,
    )
  ) {
    throw new Error(
      "runtime.skillSymlinkTargets must be a non-empty string array",
    );
  }
  validateReusableScriptConfig(config.runtime.reusableScripts ?? []);
  validateLocalSkillReusableScriptImports(config, profileNames);

  let skillCount = 0;
  const blockNames = new Set<string>();
  for (const name of profileNames) {
    const sources = expandSkillSources(config, name);
    ensureUniqueSkillNames(sources);
    for (const source of sources) {
      validateSource(source);
      skillCount += source.names.length;
    }
    for (const blockName of profileInclude(config, name)) {
      blockNames.add(blockName);
    }
  }

  console.log(
    `Validated ${profileNames.length} profile${profileNames.length === 1 ? "" : "s"}, ` +
      `${blockNames.size} block${blockNames.size === 1 ? "" : "s"}, ` +
      `${skillCount} skill${skillCount === 1 ? "" : "s"}.`,
  );
}

function validateLockIfPresent(lockFile: string): void {
  if (!existsSync(lockFile)) {
    return;
  }
  readLock(lockFile);
}

function lockFileFor(config: Config): string {
  return config.runtime.lockFile ?? LOCK_FILE;
}

function statusSkills(config: Config, profileNames: string[]): void {
  validateSkillConfig(config, profileNames);
  const canonicalSkillsDir = expandHome(config.runtime.canonicalSkillsDir);
  const symlinkTargets = resolveSkillSymlinkTargets(
    canonicalSkillsDir,
    config.runtime.skillSymlinkTargets.map(expandHome),
  );

  for (const profileName of profileNames) {
    const sources = expandSkillSources(config, profileName);
    console.log(`Profile ${profileName}`);
    for (const source of sources) {
      for (const skillName of source.names) {
        const canonicalPath = join(canonicalSkillsDir, skillName);
        printPathStatus(`  ${skillName}`, canonicalPath);
        for (const target of symlinkTargets) {
          printSymlinkStatus(
            `    ${join(target, skillName)}`,
            join(target, skillName),
            canonicalPath,
          );
        }
      }
    }
  }
  statusReusableScripts(config, [canonicalSkillsDir, ...symlinkTargets]);
}

function validateReusableScriptConfig(
  reusableScripts: RuntimeFileConfig[],
): void {
  for (const runtimeFile of reusableScripts) {
    const sourcePath = runtimeFileSourcePath(runtimeFile);
    const targetPath = runtimeFileTargetPath(runtimeFile);
    if (typeof sourcePath !== "string" || sourcePath.length === 0) {
      throw new Error("runtime.reusableScripts sourcePath must be configured");
    }
    if (typeof targetPath !== "string" || targetPath.length === 0) {
      throw new Error("runtime.reusableScripts targetPath must be configured");
    }
    const relativeTarget = relative(".", targetPath);
    if (
      isAbsolute(targetPath) ||
      relativeTarget === ".." ||
      relativeTarget.startsWith(`..${sep}`)
    ) {
      throw new Error(
        `runtime.reusableScripts targetPath must stay within the runtime root: ${targetPath}`,
      );
    }
    const source = resolve(sourcePath);
    if (!lstatIfExists(source)?.isFile()) {
      throw new Error(`Missing reusable runtime script: ${sourcePath}`);
    }
  }
}

function validateLocalSkillReusableScriptImports(
  config: Config,
  profileNames: string[],
): void {
  const reusableScriptTargets = new Set(
    (config.runtime.reusableScripts ?? []).map((runtimeFile) =>
      normalizeRuntimeTargetPath(runtimeFileTargetPath(runtimeFile)),
    ),
  );
  const missingImports = new Map<string, Set<string>>();

  for (const profileName of profileNames) {
    const sources = expandSkillSources(config, profileName);
    ensureUniqueSkillNames(sources);
    for (const source of sources) {
      if (!isLocalSource(source)) {
        continue;
      }
      for (const skillName of source.names) {
        const skillDir = join(source.localPath, skillName);
        for (const importedScript of localSkillReusableScriptImports(
          skillDir,
        )) {
          if (reusableScriptTargets.has(importedScript)) {
            continue;
          }
          const skillImports =
            missingImports.get(skillName) ?? new Set<string>();
          skillImports.add(importedScript);
          missingImports.set(skillName, skillImports);
        }
      }
    }
  }

  const errors = [...missingImports.entries()].flatMap(([skillName, imports]) =>
    [...imports]
      .sort()
      .map(
        (importedScript) =>
          `Skill ${skillName} imports reusable runtime script ${importedScript}, but it is not listed in runtime.reusableScripts`,
      ),
  );
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function localSkillReusableScriptImports(skillDir: string): string[] {
  const scriptsDir = join(skillDir, "scripts");
  if (!lstatIfExists(scriptsDir)?.isDirectory()) {
    return [];
  }

  const imports = new Set<string>();
  for (const relativeFile of collectFiles(scriptsDir)) {
    if (extname(relativeFile) !== ".ts") {
      continue;
    }
    const filePath = join(scriptsDir, relativeFile);
    const content = readFileSync(filePath, "utf-8");
    for (const importedScript of staticReusableScriptImports(content)) {
      imports.add(importedScript);
    }
  }
  return [...imports].sort();
}

function staticReusableScriptImports(content: string): string[] {
  const sourceFile = ts.createSourceFile(
    "skill-script.ts",
    content,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  const imports = new Set<string>();
  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) &&
      !ts.isExportDeclaration(statement)
    ) {
      continue;
    }
    const moduleSpecifier = statement.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
      continue;
    }
    const match = moduleSpecifier.text.match(
      /^\.\.\/\.\.\/\.\.\/scripts\/(.+\.ts)$/,
    );
    if (match) {
      imports.add(normalizeRuntimeTargetPath(`scripts/${match[1]}`));
    }
  }
  return [...imports].sort();
}

function normalizeRuntimeTargetPath(targetPath: string): string {
  return relative(".", targetPath).split(sep).join("/");
}

function installReusableScripts(config: Config, skillDirs: string[]): void {
  const reusableScripts = config.runtime.reusableScripts ?? [];
  if (reusableScripts.length === 0) {
    return;
  }

  const backupsRoot = runtimeBackupsRoot(config);
  const runtimeRoots = runtimeRootsForSkillDirs(skillDirs);
  const canonicalRoot = runtimeRoots[0];
  for (const runtimeFile of reusableScripts) {
    const source = resolve(runtimeFileSourcePath(runtimeFile));
    const targetPath = runtimeFileTargetPath(runtimeFile);
    const canonicalTarget = runtimeTargetPath(canonicalRoot, targetPath);
    replaceFile(source, canonicalTarget, {
      assetKind: "reusable-scripts",
      backupsRoot,
      targetName: runtimeTargetName(canonicalRoot),
    });

    for (const runtimeRoot of runtimeRoots.slice(1)) {
      replaceRelativeSymlink(
        canonicalTarget,
        runtimeTargetPath(runtimeRoot, targetPath),
        {
          assetKind: "reusable-scripts",
          backupsRoot,
          targetName: runtimeTargetName(runtimeRoot),
        },
      );
    }
  }
}

function statusReusableScripts(config: Config, skillDirs: string[]): void {
  const reusableScripts = config.runtime.reusableScripts ?? [];
  if (reusableScripts.length === 0) {
    return;
  }

  const runtimeRoots = runtimeRootsForSkillDirs(skillDirs);
  const canonicalRoot = runtimeRoots[0];
  for (const runtimeFile of reusableScripts) {
    const targetPath = runtimeFileTargetPath(runtimeFile);
    const canonicalTarget = runtimeTargetPath(canonicalRoot, targetPath);
    printPathStatus(
      `Reusable script ${runtimeFileLabel(runtimeFile)}`,
      canonicalTarget,
    );
    for (const runtimeRoot of runtimeRoots.slice(1)) {
      const linkPath = runtimeTargetPath(runtimeRoot, targetPath);
      printSymlinkStatus(`  ${linkPath}`, linkPath, canonicalTarget);
    }
  }
}

function runtimeRootsForSkillDirs(skillDirs: string[]): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();
  for (const skillDir of skillDirs) {
    const root = dirname(skillDir);
    if (seen.has(root)) {
      continue;
    }
    seen.add(root);
    roots.push(root);
  }
  return roots;
}

function runtimeTargetPath(runtimeRoot: string, targetPath: string): string {
  const target = resolve(runtimeRoot, targetPath);
  const relativeTarget = relative(runtimeRoot, target);
  if (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`)) {
    throw new Error(
      `Reusable runtime target escapes runtime root: ${targetPath}`,
    );
  }
  return target;
}

function runInstructions(
  command: RuntimeCommand,
  config: Config,
  selection: ProfileSelection,
): void {
  validateInstructionConfig(config, selection);
  if (command === "validate") {
    console.log("Validated instruction configuration.");
    return;
  }

  const operations = instructionOperations(config, selection);
  if (command === "status") {
    for (const operation of operations) {
      console.log(`Instruction ${operation.label} (${operation.targetName})`);
      printPathStatus(`  source`, operation.sourcePath);
      printSymlinkStatus(
        `  ${operation.linkPath}`,
        operation.linkPath,
        operation.sourcePath,
      );
    }
    return;
  }

  validateSafeSymlinkTargets(
    operations.map((operation) => ({
      linkPath: operation.linkPath,
      target: operation.sourcePath,
    })),
  );
  const backupsRoot = runtimeBackupsRoot(config);
  pruneUnselectedInstructionSymlinks(config, selection, backupsRoot);
  for (const operation of operations) {
    replaceSafeSymlink(operation.sourcePath, operation.linkPath, {
      assetKind: "instructions",
      backupsRoot,
      targetName: operation.targetName,
    });
    console.log(
      `${command === "install" ? "Installed" : "Updated"} ${operation.label} for ${operation.targetName}`,
    );
  }
}

function preflightWrapperCommand(
  command: RuntimeCommand,
  config: Config,
  profileSelection?: ProfileSelection,
): void {
  if (command !== "install" && command !== "update") {
    return;
  }
  validateInstructionConfig(
    config,
    profileSelection ?? { profileNames: [], interactive: false },
  );
  validateSafeSymlinkTargets(
    instructionOperations(
      config,
      profileSelection ?? { profileNames: [], interactive: false },
    ).map((operation) => ({
      linkPath: operation.linkPath,
      target: operation.sourcePath,
    })),
  );
  const hooks = resolvedHooksConfig(config);
  validateHookConfig(hooks);
  validateHookReplacementTargets(hooks);
}

function validateInstructionConfig(
  config: Config,
  selection: ProfileSelection,
): void {
  const instructionPaths = selectedInstructionPaths(config, selection);
  if (instructionPaths.length === 0) {
    throw new Error(
      "instructions.paths or instructionProfiles must configure at least one path",
    );
  }
  if (
    !config.runtime.instructionSymlinkTargets ||
    Object.keys(config.runtime.instructionSymlinkTargets).length === 0
  ) {
    throw new Error(
      "runtime.instructionSymlinkTargets must configure at least one target",
    );
  }

  for (const instructionPath of instructionPaths) {
    const sourcePath = instructionSourcePath(instructionPath);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing instruction path: ${sourcePath}`);
    }
  }
}

function instructionOperations(
  config: Config,
  selection: ProfileSelection,
): Array<{
  targetName: string;
  label: string;
  targetPath: string;
  sourcePath: string;
  linkPath: string;
}> {
  const targets = config.runtime.instructionSymlinkTargets ?? {};
  const targetNames = Object.keys(targets).sort();
  const operations: Array<{
    targetName: string;
    label: string;
    targetPath: string;
    sourcePath: string;
    linkPath: string;
  }> = [];

  for (const selectedTargetName of targetNames) {
    for (const instructionPath of selectedInstructionPaths(config, selection)) {
      const sourcePath = instructionSourcePath(instructionPath);
      const targetPath = instructionTargetPath(instructionPath);
      operations.push({
        targetName: selectedTargetName,
        label: instructionLabel(instructionPath),
        targetPath,
        sourcePath: resolve(sourcePath),
        linkPath: join(expandHome(targets[selectedTargetName]), targetPath),
      });
    }
  }
  return operations;
}

function pruneUnselectedInstructionSymlinks(
  config: Config,
  selection: ProfileSelection,
  backupsRoot: string,
): void {
  const selectedPaths = new Set(
    selectedInstructionPaths(config, selection).map(instructionTargetPath),
  );
  const configuredPaths = allConfiguredInstructionPaths(config);
  const targets = config.runtime.instructionSymlinkTargets ?? {};

  for (const instructionPath of configuredPaths) {
    const targetPath = instructionTargetPath(instructionPath);
    if (selectedPaths.has(targetPath)) {
      continue;
    }
    for (const target of Object.values(targets)) {
      const linkPath = join(expandHome(target), targetPath);
      const stats = lstatIfExists(linkPath);
      if (!stats?.isSymbolicLink()) {
        continue;
      }
      backupRuntimeTarget(linkPath, {
        assetKind: "instructions",
        backupsRoot,
        targetName: runtimeTargetName(target),
      });
      rmSync(linkPath, { force: true });
      console.log(`Pruned ${targetPath} from ${expandHome(target)}`);
    }
  }
}

function allConfiguredInstructionPaths(
  config: Config,
): InstructionPathConfig[] {
  if (config.profiles && Object.keys(config.profiles).length > 0) {
    return uniqueInstructionPaths(
      Object.values(config.profiles).flatMap((profile) => profile.paths),
    );
  }
  if (
    config.instructionProfiles &&
    Object.keys(config.instructionProfiles).length > 0
  ) {
    return uniqueInstructionPaths(
      Object.values(config.instructionProfiles).flatMap(
        (profile) => profile.paths,
      ),
    );
  }
  return config.instructions?.paths ?? [];
}

function expandSkillSources(
  config: Config,
  profileName: string,
): SkillSource[] {
  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}`);
  }

  const include = profileInclude(config, profileName);

  const sources: SkillSource[] = [];
  for (const blockName of include) {
    const block = config.blocks[blockName];
    if (!block) {
      throw new Error(
        `Profile '${profileName}' includes unknown block '${blockName}'`,
      );
    }
    sources.push(...(block.skills ?? []).map(expandSkillSourceNames));
  }

  if (sources.length === 0) {
    throw new Error(`Profile '${profileName}' has no skill sources`);
  }

  return sources;
}

function expandSkillSourceNames(source: SkillSource): SkillSource {
  if (!source.names.includes("*")) {
    return source;
  }
  if (!isLocalSource(source)) {
    throw new Error(
      `Wildcard skill names are only supported for local skill sources: ${sourceLabel(source)}`,
    );
  }
  return {
    ...source,
    names: discoverLocalSkillNames(source.localPath),
  };
}

function discoverLocalSkillNames(localPath: string): string[] {
  const sourceDir = resolve(localPath);
  if (!existsSync(sourceDir)) {
    throw new Error(`Local skill source does not exist: ${localPath}`);
  }

  const skillNames = readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(sourceDir, name, "SKILL.md")))
    .sort();

  if (skillNames.length === 0) {
    throw new Error(`Local skill source has no skills: ${localPath}`);
  }
  return skillNames;
}

function profileInclude(config: Config, profileName: string): string[] {
  if (config.profiles && Object.keys(config.profiles).length > 0) {
    const profile = config.profiles[profileName];
    if (!profile) {
      throw new Error(`Unknown profile '${profileName}'`);
    }
    return profile.include;
  }

  const skillset = config.skillsets?.[profileName];
  if (!skillset) {
    throw new Error(`Unknown profile '${profileName}'`);
  }
  return skillset.include;
}

function validateSource(source: SkillSource): void {
  if (isLocalSource(source)) {
    if (!source.localPath) {
      throw new Error("Local skill source is missing localPath");
    }
    if (!Array.isArray(source.names) || source.names.length === 0) {
      throw new Error(
        `Local skill source must list at least one skill name: ${source.localPath}`,
      );
    }
    for (const name of source.names) {
      if (!existsSync(join(source.localPath, name, "SKILL.md"))) {
        throw new Error(
          `Missing SKILL.md for local skill '${name}' at ${join(source.localPath, name)}`,
        );
      }
    }
    return;
  }

  if (!source.url.startsWith("https://")) {
    throw new Error(`Only full HTTPS git URLs are supported: ${source.url}`);
  }
  if (!source.url.endsWith(".git")) {
    throw new Error(`Repository URL must end with .git: ${source.url}`);
  }
  if (!source.ref) {
    throw new Error(`Source is missing ref: ${source.url}`);
  }
  if (!source.basePath) {
    throw new Error(`Source is missing basePath: ${source.url}`);
  }
  if (!Array.isArray(source.names) || source.names.length === 0) {
    throw new Error(`Source must list at least one skill name: ${source.url}`);
  }
}

function ensureUniqueSkillNames(sources: SkillSource[]): void {
  const seen = new Map<string, string>();
  for (const source of sources) {
    for (const name of source.names) {
      const existingSource = seen.get(name);
      if (existingSource) {
        throw new Error(
          `Skill '${name}' is configured more than once: ${existingSource}, ${sourceLabel(source)}`,
        );
      }
      seen.set(name, sourceLabel(source));
    }
  }
}

function cachePathForSource(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  return join(CACHE_DIR, `${basename(url, ".git")}-${hash}`);
}

function ensureRepo(url: string, repoDir: string, shouldFetch: boolean): void {
  if (!existsSync(repoDir)) {
    run("git", ["clone", "--quiet", url, repoDir]);
    return;
  }
  if (shouldFetch) {
    run("git", ["-C", repoDir, "fetch", "--quiet", "--prune", "origin"]);
  }
}

function ensureCommitAvailable(repoDir: string, commit: string): void {
  if (commitExists(repoDir, commit)) {
    return;
  }

  run("git", ["-C", repoDir, "fetch", "--quiet", "--prune", "origin"]);
  if (!commitExists(repoDir, commit)) {
    throw new Error(
      `Commit ${commit} is unavailable in ${repoDir} after fetching origin`,
    );
  }
}

function commitExists(repoDir: string, commit: string): boolean {
  const result = spawnSync(
    "git",
    ["-C", repoDir, "cat-file", "-e", `${commit}^{commit}`],
    {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return result.status === 0;
}

function resolveCommit(repoDir: string, ref: string): string {
  const remoteRef = ref.startsWith("origin/") ? ref : `origin/${ref}`;
  return run("git", [
    "-C",
    repoDir,
    "rev-parse",
    `${remoteRef}^{commit}`,
  ]).trim();
}

function checkout(repoDir: string, commit: string): void {
  run("git", ["-C", repoDir, "checkout", "--quiet", commit]);
}

function lockedCommitForSource(
  lockedSkills: Record<string, LockedSkill> | undefined,
  source: RemoteSkillSource,
): string | undefined {
  if (!lockedSkills) {
    return undefined;
  }

  for (const name of source.names) {
    const locked = lockedSkills[name];
    if (locked?.url === source.url && locked.ref === source.ref) {
      return locked.resolvedCommit;
    }
  }
  return undefined;
}

function isLocalSource(source: SkillSource): source is LocalSkillSource {
  return "localPath" in source;
}

function sourceLabel(source: SkillSource): string {
  return isLocalSource(source) ? source.localPath : source.url;
}

function workspaceCommit(): string {
  return run("git", ["rev-parse", "HEAD"]).trim();
}

function replaceDirectory(
  source: string,
  destination: string,
  backup?: RuntimeBackupContext,
): void {
  const temporaryDestination = `${destination}.tmp-${process.pid}`;
  rmSync(temporaryDestination, { force: true, recursive: true });
  cpSync(source, temporaryDestination, {
    recursive: true,
    verbatimSymlinks: true,
  });
  backupRuntimeTarget(destination, backup);
  rmSync(destination, { force: true, recursive: true });
  mkdirSync(dirname(destination), { recursive: true });
  renameSync(temporaryDestination, destination);
}

export type RuntimeBackupStatus = "created" | "missing";
export type RuntimeBackupKind = "file" | "directory" | "symlink" | "missing";

export type RuntimeBackupResult = {
  status: RuntimeBackupStatus;
  kind: RuntimeBackupKind;
  sourcePath: string;
  backupPath: string;
  manifestPath: string;
  targetBackupPath?: string;
  verified: boolean;
};

export type RuntimeBackupInput = {
  sourcePath: string;
  backupsRoot: string;
  assetKind: string;
  targetName: string;
  now?: Date;
  retentionCount?: number;
};

type RuntimeBackupContext = {
  assetKind: string;
  targetName?: string;
  backupsRoot: string;
};

export function createRuntimeBackup(
  input: RuntimeBackupInput,
): RuntimeBackupResult {
  const retentionCount = input.retentionCount ?? 7;
  const createdAt = input.now ?? new Date();
  if (retentionCount < 1) {
    throw new Error("retentionCount must be at least 1");
  }

  const targetRoot = join(
    input.backupsRoot,
    backupPathSegment(input.assetKind),
    backupPathSegment(input.targetName),
  );
  mkdirSync(targetRoot, { recursive: true });

  const backupPath = nextBackupPath(targetRoot, createdAt);
  mkdirSync(backupPath, { recursive: true });

  let result: RuntimeBackupResult;
  try {
    const manifestPath = join(backupPath, "manifest.json");
    const stats = lstatIfExists(input.sourcePath);
    const targetBackupPath = stats ? join(backupPath, "target") : undefined;
    const kind = runtimeBackupKind(stats);
    const status: RuntimeBackupStatus = stats ? "created" : "missing";

    if (stats?.isSymbolicLink()) {
      symlinkSync(readlinkSync(input.sourcePath), targetBackupPath);
    } else if (stats?.isDirectory()) {
      cpSync(input.sourcePath, targetBackupPath, {
        recursive: true,
        verbatimSymlinks: true,
      });
    } else if (stats?.isFile()) {
      cpSync(input.sourcePath, targetBackupPath);
    }

    writeJson(manifestPath, {
      assetKind: input.assetKind,
      targetName: input.targetName,
      sourcePath: input.sourcePath,
      status,
      kind,
      createdAt: createdAt.toISOString(),
    });

    result = {
      status,
      kind,
      sourcePath: input.sourcePath,
      backupPath,
      manifestPath,
      targetBackupPath,
      verified: false,
    };
    if (!verifyRuntimeBackup(result)) {
      throw new Error(`Runtime backup verification failed: ${backupPath}`);
    }
  } catch (error) {
    rmSync(backupPath, { force: true, recursive: true });
    throw error;
  }

  result.verified = true;
  pruneRuntimeBackups(targetRoot, retentionCount);
  return result;
}

function runtimeBackupKind(
  stats: ReturnType<typeof lstatSync> | undefined,
): RuntimeBackupKind {
  if (!stats) {
    return "missing";
  }
  if (stats.isSymbolicLink()) {
    return "symlink";
  }
  if (stats.isDirectory()) {
    return "directory";
  }
  if (stats.isFile()) {
    return "file";
  }
  throw new Error("Unsupported backup target type");
}

function nextBackupPath(targetRoot: string, now: Date): string {
  const baseName = now.toISOString().replace(/[:.]/g, "-");
  const matchingBackups = readdirSync(targetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name === baseName || name.startsWith(`${baseName}-`));
  if (matchingBackups.length === 0) {
    return join(targetRoot, baseName);
  }
  const nextSuffix =
    Math.max(
      ...matchingBackups.map((name) =>
        name === baseName ? 1 : Number(name.slice(baseName.length + 1)),
      ),
    ) + 1;
  return join(targetRoot, `${baseName}-${String(nextSuffix).padStart(6, "0")}`);
}

function verifyRuntimeBackup(result: RuntimeBackupResult): boolean {
  if (!existsSync(result.backupPath) || !existsSync(result.manifestPath)) {
    return false;
  }
  if (result.status === "missing") {
    return result.targetBackupPath === undefined;
  }
  return Boolean(
    result.targetBackupPath && lstatIfExists(result.targetBackupPath),
  );
}

function pruneRuntimeBackups(targetRoot: string, retentionCount: number): void {
  const backups = readdirSync(targetRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const backup of backups.slice(
    0,
    Math.max(0, backups.length - retentionCount),
  )) {
    rmSync(join(targetRoot, backup), { force: true, recursive: true });
  }
}

function backupRuntimeTarget(
  targetPath: string,
  context: RuntimeBackupContext | undefined,
): void {
  if (!context) {
    return;
  }
  createRuntimeBackup({
    sourcePath: targetPath,
    backupsRoot: context.backupsRoot,
    assetKind: context.assetKind,
    targetName: context.targetName ?? runtimeTargetName(targetPath),
  });
}

function runtimeBackupsRoot(config: Config): string {
  return expandHome(config.runtime.backupsDir ?? "~/.agents/runtime/backups");
}

function runtimeTargetName(path: string): string {
  const segments = resolve(path).split(sep);
  if (segments.includes(".agents")) {
    return "agents";
  }
  if (segments.includes(".codex")) {
    return "codex";
  }
  if (segments.includes(".claude")) {
    return "claude";
  }
  return backupPathSegment(resolve(path));
}

function backupPathSegment(value: string): string {
  const segment = value.replace(/[^A-Za-z0-9._-]+/g, "_");
  if (!segment || segment === "." || segment === "..") {
    throw new Error(`Invalid backup path segment: ${value}`);
  }
  return segment;
}

function replaceSymlink(
  target: string,
  linkPath: string,
  backup?: RuntimeBackupContext,
): void {
  backupRuntimeTarget(linkPath, backup);
  rmSync(linkPath, { force: true, recursive: true });
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
}

export function replaceSafeSymlink(
  target: string,
  linkPath: string,
  backup?: RuntimeBackupContext,
): void {
  const stats = lstatIfExists(linkPath);
  if (stats) {
    if (realPathIfExists(linkPath) === realPathIfExists(target)) {
      return;
    }
    if (!stats.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink target: ${linkPath}`);
    }
    backupRuntimeTarget(linkPath, backup);
    rmSync(linkPath, { force: true });
  } else {
    backupRuntimeTarget(linkPath, backup);
  }
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, symlinkType(target));
}

function symlinkType(target: string): "dir" | "file" {
  if (existsSync(target) && lstatSync(target).isDirectory()) {
    return "dir";
  }
  return extname(target) ? "file" : "dir";
}

function printPathStatus(label: string, path: string): void {
  console.log(`${pathExists(path) ? "[ok]" : "[missing]"} ${label}: ${path}`);
}

function printSymlinkStatus(
  label: string,
  linkPath: string,
  expectedTarget: string,
): void {
  const stats = lstatIfExists(linkPath);
  if (!stats) {
    console.log(`[missing] ${label}`);
    return;
  }
  if (!stats.isSymbolicLink()) {
    console.log(`[not-symlink] ${label}`);
    return;
  }
  const linkRealPath = realPathIfExists(linkPath);
  const expectedRealPath = realPathIfExists(expectedTarget);
  console.log(
    `${linkRealPath === expectedRealPath ? "[ok]" : "[wrong-target]"} ${label}`,
  );
}

function pathExists(path: string): boolean {
  return existsSync(path);
}

export function validateSafeSymlinkTargets(
  linkPaths: string[] | Array<{ linkPath: string; target: string }>,
): void {
  for (const input of linkPaths) {
    const linkPath = typeof input === "string" ? input : input.linkPath;
    const target = typeof input === "string" ? undefined : input.target;
    const stats = lstatIfExists(linkPath);
    if (
      stats &&
      target &&
      realPathIfExists(linkPath) === realPathIfExists(target)
    ) {
      continue;
    }
    if (stats && !stats.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink target: ${linkPath}`);
    }
  }
}

export function lstatIfExists(
  path: string,
): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return undefined;
    }
    throw error;
  }
}

function resolveSkillSymlinkTargets(
  canonicalSkillsDir: string,
  targets: string[],
): string[] {
  const canonicalRealPath = realPathIfExists(canonicalSkillsDir);
  const usableTargets: string[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    const targetRealPath = realPathIfExists(target);
    if (targetRealPath === canonicalRealPath) {
      console.log(
        `Skipping skill symlink target ${target}; it already resolves to ${canonicalSkillsDir}`,
      );
      continue;
    }
    if (seen.has(targetRealPath)) {
      continue;
    }
    seen.add(targetRealPath);
    usableTargets.push(target);
  }

  return usableTargets;
}

function realPathIfExists(path: string): string {
  if (existsSync(path)) {
    return realpathSync(path);
  }
  return resolve(path);
}

function hashDirectory(directory: string): string {
  const files = collectFiles(directory).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update(readFileSync(join(directory, file)));
  }
  return hash.digest("hex");
}

function collectFiles(directory: string, root = directory): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath, root));
    } else if (entry.isFile()) {
      files.push(relative(root, absolutePath));
    }
  }
  return files;
}

function readLock(lockFile: string): LockFile {
  if (!existsSync(lockFile)) {
    return { version: 1, skillsets: {} };
  }
  const lock = readJson<LockFile>(lockFile);
  if (lock.version !== 1) {
    throw new Error(`Unsupported lock version: ${lock.version}`);
  }
  return lock;
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

function expandHome(path: string): string {
  if (path === "~") {
    return homedir();
  }
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  return resolve(path);
}

function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function run(
  command: string,
  args: string[],
  options: { env?: Record<string, string> } = {},
): string {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `${[command, ...args].join(" ")} failed\n${result.stderr || result.stdout}`,
    );
  }

  return result.stdout;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
