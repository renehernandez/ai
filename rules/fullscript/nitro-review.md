# Fullscript Nitro review rules

These rules apply only in Fullscript repositories whose active GitLab policy
selects Nitro.

- Review retrieves and normalizes Nitro discussions read-only. Finish owns the
  review request, provider polling, and readiness decision.
- Finish requests Nitro through a new top-level MR note containing only
  `/request_review @nitro` after initial publication and every head-changing
  follow-up push.
- Skip a duplicate request only when Nitro review is already in flight for the
  same exact head.
- The latest-head Nitro feedback must complete without unresolved actionable
  findings. Older feedback is stale and cannot satisfy the gate.
- Nitro does not replace local Review, CI, approvals, or user acceptance of a
  mandatory OpenSpec POC.
- Do not apply Nitro policy to GitHub, generic GitLab, personal projects, or a
  Fullscript project whose active policy does not select Nitro.
