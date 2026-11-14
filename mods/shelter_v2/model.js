// Real data only: everything here is derived from Herdr's live state.
// No progress, metrics or history is invented; unknown stays unknown.

import { agents, spaces, machines, panes, focused, layout, run, shared, setShared } from "herdr";

// Agent states exactly as Herdr reports them (OSC 7501). "done" = finished
// while nobody was looking; it turns "idle" once someone looks.
export const AGENT_STATES = {
  blocked: { id: "blocked", label: "Waiting", icon: "alert", tone: "warning", order: 0 },
  working: { id: "working", label: "Working", icon: "gear", tone: "active", order: 1 },
  done: { id: "done", label: "Completed", icon: "check", tone: "success", order: 2 },
  idle: { id: "idle", label: "Idle", icon: "idle", tone: "neutral", order: 3 },
};
export const UNKNOWN = { id: "unknown", label: "Unknown", icon: "unknown", tone: "neutral", order: 9 };
export const agentState = (s) => AGENT_STATES[s] ?? UNKNOWN;

// Herdr exposes a machine's layout document state; "unavailable" covers offline cores.
export const MACHINE_STATES = {
  ready: { id: "ready", label: "Connected", icon: "online", tone: "success" },
  loading: { id: "loading", label: "Connecting", icon: "spinner", tone: "warning" },
  unavailable: { id: "unavailable", label: "Unavailable", icon: "error", tone: "error" },
};
export const machineState = (s) => MACHINE_STATES[s] ?? UNKNOWN;

// Home is the terminal workspace (the concept's HOME); the rest are screens.
export const DESTS = [
  { id: "terminal", label: "Home", icon: "home" },
  { id: "board", label: "Agents", icon: "robot" },
  { id: "spaces", label: "Spaces", icon: "folder-fill" },
  { id: "machines", label: "Machines", icon: "machines-fill" },
  { id: "activity", label: "Activity", icon: "bars" },
  { id: "system", label: "System", icon: "gear" },
];

export function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const hit = find(child, id);
    if (hit) return hit;
  }
  return null;
}

// --- navigation -----------------------------------------------------------

export const currentDest = () => find(layout(), "deck")?.active ?? "terminal";
export const go = (dest) => run("layout.select", { stack: "deck", child: dest });
export const inspectorShown = () => { const n = find(layout(), "inspector"); return Boolean(n && !n.hidden); };

// The inspector shows this until keyboard focus moves to another pane.
export function select(kind, id) {
  setShared("shelter_v2.selection", { kind, id, pane: focused()?.pane ?? null });
  run("layout.show", { id: "inspector" });
}
export function selection() {
  const s = shared("shelter_v2.selection");
  return s && s.pane === (focused()?.pane ?? null) ? s : null;
}

export function openAgent(a) { run("agent.focus", { terminal: a.address }); go("terminal"); }
export function openSpace(id) { run("space.select", { id }); go("terminal"); }

// --- lookups ----------------------------------------------------------------

export const machineLabel = (name) => name ?? "Local Machine";
export const activeSpace = () => spaces().find((s) => s.active);
export const spaceOfTab = (tab) => spaces().find((s) => s.tabs.some((t) => t.id === tab));
export const agentName = (a) => a.program?.name || a.app || a.title || a.address;

// Agents with their space's machine attached.
export function agentRows() {
  const byId = new Map(spaces().map((s) => [s.id, s]));
  return agents().map((a) => {
    const space = byId.get(a.space);
    const tab = space?.tabs.find((t) => t.id === a.tab);
    return { ...a, machine: space?.machine ?? null, changed_at: tab?.changed_at ?? null, working_since: tab?.working_since ?? null };
  });
}

// Every machine with what lives on it.
export function machineRows() {
  const sp = spaces(), ag = agentRows();
  return machines().map((m) => ({
    ...m,
    local: m.name === null,
    spaces: sp.filter((s) => s.machine === m.name).length,
    agents: ag.filter((a) => a.machine === m.name).length,
    blocked: ag.filter((a) => a.machine === m.name && a.status === "blocked").length,
  }));
}

// Where a space is now: its first terminal's live folder, else where it was made.
export function spaceFolder(s) {
  const tabs = new Set(s.tabs.map((t) => t.id));
  return panes().find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder || null;
}

// Latest state change in a space (ms), from its tabs' changed_at.
export const spaceChangedAt = (s) => Math.max(0, ...s.tabs.map((t) => t.changed_at ?? 0)) || null;

// --- counts and attention -----------------------------------------------------

// What needs the person: blocked agents and unavailable machines are alerts;
// agents that finished unseen are worth a look but not alerts.
export function attention() {
  const items = [];
  for (const a of agentRows()) {
    if (a.status === "blocked") items.push({ kind: "agent", level: "warning", alert: true, agent: a });
    else if (a.status === "done") items.push({ kind: "agent", level: "success", alert: false, agent: a });
  }
  for (const m of machines()) if (m.layout === "unavailable") items.push({ kind: "machine", level: "error", alert: true, machine: m });
  return items;
}

// System state = this computer's core: online once its layout is readable.
export function systemState() {
  const local = machines().find((m) => m.name === null);
  if (!local) return { label: "Unknown", tone: "neutral", icon: "unknown" };
  return {
    ready: { label: "Online", tone: "success", icon: "online" },
    loading: { label: "Connecting", tone: "warning", icon: "spinner" },
    unavailable: { label: "Core offline", tone: "error", icon: "error" },
  }[local.layout] ?? { label: "Unknown", tone: "neutral", icon: "unknown" };
}

export function counts() {
  const ag = agents(), ms = machines();
  const by = (s) => ag.filter((a) => a.status === s).length;
  const loading = ms.some((m) => m.layout === "loading");
  return {
    agents: ag.length, working: by("working"), blocked: by("blocked"), done: by("done"), idle: by("idle"),
    machines: ms.length, connected: ms.filter((m) => m.layout === "ready").length,
    unavailable: ms.filter((m) => m.layout === "unavailable").length,
    // While any machine is still loading, the connected count isn't settled.
    machinesSettled: !loading,
    alerts: attention().filter((i) => i.alert).length,
  };
}

// The pane the inspector falls back to.
export const focusedPane = () => { const f = focused(); return f?.pane ? panes().find((p) => p.pane === f.pane) : null; };

// --- time -------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
export const clock = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function ago(ms) {
  if (!ms) return null;
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function dayLabel(ms) {
  const d = new Date(ms), today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shortPath(cwd, homeDir) {
  if (!cwd) return null;
  const norm = (p) => p.replace(/\\/g, "/");
  const c = norm(cwd), h = homeDir ? norm(homeDir) : null;
  return h && (c === h ? "~" : c.startsWith(h + "/") ? "~" + c.slice(h.length) : c) || c;
}
