import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type GitLabPage<T> = {
  page: number;
  next_page: string;
  items: T[];
};

export function parseIncludedJsonPage<T>(output: string): GitLabPage<T> {
  const separator = output.match(/\r?\n\r?\n/);
  if (separator?.index === undefined) {
    throw new Error("gitlab_evidence_response_headers_missing");
  }
  const headers = output.slice(0, separator.index);
  const body = output.slice(separator.index + separator[0].length);
  const page = Number(headerValue(headers, "x-page"));
  const nextPage = headerValue(headers, "x-next-page");
  let items: unknown;
  try {
    items = JSON.parse(body);
  } catch {
    throw new Error("gitlab_evidence_response_body_invalid");
  }
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    nextPage === undefined ||
    !Array.isArray(items)
  ) {
    throw new Error("gitlab_evidence_pagination_headers_invalid");
  }
  return { page, next_page: nextPage, items: items as T[] };
}

function headerValue(headers: string, name: string): string | undefined {
  const expected = name.toLowerCase();
  for (const line of headers.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0 && line.slice(0, colon).trim().toLowerCase() === expected) {
      return line.slice(colon + 1).trim();
    }
  }
  return undefined;
}

function collectPages<T>(endpoint: string): GitLabPage<T>[] {
  const pages: GitLabPage<T>[] = [];
  for (let pageNumber = 1; pageNumber <= 1_000; pageNumber += 1) {
    const separator = endpoint.includes("?") ? "&" : "?";
    const output = execFileSync(
      "glab",
      [
        "api",
        "--include",
        `${endpoint}${separator}per_page=100&page=${pageNumber}`,
      ],
      { encoding: "utf8" },
    );
    const page = parseIncludedJsonPage<T>(output);
    if (page.page !== pageNumber) {
      throw new Error("gitlab_evidence_pagination_sequence_invalid");
    }
    pages.push(page);
    if (page.next_page === "") {
      return pages;
    }
    if (page.next_page !== String(pageNumber + 1)) {
      throw new Error("gitlab_evidence_pagination_sequence_invalid");
    }
  }
  throw new Error("gitlab_evidence_pagination_limit_exceeded");
}

function fetchJson(endpoint: string): Record<string, unknown> {
  return JSON.parse(
    execFileSync("glab", ["api", endpoint], { encoding: "utf8" }),
  ) as Record<string, unknown>;
}

function main(): void {
  const [iid, artifactLifecycle, artifactClassification] =
    process.argv.slice(2);
  if (!iid || !artifactLifecycle || !artifactClassification) {
    throw new Error(
      "usage: gitlab-evidence-collect <mr-iid> <artifact-lifecycle> <artifact-classification>",
    );
  }
  const endpoint = `projects/:fullpath/merge_requests/${iid}`;
  const mr = fetchJson(endpoint);
  process.stdout.write(
    `${JSON.stringify(
      {
        context: {
          artifact_lifecycle: artifactLifecycle,
          artifact_classification: artifactClassification,
        },
        mr: {
          web_url: mr.web_url,
          sha: mr.sha,
          changes_count: mr.changes_count,
        },
        note_pages: collectPages(`${endpoint}/notes`),
        discussion_pages: collectPages(`${endpoint}/discussions`),
        version_pages: collectPages(`${endpoint}/versions`),
      },
      null,
      2,
    )}\n`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href
  : "";
if (import.meta.url === invokedPath) {
  main();
}
