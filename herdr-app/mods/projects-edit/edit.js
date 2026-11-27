// The sidebar popups' writes and the save path, with no `herdr` import so the
// repository's unit tests run them under Node.

import {
  addProject,
  CHANGED,
  moveProject,
  parseConfig,
  removeProject,
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
    ...(at > 0 ? ["up"] : []),
    ...(at < count - 1 ? ["down"] : []),
    "new",
    "remove",
  ];
}

// A sidebar popup's writes by row id. write(change) makes the row's click
// handler for an edit of projects.json; home expands "~".
export function menuWrites(p, home, write) {
  const w = (change) => writeAction(write(change));
  switch (p.menu) {
    case "project":
      return {
        up: w((doc) => moveProject(doc, p.project, -1, p.path)),
        down: w((doc) => moveProject(doc, p.project, 1, p.path)),
        remove: w((doc) => removeProject(doc, p.project, p.path)),
      };
    case "other":
      return p.path
        ? { "new-project": w((doc) => addProject(doc, p.path, home)) }
        : {};
    default:
      return {};
  }
}

// Reads projects.json, applies change(doc) and writes it only over the text
// it read. io: { read(), write(text, expected) }.
// Resolves { status: "written" }, { status: "conflict" } when projects.json
// changed meanwhile (nothing is overwritten), or { status: "error", message }.
export async function saveConfig(io, change) {
  const failed = (e) => ({ status: "error", message: String(e?.message ?? e) });
  let text, next;
  try {
    text = (await io.read()) ?? null;
    next = serialize(change(parseConfig(text)));
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
