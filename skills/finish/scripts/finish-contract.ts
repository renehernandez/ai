export type ProviderSource = {
  value?: string;
  ambiguous?: boolean;
};

export function resolveProvider(
  direct: ProviderSource,
  project: ProviderSource,
  profile: ProviderSource,
  remote: ProviderSource,
): string {
  for (const source of [direct, project, profile, remote]) {
    if (source.ambiguous) {
      throw new Error("provider_route_ambiguous");
    }
    if (source.value?.trim()) {
      return source.value;
    }
  }
  throw new Error("provider_route_unresolved");
}

export type TerminalAuthority = {
  publish: boolean;
  merge: boolean;
  deploy: boolean;
  cleanup: boolean;
};

function explicitlyRequests(
  request: string,
  action:
    | "merge"
    | "ship"
    | "proceed to merge"
    | "deploy"
    | "clean up"
    | "cleanup",
): boolean {
  const escaped = action.replaceAll(" ", "\\s+");
  const actionSuffix =
    action === "proceed to merge" ? "(?!\\s+request\\b)" : "";
  const politePrefix =
    "(?:please\\s+|can you\\s+|could you\\s+|would you\\s+|go ahead and\\s+|i want you to\\s+|you (?:can|should|may)\\s+|let'?s\\s+)?";
  const clauseStart = new RegExp(
    `(?:^|[.!?;]\\s*)${politePrefix}${escaped}\\b${actionSuffix}`,
  );
  const chained = new RegExp(
    `\\b(?:and then|then|also|and)\\s+${politePrefix}${escaped}\\b${actionSuffix}`,
  );
  return clauseStart.test(request) || chained.test(request);
}

export function terminalAuthority(
  request: string,
  projectPolicy: Partial<TerminalAuthority> = {},
): TerminalAuthority {
  const normalized = request.toLowerCase();
  const denialSegments = [
    ...normalized.matchAll(
      /\b(?:do not|don't|without|no)\s+([^.;]+?)(?=\b(?:then|but|however|instead)\b|[.;]|$)/g,
    ),
  ].map((match) => match[1]);
  const denies = (...actionPatterns: string[]): boolean =>
    actionPatterns.some((actionPattern) =>
      denialSegments.some((segment) =>
        new RegExp(`\\b(?:${actionPattern})\\b`).test(segment),
      ),
    );
  const merge =
    (/\bmerge when green\b|\badd to (?:the )?merge queue\b/.test(normalized) ||
      explicitlyRequests(normalized, "merge") ||
      explicitlyRequests(normalized, "ship") ||
      explicitlyRequests(normalized, "proceed to merge")) &&
    !denies("merg(?:e|es|ed|ing)", "ship(?:s|ped|ping)?");

  const publishDenied = denies(
    "publish(?:es|ed|ing)?",
    "push(?:es|ed|ing)?",
    "(?:open|opens|opened|opening|update|updates|updated|updating)\\s+(?:an?\\s+|the\\s+)?(?:pr|mr|pull request|merge request)",
  );
  const mergeDenied = denies(
    "merg(?:e|es|ed|ing)",
    "ship(?:s|ped|ping)?",
    "(?:add|adds|added|adding)\\s+(?:it\\s+)?to\\s+(?:the\\s+)?merge queue",
  );
  const deployDenied = denies("deploy(?:s|ed|ing)?");
  const cleanupDenied = denies(
    "clean(?:s|ed|ing)?\\s+up",
    "cleanup",
    "(?:remove|removes|removed|removing|delete|deletes|deleted|deleting)\\s+(?:the\\s+|an?\\s+)?(?:branch|worktree)",
  );

  return {
    publish:
      !publishDenied &&
      (projectPolicy.publish === true ||
        /\bimplement\b|\bdeliver\b|\bproceed\b|\bpublish\b|\bfinish\b|\b(?:open|update)\b.*\b(?:pr|mr)\b/.test(
          normalized,
        )),
    merge: !mergeDenied && (projectPolicy.merge === true || merge),
    deploy:
      !deployDenied &&
      (projectPolicy.deploy === true ||
        explicitlyRequests(normalized, "deploy")),
    cleanup:
      !cleanupDenied &&
      (projectPolicy.cleanup === true ||
        explicitlyRequests(normalized, "clean up") ||
        explicitlyRequests(normalized, "cleanup")),
  };
}
