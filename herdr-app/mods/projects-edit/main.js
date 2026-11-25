// Projects editing for the `projects` sidebar: the Projects dialog (cmd-k p,
// `mod.open {name: "projects-edit"}`) and the sidebar's popups, chosen by props:
//   (none) or { form }                     the dialog; form: { kind: "new" | "rename", project?, name?, addRepo? }
//   { menu: "project", project, name }     Rename…, Move up/down, Remove
//   { menu: "repo", project, name, path, machine }   Remove from project
//   { menu: "other", space, machine, path }          Add to project ▸, New project…, space menu
//   { menu: "tab", space, machine, folder }          Terminal and agents, started at folder
//
// Every write is writeTextFile(path, text, last read): an edit made meanwhile
// is never overwritten; the edit is dropped with a notification to retry.
// Popup rows and the name field follow Herdr 0.1.16's shipped `new-menu` and
// `prompt` mods (Apache License 2.0, LICENSE in this folder).

import { h_flex, Input, InputState, v_flex } from "gpui-base";
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
  panes,
  pickFolder,
  props,
  readTextFile,
  run,
  spaces,
  theme,
  writeTextFile,
} from "herdr";
import { clickItem, menuWrites, saveConfig } from "./edit.js";
import {
  addProject,
  addRepo,
  CONFIG_FILE,
  loadConfig,
  mainCheckout,
  moveProject,
  removeProject,
  removeRepo,
  renameProject,
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

// Where a space is now: its first terminal's live folder, else where it was made.
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// Each machine's home, for "~" in projects.json: unknown ones are left out.
async function homesFor(names) {
  const homes = { "": home() };
  await Promise.all(
    names.map(async (m) => {
      try {
        const r = await exec("sh", ["-c", 'printf %s "$HOME"'], { on: m });
        if (r.code === 0 && r.stdout.trim()) homes[m] = r.stdout.trim();
      } catch {}
    }),
  );
  return homes;
}

// Reads projects.json, applies change(doc, homes) and writes it if nothing
// changed it meanwhile. Resolves true when written.
async function update(change, extraMachines = []) {
  const result = await saveConfig(
    {
      read: () => readTextFile(configPath()),
      write: (text, expected) => writeTextFile(configPath(), text, expected),
      homesFor,
    },
    change,
    extraMachines,
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
    this.openRepos = null; // repos of open spaces: [{ path, machine }], null while looking
    this.adding = null; // dialog: the project index whose Add repo panel is open
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.load(cx);
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
    if (!p.menu) this.startForm(p.form ?? null, cx);
  }

  load(cx) {
    cx.spawn((cx) => this.read(cx));
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
  save(change, cx, machines) {
    cx.spawn((cx) => this.persist(change, cx, machines));
  }

  async persist(change, cx, machines) {
    await update(change, machines);
    await this.read(cx);
  }

  // A popup's edit: the popup closes once it is written (or refused).
  write(change, machines) {
    return (_e, cx) =>
      cx.spawn(async () => {
        this.busy = true;
        await update(change, machines);
        this.close();
      });
  }

  close() {
    closeOverlay(props().overlay);
  }

  // A name field (new project, rename) or a machine and path (a repo elsewhere).
  startForm(form, cx) {
    this.form = form;
    if (!form) return;
    const field = (value) => {
      const input = InputState.new({ value });
      if (value) input.set_selected_range({ start: 0, end: value.length });
      input.on("change", (_e, cx) => cx.notify());
      input.on("submit", (_e, cx) => this.submitForm(cx));
      return input;
    };
    this.nameInput = field(form.name ?? "");
    this.machineInput =
      form.kind === "remote" ? field(form.machine ?? "") : null;
    this.pathInput = form.kind === "remote" ? field("") : null;
    (this.machineInput ?? this.nameInput).focus();
    cx.timer.after(600, () => (this.machineInput ?? this.nameInput).focus());
  }

  submitForm(cx) {
    const form = this.form;
    if (!form) return;
    const name = this.nameInput.value().trim();
    let change,
      machines = [];
    if (form.kind === "new") {
      const repo = form.addRepo;
      machines = [repo?.machine];
      change = (doc, homes) => {
        const next = addProject(doc, name);
        return repo
          ? addRepo(next, next.projects.length - 1, repo, homes)
          : next;
      };
    } else if (form.kind === "rename") {
      change = (doc) => renameProject(doc, form.project, name, form.name);
    } else {
      const machine = this.machineInput.value().trim();
      const path = this.pathInput.value().trim();
      if (!path) return;
      machines = [machine];
      change = (doc, homes) =>
        addRepo(
          doc,
          form.project,
          { path, machine: machine || null },
          homes,
          form.projectName,
        );
    }
    // Opened for this form alone (from the sidebar): it closes once written.
    const alone = Boolean(props()?.form);
    if (!alone) this.form = null;
    cx.spawn(async (cx) => {
      await this.persist(change, cx, machines);
      if (alone) this.close();
    });
    cx.notify();
  }

  // The repos open spaces are in, once, for the dialog's Add repo panel.
  lookForOpenRepos(cx) {
    if (this.openRepos || this.looking || checking()) return;
    this.looking = true;
    cx.spawn(async (cx) => {
      const ps = panes();
      const places = [
        ...new Map(
          spaces().map((s) => [
            JSON.stringify([s.machine ?? null, place(s, ps)]),
            s,
          ]),
        ).keys(),
      ];
      const homes = await homesFor([
        ...new Set(
          spaces()
            .map((s) => s.machine)
            .filter(Boolean),
        ),
      ]);
      const found = new Map();
      await Promise.all(
        places.map(async (k) => {
          const [on, cwd] = JSON.parse(k);
          if (!cwd) return;
          try {
            const r = await exec(
              "git",
              ["rev-parse", "--path-format=absolute", "--git-common-dir"],
              { cwd, on },
            );
            if (r.code !== 0) return;
            const path = tildePath(mainCheckout(r.stdout), homes[on ?? ""]);
            found.set(JSON.stringify([on, path]), { path, machine: on });
          } catch {}
        }),
      );
      this.openRepos = [...found.values()].sort(
        (a, b) =>
          (a.machine ?? "").localeCompare(b.machine ?? "") ||
          a.path.localeCompare(b.path),
      );
      cx.notify();
    });
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
    const names = (this.doc.projects ?? []).map((project) => project.name);
    const writes = menuWrites(p, names, (change, machines) =>
      this.write(change, machines),
    );
    const item = (...args) => [this.item(...args), ROW.item];
    const heading = (text) => [this.heading(text), ROW.heading];
    const rule = () => [this.rule(), ROW.rule];
    switch (p.menu) {
      case "project": {
        const at = p.project,
          last = names.length - 1;
        return {
          list: [
            item("rename", "Rename…", () =>
              openOverlay({
                ...DIALOG,
                props: { form: { kind: "rename", project: at, name: p.name } },
              }),
            ),
            item("up", "Move up", writes.up, { enabled: at > 0 }),
            item("down", "Move down", writes.down, { enabled: at < last }),
            rule(),
            item("remove", "Remove", writes.remove, {
              hint: "spaces stay open",
            }),
          ],
        };
      }
      case "repo":
        return {
          list: [
            item("remove", "Remove from project", writes.remove, {
              hint: p.name,
            }),
          ],
        };
      case "other": {
        const repo = { path: p.path, machine: p.machine ?? null };
        return {
          head: [heading(`Add ${p.path.split("/").pop()} to project`)],
          list: names.map((name, i) =>
            item(`add-${i}`, name, writes[`add-${i}`]),
          ),
          foot: [
            item("new", "New project…", () =>
              openOverlay({
                ...DIALOG,
                props: { form: { kind: "new", addRepo: repo } },
              }),
            ),
            rule(),
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
      }
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
    const waiting = !this.loaded && p.menu !== "tab";
    const {
      head = [],
      list = [],
      foot = [],
    } = waiting ? { list: [[this.note("…"), ROW.note]] } : this.menuParts(p);
    if (this.error && p.menu !== "tab")
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

  button(id, text, action, { primary = false, enabled = true } = {}) {
    const t = theme();
    return h_flex()
      .id(id)
      .h(26)
      .px(10)
      .flex_none()
      .items_center()
      .rounded(7)
      .border_1()
      .border_color(primary ? t.solid : t.input)
      .bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : enabled ? t.foreground : t.dim)
      .text_size(12)
      .when(enabled, (el) =>
        el
          .cursor_pointer()
          .hover((s) => s.opacity(0.88))
          .on_click(action),
      )
      .child(text);
  }

  field(state) {
    const t = theme();
    return Input.new(state)
      .h(32)
      .px(10)
      .rounded(8)
      .border_1()
      .border_color(t.input)
      .bg(t.background)
      .text_size(12.8)
      .text_color(t.foreground);
  }

  renderForm() {
    const t = theme();
    const f = this.form;
    const title =
      f.kind === "new"
        ? "New project"
        : f.kind === "rename"
          ? `Rename ${f.name}`
          : `Add a repo on a machine to ${f.projectName}`;
    const label = (text) =>
      div().pt(12).pb(6).text_size(11.5).text_color(t.dim).child(text);
    const cancel = (_e, cx) => {
      this.form = null;
      if (props()?.form) this.close();
      else cx.notify();
    };
    return v_flex()
      .gap(0)
      .child(div().text_size(15).font_semibold().child(title))
      .when(f.kind === "remote", (el) =>
        el
          .child(label("Machine (empty: this computer)"))
          .child(this.field(this.machineInput))
          .child(label("Main checkout folder on it, like ~/src/app"))
          .child(this.field(this.pathInput)),
      )
      .when(f.kind !== "remote", (el) =>
        el.child(label("Name")).child(this.field(this.nameInput)),
      )
      .when(Boolean(f.addRepo), (el) =>
        el.child(
          div()
            .pt(6)
            .text_size(11.5)
            .text_color(t.dim)
            .child(
              `with ${f.addRepo.path}${f.addRepo.machine ? ` on ${f.addRepo.machine}` : ""}`,
            ),
        ),
      )
      .child(
        h_flex()
          .pt(18)
          .gap(8)
          .justify_end()
          .child(this.button("form-cancel", "Cancel", cancel))
          .child(
            this.button(
              "form-save",
              f.kind === "remote" ? "Add" : "Save",
              (_e, cx) => this.submitForm(cx),
              { primary: true },
            ),
          ),
      );
  }

  renderAdd(index, project) {
    const t = theme();
    const listed = new Set(
      (project.repos ?? []).map((r) => JSON.stringify([r.machine, r.path])),
    );
    const choices = (this.openRepos ?? []).filter(
      (r) => !listed.has(JSON.stringify([r.machine, r.path])),
    );
    const add = (repo) => (_e, cx) => {
      this.adding = null;
      this.save(
        (doc, homes) => addRepo(doc, index, repo, homes, project.name),
        cx,
        [repo.machine],
      );
    };
    return v_flex()
      .ml(18)
      .mt(4)
      .mb(6)
      .p(8)
      .gap(4)
      .rounded(8)
      .bg(t.raised)
      .child(div().text_size(11).text_color(t.dim).child("From an open space"))
      .when(this.openRepos === null, (el) =>
        el.child(div().text_size(12).text_color(t.dim).child("Looking…")),
      )
      .when(this.openRepos !== null && !choices.length, (el) =>
        el.child(
          div()
            .text_size(12)
            .text_color(t.dim)
            .child("No other repos are open."),
        ),
      )
      .children(
        choices.map((r, i) =>
          h_flex()
            .id(`open-${index}-${i}`)
            .h(24)
            .px(6)
            .gap(6)
            .items_center()
            .rounded(6)
            .cursor_pointer()
            .hover((s) => s.bg(t.hover))
            .on_click(add(r))
            .child(div().flex_1().truncate().child(r.path))
            .when(Boolean(r.machine), (el) =>
              el.child(div().text_size(11).text_color(t.dim).child(r.machine)),
            ),
        ),
      )
      .child(
        h_flex()
          .pt(4)
          .gap(6)
          .child(
            this.button(`folder-${index}`, "Choose a folder…", (_e, cx) =>
              cx.spawn(async (cx) => {
                const folder = await pickFolder({ prompt: "Add" });
                if (!folder) return;
                let path = folder;
                try {
                  const r = await exec(
                    "git",
                    ["rev-parse", "--path-format=absolute", "--git-common-dir"],
                    { cwd: folder },
                  );
                  if (r.code === 0) path = mainCheckout(r.stdout);
                } catch {}
                this.adding = null;
                const repo = { path: tildePath(path, home()), machine: null };
                await this.persist(
                  (doc, homes) =>
                    addRepo(doc, index, repo, homes, project.name),
                  cx,
                  [],
                );
              }),
            ),
          )
          .child(
            this.button(`remote-${index}`, "On a machine…", (_e, cx) => {
              this.adding = null;
              this.startForm(
                { kind: "remote", project: index, projectName: project.name },
                cx,
              );
              cx.notify();
            }),
          ),
      );
  }

  renderDialog() {
    const t = theme();
    const { projects, errors } = resolveProjects(this.doc, { "": home() });
    const last = projects.length - 1;
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
        projects.flatMap((project) => {
          const i = project.index,
            name = project.name;
          const head = h_flex()
            .id(`p-${i}`)
            .h(30)
            .px(6)
            .gap(6)
            .items_center()
            .rounded(7)
            .hover((s) => s.bg(t.hover))
            .child(svg("mods/workspace-chrome/layers.svg").size(13).flex_none())
            .child(div().flex_1().truncate().font_semibold().child(name))
            .child(
              icon(
                `p-up-${i}`,
                "↑",
                "Move up",
                (_e, cx) =>
                  this.save((doc) => moveProject(doc, i, -1, name), cx),
                i > 0,
              ),
            )
            .child(
              icon(
                `p-down-${i}`,
                "↓",
                "Move down",
                (_e, cx) =>
                  this.save((doc) => moveProject(doc, i, 1, name), cx),
                i < last,
              ),
            )
            .child(
              icon(`p-rename-${i}`, "Rename", "Rename", (_e, cx) => {
                this.startForm({ kind: "rename", project: i, name }, cx);
                cx.notify();
              }),
            )
            .child(
              icon(
                `p-add-${i}`,
                this.adding === i ? "Done" : "Add repo",
                "Add a repo",
                (_e, cx) => {
                  this.adding = this.adding === i ? null : i;
                  if (this.adding !== null) this.lookForOpenRepos(cx);
                  cx.notify();
                },
              ),
            )
            .child(
              icon(
                `p-remove-${i}`,
                "Remove",
                "Remove (its spaces stay open)",
                (_e, cx) => this.save((doc) => removeProject(doc, i, name), cx),
              ),
            );
          const repos = project.repos.map((repo, n) =>
            h_flex()
              .id(`r-${i}-${n}`)
              .h(26)
              .pl(26)
              .pr(6)
              .gap(6)
              .items_center()
              .rounded(7)
              .hover((s) => s.bg(t.hover))
              .child(
                svg("mods/workspace-chrome/folder.svg").size(12).flex_none(),
              )
              .child(
                div().flex_1().truncate().text_color(t.muted).child(repo.path),
              )
              .when(Boolean(repo.machine), (el) =>
                el.child(
                  div()
                    .flex_none()
                    .text_size(11)
                    .text_color(t.dim)
                    .child(repo.machine),
                ),
              )
              .child(
                icon(
                  `r-remove-${i}-${n}`,
                  "×",
                  "Remove from project",
                  (_e, cx) =>
                    this.save(
                      (doc, homes) =>
                        removeRepo(
                          doc,
                          i,
                          { path: repo.path, machine: repo.machine },
                          homes,
                          name,
                        ),
                      cx,
                      [repo.machine],
                    ),
                ),
              ),
          );
          const empty = project.repos.length
            ? []
            : [
                div()
                  .pl(26)
                  .py(3)
                  .text_size(12)
                  .text_color(t.dim)
                  .child("No repos yet."),
              ];
          return [
            head,
            ...repos,
            ...empty,
            ...(this.adding === i
              ? [this.renderAdd(i, this.doc.projects[i])]
              : []),
          ];
        }),
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
            this.button("new-project", "New project", (_e, cx) => {
              this.startForm({ kind: "new" }, cx);
              cx.notify();
            }),
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
    if (this.form && !props()?.form) {
      this.form = null;
      cx.notify();
    } else this.close();
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
      .child(this.form ? this.renderForm() : this.renderDialog());
  }
}
