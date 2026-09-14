// charter-contracts: pi-paseo-hosted
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
  type Command,
  type ProbeOptions,
  probeHosted,
} from "../../skills/finish/scripts/paseo-hosted-probe.ts";

const head = "a".repeat(40);
const options: ProbeOptions = {
  artifactUrl: "https://github.com/owner/repo/pull/1",
  head,
  reviewer: "genie",
  botLogin: "configured-genie[bot]",
};
const bot = { login: options.botLogin, type: "Bot", id: 22 };

function github(
  overrides: {
    completion?: boolean;
    stale?: boolean;
    partial?: boolean;
    pending?: boolean;
    human?: boolean;
    checks?: unknown[] | string;
  } = {},
): Command {
  let reads = 0;
  return (program, args) => {
    assert.equal(program, "gh");
    assert.ok(!args.includes("--method"));
    if (args[0] === "pr")
      if (overrides.checks !== undefined)
        return typeof overrides.checks === "string"
          ? overrides.checks
          : JSON.stringify(overrides.checks);
    if (args[0] === "pr")
      return JSON.stringify([
        { name: "unit", bucket: overrides.pending ? "pending" : "pass" },
      ]);
    const path = args.at(-1) ?? "";
    if (path.endsWith("pulls/1"))
      return JSON.stringify({
        head: { sha: overrides.stale && reads++ > 0 ? "b".repeat(40) : head },
        draft: false,
        state: "open",
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

test("RED pi-paseo-hosted: an empty required CI set needs explicit nonblank disposition", () => {
  for (const noRequiredCiEvidence of [undefined, "", "  \n "]) {
    const result = probeHosted(
      { ...options, noRequiredCiEvidence },
      github({ checks: [] }),
    );
    assert.equal(result.status, "awaiting-user");
    assert.match(result.evidence, /Empty required CI set/);
  }
});

test("GREEN pi-paseo-hosted: explicit no-CI disposition is retained for an empty required set", () => {
  const noRequiredCiEvidence =
    "Project policy explicitly requires no hosted CI for this artifact";
  const result = probeHosted(
    { ...options, noRequiredCiEvidence },
    github({ checks: [] }),
  );
  assert.equal(result.status, "completed");
  assert.equal(
    JSON.parse(result.evidence).noRequiredCiEvidence,
    noRequiredCiEvidence,
  );
  assert.equal(
    probeHosted(
      { ...options, noRequiredCiEvidence },
      github({ checks: [], completion: false }),
    ).status,
    "waiting",
  );
});

test("RED pi-paseo-hosted: no-CI disposition cannot hide failures, pending CI, or unavailable evidence", () => {
  const disposition = {
    ...options,
    noRequiredCiEvidence: "Explicit project no-CI disposition",
  };
  const failed = probeHosted(
    disposition,
    github({ checks: [{ name: "unit", bucket: "fail" }] }),
  );
  // Completed denotes collection for repair, never successful CI.
  assert.equal(failed.status, "completed");
  assert.ok(
    failed.findings.some(
      (finding) => JSON.parse(String(finding.evidence)).kind === "ci",
    ),
  );
  assert.equal(JSON.parse(failed.evidence).requiredCi[0].bucket, "fail");
  assert.equal(JSON.parse(failed.evidence).noRequiredCiEvidence, undefined);
  assert.equal(
    probeHosted(disposition, github({ pending: true })).status,
    "waiting",
  );
  assert.equal(
    probeHosted(disposition, github({ checks: [{ bucket: "unknown" }] }))
      .status,
    "awaiting-user",
  );
  assert.equal(
    probeHosted(disposition, github({ checks: "" })).status,
    "awaiting-user",
  );
});

test("partial GraphQL, changed source, and unverified bot fail closed", () => {
  for (const override of [{ partial: true }, { stale: true }, { human: true }])
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
    reviewer: "nitro",
    botLogin: "nitro",
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
    reviewer: "nitro",
    botLogin: "nitro",
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
