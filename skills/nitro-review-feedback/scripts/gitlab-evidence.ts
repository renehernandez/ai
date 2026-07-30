import {
  expectedNitroRequest,
  type NitroArtifactClassification,
  type NitroArtifactLifecycle,
  nitroArtifactClassifications,
  nitroArtifactLifecycles,
} from "./nitro-request-policy.ts";
import { fail, includes } from "./planning-contracts.ts";

type GitLabNote = {
  id?: number;
  body?: string;
  created_at?: string;
  resolvable?: boolean;
  resolved?: boolean;
  system?: boolean;
  author?: { username?: string };
};

type GitLabDiscussion = {
  id?: string;
  individual_note?: boolean;
  resolvable?: boolean;
  resolved?: boolean;
  notes?: GitLabNote[];
};

type GitLabVersion = {
  id?: number;
  head_commit_sha?: string;
  created_at?: string;
};

type GitLabPage<T> = {
  page?: number;
  next_page?: string;
  items?: T[];
};

type GitLabEvidence = {
  context?: {
    artifact_lifecycle?: NitroArtifactLifecycle;
    artifact_classification?: NitroArtifactClassification;
  };
  mr?: {
    web_url?: string;
    sha?: string;
    changes_count?: string | number;
  };
  note_pages?: GitLabPage<GitLabNote>[];
  discussion_pages?: GitLabPage<GitLabDiscussion>[];
  version_pages?: GitLabPage<GitLabVersion>[];
};

export function validateGitLabEvidence(input: string): void {
  let payload: GitLabEvidence;
  try {
    payload = JSON.parse(input) as GitLabEvidence;
  } catch {
    fail("GitLab Nitro evidence must be raw JSON");
  }
  const errors: string[] = [];
  const notes = validatedPaginatedItems("notes", payload.note_pages, errors);
  const discussions = validatedPaginatedItems(
    "discussions",
    payload.discussion_pages,
    errors,
  );
  const versions = validatedPaginatedItems(
    "versions",
    payload.version_pages,
    errors,
  );
  const rawFileCount = payload.mr?.changes_count;
  const fileCountCapped = rawFileCount === "1000+";
  const fileCount = fileCountCapped ? 1_001 : Number(rawFileCount);
  if (!payload.mr?.web_url || !payload.mr.sha) {
    errors.push("raw GitLab MR evidence must include web_url and sha");
  }
  if (!Number.isSafeInteger(fileCount) || fileCount < 0) {
    errors.push("raw GitLab MR changes_count must be a non-negative integer");
  }
  const expectedRequest = resolveExpectedRequest(
    payload.context,
    fileCount,
    errors,
  );
  const orderedNotes = [...notes].sort(
    (left, right) => noteTime(left) - noteTime(right),
  );
  const requestNote = expectedRequest
    ? findRequestNote(orderedNotes, expectedRequest)
    : undefined;
  if (!requestNote?.id || !requestNote.created_at) {
    errors.push(
      `raw GitLab notes must contain the latest ${expectedRequest ?? "Nitro"} request event`,
    );
  }
  const requestTime = requestNote ? noteTime(requestNote) : Number.NaN;
  const currentHeadVersion = versions
    .filter((version) => version.head_commit_sha === payload.mr?.sha)
    .sort((left, right) => versionTime(left) - versionTime(right))
    .at(-1);
  if (
    !currentHeadVersion?.id ||
    !currentHeadVersion.created_at ||
    versionTime(currentHeadVersion) > requestTime
  ) {
    errors.push(
      "raw GitLab versions must prove the Nitro request followed the current MR head transition",
    );
  }
  const laterPush = orderedNotes.find(
    (note) =>
      noteTime(note) > requestTime &&
      note.system === true &&
      /added \d+ commits?|pushed \d+ commits?/i.test(note.body ?? ""),
  );
  if (laterPush) {
    errors.push(
      "a source-head push occurred after the latest Nitro request; request again",
    );
  }

  const nitroNotesAfterRequest = orderedNotes.filter(
    (note) => noteTime(note) > requestTime && note.author?.username === "nitro",
  );
  const completions = nitroNotesAfterRequest.filter(
    (note) => !/preparing to review|review is pending/i.test(note.body ?? ""),
  );
  const completion = completions.at(-1);
  const actionableCompletion = completions.some((note) =>
    nitroCompletionIsActionable(note.body ?? ""),
  );
  const unresolvedNitroDiscussions = discussions.filter((discussion) =>
    hasUnresolvedNitroFeedback(discussion),
  );
  const outcome = completion
    ? unresolvedNitroDiscussions.length > 0 || actionableCompletion
      ? "blocked"
      : "passed"
    : "pending";
  if (errors.length > 0) {
    fail(
      `invalid raw GitLab Nitro evidence:\n${errors
        .map((error) => `- ${error}`)
        .join("\n")}`,
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        artifact: payload.mr?.web_url,
        head_sha: payload.mr?.sha,
        effective_diff_files: fileCountCapped ? "1000+" : fileCount,
        request_command: expectedRequest,
        request_note_id: requestNote?.id,
        completion_note_id: completion?.id,
        actionable_completion: Boolean(actionableCompletion),
        unresolved_nitro_discussions: unresolvedNitroDiscussions.map(
          (discussion) => discussion.id,
        ),
        gate_outcome: outcome,
      },
      null,
      2,
    )}\n`,
  );
}

function hasUnresolvedNitroFeedback(discussion: GitLabDiscussion): boolean {
  if (discussion.individual_note === true) {
    return false;
  }
  const nitroNotes =
    discussion.notes?.filter((note) => note.author?.username === "nitro") ?? [];
  return (
    nitroNotes.some(
      (note) => note.resolvable === true && note.resolved !== true,
    ) ||
    (discussion.resolvable === true &&
      discussion.resolved !== true &&
      nitroNotes.length > 0)
  );
}

function resolveExpectedRequest(
  context: GitLabEvidence["context"],
  fileCount: number,
  errors: string[],
): string | undefined {
  if (
    !context?.artifact_lifecycle ||
    !includes(nitroArtifactLifecycles, context.artifact_lifecycle) ||
    !context.artifact_classification ||
    !includes(nitroArtifactClassifications, context.artifact_classification) ||
    !Number.isSafeInteger(fileCount) ||
    fileCount < 0
  ) {
    errors.push(
      "raw GitLab evidence requires a valid lifecycle classification",
    );
    return undefined;
  }
  try {
    return expectedNitroRequest({
      artifactLifecycle: context.artifact_lifecycle,
      artifactClassification: context.artifact_classification,
      effectiveDiffFiles: fileCount,
    });
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : "nitro_request_policy_invalid",
    );
    return undefined;
  }
}

function findRequestNote(
  notes: GitLabNote[],
  expectedRequest: string,
): GitLabNote | undefined {
  const matching = notes.filter((note) =>
    expectedRequest === "/request_review @nitro"
      ? note.system === true &&
        note.body?.trim().toLowerCase() === "requested review from @nitro"
      : note.system !== true &&
        Boolean(note.author?.username) &&
        note.author?.username !== "nitro" &&
        note.body?.trim() === expectedRequest,
  );
  return matching.at(-1);
}

function validatedPaginatedItems<T>(
  label: string,
  pages: GitLabPage<T>[] | undefined,
  errors: string[],
): T[] {
  if (!pages || pages.length === 0) {
    errors.push(`raw GitLab ${label} must include provider pagination pages`);
    return [];
  }
  for (const [index, page] of pages.entries()) {
    const expectedPage = index + 1;
    const expectedNextPage =
      expectedPage === pages.length ? "" : String(expectedPage + 1);
    if (
      page.page !== expectedPage ||
      page.next_page !== expectedNextPage ||
      !Array.isArray(page.items)
    ) {
      errors.push(
        `raw GitLab ${label} pagination must be contiguous and terminate with an empty next_page`,
      );
      return [];
    }
  }
  return pages.flatMap((page) => page.items ?? []);
}

function noteTime(note: GitLabNote): number {
  const value = Date.parse(note.created_at ?? "");
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

function versionTime(version: GitLabVersion): number {
  const value = Date.parse(version.created_at ?? "");
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function nitroCompletionIsActionable(body: string): boolean {
  if (/\[(?:critical|high|medium|low)\]/i.test(body)) {
    return true;
  }

  const headings = [...body.matchAll(/^(#{1,6})\s+(.+?)\s*$/gm)].map(
    (match) => ({
      index: match.index,
      length: match[0].length,
      normalized: match[2].trim().replace(/:$/, "").toLowerCase(),
    }),
  );
  const verdictHeadings = headings.filter(
    (heading) => heading.normalized === "verdict",
  );
  const cleanReceiptHeadings = headings.filter((heading) =>
    /^no (?:new )?findings? survived (?:verification|this pass)$/.test(
      heading.normalized,
    ),
  );
  if (
    headings.some((heading) =>
      /^(?:concerns?|findings?|issues?|recommendations?|required changes)$/.test(
        heading.normalized,
      ),
    )
  ) {
    return true;
  }
  if (verdictHeadings.length > 0) {
    if (verdictHeadings.length !== 1) {
      return true;
    }
    if (cleanReceiptHeadings.length === 1) {
      return false;
    }

    const verdictHeading = verdictHeadings[0];
    const afterHeading = body.slice(
      verdictHeading.index + verdictHeading.length,
    );
    const nextHeading = /^#{1,6}\s+/m.exec(afterHeading);
    const verdict = afterHeading.slice(
      0,
      nextHeading?.index ?? afterHeading.length,
    );
    return !/^\s*no (?:new )?findings?\s*[.!](?:\s|$)/i.test(verdict);
  }

  const reassurance =
    "(?:" +
    String.raw`(?:no|without)\s+(?:actionable\s+|blocking\s+)?(?:findings?|issues?|concerns?)(?:\s+(?:(?:were\s+)?found|remain(?:ing)?|need\s+(?:attention|fixing)|require\s+attention|to\s+fix))?` +
    String.raw`|there\s+(?:are|were)\s+no\s+(?:actionable\s+|blocking\s+)?(?:findings?|issues?|concerns?)` +
    String.raw`|(?:findings?|issues?|concerns?)\s*:\s*(?:none|resolved|addressed|closed|no\s+(?:findings?|issues?|concerns?))` +
    String.raw`|zero\s+(?:findings?|issues?|concerns?)` +
    String.raw`|(?:all\s+)?(?:findings?|issues?|concerns?)\s+(?:are\s+)?(?:resolved|addressed|closed)` +
    String.raw`|nothing\s+actionable(?:\s+remains)?` +
    String.raw`|nothing\s+remains\s+to\s+fix` +
    ")";
  const neutralCompletion = String.raw`(?:review\s+complete|(?:i\s+)?reviewed\s+the\s+latest\s+(?:merge\s+request\s+)?head)`;
  const acceptedSentence = new RegExp(
    String.raw`(^|[\n.!])(\s*(?:[-*]\s*)?(?:\*\*|__)?(?:${reassurance}|${neutralCompletion})(?:\*\*|__)?\s*)(?=$|[\n.!])`,
    "gim",
  );
  let accepted = false;
  const residual = body.replace(
    acceptedSentence,
    (_match, boundary: string) => {
      accepted = true;
      return boundary;
    },
  );
  return !accepted || !/^[\s`*_>#\-[\](){}.!:;,/\\]*$/u.test(residual);
}
