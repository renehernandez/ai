# Fullscript Nitro Review Rules

These rules apply only in Fullscript repositories that use Nitro for hosted GitLab MR review.

## Explicit Nitro Review Requests

- After creating a GitLab MR, request a `nitro` review by running `glab mr note <MR_IID> -m "/request_review @nitro"` so the new top-level MR note contains only `/request_review @nitro`, unless the user explicitly opted out or the project does not use Nitro.
- After pushing a follow-up commit to a GitLab MR, request a Nitro re-review the same way when the diff materially changed.
- Skip the re-review request only when the push contains no source changes or a Nitro review is already in flight for the same diff.
- Do not apply these rules on personal machines, personal GitHub repositories, or repositories where Nitro is unavailable.
