import { randomBytes } from "node:crypto";
import {
  type FSWatcher,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  watch,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

// The workflow watcher never types into the orchestrator terminal: typing joins and submits a person's
// unsent draft. It writes wake requests here instead, and the orchestrator's own Pi delivers them.
export const tickPromptPrefix = "AX orchestration tick. Run `node ";
export const sessionFile = "session.json";
export const wakePollMs = 5_000;

export function wakeRoot(env: NodeJS.ProcessEnv = process.env) {
  const state = env.XDG_STATE_HOME?.trim()
    ? env.XDG_STATE_HOME
    : join(env.HOME ?? homedir(), ".local", "state");
  return resolve(state, "ax", "wake");
}

// One directory per local terminal address; anything that is not a plain address is refused.
export function wakeDirectory(root: string, address: string) {
  if (!/^[A-Za-z0-9_-]+$/u.test(address))
    throw new Error(`Invalid herdr-core terminal address ${address}`);
  return join(root, address);
}

export type WakeRequest = {
  workflow: string;
  nonce: string;
  generation: number;
  n: number;
  prompt: string;
};
const isRequest = (value: unknown): value is WakeRequest => {
  const request = value as WakeRequest;
  return (
    typeof request?.workflow === "string" &&
    typeof request.nonce === "string" &&
    Number.isInteger(request.generation) &&
    Number.isInteger(request.n) &&
    typeof request.prompt === "string"
  );
};
const newer = (
  request: WakeRequest,
  last: { generation: number; n: number } | undefined,
) =>
  !last ||
  request.generation > last.generation ||
  (request.generation === last.generation && request.n > last.n);

// Watches this terminal's wake directory and hands each newer tick request bound to this session to `deliver` once.
export function startWake(options: {
  directory: string;
  deliver: (prompt: string) => Promise<void> | void;
  pollMs?: number;
}) {
  const { directory, deliver } = options;
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const nonce = randomBytes(16).toString("hex");
  const session = join(directory, sessionFile);
  const temporary = `${session}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ nonce }), { mode: 0o600 });
  renameSync(temporary, session);
  const delivered = new Map<string, { generation: number; n: number }>();
  function scan() {
    let names: string[];
    try {
      names = readdirSync(directory);
    } catch {
      return;
    }
    for (const name of names.sort()) {
      if (!name.endsWith(".json") || name === sessionFile) continue;
      let request: unknown;
      try {
        request = JSON.parse(readFileSync(join(directory, name), "utf8"));
      } catch {
        continue;
      }
      // A request from another Pi session, including an earlier one at a reused address, is never delivered.
      if (
        !isRequest(request) ||
        request.nonce !== nonce ||
        `${request.workflow}.json` !== name ||
        !request.prompt.startsWith(tickPromptPrefix)
      )
        continue;
      const last = delivered.get(name);
      if (!newer(request, last)) continue;
      delivered.set(name, { generation: request.generation, n: request.n });
      Promise.resolve()
        .then(() => deliver(request.prompt))
        .catch(() => {
          // A refused delivery is retried at the next scan unless a newer request arrived meanwhile.
          const current = delivered.get(name);
          if (
            current?.generation === request.generation &&
            current.n === request.n
          ) {
            if (last) delivered.set(name, last);
            else delivered.delete(name);
          }
        });
    }
  }
  let watcher: FSWatcher | undefined;
  try {
    watcher = watch(directory, () => scan());
  } catch {
    watcher = undefined;
  }
  const poll = setInterval(scan, options.pollMs ?? wakePollMs);
  poll.unref?.();
  scan();
  return {
    nonce,
    scan,
    close() {
      watcher?.close();
      clearInterval(poll);
    },
  };
}
