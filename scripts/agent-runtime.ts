#!/usr/bin/env tsx
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
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
import { homedir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";

type Scope = "skills" | "instructions" | "openspec" | "hooks";
type RuntimeCommand = "install" | "update" | "validate" | "status";
type SkillCommand = Extract<RuntimeCommand, "install" | "update" | "validate">;

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

type ResolvedOpenSpecConfig = {
  tools: string[];
  canonicalSkillsDir: string;
  canonicalCommandsDir: string;
  skillTargets: Record<string, string>;
  commandTargets: Record<string, string>;
  backupsRoot: string;
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
  profileNames?: string[];
  allProfiles?: boolean;
  configPath: string;
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

type LockFile = {
  version: 1;
  skillsets: Record<
    string,
    {
      skills: Record<string, LockedSkill>;
    }
  >;
};

const CONFIG_FILE = "agent-runtime.config.json";
const LOCK_FILE = "agent-runtime.lock.json";
const CACHE_DIR = ".agent-runtime/cache";
const OPENSPEC_INSTALL_COMMAND = "npm install -g @fission-ai/openspec@latest";
const RETIRED_MANAGED_SKILL_NAMES = [
  "plan-to-review",
  "plan-coordinate",
  "plan-delivery",
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
  const config = readJson<Config>(configPath);

  if (!scope) {
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
  });
}

type CommandExecutor = (input: ParsedArgs) => void;

export function createProgram(
  execute: CommandExecutor = executeParsedCommand,
): Command {
  const program = new Command();
  program
    .name("agent-runtime")
    .description("Manage reusable local agent runtime assets")
    .showHelpAfterError("(add --help for additional information)")
    .configureHelp({ sortSubcommands: true })
    .option("--config <path>", "Path to agent runtime config", CONFIG_FILE);

  for (const command of runtimeCommands()) {
    addWrapperCommand(program, command, execute);
  }

  addSkillsCommands(program, execute);
  addInstructionsCommands(program, execute);
  addOpenSpecCommands(program, execute);
  addHooksCommands(program, execute);

  return program;
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
    .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
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
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
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
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
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
    openspec
      .command(command)
      .description(
        `${labelForCommand(command)} repo-local OpenSpec scaffolding`,
      )
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "openspec",
          command,
          configPath: configPathFor(commandObject, options),
        });
      });
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
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
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

type CommandOptions = {
  config?: string;
  profile?: string[];
  allProfiles?: boolean;
};

function collectOption(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

function configPathFor(
  commandObject: Command,
  options: CommandOptions,
): string {
  if (
    commandObject.getOptionValueSource("config") &&
    commandObject.getOptionValueSource("config") !== "default"
  ) {
    return options.config ?? CONFIG_FILE;
  }
  return (
    commandObject.optsWithGlobals<CommandOptions>().config ??
    options.config ??
    CONFIG_FILE
  );
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

function labelForCommand(command: RuntimeCommand): string {
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
  },
): void {
  if (scope === "skills") {
    runSkills(input.command, input.config, input.profileSelection);
    return;
  }
  if (scope === "openspec") {
    runOpenSpec(input.command, input.config);
    return;
  }
  if (scope === "hooks") {
    runHooks(input.command, input.config);
    return;
  }
  runInstructions(input.command, input.config, input.profileSelection);
}

function runOpenSpec(command: RuntimeCommand, config: Config): void {
  const openspec = resolvedOpenSpecConfig(config);

  if (command === "status") {
    statusOpenSpec(openspec);
    return;
  }

  ensureOpenSpecCli();

  if (command === "validate") {
    validateOpenSpec(openspec);
    console.log("Validated repo-local OpenSpec scaffolding.");
    return;
  }

  if (command === "install") {
    backupOpenSpecExternalTargets(openspec);
    runOpenSpecCli(["init", ".", "--tools", openspec.tools.join(",")]);
    normalizeOpenSpecScaffolding(openspec);
    console.log("Installed repo-local OpenSpec scaffolding.");
    return;
  }

  backupOpenSpecExternalTargets(openspec);
  if (isOpenSpecInitialized()) {
    runOpenSpecCli(["update", "."]);
  } else {
    runOpenSpecCli(["init", ".", "--tools", openspec.tools.join(",")]);
  }
  normalizeOpenSpecScaffolding(openspec);
  console.log("Updated repo-local OpenSpec scaffolding.");
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
    canonicalSkillsDir: input.canonicalSkillsDir ?? ".agents/skills",
    canonicalCommandsDir: input.canonicalCommandsDir ?? ".agents/commands",
    backupsRoot: runtimeBackupsRoot(config),
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

function runOpenSpecCli(args: string[]): void {
  run("openspec", args);
}

function isOpenSpecInitialized(): boolean {
  return existsSync(join("openspec", "config.yaml"));
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
  const errors: string[] = [];
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

  if (errors.length > 0) {
    throw new Error(
      `Invalid repo-local OpenSpec scaffolding:\n${errors.map((error) => `- ${error}`).join("\n")}`,
    );
  }
}

function statusOpenSpec(config: ResolvedOpenSpecConfig): void {
  const cli = openSpecCli();
  if (!cli) {
    throw new Error(
      `OpenSpec CLI is not available. Install it with: ${OPENSPEC_INSTALL_COMMAND}`,
    );
  }

  console.log(`OpenSpec CLI: ${cli.path} (${cli.version})`);
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
    targetName: "agent-runtime-lock",
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

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
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
