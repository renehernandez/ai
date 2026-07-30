import { execFileSync } from "node:child_process";
import { gitRepositoryEnv } from "./charter-validator-git.ts";

const executeGit = execFileSync;

export function createIndexReader(root: string): (path: string) => string {
  const pathObjects = new Map<string, string>();
  const env = gitRepositoryEnv(root);
  const index = executeGit("git", ["-C", root, "ls-files", "--stage", "-z"], {
    encoding: "utf8",
    env,
  });
  for (const record of index.split("\0")) {
    if (!record) {
      continue;
    }
    const separator = record.indexOf("\t");
    if (separator < 0) {
      continue;
    }
    const [mode, object, stage] = record.slice(0, separator).split(" ");
    const path = record.slice(separator + 1);
    if (mode && object && stage === "0") {
      pathObjects.set(path, object);
    }
  }
  const objectContents = readObjects(
    root,
    [...new Set(pathObjects.values())],
    env,
  );
  const entries = new Map(
    [...pathObjects].map(([path, object]) => [
      path,
      objectContents.get(object) ?? "",
    ]),
  );

  return (path: string): string => {
    const content = entries.get(path);
    if (content === undefined) {
      throw new Error(`staged repository path is unavailable: ${path}`);
    }
    return content;
  };
}

export const read = createIndexReader(process.cwd());

function readObjects(
  root: string,
  objects: string[],
  env: NodeJS.ProcessEnv,
): Map<string, string> {
  if (objects.length === 0) {
    return new Map();
  }
  const output = executeGit(
    "git",
    ["--no-replace-objects", "-C", root, "cat-file", "--batch"],
    {
      env,
      input: `${objects.join("\n")}\n`,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  const contents = new Map<string, string>();
  let offset = 0;
  for (const expectedObject of objects) {
    const headerEnd = output.indexOf(10, offset);
    if (headerEnd < 0) {
      throw new Error(`Git omitted staged object ${expectedObject}`);
    }
    const [object, type, sizeText] = output
      .subarray(offset, headerEnd)
      .toString("utf8")
      .split(" ");
    const size = Number.parseInt(sizeText ?? "", 10);
    if (
      object !== expectedObject ||
      type !== "blob" ||
      !Number.isFinite(size)
    ) {
      throw new Error(`Git returned invalid staged object ${expectedObject}`);
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + size;
    contents.set(object, output.subarray(contentStart, contentEnd).toString());
    offset = contentEnd + 1;
  }
  return contents;
}
