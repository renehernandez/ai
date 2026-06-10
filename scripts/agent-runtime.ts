#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Command } from "commander";

type Scope = "skills" | "agents" | "instructions";
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

type Config = {
  version: 1;
  runtime: {
    canonicalSkillsDir: string;
    skillSymlinkTargets: string[];
    canonicalAgentsDir?: string;
    agentSymlinkTargets?: Record<string, string>;
    instructionSymlinkTargets?: Record<string, string>;
  };
  instructions?: {
    paths: string[];
  };
  agentModelMappings?: Record<string, Record<string, AgentHarnessConfig>>;
  blocks: Record<string, BlockConfig>;
  skillsets: Record<string, SkillsetConfig>;
};

type AgentHarnessConfig = {
  model: string;
  reasoning?: string;
};

type ParsedArgs = {
  scope?: Scope;
  command: RuntimeCommand;
  skillsetName?: string;
  agentName?: string;
  harnessName?: string;
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

type LockFile = {
  version: 1;
  skillsets: Record<
    string,
    {
      updatedAt: string;
      skills: Record<string, LockedSkill>;
    }
  >;
};

const CONFIG_FILE = "agent-runtime.config.json";
const LOCK_FILE = "agent-runtime.lock.json";
const CACHE_DIR = ".agent-runtime/cache";

export function main(): void {
  const program = createProgram();
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }
  program.parse(process.argv);
}

export function executeParsedCommand(input: ParsedArgs): void {
  const { scope, command, skillsetName, agentName, harnessName, configPath } = input;
  const config = readJson<Config>(configPath);

  if (!scope) {
    preflightWrapperCommand(command, config, agentName, harnessName);
    runSkills(command, config, skillsetName);
    runAgents(command, config, agentName, harnessName);
    runInstructions(command, config, harnessName);
    return;
  }

  runScope(scope, {
    command,
    config,
    skillsetName,
    agentName,
    harnessName,
  });
}

type CommandExecutor = (input: ParsedArgs) => void;

export function createProgram(execute: CommandExecutor = executeParsedCommand): Command {
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
  addAgentsCommands(program, execute);
  addInstructionsCommands(program, execute);

  return program;
}

function addWrapperCommand(program: Command, command: RuntimeCommand, execute: CommandExecutor): void {
  program
    .command(command)
    .description(`${labelForCommand(command)} all runtime surfaces`)
    .option("--skillset <name>", "Only apply skills work to one skillset")
    .option("--agent <name>", "Only apply agent work to one agent")
    .option("--harness <name>", "Only apply agent and instruction work to one harness")
    .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
    .action((first: CommandOptions | Command, second?: Command) => {
      const { options, commandObject } = actionContext(first, second);
      execute({
        command,
        skillsetName: options.skillset,
        agentName: options.agent,
        harnessName: options.harness,
        configPath: configPathFor(commandObject, options),
      });
    });
}

function addSkillsCommands(program: Command, execute: CommandExecutor): void {
  const skills = program.command("skills").description("Manage skill installation and symlinks");
  for (const command of runtimeCommands()) {
    skills
      .command(command)
      .description(`${labelForCommand(command)} managed skills`)
      .option("--skillset <name>", "Only apply the command to one skillset")
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "skills",
          command,
          skillsetName: options.skillset,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

function addAgentsCommands(program: Command, execute: CommandExecutor): void {
  const agents = program.command("agents").description("Manage sub-agent generation and symlinks");
  for (const command of runtimeCommands()) {
    agents
      .command(command)
      .description(`${labelForCommand(command)} generated sub-agents`)
      .option("--agent <name>", "Only apply the command to one agent")
      .option("--harness <name>", "Only apply the command to one harness")
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "agents",
          command,
          agentName: options.agent,
          harnessName: options.harness,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

function addInstructionsCommands(program: Command, execute: CommandExecutor): void {
  const instructions = program.command("instructions").description("Manage AGENTS.md and rules symlinks");
  for (const command of runtimeCommands()) {
    instructions
      .command(command)
      .description(`${labelForCommand(command)} managed instructions`)
      .option("--harness <name>", "Only apply the command to one harness")
      .option("--config <path>", "Path to agent runtime config", CONFIG_FILE)
      .action((first: CommandOptions | Command, second?: Command) => {
        const { options, commandObject } = actionContext(first, second);
        execute({
          scope: "instructions",
          command,
          harnessName: options.harness,
          configPath: configPathFor(commandObject, options),
        });
      });
  }
}

type CommandOptions = {
  config?: string;
  skillset?: string;
  agent?: string;
  harness?: string;
};

function configPathFor(commandObject: Command, options: CommandOptions): string {
  if (commandObject.getOptionValueSource("config") && commandObject.getOptionValueSource("config") !== "default") {
    return options.config ?? CONFIG_FILE;
  }
  return commandObject.optsWithGlobals<CommandOptions>().config ?? options.config ?? CONFIG_FILE;
}

function actionContext(first: CommandOptions | Command, second?: Command): { options: CommandOptions; commandObject: Command } {
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

function runScope(
  scope: Scope,
  input: {
    command: RuntimeCommand;
    config: Config;
    skillsetName?: string;
    agentName?: string;
    harnessName?: string;
  },
): void {
  if (scope === "skills") {
    if (input.agentName) {
      throw new Error("--agent can only be used with the agents scope");
    }
    runSkills(input.command, input.config, input.skillsetName);
    return;
  }
  if (input.skillsetName) {
    throw new Error("--skillset can only be used with the skills scope");
  }
  if (scope === "agents") {
    runAgents(input.command, input.config, input.agentName, input.harnessName);
    return;
  }
  if (input.agentName) {
    throw new Error("--agent can only be used with the agents scope");
  }
  runInstructions(input.command, input.config, input.harnessName);
}

function runSkills(command: RuntimeCommand, config: Config, skillsetName?: string): void {
  const skillsetNames = skillsetName ? [skillsetName] : Object.keys(config.skillsets).sort();

  if (command === "validate") {
    validateSkillConfig(config, skillsetNames);
    validateLockIfPresent();
    return;
  }
  if (command === "status") {
    statusSkills(config, skillsetNames);
    return;
  }

  const lock = readLock();
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

  for (const name of skillsetNames) {
    installSkillset({
      command,
      config,
      lock,
      skillsetName: name,
      canonicalSkillsDir,
      symlinkTargets,
    });
  }

  writeJson(LOCK_FILE, lock);
}

function installSkillset(input: {
  command: SkillCommand;
  config: Config;
  lock: LockFile;
  skillsetName: string;
  canonicalSkillsDir: string;
  symlinkTargets: string[];
}): void {
  const sources = expandSkillSources(input.config, input.skillsetName);
  const lockedSkillset = input.lock.skillsets[input.skillsetName];
  const installedSkills: Record<string, LockedSkill> = {};

  ensureUniqueSkillNames(sources);
  console.log(`${input.command === "install" ? "Installing" : "Updating"} skillset ${input.skillsetName}`);

  for (const source of sources) {
    validateSource(source);
    if (isLocalSource(source)) {
      const resolvedCommit = workspaceCommit();
      for (const skillName of source.names) {
        const lockedSkill = installLocalSkill({
          source,
          skillName,
          resolvedCommit,
          canonicalSkillsDir: input.canonicalSkillsDir,
          symlinkTargets: input.symlinkTargets,
        });

        installedSkills[skillName] = lockedSkill;
        console.log(`${input.command === "install" ? "Installed" : "Updated"} ${skillName}`);
      }
      continue;
    }

    const repoDir = cachePathForSource(source.url);
    const lockedCommit = lockedCommitForSource(lockedSkillset?.skills, source);
    ensureRepo(source.url, repoDir, input.command === "update" || !lockedCommit);

    const resolvedCommit =
      input.command === "install"
        ? lockedCommit ?? resolveCommit(repoDir, source.ref)
        : resolveCommit(repoDir, source.ref);

    checkout(repoDir, resolvedCommit);

    for (const skillName of source.names) {
      const lockedSkill = installSkill({
        source,
        skillName,
        resolvedCommit,
        canonicalSkillsDir: input.canonicalSkillsDir,
        symlinkTargets: input.symlinkTargets,
      });

      installedSkills[skillName] = lockedSkill;
      console.log(`${input.command === "install" ? "Installed" : "Updated"} ${skillName}`);
    }
  }

  input.lock.skillsets[input.skillsetName] = {
    updatedAt: new Date().toISOString(),
    skills: sortRecord(installedSkills),
  };
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
    throw new Error(`Missing SKILL.md for '${input.skillName}' at ${input.source.url}:${skillPath}`);
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
    throw new Error(`Missing SKILL.md for local skill '${input.skillName}' at ${skillPath}`);
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

function validateSkillConfig(config: Config, skillsetNames: string[]): void {
  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}`);
  }
  if (!config.runtime || typeof config.runtime.canonicalSkillsDir !== "string") {
    throw new Error("runtime.canonicalSkillsDir must be configured");
  }
  if (
    !Array.isArray(config.runtime.skillSymlinkTargets) ||
    config.runtime.skillSymlinkTargets.some((target) => typeof target !== "string" || target.length === 0)
  ) {
    throw new Error("runtime.skillSymlinkTargets must be a non-empty string array");
  }

  let skillCount = 0;
  const blockNames = new Set<string>();
  for (const name of skillsetNames) {
    const sources = expandSkillSources(config, name);
    ensureUniqueSkillNames(sources);
    for (const source of sources) {
      validateSource(source);
      skillCount += source.names.length;
    }
    for (const blockName of config.skillsets[name].include) {
      blockNames.add(blockName);
    }
  }

  console.log(
    `Validated ${skillsetNames.length} skillset${skillsetNames.length === 1 ? "" : "s"}, ` +
      `${blockNames.size} block${blockNames.size === 1 ? "" : "s"}, ` +
      `${skillCount} skill${skillCount === 1 ? "" : "s"}.`,
  );
}

function validateLockIfPresent(): void {
  if (!existsSync(LOCK_FILE)) {
    return;
  }
  readLock();
}

function statusSkills(config: Config, skillsetNames: string[]): void {
  validateSkillConfig(config, skillsetNames);
  const canonicalSkillsDir = expandHome(config.runtime.canonicalSkillsDir);
  const symlinkTargets = resolveSkillSymlinkTargets(
    canonicalSkillsDir,
    config.runtime.skillSymlinkTargets.map(expandHome),
  );

  for (const skillsetName of skillsetNames) {
    const sources = expandSkillSources(config, skillsetName);
    console.log(`Skillset ${skillsetName}`);
    for (const source of sources) {
      for (const skillName of source.names) {
        const canonicalPath = join(canonicalSkillsDir, skillName);
        printPathStatus(`  ${skillName}`, canonicalPath);
        for (const target of symlinkTargets) {
          printSymlinkStatus(`    ${join(target, skillName)}`, join(target, skillName), canonicalPath);
        }
      }
    }
  }
}

function runAgents(command: RuntimeCommand, config: Config, agentName?: string, harnessName?: string): void {
  validateAgentConfig(config, agentName, harnessName);
  if (command === "validate") {
    console.log("Validated agent configuration.");
    return;
  }

  const operations = agentOperations(config, agentName, harnessName);
  if (command === "status") {
    for (const operation of operations) {
      const rendered = renderAgent(operation.sourcePath, operation.mapping);
      console.log(`Agent ${operation.agentName} (${operation.harnessName})`);
      printGeneratedStatus(`  generated`, operation.generatedPath, rendered);
      printSymlinkStatus(`  ${operation.linkPath}`, operation.linkPath, operation.generatedPath);
    }
    return;
  }

  validateSafeSymlinkTargets(operations.map((operation) => operation.linkPath));
  for (const operation of operations) {
    const rendered = renderAgent(operation.sourcePath, operation.mapping);
    mkdirSync(dirname(operation.generatedPath), { recursive: true });
    writeFileSync(operation.generatedPath, rendered, "utf-8");
    replaceSafeSymlink(operation.generatedPath, operation.linkPath);
    console.log(`${command === "install" ? "Installed" : "Updated"} ${operation.agentName} for ${operation.harnessName}`);
  }
}

function runInstructions(command: RuntimeCommand, config: Config, harnessName?: string): void {
  validateInstructionConfig(config, harnessName);
  if (command === "validate") {
    console.log("Validated instruction configuration.");
    return;
  }

  const operations = instructionOperations(config, harnessName);
  if (command === "status") {
    for (const operation of operations) {
      console.log(`Instruction ${operation.relativePath} (${operation.harnessName})`);
      printPathStatus(`  source`, operation.sourcePath);
      printSymlinkStatus(`  ${operation.linkPath}`, operation.linkPath, operation.sourcePath);
    }
    return;
  }

  validateSafeSymlinkTargets(operations.map((operation) => operation.linkPath));
  for (const operation of operations) {
    replaceSafeSymlink(operation.sourcePath, operation.linkPath);
    console.log(`${command === "install" ? "Installed" : "Updated"} ${operation.relativePath} for ${operation.harnessName}`);
  }
}

function preflightWrapperCommand(
  command: RuntimeCommand,
  config: Config,
  agentName?: string,
  harnessName?: string,
): void {
  if (command !== "install" && command !== "update") {
    return;
  }
  validateAgentConfig(config, agentName, harnessName);
  validateInstructionConfig(config, harnessName);
  validateSafeSymlinkTargets(agentOperations(config, agentName, harnessName).map((operation) => operation.linkPath));
  validateSafeSymlinkTargets(instructionOperations(config, harnessName).map((operation) => operation.linkPath));
}

function validateAgentConfig(config: Config, agentName?: string, harnessName?: string): void {
  const mappings = config.agentModelMappings;
  if (!mappings || Object.keys(mappings).length === 0) {
    throw new Error("agentModelMappings must configure at least one agent");
  }
  if (!config.runtime.canonicalAgentsDir) {
    throw new Error("runtime.canonicalAgentsDir must be configured for agents");
  }
  if (!config.runtime.agentSymlinkTargets || Object.keys(config.runtime.agentSymlinkTargets).length === 0) {
    throw new Error("runtime.agentSymlinkTargets must configure at least one harness");
  }

  const agentNames = selectedAgentNames(mappings, agentName);
  for (const selectedAgentName of agentNames) {
    const sourcePath = join("agents", `${selectedAgentName}.md`);
    if (!existsSync(sourcePath)) {
      throw new Error(`Missing agent source for '${selectedAgentName}' at ${sourcePath}`);
    }
    const harnesses = selectedHarnessNames(mappings[selectedAgentName], config.runtime.agentSymlinkTargets, harnessName);
    for (const selectedHarnessName of harnesses) {
      const mapping = mappings[selectedAgentName][selectedHarnessName];
      if (!mapping?.model) {
        throw new Error(`Agent '${selectedAgentName}' is missing a model mapping for harness '${selectedHarnessName}'`);
      }
    }
  }
}

function validateInstructionConfig(config: Config, harnessName?: string): void {
  if (!config.instructions?.paths || config.instructions.paths.length === 0) {
    throw new Error("instructions.paths must configure at least one path");
  }
  if (
    !config.runtime.instructionSymlinkTargets ||
    Object.keys(config.runtime.instructionSymlinkTargets).length === 0
  ) {
    throw new Error("runtime.instructionSymlinkTargets must configure at least one harness");
  }

  if (harnessName && !config.runtime.instructionSymlinkTargets[harnessName]) {
    throw new Error(`Unknown instruction harness '${harnessName}'`);
  }
  for (const instructionPath of config.instructions.paths) {
    if (!existsSync(instructionPath)) {
      throw new Error(`Missing instruction path: ${instructionPath}`);
    }
  }
}

function agentOperations(
  config: Config,
  agentName?: string,
  harnessName?: string,
): Array<{
  agentName: string;
  harnessName: string;
  mapping: AgentHarnessConfig;
  sourcePath: string;
  generatedPath: string;
  linkPath: string;
}> {
  const mappings = config.agentModelMappings ?? {};
  const targets = config.runtime.agentSymlinkTargets ?? {};
  const canonicalAgentsDir = expandHome(config.runtime.canonicalAgentsDir ?? "");
  const operations: Array<{
    agentName: string;
    harnessName: string;
    mapping: AgentHarnessConfig;
    sourcePath: string;
    generatedPath: string;
    linkPath: string;
  }> = [];

  for (const selectedAgentName of selectedAgentNames(mappings, agentName)) {
    for (const selectedHarnessName of selectedHarnessNames(mappings[selectedAgentName], targets, harnessName)) {
      operations.push({
        agentName: selectedAgentName,
        harnessName: selectedHarnessName,
        mapping: mappings[selectedAgentName][selectedHarnessName],
        sourcePath: join("agents", `${selectedAgentName}.md`),
        generatedPath: join(canonicalAgentsDir, selectedHarnessName, `${selectedAgentName}.md`),
        linkPath: join(expandHome(targets[selectedHarnessName]), `${selectedAgentName}.md`),
      });
    }
  }
  return operations;
}

function instructionOperations(
  config: Config,
  harnessName?: string,
): Array<{ harnessName: string; relativePath: string; sourcePath: string; linkPath: string }> {
  const targets = config.runtime.instructionSymlinkTargets ?? {};
  const harnessNames = harnessName ? [harnessName] : Object.keys(targets).sort();
  const operations: Array<{ harnessName: string; relativePath: string; sourcePath: string; linkPath: string }> = [];

  for (const selectedHarnessName of harnessNames) {
    for (const instructionPath of config.instructions?.paths ?? []) {
      operations.push({
        harnessName: selectedHarnessName,
        relativePath: instructionPath,
        sourcePath: resolve(instructionPath),
        linkPath: join(expandHome(targets[selectedHarnessName]), instructionPath),
      });
    }
  }
  return operations;
}

function selectedAgentNames(
  mappings: Record<string, Record<string, AgentHarnessConfig>>,
  agentName?: string,
): string[] {
  if (agentName) {
    if (!mappings[agentName]) {
      throw new Error(`Unknown agent '${agentName}'`);
    }
    return [agentName];
  }
  return Object.keys(mappings).sort();
}

function selectedHarnessNames(
  mappings: Record<string, AgentHarnessConfig>,
  targets: Record<string, string>,
  harnessName?: string,
): string[] {
  if (harnessName) {
    if (!targets[harnessName]) {
      throw new Error(`Unknown agent harness '${harnessName}'`);
    }
    if (!mappings[harnessName]) {
      throw new Error(`Selected agent does not define a model mapping for harness '${harnessName}'`);
    }
    return [harnessName];
  }
  return Object.keys(targets)
    .filter((targetName) => mappings[targetName])
    .sort();
}

export function renderAgent(sourcePath: string, mapping: AgentHarnessConfig): string {
  const source = readFileSync(sourcePath, "utf-8");
  const frontmatter = parseFrontmatter(sourcePath, source);
  let header = setFrontmatterValue(frontmatter.header, "model", mapping.model);
  if (mapping.reasoning) {
    header = setFrontmatterValue(header, "reasoning", mapping.reasoning);
  } else {
    header = removeFrontmatterValue(header, "reasoning");
  }
  return `---\n${header.trimEnd()}\n---\n${frontmatter.body}`;
}

function parseFrontmatter(path: string, content: string): { header: string; body: string } {
  if (!content.startsWith("---\n")) {
    throw new Error(`Agent source is missing frontmatter: ${path}`);
  }
  const endIndex = content.indexOf("\n---\n", 4);
  if (endIndex === -1) {
    throw new Error(`Agent source has unterminated frontmatter: ${path}`);
  }
  return {
    header: content.slice(4, endIndex),
    body: content.slice(endIndex + "\n---\n".length),
  };
}

function setFrontmatterValue(header: string, key: string, value: string): string {
  const lines = header.split("\n");
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  const newLine = `${key}: ${value}`;
  if (index === -1) {
    return `${header.trimEnd()}\n${newLine}\n`;
  }
  lines[index] = newLine;
  return `${lines.join("\n").trimEnd()}\n`;
}

function removeFrontmatterValue(header: string, key: string): string {
  return `${header
    .split("\n")
    .filter((line) => !line.startsWith(`${key}:`))
    .join("\n")
    .trimEnd()}\n`;
}

function expandSkillSources(config: Config, skillsetName: string): SkillSource[] {
  if (config.version !== 1) {
    throw new Error(`Unsupported config version: ${config.version}`);
  }

  const skillset = config.skillsets[skillsetName];
  if (!skillset) {
    throw new Error(`Unknown skillset '${skillsetName}'`);
  }

  const sources: SkillSource[] = [];
  for (const blockName of skillset.include) {
    const block = config.blocks[blockName];
    if (!block) {
      throw new Error(`Skillset '${skillsetName}' includes unknown block '${blockName}'`);
    }
    sources.push(...(block.skills ?? []));
  }

  if (sources.length === 0) {
    throw new Error(`Skillset '${skillsetName}' has no skill sources`);
  }

  return sources;
}

function validateSource(source: SkillSource): void {
  if (isLocalSource(source)) {
    if (!source.localPath) {
      throw new Error("Local skill source is missing localPath");
    }
    if (!Array.isArray(source.names) || source.names.length === 0) {
      throw new Error(`Local skill source must list at least one skill name: ${source.localPath}`);
    }
    for (const name of source.names) {
      if (!existsSync(join(source.localPath, name, "SKILL.md"))) {
        throw new Error(`Missing SKILL.md for local skill '${name}' at ${join(source.localPath, name)}`);
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
        throw new Error(`Skill '${name}' is configured more than once: ${existingSource}, ${sourceLabel(source)}`);
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

function resolveCommit(repoDir: string, ref: string): string {
  const remoteRef = ref.startsWith("origin/") ? ref : `origin/${ref}`;
  return run("git", ["-C", repoDir, "rev-parse", `${remoteRef}^{commit}`]).trim();
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

function replaceSymlink(target: string, linkPath: string): void {
  rmSync(linkPath, { force: true, recursive: true });
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
}

export function replaceSafeSymlink(target: string, linkPath: string): void {
  const stats = lstatIfExists(linkPath);
  if (stats) {
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

function printGeneratedStatus(label: string, path: string, expectedContent: string): void {
  if (!existsSync(path)) {
    console.log(`[missing] ${label}: ${path}`);
    return;
  }
  const actualContent = readFileSync(path, "utf-8");
  console.log(`${actualContent === expectedContent ? "[ok]" : "[stale]"} ${label}: ${path}`);
}

function printSymlinkStatus(label: string, linkPath: string, expectedTarget: string): void {
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
  console.log(`${linkRealPath === expectedRealPath ? "[ok]" : "[wrong-target]"} ${label}`);
}

function pathExists(path: string): boolean {
  return existsSync(path);
}

export function validateSafeSymlinkTargets(linkPaths: string[]): void {
  for (const linkPath of linkPaths) {
    const stats = lstatIfExists(linkPath);
    if (stats && !stats.isSymbolicLink()) {
      throw new Error(`Refusing to replace non-symlink target: ${linkPath}`);
    }
  }
}

export function lstatIfExists(path: string): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function resolveSkillSymlinkTargets(canonicalSkillsDir: string, targets: string[]): string[] {
  const canonicalRealPath = realPathIfExists(canonicalSkillsDir);
  const usableTargets: string[] = [];
  const seen = new Set<string>();

  for (const target of targets) {
    const targetRealPath = realPathIfExists(target);
    if (targetRealPath === canonicalRealPath) {
      console.log(`Skipping skill symlink target ${target}; it already resolves to ${canonicalSkillsDir}`);
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

function readLock(): LockFile {
  if (!existsSync(LOCK_FILE)) {
    return { version: 1, skillsets: {} };
  }
  const lock = readJson<LockFile>(LOCK_FILE);
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
    throw new Error(`${[command, ...args].join(" ")} failed\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
