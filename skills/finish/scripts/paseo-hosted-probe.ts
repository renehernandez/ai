import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  array,
  assertArtifact,
  github,
  object,
} from "./paseo-github-feedback.ts";

export type RecordValue = Record<string, unknown>;
export type ProbeOptions = {
  artifactUrl: string;
  head: string;
  reviewer: "genie" | "nitro";
  botLogin: string;
  classification?: "standard" | "removal-only";
};
export type Command = (
  program: string,
  args: string[],
  input?: string,
) => string;
export type ProbeResult = {
  status: "waiting" | "completed" | "awaiting-user" | "failed";
  head: string;
  artifactUrl: string;
  reviewer: "genie" | "nitro";
  ready: boolean;
  evidence: string;
  findings: RecordValue[];
};

const command: Command = (program, args, input) => {
  const result = spawnSync(program, args, {
    encoding: "utf8",
    input,
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  // gh pr checks deliberately uses nonzero exit codes for pending/failed CI.
  const checks = program === "gh" && args[0] === "pr" && args[1] === "checks";
  if (
    result.error ||
    (result.status !== 0 && !(checks && [1, 8].includes(result.status ?? -1)))
  ) {
    throw new Error(
      `Read-only command failed: ${program} ${args.slice(0, 2).join(" ")}; ${result.error?.message ?? result.stderr}`,
    );
  }
  return result.stdout;
};

/** One read-only snapshot. `completed` means collected, never semantically approved. */
export function probeHosted(
  options: ProbeOptions,
  run: Command = command,
): ProbeResult {
  const result: ProbeResult = {
    status: "awaiting-user",
    head: options.head,
    artifactUrl: options.artifactUrl,
    reviewer: options.reviewer,
    ready: false,
    evidence: "",
    findings: [],
  };
  try {
    if (!/^[a-f0-9]{40,64}$/.test(options.head) || !options.botLogin)
      throw new Error("Explicit full head and policy bot login required");
    const url = new URL(options.artifactUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error("Invalid artifact URL");
    if (options.reviewer === "genie") github(options, url, run, result);
    else if (options.reviewer === "nitro") gitlab(options, url, run, result);
    else throw new Error("Unknown reviewer policy");
  } catch (error) {
    result.status = "awaiting-user";
    result.evidence = error instanceof Error ? error.message : String(error);
  }
  result.findings = result.findings.map((finding, index) => ({
    id: `${finding.kind}:${finding.id ?? index}:${index}`,
    evidence: JSON.stringify(finding),
  }));
  return result;
}

function gitlab(
  options: ProbeOptions,
  url: URL,
  run: Command,
  result: ProbeResult,
): void {
  const match = url.pathname.match(/^\/(.+)\/-\/merge_requests\/(\d+)\/?$/);
  if (
    !match ||
    url.hostname !== "git.fullscript.io" ||
    options.botLogin !== "nitro"
  )
    throw new Error(
      "Nitro requires explicit Fullscript GitLab policy and exact nitro identity",
    );
  const project = encodeURIComponent(match[1]);
  const endpoint = `projects/${project}/merge_requests/${match[2]}`;
  const api = (path: string) =>
    object(JSON.parse(run("glab", ["api", "--hostname", url.hostname, path])));
  const collectorPath = fileURLToPath(
    new URL(
      "../../nitro-review-feedback/scripts/gitlab-evidence-collect.ts",
      import.meta.url,
    ),
  );
  const pages = (path: string) => {
    const collected: {
      page: number;
      next_page: string;
      items: RecordValue[];
    }[] = [];
    for (let page = 1; page <= 1000; page++) {
      const rawPage = run("glab", [
        "api",
        "--hostname",
        url.hostname,
        "--include",
        `${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`,
      ]);
      const response = object(
        JSON.parse(
          run(
            process.execPath,
            [...process.execArgv, collectorPath, "--parse-page"],
            rawPage,
          ),
        ),
      );
      if (
        response.page !== page ||
        typeof response.next_page !== "string" ||
        !["", String(page + 1)].includes(response.next_page)
      )
        throw new Error("Incomplete GitLab pagination");
      collected.push({
        page,
        next_page: response.next_page,
        items: array(response.items),
      });
      if (!response.next_page) return collected;
    }
    throw new Error("GitLab pagination limit exceeded");
  };
  const mr = api(endpoint);
  assertArtifact(mr.sha, mr.draft, mr.state === "opened", options, result);
  const notePages = pages(`${endpoint}/notes`);
  const discussionPages = pages(`${endpoint}/discussions`);
  const versionPages = pages(`${endpoint}/versions`);
  const raw = {
    context: {
      artifact_lifecycle: "final_implementation",
      artifact_classification: options.classification ?? "standard",
    },
    mr,
    note_pages: notePages,
    discussion_pages: discussionPages,
    version_pages: versionPages,
  };
  const gatePath = fileURLToPath(
    new URL(
      "../../nitro-review-feedback/scripts/nitro-feedback-gate.ts",
      import.meta.url,
    ),
  );
  const receipt = object(
    JSON.parse(
      run(
        process.execPath,
        [...process.execArgv, gatePath, "validate-gitlab-evidence"],
        JSON.stringify(raw),
      ),
    ),
  );
  const ci: RecordValue[] = [];
  const seen = new Set<string>();
  const pipeline = (projectId: string | number, id: number): void => {
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !projectId ||
      projectId === "undefined"
    )
      throw new Error("Incomplete pipeline graph identity");
    const key = `${projectId}/${id}`;
    if (seen.has(key)) return;
    if (seen.size > 100) throw new Error("Pipeline graph limit exceeded");
    seen.add(key);
    const path = `projects/${projectId}/pipelines/${id}`;
    const info = api(path);
    ci.push({ kind: "pipeline", ...info });
    ci.push(
      ...pages(`${path}/jobs`)
        .flatMap((page) => page.items)
        .map((job) => ({ kind: "job", ...job })),
    );
    for (const bridge of pages(`${path}/bridges`).flatMap(
      (page) => page.items,
    )) {
      ci.push({ kind: "bridge", ...bridge });
      if (bridge.downstream_pipeline)
        pipeline(
          String(object(bridge.downstream_pipeline).project_id),
          Number(object(bridge.downstream_pipeline).id),
        );
    }
  };
  if (!mr.head_pipeline || object(mr.head_pipeline).sha !== options.head)
    throw new Error(
      "No exact-head GitLab pipeline; CI policy needs human disposition",
    );
  pipeline(project, Number(object(mr.head_pipeline).id));
  const final = api(endpoint);
  assertArtifact(
    final.sha,
    final.draft,
    final.state === "opened",
    options,
    result,
  );
  if (object(final.head_pipeline).id !== object(mr.head_pipeline).id)
    throw new Error("Pipeline changed during snapshot");
  const notes = notePages.flatMap((page) => page.items);
  result.findings = notes
    .filter((note) => object(note.author).username === "nitro")
    .map((note) => ({
      kind: "review-feedback",
      ...note,
      semanticTriageRequired: true,
    }));
  result.findings.push(
    ...discussionPages
      .flatMap((page) => page.items)
      .filter((discussion) =>
        array(discussion.notes).some(
          (note) => object(note.author).username === "nitro",
        ),
      )
      .map((discussion) => ({
        kind: "review-thread",
        ...discussion,
        semanticTriageRequired: true,
      })),
  );
  result.findings.push(
    ...ci.filter(
      (entry) =>
        entry.allow_failure !== true &&
        ["failed", "canceled"].includes(String(entry.status)),
    ),
  );
  const required = ci.filter((entry) => entry.allow_failure !== true);
  if (
    required.some(
      (entry) =>
        ![
          "success",
          "failed",
          "canceled",
          "created",
          "waiting_for_resource",
          "preparing",
          "pending",
          "running",
          "scheduled",
        ].includes(String(entry.status)),
    )
  )
    throw new Error(
      "Manual, skipped, or unknown GitLab CI state needs policy disposition",
    );
  result.status =
    !receipt.completion_received ||
    required.some((entry) =>
      [
        "created",
        "waiting_for_resource",
        "preparing",
        "pending",
        "running",
        "scheduled",
      ].includes(String(entry.status)),
    )
      ? "waiting"
      : "completed";
  result.evidence = JSON.stringify({
    raw,
    receipt,
    ci,
    paginationComplete: true,
    meaning: "Full raw feedback for semantic triage; not merge readiness",
  });
}

function main(): void {
  const { values } = parseArgs({
    options: {
      "artifact-url": { type: "string" },
      head: { type: "string" },
      reviewer: { type: "string" },
      "bot-login": { type: "string" },
      classification: { type: "string" },
    },
    strict: true,
  });
  if (
    !values["artifact-url"] ||
    !values.head ||
    !["genie", "nitro"].includes(values.reviewer ?? "") ||
    !values["bot-login"] ||
    (values.classification &&
      !["standard", "removal-only"].includes(values.classification))
  )
    throw new Error(
      "Required: --artifact-url URL --head SHA --reviewer genie|nitro --bot-login POLICY_LOGIN [--classification standard|removal-only]",
    );
  process.stdout.write(
    `${JSON.stringify(probeHosted({ artifactUrl: values["artifact-url"], head: values.head, reviewer: values.reviewer as ProbeOptions["reviewer"], botLogin: values["bot-login"], classification: values.classification as ProbeOptions["classification"] }))}\n`,
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main();
