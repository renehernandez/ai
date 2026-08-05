import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type SkillCorpusEntry = {
  name: string;
  status: "managed" | "missing";
  runtimeWords: number;
  referenceWords: number;
  referenceFiles: number;
  scriptFiles: number;
  embeddedEvidenceSections: string[];
  progressiveDisclosureViolations: string[];
};

export type SkillCorpusReport = {
  managedSkillCount: number;
  generatedAdapterCount: number;
  runtimeWords: number;
  generatedAdapterWords: number;
  referenceWords: number;
  referenceFiles: number;
  scriptFiles: number;
  missingSkills: string[];
  embeddedEvidence: Array<{ skill: string; heading: string }>;
  progressiveDisclosureViolations: Array<{ skill: string; path: string }>;
  skills: SkillCorpusEntry[];
};

export function inspectSkillCorpus(root: string): SkillCorpusReport {
  const names = managedSkillNames(root);
  const skills = names.map((name) => inspectSkill(root, name));
  const adapters = generatedAdapters(root);

  return {
    managedSkillCount: names.length,
    generatedAdapterCount: adapters.length,
    runtimeWords: total(skills.map((skill) => skill.runtimeWords)),
    generatedAdapterWords: total(
      adapters.map((path) => wordCount(readFileSync(path, "utf8"))),
    ),
    referenceWords: total(skills.map((skill) => skill.referenceWords)),
    referenceFiles: total(skills.map((skill) => skill.referenceFiles)),
    scriptFiles: total(skills.map((skill) => skill.scriptFiles)),
    missingSkills: skills
      .filter((skill) => skill.status === "missing")
      .map((skill) => skill.name),
    embeddedEvidence: skills.flatMap((skill) =>
      skill.embeddedEvidenceSections.map((heading) => ({
        skill: skill.name,
        heading,
      })),
    ),
    progressiveDisclosureViolations: skills.flatMap((skill) =>
      skill.progressiveDisclosureViolations.map((path) => ({
        skill: skill.name,
        path,
      })),
    ),
    skills,
  };
}

function managedSkillNames(root: string): string[] {
  const config = JSON.parse(
    readFileSync(join(root, "ax.config.json"), "utf8"),
  ) as {
    blocks: Record<
      string,
      { skills?: Array<{ localPath?: string; names?: string[] }> }
    >;
  };

  const declared = Object.values(config.blocks)
    .flatMap((block) => block.skills ?? [])
    .filter((entry) => entry.localPath === "skills")
    .flatMap((entry) => entry.names ?? []);
  return [...new Set(declared)].sort();
}

function inspectSkill(root: string, name: string): SkillCorpusEntry {
  const skillRoot = join(root, "skills", name);
  const skillPath = join(skillRoot, "SKILL.md");
  if (!existsSync(skillPath)) {
    return {
      name,
      status: "missing",
      runtimeWords: 0,
      referenceWords: 0,
      referenceFiles: 0,
      scriptFiles: 0,
      embeddedEvidenceSections: [],
      progressiveDisclosureViolations: [],
    };
  }

  const content = readFileSync(skillPath, "utf8");
  const references = regularFiles(join(skillRoot, "references"));
  const scripts = regularFiles(join(skillRoot, "scripts"));
  const linkedReferences = linkedReferencePaths(content);

  return {
    name,
    status: "managed",
    runtimeWords: wordCount(content),
    referenceWords: total(
      references.map((path) => wordCount(readFileSync(path, "utf8"))),
    ),
    referenceFiles: references.length,
    scriptFiles: scripts.length,
    embeddedEvidenceSections: [
      ...content.matchAll(
        /^## (Test Evidence|Validation Scenarios|Verification Scenarios)$/gm,
      ),
    ].map((match) => match[1]),
    progressiveDisclosureViolations: linkedReferences.filter(
      (path) =>
        path.split("/").length !== 2 || !existsSync(join(skillRoot, path)),
    ),
  };
}

function linkedReferencePaths(content: string): string[] {
  const paths: string[] = [];
  const links = content.matchAll(
    /\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g,
  );
  for (const match of links) {
    const destination = (match[1] ?? match[2] ?? "")
      .replace(/^\.\//, "")
      .replace(/[?#].*$/, "");
    if (destination.startsWith("references/")) paths.push(destination);
  }
  return paths;
}

function generatedAdapters(root: string): string[] {
  const adapterRoot = join(root, ".agents", "skills");
  if (!existsSync(adapterRoot)) return [];
  return readdirSync(adapterRoot)
    .filter((name) => name.startsWith("openspec-"))
    .map((name) => join(adapterRoot, name, "SKILL.md"))
    .filter(existsSync);
}

function regularFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      const stat = statSync(path);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push(path);
    }
  };
  visit(root);
  return files;
}

function wordCount(content: string): number {
  const normalized = content.trim();
  return normalized ? normalized.split(/\s+/).length : 0;
}

function total(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

function main(): void {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const report = inspectSkillCorpus(root);
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }

  process.stdout.write("## Readable Summary\n\n");
  process.stdout.write(
    `${report.managedSkillCount} managed skills contain ${report.runtimeWords} runtime words; ${report.generatedAdapterCount} generated adapters contain ${report.generatedAdapterWords}. References contain ${report.referenceWords} words across ${report.referenceFiles} files.\n\n`,
  );
  process.stdout.write(
    `Missing skills: ${report.missingSkills.length}; embedded evidence sections: ${report.embeddedEvidence.length}; progressive-disclosure violations: ${report.progressiveDisclosureViolations.length}.\n`,
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
) {
  main();
}
