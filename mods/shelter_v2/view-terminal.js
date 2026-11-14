// Home (terminal workspace) chrome: the space's tab bar and each pane's header.
// Both keep Herdr's native behavior (select, reorder, rename, close, the
// shipped menus and + menu); only the look is the concept's.

import { div } from "gpui-kit";
import { h_flex, ScrollHandle } from "gpui-base";
import { spaces, panes, run, openOverlay, props, nextCommand } from "herdr";
import { S, R, F, pal, icon, chip, programIcon } from "./look.js";
import { agentState, spaceOfTab } from "./model.js";

const stop = (_e, cx) => cx.stop_propagation();

// Shells and unknown programs get the prompt glyph, as in the concept.
const lead = (program, size, color) => (program?.agent && program?.icon ? programIcon(program, size, color) : icon("prompt", size, color));

// Moves the space's active tab one place left or right (keys and the CLI; drag does the same).
const nudgeTab = (dir) => {
  const list = spaces().find((s) => s.active)?.tabs ?? [];
  const i = list.findIndex((c) => c.active), to = i + dir;
  if (i >= 0 && to >= 0 && to < list.length) run("tab.move", { id: list[i].id, index: to + 1 });
};

export const tabs = {
  // Drag to reorder: press a tab (v.pressed), the pointer's tab is tracked while held (v.over),
  // release moves it there. Leaving the bar cancels. "tab-left"/"tab-right" nudge the active tab.
  init(v, cx) {
    v.pressed = null; v.over = null; v.scroll = ScrollHandle.new();
    cx.spawn(async (cx2) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "tab-left") nudgeTab(-1);
        if (c === "tab-right") nudgeTab(1);
        cx2.notify();
      }
    });
  },
  render(v) {
    const t = pal();
    const space = spaces().find((s) => s.active);
    const list = space?.tabs ?? [];
    const active = list.findIndex((c) => c.active);
    const dragging = v.pressed !== null && v.over !== null && v.over !== v.pressed;
    const endDrag = (cx) => {
      const from = v.pressed, to = v.over;
      v.pressed = null; v.over = null;
      if (from !== null && to !== null && from !== to && list[from]) run("tab.move", { id: list[from].id, index: to + 1 });
      cx.notify();
      return from !== null && to !== null && from !== to;
    };
    if (list[active]?.id !== v.selected) { v.selected = list[active]?.id; if (active >= 0) v.scroll.scroll_to_item(active); }
    const item = (c, i) => {
      const program = panes().find((p) => p.tab === c.id && p.program?.agent)?.program ?? panes().find((p) => p.tab === c.id)?.program;
      const name = c.named ? c.name : program?.name ?? `Tab ${c.index}`;
      const st = c.status ? agentState(c.status) : null;
      const marker = st && st.id !== "idle";
      // While dragging, the target tab shows a bright edge on the side the dragged tab will land.
      const target = dragging && v.over === i, after = v.over > v.pressed;
      const track = (cx) => { if (v.pressed !== null && v.over !== i) { v.over = i; cx.notify(); } };
      return h_flex().id(`tab-${c.id}`).h(38).px(S.md).gap(S.sm).items_center().flex_none().text_size(16)
        .rounded_t(R.major).border(1).border_b(0).border_color(c.active ? t.accent : t.input)
        .bg(c.active ? t.accent + "26" : t.surface).text_color(c.active ? t.accent : t.foreground)
        .when(dragging && v.pressed === i, (el) => el.opacity(0.5))
        .when(target, (el) => (after ? el.border_r(3) : el.border_l(3)).border_color(t.accent))
        .hover((s) => s.bg(c.active ? t.accent + "33" : t.hover))
        .on_mouse_down("left", (e, cx) => { cx.stop_propagation(); v.pressed = i; v.over = i; if (e.click_count === 2) run("tab.rename", { id: c.id }); })
        .on_mouse_move((_e, cx) => track(cx))
        .on_hover((hovered, cx) => { if (hovered) track(cx); })
        .on_mouse_up("left", (_e, cx) => {
          if (v.pressed !== null) v.over = i;
          if (!endDrag(cx)) run("tab.select", { id: c.id });
          cx.stop_propagation();
        })
        .on_mouse_down("right", (_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "menu", kind: "popup", width: 200, props: { tab: "tab", target: { id: c.id, space: space.id } } }); })
        .child(lead(program, 17, c.active ? t.accent : t.muted))
        .child(div().max_w(200).truncate().child(c.zoomed ? `${name} [Z]` : name))
        .when(marker, (el) => el.child(div().id(`tst-${c.id}`).size(9).rounded(5).bg(t[st.tone]).tooltip(st.label)))
        .child(div().id(`tclose-${c.id}`).p(3).rounded(R.sm).text_color(c.active ? t.accent : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
          .tooltip("Close tab").on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); run("tab.close", { id: c.id }); })
          .child(icon("close", 13)));
    };
    return h_flex().id("tabs").size_full().min_w(0).bg(t.canvas).border_b(1).border_color(t.input).items_end().px(S.sm).gap(6)
      // Released on the bar but not on a tab: still finish the drag; leaving the bar cancels it.
      .on_mouse_up("left", (_e, cx) => { endDrag(cx); })
      .on_hover((hovered, cx) => { if (!hovered && v.pressed !== null) { v.pressed = null; v.over = null; cx.notify(); } })
      .on_scroll_wheel((e) => { if (Math.abs(e.delta.y) >= 1) run(e.delta.y > 0 ? "tab.prev" : "tab.next"); })
      .child(h_flex().id("tab-scroll").min_w(0).h_full().items_end().gap(6).overflow_x_scrollbar().track_scroll(v.scroll)
        .on_size_change((_s, cx) => { if (active >= 0) { v.scroll.scroll_to_item(active); cx.notify(); } })
        .children(list.map(item)))
      .child(div().id("tab-new").w(42).h(38).flex_none().flex().items_center().justify_center().rounded_t(R.major).cursor_pointer()
        .text_color(t.foreground).border(1).border_b(0).border_color(t.input).bg(t.surface).hover((s) => s.bg(t.hover)).tooltip("New tab or agent")
        .on_mouse_down("left", stop).on_click(() => openOverlay({ mod: "new-menu", kind: "popup", width: 250, height: 512 }))
        .child(icon("plus", 18)))
      .child(div().flex_1());
  },
};

// The shipped pane menu, for this pane (the dots button and the pane-menu command).
const openPaneMenu = (p) => openOverlay({ mod: "menu", kind: "popup", width: 220, props: { tab: "pane", target: { pane: p.pane, terminal: p.terminal } } });

export const pane = {
  // "shelter_v2.pane-menu" opens the focused pane's menu from a key or the CLI.
  init(v, cx) {
    cx.spawn(async (cx2) => {
      for (;;) {
        const c = await nextCommand();
        const p = panes().find((x) => x.pane === props()?.pane);
        if (c === "pane-menu" && p?.focused) openPaneMenu(p);
        cx2.notify();
      }
    });
  },
  render() {
    const t = pal();
    const id = props()?.pane;
    const p = panes().find((x) => x.pane === id);
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const st = p.status ? agentState(p.status) : null;
    const machine = spaceOfTab(p.tab)?.machine;
    const btn = (bid, name2, tip, action) => div().id(bid).p(5).rounded(R.ctl).text_color(t.muted).tooltip(tip)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", stop)
      .on_click((e, cx) => { cx.stop_propagation(); action(e); })
      .child(icon(name2, 17));
    return h_flex().id(`ph-${id}`).size_full().px(S.md).gap(S.md).items_center()
      .bg(p.focused ? t.raised : t.surface).border_b(1).border_color(p.focused ? t.accent : t.input)
      .on_click(() => run("pane.focus", { pane: id }))
      .child(lead(p.program, 18, p.focused ? t.accent : t.muted))
      .child(div().flex_none().max_w(260).truncate().text_size(16).text_color(p.focused ? t.foreground : t.muted).child(name))
      // Only agents get a state; a plain shell has none.
      .when(Boolean(st), (el) => el.child(chip(st, { h: 24, size: 13.5 })))
      .when(Boolean(machine), (el) => el.child(div().flex_none().px(6).rounded(R.sm).border(1).border_color(t.border).text_size(11.5).text_color(t.muted).child(machine)))
      .child(div().flex_1())
      .child(btn(`pr-${id}`, "copy", "Split right", () => run("pane.split", { direction: "right", pane: id })))
      .child(btn(`pz-${id}`, p.zoomed ? "unzoom" : "zoom", p.zoomed ? "Unzoom" : "Zoom", () => run("pane.zoom", { pane: id })))
      .child(btn(`pm-${id}`, "dots", "Pane menu", () => openPaneMenu(p)));
  },
};
