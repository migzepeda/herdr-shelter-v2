// Operational destinations: Overview, Agent Board, Spaces, Machines.

import { div } from "gpui-kit";
import { h_flex, v_flex, InputState } from "gpui-base";
import { run, spaces, openOverlay, setAgentOrder, home, nextCommand } from "herdr";
import { S, R, F, pal, icon, chip, stateIcon, screen, section, card, empty, button, iconButton, segments, searchBox, programIcon } from "./look.js";
import {
  AGENT_STATES, agentState, machineState, agentRows, machineRows, attention, counts, systemState, go, select, selection,
  openAgent, openSpace, machineLabel, agentName, spaceChangedAt, spaceFolder, ago, clock, shortPath,
} from "./model.js";
import { events, KINDS } from "./activity.js";

const stop = (_e, cx) => cx.stop_propagation();
const TONE_ICON = { success: "check", warning: "alert", error: "error", info: "info" };
const toneOf = (level) => (level === "info" ? "info" : level);

function menu(items) {
  openOverlay({ mod: "shelter_v2", kind: "popup", width: 210, height: 34 * items.length + 12, props: { view: "menu", items } });
}

// An agent's actions (right-click on its row, or the agent-menu command).
function openAgentMenu(a) {
  menu([
    { label: "Open terminal", agent: a.address },
    { label: "Peek", run: ["terminal.peek", { terminal: a.address }] },
    { label: a.pinned ? "Unpin" : "Pin to top", run: ["terminal.pin", { terminal: a.address, pinned: !a.pinned }] },
    { label: "Inspect", select: ["agent", a.address] },
  ]);
}

// Shared row for an agent: Overview attention, Board, Inspector lists.
export function agentRow(a, opts = {}) {
  const t = pal(), st = agentState(a.status);
  const picked = selection()?.kind === "agent" && selection()?.id === a.address;
  return h_flex().id(`ag-${opts.prefix ?? ""}${a.address}`).h(38).px(S.sm).gap(S.md).items_center().rounded(R.ctl).cursor_pointer().text_size(15)
    .bg(picked ? t.accent + "14" : "#00000000").border(1).border_color(picked ? t.accent + "55" : "#00000000")
    .hover((s) => s.bg(t.hover))
    .on_click((e) => (e.click_count === 2 ? openAgent(a) : select("agent", a.address)))
    .on_mouse_down("right", (_e, cx) => {
      cx.stop_propagation();
      openAgentMenu(a);
    })
    // Compact rows keep the icon (with its word as a tooltip) to save width.
    .child(opts.compact
      ? div().id(`ast-${opts.prefix ?? ""}${a.address}`).flex_none().tooltip(st.label).child(stateIcon(st, 12))
      : div().w(130).flex_none().child(chip(st, { h: 24, size: 13 })))
    .child(programIcon(a.program, 13))
    .child(div().flex_none().max_w(150).truncate().text_color(t.foreground).child(agentName(a)))
    .when(a.pinned, (el) => el.child(icon("pin", 11, t.dim)))
    .child(div().flex_1().min_w(0).truncate().text_color(t.muted).font_family(F.data).text_size(13).child(a.title || ""))
    .when(!opts.compact, (el) => el
      .child(div().flex_none().max_w(240).truncate().text_color(t.foreground).text_size(14).child(`${a.space_name} › ${a.tab_name}`))
      .when(opts.showMachine, (el2) => el2.child(div().w(90).flex_none().truncate().text_color(t.dim).text_size(11).child(machineLabel(a.machine))))
      .child(div().w(80).flex_none().text_right().font_family(F.data).text_size(13).text_color(t.dim).child(ago(a.changed_at) ?? "—")))
    .child(iconButton(`ago-${opts.prefix ?? ""}${a.address}`, "focus", "Open terminal", () => openAgent(a), { size: 22, iconSize: 12 }));
}

export function eventRow(e, opts = {}) {
  const t = pal(), tone = toneOf(e.level);
  return h_flex().id(`ev-${opts.prefix ?? ""}${e.id}`).min_h(38).px(S.sm).gap(S.md).items_center().rounded(R.ctl).text_size(15)
    .when(Boolean(opts.onClick), (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(opts.onClick))
    .child(div().w(52).flex_none().font_family(F.data).text_size(13).text_color(t.muted).child(clock(e.at)))
    .child(icon(TONE_ICON[e.level] ?? "info", 16, t[tone]))
    .child(div().flex_none().max_w(opts.wide ? 520 : 300).truncate().text_color(e.level === "info" ? t.foreground : t[tone]).child(e.title))
    .child(div().flex_1().min_w(0).truncate().font_family(F.data).text_size(13).text_color(t.muted).child(e.detail ?? ""));
}

// Whether what an event is about still exists to go to (a closed space or ended
// agent doesn't). Machine events always lead to the Machines screen.
export function canFollow(e) {
  const r = e.ref ?? {};
  return Boolean((r.agent && agentRows().some((x) => x.address === r.agent))
    || (r.space && spaces().some((s) => s.id === r.space)) || e.kind === "machine");
}

// Jump to what an event is about, if it still exists.
export function followEvent(e) {
  const r = e.ref ?? {};
  const a = r.agent && agentRows().find((x) => x.address === r.agent);
  if (a) return openAgent(a);
  if (r.space && spaces().some((s) => s.id === r.space)) return openSpace(r.space);
  if (e.kind === "machine") return go("machines");
  go("activity");
}

// --- Agent Board ---------------------------------------------------------------

const SORTS = {
  state: (a, b) => agentState(a.status).order - agentState(b.status).order || b.seq - a.seq,
  space: (a, b) => a.space_name.localeCompare(b.space_name) || a.tab_index - b.tab_index,
  recent: (a, b) => b.seq - a.seq,
};

export const board = {
  init(v, cx) {
    v.width = 1000; v.state = "all"; v.sort = "state"; v.provider = "all"; v.machine = "all";
    v.search = InputState.new({ placeholder: "Search agents" });
    v.search.on("change", (_e, cx) => cx.notify());
    v.list = [];
    // "shelter_v2.agent-menu": the selected agent's menu, else the first listed.
    cx.spawn(async (cx2) => {
      for (;;) {
        if ((await nextCommand()) === "agent-menu") {
          const sel = selection();
          const a = (sel?.kind === "agent" && v.list.find((x) => x.address === sel.id)) || v.list[0];
          if (a) openAgentMenu(a);
        }
        cx2.notify();
      }
    });
  },
  render(v) {
    const t = pal();
    const all = agentRows();
    const q = v.search.value().trim().toLowerCase();
    const providers = [...new Set(all.map((a) => a.program?.name ?? "Agent"))];
    const machinesSeen = [...new Set(all.map((a) => machineLabel(a.machine)))];
    const list = all
      .filter((a) => v.state === "all" || a.status === v.state)
      .filter((a) => v.provider === "all" || (a.program?.name ?? "Agent") === v.provider)
      .filter((a) => v.machine === "all" || machineLabel(a.machine) === v.machine)
      .filter((a) => !q || [agentName(a), a.title, a.space_name, a.tab_name, a.app].some((x) => x?.toLowerCase().includes(q)))
      .sort((a, b) => (b.pinned - a.pinned) || SORTS[v.sort](a, b));
    setAgentOrder(list.map((a) => a.address));
    v.list = list;
    const n = (s) => all.filter((a) => a.status === s).length;
    const stateSeg = segments("bs", [{ id: "all", label: "All", count: all.length }, ...Object.values(AGENT_STATES).map((s) => ({ id: s.id, label: s.label, count: n(s.id) }))], v.state, (id) => { v.state = id; });
    const toolbar = h_flex().gap(S.sm).flex_wrap().items_center()
      .child(searchBox(v.search, 200)).child(stateSeg)
      .child(div().flex_1())
      .child(div().text_size(10.5).text_color(t.dim).child("SORT"))
      .child(segments("bo", [{ id: "state", label: "State" }, { id: "space", label: "Space" }, { id: "recent", label: "Recent" }], v.sort, (id) => { v.sort = id; }));
    const extra = h_flex().gap(S.sm).flex_wrap()
      .when(providers.length > 1, (el) => el.child(segments("bp", [{ id: "all", label: "All providers" }, ...providers.map((p) => ({ id: p, label: p }))], v.provider, (id) => { v.provider = id; })))
      .when(machinesSeen.length > 1, (el) => el.child(segments("bm", [{ id: "all", label: "All machines" }, ...machinesSeen.map((m) => ({ id: m, label: m }))], v.machine, (id) => { v.machine = id; })));
    const compact = v.width < 760;
    const showMachine = machinesSeen.length > 1;
    // Grouped by state when sorted by state; a flat list otherwise.
    const groups = v.sort === "state"
      ? [...Object.values(AGENT_STATES)].map((s) => ({ s, rows: list.filter((a) => a.status === s.id) })).filter((g) => g.rows.length)
      : [{ s: null, rows: list }];
    const body = v_flex().gap(S.md).child(toolbar).child(extra)
      .children(list.length ? groups.map((g) => v_flex().gap(2)
        .when(Boolean(g.s), (el) => el.child(h_flex().h(30).gap(8).items_center().text_size(14).text_color(t[g.s.tone])
          .child(stateIcon(g.s, 11)).child(`${g.s.label.toUpperCase()} · ${g.rows.length}`).child(div().flex_1().h(1).bg(t.border))))
        .children(g.rows.map((a) => agentRow(a, { compact, showMachine, prefix: "bd-" }))))
        : [card("bd-empty").child(all.length
          ? empty("No agents match", "Clear the search or pick another filter.")
          : empty("No agents running", "Agents appear here when a program reports its state to Herdr (Claude Code, Codex, pi, ...). Start one from the + menu in the tab bar."))]);
    return v_flex().id("bd-root").size_full().on_size_change((s, cx) => { v.width = s.width; cx.notify(); })
      .child(screen("bd", `Agents (${all.length})`, "Click to inspect · double-click to open its terminal · right-click for actions", [
        button("bd-new", "New agent", () => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }), { icon: "plus" }),
      ], body));
  },
};

// --- Spaces --------------------------------------------------------------------

export const spacesView = {
  init(v) {
    v.sort = "order";
    v.search = InputState.new({ placeholder: "Search spaces" });
    v.search.on("change", (_e, cx) => cx.notify());
  },
  render(v) {
    const t = pal();
    const ag = agentRows();
    const q = v.search.value().trim().toLowerCase();
    const sorts = { order: () => 0, name: (a, b) => a.name.localeCompare(b.name), recent: (a, b) => (spaceChangedAt(b) ?? 0) - (spaceChangedAt(a) ?? 0) };
    const list = spaces().filter((s) => !q || [s.name, s.branch, s.folder, s.machine].some((x) => x?.toLowerCase().includes(q))).sort(sorts[v.sort]);
    const picked = selection()?.kind === "space" ? selection().id : null;
    const head = h_flex().h(32).px(S.sm).gap(S.sm).items_center().text_size(13).text_color(t.dim)
      .child(div().w(16)).child(div().flex_1().child("NAME")).child(div().w(110).child("MACHINE")).child(div().w(140).child("BRANCH"))
      .child(div().w(48).text_right().child("TABS")).child(div().w(56).text_right().child("AGENTS")).child(div().w(70).text_right().child("CHANGED")).child(div().w(56));
    const row = (s) => {
      const n = ag.filter((a) => a.space === s.id).length;
      const st = s.status ? agentState(s.status) : null;
      return h_flex().id(`spr-${s.id}`).h(46).px(S.sm).gap(S.sm).items_center().rounded(R.ctl).cursor_pointer().text_size(15)
        .bg(picked === s.id ? t.accent + "14" : s.active ? t.raised : "#00000000").hover((x) => x.bg(t.hover))
        .on_click((e) => (e.click_count === 2 ? openSpace(s.id) : select("space", s.id)))
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "space", target: { id: s.id } } }); })
        .child(div().w(16).flex().justify_center().child(st ? stateIcon(st, 12) : icon("spaces", 12, s.active ? t.accent : t.dim)))
        .child(v_flex().flex_1().min_w(0)
          .child(div().truncate().text_color(t.foreground).child(s.name))
          .child(div().truncate().font_family(F.data).text_size(12.5).text_color(t.dim).child(shortPath(spaceFolder(s), home()) || "home folder")))
        .child(div().w(110).truncate().text_color(t.muted).child(machineLabel(s.machine)))
        .child(div().w(170).truncate().font_family(F.data).text_size(13).text_color(t.muted).child(s.branch ?? "—"))
        .child(div().w(48).text_right().font_family(F.data).text_color(t.muted).child(String(s.tabs.length)))
        .child(div().w(56).text_right().font_family(F.data).text_color(n ? t.foreground : t.dim).child(String(n)))
        .child(div().w(90).text_right().font_family(F.data).text_size(12.5).text_color(t.dim).child(ago(spaceChangedAt(s)) ?? "—"))
        .child(h_flex().w(56).justify_end().gap(2)
          .child(iconButton(`spo-${s.id}`, "focus", "Open", () => openSpace(s.id), { size: 22, iconSize: 12 }))
          .child(iconButton(`spt-${s.id}`, "plus", "New tab here", () => { run("tab.new", { space: s.id }); go("terminal"); }, { size: 22, iconSize: 12 })));
    };
    const body = v_flex().gap(S.md)
      .child(h_flex().gap(S.sm).items_center().child(searchBox(v.search, 240)).child(div().flex_1())
        .child(div().text_size(10.5).text_color(t.dim).child("SORT"))
        .child(segments("ss", [{ id: "order", label: "Order" }, { id: "name", label: "Name" }, { id: "recent", label: "Recent" }], v.sort, (id) => { v.sort = id; })))
      .child(card("sp-list").gap(2).child(head).child(div().h(1).bg(t.border))
        .children(list.length ? list.map(row) : [empty(q ? "No spaces match" : "No spaces", q ? "Clear the search." : "Create one with New space.")]));
    return screen("spv", "Spaces", `${spaces().length} spaces · click to inspect · double-click to open · right-click to rename or close`, [
      button("sp-new", "New space", () => run("space.new"), { icon: "plus" }),
    ], body);
  },
};

// --- Machines ------------------------------------------------------------------

export const machinesView = {
  init(v) { v.width = 1000; },
  render(v) {
    const t = pal();
    const rows = machineRows().filter((m) => !m.temporary);
    const cols = Math.max(1, Math.floor((v.width - 48 + 12) / 292));
    const picked = selection()?.kind === "machine" ? selection().id : undefined;
    const mcard = (m) => {
      const key = m.name ?? "";
      return card(`mcard-${key}`).flex_1().min_w(240).cursor_pointer()
        .when(picked === key, (el) => el.border_color(t.accent))
        .hover((s) => s.border_color(t.accent + "88"))
        .on_click(() => select("machine", key))
        .child(h_flex().gap(S.sm).items_center()
          .child(icon(m.local ? "terminal" : "machines", 18, t.accent))
          .child(v_flex().flex_1().min_w(0)
            .child(div().truncate().text_size(18).text_color(t.foreground).child(machineLabel(m.name)))
            .child(div().text_size(12.5).text_color(t.dim).child(m.local ? "LOCAL" : "REMOTE · SSH")))
          .child(chip(machineState(m.layout))))
        .child(div().h(1).bg(t.border))
        .child(h_flex().gap(S.lg).text_size(11.5)
          .child(v_flex().child(div().text_size(12).text_color(t.dim).child("SPACES")).child(div().text_size(22).font_family(F.data).child(String(m.spaces))))
          .child(v_flex().child(div().text_size(12).text_color(t.dim).child("AGENTS")).child(div().text_size(22).font_family(F.data).child(String(m.agents))))
          .when(m.blocked > 0, (el) => el.child(v_flex().child(div().text_size(12).text_color(t.dim).child("NEED YOU")).child(div().text_size(22).font_family(F.data).text_color(t.warning).child(String(m.blocked))))))
        .child(h_flex().gap(S.sm).flex_wrap()
          .when(m.layout === "ready", (el) => el.child(button(`mnew-${key}`, "New space", () => { run("space.new", { machine: key }); go("terminal"); }, { icon: "plus" })))
          .when(!m.local, (el) => el.child(button(`mset-${key}`, "Settings", () => run("app.settings", { section: "machines" }), { icon: "system" }))));
    };
    const addCard = v_flex().id("mcard-add").flex_1().min_w(240).min_h(150).items_center().justify_center().gap(S.sm).rounded(R.card).cursor_pointer()
      .border(1).border_color(t.border).text_color(t.muted).hover((s) => s.border_color(t.accent + "88").text_color(t.foreground))
      .on_click(() => run("mod.open", { name: "machine-add" }))
      .child(icon("plus", 20)).child(div().text_size(15.5).child("ADD MACHINE")).child(div().text_size(12.5).font_family(F.data).text_color(t.dim).child("from your ssh config"));
    const cells = [...rows.map(mcard), addCard];
    const grid = [];
    for (let i = 0; i < cells.length; i += cols) {
      const slice = cells.slice(i, i + cols);
      while (slice.length < cols) slice.push(div().flex_1().min_w(240));
      grid.push(h_flex().gap(S.md).items_stretch().children(slice));
    }
    const body = v_flex().gap(S.md).children(grid)
      .child(h_flex().gap(S.sm).items_center().text_size(13).text_color(t.dim).font_family(F.data)
        .child(icon("info", 15)).child("Hardware metrics (CPU, memory, disk) are not shown: Herdr does not report them."));
    return v_flex().id("mc-root").size_full().on_size_change((s, cx) => { v.width = s.width; cx.notify(); })
      .child(screen("mcv", "Machines", `${rows.length} machine${rows.length === 1 ? "" : "s"} · click a card to inspect`, [], body));
  },
};
