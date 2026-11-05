// charter-contracts: pi-paseo-hosted
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  type Command,
  type ProbeOptions,
  probeHosted,
} from "../../skills/finish/scripts/paseo-hosted-probe.ts";

const head = "a".repeat(40);
const options: ProbeOptions = {
  artifactUrl: "https://github.com/owner/repo/pull/1",
  head,
  ciPolicy: "required",
  reviewer: "genie",
  botLogin: "configured-genie[bot]",
  policyEvidence: "fixture policy",
};
const bot = { login: options.botLogin, type: "Bot", id: 22 };

function github(
  overrides: {
    completion?: boolean;
    stale?: boolean;
    draft?: boolean;
    closed?: boolean;
    partial?: boolean;
    pending?: boolean;
    human?: boolean;
    checkRuns?: unknown[] | string;
    statuses?: unknown[] | string;
  } = {},
): Command {
  let reads = 0;
  return (program, args) => {
    assert.equal(program, "gh");
    assert.ok(!args.includes("--method"));
    const path = args.at(-1) ?? "";
    if (path.includes("/check-runs?")) {
      if (typeof overrides.checkRuns === "string") return overrides.checkRuns;
      const checkRuns = overrides.checkRuns ?? [
        {
          id: 10,
          name: "unit",
          head_sha: head,
          status: overrides.pending ? "in_progress" : "completed",
          conclusion: overrides.pending ? null : "success",
          details_url: "https://github.com/owner/repo/actions/runs/10",
        },
        {
          id: 11,
          name: "integration",
          head_sha: head,
          status: "completed",
          conclusion: "success",
          details_url: "https://github.com/owner/repo/actions/runs/11",
        },
      ];
      return JSON.stringify([
        { total_count: checkRuns.length, check_runs: checkRuns },
      ]);
    }
    if (path.includes("/statuses?")) {
      if (typeof overrides.statuses === "string") return overrides.statuses;
      return JSON.stringify([overrides.statuses ?? []]);
    }
    if (path.endsWith("pulls/1"))
      return JSON.stringify({
        head: { sha: overrides.stale && reads++ > 0 ? "b".repeat(40) : head },
        draft: overrides.draft ?? false,
        state: overrides.closed ? "closed" : "open",
      });
    if (path.startsWith("users/"))
      return JSON.stringify({ ...bot, type: overrides.human ? "User" : "Bot" });
    if (path.includes("/reviews?"))
      return JSON.stringify([
        [
          {
            id: 1,
            body: `<!-- genie-run:123 -->\n\n## Genie review\n\nA defect needs semantic assessment\n\nReviewed \`${head}\` · production`,
            user: bot,
            commit_id: overrides.completion === false ? "b".repeat(40) : head,
            state: "COMMENTED",
            submitted_at: "2026-09-14T12:00:00Z",
          },
        ],
      ]);
    if (path.includes("/comments?")) return JSON.stringify([[], []]);
    if (args.includes("graphql")) {
      if (overrides.partial)
        return JSON.stringify({ data: {}, errors: [{ message: "partial" }] });
      if (args.some((arg) => arg.startsWith("id="))) {
        const second = args.includes("cursor=next");
        return JSON.stringify({
          data: {
            node: {
              comments: {
                nodes: [
                  {
                    id: second ? "c2" : "c1",
                    body: "Finding",
                    author: { login: options.botLogin },
                  },
                ],
                pageInfo: {
                  hasNextPage: !second,
                  endCursor: second ? null : "next",
                },
              },
            },
          },
        });
      }
      return JSON.stringify({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [{ id: "thread", isResolved: false }],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          },
        },
      });
    }
    throw new Error(`Unexpected command ${args.join(" ")}`);
  };
}

test("GREEN pi-paseo-hosted: collects complete exact-head feedback for semantic triage", () => {
  const result = probeHosted(options, github());
  assert.equal(result.status, "completed");
  assert.equal(result.ready, true);
  assert.match(result.evidence, /c2/);
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.every((finding) => finding.id && finding.evidence));
});

test("GREEN pi-paseo-hosted: direct symlink invocation runs while import stays inert", () => {
  const directory = mkdtempSync(join(tmpdir(), "paseo-hosted-probe-"));
  const source = resolve("skills/finish/scripts/paseo-hosted-probe.ts");
  const link = join(directory, "paseo-hosted-probe.ts");
  try {
    symlinkSync(source, link);
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        link,
        "--artifact-url",
        "https://example.com/owner/repo/pull/1",
        "--head",
        head,
        "--ci-policy",
        "not-required",
        "--reviewer",
        "none",
        "--policy-evidence",
        "fixture policy",
      ],
      { encoding: "utf8" },
    );
    assert.equal(JSON.parse(output).status, "awaiting-user");
    assert.equal(
      execFileSync(
        process.execPath,
        [
          "--import",
          "tsx",
          "--eval",
          `import(${JSON.stringify(pathToFileURL(source).href)})`,
        ],
        { encoding: "utf8" },
      ),
      "",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("RED pi-paseo-hosted: stale bot review and pending required CI cannot complete", () => {
  assert.equal(
    probeHosted(options, github({ completion: false })).status,
    "waiting",
  );
  assert.equal(
    probeHosted(options, github({ pending: true })).status,
    "waiting",
  );
});

test("GREEN pi-paseo-hosted: all CI and reviewer policy combinations stay independent", () => {
  for (const ciPolicy of ["required", "not-required"] as const)
    for (const reviewer of ["genie", undefined] as const) {
      const result = probeHosted(
        {
          ...options,
          ciPolicy,
          reviewer,
          botLogin: reviewer ? options.botLogin : undefined,
        },
        github(),
      );
      assert.equal(result.status, "completed");
      assert.equal(JSON.parse(result.evidence).ciPolicy, ciPolicy);
    }
});

test("GREEN pi-paseo-hosted: commit-addressed CI consumes every page and requests latest check attempts", () => {
  const base = github();
  const calls: string[][] = [];
  const result = probeHosted(options, (program, args, input) => {
    calls.push(args);
    const path = args.at(-1) ?? "";
    if (path.includes("/check-runs?"))
      return JSON.stringify([
        {
          total_count: 2,
          check_runs: [
            {
              id: 10,
              name: "unit",
              head_sha: head,
              status: "completed",
              conclusion: "success",
            },
          ],
        },
        {
          total_count: 2,
          check_runs: [
            {
              id: 11,
              name: "integration",
              head_sha: head,
              status: "completed",
              conclusion: "success",
            },
          ],
        },
      ]);
    return base(program, args, input);
  });
  assert.equal(result.status, "completed");
  assert.ok(
    calls.some(
      (args) =>
        args.includes("--paginate") &&
        args.at(-1)?.includes("check-runs?filter=latest&per_page=100"),
    ),
  );
});

test("GREEN pi-paseo-hosted: commit-addressed CI keeps only the latest status context", () => {
  const result = probeHosted(
    options,
    github({
      statuses: [
        {
          id: 2,
          sha: head,
          context: "deploy",
          state: "success",
          target_url: "https://example.com/status/2",
        },
        {
          id: 1,
          sha: head,
          context: "deploy",
          state: "failure",
          target_url: "https://example.com/status/1",
        },
      ],
    }),
  );
  assert.equal(result.status, "completed");
  assert.doesNotMatch(result.evidence, /status\/1/);
  assert.match(result.evidence, /status\/2/);
});

test("GREEN pi-paseo-hosted: a not-required reviewer is never queried", () => {
  const calls: string[][] = [];
  const result = probeHosted(
    {
      ...options,
      ciPolicy: "not-required",
      reviewer: undefined,
      botLogin: undefined,
    },
    (program, args, input) => {
      calls.push(args);
      return github()(program, args, input);
    },
  );
  assert.equal(result.status, "completed");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((args) => args.at(-1)?.endsWith("pulls/1")));
});

test("RED pi-paseo-hosted: required CI rejects empty, skipped, unknown, or malformed evidence", () => {
  for (const checkRuns of [
    [],
    [
      {
        id: 10,
        name: "unit",
        head_sha: head,
        status: "completed",
        conclusion: "skipped",
      },
    ],
    [
      {
        id: 10,
        name: "unit",
        head_sha: head,
        status: "completed",
        conclusion: "mystery",
      },
    ],
  ])
    assert.equal(
      probeHosted(options, github({ checkRuns })).status,
      "awaiting-user",
    );
  assert.equal(
    probeHosted(options, github({ checkRuns: "not-json" })).status,
    "awaiting-user",
  );
});

test("GREEN pi-paseo-hosted: failed and cancelled CI produce actionable findings", () => {
  const checkRuns = [
    {
      id: 10,
      name: "unit",
      head_sha: head,
      status: "completed",
      conclusion: "failure",
      details_url: "https://example.com/check/10",
    },
    {
      id: 11,
      name: "integration",
      head_sha: head,
      status: "completed",
      conclusion: "cancelled",
      details_url: "https://example.com/check/11",
    },
  ];
  const result = probeHosted(options, github({ checkRuns }));
  assert.equal(result.status, "completed");
  assert.equal(result.findings.length, 4);
  assert.match(result.findings[2].evidence as string, /unit/);
  assert.match(result.findings[3].evidence as string, /integration/);
});

test("partial GraphQL, changed source, draft, closed, and unverified bot fail closed", () => {
  for (const override of [
    { partial: true },
    { stale: true },
    { draft: true },
    { closed: true },
    { human: true },
  ])
    assert.equal(
      probeHosted(options, github(override)).status,
      "awaiting-user",
    );
});

test("requires explicit reviewer bot identity and restricts Nitro policy host", () => {
  const noCall: Command = () => {
    throw new Error("Must not invoke provider");
  };
  assert.equal(
    probeHosted({ ...options, botLogin: "" }, noCall).status,
    "awaiting-user",
  );
  assert.equal(
    probeHosted({ ...options, reviewer: "nitro", botLogin: "nitro" }, noCall)
      .status,
    "awaiting-user",
  );
});

test("Nitro delegates chronology to canonical evidence validator and retrieves all CI graph pages", () => {
  const calls: string[] = [];
  const nitro: ProbeOptions = {
    artifactUrl: "https://git.fullscript.io/team/repo/-/merge_requests/1",
    head,
    ciPolicy: "required",
    reviewer: "nitro",
    botLogin: "nitro",
    policyEvidence: "Fullscript work policy",
  };
  const run: Command = (program, args, input) => {
    if (program !== "glab") {
      if (args.includes("--parse-page")) {
        assert.ok(
          args.some((arg) => arg.endsWith("gitlab-evidence-collect.ts")),
        );
        return execFileSync(program, args, {
          input,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      }
      assert.ok(args.some((arg) => arg.endsWith("nitro-feedback-gate.ts")));
      assert.ok(args.includes("validate-gitlab-evidence"));
      const raw = JSON.parse(input ?? "");
      assert.equal(raw.note_pages.length, 2);
      assert.equal(raw.mr.sha, head);
      return JSON.stringify({ completion_received: true });
    }
    const path = args.at(-1) ?? "";
    calls.push(path);
    if (path.endsWith("merge_requests/1"))
      return JSON.stringify({
        sha: head,
        draft: false,
        state: "opened",
        head_pipeline: { id: 2, sha: head },
      });
    if (path.endsWith("pipelines/2"))
      return JSON.stringify({ id: 2, status: "success" });
    const second = path.endsWith("page=2");
    const notes = path.includes("/notes?");
    const items = notes
      ? [
          {
            id: second ? 2 : 1,
            body: "Complete review text",
            author: { username: "nitro" },
          },
        ]
      : [];
    return `HTTP/2 200\nx-page: ${second ? 2 : 1}\nx-next-page: ${notes && !second ? "2" : ""}\n\n${JSON.stringify(items)}`;
  };
  const result = probeHosted(nitro, run);
  assert.equal(result.status, "completed");
  assert.equal(result.findings.length, 2);
  assert.ok(calls.some((call) => call.includes("/bridges?")));
});

test("rejects truncated GitLab pagination", () => {
  const nitro: ProbeOptions = {
    artifactUrl: "https://git.fullscript.io/team/repo/-/merge_requests/1",
    head,
    ciPolicy: "required",
    reviewer: "nitro",
    botLogin: "nitro",
    policyEvidence: "Fullscript work policy",
  };
  const result = probeHosted(nitro, (program, args, input) =>
    args.includes("--parse-page")
      ? execFileSync(program, args, {
          input,
          encoding: "utf8",
          stdio: ["pipe", "pipe", "pipe"],
        })
      : args.includes("--include")
        ? "HTTP/2 200\n\n[]"
        : JSON.stringify({ sha: head, draft: false, state: "opened" }),
  );
  assert.equal(result.status, "awaiting-user");
  assert.match(result.evidence, /pagination/);
});
