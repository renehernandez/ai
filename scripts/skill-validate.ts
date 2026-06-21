import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const supportedFrontmatterKeys = new Set([
  "name",
  "description",
  "allowed-tools",
]);

type Frontmatter = {
  fields: Map<string, string>;
  keys: string[];
  errors: string[];
};

export type ValidationResult = {
  path: string;
  errors: string[];
};

function stripQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  const fields = new Map<string, string>();
  const keys: string[] = [];
  const errors: string[] = [];

  if (!match) {
    errors.push("SKILL.md must start with YAML frontmatter.");
    return { fields, keys, errors };
  }

  const lines = match[1].split("\n");

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!line.trim()) {
      continue;
    }

    if (/^\s/.test(line)) {
      errors.push(`Invalid indented frontmatter line: ${line.trim()}`);
      continue;
    }

    const lineMatch = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);

    if (!lineMatch) {
      errors.push(`Invalid frontmatter line: ${line}`);
      continue;
    }

    const [, key, rawValue = ""] = lineMatch;
    let value = rawValue.trim();
    keys.push(key);

    if ([">", "|", ">-", "|-"].includes(value)) {
      const blockLines: string[] = [];

      while (index + 1 < lines.length && /^\s/.test(lines[index + 1])) {
        index += 1;
        blockLines.push(lines[index].trim());
      }

      value = value.startsWith(">")
        ? blockLines.filter(Boolean).join(" ")
        : blockLines.join("\n");
    }

    fields.set(key, stripQuotes(value));
  }

  return { fields, keys, errors };
}

function validateOpenAiMetadata(skillPath: string): string[] {
  const errors: string[] = [];
  const metadataPath = join(skillPath, "agents", "openai.yaml");

  if (!existsSync(metadataPath)) {
    return errors;
  }

  const content = readFileSync(metadataPath, "utf8");

  if (!/^interface:\s*$/m.test(content)) {
    errors.push("agents/openai.yaml must define interface.");
  }

  for (const field of ["display_name", "short_description", "default_prompt"]) {
    const fieldPattern = new RegExp(`^\\s{2}${field}:\\s*".+"\\s*$`, "m");

    if (!fieldPattern.test(content)) {
      errors.push(`agents/openai.yaml must define interface.${field}.`);
    }
  }

  return errors;
}

export function validateSkillFolder(skillPath: string): ValidationResult {
  const resolvedPath = resolve(skillPath);
  const errors: string[] = [];

  if (!existsSync(resolvedPath)) {
    return { path: resolvedPath, errors: ["Skill folder does not exist."] };
  }

  if (!statSync(resolvedPath).isDirectory()) {
    return { path: resolvedPath, errors: ["Skill path must be a directory."] };
  }

  const skillMarkdownPath = join(resolvedPath, "SKILL.md");

  if (!existsSync(skillMarkdownPath)) {
    return {
      path: resolvedPath,
      errors: ["Skill folder must contain SKILL.md."],
    };
  }

  const content = readFileSync(skillMarkdownPath, "utf8");
  const frontmatter = parseFrontmatter(content);

  errors.push(...frontmatter.errors);

  for (const key of frontmatter.keys) {
    if (!supportedFrontmatterKeys.has(key)) {
      errors.push(`Unsupported frontmatter key: ${key}.`);
    }
  }

  const name = frontmatter.fields.get("name");
  const description = frontmatter.fields.get("description");

  if (!name) {
    errors.push("Frontmatter must define name.");
  } else {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      errors.push(
        "Frontmatter name must use lowercase letters, numbers, and hyphens.",
      );
    }

    if (name !== basename(resolvedPath)) {
      errors.push(
        `Frontmatter name must match folder name: expected ${basename(
          resolvedPath,
        )}.`,
      );
    }
  }

  if (!description) {
    errors.push("Frontmatter must define description.");
  } else if (!description.startsWith("Use when ")) {
    errors.push('Frontmatter description must start with "Use when ".');
  }

  if (/\[TODO:/i.test(content)) {
    errors.push("SKILL.md still contains template TODO placeholders.");
  }

  errors.push(...validateOpenAiMetadata(resolvedPath));

  return { path: resolvedPath, errors };
}

function discoverSharedSkillFolders(): string[] {
  const skillsPath = resolve("skills");

  if (!existsSync(skillsPath)) {
    return [];
  }

  return readdirSync(skillsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(skillsPath, entry.name))
    .filter((skillPath) => existsSync(join(skillPath, "SKILL.md")))
    .sort();
}

function printResults(results: ValidationResult[]): void {
  const failures = results.filter((result) => result.errors.length > 0);

  if (failures.length === 0) {
    console.log(`Validated ${results.length} skill(s).`);
    return;
  }

  for (const failure of failures) {
    console.error(failure.path);

    for (const error of failure.errors) {
      console.error(`  - ${error}`);
    }
  }
}

export function main(args = process.argv.slice(2)): number {
  const skillPaths = args.length > 0 ? args : discoverSharedSkillFolders();

  if (skillPaths.length === 0) {
    console.error("No skill folders found.");
    return 1;
  }

  const results = skillPaths.map(validateSkillFolder);
  printResults(results);

  return results.some((result) => result.errors.length > 0) ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = main();
}
