// Design tokens and shared components for every Wasteland view.
// Colors come from theme() (themes/wasteland.json maps the spec palette onto
// Herdr's theme names), so the theme picker still works; only the tones the
// theme has no name for live here.

import { div, svg, image } from "gpui-kit";
import { h_flex, v_flex, Input } from "gpui-base";
import { theme, themes, shared } from "herdr";

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const R = { sm: 3, ctl: 4, card: 5, major: 6 };
export const F = { ui: "Share Tech Mono", data: "IBM Plex Mono", mark: "VT323" };

// Appearances. All are dark themes, so they sit together under Dark; each is a theme file in
// themes/. Picked in Herdr Settings > Look > Theme (this mod has no picker of its own). `error` is the one red this mod
// hardcodes, softened to suit each palette. First entry is the fallback.
export const APPEARANCES = [
  { id: "shelter_v2", label: "Green", error: "#f06050", note: "The original phosphor green. Brightest and most saturated." },
  { id: "shelter_v2_sage", label: "Sage", error: "#d97a68", note: "Desaturated green, text about 10:1. Calmest for long sessions." },
  { id: "shelter_v2_amber", label: "Amber", error: "#d9806a", note: "Warm amber, text about 10:1. Gentlest on night vision." },
];

// The appearance on screen, found by its accent color (so Herdr's own theme picker is followed too).
let memo = { accent: null, hit: APPEARANCES[0] };
export function appearance() {
  const accent = String(theme().accent ?? "").toLowerCase();
  if (memo.accent === accent) return memo.hit; // pal() runs many times per render; themes() only when the accent changes
  const all = themes();
  const hit = APPEARANCES.find((a) => String(all.find((x) => x.name === a.id)?.colors?.accent ?? "").toLowerCase() === accent) ?? APPEARANCES[0];
  memo = { accent, hit };
  return hit;
}

// Theme colors plus the semantic tones (success / active / warning / error / neutral / info).
export function pal() {
  const t = theme();
  return { ...t, success: t.done, active: t.accent, warning: t.blocked, error: appearance().error, neutral: t.idle, info: t.muted };
}

// Person's look choices (System > Appearance). Missing = on.
export function prefs() {
  const p = shared("shelter_v2.prefs") ?? {};
  return { effects: p.effects !== false, motion: p.motion !== false };
}

export const icon = (name, size = 14, color) => {
  const el = svg(`mods/shelter_v2/icons/${name}.svg`).size(size).flex_none();
  return color ? el.text_color(color) : el;
};

// The spinner turns only while motion is on; otherwise it stays a still arc.
export function stateIcon(def, size = 13) {
  const t = pal();
  const el = icon(def.icon, size, t[def.tone]);
  const spins = def.icon === "spinner" ? 1100 : def.icon === "gear" ? 2600 : 0;
  return spins && prefs().motion ? el.spin(spins) : el;
}

// A state as a pill: icon + word, never color alone.
export function chip(def, opts = {}) {
  const t = pal(), c = t[def.tone];
  const h = opts.h ?? 22;
  return h_flex().flex_none().h(h).px(10).gap(6).items_center().rounded(h / 2)
    .border(1).border_color(c + "aa").bg(c + "1a").text_color(c).text_size(opts.size ?? 12.5)
    .child(stateIcon(def, (opts.size ?? 12.5) - 0.5)).child(opts.short ?? def.label);
}

// A titled, bordered panel (the concept's sidebar and detail boxes).
export function panel(id, title, right, body) {
  const t = pal();
  return v_flex().id(id).flex_none().min_w(0).relative().rounded(R.major).border(1).border_color(t.input).bg(t.surface).overflow_hidden()
    .child(scanlines())
    .child(h_flex().h(36).px(S.md).gap(S.sm).items_center().border_b(1).border_color(t.border).bg(t.raised + "88")
      .child(div().flex_1().text_size(16).text_color(t.foreground).child(title.toUpperCase()))
      .children(right ? [right] : []))
    .child(body);
}

// A ring that shows a state: outer ring in the state color, solid core.
export function ring(def, size = 40, glyph) {
  const t = pal(), c = t[def.tone];
  return div().size(size).flex_none().rounded(size / 2).border(3).border_color(c).flex().items_center().justify_center()
    .child(glyph ? icon(glyph, size * 0.5, c) : div().size(size * 0.5).rounded(size / 4).bg(c));
}

// Thin CRT scanlines behind a surface (never over terminals). Off with effects.
export function scanlines() {
  return prefs().effects
    ? image("mods/shelter_v2/scanlines.svg").absolute().top(0).left(0).w(3000).h(1800)
    : div().absolute().size(0);
}

// A destination screen: scanlines behind, a title row, scrolling body.
export function screen(id, title, sub, actions, body) {
  const t = pal();
  return v_flex().id(id).size_full().relative().overflow_hidden().bg(t.canvas)
    .child(scanlines())
    .child(h_flex().flex_none().h(62).px(S.xl).gap(S.md).items_center().border_b(1).border_color(t.border)
      .child(v_flex().flex_1().min_w(0)
        .child(div().text_size(22).text_color(t.accent).child(title.toUpperCase()))
        .when(Boolean(sub), el => el.child(div().text_size(13).truncate().text_color(t.muted).font_family(F.data).child(sub))))
      .children(actions ?? []))
    .child(v_flex().id(`${id}-scroll`).flex_1().min_h(0).overflow_y_scrollbar().px(S.xl).py(S.lg).gap(S.lg).child(body));
}

// "LABEL ──────── right"
export function section(title, right) {
  const t = pal();
  return h_flex().flex_none().gap(S.sm).items_center().text_size(14).text_color(t.muted)
    .child(div().w(3).h(11).bg(t.accent))
    .child(title.toUpperCase())
    .child(div().flex_1().h(1).bg(t.border))
    .when(right !== undefined && right !== null, el => el.child(right));
}

export function card(id) {
  const t = pal();
  return v_flex().id(id).min_w(0).relative().overflow_hidden().bg(t.surface).border(1).border_color(t.border).rounded(R.card).p(S.md).gap(S.sm)
    .child(scanlines());
}

export function empty(title, body) {
  const t = pal();
  return v_flex().py(S.lg).px(S.md).gap(S.xs).items_center().text_color(t.dim)
    .child(div().text_size(15).text_color(t.muted).child(title))
    .when(Boolean(body), el => el.child(div().text_size(13).font_family(F.data).text_center().child(body)));
}

const stop = (_e, cx) => cx.stop_propagation();

export function button(id, label, onClick, opts = {}) {
  const t = pal();
  return h_flex().id(id).flex_none().h(30).px(12).gap(6).items_center().rounded(R.ctl).cursor_pointer().text_size(14)
    .border(1).border_color(opts.primary ? t.accent : t.border)
    .bg(opts.primary ? t.accent + "1f" : t.raised).text_color(opts.primary ? t.accent : t.foreground)
    .hover(s => s.bg(t.hover)).on_mouse_down("left", stop)
    .on_click((e, cx) => { cx.stop_propagation(); onClick(e, cx); })
    .when(Boolean(opts.icon), el => el.child(icon(opts.icon, 13)))
    .child(label);
}

export function iconButton(id, name, tip, onClick, opts = {}) {
  const t = pal();
  return div().id(id).relative().size(opts.size ?? 28).flex_none().flex().items_center().justify_center().rounded(R.ctl).cursor_pointer()
    .text_color(opts.active ? t.accent : t.muted)
    .when(Boolean(opts.active), el => el.bg(t.accent + "1a").border(1).border_color(t.accent + "55"))
    .hover(s => s.bg(t.hover).text_color(t.foreground))
    .tooltip(tip).on_mouse_down("left", stop)
    .on_click((e, cx) => { cx.stop_propagation(); onClick(e, cx); })
    .child(icon(name, opts.iconSize ?? 15))
    .when(Boolean(opts.badge), el => el.child(div().absolute().top(1).right(0).min_w(14).h(14).px(3).rounded(7)
      .bg(opts.badgeColor ?? t.warning).text_color(t.canvas).text_size(9.5).flex().items_center().justify_center().child(String(opts.badge))));
}

// Segmented filter: [{id, label, count?}], selected id, onPick(id).
export function segments(id, items, selected, onPick) {
  const t = pal();
  return h_flex().flex_none().gap(2).p(2).rounded(R.ctl).border(1).border_color(t.border).bg(t.chrome).children(items.map(it => {
    const on = it.id === selected;
    return h_flex().id(`${id}-${it.id}`).h(28).px(S.md).gap(6).items_center().rounded(R.sm).cursor_pointer().text_size(13.5)
      .bg(on ? t.accent + "24" : t.chrome).text_color(on ? t.accent : t.muted)
      .hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => { onPick(it.id); cx.notify(); })
      .child(it.label.toUpperCase())
      .when(it.count !== undefined, el => el.child(div().text_color(on ? t.accent : t.dim).font_family(F.data).text_size(12.5).child(String(it.count))));
  }));
}

export function searchBox(state, width = 220) {
  const t = pal();
  return h_flex().flex_none().w(width).h(32).px(S.sm).gap(6).items_center().rounded(R.ctl).border(1).border_color(t.input).bg(t.chrome)
    .on_mouse_down("left", stop)
    .child(icon("search", 12, t.dim))
    .child(Input.new(state).flex_1().h_full().text_size(14).font_family(F.data).text_color(t.foreground));
}

// Key/value line for inspectors and cards. Unknown values are left out by callers.
export function field(label, value, opts = {}) {
  const t = pal();
  return h_flex().gap(S.sm).items_start().text_size(opts.size ?? 12)
    .child(div().w(opts.w ?? 84).flex_none().text_color(t.dim).child(label.toUpperCase()))
    .child(div().flex_1().min_w(0).text_color(opts.color ?? t.foreground).font_family(F.data).text_size((opts.size ?? 12) - 0.5)
      .when(!opts.wrap, el => el.truncate()).child(value));
}

export function programIcon(program, size = 14, color) {
  if (!program?.icon) return icon("terminal", size, color);
  return program.tint ? svg(program.icon).size(size).flex_none().text_color(color ?? pal().muted) : image(program.icon).size(size).flex_none();
}
