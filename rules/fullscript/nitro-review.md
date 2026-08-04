# Fullscript Nitro review rules

These rules apply only in Fullscript repositories whose active GitLab policy
selects Nitro.

This rule is the canonical policy owner for Nitro request routing. Its portable
executable companion is
[`nitro-request-policy.ts`](../../skills/nitro-review-feedback/scripts/nitro-request-policy.ts);
callers consume that implementation instead of reproducing its file threshold
or command selection.

- Review retrieves and normalizes Nitro discussions read-only. Finish owns the
  review request, provider polling, and readiness decision.
- A push does not itself start Nitro. Finish explicitly requests it through a
  new top-level MR note after initial publication and every source-head push.
- For an effective diff of 50 files or fewer, the note contains only
  `/request_review @nitro`.
- For a POC or removal-only MR above 50 files, the note contains only
  `@nitro review`. A non-removal final MR may not exceed 50 files.
- Do not request Nitro for target-only movement on an unpromoted descendant.
- Skip a duplicate request only when Nitro is already in flight for the same
  source head and effective diff.
- Read every Nitro response in full and inspect all unresolved Nitro-authored
  discussions. Do not classify the result from its first sentence or from
  reassuring phrases such as `no findings` or `no blocking issues`. This
  semantic read is the load-bearing classifier for keyword-free defect prose:
  such feedback blocks readiness even when the deterministic receipt passes.
- The latest completion owns the receipt identity, but feedback in any
  post-request Nitro completion that requires an MR change remains active.
- Derive readiness from raw GitLab MR, note, and discussion payloads. Bind the
  provider diff count, latest request event, exact `nitro` author identity,
  completion chronology, and unresolved discussions to the current source head.
  MR versions must prove that the request followed the transition to that exact
  head; a self-authored normalized summary is not hosted proof.
- Exhaust notes and discussions pagination and preserve contiguous provider
  page numbers plus each `X-Next-Page` value through the empty terminal value.
  For `@nitro review`, bind readiness to the actual non-system command note and
  its nonempty requesting username; the generic reviewer-assignment event is
  not proof of the larger-artifact route.
- Treat GitLab's capped `changes_count: "1000+"` as definitively above the
  50-file request boundary without presenting it as an exact file count.
- Feedback that requires an MR change anywhere in the response remains active
  until fixed or explicitly dispositioned. Determine that semantically from
  the complete response, including a concern Nitro says `still applies` or is
  `worth addressing before merge`; Nitro prose is not a stable machine-readable
  API.
- Advice to get another human reviewer, another pair of eyes, or a careful
  human read is nonblocking unless GitLab approvals, direct user instruction,
  or another project policy independently requires it. Nitro advisory prose
  does not create a new approval requirement.
- The latest-source-head Nitro feedback must complete without unresolved
  actionable findings, and newer summaries must not silently clear applicable
  older feedback. Feedback for an older source head is stale and cannot satisfy
  the gate.
- When Nitro reports actionable feedback, Execute fixes every in-scope finding,
  pushes the new source head, and Finish requests Nitro again. Continue until
  the latest head is clean or a material decision requires human follow-up.
  That decision blocks only the affected MR while unrelated authorized work may
  continue.
- Nitro does not replace local Review, CI, approvals, or user acceptance of a
  mandatory OpenSpec POC.
- Do not apply Nitro policy to GitHub, generic GitLab, personal projects, or a
  Fullscript project whose active policy does not select Nitro.
