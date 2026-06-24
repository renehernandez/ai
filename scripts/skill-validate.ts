import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

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

type TextSurface = {
  label: string;
  content: string;
};

type PortableBoundaryPattern = {
  pattern: RegExp;
  message: string;
};

type ScriptImport = {
  specifier: string;
  line: number;
};

const scriptFilePattern = /\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/;

const portableBoundaryPatterns: PortableBoundaryPattern[] = [
  {
    pattern: /(?:^|[`'"\s(])(?:pnpm\s+)?ax\s+[a-z][a-z0-9:-]*(?:\s|$)/i,
    message: "non-ax-cli skills must not teach AX command syntax.",
  },
  {
    pattern: /\bplans\s+artifact\b/i,
    message: "non-ax-cli skills must not teach private plan-artifact commands.",
  },
  {
    pattern: /\bprivate\s+AX\s+plan\s+artifact\b/i,
    message: "non-ax-cli skills must not refer to private AX plan artifacts.",
  },
  {
    pattern: /(?:^|[`'"\s(])~\/\.(?:agents|ax|claude|codex)\b/i,
    message: "non-ax-cli skills must not mention installed runtime roots.",
  },
  {
    pattern:
      /(?:^|[`'"\s(])\.(?:agents\/(?:commands|skills)|claude\/skills|codex\/skills)\b/i,
    message:
      "non-ax-cli skills must not mention managed runtime skill or command paths.",
  },
  {
    pattern: /\/(?:Users|home)\/[A-Za-z0-9._-]+\//,
    message:
      "non-ax-cli skills must not mention machine-specific absolute paths.",
  },
  {
    pattern: /\b(?:pnpm\s+)?ax\b[^\n`]*--profile\b/i,
    message:
      "non-ax-cli skills must not teach AX profile-specific runtime commands.",
  },
  {
    pattern:
      /\b(?:profile\s+refresh|skills\s+(?:status|update)|installed\s+runtime|runtime\s+(?:copies|paths|profiles|refresh|roots))\b/i,
    message:
      "non-ax-cli skills must not teach local runtime refresh mechanics.",
  },
  {
    pattern: /\bruntime\.reusableScripts\b/,
    message:
      "non-ax-cli skills must not use runtime.reusableScripts as a portability mechanism.",
  },
  {
    pattern: /\bpnpm\s+exec\s+tsx\s+skills\/[^/\s]+\/scripts\//i,
    message:
      "documented skill helper commands must run from the skill folder, not a repo-root skills path.",
  },
  {
    pattern: /\.\.\/\.\.\/(?:\.\.\/)*scripts\//,
    message:
      "documented skill helper commands must not depend on repo-level scripts paths.",
  },
];

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

function lineNumberForIndex(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

function validatePortableTextBoundary(surface: TextSurface): string[] {
  const errors: string[] = [];

  for (const check of portableBoundaryPatterns) {
    check.pattern.lastIndex = 0;
    const match = check.pattern.exec(surface.content);

    if (match?.index !== undefined) {
      errors.push(
        `${surface.label}:${lineNumberForIndex(surface.content, match.index)} portable-boundary: ${check.message}`,
      );
    }
  }

  return errors;
}

function validatePortableTextSurfaces(skillPath: string): string[] {
  if (basename(skillPath) === "ax-cli") {
    return [];
  }

  const surfaces: TextSurface[] = [
    {
      label: "SKILL.md",
      content: readFileSync(join(skillPath, "SKILL.md"), "utf8"),
    },
  ];
  const metadataPath = join(skillPath, "agents", "openai.yaml");

  if (existsSync(metadataPath)) {
    surfaces.push({
      label: "agents/openai.yaml",
      content: readFileSync(metadataPath, "utf8"),
    });
  }

  return surfaces.flatMap(validatePortableTextBoundary);
}

function discoverScriptFiles(directory: string): string[] {
  if (!existsSync(directory)) {
    return [];
  }

  const files: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...discoverScriptFiles(entryPath));
      continue;
    }

    if (entry.isFile() && scriptFilePattern.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function scriptKindForPath(scriptPath: string): ts.ScriptKind {
  switch (extname(scriptPath)) {
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".js":
    case ".mjs":
    case ".cjs":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function lineNumberForNode(sourceFile: ts.SourceFile, node: ts.Node): number {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

function scriptImports(scriptPath: string, content: string): ScriptImport[] {
  const sourceFile = ts.createSourceFile(
    scriptPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindForPath(scriptPath),
  );
  const imports: ScriptImport[] = [];

  function addStringModuleSpecifier(node: ts.StringLiteralLike): void {
    imports.push({
      specifier: node.text,
      line: lineNumberForNode(sourceFile, node),
    });
  }

  function visit(node: ts.Node): void {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      addStringModuleSpecifier(node.moduleSpecifier);
    }

    if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      if (
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")
      ) {
        addStringModuleSpecifier(node.arguments[0]);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

function staysInsideSkillRoot(skillPath: string, importPath: string): boolean {
  const relativePath = relative(skillPath, importPath);

  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

function localImportPath(
  scriptPath: string,
  specifier: string,
): string | undefined {
  if (specifier.startsWith(".")) {
    return resolve(dirname(scriptPath), specifier);
  }

  if (isAbsolute(specifier)) {
    return specifier;
  }

  if (specifier.startsWith("file://")) {
    try {
      return fileURLToPath(specifier);
    } catch {
      return specifier;
    }
  }

  return undefined;
}

function validateSkillScriptImports(skillPath: string): string[] {
  const errors: string[] = [];

  for (const scriptPath of discoverScriptFiles(join(skillPath, "scripts"))) {
    const content = readFileSync(scriptPath, "utf8");

    for (const scriptImport of scriptImports(scriptPath, content)) {
      const { specifier } = scriptImport;
      const resolvedImportPath = localImportPath(scriptPath, specifier);

      if (!resolvedImportPath) {
        continue;
      }

      if (!staysInsideSkillRoot(skillPath, resolvedImportPath)) {
        errors.push(
          `${relative(skillPath, scriptPath)}:${scriptImport.line} portable-boundary: skill scripts must not import files outside the skill folder (${specifier}).`,
        );
      }
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
  errors.push(...validatePortableTextSurfaces(resolvedPath));
  errors.push(...validateSkillScriptImports(resolvedPath));

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
