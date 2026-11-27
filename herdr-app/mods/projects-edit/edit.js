// The sidebar popups' writes and the save path, with no `herdr` import so the
// repository's unit tests run them under Node.

import {
  addRepo,
  CHANGED,
  machinesIn,
  moveProject,
  parseConfig,
  removeProject,
  removeRepo,
  serialize,
} from "./model.js";

// Marks a popup row's click handler as a write: it runs with the click and
// closes the popup itself once written. Other actions close it first.
export const writeAction = (handler) =>
  Object.assign(handler, { writes: true });

// A popup row's click.
export function clickItem(action, e, cx, { enabled, busy, close }) {
  if (!enabled || busy) return;
  if (action.writes) return action(e, cx);
  close();
  action();
}

// The project menu's row ids, in order, for the project at `at` of `count`:
// only the moves that apply.
export function projectMenuRows(at, count) {
  return [
    "rename",
    ...(at > 0 ? ["up"] : []),
    ...(at < count - 1 ? ["down"] : []),
    "add-repo",
    "new",
    "remove",
  ];
}

// A sidebar popup's writes by row id. write(change, machines) makes the
// row's click handler for an edit of projects.json.
export function menuWrites(p, names, write) {
  const w = (change, machines) => writeAction(write(change, machines));
  switch (p.menu) {
    case "project":
      return {
        up: w((doc) => moveProject(doc, p.project, -1, p.name)),
        down: w((doc) => moveProject(doc, p.project, 1, p.name)),
        remove: w((doc) => removeProject(doc, p.project, p.name)),
      };
    case "repo": {
      const repo = { path: p.path, machine: p.machine };
      return {
        remove: w(
          (doc, homes) => removeRepo(doc, p.project, repo, homes, p.name),
          [p.machine],
        ),
      };
    }
    case "other": {
      const repo = { path: p.path, machine: p.machine ?? null };
      return Object.fromEntries(
        names.map((name, i) => [
          `add-${i}`,
          w((doc, homes) => addRepo(doc, i, repo, homes, name), [repo.machine]),
        ]),
      );
    }
    default:
      return {};
  }
}

// Reads projects.json, applies change(doc, homes) and writes it only over the
// text it read. io: { read(), write(text, expected), homesFor(machines) }.
// Resolves { status: "written" }, { status: "conflict" } when projects.json
// changed meanwhile (nothing is overwritten), or { status: "error", message }.
export async function saveConfig(io, change, extraMachines = []) {
  const failed = (e) => ({ status: "error", message: String(e?.message ?? e) });
  let text, next;
  try {
    text = (await io.read()) ?? null;
    const doc = parseConfig(text);
    const homes = await io.homesFor([
      ...new Set([...machinesIn(doc), ...extraMachines.filter(Boolean)]),
    ]);
    next = serialize(change(doc, homes));
  } catch (e) {
    return e?.code === CHANGED ? { status: "conflict" } : failed(e);
  }
  try {
    await io.write(next, text);
    return { status: "written" };
  } catch (e) {
    // writeTextFile rejects a stale snapshot without a code: look again.
    let now;
    try {
      now = (await io.read()) ?? null;
    } catch {
      return failed(e);
    }
    return now !== text ? { status: "conflict" } : failed(e);
  }
}
