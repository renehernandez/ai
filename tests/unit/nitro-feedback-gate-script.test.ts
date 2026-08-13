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
    poll_interval_minutes: 5
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
        overrides.completionBody ??
        "Reviewed the latest merge request head. No findings.",
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
  assert.match(result.stdout, /polled every 5 minutes/);
  assert.match(result.stdout, /poll_interval_minutes: 5/);
});

test("validate accepts a clean latest-head gate", () => {
  const result = runNitroGate("validate", cleanGate);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /nitro_feedback_gate valid/);
});

test("validate rejects the legacy one-minute polling interval", () => {
  const result = runNitroGate(
    "validate",
    cleanGate.replace("poll_interval_minutes: 5", "poll_interval_minutes: 1"),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /start\.poll_interval_minutes must be 5/);
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

test("GREEN nitro-raw-evidence: derives an exact-head completion receipt", () => {
  const result = runNitroGate("validate-gitlab-evidence", rawGitLabEvidence());

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"head_sha": "abc123"/);
  assert.match(result.stdout, /"request_note_id": 11/);
  assert.match(result.stdout, /"completion_note_id": 14/);
  assert.match(result.stdout, /"completion_received": true/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
  assert.doesNotMatch(result.stdout, /hostedFeedbackSemanticReview/);
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

test("RED nitro-raw-evidence: blocks receipts with unresolved Nitro discussions", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({ unresolved: true }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"discussion-1"/);
  assert.match(result.stdout, /"completion_received": true/);
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

test("validate-gitlab-evidence receives completion text without classifying its wording", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      completionBody:
        "One concern still applies and should be addressed before merge.",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"completion_received": true/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
});

test("validate-gitlab-evidence leaves mixed completion prose to semantic review", () => {
  const result = runNitroGate(
    "validate-gitlab-evidence",
    rawGitLabEvidence({
      completionBody:
        "No actionable findings overall, but one concern still applies and should be addressed before merge.",
    }),
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /"completion_received": true/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
});

test("RED nitro-raw-evidence: rejects symbol-only completion notes", () => {
  for (const completionBody of ["", "⚠️", "🛠️", "  #  "]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 1, completionBody);
    assert.match(
      result.stderr,
      /Nitro completion must contain substantive prose/,
      completionBody,
    );
  }
});

test("validate-gitlab-evidence accepts substantive prose without pinning provider wording", () => {
  for (const completionBody of [
    "Review complete?",
    "The login handler dereferences user without a null check.",
    "This endpoint lacks authorization on the delete route.",
    "You are not validating the webhook signature.",
    "レビューが完了しました。",
    "Проверка завершена.",
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0, completionBody);
    assert.match(result.stdout, /"completion_received": true/, completionBody);
    assert.match(result.stdout, /"gate_outcome": "passed"/, completionBody);
  }
});

test("nitro-raw-evidence: does not classify feedback wording", () => {
  for (const completionBody of [
    "Findings: two issues remain in the query path.",
    "Concerns remain in the provider evidence.",
    "Findings: none, but concerns remain in the provider evidence.",
    "All issues are resolved except one remains.",
    "Issues partially resolved.",
    "Concerns addressed where possible.",
    "No issues overall, except one remains.",
    "Findings: none; however, one remains.",
    "No issues. One item remains to fix.",
    "No issues. Tests fail.",
    "No concerns. Please update the query.",
    "Tests fail.",
    "Please update the query.",
    "Nitro found feedback to raise. Please review the inline comments.",
    "This introduces a false negative in the deletion guard.",
    "Consider deriving the boundary from the provider timestamp.",
    "The missing validation allows stale evidence to pass.",
    "No issues found. The stale-evidence path is now handled incorrectly.",
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"completion_received": true/, completionBody);
    assert.match(result.stdout, /"gate_outcome": "passed"/, completionBody);
    assert.doesNotMatch(result.stdout, /hostedFeedbackSemanticReview/);
  }
});

test("GREEN nitro-raw-evidence: declarative prose is not treated as an imperative", () => {
  for (const completionBody of [
    "Test coverage looks complete. No issues found.",
    "Update notes below. No issues found.",
    "Change log is accurate. No findings.",
    "Cover letter attached. No concerns.",
    "Handle bars work. No issues.",
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"completion_received": true/, completionBody);
    assert.match(result.stdout, /"gate_outcome": "passed"/, completionBody);
  }
});

test("GREEN nitro-raw-evidence: accepts completion without feedback to address", () => {
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
    "Findings: none yet.",
    "No issues at this time.",
    "Concerns resolved for now.",
    "Currently, no issues.",
    "No issues. ⚠️",
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
    assert.match(result.stdout, /"gate_outcome": "passed"/, completionBody);
  }
});

test("nitro-raw-evidence: repaired-finding recaps remain semantic-review input", () => {
  for (const completionBody of [
    "No issues found. The stale-evidence path is now handled incorrectly.",
    "No findings. The prior issue is fixed, but one concern remains.",
    "All concerns addressed. The regression is no longer present; however, tests fail.",
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"completion_received": true/, completionBody);
    assert.match(result.stdout, /"gate_outcome": "passed"/, completionBody);
  }
});

test("GREEN nitro-raw-evidence: notes 3656597 and 3657002 do not turn human-review advice into a gate", () => {
  for (const completionBody of [
    [
      "No new findings to raise. The three prior inline comments on `verification.ts` are all resolved in the current code: the session poller now enforces newest-first ordering with a bounded post-trigger `hasNextPage` guard (`verification.ts:362-387`), the delegated-mr trigger boundary anchors on the server-side `issue.updatedAt` rather than the local CI clock (`verification.ts:338`), and `failureKind` advances to `provider-unavailable` before preflight (`verification.ts:590`) so transient errors no longer misclassify as `configuration`.",
      "The destructive cleanup path is well-guarded — recovery's broad `containsIgnoreCase` issue filter is re-tightened by `isOwnedLinearFixtureIssue` (exact title prefix with trailing space + run-marker + repo-label check), and `discoverOwnedMergeRequest` refuses on ambiguous/multiple matches. The success schema resists false positives (non-ephemeral marker-bearing response from the verify app, delegated-mr requires a linked+cleaned MR). Typecheck is clean.",
      "Since this touches CI credential wiring and a new provider path, worth another set of eyes before the real implementation units land.",
      "Review skill: `mr-review`",
    ].join("\n\n"),
    [
      "No inline findings — I verified the security-critical pieces empirically rather than by inspection alone.",
      "I focused on the three risk areas: the `block-delete-outside-cwd.ts` guard, the AX hook-registration/runtime-sync wiring, and the structured merge-authority contract.",
      "- **Deletion guard**: ran the hook against ~20 adversarial shell strings (parent traversal, `--`, quoted/globbed/dynamic targets, `cd ..` + delete, wrapper binaries, subshells, chained commands, nested backticks). All correctly denied. Two bypasses a subagent flagged turned out to be false — `rm (../outside)` is a bash syntax error, and the nested-backtick case was already denied as dynamic. The only ALLOWs (`xargs rm`, `find -exec rm`) are explicitly documented as out-of-scope in `hooks/README.md`, and the file honestly frames itself as a guardrail, not an OS boundary.",
      "- **Merge-authority contract** (`finish-contract.ts`): fail-closed throughout — unknown scopes throw, multi-scope selections without user-authored aggregate scope collapse to empty, and material effective-diff changes revoke authority. All 39 referenced tests pass.",
      "- **Hook registration/runtime-sync**: target paths are pinned to the isolated HOME via `assertRegistrationTargetSafe`, stale owned entries are pruned before writing, and unrelated hooks/settings are preserved.",
      "Note: `pnpm test` shows 3 failures (`openspec-sync-safety`, `runtime-sync` symlink tests), but they also fail on `main` and are unrelated to this MR — they stem from running the suite as root, not from these changes.",
      "Given the scope (authority-policy semantics across many docs/skills plus a new security hook), it's worth getting another pair of eyes on it before merge.",
      "Review skill: `mr-review`",
    ].join("\n\n"),
    "No inline findings. This policy deserves a careful human read before merge.",
    "No issues found. Human review is recommended because the change is security-sensitive.",
  ]) {
    const result = runNitroGate(
      "validate-gitlab-evidence",
      rawGitLabEvidence({ completionBody }),
    );

    assert.equal(result.status, 0);
    assert.match(result.stdout, /"completion_received": true/);
    assert.match(result.stdout, /"gate_outcome": "passed"/);
  }
});

test("nitro-raw-evidence: structured review prose remains semantic-review input", () => {
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
    assert.match(result.stdout, /"completion_received": true/);
    assert.match(result.stdout, /"gate_outcome": "passed"/);
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
  assert.match(result.stdout, /"completion_received": true/);
  assert.match(result.stdout, /"gate_outcome": "passed"/);
  assert.doesNotMatch(result.stdout, /hostedFeedbackSemanticReview/);
});

test("validate-gitlab-evidence binds receipt identity to the latest Nitro summary", () => {
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
  assert.match(result.stdout, /"gate_outcome": "passed"/);
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
