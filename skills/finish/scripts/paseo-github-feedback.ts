import type {
  Command,
  ProbeOptions,
  ProbeResult,
  RecordValue,
} from "./paseo-hosted-probe.ts";

export function object(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Incomplete provider object");
  return value as RecordValue;
}
export function array(value: unknown): RecordValue[] {
  if (!Array.isArray(value)) throw new Error("Incomplete provider collection");
  return value.map(object);
}
function nested(value: unknown, ...keys: string[]): RecordValue {
  for (const key of keys) value = object(value)[key];
  return object(value);
}

export function github(
  options: ProbeOptions,
  url: URL,
  run: Command,
  result: ProbeResult,
): void {
  const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
  if (!match) throw new Error("Expected GitHub PR URL");
  const [, owner, repo, number] = match;
  const endpoint = `repos/${owner}/${repo}`;
  const api = (path: string) =>
    object(JSON.parse(run("gh", ["api", "--hostname", url.hostname, path])));
  const pages = (path: string): RecordValue[] => {
    const values = JSON.parse(
      run("gh", [
        "api",
        "--hostname",
        url.hostname,
        "--paginate",
        "--slurp",
        path,
      ]),
    );
    if (!Array.isArray(values) || !values.length)
      throw new Error("Missing GitHub pagination evidence");
    return values.flatMap(array);
  };
  const pr = api(`${endpoint}/pulls/${number}`);
  assertArtifact(
    object(pr.head).sha,
    pr.draft,
    pr.state === "open",
    options,
    result,
  );
  let completion = options.reviewer === undefined;
  let reviews: RecordValue[] = [];
  let comments: RecordValue[] = [];
  let inline: RecordValue[] = [];
  let threads: RecordValue[] = [];
  if (options.reviewer === "genie") {
    const bot = api(`users/${encodeURIComponent(options.botLogin ?? "")}`);
    if (
      bot.login !== options.botLogin ||
      bot.type !== "Bot" ||
      !Number.isSafeInteger(bot.id) ||
      Number(bot.id) < 1
    )
      throw new Error("Policy reviewer is not a verified GitHub Bot identity");
    reviews = pages(`${endpoint}/pulls/${number}/reviews?per_page=100`);
    comments = pages(`${endpoint}/issues/${number}/comments?per_page=100`);
    inline = pages(`${endpoint}/pulls/${number}/comments?per_page=100`);
    threads = githubThreads(owner, repo, Number(number), url.hostname, run);
    const botItems = [...reviews, ...comments, ...inline].filter(
      (entry) => object(entry.user).login === options.botLogin,
    );
    if (
      botItems.some(
        (entry) =>
          object(entry.user).id !== bot.id || typeof entry.body !== "string",
      )
    )
      throw new Error("Incomplete or mismatched bot evidence");
    result.findings = botItems.map((entry) => ({
      ...entry,
      kind: "review-feedback",
      semanticTriageRequired: true,
    }));
    result.findings.push(
      ...threads
        .filter((thread) =>
          array(thread.comments).some(
            (entry) => object(entry.author).login === options.botLogin,
          ),
        )
        .map((thread) => ({
          kind: "review-thread",
          ...thread,
          semanticTriageRequired: true,
        })),
    );
    completion = reviews.some(
      (review) =>
        object(review.user).id === bot.id &&
        review.commit_id === options.head &&
        Number.isFinite(Date.parse(String(review.submitted_at))) &&
        review.state === "COMMENTED" &&
        typeof review.body === "string" &&
        /<!-- genie-run:[^\s<>]+ -->/.test(review.body) &&
        review.body.includes("## Genie review\n") &&
        review.body.includes(`Reviewed \`${options.head}\` ·`),
    );
  }
  let ci: RecordValue[] = [];
  if (options.ciPolicy === "required") {
    const checkPages = JSON.parse(
      run("gh", [
        "api",
        "--hostname",
        url.hostname,
        "--paginate",
        "--slurp",
        `${endpoint}/commits/${options.head}/check-runs?filter=latest&per_page=100`,
      ]),
    );
    if (!Array.isArray(checkPages) || !checkPages.length)
      throw new Error("Missing GitHub check-run pagination evidence");
    const checkRuns = checkPages.flatMap((page) => {
      const value = object(page);
      if (!Number.isSafeInteger(value.total_count))
        throw new Error("Incomplete GitHub check-run count");
      return array(value.check_runs);
    });
    if (
      checkPages.some((page) => object(page).total_count !== checkRuns.length)
    )
      throw new Error("Incomplete GitHub check-run pagination");
    const statuses = pages(
      `${endpoint}/commits/${options.head}/statuses?per_page=100`,
    );
    const contexts = new Map<string, RecordValue>();
    for (const status of statuses) {
      if (
        typeof status.context !== "string" ||
        !status.context ||
        status.sha !== options.head
      )
        throw new Error("Incomplete or mismatched GitHub status evidence");
      if (!contexts.has(status.context)) contexts.set(status.context, status);
    }
    for (const check of checkRuns) {
      if (
        !Number.isSafeInteger(check.id) ||
        typeof check.name !== "string" ||
        !check.name ||
        check.head_sha !== options.head ||
        !["queued", "in_progress", "completed"].includes(String(check.status))
      )
        throw new Error("Incomplete or mismatched GitHub check-run evidence");
      if (
        check.status === "completed" &&
        ![
          "success",
          "failure",
          "cancelled",
          "timed_out",
          "startup_failure",
          "action_required",
        ].includes(String(check.conclusion))
      )
        throw new Error(
          "Skipped, neutral, stale, or unknown GitHub check result needs policy disposition",
        );
    }
    for (const status of contexts.values())
      if (
        !["success", "pending", "failure", "error"].includes(
          String(status.state),
        )
      )
        throw new Error(
          "Unknown GitHub commit status needs policy disposition",
        );
    ci = [
      ...checkRuns.map((check) => ({
        kind: "check-run",
        ...check,
        link: check.details_url ?? check.html_url ?? check.url ?? null,
      })),
      ...Array.from(contexts.values(), (status) => ({
        kind: "status-context",
        ...status,
        link: status.target_url ?? status.url ?? null,
      })),
    ];
    if (ci.length === 0)
      throw new Error("Required CI policy has no commit check evidence");
  }
  result.findings.push(
    ...ci.filter((entry) =>
      [
        "failure",
        "cancelled",
        "timed_out",
        "startup_failure",
        "action_required",
        "error",
      ].includes(String(entry.conclusion ?? entry.state)),
    ),
  );
  const final = api(`${endpoint}/pulls/${number}`);
  assertArtifact(
    object(final.head).sha,
    final.draft,
    final.state === "open",
    options,
    result,
  );
  result.status =
    !completion ||
    ci.some(
      (entry) =>
        ["queued", "in_progress", "pending"].includes(String(entry.status)) ||
        entry.state === "pending",
    )
      ? "waiting"
      : "completed";
  result.evidence = JSON.stringify({
    head: options.head,
    policyEvidence: options.policyEvidence,
    ciPolicy: options.ciPolicy,
    reviewer: options.reviewer ?? "not-required",
    bot: options.botLogin ?? null,
    completionReceived: completion,
    requiredCi: ci,
    reviews,
    comments,
    inline,
    threads,
    paginationComplete: true,
    meaning: "Full raw feedback for semantic triage; not merge readiness",
  });
}

function githubThreads(
  owner: string,
  repo: string,
  number: number,
  hostname: string,
  run: Command,
): RecordValue[] {
  const query = (
    document: string,
    cursor?: string,
    id?: string,
  ): RecordValue => {
    const args = [
      "api",
      "--hostname",
      hostname,
      "graphql",
      "-f",
      `query=${document}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `repo=${repo}`,
      "-F",
      `number=${number}`,
    ];
    if (cursor) args.push("-f", `cursor=${cursor}`);
    if (id) args.push("-f", `id=${id}`);
    const reply = object(JSON.parse(run("gh", args)));
    if (reply.errors) throw new Error("Partial GitHub GraphQL evidence");
    return object(reply.data);
  };
  const collect = (get: (cursor?: string) => RecordValue): RecordValue[] => {
    const items: RecordValue[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 1000; page++) {
      const connection = get(cursor);
      items.push(...array(connection.nodes));
      const info = object(connection.pageInfo);
      if (info.hasNextPage === false) return items;
      if (
        info.hasNextPage !== true ||
        typeof info.endCursor !== "string" ||
        seen.has(info.endCursor)
      )
        throw new Error("Incomplete GitHub thread pagination");
      cursor = info.endCursor;
      seen.add(cursor);
    }
    throw new Error("GitHub thread pagination limit exceeded");
  };
  const threads = collect((cursor) =>
    nested(
      query(
        "query($owner:String!,$repo:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{id isResolved isOutdated path line originalLine} pageInfo{hasNextPage endCursor}}}}}",
        cursor,
      ),
      "repository",
      "pullRequest",
      "reviewThreads",
    ),
  );
  for (const thread of threads) {
    thread.comments = collect((cursor) =>
      nested(
        query(
          "query($id:ID!,$cursor:String){node(id:$id){... on PullRequestReviewThread{comments(first:100,after:$cursor){nodes{id url body createdAt updatedAt author{login} replyTo{id} originalCommit{oid} commit{oid}} pageInfo{hasNextPage endCursor}}}}}",
          cursor,
          String(thread.id),
        ),
        "node",
        "comments",
      ),
    );
  }
  return threads;
}

export function assertArtifact(
  head: unknown,
  draft: unknown,
  open: boolean,
  options: ProbeOptions,
  result: ProbeResult,
): void {
  result.ready = draft === false;
  if (head !== options.head || draft !== false || !open)
    throw new Error(
      "Artifact must remain open, Ready, and at the expected source head",
    );
}
