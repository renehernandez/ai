#!/usr/bin/env tsx
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Command } from "commander";
import {
  applyPreparedManagedConfigs,
  inspectManagedConfigs,
  prepareManagedConfigs,
  syncManagedConfigs,
  validateManagedConfigs,
} from "./ax/config-sync.ts";
import {
  type CoordinatorTargets,
  writeCoordinatorRegistration,
} from "./ax/coordinator-project-runtime.ts";
import {
  inspectOpenSpec,
  type OpenSpecConfig,
  syncOpenSpec,
  validateOpenSpec,
} from "./ax/openspec-sync.ts";
import {
  type AxRuntimeConfig,
  inspectRuntime,
  preflightRuntimeSync,
  type RuntimeSurface,
  syncRuntime,
  validateRuntime,
} from "./ax/runtime-sync.ts";

type Scope = RuntimeSurface | "configs" | "openspec";
type RuntimeCommand = "sync" | "status" | "validate";
type ShimCommand = "install" | "status" | "uninstall";

type ParsedArgs = {
  scope?: Scope;
  command: RuntimeCommand;
  shimCommand?: ShimCommand;
  configPath: string;
  runtimeRoot?: string;
  profile?: string;
  recoveryFile?: string;
  contextFile?: string;
  reviewConfig?: boolean;
  acceptConfigChanges?: boolean;
  json?: boolean;
};

export type RuntimeInvocationContext = {
  sourceRoot: string;
  targetRoot: string;
  executablePath: string;
  configPath: string;
};

type CommandExecutor = (input: ParsedArgs) => void;
type CommandOptions = {
  config?: string;
  runtimeRoot?: string;
  profile?: string;
  recoveryFile?: string;
  contextFile?: string;
  reviewConfig?: boolean;
  acceptConfigChanges?: boolean;
  json?: boolean;
  deliveryProjectId?: string;
  operationsProjectId?: string;
};

const CONFIG_FILE = "ax.config.json";
const SHIM_PATH = "~/.local/bin/ax";
const SHIM_MARKER = "# AX_MANAGED_SHIM";
const SHIM_SOURCE_ROOT_PREFIX = "# AX_SOURCE_ROOT=";

export function main(): void {
  const program = createProgram();
  if (process.argv.length <= 2) {
    program.outputHelp();
    return;
  }
  program.parse(process.argv);
}

export function createProgram(
  execute: CommandExecutor = executeParsedCommand,
): Command {
  const program = new Command();
  program
    .name("ax")
    .description("Synchronize reusable local Agents Experience runtime assets")
    .showHelpAfterError("(add --help for additional information)")
    .configureHelp({ sortSubcommands: true })
    .option("--config <path>", "Path to Agents Experience desired-state config")
    .option("--runtime-root <path>", "Explicit local AX runtime root");

  for (const command of runtimeCommands()) {
    addRuntimeCommand(program, command, execute);
  }
  addLegacyRuntimeCommands(program, "ax", "ax sync");
  addRuntimeScope(program, "skills", execute);
  addRuntimeScope(program, "instructions", execute);
  addRuntimeScope(program, "hooks", execute);
  addRuntimeScope(program, "agents", execute);
  addRuntimeScope(program, "configs", execute);
  addCoordinatorCommands(program, execute);
  addOpenSpecCommands(program, execute);
  addShimCommands(program, execute);
  return program;
}

export function executeParsedCommand(input: ParsedArgs): void {
  const context = createRuntimeInvocationContext(input.configPath);
  if (input.shimCommand) {
    runShim(input.shimCommand, context);
    return;
  }
  const config = readJson<AxRuntimeConfig>(context.configPath);
  const runtimeRoot = input.runtimeRoot
    ? expandPath(input.runtimeRoot, context.sourceRoot)
    : undefined;
  const managedConfigOptions = {
    sourceRoot: context.sourceRoot,
    config,
    runtimeRoot,
  };

  if (input.scope === "openspec") {
    const openSpecConfig = config.runtime.openspec as
      | OpenSpecConfig
      | undefined;
    if (input.command === "sync") {
      const result = syncOpenSpec({
        targetRoot: context.targetRoot,
        config: openSpecConfig ?? {},
        contextFile: input.contextFile,
        reviewConfig: input.reviewConfig,
        acceptConfigChanges: input.acceptConfigChanges,
        recoveryFile: input.recoveryFile,
        confirm: confirmPrompt,
      });
      printResult(result, input.json);
      return;
    }
    const report =
      input.command === "validate"
        ? validateOpenSpec({
            targetRoot: context.targetRoot,
            config: openSpecConfig ?? {},
          })
        : inspectOpenSpec({
            targetRoot: context.targetRoot,
            config: openSpecConfig ?? {},
          });
    printResult(report, input.json);
    if (
      input.command === "status" &&
      !report.ok &&
      report.state !== "missing"
    ) {
      process.exitCode = 1;
    }
    return;
  }

  if (input.scope === "configs") {
    const result =
      input.command === "sync"
        ? syncManagedConfigs(managedConfigOptions)
        : input.command === "validate"
          ? validateManagedConfigs(managedConfigOptions)
          : inspectManagedConfigs(managedConfigOptions);
    printResult(result, input.json);
    if ("ok" in result && !result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (input.command === "sync") {
    const runtimeOptions = {
      sourceRoot: context.sourceRoot,
      config,
      runtimeRoot,
      surface: input.scope,
      profile: input.profile,
    };
    preflightRuntimeSync(runtimeOptions);
    const preparedConfigs = input.scope
      ? undefined
      : prepareManagedConfigs(managedConfigOptions);
    const managedConfigs = preparedConfigs
      ? applyPreparedManagedConfigs(preparedConfigs)
      : undefined;
    const result = syncRuntime(runtimeOptions);
    printResult(
      managedConfigs
        ? {
            ...result,
            changedPaths: [
              ...new Set([
                ...result.changedPaths,
                ...managedConfigs.changedPaths,
              ]),
            ].sort(),
            managedConfigs,
          }
        : result,
      input.json,
    );
    return;
  }
  const report =
    input.command === "validate"
      ? validateRuntime({
          sourceRoot: context.sourceRoot,
          config,
          runtimeRoot,
          surface: input.scope,
        })
      : inspectRuntime({
          sourceRoot: context.sourceRoot,
          config,
          runtimeRoot,
          surface: input.scope,
        });
  const targetOpenSpec = input.scope
    ? undefined
    : inspectOpenSpec({
        targetRoot: context.targetRoot,
        config: (config.runtime.openspec as OpenSpecConfig | undefined) ?? {},
      });
  const managedConfigs = input.scope
    ? undefined
    : input.command === "validate"
      ? validateManagedConfigs(managedConfigOptions)
      : inspectManagedConfigs(managedConfigOptions);
  const ok = report.ok && (managedConfigs?.ok ?? true);
  printResult(
    {
      ...report,
      ok,
      ...(targetOpenSpec ? { targetOpenSpec } : {}),
      ...(managedConfigs ? { managedConfigs } : {}),
    },
    input.json,
  );
  if (!ok) {
    process.exitCode = 1;
  }
}

export function createRuntimeInvocationContext(
  configPath = join(runtimeSourceRoot(), CONFIG_FILE),
): RuntimeInvocationContext {
  return {
    sourceRoot: runtimeSourceRoot(),
    targetRoot: process.cwd(),
    executablePath: resolve(
      process.env.AX_EXECUTABLE_PATH || process.argv[1] || "ax",
    ),
    configPath: resolve(configPath),
  };
}

function addRuntimeCommand(
  program: Command,
  command: RuntimeCommand,
  execute: CommandExecutor,
): void {
  const subcommand = program
    .command(command)
    .description(`${label(command)} all managed runtime assets`)
    .option("--json", "Emit structured JSON");
  if (command === "sync") {
    subcommand.option(
      "--profile <name>",
      "Select or switch the machine runtime profile",
    );
  }
  subcommand.action((options: CommandOptions, commandObject: Command) => {
    execute(parsedCommand(undefined, command, options, commandObject));
  });
}

function addRuntimeScope(
  program: Command,
  scope: RuntimeSurface | "configs",
  execute: CommandExecutor,
): void {
  const parent = program
    .command(scope)
    .description(`${label(scope)} runtime surface`);
  for (const command of runtimeCommands()) {
    const subcommand = parent
      .command(command)
      .description(`${label(command)} managed ${scope}`)
      .option("--json", "Emit structured JSON");
    subcommand.action((options: CommandOptions, commandObject: Command) => {
      execute(parsedCommand(scope, command, options, commandObject));
    });
  }
  addLegacyRuntimeCommands(parent, `ax ${scope}`, `ax ${scope} sync`);
}

function addCoordinatorCommands(
  program: Command,
  execute: CommandExecutor,
): void {
  const parent = program
    .command("coordinators")
    .description("Coordinator control-project runtime surface");
  for (const command of runtimeCommands()) {
    const subcommand = parent
      .command(command)
      .description(`${label(command)} managed coordinator projects`)
      .option("--json", "Emit structured JSON");
    subcommand.action((options: CommandOptions, commandObject: Command) => {
      execute(parsedCommand("coordinators", command, options, commandObject));
    });
  }
  parent
    .command("register")
    .description("Record the two manually saved Codex project IDs")
    .requiredOption(
      "--delivery-project-id <id>",
      "Saved Delivery Coordination project ID",
    )
    .requiredOption(
      "--operations-project-id <id>",
      "Saved Executive Operations project ID",
    )
    .option("--json", "Emit structured JSON")
    .action((options: CommandOptions, commandObject: Command) => {
      const globals = commandObject.optsWithGlobals<CommandOptions>();
      const context = createRuntimeInvocationContext(
        globals.config ? resolve(globals.config) : undefined,
      );
      const config = readJson<AxRuntimeConfig>(context.configPath);
      const coordinatorConfig = config.runtime.coordinatorProjects;
      if (!coordinatorConfig) {
        throw new Error("coordinator_projects_not_configured");
      }
      const runtimeRoot = globals.runtimeRoot
        ? expandPath(globals.runtimeRoot, context.sourceRoot)
        : join(resolve(process.env.HOME || homedir()), ".agents", "runtime");
      const targets = Object.fromEntries(
        Object.entries(coordinatorConfig.targets).map(([kind, target]) => [
          kind,
          expandPath(target, context.sourceRoot),
        ]),
      ) as CoordinatorTargets;
      const result = writeCoordinatorRegistration({
        runtimeRoot,
        targets,
        projectIds: {
          delivery: options.deliveryProjectId ?? "",
          operations: options.operationsProjectId ?? "",
        },
      });
      printResult(result, options.json);
    });
  addLegacyRuntimeCommands(parent, "ax coordinators", "ax coordinators sync");
}

function addOpenSpecCommands(program: Command, execute: CommandExecutor): void {
  const parent = program
    .command("openspec")
    .description("Synchronize repo-local OpenSpec scaffolding");
  for (const command of runtimeCommands()) {
    const subcommand = parent
      .command(command)
      .description(`${label(command)} repo-local OpenSpec scaffolding`)
      .option("--json", "Emit structured JSON");
    if (command === "sync") {
      subcommand
        .option(
          "--context-file <path>",
          "Confirmed context for missing/partial headless setup",
        )
        .option("--review-config", "Review inferred config changes")
        .option(
          "--accept-config-changes",
          "Apply reviewed config changes in headless mode",
        )
        .option(
          "--recovery-file <path>",
          "Resolve the current worktree transaction",
        );
    }
    subcommand.action((options: CommandOptions, commandObject: Command) => {
      execute(parsedCommand("openspec", command, options, commandObject));
    });
  }
  addLegacyRuntimeCommands(parent, "ax openspec", "ax openspec sync");
}

function addLegacyRuntimeCommands(
  parent: Command,
  commandPrefix: string,
  replacement: string,
): void {
  for (const legacy of ["install", "update"] as const) {
    parent
      .command(legacy, { hidden: true })
      .allowUnknownOption(true)
      .allowExcessArguments(true)
      .action(() => {
        throw new Error(
          `${commandPrefix} ${legacy} has been removed. Use ${replacement}. No files were changed.`,
        );
      });
  }
}

function addShimCommands(program: Command, execute: CommandExecutor): void {
  const parent = program
    .command("shim")
    .description("Manage the AX-owned executable shim");
  for (const shimCommand of ["install", "status", "uninstall"] as const) {
    parent
      .command(shimCommand)
      .description(`${label(shimCommand)} the managed AX shim`)
      .action((options: CommandOptions, commandObject: Command) => {
        const parsed = parsedCommand(
          undefined,
          "status",
          options,
          commandObject,
        );
        execute({ ...parsed, shimCommand });
      });
  }
}

function parsedCommand(
  scope: Scope | undefined,
  command: RuntimeCommand,
  options: CommandOptions,
  commandObject: Command,
): ParsedArgs {
  const globals = commandObject.optsWithGlobals<CommandOptions>();
  const sourceRoot = runtimeSourceRoot();
  const resolveOptional = (value: string | undefined): string | undefined =>
    value ? resolve(value) : undefined;
  return {
    scope,
    command,
    configPath: globals.config
      ? resolve(globals.config)
      : join(sourceRoot, CONFIG_FILE),
    runtimeRoot: globals.runtimeRoot
      ? expandPath(globals.runtimeRoot, sourceRoot)
      : undefined,
    profile: options.profile,
    recoveryFile: resolveOptional(options.recoveryFile),
    contextFile: resolveOptional(options.contextFile),
    reviewConfig: options.reviewConfig,
    acceptConfigChanges: options.acceptConfigChanges,
    json: options.json,
  };
}

function runtimeCommands(): RuntimeCommand[] {
  return ["sync", "status", "validate"];
}

function printResult(value: unknown, json?: boolean): void {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (Array.isArray(child)) {
      console.log(`${key}: ${child.length === 0 ? "[]" : child.join(", ")}`);
    } else if (child && typeof child === "object") {
      console.log(`${key}: ${JSON.stringify(child)}`);
    } else {
      console.log(`${key}: ${String(child)}`);
    }
  }
}

function confirmPrompt(message: string): boolean {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return false;
  }
  return readPromptLine(`${message}\nConfirm? [y/N] `).toLowerCase() === "y";
}

function readPromptLine(message: string): string {
  writeSync(1, message);
  const buffer = Buffer.alloc(4096);
  const bytes = readSync(0, buffer, 0, buffer.length, null);
  return buffer.subarray(0, bytes).toString("utf-8").trim();
}

function runShim(
  command: ShimCommand,
  context: RuntimeInvocationContext,
): void {
  const shimPath = expandPath(SHIM_PATH, context.sourceRoot);
  if (command === "install") {
    const existing = lstatIfExists(shimPath);
    if (existing && !isManagedShim(shimPath)) {
      throw new Error(`Refusing to overwrite unmanaged ax shim at ${shimPath}`);
    }
    mkdirSync(dirname(shimPath), { recursive: true });
    writeFileSync(shimPath, renderManagedShim(context.sourceRoot), "utf-8");
    chmodSync(shimPath, 0o755);
  } else if (command === "uninstall") {
    if (existsSync(shimPath) && !isManagedShim(shimPath)) {
      throw new Error(`Refusing to remove unmanaged ax shim at ${shimPath}`);
    }
    rmSync(shimPath, { force: true });
  }
  const stats = lstatIfExists(shimPath);
  const pathEntries = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  console.log(
    JSON.stringify(
      {
        shimPath,
        installed: Boolean(stats),
        managed: Boolean(stats && isManagedShim(shimPath)),
        executable: Boolean(stats && stats.mode & 0o111),
        sourceRoot: stats ? managedShimSourceRoot(shimPath) : undefined,
        pathResolution: pathEntries.find((entry) =>
          existsSync(join(entry, "ax")),
        ),
      },
      null,
      2,
    ),
  );
}

function renderManagedShim(sourceRoot: string): string {
  const quoted = sourceRoot.replace(/'/g, `'"'"'`);
  return `#!/bin/sh\n${SHIM_MARKER}\n${SHIM_SOURCE_ROOT_PREFIX}${sourceRoot}\nexec node '${quoted}/bin/ax.mjs' "$@"\n`;
}

function isManagedShim(path: string): boolean {
  try {
    return readFileSync(path, "utf-8").includes(SHIM_MARKER);
  } catch {
    return false;
  }
}

function managedShimSourceRoot(path: string): string | undefined {
  const line = readFileSync(path, "utf-8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(SHIM_SOURCE_ROOT_PREFIX));
  return line?.slice(SHIM_SOURCE_ROOT_PREFIX.length);
}

function runtimeSourceRoot(): string {
  return process.env.AX_SOURCE_ROOT
    ? resolve(process.env.AX_SOURCE_ROOT)
    : dirname(dirname(fileURLToPath(import.meta.url)));
}

function label(value: string): string {
  return value[0].toUpperCase() + value.slice(1);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function expandPath(path: string, sourceRoot: string): string {
  if (path === "~") {
    return resolve(process.env.HOME || homedir());
  }
  if (path.startsWith("~/")) {
    return join(resolve(process.env.HOME || homedir()), path.slice(2));
  }
  return isAbsolute(path) ? resolve(path) : resolve(sourceRoot, path);
}

export function lstatIfExists(
  path: string,
): ReturnType<typeof lstatSync> | undefined {
  try {
    return lstatSync(path);
  } catch {
    return undefined;
  }
}

export function replaceSafeSymlink(target: string, linkPath: string): void {
  const existing = lstatIfExists(linkPath);
  if (existing && !existing.isSymbolicLink()) {
    if (realPathIfPossible(linkPath) === realPathIfPossible(target)) {
      return;
    }
    throw new Error(`Refusing to replace non-symlink target: ${linkPath}`);
  }
  mkdirSync(dirname(linkPath), { recursive: true });
  rmSync(linkPath, { force: true });
  symlinkSync(target, linkPath);
}

export function validateSafeSymlinkTargets(
  targets: Array<string | { linkPath: string; target: string }>,
): void {
  for (const value of targets) {
    const linkPath = typeof value === "string" ? value : value.linkPath;
    const target = typeof value === "string" ? undefined : value.target;
    const existing = lstatIfExists(linkPath);
    if (
      existing &&
      !existing.isSymbolicLink() &&
      (!target || realPathIfPossible(linkPath) !== realPathIfPossible(target))
    ) {
      throw new Error(`Refusing to replace non-symlink target: ${linkPath}`);
    }
  }
}

function realPathIfPossible(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    try {
      const link = readlinkSync(path);
      return resolve(dirname(path), link);
    } catch {
      return resolve(path);
    }
  }
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
