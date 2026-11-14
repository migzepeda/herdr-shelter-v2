// Activity: state changes this layout saw happen, kept in shared state.
// Herdr keeps no event history, so this records transitions between live
// snapshots while the window is open. The first snapshot is a baseline and
// produces no events, so nothing is backfilled or invented.

import { agents, spaces, machines, shared, setShared } from "herdr";
import { agentName, machineLabel } from "./model.js";

const KEY = "shelter_v2.activity";
const MAX = 400;
const KEEP_MS = 7 * 86400000;

export const events = () => shared(KEY) ?? [];
export const clearEvents = () => setShared(KEY, []);

// Filters (id → test) shared by the Activity screen and its counts.
export const KINDS = {
  all: () => true,
  agent: (e) => e.kind === "agent",
  machine: (e) => e.kind === "machine",
  alert: (e) => e.level === "warning" || e.level === "error",
  system: (e) => e.kind === "space" || e.kind === "system",
};

function snapshot() {
  const sp = new Map(spaces().map((s) => [s.id, s]));
  const ag = new Map(agents().map((a) => [a.address, {
    status: a.status, name: agentName(a), space: a.space, space_name: a.space_name, tab: a.tab, tab_name: a.tab_name,
    machine: sp.get(a.space)?.machine ?? null,
  }]));
  const ms = new Map(machines().map((m) => [m.name ?? "", m.layout]));
  const ss = new Map([...sp.values()].map((s) => [s.id, { name: s.name, machine: s.machine }]));
  return { ag, ms, ss };
}

const where = (a) => `${a.space_name} › ${a.tab_name}`;

function diff(prev, next, at) {
  const out = [];
  const add = (e) => out.push({ id: `${at}-${out.length}`, at, ...e });
  for (const [addr, a] of next.ag) {
    const was = prev.ag.get(addr);
    const ref = { agent: addr, space: a.space, machine: a.machine };
    if (!was) { add({ kind: "agent", level: "info", title: `${a.name} started`, detail: where(a), ref }); continue; }
    if (was.status === a.status) continue;
    const from = was.status;
    if (a.status === "blocked") add({ kind: "agent", level: "warning", title: `${a.name} needs you`, detail: where(a), from, to: a.status, ref });
    else if (a.status === "done") add({ kind: "agent", level: "success", title: `${a.name} finished`, detail: where(a), from, to: a.status, ref });
    else if (a.status === "working" && from !== "working") add({ kind: "agent", level: "info", title: `${a.name} started working`, detail: where(a), from, to: a.status, ref });
    // working/done → idle is someone looking or a pause: not worth a line.
  }
  for (const [addr, a] of prev.ag) {
    if (!next.ag.has(addr)) add({ kind: "agent", level: "info", title: `${a.name} ended`, detail: where(a), ref: { space: a.space, machine: a.machine } });
  }
  for (const [name, state] of next.ms) {
    const was = prev.ms.get(name), label = machineLabel(name || null);
    const ref = { machine: name || null };
    if (was === undefined) add({ kind: "machine", level: "info", title: `${label} added`, ref });
    else if (was !== state && state === "unavailable") add({ kind: "machine", level: "error", title: `${label} unavailable`, from: was, to: state, ref });
    else if (was !== state && state === "ready" && was === "unavailable") add({ kind: "machine", level: "success", title: `${label} reconnected`, from: was, to: state, ref });
  }
  for (const [name] of prev.ms) if (!next.ms.has(name)) add({ kind: "machine", level: "info", title: `${machineLabel(name || null)} removed`, ref: { machine: name || null } });
  for (const [id, s] of next.ss) if (!prev.ss.has(id)) add({ kind: "space", level: "info", title: `Space ${s.name} opened`, ref: { space: id, machine: s.machine } });
  for (const [id, s] of prev.ss) if (!next.ss.has(id)) add({ kind: "space", level: "info", title: `Space ${s.name} closed`, ref: { machine: s.machine } });
  return out;
}

// One per window, in the status bar (always shown). observe() is pure memory
// work, safe in render; flush() writes, from a timer.
export class Recorder {
  constructor() { this.prev = null; this.queue = []; }
  observe() {
    const next = snapshot();
    if (this.prev) this.queue.push(...diff(this.prev, next, Date.now()));
    this.prev = next;
  }
  flush() {
    if (!this.queue.length) return;
    const now = Date.now();
    const list = [...this.queue.reverse(), ...events()].filter((e) => now - e.at < KEEP_MS).slice(0, MAX);
    this.queue = [];
    setShared(KEY, list);
  }
}
