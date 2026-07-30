export const prohibitedAddedGuidance = [
  {
    pattern: /Any artifact, HEAD, or target-base change invalidates it/i,
    message:
      "size-exception authority must not be invalidated by every identity change",
  },
  {
    pattern: /restack (?:all|every) descendants?/i,
    message: "published descendants must not be restacked before promotion",
  },
  {
    pattern: /new-stack publication (?:is |remains )?blocked/i,
    message: "real-diff stack publication must not retain the obsolete blocker",
  },
  {
    pattern: /(?:atomic|atomically).{0,80}(?:affected chain|descendant)/is,
    message:
      "published descendant heads must not be propagated before predecessor promotion",
  },
  {
    pattern: /(?:select|invoke|use) `?(?:github-pr-create|glab-mr-create)`?/i,
    message:
      "standalone provider creation adapters must not be selectable behavior",
  },
  {
    pattern:
      /(?:route|use).{0,80}(?:raw )?(?:glab|gh)(?: commands?)?.{0,80}(?:instead|direct)/is,
    message: "raw provider creation or update bypasses change-request-create",
  },
  {
    pattern: /(?:automatically|always) close(?:s|d)? .*POC/i,
    message: "POC disposal requires user closure authority",
  },
] as const;
