// The trace recorder: a canonical JSON-lines record of one harness run, written so a second
// implementation of the story VM (raw-native raw/story, C++) can replay the run and emit the same
// bytes. Format and the split of what the VM owns: design/TRACE-FORMAT.md.
//   const tr = installTracer(G, { seed, policy, until }); tr.begin(); ... ; tr.finish() -> string
// One record per line, keys in a fixed order, no spaces. Record types:
//   begin node line offer take var flag time place end rng h ev talk next scene after stop
// Records made while the VM runs are replayed and compared by the C++ VM. Records made by the host
// (rules, world, combat) carry "s":"h" and are applied by the replayer. "h" records are the host's
// answers to calls the VM makes, and "ev" records are host events passed through unchecked.
import { drawHook } from "../core/rng.mjs";

const clean = (v, d = 0) => {
  if (v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v === null || typeof v !== "object") return v;
  if (d > 3) return null;
  if (Array.isArray(v)) return v.map((x) => clean(x, d + 1));
  const o = {}; for (const k of Object.keys(v).sort()) if (typeof v[k] !== "function" && v[k] !== undefined) o[k] = clean(v[k], d + 1);
  return o;
};

// Names and calls the VM answers itself. Everything else is a host answer.
const VM_NAMES = new Set(["clock", "hour", "time", "place"]);
const VM_CALLS = new Set(["has", "at", "seen", "visits", "said", "set", "clear", "min", "max", "abs", "wait", "cut"]);
const HOST_PREFIX = new Set(["rep", "res", "meter", "attr", "skill"]);
export const vmGet = (G, name) => VM_NAMES.has(name) || name.startsWith("var.") || name.startsWith("flag.") || !!G.rs.vars[name];
export const vmAssign = (name) => { const d = name.indexOf("."); return !(d > 0 && HOST_PREFIX.has(name.slice(0, d))); };

export function installTracer(G, { seed, policy = "", until = null } = {}) {
  const out = []; let vm = 0, host = 0, mute = 0, frozen = false;
  const emit = (o) => { if (!frozen) out.push(JSON.stringify(o)); };
  let ed = 0; // depth of event dispatch: an event fired by a listener is a consequence the host made
  const src = () => (vm > 0 && host === 0 && ed <= 1 ? {} : { s: "h" });
  const gemit = G.emit.bind(G); G.emit = (ev, data) => { ed++; try { return gemit(ev, data); } finally { ed--; } };
  const clk = () => G.clock();
  // a call the VM makes into the host: logged when the VM is running and the call is the outermost
  const hostCall = (f, a, fn, shape = (r) => r) => {
    const log = host === 0 && vm > 0 && mute === 0 && ed === 0;
    host++; let r; try { r = fn(); } finally { host--; }
    if (log) emit({ t: "h", f, a: clean(a), r: clean(shape(r)) });
    return r;
  };
  G.on("flag", (e) => emit({ t: "flag", id: e.id, on: e.on ? 1 : 0, ...src() }));
  G.on("var", (e) => emit({ t: "var", n: e.name, v: clean(e.value), ...src() }));
  G.on("time", (e) => emit({ t: "time", from: e.before, to: e.after, ...(e.cut ? { cut: 1 } : {}), ...src() }));
  G.on("place", (e) => emit({ t: "place", id: e.id, ...src() }));
  G.on("end", (e) => emit({ t: "end", id: e.id }));
  const SKIP = new Set(["flag", "var", "time", "place", "end", "talk.start", "talk.end", "cmd", "check", "xp"]);
  G.on("*", (d, n) => { if (!SKIP.has(n)) emit({ t: "ev", n, d: clean(d) }); });
  drawHook.fn = (sd, key, v) => { if (vm > 0 && mute === 0 && ed === 0) emit({ t: "rng", seed: sd, key, v }); };

  const M = G.memory, visit = M.visit, log = M.log;
  M.visit = (id) => {
    if (vm > 0 && until && !String(id).startsWith(until) && !frozen) { emit({ t: "stop", id }); frozen = true; }
    emit({ t: "node", id, clock: clk() }); host++; try { return visit(id); } finally { host--; }
  };
  M.log = (e) => { if (!(e.kind === "check" && e.hidden)) emit({ t: "line", k: e.kind, who: e.who, text: e.text, clock: e.at, node: e.node }); host++; try { return log(e); } finally { host--; } }; // what hooks do when a line is shown is the host's

  const S = G.scope, get = S.get.bind(S), call = S.call.bind(S), assign = S.assign.bind(S);
  S.get = (name) => (vmGet(G, name) ? get(name) : hostCall("get", [name], () => get(name)));
  S.assign = (name, v) => (vmAssign(name) ? assign(name, v) : hostCall("assign", [name, clean(v)], () => assign(name, v)));
  S.call = (name, args, sc) => {
    if (VM_CALLS.has(name)) return call(name, args, sc);
    const ids = args.map((x) => (x.k === "id" ? x.name : x.k === "lit" ? x.v : "<expr>")); // an expression argument is the host's to evaluate; its source is not traced
    return hostCall("call:" + name, [ids], () => call(name, args, sc));
  };

  const wrap = (obj, name, tag, shape) => { const f = obj[name].bind(obj); obj[name] = (...a) => hostCall(tag, a, () => f(...a), shape); };
  wrap(G.checks, "passive", "checks.passive", (r) => ({ pass: r.pass, dc: r.dc, label: r.label }));
  wrap(G.checks, "preview", "checks.preview", (r) => ({ passed: r.passed, attempts: r.attempts, locked: r.locked }));
  wrap(G.checks, "resolve", "checks.resolve", (r) => ({ pass: r.pass, roll: r.roll ?? null, total: r.total, dc: r.dc, label: r.label }));
  wrap(G.pressure, "takeFull", "pressure.takeFull", (r) => (r ? { id: r.id, node: r.node } : null));
  wrap(G.pressure, "afterFull", "pressure.afterFull", () => null);
  wrap(G.sheet, "addXp", "sheet.addXp", () => null);
  wrap(G.sheet, "skill", "sheet.skill");
  { const w = G.quests.write.bind(G.quests); G.quests.write = (...a) => { host++; try { return w(...a); } finally { host--; } }; } // the journal line a fact writes is the host's
  const fill = G.fill.bind(G); G.fill = (t) => hostCall("fill", [t], () => fill(t));
  const command = G.command.bind(G); G.command = (a, s) => hostCall("command", [a], () => command(a, s), () => null);
  const rd = G.read.bind(G); G.read = (a) => hostCall("read", [a], () => rd(a), (r) => (r ? { who: r.who, text: r.text } : null));
  const id = (r) => (r && typeof r === "object" ? r.id : r);
  if (G.ext && G.ext.combat) { wrap(G.ext.combat, "take", "combat.take", id); wrap(G.ext.combat, "finish", "combat.finish"); }
  if (G.runs) { wrap(G.runs, "take", "runs.take", id); wrap(G.runs, "finish", "runs.finish"); }
  if (G.sneaks) { wrap(G.sneaks, "take", "sneaks.take", id); wrap(G.sneaks, "finish", "sneaks.finish", (r) => r && { node: r.node || null, fight: r.fight || null }); }

  const inVm = (fn) => (...a) => { vm++; try { return fn(...a); } finally { vm--; } };
  const offered = (t, b) => { if (b && b.options && b.options.length && !b.interrogation) emit({ t: "offer", node: t.node, opts: b.options.map((o) => ({ key: o.key, kind: o.kind, locked: o.locked ? 1 : 0 })) }); return b; };
  const wrapTalk = (t) => {
    const choose = t.choose; t.choose = (i, o) => { const op = t.beat.options[i]; emit({ t: "take", i, key: op && op.key }); return offered(t, inVm(choose)(i, o)); };
    for (const k of ["afterRun", "afterFight", "afterSneak"]) { const f = t[k]; t[k] = () => { emit({ t: "after", k }); return offered(t, inVm(f)()); }; }
    return t;
  };
  const talk = G.talk.bind(G);
  G.talk = (node, o) => { emit({ t: "talk", node, clock: clk() }); const t = inVm(talk)(node, o); offered(t, t.beat); return wrapTalk(t); };
  const ns = G.nextScene.bind(G);
  G.nextScene = () => { emit({ t: "next" }); const r = inVm(ns)(); if (r) emit({ t: "scene", kind: r.kind, id: r.id, node: r.node }); return r; };

  return {
    begin() { emit({ t: "begin", v: 1, seed, policy, clock: clk(), place: G.state.place || "", vars: clean(G.state.vars), flags: [...G.state.flags], start: G.book.meta.start, exits: [...(G.exits || [])] }); },
    finish() { drawHook.fn = null; return out.join("\n") + "\n"; },
  };
}
