// System: overview plus Connections, Appearance, Preferences, Diagnostics.
// Every setting here is either Herdr's own (run as a command, or opened in
// Herdr's Settings) or one of this layout's two look switches.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { run, exec, updates, settings, window, keys, layout, shared, setShared, nextCommand } from "herdr";
import { S, R, F, pal, prefs, icon, chip, screen, section, card, empty, button, field as baseField } from "./look.js";
import { machineState, machineRows, counts, systemState, find, inspectorShown, go, machineLabel } from "./model.js";
import { events, clearEvents } from "./activity.js";

// Key/value rows at v2's scale (labels 14 px, values 13.5 px).
const LABEL_W = 110;
const field = (label, value, opts = {}) => baseField(label, value, { size: 14, w: LABEL_W, ...opts });

const TABS = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "connections", label: "Connections", icon: "machines" },
  { id: "appearance", label: "Appearance", icon: "system" },
  { id: "preferences", label: "Preferences", icon: "sidebar" },
  { id: "diagnostics", label: "Diagnostics", icon: "activity" },
];

const DOCS = [
  ["Concepts", "https://herdr.dev/tui/docs/concepts/"],
  ["Configuration", "https://herdr.dev/tui/docs/configuration/"],
  ["Session state and restore", "https://herdr.dev/tui/docs/session-state/"],
  ["Windows support", "https://herdr.dev/tui/docs/windows-beta/"],
];

function openUrl(url) {
  const p = window()?.platform;
  if (p === "windows") exec("cmd", ["/c", "start", "", url]);
  else exec(p === "macos" ? "open" : "xdg-open", [url]);
}

function toggle(id, label, desc, on, flip) {
  const t = pal();
  return h_flex().id(id).gap(S.md).items_center().py(S.sm).cursor_pointer().on_click((_e, cx) => { flip(); cx.notify(); })
    .child(v_flex().flex_1().min_w(0)
      .child(div().text_size(15).text_color(t.foreground).child(label))
      .child(div().text_size(13).font_family(F.data).text_color(t.muted).child(desc)))
    .child(h_flex().w(64).h(28).flex_none().rounded(R.ctl).border(1).border_color(on ? t.accent : t.border).items_center().justify_center()
      .bg(on ? t.accent + "24" : t.chrome).text_size(13).text_color(on ? t.accent : t.dim).child(on ? "ON" : "OFF"));
}

function setPref(key, value) { setShared("shelter_v2.prefs", { ...(shared("shelter_v2.prefs") ?? {}), [key]: value }); }
// One flip for the switch and the commands (toggle-effects, toggle-motion).
const togglePref = (key) => setPref(key, !prefs()[key]);

export const system = {
  init(v, cx) {
    v.tab = "overview";
    cx.spawn(async (cx2) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "toggle-effects") togglePref("effects");
        else if (c === "toggle-motion") togglePref("motion");
        else if (c === "appearance") v.tab = "appearance";
        else if (c.startsWith("system-tab-") && TABS.some((x) => x.id === c.slice(11))) v.tab = c.slice(11);
        cx2.notify();
      }
    });
    v.diag = null;
    v.refresh = () => cx.spawn(async (cx2) => {
      try {
        const r = await exec("herdr-app", ["status"], { timeout: 8000 });
        const j = JSON.parse(r.stdout);
        v.diag = { ok: true, errors: j.errors ?? [], at: Date.now() };
      } catch (err) {
        v.diag = { ok: false, reason: String(err?.message ?? err), at: Date.now() };
      }
      cx2.notify();
    });
    v.refresh();
  },
  render(v) {
    const t = pal(), c = counts(), sys = systemState(), u = updates(), set = settings(), p = prefs();
    const rows = machineRows();
    const sub = v_flex().w(210).flex_none().gap(2).children(TABS.map((x) => {
      const on = x.id === v.tab;
      return h_flex().id(`sys-${x.id}`).h(38).px(S.md).gap(S.md).items_center().rounded(R.ctl).cursor_pointer().text_size(15)
        .bg(on ? t.accent + "1c" : "#00000000").text_color(on ? t.foreground : t.muted).border(1).border_color(on ? t.accent + "55" : "#00000000")
        .hover((s) => s.bg(t.hover)).on_click((_e, cx) => { v.tab = x.id; cx.notify(); })
        .child(icon(x.icon, 16, on ? t.accent : undefined)).child(x.label);
    }));
    const errorsCount = v.diag?.ok ? v.diag.errors.length : null;
    const pages = {
      overview: () => v_flex().gap(S.lg)
        .child(section("Status"))
        .child(card("so-c").gap(6)
          .child(h_flex().gap(S.sm).items_center().child(div().w(LABEL_W).text_size(14).text_color(t.dim).child("APPLICATION")).child(chip({ label: sys.label, icon: sys.icon, tone: sys.tone })))
          .child(field("Machines", c.machinesSettled ? `${c.connected} of ${c.machines} connected` : "connecting…", { color: c.unavailable ? t.error : undefined }))
          .child(field("Agents", `${c.agents} total · ${c.working} working · ${c.blocked} waiting · ${c.done} completed · ${c.idle} idle`))
          .child(field("Alerts", c.alerts ? `${c.alerts} outstanding` : "none", { color: c.alerts ? t.warning : undefined }))
          .child(field("Config", errorsCount === null ? (v.diag ? "could not check" : "checking…") : errorsCount ? `${errorsCount} problem${errorsCount === 1 ? "" : "s"}, see Diagnostics` : "no problems reported",
            { color: errorsCount ? t.error : undefined })))
        .child(h_flex().gap(S.sm).flex_wrap()
          .child(button("so-board", "Agent Board", () => go("board"), { icon: "board" }))
          .child(button("so-mc", "Machines", () => go("machines"), { icon: "machines" }))
          .child(button("so-set", "Herdr settings", () => run("app.settings"), { icon: "system" }))),
      connections: () => v_flex().gap(S.lg)
        .child(section("Machine connections"))
        .child(card("sc-c").gap(2).children(rows.map((m) => h_flex().id(`sc-${m.name ?? ""}`).h(42).px(S.sm).gap(S.md).items_center()
          .child(icon(m.local ? "terminal" : "machines", 17, t.muted))
          .child(div().flex_1().text_size(15).text_color(t.foreground).child(machineLabel(m.name)))
          .child(div().text_size(13).text_color(t.dim).child(m.local ? "LOCAL" : "SSH"))
          .child(chip(machineState(m.layout))))))
        .child(div().text_size(13).font_family(F.data).text_color(t.muted)
          .child("Herdr reports each machine as connected, connecting or unavailable. It does not report last-connected times or provider connections, so they aren't shown."))
        .child(h_flex().gap(S.sm)
          .child(button("sc-set", "Machine settings", () => run("app.settings", { section: "machines" }), { icon: "system" }))
          .child(button("sc-add", "Add machine", () => run("mod.open", { name: "machine-add" }), { icon: "plus" }))),
      appearance: () => v_flex().gap(S.lg)
        .child(section("Effects"))
        .child(card("sa-fx").gap(0)
          .child(toggle("sa-scan", "CRT scanlines", "Lines behind panels, cards and bars. Never drawn over terminals or text.", p.effects, () => togglePref("effects")))
          .child(div().h(1).bg(t.border))
          .child(div().h(1).bg(t.border))
          .child(toggle("sa-motion", "Motion", "The status pulse and spinning working icons. Off = still icons (reduced motion).", p.motion, () => togglePref("motion"))))
        .child(div().text_size(13).font_family(F.data).text_color(t.muted)
          .child("Herdr does not expose the system's reduced-motion setting, so Motion is switched here."))
        .child(section("Text and theme"))
        .child(card("sa-txt").gap(6)
          .child(field("Interface", "Share Tech Mono"))
          .child(field("Terminal", `${set.font ?? "IBM Plex Mono"} · ${set.font_size ?? 14}px`))
          .child(field("Zoom", `${Math.round((set.zoom ?? 1) * 100)}%`))
          .child(field("Theme", String(set.theme ?? "wasteland_v2")))
          .child(h_flex().gap(S.sm).pt(S.xs).flex_wrap()
            .child(button("sa-zo", "Zoom −", () => run("app.zoom_out")))
            .child(button("sa-zr", "Reset", () => run("app.zoom_reset")))
            .child(button("sa-zi", "Zoom +", () => run("app.zoom_in")))
            .child(button("sa-look", "Terminal text & theme", () => run("app.settings", { section: "look" }), { icon: "external" }))))
        .child(div().text_size(13).font_family(F.data).text_color(t.muted)
          .child("Terminal text size and theme are Herdr's own settings (Settings › Look); terminal ANSI colors stay distinct from the green interface.")),
      preferences: () => {
        const sb = find(layout(), "sidebar");
        const relevant = keys().filter((k) => k.section === "layout:shelter_v2" || ["app.palette", "layout.toggle:sidebar", "app.settings", "mod.open:picker", "app.help"].includes(k.action));
        return v_flex().gap(S.lg)
          .child(section("Startup and sessions"))
          .child(card("sp-start").gap(6).child(div().text_size(14).font_family(F.data).text_color(t.muted).child(
            "Herdr restores on its own. Closing this window leaves every terminal running in herdr-core; reopening reattaches to the same live processes. "
            + "If herdr-core itself stops (crash, reboot, logout), spaces, tabs, splits and folders come back, but each lost terminal returns as a new shell in its last folder: its program is not restarted.")))
          .child(section("Layout"))
          .child(card("sp-lay").gap(6)
            .child(field("Sidebar", sb?.hidden ? "hidden" : `${Math.round(sb?.size?.px ?? 240)}px${(sb?.size?.px ?? 240) < 160 ? " (rail)" : ""}`))
            .child(field("Inspector", inspectorShown() ? "shown" : "hidden"))
            .child(h_flex().gap(S.sm).pt(S.xs).flex_wrap()
              .child(button("sp-sbw", "Sidebar 240px", () => { run("layout.show", { id: "sidebar" }); run("layout.resize", { id: "sidebar", px: 240 }); }))
              .child(button("sp-sbr", "Sidebar rail", () => run("layout.resize", { id: "sidebar", px: 44 })))
              .child(button("sp-ins", inspectorShown() ? "Hide inspector" : "Show inspector", () => run("layout.toggle", { id: "inspector" }))))
            .child(div().text_size(13).font_family(F.data).text_color(t.muted).child("Sizes and shown/hidden panels are remembered by Herdr across restarts.")))
          .child(section("Notifications"))
          .child(card("sp-not").gap(6)
            .child(field("Sounds", set.sounds?.enabled === false ? "off" : "on"))
            .child(h_flex().child(button("sp-al", "Alert settings", () => run("app.settings", { section: "alerts" }), { icon: "bell" }))))
          .child(section("Activity"))
          .child(card("sp-act").gap(6)
            .child(field("Stored", `${events().length} events, kept 7 days (max 400)`))
            .child(h_flex().child(button("sp-clr", "Clear activity", () => clearEvents(), { icon: "close" }))))
          .child(section("Keys"))
          .child(card("sp-keys").gap(4)
            .children(relevant.map((k, n) => h_flex().id(`key-${n}`).gap(S.md).text_size(14)
              .child(div().w(190).flex_none().font_family(F.data).text_color(t.foreground).child(k.keys))
              .child(div().flex_1().truncate().text_color(t.muted).child(k.action))))
            .child(h_flex().pt(S.xs).child(button("sp-help", "All keybinds", () => run("app.help"), { icon: "command" }))));
      },
      diagnostics: () => v_flex().gap(S.lg)
        .child(section("About"))
        .child(card("sd-ab").gap(6)
          .child(field("Herdr app", u.app.version))
          .child(field("herdr-core", u.core.version ?? "unknown"))
          .when(Boolean(u.app.ready), (el) => el.child(field("Update", `${u.app.ready} ready`, { color: t.warning })))
          .child(field("Platform", window()?.platform ?? "unknown"))
          .child(field("Layout", String(shared("layout") ?? "shelter_v2")))
          .child(field("Last check", u.checked ? new Date(u.checked * 1000).toLocaleString?.() ?? String(u.checked) : "not checked"))
          .child(h_flex().gap(S.sm).pt(S.xs)
            .child(button("sd-upd", u.checking ? "Checking…" : "Check for updates", () => run("app.check_updates"), { icon: "activity" }))
            .child(button("sd-new", "What's new", () => run("app.whats_new"), { icon: "info" }))))
        .child(section("Configuration", button("sd-ref", "Re-check", () => v.refresh(), { icon: "activity" })))
        .child(card("sd-cfg").gap(4).children(!v.diag ? [empty("Checking…")]
          : !v.diag.ok ? [empty("Could not run herdr-app status", v.diag.reason)]
          : v.diag.errors.length ? v.diag.errors.map((e, n) => h_flex().id(`err-${n}`).gap(S.sm).items_start()
            .child(icon("error", 16, t.error)).child(div().flex_1().text_size(14).font_family(F.data).text_color(t.foreground).child(typeof e === "string" ? e : JSON.stringify(e))))
          : [h_flex().gap(S.sm).items_center().text_size(14).text_color(t.success).child(icon("check", 16)).child("No file or mod errors reported by herdr-app status")]))
        .child(section("Documentation"))
        .child(card("sd-doc").gap(2).children(DOCS.map(([label, url], n) => h_flex().id(`doc-${n}`).h(36).px(S.sm).gap(S.sm).items_center().rounded(R.ctl).cursor_pointer()
          .hover((s) => s.bg(t.hover)).on_click(() => openUrl(url))
          .child(icon("external", 15, t.muted)).child(div().text_size(14).text_color(t.foreground).child(label))
          .child(div().flex_1().truncate().text_size(12.5).font_family(F.data).text_color(t.dim).child(url))))),
    };
    const body = h_flex().gap(S.xl).items_start().child(sub).child(v_flex().flex_1().min_w(0).child(pages[v.tab]()));
    return screen("sysv", "System", "Status, connections, appearance, preferences and diagnostics", [], body);
  },
};
