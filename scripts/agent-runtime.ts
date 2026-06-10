#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
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
import { basename, dirname, join, relative, resolve } from "node:path";

type SkillCommand = "install" | "update" | "validate";

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
  };
  blocks: Record<string, BlockConfig>;
  skillsets: Record<string, SkillsetConfig>;
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

function main(): void {
  const { command, skillsetName, configPath } = parseArgs(process.argv.slice(2));
  const config = readJson<Config>(configPath);
  const skillsetNames = skillsetName ? [skillsetName] : Object.keys(config.skillsets).sort();

  if (command === "validate") {
    validateConfig(config, skillsetNames);
    validateLockIfPresent();
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

function parseArgs(args: string[]): {
  command: SkillCommand;
  skillsetName?: string;
  configPath: string;
} {
  const [scope, command] = args;
  let skillsetName: string | undefined;
  let configPath = CONFIG_FILE;

  if (
    scope !== "skills" ||
    (command !== "install" && command !== "update" && command !== "validate")
  ) {
    throw new Error(
      "Usage: pnpm agent-runtime skills <install|update|validate> [--skillset name] [--config path]",
    );
  }

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--skillset") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--skillset requires a name");
      }
      if (skillsetName) {
        throw new Error("--skillset can only be provided once");
      }
      skillsetName = value;
      index += 1;
      continue;
    }
    if (arg === "--config") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("--config requires a path");
      }
      configPath = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, skillsetName, configPath };
}

function validateConfig(config: Config, skillsetNames: string[]): void {
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

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
