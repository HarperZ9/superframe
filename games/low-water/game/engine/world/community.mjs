// The community model (design/quota/04-SYSTEMS.md, The Quota): streets with stocks, households on them,
// rules that move the stocks with a delay in days, and carriers of rhetoric. It runs one day a tick; when
// the clock jumps between scenes it runs the days it skipped. Nothing here is ever shown as a number: the
// world shows it (plates, props, bowls on a table).
//
// Records (LWD/1):
//   @street id       name, stocks as `key: number` (food price wage work hunger theft school ...), per people
//                    `standing: hesh -0.1, tarn 0.2`, `protection: ...`, `trust: police 0.5, council 0.4`
//   @household id    name, street, place (its kitchen: the narrow lens), people, members (comma list: one bowl each), and any stocks (portion: what is in each bowl)
//   @rule id         name, per (street | household | district), when (a condition), do (effects), delay
//                    (days), once (yes: once per subject), because (why, for the chain)
//   @carrier id      name, target (a people), volume (0 to 1), reach (streets, comma list or all)
//   @fate id         a person's fate, which only a person decides (design/spine-plan/03-FATES.md section 6):
//                    pressure (a condition read for the subject, as rules read), subject (household <id>),
//                    decider (the SPEAKER who decides it in the scene), scene (the node or nodes where it is
//                    decided, comma list), window (days from the act's start in which the pressure arms it),
//                    taken (yes: the fate takes a person into custody, so the household's taken is set),
//                    who (the member it falls on, for the record), because
//                    The model only presses: pressure(<id>) is true once the pressure has held on a day in the
//                    window. The scene's own node decides, and fate(<id>[, who]) applies it: one bowl off the
//                    subject's table, taken set when the fate takes, and a fate.<id> record event naming the
//                    decider and the node. A household rule may not write bowls, taken, members or end: the
//                    loader refuses it ("a person decides this: use @fate").
//   @meta community-day: the model's day number at the act's start (the slice: 41)
// Names in a rule read the subject first (a household's own, then its street's stocks), then the district
// (globals such as export). Calls for the script: record(type, victim, street[, witness]), shift(name, delta) or
// shift(name, delta, subject), stock(name) or stock(name, subject), bowls(household), cday(), pressure(fate),
// fate(fate[, who]), fated(fate).
// Every change carries its cause: the record event that began the chain and the rules it passed through
// with their delays; G.community.chains() returns them (tools/communitycheck.mjs prints them).
import { compile, compileEffects, evaluate, runEffects } from "../core/expr.mjs";
import { registerCalls } from "../core/scope.mjs";

const UNIT = new Set(["food", "work", "hunger", "sick", "theft", "school", "crowd", "breakup", "drink", "leaving", "protection", "trust", "entry", "own", "credit", "move", "voice", "schooling", "worship"]);
const clampOf = (k) => (k.startsWith("standing.") ? [-1, 1] : UNIT.has(k.split(".")[0]) ? [0, 1] : null);
const kvOf = (r, k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
const nums = (r, skip) => Object.fromEntries(r.kv.filter((e) => !skip.has(e.key) && /^-?\d+(\.\d+)?$/.test(e.value.trim())).map((e) => [e.key, +e.value.trim()]));
// the fields of a person's fate: only a scene writes them, through fate() or a node's do:
export const FATE_FIELDS = ["bowls", "taken", "members", "end"];
export const writesFate = (src) => FATE_FIELDS.filter((f) => new RegExp("(^|[;\\s])" + f + "\\s*(=|\\+=|-=)").test(String(src || "")));
const pairs = (v, prefix) => Object.fromEntries(String(v || "").split(",").map((s) => s.trim().split(/\s+/)).filter((p) => p.length === 2).map(([k, n]) => [`${prefix}.${k}`, +n]));

export function loadCommunity(book) {
  const R = book.records || {}, errors = [], streets = {}, households = {}, rules = [], carriers = {}, fates = {};
  for (const r of Object.values(R.street || {})) {
    streets[r.id] = { id: r.id, name: kvOf(r, "name") || r.id, peoples: (kvOf(r, "peoples") || "").split(",").map((s) => s.trim()).filter(Boolean),
      stocks: { ...nums(r, new Set()), ...pairs(kvOf(r, "standing"), "standing"), ...pairs(kvOf(r, "protection"), "protection"), ...pairs(kvOf(r, "trust"), "trust") }, file: r.file, line: r.line };
  }
  for (const r of Object.values(R.household || {})) {
    const street = kvOf(r, "street");
    if (!streets[street]) errors.push({ file: r.file, line: r.line, msg: `household ${r.id}: no @street ${street}` });
    households[r.id] = { id: r.id, name: kvOf(r, "name") || r.id, street, place: kvOf(r, "place") || null, people: kvOf(r, "people") || "", members: (kvOf(r, "members") || "").split(",").map((s) => s.trim()).filter(Boolean),
      stocks: { ...nums(r, new Set()) }, file: r.file, line: r.line };
  }
  for (const r of Object.values(R.rule || {})) {
    try {
      const when = kvOf(r, "when"), dO = kvOf(r, "do");
      if (!dO) throw new SyntaxError("needs do:");
      const per = kvOf(r, "per") || "street";
      if (!["street", "household", "district"].includes(per)) throw new SyntaxError(`per: ${per} (street, household or district)`);
      const w = writesFate(dO); if (per === "household" && w.length) throw new SyntaxError(`writes ${w.join(", ")}: a person decides this: use @fate`);
      rules.push({ id: r.id, name: kvOf(r, "name") || r.id, per, when: when ? compile(when) : null, whenSrc: when || "", reads: when ? [...compile(when).ids] : [],
        effects: compileEffects(dO), doSrc: dO, delay: +(kvOf(r, "delay") || 0), once: kvOf(r, "once") === "yes", because: kvOf(r, "because") || "", file: r.file, line: r.line });
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `rule ${r.id}: ${e.message}` }); }
  }
  for (const r of Object.values(R.carrier || {})) {
    const reach = (kvOf(r, "reach") || "all").split(",").map((s) => s.trim());
    carriers[r.id] = { id: r.id, name: kvOf(r, "name") || r.id, target: kvOf(r, "target"), volume: +(kvOf(r, "volume") || 0), reach, file: r.file, line: r.line };
  }
  for (const r of Object.values(R.fate || {})) {
    try {
      const pr = kvOf(r, "pressure"), subj = (kvOf(r, "subject") || "").split(/\s+/), decider = kvOf(r, "decider"), scene = (kvOf(r, "scene") || "").split(",").map((x) => x.trim()).filter(Boolean);
      if (!pr) throw new SyntaxError("needs pressure:");
      if (subj[0] !== "household" || !households[subj[1]]) throw new SyntaxError(`subject: expected "household <id>" naming a @household, got ${kvOf(r, "subject")}`);
      if (!decider) throw new SyntaxError("needs decider: (the speaker who decides it)");
      if (!scene.length) throw new SyntaxError("needs scene: (the node where it is decided)");
      fates[r.id] = { id: r.id, pressure: compile(pr), pressureSrc: pr, subject: subj[1], decider, scene, window: +(kvOf(r, "window") || 7), taken: kvOf(r, "taken") === "yes", who: kvOf(r, "who") || "", because: kvOf(r, "because") || "", file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `fate ${r.id}: ${e.message}` }); }
  }
  return { streets, households, rules, carriers, fates, day0: +(book.meta["community-day"] || 1), globals: Object.fromEntries(Object.entries(book.meta).filter(([k]) => k.startsWith("community.")).map(([k, v]) => [k.slice(10), +v])), errors };
}

// G.community, on G.state.community (saved with the game): { day, streets, households, carriers, globals, queue, fired, log }
export function installCommunity(G) {
  if (G.community) return G.community;
  const C = G.content.community || loadCommunity(G.book);
  if (!Object.keys(C.streets).length) return null;
  const S = (G.state.community ||= {
    day: C.day0, globals: { ...C.globals, ...Object.fromEntries(Object.values(C.carriers).map((c) => [`volume.${c.id}`, c.volume])) }, queue: [], fired: {}, seen: {}, log: [], events: [], cause: {}, pressure: {}, fates: {},
    streets: Object.fromEntries(Object.values(C.streets).map((s) => [s.id, { ...s.stocks }])),
    households: Object.fromEntries(Object.values(C.households).map((h) => [h.id, { ...h.stocks, bowls: h.members.length }])),
    carriers: Object.fromEntries(Object.values(C.carriers).map((c) => [c.id, { volume: c.volume }])),
  });
  let origin = null; // the record event whose effects are being applied (record() then shift() in one node)
  // the player's last chosen words: a record event carries them as its source, so the read-back quotes the
  // player word for word and the record points at the choice (voice director, 2026-10-21)
  let lastSaid = null;
  if (G.memory && G.memory.say) { const say = G.memory.say; G.memory.say = (key, label) => { lastSaid = { option: key, words: label, node: G.activeTalk ? G.activeTalk.node : null }; return say(key, label); }; }
  const tableOf = (kind, id) => (kind === "street" ? S.streets[id] : kind === "household" ? S.households[id] : S.globals);
  const read = (kind, id, name) => {
    if (kind === "household") { const h = S.households[id]; if (name in h) return h[name]; const st = S.streets[C.households[id].street]; if (st && name in st) return st[name]; }
    if (kind === "street" && name in S.streets[id]) return S.streets[id][name];
    if (name in S.globals) return S.globals[name];
    if (name === "day") return S.day;
    return undefined;
  };
  // where a name lives for a subject: the household's own, its street's, or the district's
  const home = (kind, id, name) => {
    if (kind === "household") { if (name in S.households[id]) return ["household", id]; const st = C.households[id].street; if (S.streets[st] && name in S.streets[st]) return ["street", st]; }
    if (kind === "street" && name in S.streets[id]) return ["street", id];
    return ["district", ""];
  };
  const write = (kind, id, name, v, cause) => {
    const [k2, id2] = home(kind, id, name), T = tableOf(k2, id2), c = clampOf(name);
    let x = +v; if (c) x = Math.max(c[0], Math.min(c[1], x));
    const before = +(T[name] ?? 0); T[name] = +x.toFixed(4);
    if (cause && Math.abs(T[name] - before) > 1e-6) { S.cause[`${k2}:${id2}:${name}`] = cause; if (cause.origin) S.log.push({ day: S.day, at: `${k2}:${id2}`, name, from: +before.toFixed(3), to: T[name], origin: cause.origin, path: cause.path }); }
  };
  const scopeFor = (kind, id, cause) => ({
    get: (name) => read(kind, id, name),
    call: (name, args, sc) => G.scope.call(name, args, sc),
    assign: (name, v) => write(kind, id, name, v, cause),
    isWord: () => false,
  });
  // the newest cause among the names a rule's condition reads, for this subject
  const causeOf = (kind, id, reads) => {
    let best = null;
    for (const n of reads) {
      const keys = kind === "household" ? [`household:${id}:${n}`, `street:${C.households[id].street}:${n}`, `district::${n}`] : kind === "street" ? [`street:${id}:${n}`, `district::${n}`] : [`district::${n}`];
      for (const k of keys) { const c = S.cause[k]; if (c && (!best || c.day > best.day)) best = c; }
    }
    return best;
  };
  const subjects = (per) => (per === "district" ? [["district", ""]] : per === "street" ? Object.keys(S.streets).map((id) => ["street", id]) : Object.keys(S.households).map((id) => ["household", id]));
  // schedule every rule whose condition holds today (at most once a day for each rule and subject)
  function evaluateRules() {
    for (const r of C.rules) for (const [kind, id] of subjects(r.per)) {
      const key = `${r.id}:${kind}:${id}`;
      if ((r.once && S.fired[key]) || S.seen[key] === S.day) continue;
      let ok = true; try { ok = !r.when || !!evaluate(r.when, scopeFor(kind, id, null)); } catch (e) { console.warn(`community: rule ${r.id}: ${e.message}`); ok = false; }
      if (!ok) continue;
      S.seen[key] = S.day; if (r.once) S.fired[key] = S.day;
      const c = causeOf(kind, id, r.reads), cause = { origin: c ? c.origin : null, day: S.day + r.delay, path: [...(c ? c.path : []), { rule: r.id, delay: r.delay, at: S.day, subject: `${kind}:${id}` }] };
      S.queue.push({ due: S.day + r.delay, rule: r.id, kind, id, cause });
    }
  }
  // apply what is due, then what that schedules for the same day (a rule with no delay), a few rounds deep
  function settle() {
    for (let pass = 0; pass < 4; pass++) {
      const due = S.queue.filter((q) => q.due <= S.day); if (!due.length) return;
      S.queue = S.queue.filter((q) => q.due > S.day);
      for (const q of due) { const rule = C.rules.find((r) => r.id === q.rule); runEffects(rule.effects, scopeFor(q.kind, q.id, q.cause)); G.emit("community.rule", { rule: q.rule, kind: q.kind, id: q.id, day: S.day }); }
      evaluateRules();
    }
  }
  // the pressures under a person's fate: the first day each held, inside its window (the model presses; it decides
  // nothing). Read after every change, as rules are.
  const FATES = C.fates || {};
  function pressFates() {
    S.pressure ||= {};
    for (const f of Object.values(FATES)) {
      if (S.pressure[f.id] != null || S.day > C.day0 + f.window) continue;
      let ok = false; try { ok = !!evaluate(f.pressure, scopeFor("household", f.subject, null)); } catch (e) { console.warn(`community: fate ${f.id}: ${e.message}`); }
      if (ok) { S.pressure[f.id] = S.day; G.emit("fate.pressure", { id: f.id, day: S.day }); }
    }
  }
  function tick() { S.day++; settle(); evaluateRules(); settle(); pressFates(); }
  const api = {
    model: C, state: S,
    day: () => S.day,
    run(days) { for (let i = 0; i < days; i++) tick(); },
    stock: (name, subject = "") => { const [kind, id] = subject ? (S.households[subject] ? ["household", subject] : ["street", subject]) : ["district", ""]; return read(kind, id, name); },
    bowls: (h) => (S.households[h] ? S.households[h].bowls : undefined),
    // a record event (04-SYSTEMS.md section 3): kept with its victim and street, and the origin of what follows
    record(type, victim = "", street = "", extra = {}) {
      const ev = { id: `${type}#${S.events.length + 1}`, type, victim, street, day: S.day, clock: Math.round(G.clock()), source: lastSaid ? { ...lastSaid } : null, ...extra };
      S.events.push(ev); origin = ev.id;
      G.emit("community.record", ev); // first, so a listener can stamp it (world/lens.mjs: the lens it was made in)
      if (G.reckoning && G.reckoning.record) G.reckoning.record(ev);
      return ev.id;
    },
    shift(name, delta, subject = "") {
      const [kind, id] = subject ? (S.households[subject] ? ["household", subject] : ["street", subject]) : ["district", ""];
      const cause = { origin, day: S.day, path: [] };
      write(kind, id, name, (+read(kind, id, name) || 0) + +delta, cause);
      evaluateRules(); settle(); pressFates(); // what the change sets going starts today
    },
    // a person's fate (@fate): the pressure, and the decision a scene's node makes
    pressure: (id) => { if (!FATES[id]) throw new Error(`pressure: no @fate ${id}`); pressFates(); return S.pressure[id] != null; },
    fated: (id) => !!(S.fates && S.fates[id]),
    fate(id, who = "") {
      const f = FATES[id]; if (!f) throw new Error(`fate: no @fate ${id}`);
      if ((S.fates ||= {})[id]) return S.fates[id].event; // a fate falls once
      const node = G.activeTalk ? G.activeTalk.node : null;
      const ev = api.record(`fate.${id}`, f.subject, C.households[f.subject].street, { decider: f.decider, who: who || f.who, node });
      const cause = { origin: ev, day: S.day, path: [{ node, decider: f.decider, fate: id }] };
      const h = S.households[f.subject];
      write("household", f.subject, "bowls", Math.max(0, (h.bowls || 0) - 1), cause);
      if (f.taken) write("household", f.subject, "taken", 1, cause);
      S.fates[id] = { who: who || f.who, day: S.day, node, decider: f.decider, event: ev };
      G.emit("fate", { id, who: who || f.who, decider: f.decider, node });
      evaluateRules(); settle();
      return ev;
    },
    // for each record event: every change it caused, in day order, with the rules and delays between
    chains() {
      return S.events.map((ev) => ({ event: ev, steps: S.log.filter((l) => l.origin === ev.id) }));
    },
  };
  G.community = api;
  // the clock: every whole day it passes runs a tick (a cut between scenes runs the days it skipped)
  let last = Math.floor(G.clock() / 1440);
  G.on("time", () => { const d = Math.floor(G.clock() / 1440); if (d > last) { api.run(d - last); last = d; } });
  return api;
}

registerCalls({
  // record(type, victim, street[, witness]): victim `none` for an event that falls on no household (a village row)
  record: (G, [type, victim, street, witness]) => (G.community ? G.community.record(type, victim && victim !== "none" ? victim : "", street || "", witness ? { witness } : {}) : null),
  shift: (G, [name, , subject], [, delta]) => (G.community ? G.community.shift(name, delta, subject || "") : null),
  stock: (G, [name, subject]) => (G.community ? G.community.stock(name, subject || "") : undefined),
  bowls: (G, [h]) => (G.community ? G.community.bowls(h) : undefined),
  cday: (G) => (G.community ? G.community.day() : undefined),
  pressure: (G, [id]) => (G.community ? G.community.pressure(id) : false),
  fated: (G, [id]) => (G.community ? G.community.fated(id) : false),
  fate: (G, [id, who]) => (G.community ? G.community.fate(id, who || "") : null),
}, { record: "record", shift: "stock", stock: "stock", bowls: "household", pressure: "fate", fated: "fate", fate: "fate" });
