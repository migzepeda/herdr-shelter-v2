// The shell around the work: header, sidebar, status bar (concept iteration 2).

import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { run, window, layout, keys, spaces, machines, openOverlay, shared, setShared, updates, nextCommand } from "herdr";
import { S, R, F, pal, prefs, icon, iconButton, stateIcon, scanlines, panel } from "./look.js";
import { DESTS, AGENT_STATES, find, currentDest, go, inspectorShown, counts, systemState, machineState, agentRows, machineLabel, openSpace } from "./model.js";
import { Recorder, events } from "./activity.js";

const stop = (_e, cx) => cx.stop_propagation();
const pad = (n) => String(n).padStart(2, "0");
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dateText(d) {
  const h = d.getHours() % 12 || 12;
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}   ${pad(h)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function paletteHint() {
  const mac = window()?.platform === "macos";
  const mod = { cmd: "⌘", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+" };
  const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
  return b ? b.keys.split("-").map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("") : null;
}

// Opens under the bell (top right), never at the pointer: from the status bar the
// pointer is at the bottom edge and the popup would be squeezed. width = the window's.
const openAlerts = (width) => openOverlay({ mod: "shelter_v2", kind: "popup", width: 360, height: 440, at: { x: Math.max(8, width - 372), y: 80 }, props: { view: "alerts" } });
const emblem = (w, color) => svg("mods/shelter_v2/icons/gear.svg").size(w * 0.4).flex_none().text_color(color);

// --- header ------------------------------------------------------------------

export const header = {
  init(v, cx) {
    v.width = 1920;
    // The clock: one redraw a minute, on the minute.
    v.now = new Date();
    cx.timer.every(15000, (cx2) => { const n = new Date(); if (n.getMinutes() !== v.now.getMinutes()) { v.now = n; cx2.notify(); } });
    // "shelter_v2.alerts" opens the notifications popup from a key or the CLI.
    cx.spawn(async (cx2) => { for (;;) { if ((await nextCommand()) === "alerts") openAlerts(v.width); cx2.notify(); } });
  },
  render(v) {
    const t = pal(), w = window(), c = counts(), sys = systemState();
    const dest = currentDest();
    const mac = w?.platform === "macos" && !w?.fullscreen;
    const compact = v.width < 1500;
    const tileW = compact ? 92 : 132;
    const tile = (d) => {
      const on = d.id === dest;
      const inner = v_flex().id(`nav-${d.id}`).w(tileW).h(compact ? 50 : 60).gap(3).items_center().justify_center().rounded(R.ctl).cursor_pointer()
        .border(1).border_color(on ? t.accent : t.border).bg(on ? t.accent + "2e" : t.surface)
        .text_color(on ? t.foreground : t.muted)
        .hover((s) => s.bg(on ? t.accent + "3a" : t.hover).text_color(t.foreground))
        .tooltip(d.label).on_mouse_down("left", stop).on_click(() => go(d.id))
        .child(icon(d.icon, compact ? 18 : 24, on ? t.accent : undefined))
        .child(div().text_size(compact ? 12.5 : 15).child(d.label.toUpperCase()));
      // Glow, the only way GPUI allows: a soft second border around the active tile.
      return on ? div().p(2).rounded(R.ctl + 2).border(1).border_color(t.accent + "55").child(inner) : div().p(3).child(inner);
    };
    const winButton = (id, name, cmd, tip) => div().id(id).size(28).rounded(R.ctl).flex().items_center().justify_center().text_color(t.muted)
      .hover((s) => s.bg(id === "win-close" ? t.error : t.hover).text_color(t.foreground)).tooltip(tip)
      .on_mouse_down("left", stop).on_click(() => run(cmd)).child(icon(name, 13));
    const hint = paletteHint();
    return h_flex().id("hdr").size_full().relative().overflow_hidden().bg(t.chrome).border_b(2).border_color(t.input)
      .on_size_change((size, cx) => { v.width = size.width; cx.notify(); })
      .items_center().gap(S.md).pl(mac ? 84 : S.lg).pr(S.sm)
      .child(scanlines())
      .child(h_flex().flex_none().gap(S.md).items_center()
        .child(emblem(compact ? 70 : 96, t.accent))
        .child(v_flex().gap(0)
          .child(div().text_size(compact ? 26 : 32).text_color(t.accent).child("HERDR"))
          .child(div().text_size(compact ? 11 : 13).text_color(t.muted).child(`SHELTER-OS v${updates().app.version}`))))
      .child(div().w(2).h(56).bg(t.border).flex_none())
      .child(h_flex().flex_none().gap(2).items_center().children(DESTS.map(tile)))
      .child(div().flex_1())
      .child(div().w(2).h(56).bg(t.border).flex_none())
      .child(v_flex().flex_none().gap(4).px(S.sm)
        .child(h_flex().gap(S.sm).items_center().text_size(compact ? 14 : 17).text_color(t[sys.tone])
          .child(div().size(compact ? 11 : 14).rounded(8).bg(t[sys.tone]).when(sys.tone === "success" && prefs().motion && prefs().effects, (el) => el.loop("opacity", { from: 0.55, to: 1, period: 2400 })))
          .child(`SYSTEM ${sys.label.toUpperCase()}`))
        .child(div().text_size(compact ? 11.5 : 13.5).text_color(t.muted).font_family(F.data).child(dateText(v.now))))
      .child(v_flex().flex_none().gap(2)
        .child(h_flex().gap(1)
          .child(iconButton("h-switch", "search", "Switch space or tab", () => run("mod.open", { name: "picker" }), { size: 26, iconSize: 13 }))
          .child(iconButton("h-palette", "command", hint ? `Command palette (${hint})` : "Command palette", () => run("app.palette"), { size: 26, iconSize: 13 }))
          .child(iconButton("h-alerts", "bell", c.alerts ? `${c.alerts} alert${c.alerts === 1 ? "" : "s"}` : "Notifications", () => openAlerts(v.width),
            { size: 26, iconSize: 13, badge: c.alerts || null, badgeColor: c.unavailable ? t.error : t.warning }))
          .child(iconButton("h-inspector", "inspector", "Toggle details (Ctrl+Shift+I)", () => run("layout.toggle", { id: "inspector" }), { size: 26, iconSize: 13, active: inspectorShown() })))
        .when(Boolean(w?.buttons), (el) => el.child(h_flex().gap(1).justify_end()
          .child(winButton("win-min", "min", "window.minimize", "Minimize"))
          .child(winButton("win-max", w.maximized ? "restore" : "max", "window.maximize", w.maximized ? "Restore" : "Maximize"))
          .child(winButton("win-close", "close", "window.close", "Close")))));
  },
};

// --- sidebar -----------------------------------------------------------------

const RAIL = 44;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px ?? 280;
  if (width >= 160) { setShared("shelter_v2.sidebarWidth", width); run("layout.resize", { id: "sidebar", px: window()?.platform === "macos" ? 76 : RAIL }); }
  else run("layout.resize", { id: "sidebar", px: shared("shelter_v2.sidebarWidth") ?? 280 });
}

const DOT = { ready: "success", loading: "warning", unavailable: "error" };

// Events per hour over the last 24 h, from the layout's own Activity record.
function histogram() {
  const now = Date.now(), bins = new Array(24).fill(0);
  for (const e of events()) { const h = Math.floor((now - e.at) / 3600000); if (h >= 0 && h < 24) bins[23 - h]++; }
  return bins;
}

export const nav = {
  init(v, cx) {
    v.width = 280; v.height = 900;
    v.open = JSON.parse(localStorage.getItem("open") ?? '{"machines":true,"agents":true}');
    // One toggle for the click and the commands (fold-machines, fold-agents).
    v.toggleFold = (key) => { v.open = { ...v.open, [key]: v.open[key] === false }; localStorage.setItem("open", JSON.stringify(v.open)); };
    cx.spawn(async (cx2) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "fold-machines") v.toggleFold("machines");
        else if (c === "fold-agents") v.toggleFold("agents");
        else if (c === "toggle-sidebar") toggleSidebar();
        cx2.notify();
      }
    });
  },
  render(v) {
    const t = pal(), c = counts();
    const rail = v.width < 160;
    const ag = agentRows();
    const fold = (key) => {
      const open = v.open[key] !== false;
      return div().id(`fold-${key}`).p(3).rounded(R.sm).cursor_pointer().text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(open ? "Collapse" : "Expand")
        .on_click((_e, cx) => { v.toggleFold(key); cx.notify(); })
        .child(icon(open ? "chevron-up" : "chevron-down", 15));
    };
    const row = (id, lead, label, trail, opts = {}) => h_flex().id(id).h(32).px(S.sm).gap(S.md).items_center().rounded(R.ctl).cursor_pointer()
      .bg(opts.on ? t.raised : "#00000000").text_color(opts.on ? t.foreground : opts.dim ? t.muted : t.foreground)
      .hover((s) => s.bg(t.hover)).on_click(opts.click)
      .when(Boolean(opts.right), (el) => el.on_mouse_down("right", opts.right))
      .child(lead).child(div().flex_1().min_w(0).truncate().text_size(15).child(label))
      .children(trail ? [trail] : []);
    const badge = (n, on) => div().min_w(22).h(22).px(5).rounded(11).flex().items_center().justify_center().font_family(F.data).text_size(12)
      .border(1).border_color(on ? t.accent : t.border).bg(on ? t.accent : t.surface).text_color(on ? t.canvas : t.muted).child(String(n));

    if (rail) {
      // The rail keeps the at-a-glance state: each space with its agent count
      // (amber when one is waiting), then a dot per machine.
      const cell = (id) => div().id(id).relative().size(32).rounded(R.ctl).flex().items_center().justify_center().cursor_pointer().hover((x) => x.bg(t.hover));
      const sep = () => div().w(24).h(1).my(4).bg(t.border);
      return v_flex().id("nav").size_full().relative().overflow_hidden().bg(t.chrome).items_center().pt(S.sm).gap(4)
        .on_size_change((size, cx) => { v.width = size.width; v.height = size.height; cx.notify(); })
        .children(spaces().map((s) => {
          const mine = ag.filter((a) => a.space === s.id);
          const waiting = mine.some((a) => a.status === "blocked");
          const tip = `${s.name}: ${mine.length} agent${mine.length === 1 ? "" : "s"}${waiting ? ", waiting for input" : ""}`;
          return cell(`rsp-${s.id}`).bg(s.active ? t.raised : "#00000000").tooltip(tip).on_click(() => openSpace(s.id))
            .child(icon("folder-fill", 16, s.active ? t.accent : t.muted))
            .when(mine.length > 0, (el) => el.child(div().absolute().top(0).right(0).min_w(14).h(14).px(3).rounded(7)
              .bg(waiting ? t.warning : s.active ? t.accent : t.raised).border(1).border_color(waiting ? t.warning : t.accent)
              .text_color(waiting || s.active ? t.canvas : t.accent).font_family(F.data).text_size(9.5).flex().items_center().justify_center()
              .child(String(mine.length))));
        }))
        .child(sep())
        .children(machines().map((m) => cell(`rmc-${m.name ?? ""}`).tooltip(`${machineLabel(m.name)}: ${machineState(m.layout).label}`)
          .on_click(() => go("machines"))
          .child(div().size(12).rounded(6).bg(t[DOT[m.layout] ?? "neutral"]))))
        .child(div().flex_1())
        .child(div().id("nav-expand").size(32).mb(S.sm).rounded(R.ctl).flex().items_center().justify_center().cursor_pointer().text_color(t.muted)
          .hover((x) => x.bg(t.hover)).tooltip("Expand sidebar").on_click(toggleSidebar).child(icon("chevron-right", 14)));
    }

    const spacesPanel = panel("p-spaces", "Spaces",
      iconButton("sp-add", "plus", "New space", () => run("space.new"), { size: 24, iconSize: 15 }),
      v_flex().p(6).gap(2)
        .children(spaces().map((s) => {
          const n = ag.filter((a) => a.space === s.id).length;
          return row(`sp-${s.id}`, icon("folder-fill", 18, s.active ? t.accent : t.muted), s.name, badge(n, s.active), {
            on: s.active, click: () => openSpace(s.id),
            right: (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "space", target: { id: s.id } } }); },
          });
        }))
        .child(row("sp-new", icon("plus", 16, t.muted), "New Space…", null, { dim: true, click: () => run("space.new") })));

    const ms = machines();
    const machinesPanel = panel("p-machines", "Machines", fold("machines"), v.open.machines === false ? div()
      : v_flex().p(6).gap(2)
        .children(ms.map((m) => {
          const st = machineState(m.layout);
          return row(`mc-${m.name ?? ""}`, div().size(14).flex_none().rounded(7).bg(t[DOT[m.layout] ?? "neutral"]), machineLabel(m.name), null, {
            click: () => go("machines"),
          }).tooltip(st.label);
        }))
        .child(row("mc-add", icon("plus", 16, t.muted), "Add Machine…", null, { dim: true, click: () => run("mod.open", { name: "machine-add" }) })));

    const bins = histogram(), peak = Math.max(1, ...bins);
    const stat = (id, lead, label, n, tone) => h_flex().id(id).h(28).px(S.sm).gap(S.md).items_center().rounded(R.ctl).cursor_pointer()
      .hover((s) => s.bg(t.hover)).on_click(() => go("board"))
      .child(lead).child(div().flex_1().text_size(15).text_color(t.foreground).child(label))
      .child(div().font_family(F.data).text_size(14).text_color(n ? t[tone] : t.dim).child(String(n)));
    const agentsPanel = panel("p-agents", "Agent Overview", fold("agents"), v.open.agents === false ? div()
      : v_flex().p(6).gap(2)
        .child(stat("ao-w", div().size(14).rounded(7).bg(t.success), "Active", c.working, "success"))
        .child(stat("ao-b", div().size(14).rounded(7).bg(t.warning), "Waiting", c.blocked, "warning"))
        .child(stat("ao-d", icon("check", 15, t.success), "Completed", c.done, "success"))
        .child(stat("ao-i", icon("idle", 15, t.neutral), "Idle", c.idle, "neutral"))
        .child(div().h(1).mx(S.sm).my(4).bg(t.border))
        .child(v_flex().id("ao-hist").px(S.sm).pb(4).gap(3).tooltip("Activity events per hour, last 24 h (recorded by this layout)")
          .child(h_flex().h(40).items_end().gap(2).border_l(1).border_b(1).border_color(t.input).pl(2)
            .children(bins.map((n, i) => div().flex_1().h(Math.max(1, Math.round((n / peak) * 38))).bg(n ? t.accent : t.border).id(`hb-${i}`))))
          .child(h_flex().text_size(10.5).text_color(t.dim).font_family(F.data).child(div().flex_1().child("24h")).child("now"))));

    return v_flex().id("nav").size_full().relative().overflow_hidden().bg(t.canvas).p(S.sm).gap(S.sm)
      .on_size_change((size, cx) => { v.width = size.width; v.height = size.height; cx.notify(); })
      .child(scanlines())
      .child(v_flex().id("nav-scroll").flex_1().min_h(0).overflow_y_scrollbar().gap(S.sm)
        .child(spacesPanel).child(machinesPanel).child(agentsPanel)
        .child(div().id("nav-art").flex_1().min_h(0).relative()
          .on_size_change((size, cx) => { if (size.height !== v.artSpace) { v.artSpace = size.height; cx.notify(); } })
          ))
      .child(h_flex().id("nav-collapse").flex_none().h(26).px(S.sm).gap(S.sm).items_center().cursor_pointer().text_size(12).text_color(t.dim)
        .hover((s) => s.text_color(t.foreground)).tooltip("Collapse sidebar").on_click(toggleSidebar)
        .child(icon("chevron-left", 12)).child("COLLAPSE"));
  },
};

// --- status bar --------------------------------------------------------------

export const status = {
  init(v, cx) {
    v.width = 1920;
    v.recorder = new Recorder();
    cx.timer.every(1500, () => v.recorder.flush());
  },
  render(v) {
    v.recorder.observe();
    const t = pal(), c = counts();
    const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
    const sep = () => div().w(2).h(24).bg(t.border).mx(S.md);
    const conn = !c.machinesSettled ? { text: "Connecting…", tone: "warning" }
      : c.unavailable ? { text: `${plural(c.unavailable, "machine")} unavailable`, tone: "error" }
        : { text: "All Systems Nominal", tone: "success" };
    return h_flex().id("status").size_full().relative().bg(t.chrome).border_t(2).border_color(t.input).px(S.lg).items_center().text_size(15)
      .on_size_change((size, cx) => { v.width = size.width; cx.notify(); })
      .child(h_flex().id("st-agents").gap(S.sm).items_center().cursor_pointer().text_color(t.foreground).tooltip("Agents")
        .on_click(() => go("board")).child(icon("signal", 18, t.accent)).child(plural(c.working, "Active Agent")))
      .child(sep())
      .child(h_flex().id("st-wait").gap(S.sm).items_center().cursor_pointer().tooltip("Notifications").on_click(() => openAlerts(v.width))
        .text_color(c.blocked ? t.warning : t.dim)
        .child(div().size(20).rounded(10).bg(c.blocked ? t.warning : t.border).text_color(t.canvas).text_size(14).flex().items_center().justify_center().child("!"))
        .child(`${c.blocked} Awaiting Input`))
      .child(div().flex_1())
      .when(v.width > 900, (el) => el.child(div().absolute().left(0).right(0).top(0).bottom(0).flex().items_center().justify_center()
        .child(emblem(90, t.accent))))
      .child(h_flex().id("st-conn").gap(S.sm).items_center().cursor_pointer().tooltip("Machines").on_click(() => go("machines"))
        .child(icon("cloud", 18, t[conn.tone])).child(div().text_color(t.muted).child("Connected:")).child(div().text_color(t[conn.tone]).child(conn.text)))
      .child(sep())
      .child(div().id("st-sys").tooltip(`herdr-core: ${systemState().label}`).child(icon("signal", 16, t[systemState().tone])));
  },
};
