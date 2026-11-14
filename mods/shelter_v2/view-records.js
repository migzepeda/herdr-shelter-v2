// Activity, the shared Inspector, and the two popups (notifications, menu).

import { div } from "gpui-kit";
import { h_flex, v_flex, InputState } from "gpui-base";
import { run, spaces, panes, props, closeOverlay, home, setShared, exec, nextCommand } from "herdr";
import { S, R, F, pal, icon, chip, ring, stateIcon, screen, section, card, empty, button, iconButton, segments, searchBox, field, programIcon, scanlines } from "./look.js";
import {
  agentState, machineState, agentRows, machineRows, attention, go, select, selection, focusedPane, openAgent, openSpace,
  machineLabel, agentName, spaceOfTab, spaceChangedAt, spaceFolder, ago, clock, dayLabel, shortPath,
} from "./model.js";
import { events, clearEvents, KINDS } from "./activity.js";
import { agentRow, eventRow, followEvent, canFollow } from "./view-ops.js";

// --- Activity ------------------------------------------------------------------

const BIG = { size: 14, w: 100 }; // Activity detail rows, at v2's scale.
const RANGES = { today: null, day: 86400000, week: 7 * 86400000, all: Infinity };

export const activity = {
  init(v, cx) {
    v.kind = "all"; v.range = "week"; v.open = null; v.list = [];
    v.search = InputState.new({ placeholder: "Search events" });
    v.search.on("change", (_e, cx2) => cx2.notify());
    // Keyboard/CLI access: activity-kind-<all|agent|machine|alert|system>,
    // activity-range-<today|day|week>, activity-search-<text> (empty clears),
    // activity-expand-first, activity-goto-first.
    cx.spawn(async (cx2) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("activity-kind-") && KINDS[c.slice(14)]) v.kind = c.slice(14);
        else if (c.startsWith("activity-range-") && c.slice(15) in RANGES) v.range = c.slice(15);
        else if (c.startsWith("activity-search-") || c === "activity-search") v.search.set_value(c.slice(16));
        else if (c === "activity-expand-first") v.open = v.list[0]?.id ?? null;
        else if (c === "activity-goto-first" && v.list[0] && canFollow(v.list[0])) followEvent(v.list[0]);
        cx2.notify();
      }
    });
  },
  render(v) {
    const t = pal();
    const now = Date.now();
    const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime();
    const inRange = (e) => (v.range === "today" ? e.at >= startOfToday : now - e.at <= RANGES[v.range]);
    const q = v.search.value().trim().toLowerCase();
    const base = events().filter(inRange).filter((e) => !q || [e.title, e.detail].some((x) => x?.toLowerCase().includes(q)));
    const list = base.filter(KINDS[v.kind]);
    v.list = list;
    const count = (k) => base.filter(KINDS[k]).length;
    const rows = [];
    let day = null;
    for (const e of list) {
      const d = dayLabel(e.at);
      if (d !== day) {
        day = d;
        rows.push(h_flex().id(`day-${e.id}`).h(34).mt(rows.length ? S.md : 0).gap(S.md).items_center().text_size(14).text_color(t.accent)
          .child(d.toUpperCase()).child(div().flex_1().h(1).bg(t.border)));
      }
      const open = v.open === e.id;
      rows.push(v_flex().id(`evw-${e.id}`).rounded(R.ctl).when(open, (el) => el.bg(t.surface).border(1).border_color(t.border))
        .child(eventRow(e, { wide: true, onClick: (_ev, cx) => { v.open = open ? null : e.id; cx.notify(); } }))
        .when(open, (el) => el.child(v_flex().px(S.md).pb(S.md).pl(92).gap(6)
          .child(field("When", new Date(e.at).toLocaleString?.() ?? clock(e.at), BIG))
          .child(field("Type", `${e.kind} · ${e.level}`, BIG))
          .when(Boolean(e.from), (el2) => el2.child(field("Change", `${e.from} → ${e.to}`, BIG)))
          .when(Boolean(e.detail), (el2) => el2.child(field("Where", e.detail, BIG)))
          .when(e.ref?.machine !== undefined, (el2) => el2.child(field("Machine", machineLabel(e.ref.machine), BIG)))
          .when(canFollow(e), (el2) => el2.child(h_flex().pt(4).child(button(`evgo-${e.id}`, "Go to", () => followEvent(e), { icon: "focus" })))))));
    }
    const body = v_flex().gap(S.md)
      .child(h_flex().gap(S.sm).flex_wrap().items_center()
        .child(searchBox(v.search, 200))
        .child(segments("ak", [
          { id: "all", label: "All", count: count("all") }, { id: "agent", label: "Agents", count: count("agent") },
          { id: "machine", label: "Machines", count: count("machine") }, { id: "alert", label: "Alerts", count: count("alert") },
          { id: "system", label: "System", count: count("system") },
        ], v.kind, (id) => { v.kind = id; }))
        .child(div().flex_1())
        .child(segments("ar", [{ id: "today", label: "Today" }, { id: "day", label: "24h" }, { id: "week", label: "7 days" }], v.range, (id) => { v.range = id; })))
      .child(card("act-list").gap(0).children(rows.length ? rows
        : [empty(events().length ? "No events match" : "No activity recorded yet", events().length ? "Change the filter, range or search." : "Agents starting, needing you or finishing, machines connecting and spaces opening are recorded here while Herdr is open.")]))
      .child(h_flex().gap(S.sm).items_center().text_size(11).text_color(t.dim).font_family(F.data)
        .child(icon("info", 12))
        .child("Recorded by this layout while the Herdr window is open; Herdr keeps no event history, so time while it was closed is not covered. Kept 7 days."));
    return screen("acv", "Activity", "Newest first · click an event for details", [
      button("act-clear", "Clear", () => clearEvents(), { icon: "close" }),
    ], body);
  },
};

// --- Inspector ("Agent Details") -------------------------------------------------

const dur = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`; };

function hero(t, def, title, sub, glyph) {
  return v_flex().gap(S.sm)
    .child(h_flex().gap(S.md).items_center()
      .child(ring(def, 52, glyph))
      .child(v_flex().flex_1().min_w(0).gap(5)
        .child(div().truncate().text_size(21).text_color(t.accent).child(title))
        .child(h_flex().child(chip(def, { h: 24, size: 13.5 })))))
    .when(Boolean(sub), (el) => el.child(div().text_size(13.5).text_color(t.muted).child(sub)));
}

// Icon, label, value: the concept's detail rows. Rows without a value are left out.
function rows(t, list) {
  return v_flex().gap(7).py(S.md).border_t(1).border_b(1).border_color(t.border)
    .children(list.filter((r) => r[2]).map(([ic, label, value, color]) => h_flex().gap(S.md).items_center().text_size(14)
      .child(icon(ic, 17, t.muted)).child(div().w(84).flex_none().text_color(t.muted).child(label))
      .child(div().flex_1().min_w(0).truncate().font_family(F.data).text_size(13).text_color(color ?? t.foreground).child(value))));
}

function recent(t, filter) {
  const list = events().filter(filter).slice(0, 5);
  return v_flex().gap(5)
    .child(h_flex().gap(S.md).items_center().child(icon("activity", 17, t.muted)).child(div().text_size(15).text_color(t.accent).child("Recent Activity")))
    .children(list.length ? list.map((e, n) => h_flex().id(`ra-${n}`).gap(S.md).items_center().pl(4).cursor_pointer().hover((s) => s.bg(t.hover))
      .on_click(() => followEvent(e))
      .child(div().size(11).flex_none().rounded(6).bg(t[e.level === "info" ? "success" : e.level]))
      .child(div().flex_1().min_w(0).truncate().text_size(13.5).text_color(t.foreground).child(e.title))
      .child(div().flex_none().font_family(F.data).text_size(12).text_color(t.muted).child(ago(e.at))))
      : [div().pl(4).text_size(12).text_color(t.dim).font_family(F.data).child("None recorded yet.")]);
}

const actions = (list) => h_flex().gap(S.xs).flex_wrap().children(list);

function agentSection(v, t, a, p) {
  const st = agentState(a.status);
  const cwd = p?.cwd;
  return v_flex().gap(S.md)
    .child(hero(t, st, agentName(a), a.title))
    .child(rows(t, [
      ["clock", "Runtime", a.status === "working" && a.working_since ? `working ${dur(Date.now() - a.working_since)}` : a.changed_at ? `changed ${ago(a.changed_at)}` : null],
      ["monitor", "Machine", machineLabel(a.machine)],
      ["branch", "Branch", p?.branch],
      ["commit", "Commit", cwd ? v.commit(cwd, a.machine) : null],
      ["spaces", "Space", `${a.space_name} › ${a.tab_name}`],
    ]))
    .when(Boolean(a.title), (el) => el.child(v_flex().gap(4)
      .child(h_flex().gap(S.md).items_center().child(icon("task", 17, t.muted)).child(div().text_size(15).text_color(t.accent).child("Current Task")))
      .child(div().pl(29).text_size(14).text_color(t.foreground).child(a.title))))
    .child(recent(t, (e) => e.ref?.agent === a.address))
    .child(actions([
      button("ia-open", "Open terminal", () => openAgent(a), { icon: "focus", primary: true }),
      button("ia-peek", "Peek", () => run("terminal.peek", { terminal: a.address }), { icon: "peek" }),
      button("ia-pin", a.pinned ? "Unpin" : "Pin", () => run("terminal.pin", { terminal: a.address, pinned: !a.pinned }), { icon: "pin" }),
    ]));
}

function paneSection(v, t, p) {
  const a = p.terminal && agentRows().find((x) => x.address === p.terminal);
  if (a) return agentSection(v, t, a, p);
  const space = spaceOfTab(p.tab);
  const tab = space?.tabs.find((x) => x.id === p.tab);
  const name = (p.program?.shell && p.program.name) || p.title || p.program?.name || "Terminal";
  return v_flex().gap(S.md)
    .child(hero(t, { label: p.mod ? "Panel" : "Terminal", icon: "prompt", tone: "neutral" }, name, p.title && p.title !== name ? p.title : null, "prompt"))
    .child(rows(t, [
      ["monitor", "Machine", machineLabel(space?.machine ?? null)],
      ["folder", "Folder", p.cwd ? shortPath(p.cwd, home()) : null],
      ["branch", "Branch", p.branch],
      ["commit", "Commit", p.cwd ? v.commit(p.cwd, space?.machine ?? null) : null],
      ["spaces", "Space", space && tab ? `${space.name} › ${tab.name}` : null],
    ]))
    .child(actions([
      button("ip-focus", "Focus", () => { run("pane.focus", { pane: p.pane }); go("terminal"); }, { icon: "focus", primary: true }),
      button("ip-right", "Split right", () => run("pane.split", { direction: "right", pane: p.pane }), { icon: "split-right" }),
      button("ip-down", "Split down", () => run("pane.split", { direction: "down", pane: p.pane }), { icon: "split-down" }),
    ]));
}

function machineSection(t, m) {
  const key = m.name ?? "";
  return v_flex().gap(S.md)
    .child(hero(t, machineState(m.layout), machineLabel(m.name), m.local ? "This computer" : "Remote machine over ssh", m.local ? "monitor" : "machines-fill"))
    .child(rows(t, [
      ["spaces", "Spaces", String(m.spaces)], ["robot", "Agents", String(m.agents)],
      ["alert", "Waiting", m.blocked ? String(m.blocked) : null, t.warning],
    ]))
    .child(recent(t, (e) => e.kind === "machine" && (e.ref?.machine ?? null) === m.name))
    .child(actions([
      ...(m.layout === "ready" ? [button("im-new", "New space here", () => { run("space.new", { machine: key }); go("terminal"); }, { icon: "plus", primary: true })] : []),
      ...(m.local ? [] : [button("im-set", "Machine settings", () => run("app.settings", { section: "machines" }), { icon: "system" })]),
    ]));
}

function spaceSection(t, s) {
  const ag = agentRows().filter((a) => a.space === s.id);
  const st = s.status ? agentState(s.status) : { label: "No agents", icon: "folder-fill", tone: "neutral" };
  return v_flex().gap(S.md)
    .child(hero(t, st, s.name, shortPath(spaceFolder(s), home()), "folder-fill"))
    .child(rows(t, [
      ["monitor", "Machine", machineLabel(s.machine)], ["branch", "Branch", s.branch],
      ["copy", "Tabs", String(s.tabs.length)], ["robot", "Agents", String(ag.length)],
      ["clock", "Changed", spaceChangedAt(s) ? ago(spaceChangedAt(s)) : null],
    ]))
    .when(ag.length > 0, (el) => el.child(v_flex().gap(4).children(ag.map((a) => agentRow(a, { compact: true, prefix: "is-" })))))
    .child(recent(t, (e) => e.ref?.space === s.id))
    .child(actions([
      button("is-open", "Open", () => openSpace(s.id), { icon: "focus", primary: true }),
      button("is-tab", "New tab", () => { run("tab.new", { space: s.id }); go("terminal"); }, { icon: "plus" }),
      button("is-ren", "Rename", () => run("space.rename", { id: s.id }), { icon: "rename" }),
    ]));
}

const COMMIT_TTL = 30000;

export const inspector = {
  init(v, cx) {
    // Short HEAD per folder, read with git where the pane lives; cached 30 s.
    v.commits = {};
    v.commit = (cwd, machine) => {
      const key = `${machine ?? ""}|${cwd}`, hit = v.commits[key];
      if (!hit || Date.now() - hit.at > COMMIT_TTL) {
        v.commits[key] = { at: Date.now(), value: hit?.value ?? null };
        v.spawn?.(async (cx2) => {
          try {
            const r = await exec("git", ["rev-parse", "--short", "HEAD"], { cwd, on: machine, timeout: 5000 });
            v.commits[key] = { at: Date.now(), value: r.code === 0 ? r.stdout.trim() : null };
          } catch { v.commits[key] = { at: Date.now(), value: null }; }
          cx2.notify();
        });
      }
      return v.commits[key].value;
    };
    // Runtime text moves on its own once a minute.
    cx.timer.every(60000, (cx2) => cx2.notify());
  },
  render(v, cx) {
    v.spawn = (fn) => cx.spawn(fn);
    const t = pal();
    const sel = selection();
    let content = null, kind = "Details";
    if (sel?.kind === "agent") { const a = agentRows().find((x) => x.address === sel.id); if (a) { content = agentSection(v, t, a, panes().find((x) => x.pane === a.pane)); kind = "Agent Details"; } }
    else if (sel?.kind === "machine") { const m = machineRows().find((x) => (x.name ?? "") === sel.id); if (m) { content = machineSection(t, m); kind = "Machine Details"; } }
    else if (sel?.kind === "space") { const s = spaces().find((x) => x.id === sel.id); if (s) { content = spaceSection(t, s); kind = "Space Details"; } }
    else if (sel?.kind === "pane") { const p = panes().find((x) => x.pane === sel.id); if (p) { content = paneSection(v, t, p); kind = p.status ? "Agent Details" : "Pane Details"; } }
    const following = !content;
    if (!content) { const p = focusedPane(); if (p) { content = paneSection(v, t, p); kind = p.status ? "Agent Details" : "Pane Details"; } }
    return v_flex().id("insp").size_full().relative().overflow_hidden().bg(t.canvas).p(S.sm)
      .child(scanlines())
      .child(v_flex().size_full().relative().rounded(R.major).border(1).border_color(t.input).bg(t.surface).overflow_hidden()
        .child(scanlines())
        .child(h_flex().flex_none().h(44).px(S.md).gap(S.sm).items_center().border_b(1).border_color(t.input)
          .child(icon("info", 19, t.accent)).child(div().flex_1().text_size(18).text_color(t.foreground).child(kind.toUpperCase()))
          .when(!following, (el) => el.child(iconButton("insp-follow", "focus", "Back to the focused pane", () => setShared("shelter_v2.selection", null), { size: 26, iconSize: 14 })))
          .child(iconButton("insp-close", "close", "Hide details (Ctrl+Shift+I)", () => run("layout.hide", { id: "inspector" }), { size: 26, iconSize: 14 })))
        .child(v_flex().id("insp-scroll").flex_1().min_h(0).overflow_y_scrollbar().p(S.lg)
          .child(content ?? empty("Nothing selected", "Click an agent, space, machine or pane to see its details."))));
  },
};


// --- popups ----------------------------------------------------------------------

export const alerts = {
  render() {
    const t = pal();
    const items = attention();
    const close = () => closeOverlay(props()?.overlay);
    const row = (i, n) => {
      const tone = i.level;
      const title = i.kind === "agent" ? `${agentName(i.agent)} ${i.agent.status === "blocked" ? "needs you" : "finished"}` : `${machineLabel(i.machine.name)} unavailable`;
      const sub = i.kind === "agent" ? `${i.agent.space_name} › ${i.agent.tab_name}` : "Check Settings › Machines";
      return h_flex().id(`al-${n}`).p(S.sm).gap(S.sm).items_start().rounded(R.ctl).cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click(() => { close(); if (i.kind === "agent") openAgent(i.agent); else go("machines"); })
        .child(div().pt(1).child(icon(tone === "warning" ? "alert" : tone === "error" ? "error" : "check", 14, t[tone])))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_size(12.5).text_color(i.alert ? t[tone] : t.foreground).child(title))
          .child(div().truncate().text_size(11).font_family(F.data).text_color(t.dim).child(sub)));
    };
    return v_flex().id("alerts").size_full().bg(t.popover).p(S.sm).gap(S.sm)
      .child(h_flex().px(S.xs).items_center().child(div().flex_1().text_size(12).text_color(t.foreground).child("NOTIFICATIONS"))
        .child(div().text_size(10.5).text_color(t.dim).child(`${items.filter((i) => i.alert).length} ALERTS`)))
      .child(v_flex().id("al-list").max_h(340).overflow_y_scrollbar().gap(2)
        .children(items.length ? items.map(row) : [empty("All clear", "No agent needs you and every machine is reachable.")]))
      .child(h_flex().pt(S.xs).border_t(1).border_color(t.border).gap(S.sm)
        .child(button("al-act", "Activity", () => { close(); go("activity"); }, { icon: "activity" }))
        .child(button("al-board", "Agent Board", () => { close(); go("board"); }, { icon: "board" })));
  },
};

// Items: { label, run?: [command, args], agent?: address, select?: [kind, id] }.
export const menu = {
  render() {
    const t = pal();
    const { items = [], overlay } = props() ?? {};
    return v_flex().id("wmenu").size_full().bg(t.popover).p(S.xs).gap(2).children(items.map((it, n) =>
      h_flex().id(`mi-${n}`).h(30).px(S.sm).items_center().rounded(R.ctl).cursor_pointer().text_size(12.5).text_color(t.foreground)
        .hover((s) => s.bg(t.hover))
        .on_click(() => {
          closeOverlay(overlay);
          if (it.run) run(it.run[0], it.run[1]);
          if (it.agent) { const a = agentRows().find((x) => x.address === it.agent); if (a) openAgent(a); }
          if (it.select) select(it.select[0], it.select[1]);
        })
        .child(it.label)));
  },
};
