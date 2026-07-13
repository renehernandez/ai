import { readFileSync } from "node:fs";

export function readInput(args: string[]): string {
  const fileIndex = args.indexOf("--file");
  if (fileIndex !== -1) {
    const file = args[fileIndex + 1];
    if (!file) {
      fail("--file requires a path");
    }
    return readFileSync(file, "utf8");
  }

  return readFileSync(0, "utf8");
}

export function extractYaml(input: string): string {
  const fenced = input.match(/```(?:ya?ml)?\s*\n([\s\S]*?)\n```/);
  return (fenced?.[1] ?? input).trim();
}

export function extractSection(input: string, sectionName: string): string {
  return findSection(input, sectionName) ?? input;
}

function findSection(input: string, sectionName: string): string | null {
  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${sectionName}:`);
  if (start === -1) {
    return null;
  }

  return lines
    .slice(start + 1)
    .filter((line) => line.startsWith(" ") || line.trim() === "")
    .map((line) => line.replace(/^ {2}/, ""))
    .join("\n");
}

export function scalar(input: string, key: string): string | undefined {
  const match = input.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*(.+?)\\s*$`, "m"),
  );
  return match ? cleanScalar(match[1]) : undefined;
}

export function list(input: string, key: string): string[] {
  const inline = input.match(
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*\\[(.*?)\\]\\s*$`, "m"),
  );
  if (inline) {
    return inline[1]
      .split(",")
      .map((item) => cleanScalar(item))
      .filter(Boolean);
  }

  const lines = input.split(/\r?\n/);
  const start = lines.findIndex((line) =>
    new RegExp(`^\\s*${escapeRegExp(key)}:\\s*$`).test(line),
  );
  if (start === -1) {
    return [];
  }

  const baseIndent = lines[start].match(/^\s*/)?.[0].length ?? 0;
  const values: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.trim()) {
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= baseIndent) {
      break;
    }

    const item = line.trim().match(/^-\s*(.*)$/);
    if (item) {
      values.push(cleanScalar(item[1]));
    }
  }

  return values.filter(Boolean);
}

export function requireValue(
  value: string | undefined,
  label: string,
  errors: string[],
): void {
  if (!value) {
    errors.push(`${label} is required`);
  }
}

export function includes<T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}

export function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function cleanScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
