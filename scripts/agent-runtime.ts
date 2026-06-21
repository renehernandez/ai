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

type Scope = "skills" | "instructions" | "openspec";
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
    lockFile?: string;
    openspec?: OpenSpecConfig;
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

type ResolvedOpenSpecConfig = {
  tools: string[];
  canonicalSkillsDir: string;
  canonicalCommandsDir: string;
  skillTargets: Record<string, string>;
  commandTargets: Record<string, string>;
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
    runSkills(command, config, profileSelection);
    runInstructions(command, config, profileSelection);
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
  if (scope === "openspec") {
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
    runOpenSpecCli(["init", ".", "--tools", openspec.tools.join(",")]);
    normalizeOpenSpecScaffolding(openspec);
    console.log("Installed repo-local OpenSpec scaffolding.");
    return;
  }

  if (isOpenSpecInitialized()) {
    runOpenSpecCli(["update", "."]);
  } else {
    runOpenSpecCli(["init", ".", "--tools", openspec.tools.join(",")]);
  }
  normalizeOpenSpecScaffolding(openspec);
  console.log("Updated repo-local OpenSpec scaffolding.");
}

function resolvedOpenSpecConfig(config: Config): ResolvedOpenSpecConfig {
  const input = config.runtime.openspec ?? {};
  return {
    tools: nonEmptyStrings(input.tools, ["codex", "claude"]),
    canonicalSkillsDir: input.canonicalSkillsDir ?? ".agents/skills",
    canonicalCommandsDir: input.canonicalCommandsDir ?? ".agents/commands",
    skillTargets: nonEmptyRecord(input.skillTargets, {
      codex: ".codex/skills",
      claude: ".claude/skills",
    }),
    commandTargets: nonEmptyRecord(input.commandTargets, {
      claude: ".claude/commands",
    }),
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
): Record<string, string> {
  if (!value) {
    return defaults;
  }
  const entries = Object.entries(value).filter(
    ([, target]) => target.trim().length > 0,
  );
  if (entries.length === 0) {
    throw new Error("runtime.openspec target maps must not be empty");
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
  const targetDirs = Object.values(config.skillTargets).map((target) =>
    resolve(target),
  );
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
      replaceDirectory(sourcePath, canonicalPath);
    }

    for (const targetDir of targetDirs) {
      replaceRelativeSymlink(canonicalPath, join(targetDir, skillName));
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
        replaceFile(sourcePath, canonicalPath);
      }
      replaceRelativeSymlink(canonicalPath, join(targetOpsxDir, commandName));
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

function replaceFile(source: string, destination: string): void {
  const temporaryDestination = `${destination}.tmp-${process.pid}`;
  rmSync(temporaryDestination, { force: true });
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(source, temporaryDestination);
  rmSync(destination, { force: true });
  renameSync(temporaryDestination, destination);
}

function replaceRelativeSymlink(target: string, linkPath: string): void {
  const stats = lstatIfExists(linkPath);
  if (stats) {
    if (
      stats.isSymbolicLink() &&
      realPathIfExists(linkPath) === realPathIfExists(target)
    ) {
      return;
    }
    rmSync(linkPath, { force: true, recursive: true });
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
  });
  installReusableScripts(config, [canonicalSkillsDir, ...symlinkTargets]);
  pruneRetiredManagedSkills(lock, profileNames, [
    canonicalSkillsDir,
    ...symlinkTargets,
  ]);

  writeJson(lockFile, lock);
}

function installSkillUnion(input: {
  command: SkillCommand;
  config: Config;
  lock: LockFile;
  profileNames: string[];
  canonicalSkillsDir: string;
  symlinkTargets: string[];
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
): void {
  for (const profileName of profileNames) {
    for (const retiredName of RETIRED_MANAGED_SKILL_NAMES) {
      delete lock.skillsets[profileName]?.skills[retiredName];
    }
  }

  for (const directory of skillDirs) {
    for (const retiredName of RETIRED_MANAGED_SKILL_NAMES) {
      removeRetiredManagedSkill(join(directory, retiredName));
    }
  }
}

function removeRetiredManagedSkill(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    rmSync(path, { force: true });
    return;
  }

  if (stat.isDirectory() && existsSync(join(path, "SKILL.md"))) {
    rmSync(path, { force: true, recursive: true });
  }
}

function installSkill(input: {
  source: RemoteSkillSource;
  skillName: string;
  resolvedCommit: string;
  canonicalSkillsDir: string;
  symlinkTargets: string[];
}): LockedSkill {
  const skillPath = join(input.source.basePath, input.skillName);
  const sourceSkillDir = join(cachePathForSource(input.source.url), skillPath);
  if (!existsSync(join(sourceSkillDir, "SKILL.md"))) {
    throw new Error(
      `Missing SKILL.md for '${input.skillName}' at ${input.source.url}:${skillPath}`,
    );
  }

  const destination = join(input.canonicalSkillsDir, input.skillName);
  replaceDirectory(sourceSkillDir, destination);
  for (const target of input.symlinkTargets) {
    replaceSymlink(destination, join(target, input.skillName));
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
}): LockedSkill {
  const skillPath = join(input.source.localPath, input.skillName);
  const sourceSkillDir = resolve(skillPath);
  if (!existsSync(join(sourceSkillDir, "SKILL.md"))) {
    throw new Error(
      `Missing SKILL.md for local skill '${input.skillName}' at ${skillPath}`,
    );
  }

  const destination = join(input.canonicalSkillsDir, input.skillName);
  replaceDirectory(sourceSkillDir, destination);
  for (const target of input.symlinkTargets) {
    replaceSymlink(destination, join(target, input.skillName));
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

  const runtimeRoots = runtimeRootsForSkillDirs(skillDirs);
  const canonicalRoot = runtimeRoots[0];
  for (const runtimeFile of reusableScripts) {
    const source = resolve(runtimeFileSourcePath(runtimeFile));
    const targetPath = runtimeFileTargetPath(runtimeFile);
    const canonicalTarget = runtimeTargetPath(canonicalRoot, targetPath);
    replaceFile(source, canonicalTarget);

    for (const runtimeRoot of runtimeRoots.slice(1)) {
      replaceRelativeSymlink(
        canonicalTarget,
        runtimeTargetPath(runtimeRoot, targetPath),
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
  pruneUnselectedInstructionSymlinks(config, selection);
  for (const operation of operations) {
    replaceSafeSymlink(operation.sourcePath, operation.linkPath);
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

function replaceDirectory(source: string, destination: string): void {
  const temporaryDestination = `${destination}.tmp-${process.pid}`;
  rmSync(temporaryDestination, { force: true, recursive: true });
  cpSync(source, temporaryDestination, {
    recursive: true,
    verbatimSymlinks: true,
  });
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

export function createRuntimeBackup(
  input: RuntimeBackupInput,
): RuntimeBackupResult {
  const retentionCount = input.retentionCount ?? 7;
  const createdAt = input.now ?? new Date();
  if (retentionCount < 1) {
    throw new Error("retentionCount must be at least 1");
  }

  const targetRoot = join(input.backupsRoot, input.assetKind, input.targetName);
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

function replaceSymlink(target: string, linkPath: string): void {
  rmSync(linkPath, { force: true, recursive: true });
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
}

export function replaceSafeSymlink(target: string, linkPath: string): void {
  const stats = lstatIfExists(linkPath);
  if (stats) {
    if (realPathIfExists(linkPath) === realPathIfExists(target)) {
      return;
    }
    if (!stats.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink target: ${linkPath}`);
    }
    rmSync(linkPath, { force: true });
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
