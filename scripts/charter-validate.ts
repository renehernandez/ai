import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type Change,
  canonicalOwnerFor,
  isPotentialBehaviorSurface,
  validateBehaviorContractCoverage,
} from "./charter-validator-contracts.ts";
import {
  addedText,
  optionalStagedContent,
  rangeDiff,
  rangePaths,
  revisionContent,
  stagedContent,
  stagedDiff,
  stagedPaths,
} from "./charter-validator-git.ts";
import { prohibitedAddedGuidance } from "./charter-validator-policy.ts";

const charterPath = "rules/agent-development-workflow-charter.md";

const behaviorTestPattern = /^tests\/(?:unit|integration)\/.+\.test\.ts$/;

function requireText(
  content: string,
  pattern: RegExp,
  label: string,
  errors: string[],
): void {
  if (!pattern.test(content)) {
    errors.push(`${label}: missing charter contract ${pattern.source}`);
  }
}

function isGuidanceSurface(path: string): boolean {
  return (
    path.endsWith(".md") || path.endsWith(".yaml") || path.endsWith(".yml")
  );
}

function validateChanges(
  changes: Change[],
  ownerExists: (path: string) => boolean,
  requireBehaviorContracts: boolean,
): string[] {
  const errors: string[] = [];
  const behaviorChanges = changes.filter((change) =>
    isPotentialBehaviorSurface(change.path),
  );

  for (const change of behaviorChanges) {
    const owner = canonicalOwnerFor(change.path);
    if (!owner) {
      errors.push(
        `${change.path}: unclassified agent-behavior surface has no canonical owner`,
      );
      continue;
    }
    if (!ownerExists(owner)) {
      errors.push(`${change.path}: canonical owner ${owner} does not exist`);
    }
    if (isGuidanceSurface(change.path)) {
      for (const prohibited of prohibitedAddedGuidance) {
        if (
          prohibited.message ===
            "raw provider creation or update bypasses change-request-create" &&
          (change.path ===
            "skills/change-request-create/references/gitlab-provider.md" ||
            change.path ===
              "skills/change-request-create/references/github-provider.md")
        ) {
          continue;
        }
        if (prohibited.pattern.test(change.content)) {
          errors.push(`${change.path}: ${prohibited.message}`);
        }
      }
      if (
        change.path !==
          "skills/change-request-create/references/gitlab-provider.md" &&
        change.path !==
          "skills/change-request-create/references/github-provider.md" &&
        /\b(?:glab mr|gh pr)\s+(?:create|update)\b/i.test(change.additions)
      ) {
        errors.push(
          `${change.path}: raw provider creation or update bypasses change-request-create`,
        );
      }
    }
    if (
      /\b(?:exception|deviation)\b/i.test(change.additions) &&
      !/(?:accepted[ _-]?outcome|explicit[ _-]?user|authority)/i.test(
        change.additions,
      )
    ) {
      errors.push(
        `${change.path}: an intended deviation must name its accepted outcome or authority`,
      );
    }
  }

  if (behaviorChanges.length > 0) {
    if (requireBehaviorContracts) {
      validateBehaviorContractCoverage(changes, behaviorChanges, errors);
    }
  }
  return errors;
}

function validateCoreFiles(
  read: (path: string) => string | undefined,
): string[] {
  const errors: string[] = [];
  const requiredFiles = [charterPath, "AGENTS.md", "instructions/AGENTS.md"];
  const contents = new Map(
    requiredFiles.map((path) => [path, read(path)] as const),
  );
  for (const path of requiredFiles) {
    if (contents.get(path) === undefined) {
      errors.push(`${path}: required charter surface is missing`);
    }
  }
  if (errors.length > 0) {
    return errors;
  }
  const charter = contents.get(charterPath) ?? "";
  requireText(charter, /applies to every kind of work/i, charterPath, errors);
  requireText(charter, /one canonical owner/i, charterPath, errors);
  requireText(
    charter,
    /clean-context RED\/GREEN pressure scenarios/i,
    charterPath,
    errors,
  );
  for (const path of ["AGENTS.md", "instructions/AGENTS.md"]) {
    requireText(
      contents.get(path) ?? "",
      /agent-development-workflow-charter\.md/,
      path,
      errors,
    );
  }
  return errors;
}

export function validateCharterFixture(
  root: string,
  contentByPath: Readonly<Record<string, string>>,
  requireBehaviorContracts = false,
): string[] {
  const readFixture = (path: string): string | undefined =>
    existsSync(join(root, path))
      ? readFileSync(join(root, path), "utf8")
      : undefined;
  const coreErrors = validateCoreFiles(readFixture);
  if (coreErrors.length > 0) {
    return coreErrors;
  }
  const changes = Object.entries(contentByPath).map(([path, content]) => ({
    path,
    content,
    additions: content,
  }));
  return validateChanges(
    changes,
    (path) => readFixture(path) !== undefined,
    requireBehaviorContracts,
  );
}

export function validateCharterRepository(
  root: string,
  indexFile = process.env.GIT_INDEX_FILE,
): string[] {
  const readIndex = (path: string): string | undefined =>
    optionalStagedContent(root, path, indexFile);
  const coreErrors = validateCoreFiles(readIndex);
  if (coreErrors.length > 0) {
    return coreErrors;
  }
  let paths: string[];
  try {
    paths = stagedPaths(root, indexFile);
  } catch (error) {
    return [
      `git: unable to discover staged agent-behavior surfaces: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  const changes: Change[] = [];
  for (const path of paths) {
    try {
      const diff = stagedDiff(root, path, indexFile);
      const content = optionalStagedContent(root, path, indexFile) ?? "";
      changes.push({
        path,
        content,
        additions: addedText(diff),
      });
    } catch (error) {
      return [
        `${path}: unable to inspect staged behavior: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
  }
  for (const path of paths.filter((path) => behaviorTestPattern.test(path))) {
    try {
      const indexContent = stagedContent(root, path, indexFile);
      if (
        !existsSync(join(root, path)) ||
        readFileSync(join(root, path), "utf8") !== indexContent
      ) {
        return [
          `${path}: worktree scenario differs from the staged executable scenario`,
        ];
      }
      const change = changes.find((candidate) => candidate.path === path);
      if (change) {
        change.content = indexContent;
      }
    } catch (error) {
      return [
        `${path}: unable to inspect staged pressure scenario: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
  }
  return validateChanges(
    changes,
    (path) => readIndex(path) !== undefined,
    true,
  );
}

export function validateCharterRange(
  root: string,
  targetBase: string,
  sourceHead: string,
): string[] {
  const readHead = (path: string): string | undefined =>
    revisionContent(root, sourceHead, path);
  const coreErrors = validateCoreFiles(readHead);
  if (coreErrors.length > 0) {
    return coreErrors;
  }
  let paths: string[];
  try {
    paths = rangePaths(root, targetBase, sourceHead);
  } catch (error) {
    return [
      `git: unable to discover range agent-behavior surfaces: ${error instanceof Error ? error.message : String(error)}`,
    ];
  }
  const changes: Change[] = paths.map((path) => {
    const diff = rangeDiff(root, targetBase, sourceHead, path);
    return {
      path,
      content: readHead(path) ?? "",
      additions: addedText(diff),
    };
  });
  return validateChanges(changes, (path) => readHead(path) !== undefined, true);
}

function runScenarios(root: string): void {
  const paths = stagedPaths(root).filter((path) =>
    behaviorTestPattern.test(path),
  );
  if (paths.length > 0) {
    execFileSync(process.execPath, ["--import", "tsx", "--test", ...paths], {
      cwd: root,
      encoding: "utf8",
      stdio: "inherit",
    });
  }
}

function main(): void {
  const root = resolve(process.cwd());
  const errors = validateCharterRepository(root);
  if (errors.length > 0) {
    for (const error of errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exitCode = 1;
    return;
  }
  runScenarios(root);
  process.stdout.write(
    "Charter validation passed for the exact staged behavior.\n",
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main();
}
