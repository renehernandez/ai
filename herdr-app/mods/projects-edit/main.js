// Projects editing for the `projects` sidebar: the Projects dialog
// (cmd-k cmd-p, `mod.open {name: "projects-edit"}`) and the sidebar's
// popups, chosen by props:
//   (none) or { picking: true }            the dialog; picking: starts with New project's folder picker
//   { menu: "new" }                        New space, New project… (the sidebar header's +)
//   { menu: "project", project, path }     the moves that apply, New project…, Remove
//   { menu: "other", space, path }         New project from this repo, space menu
//   { menu: "tab", space, machine, folder }          Terminal and agents, started at folder
//
// A project is a local git repo's main checkout, picked with the system folder
// picker (a popup closes on click, so the dialog hosts the picker).
// Every write is writeTextFile(path, text, last read): an edit made meanwhile
// is never overwritten; the edit is dropped with a notification to retry.
// Popup rows follow Herdr 0.1.16's shipped `new-menu` mod (Apache License
// 2.0, LICENSE in this folder).

import { h_flex, v_flex } from "gpui-base";
import { div, image, svg, View } from "gpui-kit";
import {
  appHome,
  checking,
  closeOverlay,
  exec,
  home,
  knownAgents,
  notify,
  openOverlay,
  pickFolder,
  props,
  readTextFile,
  run,
  theme,
  writeTextFile,
} from "herdr";
import { clickItem, menuWrites, projectMenuRows, saveConfig } from "./edit.js";
import {
  addProject,
  CONFIG_FILE,
  loadConfig,
  mainCheckout,
  moveProject,
  removeProject,
  resolveProjects,
  tildePath,
} from "./model.js";

const DIALOG = {
  mod: "projects-edit",
  kind: "dialog",
  width: 560,
  height: 0.7,
};
const configPath = () => `${appHome()}/${CONFIG_FILE}`;
// Popup row heights, for a popup as tall as its rows (padding: p(5) twice).
const ROW = {
  item: 30,
  heading: 24,
  rule: 11,
  note: 28,
  folder: 20,
  padding: 10,
};

// Reads projects.json, applies change(doc) and writes it if nothing changed
// it meanwhile. Resolves true when written.
async function update(change) {
  const result = await saveConfig(
    {
      read: () => readTextFile(configPath()),
      write: (text, expected) => writeTextFile(configPath(), text, expected),
    },
    change,
  );
  if (result.status === "conflict")
    notify({
      title: "projects.json changed meanwhile",
      body: "Nothing was overwritten. Try again.",
      level: "warning",
    });
  else if (result.status === "error")
    notify({
      title: "Projects not saved",
      body: result.message,
      level: "error",
    });
  return result.status === "written";
}

export default class ProjectsEdit extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.doc = { projects: [] };
    this.error = null;
    this.loaded = false;
    this.agents = [];
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.spawn(async (cx) => {
      await this.read(cx);
      if (!p.menu && p.picking) this.newProject(cx);
    });
    if (p.menu === "tab" && !checking())
      cx.spawn(async (cx) => {
        try {
          this.agents = (
            await knownAgents({ on: p.machine ?? undefined })
          ).filter((a) => a.installed);
        } catch {
          this.agentsFailed = true;
        }
        cx.notify();
      });
  }

  // Adds a picked folder's repo, as its main checkout, as a new project.
  newProject(cx) {
    cx.spawn(async (cx) => {
      const folder = await pickFolder({ prompt: "Add" });
      if (!folder) return;
      let common = null;
      try {
        const r = await exec(
          "git",
          ["rev-parse", "--path-format=absolute", "--git-common-dir"],
          { cwd: folder },
        );
        if (r.code === 0) common = r.stdout;
      } catch {}
      if (common === null) {
        notify({ title: "Not a git repo", body: folder, level: "error" });
        return;
      }
      const path = tildePath(mainCheckout(common), home());
      await this.persist((doc) => addProject(doc, path, home()), cx);
    });
  }

  async read(cx) {
    try {
      const { doc, error } = loadConfig(
        await readTextFile(configPath()),
        this.doc,
      );
      this.doc = doc;
      this.error = error;
    } catch (e) {
      this.error = `Couldn't read ${CONFIG_FILE}: ${e?.message ?? e}`;
    }
    this.loaded = true;
    cx.notify();
  }

  // Runs an edit, then reloads what the dialog shows.
  save(change, cx) {
    cx.spawn((cx) => this.persist(change, cx));
  }

  async persist(change, cx) {
    await update(change);
    await this.read(cx);
  }

  // A popup's edit: the popup closes once it is written (or refused).
  write(change) {
    return (_e, cx) =>
      cx.spawn(async () => {
        this.busy = true;
        await update(change);
        this.close();
      });
  }

  close() {
    closeOverlay(props().overlay);
  }

  // ---- popups ----

  item(id, label, action, { enabled = true, hint = "", icon = null } = {}) {
    const t = theme();
    return h_flex()
      .id(id)
      .h(30)
      .px(9)
      .gap(10)
      .rounded(7)
      .items_center()
      .flex_none()
      .text_color(enabled ? t.foreground : t.dim)
      .when(enabled, (el) => el.hover((s) => s.bg(t.selected)))
      .on_click((e, cx) =>
        clickItem(action, e, cx, {
          enabled,
          busy: this.busy,
          close: () => this.close(),
        }),
      )
      .when(Boolean(icon), (el) => el.child(icon))
      .child(div().flex_1().truncate().child(label))
      .child(div().text_size(11).text_color(t.dim).child(hint));
  }

  heading(text) {
    return div()
      .px(9)
      .pt(7)
      .pb(3)
      .flex_none()
      .text_size(11)
      .text_color(theme().dim)
      .child(text);
  }

  rule() {
    return div().h(1).mx(4).my(5).flex_none().bg(theme().border);
  }

  note(text, color = theme().dim) {
    return div().px(9).py(6).flex_none().text_color(color).child(text);
  }

  // A popup's rows as [element, height]: head and foot stay put, and the list
  // between them scrolls once the popup reaches its most height (props.height).
  menuParts(p) {
    const writes = menuWrites(p, home(), (change) => this.write(change));
    const item = (...args) => [this.item(...args), ROW.item];
    const heading = (text) => [this.heading(text), ROW.heading];
    const rule = () => [this.rule(), ROW.rule];
    const newProject = () =>
      openOverlay({ ...DIALOG, props: { picking: true } });
    switch (p.menu) {
      case "new":
        return {
          list: [
            item("space", "New space", () => run("space.new")),
            item("project", "New project…", newProject),
          ],
        };
      case "project": {
        const rows = {
          up: ["Move up", writes.up],
          down: ["Move down", writes.down],
          new: ["New project…", newProject],
          remove: ["Remove", writes.remove, { hint: "spaces stay open" }],
        };
        return {
          list: projectMenuRows(
            p.project,
            this.doc.projects?.length ?? 0,
          ).flatMap((id) => [
            ...(id === "remove" ? [rule()] : []),
            item(id, ...rows[id]),
          ]),
        };
      }
      case "other":
        return {
          list: [
            ...(writes["new-project"]
              ? [
                  item(
                    "new-project",
                    "New project from this repo",
                    writes["new-project"],
                    { hint: p.path.split("/").pop() },
                  ),
                  rule(),
                ]
              : []),
            item(
              "space",
              "Space…",
              () =>
                openOverlay({
                  mod: "menu",
                  kind: "popup",
                  width: 200,
                  height: 260,
                  props: { tab: "space", target: { id: p.space } },
                }),
              { hint: "rename, worktree, close" },
            ),
          ],
        };
      case "tab": {
        const t = theme();
        const start = (args) =>
          run("tab.new", {
            space: p.space,
            ...(p.folder ? { folder: p.folder } : {}),
            ...args,
          });
        const agents = this.agents.map((a) =>
          item(
            `agent-${a.key}`,
            a.name,
            () => start({ name: a.name, argv: a.run }),
            {
              icon: a.tint
                ? svg(a.icon).size(14).text_color(t.foreground)
                : image(a.icon).size(14),
            },
          ),
        );
        const checked = this.agentsFailed
          ? "Could not check installed agents"
          : "Checking installed agents…";
        return {
          head: [
            item("terminal", "Terminal", () => start({}), {
              icon: svg("icons/shell.svg").size(14),
            }),
            heading("Start an agent"),
          ],
          list: agents.length ? agents : [[this.note(checked), ROW.note]],
          foot: [
            [
              div()
                .px(9)
                .pt(5)
                .flex_none()
                .text_size(11)
                .text_color(t.dim)
                .truncate()
                .child(p.folder ? `in ${p.folder}` : "not in a repo"),
              ROW.folder,
            ],
          ],
        };
      }
      default:
        return {};
    }
  }

  // As tall as its rows up to props.height, like Herdr's new-menu: past that
  // the list scrolls and the head and foot stay reachable.
  renderMenu(p) {
    const t = theme();
    const usesDoc = p.menu === "project" || p.menu === "other";
    const waiting = !this.loaded && usesDoc;
    const {
      head = [],
      list = [],
      foot = [],
    } = waiting ? { list: [[this.note("…"), ROW.note]] } : this.menuParts(p);
    if (this.error && usesDoc)
      foot.push([this.note(this.error, t.blocked).text_size(11), ROW.note]);
    const rows = [...head, ...list, ...foot];
    const height = Math.min(
      p.height ?? 260,
      ROW.padding + rows.reduce((sum, [, h]) => sum + h, 0),
    );
    const elements = (part) => part.map(([el]) => el);
    return v_flex()
      .id("projects-menu")
      .track_focus(this.handle)
      .w_full()
      .h(height)
      .min_h(0)
      .bg(t.popover)
      .p(5)
      .text_size(12.8)
      .children(elements(head))
      .child(
        v_flex()
          .id("projects-menu-list")
          .flex_1()
          .min_h(0)
          .overflow_y_scrollbar()
          .children(elements(list)),
      )
      .children(elements(foot));
  }

  // ---- the dialog ----

  button(id, text, action) {
    const t = theme();
    return h_flex()
      .id(id)
      .h(26)
      .px(10)
      .flex_none()
      .items_center()
      .rounded(7)
      .border_1()
      .border_color(t.input)
      .bg(t.raised)
      .text_color(t.foreground)
      .text_size(12)
      .cursor_pointer()
      .hover((s) => s.opacity(0.88))
      .on_click(action)
      .child(text);
  }

  renderDialog() {
    const t = theme();
    const { projects, errors } = resolveProjects(this.doc, home());
    const last = (this.doc.projects?.length ?? 0) - 1;
    const icon = (id, glyph, tip, action, enabled = true) =>
      div()
        .id(id)
        .px(5)
        .flex_none()
        .rounded(4)
        .text_color(enabled ? t.dim : t.border)
        .tooltip(tip)
        .when(enabled, (el) =>
          el
            .cursor_pointer()
            .hover((s) => s.bg(t.hover).text_color(t.foreground))
            .on_click(action),
        )
        .child(glyph);
    const list = v_flex()
      .flex_1()
      .min_h(0)
      .overflow_y_scrollbar()
      .gap(2)
      .children(
        projects.map(({ index: i, path, name, parent }) =>
          h_flex()
            .id(`p-${i}`)
            .h(30)
            .px(6)
            .gap(6)
            .items_center()
            .rounded(7)
            .hover((s) => s.bg(t.hover))
            .tooltip(path)
            .child(svg("mods/workspace-chrome/layers.svg").size(13).flex_none())
            .child(div().flex_none().font_semibold().child(name))
            .child(
              div()
                .flex_1()
                .truncate()
                .text_size(11.5)
                .text_color(t.dim)
                .child(parent ?? ""),
            )
            .child(
              icon(
                `p-up-${i}`,
                "↑",
                "Move up",
                (_e, cx) =>
                  this.save((doc) => moveProject(doc, i, -1, path), cx),
                i > 0,
              ),
            )
            .child(
              icon(
                `p-down-${i}`,
                "↓",
                "Move down",
                (_e, cx) =>
                  this.save((doc) => moveProject(doc, i, 1, path), cx),
                i < last,
              ),
            )
            .child(
              icon(
                `p-remove-${i}`,
                "Remove",
                "Remove (its spaces stay open)",
                (_e, cx) => this.save((doc) => removeProject(doc, i, path), cx),
              ),
            ),
        ),
      )
      .when(this.loaded && !projects.length, (el) =>
        el.child(div().py(8).text_color(t.dim).child("No projects yet.")),
      );
    return v_flex()
      .size_full()
      .min_h(0)
      .gap(8)
      .child(
        h_flex()
          .items_center()
          .child(div().flex_1().text_size(15).font_semibold().child("Projects"))
          .child(
            this.button("new-project", "New project…", (_e, cx) =>
              this.newProject(cx),
            ),
          )
          .child(div().pl(10).text_size(11).text_color(t.dim).child("Esc")),
      )
      .children(
        [this.error, ...errors]
          .filter(Boolean)
          .map((e, n) =>
            div().id(`err-${n}`).text_size(11.5).text_color(t.blocked).child(e),
          ),
      )
      .child(list)
      .child(
        div().text_size(11).text_color(t.dim).child(`Saved in ${configPath()}`),
      );
  }

  key(e, cx) {
    if (e.key !== "escape") return;
    cx.stop_propagation();
    this.close();
  }

  render() {
    const p = props() ?? {};
    if (p.menu) return this.renderMenu(p);
    const t = theme();
    return v_flex()
      .id("projects-edit")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .size_full()
      .min_h(0)
      .p(18)
      .bg(t.popover)
      .text_color(t.foreground)
      .text_size(12.8)
      .child(this.renderDialog());
  }
}
