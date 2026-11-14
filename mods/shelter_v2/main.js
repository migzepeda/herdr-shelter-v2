// Wasteland: a green-phosphor operations console around Herdr's own
// spaces, tabs and terminals. One mod draws every view; the layout picks
// which with `props.view` (pane headers get `props.pane` from Herdr).
// Mods can't import from each other, so one folder keeps the tokens and
// components in one place instead of a copy per panel.

import { View, div } from "gpui-kit";
import { props } from "herdr";
import { header, nav, status } from "./view-shell.js";
import { tabs, pane } from "./view-terminal.js";
import { board, spacesView, machinesView } from "./view-ops.js";
import { activity, inspector, alerts, menu } from "./view-records.js";
import { system } from "./view-system.js";

const VIEWS = {
  header, nav, status, tabs, pane, board, spaces: spacesView, machines: machinesView,
  activity, system, inspector, alerts, menu,
};

export default class Wasteland extends View {
  init(_p, cx) {
    const p = props();
    const name = p?.view ?? (p?.pane ? "pane" : null);
    this.view = VIEWS[name] ?? null;
    this.view?.init?.(this, cx);
  }
  render(cx) {
    return this.view ? this.view.render(this, cx) : div();
  }
}
