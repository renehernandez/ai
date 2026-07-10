# Fullscript Nitro review rules

These rules apply only in Fullscript repositories whose active GitLab policy
selects Nitro.

- Review retrieves and normalizes Nitro discussions read-only. Finish owns the
  review request, provider polling, and readiness decision.
- Finish requests Nitro through a new top-level MR note containing only
  `/request_review @nitro` after initial publication and every effective-diff
  change: either the source HEAD or resolved target-base SHA.
- Skip a duplicate request only when Nitro review is already in flight for the
  same effective diff: source HEAD plus resolved target-base SHA.
- Read every Nitro response in full and inspect all unresolved Nitro-authored
  discussions. Do not classify the result from its first sentence or from
  reassuring phrases such as `no findings` or `no blocking issues`.
- Actionable language anywhere in the response, including a carried-forward
  concern that `still applies` or is `worth addressing before merge`, remains
  active until fixed or explicitly dispositioned.
- The latest-effective-diff Nitro feedback must complete without unresolved
  actionable findings, and newer summaries must not silently clear applicable
  older feedback. Feedback for an older source HEAD or target-base SHA is stale
  and cannot satisfy the gate.
- Nitro does not replace local Review, CI, approvals, or user acceptance of a
  mandatory OpenSpec POC.
- Do not apply Nitro policy to GitHub, generic GitLab, personal projects, or a
  Fullscript project whose active policy does not select Nitro.
