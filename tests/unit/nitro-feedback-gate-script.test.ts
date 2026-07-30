// charter-contracts: nitro-raw-evidence
import assert from "node:assert/strict";
import test from "node:test";
import { parseIncludedJsonPage } from "../../skills/nitro-review-feedback/scripts/gitlab-evidence-collect.ts";
import { runNitroGate } from "../../skills/nitro-review-feedback/scripts/nitro-feedback-gate-runner.ts";

test("GitLab evidence collection preserves terminal pagination headers", () => {
  assert.deepEqual(
    parseIncludedJsonPage(
      'HTTP/2 200 OK\r\nX-Page: 1\r\nX-Next-Page: \r\n\r\n[{"id":1}]',
    ),
    {
      page: 1,
      next_page: "",
      items: [{ id: 1 }],
    },
  );
});

test("GitLab evidence collection distinguishes an empty header block", () => {
  assert.throws(
    () => parseIncludedJsonPage("[]"),
    /gitlab_evidence_response_headers_missing/,
  );
  assert.throws(
    () => parseIncludedJsonPage("\r\n\r\n[]"),
    /gitlab_evidence_pagination_headers_invalid/,
  );
});

const cleanGate = `nitro_feedback_gate:
  artifact: https://git.fullscript.io/group/project/-/merge_requests/1
  artifact_lifecycle: final_implementation
  artifact_classification: standard
  classification_evidence:
    - final delivery checkpoint for MR !1
  head:
    sha: abc123
    evidence:
      - MR API readback abc123
  effective_diff:
    head_sha: abc123
    files: 12
    evidence:
      - MR changes API reports 12 files at abc123
  request:
    required: true
    note_id: 123
    note_url: https://git.fullscript.io/group/project/-/merge_requests/1#note_123
    author: reviewer
    body: /request_review @nitro
    observed_head_sha: abc123
    evidence:
      - provider note 123 and post-note MR head abc123
  start:
    status: started
    timeout_minutes: 10
    poll_interval_minutes: 1
    evidence:
      - Nitro acknowledged latest-head review
  completion:
    status: clean
    head_sha: abc123
    author: nitro
    note_id: 124
    note_url: https://git.fullscript.io/group/project/-/merge_requests/1#note_124
    evidence:
      - Nitro completed latest-head review with no issues
  unresolved_actionable_feedback: []
  non_actionable_feedback: []
  stale_feedback_ignored: []
  gate_outcome: passed
`;

function providerObservation(
  overrides: Partial<{
    lifecycle: string;
    classification: string;
    fileCount: number;
    headSha: string;
    effectiveDiffHeadSha: string;
    requestBody: string;
    requestObservedHeadSha: string;
    status: string;
    completionHeadSha: string;
    unresolved: string;
  }> = {},
): string {
  const lifecycle = overrides.lifecycle ?? "final_implementation";
  const classification = overrides.classification ?? "standard";
  const fileCount = overrides.fileCount ?? 12;
  const headSha = overrides.headSha ?? "abc123";
  const effectiveDiffHeadSha = overrides.effectiveDiffHeadSha ?? headSha;
  const requestBody = overrides.requestBody ?? "/request_review @nitro";
  const requestObservedHeadSha = overrides.requestObservedHeadSha ?? headSha;
  const status = overrides.status ?? "no issues";
  const completionHeadSha = overrides.completionHeadSha ?? headSha;
  const unresolved = overrides.unresolved ?? "[]";
  return `artifact: https://git.fullscript.io/group/project/-/merge_requests/1
head_sha: ${headSha}
artifact_lifecycle: ${lifecycle}
artifact_classification: ${classification}
classification_evidence:
  - accepted ${lifecycle} checkpoint
head_evidence:
  - MR API readback ${headSha}
effective_diff_head_sha: ${effectiveDiffHeadSha}
effective_diff_files: ${fileCount}
effective_diff_evidence:
  - MR changes API reports ${fileCount} files at ${effectiveDiffHeadSha}
request_note_id: 123
request_note_url: https://git.fullscript.io/group/project/-/merge_requests/1#note_123
request_author: reviewer
request_body: ${requestBody}
request_observed_head_sha: ${requestObservedHeadSha}
request_evidence:
  - provider note 123 and post-note MR head ${requestObservedHeadSha}
status: ${status}
start_evidence:
  - Nitro acknowledgement note 124
completion_head_sha: ${completionHeadSha}
completion_author: nitro
completion_note_id: 125
completion_note_url: https://git.fullscript.io/group/project/-/merge_requests/1#note_125
completion_evidence:
  - Nitro provider response 125 for ${completionHeadSha}
unresolved_actionable_feedback: ${unresolved}
non_actionable_feedback: []
stale_feedback_ignored: []
`;
}

function rawGitLabEvidence(
  overrides: {
    changesCount?: number | "1000+";
    lifecycle?: "poc" | "final_implementation";
    classification?: "standard" | "poc" | "removal-only";
    laterPush?: boolean;
    completion?: boolean;
    unresolved?: boolean;
    completionAuthor?: string;
    completionBody?: string;
    paginationComplete?: boolean;
    requestAuthor?: string | null;
    headVersionCreatedAt?: string;
    laterCompletionBody?: string;
    nonResolvableNitroSummary?: boolean;
    noteLevelDiscussionStateOnly?: boolean;
  } = {},
): string {
  const lifecycle = overrides.lifecycle ?? "final_implementation";
  const classification = overrides.classification ?? "standard";
  const changesCount = overrides.changesCount ?? 12;
  const routingFileCount = changesCount === "1000+" ? 1_001 : changesCount;
  const largeCommentRequest =
    routingFileCount > 50 &&
    (lifecycle === "poc" || classification === "removal-only");
  const notes = [
    {
      id: 10,
      body: "added 1 commit",
      created_at: "2026-07-30T12:00:00Z",
      system: true,
      author: { username: "reviewer" },
    },
    {
      id: 11,
      body: largeCommentRequest
        ? "@nitro review"
        : "requested review from @nitro",
      created_at: "2026-07-30T12:01:00Z",
      system: !largeCommentRequest,
      author:
        overrides.requestAuthor === null
          ? undefined
          : { username: overrides.requestAuthor ?? "reviewer" },
    },
    {
      id: 12,
      body: "Nitro is preparing to review this merge request",
      created_at: "2026-07-30T12:01:01Z",
      system: false,
      author: { username: "nitro" },
    },
  ];
  if (overrides.laterPush) {
    notes.push({
      id: 13,
      body: "added 1 commit",
      created_at: "2026-07-30T12:02:00Z",
      system: true,
      author: { username: "reviewer" },
    });
  }
  if (overrides.completion !== false) {
    notes.push({
      id: 14,
      body:
        overrides.completionBody ?? "Reviewed the latest merge request head.",
      created_at: "2026-07-30T12:03:00Z",
      system: false,
      author: { username: overrides.completionAuthor ?? "nitro" },
    });
  }
  if (overrides.laterCompletionBody) {
    notes.push({
      id: 16,
      body: overrides.laterCompletionBody,
      created_at: "2026-07-30T12:04:00Z",
      system: false,
      author: { username: "nitro" },
    });
  }
  return JSON.stringify({
    context: {
      artifact_lifecycle: lifecycle,
      artifact_classification: classification,
    },
    mr: {
      web_url: "https://git.fullscript.io/group/project/-/merge_requests/1",
      sha: "abc123",
      changes_count: changesCount,
    },
    note_pages: [
      {
        page: 1,
        next_page: overrides.paginationComplete === false ? "2" : "",
        items: notes,
      },
    ],
    discussion_pages: [
      {
        page: 1,
        next_page: "",
        items: overrides.unresolved
          ? [
              {
                id: "discussion-1",
                individual_note: false,
                ...(overrides.noteLevelDiscussionStateOnly
                  ? {}
                  : { resolvable: true, resolved: false }),
                notes: [
                  {
                    id: 15,
                    body: "Actionable finding",
                    created_at: "2026-07-30T12:03:01Z",
                    resolvable: true,
                    resolved: false,
                    author: { username: "nitro" },
                  },
                ],
              },
            ]
          : overrides.nonResolvableNitroSummary
            ? [
                {
                  id: "summary-1",
                  individual_note: true,
                  resolvable: false,
                  notes: [
                    {
                      id: 9,
                      body: "Historical actionable summary",
                      created_at: "2026-07-30T11:59:00Z",
                      resolvable: false,
                      author: { username: "nitro" },
                    },
                  ],
                },
              ]
            : [],
      },
    ],
    version_pages: [
      {
        page: 1,
        next_page: "",
        items: [
          {
            id: 1,
            head_commit_sha: "abc123",
            created_at:
              overrides.headVersionCreatedAt ?? "2026-07-30T12:00:30Z",
          },
        ],
      },
    ],
  });
}

test("template emits a readable summary before YAML", () => {
  const result = runNitroGate("template");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /## Readable Summary/);
  assert.ok(
    result.stdout.indexOf("## Readable Summary") <
      result.stdout.indexOf("nitro_feedback_gate:"),
  );
  assert.match(
    result.stdout,
    /start:\n {4}status: started \| blocked \| pending/,
  );
});

test("validate accepts a clean latest-head gate", () => {
  const result = runNitroGate("validate", cleanGate);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nitro_feedback_gate valid/);
});

test("validate requires explicit Nitro request even when local gates passed", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "    required: true",
      "    required: false\n    local_commit_gate: passed",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /request\.required must be true/);
});

test("validate rejects generic request evidence without Nitro slash command", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "    body: /request_review @nitro",
      "    body: Nitro review requested for latest head",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /request\.body must equal \/request_review @nitro/,
  );
});

test("validate requires Nitro request after latest source-head push", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "    observed_head_sha: abc123",
      "    observed_head_sha: older123",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /request\.observed_head_sha must match head\.sha/,
  );
});

test("validate routes larger POCs through the comment command", () => {
  const result = runNitroGate(
    "validate",
    cleanGate
      .replace(
        "artifact_classification: standard",
        "artifact_classification: poc",
      )
      .replace(
        "artifact_lifecycle: final_implementation",
        "artifact_lifecycle: poc",
      )
      .replace("    files: 12", "    files: 75")
      .replace("reports 12 files", "reports 75 files")
      .replace("    body: /request_review @nitro", "    body: @nitro review"),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nitro_feedback_gate valid/);
});

test("validate routes larger removal-only MRs through the comment command", () => {
  const result = runNitroGate(
    "validate",
    cleanGate
      .replace(
        "artifact_classification: standard",
        "artifact_classification: removal-only",
      )
      .replace("    files: 12", "    files: 500")
      .replace("reports 12 files", "reports 500 files")
      .replace("    body: /request_review @nitro", "    body: @nitro review"),
  );

  assert.equal(result.status, 0);
});

test("validate rejects standard MRs above Nitro's file ceiling", () => {
  const result = runNitroGate(
    "validate",
    cleanGate
      .replace("    files: 12", "    files: 51")
      .replace("reports 12 files", "reports 51 files"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /standard_artifact_exceeds_nitro_file_ceiling/);
});

test("validate rejects the slash command for an eligible larger POC", () => {
  const result = runNitroGate(
    "validate",
    cleanGate
      .replace(
        "artifact_classification: standard",
        "artifact_classification: poc",
      )
      .replace(
        "artifact_lifecycle: final_implementation",
        "artifact_lifecycle: poc",
      )
      .replace("    files: 12", "    files: 75")
      .replace("reports 12 files", "reports 75 files"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /request\.body must equal @nitro review/);
});

test("validate rejects stale Nitro completion as passed latest-head gate", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace("    status: clean", "    status: stale"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gate_outcome passed requires/);
});

test("validate rejects local reviewer evidence as Nitro feedback gate", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "      - Nitro completed latest-head review with no issues",
      "      - local-reviewer gate passed locally for MR !1",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /completion\.evidence must cite Nitro hosted review evidence/,
  );
});

test("validate rejects passed gates with unresolved findings", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "  unresolved_actionable_feedback: []",
      "  unresolved_actionable_feedback:\n    - fix this",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /gate_outcome passed requires/);
});

test("normalize-feedback maps pending to a pending gate", () => {
  const result = runNitroGate(
    "normalize-feedback",
    providerObservation({
      status: "pending",
      completionHeadSha: "",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /completion:\n {4}status: pending/);
  assert.match(result.stdout, /gate_outcome: pending/);
});

test("normalize-feedback maps findings to a blocked gate", () => {
  const result = runNitroGate(
    "normalize-feedback",
    providerObservation({
      status: "findings",
      unresolved: "\n  - latest-head Nitro finding 1",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /completion:\n {4}status: findings/);
  assert.match(
    result.stdout,
    /unresolved_actionable_feedback:\n {4}- latest-head Nitro finding 1/,
  );
  assert.match(result.stdout, /gate_outcome: blocked/);
});

test("normalize-feedback preserves a larger POC request route", () => {
  const result = runNitroGate(
    "normalize-feedback",
    providerObservation({
      lifecycle: "poc",
      classification: "poc",
      fileCount: 75,
      requestBody: "@nitro review",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /artifact_classification: poc/);
  assert.match(result.stdout, /files: 75/);
  assert.match(result.stdout, /body: @nitro review/);
  assert.doesNotMatch(result.stdout, /artifact_classification: standard/);
});

test("normalize-feedback rejects missing latest-head request evidence", () => {
  const result = runNitroGate(
    "normalize-feedback",
    providerObservation({ requestObservedHeadSha: "older123" }),
  );

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /request\.observed_head_sha must match head\.sha/,
  );
});

test("normalize-feedback rejects fabricated diff and completion head claims", () => {
  const result = runNitroGate(
    "normalize-feedback",
    providerObservation({
      effectiveDiffHeadSha: "older123",
      completionHeadSha: "older123",
    }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /effective_diff\.head_sha must match head\.sha/);
  assert.match(result.stderr, /completion\.head_sha must match head\.sha/);
});

test("normalize-feedback does not synthesize hosted Nitro evidence", () => {
  const result = runNitroGate(
    "normalize-feedback",
    providerObservation().replace(
      "completion_evidence:\n  - Nitro provider response 125 for abc123",
      "completion_evidence: []",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /completion\.evidence is required/);
});

test("GREEN nitro-raw-evidence: derives a clean gate from raw provider payloads", () => {
  const result = runNitroGate("validate-gitlab-evidence", rawGitLabEvidence());

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"head_sha": "abc123"/);
  assert.match(result.stdout, /"request_note_id": 11/);
  assert.match(result.stdout, /"completion_note_id": 14/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
});

test("validate-gitlab-evidence rejects a push after the latest request", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ laterPush: true }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /source-head push occurred after/);
});

test("validate-gitlab-evidence binds the request to the current MR head transition", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ headVersionCreatedAt: "2026-07-30T12:02:00Z" }),
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /request followed the current MR head transition/,
  );
});

test("RED nitro-raw-evidence: carries unresolved Nitro discussions forward", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ unresolved: true }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"discussion-1"/);
  assert.match(result.stdout, /"gate_outcome": "blocked"/);
});

test("validate-gitlab-evidence accepts note-level resolvability from the provider", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      noteLevelDiscussionStateOnly: true,
      unresolved: true,
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"discussion-1"/);
  assert.match(result.stdout, /"gate_outcome": "blocked"/);
});

test("validate-gitlab-evidence ignores non-resolvable historical summary discussions", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ nonResolvableNitroSummary: true }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"unresolved_nitro_discussions": \[\]/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
});

test("validate-gitlab-evidence blocks actionable completion text without an inline discussion", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      completionBody:
        "One concern still applies and should be addressed before merge.",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"actionable_completion": true/);
  assert.match(result.stdout, /"gate_outcome": "blocked"/);
});

test("validate-gitlab-evidence blocks mixed reassuring and actionable completion text", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      completionBody:
        "No actionable findings overall, but one concern still applies and should be addressed before merge.",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"actionable_completion": true/);
  assert.match(result.stdout, /"gate_outcome": "blocked"/);
});

test("RED nitro-raw-evidence: blocks completion text outside the closed grammar", () => {
  for (const completionBody of [
    "Findings: two issues remain in the query path.",
    "Concerns remain in the provider evidence.",
    "Findings: none, but concerns remain in the provider evidence.",
    "All issues are resolved except one remains.",
    "Issues partially resolved.",
    "Concerns addressed where possible.",
    "Findings: none yet.",
    "No issues at this time.",
    "Concerns resolved for now.",
    "Currently, no issues.",
    "For now, no issues.",
    "So far, no issues.",
    "At this time, no issues.",
    "No issues overall, except one remains.",
    "Findings: none; however, one remains.",
    "Although one remains, findings: none.",
    "No issues. One item remains to fix.",
    "Issues resolved. One remains in auth.",
    "No issues. Tests fail.",
    "No concerns. Please update the query.",
    "Tests fail.",
    "Please update the query.",
    "No issues?",
    "Findings: none?",
    "Review complete?",
    "",
    "⚠️",
    "❌",
    "No issues. ⚠️",
    "Review complete. ❌",
    "No issues. 🚨",
    "No issues!?",
    "No issues...?",
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"actionable_completion": true/);
    assert.match(result.stdout, /"gate_outcome": "blocked"/);
    assert.doesNotMatch(result.stdout, /hostedFeedbackSemanticReview/);
  }
});

test("GREEN nitro-raw-evidence: accepts only closed-grammar completion text", () => {
  for (const completionBody of [
    "No actionable findings.",
    "No issues found.",
    "No blocking concerns. Nothing actionable remains.",
    "Findings: none.",
    "Issues resolved.",
    "All concerns addressed.",
    "Findings: no issues.",
    "Zero findings.",
    "No issues were found.",
    "There are no issues.",
    "**No issues.**",
    "**No issues**.",
    "No issues remain.",
    "No findings need attention.",
    "No issues need fixing.",
    "Nothing remains to fix.",
    "No issues remaining.",
    "No findings require attention.",
    "No issues to fix.",
    "Review complete. No issues.",
    "I reviewed the latest head. No issues found.",
    "No issues. Review complete.",
    [
      "## Review",
      "The prior issue is fixed.",
      "### The last open finding is resolved",
      "The exact regression is now covered.",
      "### Verdict",
      "No new findings. The prior issue is fixed. A human pass is worthwhile.",
    ].join("\n\n"),
    [
      "## Review",
      "Two candidates were dismissed on inspection.",
      "### No new findings survived verification",
      "The candidates were both fail-closed.",
      "### Verdict",
      "The load-bearing gate is fixed, and no new finding survived this pass.",
    ].join("\n\n"),
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"gate_outcome": "passed"/);
  }
});

test("RED nitro-raw-evidence: blocks structured reviews with current findings or contradictory verdicts", () => {
  for (const completionBody of [
    [
      "## Review",
      "### Finding",
      "**[MEDIUM]** One issue remains.",
      "### Verdict",
      "One issue remains before merge.",
    ].join("\n\n"),
    ["### Verdict", "No new findings, but one issue remains."].join("\n\n"),
    ["### Concern", "Tests fail.", "### Verdict", "No new findings."].join(
      "\n\n",
    ),
    ["# Findings", "One issue exists.", "### Verdict", "No new findings."].join(
      "\n\n",
    ),
    [
      "### Finding:",
      "One issue exists.",
      "### Verdict",
      "No new findings.",
    ].join("\n\n"),
    [
      "### Verdict",
      "No new findings.",
      "### Verdict",
      "Action required before merge.",
    ].join("\n\n"),
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"actionable_completion": true/);
    assert.match(result.stdout, /"gate_outcome": "blocked"/);
  }
});

test("GREEN nitro-raw-evidence: structured Verdict receipt stays distinct from semantic review", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      completionBody: [
        "## Review",
        "The complete narrative remains subject to Finish semantic review.",
        "### Verdict",
        "No new findings. Additional neutral explanation follows.",
      ].join("\n\n"),
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"actionable_completion": false/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
  assert.doesNotMatch(result.stdout, /hostedFeedbackSemanticReview/);
});

test("validate-gitlab-evidence blocks a later actionable Nitro summary", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      completionBody: "No actionable findings.",
      laterCompletionBody:
        "One concern still applies and should be fixed before merge.",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"completion_note_id": 16/);
  assert.match(result.stdout, /"gate_outcome": "blocked"/);
});

test("validate-gitlab-evidence proves the authored comment route for a larger POC", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      changesCount: 51,
      lifecycle: "poc",
      classification: "poc",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"request_command": "@nitro review"/);
  assert.match(result.stdout, /"request_note_id": 11/);
});

test("validate-gitlab-evidence routes a capped removal-only count", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      changesCount: "1000+",
      classification: "removal-only",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"effective_diff_files": "1000\+"/);
  assert.match(result.stdout, /"request_command": "@nitro review"/);
});

test("validate-gitlab-evidence requires complete provider pagination", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ paginationComplete: false }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pagination must be contiguous and terminate/);
});

test("validate-gitlab-evidence requires an authored large request identity", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      lifecycle: "poc",
      classification: "poc",
      changesCount: 51,
      requestAuthor: null,
    }),
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /latest @nitro review request event/);
});

test("validate-gitlab-evidence requires the exact Nitro provider identity", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ completionAuthor: "nitro-helper" }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"gate_outcome": "pending"/);
  assert.doesNotMatch(result.stdout, /"completion_note_id": 14/);
});

test("validate-gitlab-evidence applies the canonical request policy to raw diff size", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ changesCount: 51 }),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /standard_artifact_exceeds_nitro_file_ceiling/);
});

test("validate rejects POC classification on a final implementation", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace(
      "artifact_classification: standard",
      "artifact_classification: poc",
    ),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /artifact_lifecycle_classification_mismatch/);
});

test("validate-route accepts Fullscript GitLab merge requests", () => {
  const result = runNitroGate(
    "validate-route",
    `nitro_route:
  artifact_host: gitlab
  artifact_kind: merge_request
  remote_host: git.fullscript.io
  required: true
`,
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nitro_route valid/);
});

test("validate-route rejects GitHub as Nitro unsupported", () => {
  const result = runNitroGate(
    "validate-route",
    `nitro_route:
  artifact_host: github
  artifact_kind: pull_request
  remote_host: github.com
  required: true
`,
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nitro_route_unsupported/);
});
