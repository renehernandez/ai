import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type HookRegistrationDeclaration = {
  id: string;
  event: "PreToolUse";
  matcher: string;
  command: string;
  targets: {
    claude: string;
    codex: string;
  };
};

export type HookRegistrationLocation = {
  event: string;
  matcherIndex: number;
  hookIndex: number;
  matcher?: string;
  command: string;
};

export type HookRegistrationStatus = {
  id: string;
  target: "claude" | "codex";
  registered: boolean;
  trust: "not_applicable" | "unverified_app_owned";
  locations: HookRegistrationLocation[];
  staleLocations: HookRegistrationLocation[];
};

type JsonObject = Record<string, unknown>;
type HookCommand = JsonObject & { type?: unknown; command?: unknown };
type HookMatcher = JsonObject & { matcher?: unknown; hooks?: unknown };
type HookDocument = JsonObject & { hooks?: unknown };

export function renderHookRegistrationDocument(input: {
  path: string;
  declaration: HookRegistrationDeclaration;
}): string {
  const document = readDocument(input.path);
  const hooks = hooksObject(document, input.path);
  removeOwnedRegistrations(hooks, input.declaration.id, input.path);
  const eventMatchers = eventArray(
    hooks,
    input.declaration.event,
    input.path,
    true,
  );
  let matcher = eventMatchers.find(
    (entry) => entry.matcher === input.declaration.matcher,
  );
  if (!matcher) {
    matcher = { matcher: input.declaration.matcher, hooks: [] };
    eventMatchers.push(matcher);
  }
  const commands = hookArray(matcher, input.path, true);
  commands.push({ type: "command", command: input.declaration.command });
  return `${JSON.stringify(document, null, 2)}\n`;
}

export function inspectHookRegistration(input: {
  path: string;
  target: "claude" | "codex";
  declaration: HookRegistrationDeclaration;
}): HookRegistrationStatus {
  const document = readDocument(input.path);
  const hooks = hooksObject(document, input.path);
  const owned = findOwnedLocations(hooks, input.declaration.id, input.path);
  const locations = owned.filter(
    (location) =>
      location.event === input.declaration.event &&
      location.matcher === input.declaration.matcher &&
      location.command === input.declaration.command,
  );
  const staleLocations = owned.filter(
    (location) => !locations.includes(location),
  );
  return {
    id: input.declaration.id,
    target: input.target,
    registered: locations.length === 1 && staleLocations.length === 0,
    trust: input.target === "codex" ? "unverified_app_owned" : "not_applicable",
    locations,
    staleLocations,
  };
}

export function registrationFindings(status: HookRegistrationStatus): string[] {
  const findings: string[] = [];
  if (status.locations.length === 0) {
    findings.push(`hook_registration_missing: ${status.target}/${status.id}`);
  }
  if (status.locations.length > 1) {
    findings.push(`hook_registration_duplicate: ${status.target}/${status.id}`);
  }
  if (status.staleLocations.length > 0) {
    findings.push(`hook_registration_stale: ${status.target}/${status.id}`);
  }
  return findings;
}

export function assertRegistrationTargetSafe(input: {
  path: string;
  target: "claude" | "codex";
  home: string;
}): void {
  const expected = join(
    resolve(input.home),
    input.target === "codex" ? ".codex/hooks.json" : ".claude/settings.json",
  );
  if (resolve(input.path) !== expected) {
    throw new Error(
      `hook_registration_target_invalid: ${input.target} must target ${expected}`,
    );
  }
}

function readDocument(path: string): HookDocument {
  if (!existsSync(path)) return { hooks: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error(
      `hook_registration_json_invalid: ${path}: ${(error as Error).message}`,
    );
  }
  if (!isObject(parsed)) {
    throw new Error(`hook_registration_document_invalid: ${path}`);
  }
  return parsed;
}

function hooksObject(document: HookDocument, path: string): JsonObject {
  if (document.hooks === undefined) {
    const hooks: JsonObject = {};
    document.hooks = hooks;
    return hooks;
  }
  if (!isObject(document.hooks)) {
    throw new Error(`hook_registration_hooks_invalid: ${path}`);
  }
  return document.hooks;
}

function eventArray(
  hooks: JsonObject,
  event: string,
  path: string,
  create: boolean,
): HookMatcher[] {
  const observed = hooks[event];
  if (observed === undefined && create) {
    const entries: HookMatcher[] = [];
    hooks[event] = entries;
    return entries;
  }
  if (observed === undefined) return [];
  if (!Array.isArray(observed) || !observed.every(isObject)) {
    throw new Error(`hook_registration_event_invalid: ${path}/${event}`);
  }
  return observed as HookMatcher[];
}

function hookArray(
  matcher: HookMatcher,
  path: string,
  create: boolean,
): HookCommand[] {
  if (matcher.hooks === undefined && create) {
    const hooks: HookCommand[] = [];
    matcher.hooks = hooks;
    return hooks;
  }
  if (matcher.hooks === undefined) return [];
  if (!Array.isArray(matcher.hooks) || !matcher.hooks.every(isObject)) {
    throw new Error(`hook_registration_commands_invalid: ${path}`);
  }
  return matcher.hooks as HookCommand[];
}

function removeOwnedRegistrations(
  hooks: JsonObject,
  id: string,
  path: string,
): void {
  for (const event of Object.keys(hooks)) {
    const matchers = eventArray(hooks, event, path, false);
    let removedFromEvent = false;
    const filteredMatchers = matchers.filter((matcher) => {
      const commands = hookArray(matcher, path, false);
      const filtered = commands.filter((hook) => !ownedCommand(hook, id));
      if (filtered.length === commands.length) return true;
      removedFromEvent = true;
      matcher.hooks = filtered;
      return filtered.length > 0;
    });
    if (!removedFromEvent) continue;
    if (filteredMatchers.length === 0) delete hooks[event];
    else hooks[event] = filteredMatchers;
  }
}

function findOwnedLocations(
  hooks: JsonObject,
  id: string,
  path: string,
): HookRegistrationLocation[] {
  const locations: HookRegistrationLocation[] = [];
  for (const event of Object.keys(hooks)) {
    for (const [matcherIndex, matcher] of eventArray(
      hooks,
      event,
      path,
      false,
    ).entries()) {
      const matcherValue =
        typeof matcher.matcher === "string" ? matcher.matcher : undefined;
      for (const [hookIndex, hook] of hookArray(
        matcher,
        path,
        false,
      ).entries()) {
        if (!ownedCommand(hook, id)) continue;
        locations.push({
          event,
          matcherIndex,
          hookIndex,
          matcher: matcherValue,
          command: String(hook.command),
        });
      }
    }
  }
  return locations;
}

function ownedCommand(hook: HookCommand, id: string): boolean {
  return (
    hook.type === "command" &&
    typeof hook.command === "string" &&
    new RegExp(
      `(?:^|[/~])\\.agents/hooks/${escapeRegExp(id)}\\.ts(?:[\\s'"]|$)`,
      "u",
    ).test(hook.command)
  );
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function writeHookRegistrationCandidate(
  path: string,
  content: string,
): void {
  writeFileSync(path, content, { encoding: "utf-8", mode: 0o600 });
}
