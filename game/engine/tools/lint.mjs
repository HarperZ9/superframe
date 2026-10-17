// The content validator, shared by the CLI (tools/validate.mjs) and the graph viewer.
//   const report = lint(content, { carry })   content from loadContent(sources); carry is the
//   report of an earlier act (lint of Act 1 for Act 2): every flag it sets counts as set here and
//   every variable it declares or sets counts as declared, as the director's lint --carry does
//   report.issues: [{ level: "error"|"warn", file, line, msg, node }]
//   report.graph:  { nodes: { id: { edges: [{ to, kind }], terminates, file, line } }, roots }
// Finds: load and reference errors, links to missing nodes, checks without a fail node, dead
// ends, nodes unreachable from @meta start (or from the world's entry points), undefined
// names, flags read but never set, ids passed to calls that name nothing, unknown commands,
// and {{expressions}} that do not compile (R12).
import { compile, compileEffects, names } from "../core/expr.mjs";
import { ID_ARG_CALLS, KNOWN_CALLS } from "../core/scope.mjs";

// fight_* names are read by an encounter's talk-exit conditions inside the fight (combat/)
const BUILTIN = new Set(["fight_seconds", "fight_lamb_standing", "fight_foes_standing", "fight_foes_down", "fight_foes_yielding", "fight_struck", "carrying", "phase", "day", "daylight", "seen", "hidden", "insneak", "inrun", "clock", "hour", "time", "place", "area", "district", "xp", "level", "points", "wet", "soaked", "shed", "warm", "guise", "stove", "shelter", "bench", "runs",
  "tide", "fog", "rain", "weather", "wind.dir", "wind.speed", "light", "sodium", "mother", "night", "temp", "frost", "true", "false"]);
const PREFIXES = ["attr", "skill", "rep", "res", "trait", "quest", "project", "meter", "item", "var", "flag", "run", "power"];
const COMMANDS = new Set(["setPower", "restrike", "setTerm", "clearTerm", "setLight", "gust", "wet", "addRumour", "give"]);
const CONVENTION = [/^chilled(\.|$)/, /^small(\.|$)/, /^nod\./, /^bench$/, /^wall$/];

export function lint(C, { carry = null } = {}) {
  const { book, rs } = C, issues = [], N = book.nodes;
  const add = (level, at, msg, node = "") => issues.push({ level, file: at && at.file, line: at && at.line, msg, node });
  for (const e of C.errors) add(e.level === "warn" ? "warn" : "error", e, e.msg);
  const X = { carry, C, book, rs, N, issues, add, exprs: [], links: [], sets: new Set(carry ? carry.sets : []), assigned: new Set(carry ? carry.declared : []), graph: { nodes: {}, roots: [] } };
  for (const f of [gather, gatherWorld, missing, reach, deadEnds, namesAndFlags, speakers]) f(X);
  const { graph, seen } = X;
  issues.sort((a, b) => (a.level === b.level ? 0 : a.level === "error" ? -1 : 1) || String(a.file).localeCompare(String(b.file)) || (a.line || 0) - (b.line || 0));
  const declared = [...Object.keys(rs.vars), ...X.assigned];
  return { sets: [...X.sets], declared: [...new Set(declared)], nodeIds: Object.keys(N), issues, graph, errors: issues.filter((i) => i.level === "error").length, warnings: issues.filter((i) => i.level === "warn").length, nodes: Object.keys(N).length, reachable: seen.size };
}

// gather every expression, effect and link, with where it came from
function gather(X) {
  const { C, rs, N, add, exprs, links, sets, assigned, graph } = X;
  const effectsOf = (X.effectsOf = (eff, at, node) => {
    if (!eff) return;
    exprs.push({ c: eff, at, node });
    for (const t of eff.targets || []) assigned.add(t.replace(/^var\./, ""));
    for (const [name, calls] of eff.calls) for (const args of calls) {
      if (name === "set" && args[0]) sets.add(String(args[0]));
      if (name === "after" && typeof args[1] === "string") { try { effectsOf(compileEffects(args[1]), at, node); } catch (e) { add("error", at, `after(): ${e.message}`, node); } }
      if ((name === "run" || name === "fight" || name === "sneak" || name === "interrogate") && node && graph.nodes[node]) graph.nodes[node].terminates = true;
      // an interrogation leads to its press, lie, break, bolt and walk nodes, and swing's fight
      const ig = name === "interrogate" && args[0] && (C.interrogations || {})[args[0]];
      if (ig) for (const to of [...ig.presses.map((p) => p.target), ...ig.lies.map((l) => l.node), ig.break, ig.walk, ig.bolt && ig.bolt.to].filter(Boolean)) { links.push({ from: node, to, kind: "interrogation", at }); if (graph.nodes[node]) graph.nodes[node].edges.push({ to, kind: "interrogation" }); }
      const sn = name === "sneak" && args[0] && C.sneaks[args[0]];
      if (sn) for (const to of [sn.win, sn.alert, sn.lose, ...sn.watchers.map((w) => (C.stealth.watchers[w] || {}).alert)].filter(Boolean)) { links.push({ from: node, to, kind: "sneak", at }); if (graph.nodes[node]) graph.nodes[node].edges.push({ to, kind: "sneak" }); }
      const enc = name === "fight" && args[0] && ((C.book.records || {}).encounter || {})[args[0]];
      // a fight leads to its outcome nodes and to its talk exits (talk: node | label ? cond)
      if (enc) for (const e of enc.kv) {
        const to = ["win", "yield", "fled", "down", "lose"].includes(e.key) ? e.value.trim() : e.key === "talk" ? e.value.split("?")[0].split("|")[0].trim() : null;
        if (!to) continue;
        links.push({ from: node, to, kind: e.key === "talk" ? "fight talk" : "fight", at });
        if (graph.nodes[node]) graph.nodes[node].edges.push({ to, kind: "fight" });
      }
      if (name === "run" && args[0] && C.runs[args[0]]) { const r = C.runs[args[0]]; links.push({ from: node, to: r.win, kind: "run", at }); links.push({ from: node, to: r.lose, kind: "run", at }); }
    }
  });
  for (const n of Object.values(N)) {
    const g = (graph.nodes[n.id] = { id: n.id, edges: [], terminates: false, file: n.file, line: n.line, event: !!n.event, hub: n.hub });
    for (const s of n.steps) {
      const at = { file: s.file || n.file, line: s.line || n.line }, link = (to, kind) => { if (to && !to.startsWith("^")) { links.push({ from: n.id, to, kind, at }); g.edges.push({ to, kind }); } };
      if (s.cond) exprs.push({ c: s.cond, at, node: n.id });
      if (s.show) exprs.push({ c: s.show, at, node: n.id });
      effectsOf(s.effects, at, n.id);
      switch (s.kind) {
        case "go": link(s.value, "go"); g.terminates = true; break;
        case "alt": link(s.target, "alt"); break;
        case "else": link(s.value, "else"); break;
        case "call": link(s.value, "call"); break;
        case "passive": link(s.target, "passive"); break;
        case "opt": case "claim": case "check":
          link(s.target, s.kind); if (s.fail) link(s.fail, s.kind); g.terminates = true;
          if (s.kind === "check") {
            if (!rs.skills[s.attrs.skill]) add("error", at, `check on unknown skill ${s.attrs.skill}`, n.id);
            if (s.attrs.dc == null || isNaN(+s.attrs.dc)) add("error", at, "check without a numeric dc", n.id);
          }
          break;
        case "end": case "exit": case "return": g.terminates = true; break;
        case "voice": if (s.skill && !rs.skills[s.skill] && Object.keys(rs.skills).length) add("warn", at, `voice of unknown skill ${s.skill}`, n.id); break;
        case "passive_": break;
        case "cmd": if (!COMMANDS.has(s.args[0])) add("warn", at, `unknown command ${s.args[0]}`, n.id); else if (s.args[0] === "setPower" || s.args[0] === "setLight") { /* zone and place ids are free */ } break;
        case "read": if (!C.instruments[s.value.split(/\s+/)[0]]) add("warn", at, `read: no @instrument ${s.value.split(/\s+/)[0]} (the line will be silent)`, n.id); break;
        default: break;
      }
      for (const text of [s.text, s.kind === "nar" ? s.value : null]) if (text && text.includes("{{")) for (const m of text.matchAll(/\{\{(.+?)\}\}/g)) { try { exprs.push({ c: compile(m[1]), at, node: n.id }); } catch (e) { add("error", at, `text expression {{${m[1]}}}: ${e.message}`, n.id); } }
    }
  }
  return X;
}

// world links: hotspots, exits, area enter nodes, run outcomes, meter scenes, and every other
// record that holds an expression or an effect
function gatherWorld(X) {
  const { C, book, rs, N, add, exprs, links, effectsOf } = X;
  for (const a of Object.values(C.map.areas)) {
    for (const h of a.hotspots) { links.push({ from: `area:${a.id}`, to: h.target, kind: "hotspot", at: { file: a.file, line: h.line } }); if (h.cond) exprs.push({ c: h.cond, at: { file: a.file, line: h.line } }); effectsOf(h.effects, { file: a.file, line: h.line }, `area:${a.id}`); }
    for (const x of a.exits) if (x.cond) exprs.push({ c: x.cond, at: { file: a.file, line: x.line } });
    if (a.enter) links.push({ from: `area:${a.id}`, to: a.enter, kind: "enter", at: a });
  }
  for (const r of Object.values(C.runs)) for (const to of [r.win, r.lose]) if (!N[to]) add("error", r, `run ${r.id}: no node ${to}`);
  for (const h of Object.values(C.hazards)) for (const k of ["where", "when", "danger"]) if (h[k]) exprs.push({ c: h[k], at: h });
  for (const h of Object.values(C.hazards)) for (const k of ["effects", "enter", "leave"]) effectsOf(h[k], h, "");
  for (const m of Object.values(C.meters)) for (const r of m.rise) if (r.cond) exprs.push({ c: r.cond, at: { file: m.file, line: r.line } });
  for (const m of rs.modifiers) if (m.cond) exprs.push({ c: m.cond, at: rs.raw.modifier[m.id] });
  for (const t of Object.values(rs.traits)) { effectsOf(t.effects, rs.raw.trait[t.id], ""); for (const md of [...t.mods, ...t.during]) if (md.cond) exprs.push({ c: md.cond, at: rs.raw.trait[t.id] }); }
  for (const it of Object.values(rs.items)) for (const md of it.mods) if (md.cond) exprs.push({ c: md.cond, at: rs.raw.item[it.id] });
  for (const p of Object.values(C.projects)) for (const s of p.stages) effectsOf(s.effects, p, "");
  for (const ins of Object.values(C.instruments)) for (const s of ins.says) { if (s.cond) exprs.push({ c: s.cond, at: { file: rs.raw.instrument?.[ins.id]?.file, line: s.line } }); effectsOf(s.effects, { line: s.line }, ""); }
  for (const e of book.events) if (e.when) exprs.push({ c: e.when, at: e });
  // interaction verbs are entry points from the world, like hotspots
  for (const o of Object.values(C.objects || {})) for (const v of o.verbs) {
    const at = { file: o.file, line: v.line };
    if (v.cond) exprs.push({ c: v.cond, at }); if (v.gone) exprs.push({ c: v.gone, at }); effectsOf(v.effects, at, `area:object.${o.id}`);
    for (const to of [v.attrs.ok, v.attrs.fail, v.attrs.node].filter(Boolean)) links.push({ from: `area:object.${o.id}`, to: String(to), kind: `verb ${v.kind}`, at });
    for (const id of [...v.needs, ...v.uses.map((c) => c.id), ...v.give.map((c) => c.id)]) if (!rs.items[id]) add("warn", at, `object ${o.id}: ${v.kind} names no item ${id}`);
    if (v.attrs.skill && !rs.skills[v.attrs.skill]) add("error", at, `object ${o.id}: ${v.kind} check on unknown skill ${v.attrs.skill}`);
    if (v.kind === "read" && v.attrs.inst && !C.instruments[v.attrs.inst]) add("warn", at, `object ${o.id}: read names no @instrument ${v.attrs.inst}`);
    if (v.attrs.who && !rs.chars[v.attrs.who]) add("warn", at, `object ${o.id}: eavesdrop on no @char ${v.attrs.who}`);
  }
  for (const w of Object.values((C.stealth || {}).watchers || {})) { if (w.when) exprs.push({ c: w.when, at: w }); for (const to of [w.alert].filter(Boolean)) if (!N[to]) add("error", w, `watcher ${w.id}: no node ${to}`); if (w.char && !rs.chars[w.char]) add("warn", w, `watcher ${w.id}: no @char ${w.char}`); for (const e of [w.fight, w.ambush].filter(Boolean)) if (!((book.records || {}).encounter || {})[e]) add("error", w, `watcher ${w.id}: no @encounter ${e}`); }
  for (const ig of Object.values(C.interrogations || {})) {
    for (const to of [...ig.presses.map((p) => p.target), ...ig.lies.map((l) => l.node), ig.break, ig.walk, ig.bolt && ig.bolt.to].filter(Boolean)) if (!N[to]) add("error", ig, `interrogation ${ig.id}: no node ${to}`);
    if (ig.swing && !((book.records || {}).encounter || {})[ig.swing.to]) add("error", ig, `interrogation ${ig.id}: swing names no @encounter ${ig.swing.to}`);
    if (ig.who && !rs.chars[ig.who]) add("warn", ig, `interrogation ${ig.id}: who names no @char ${ig.who}`);
    for (const p of ig.presses) { if (p.cond) exprs.push({ c: p.cond, at: p }); if (p.attrs.skill && !rs.skills[p.attrs.skill]) add("error", p, `interrogation ${ig.id}: press on unknown skill ${p.attrs.skill}`); }
  }
  for (const s of Object.values(C.sneaks || {})) { for (const id of s.watchers) if (!C.stealth.watchers[id]) add("error", s, `sneak ${s.id}: no @watcher ${id}`); for (const id of s.hides) if (!C.stealth.hides[id]) add("error", s, `sneak ${s.id}: no @hide ${id}`); for (const to of [s.win, s.alert, s.lose]) if (to && !N[to]) add("error", s, `sneak ${s.id}: no node ${to}`); }
  return X;
}

// missing link targets
function missing(X) {
  const { C, book, rs, N, issues, add, exprs, links, sets, assigned, graph } = X;
  for (const l of links) if (!N[l.to]) add("error", l.at, `${l.kind} to missing node ${l.to}`, l.from);
  return X;
}

// reachability from the start and the world's entry points
function reach(X) {
  const { C, book, rs, N, issues, add, exprs, links, sets, assigned, graph } = X;
  const start = rs.rules["start-node"] || book.meta.start;
  const roots = new Set([start, book.meta["at-end"], ...book.events.map((e) => `@event.${e.id}`), ...Object.values(rs.resources).map((r) => r.onZero)].filter(Boolean));
  for (const l of links) if (l.from.startsWith("area:")) roots.add(l.to);
  for (const id of Object.keys(N)) if (CONVENTION.some((re) => re.test(id))) roots.add(id);
  for (const m of Object.values(C.meters)) if (m.full) { const pre = m.full.split("$")[0]; for (const id of Object.keys(N)) if (id === m.full || (m.full.includes("$") && id.startsWith(pre)) || id === m.full.split(".$")[0]) roots.add(id); }
  if (start && !N[start]) add("error", book.meta, `@meta start: no node ${start}`);
  const out = new Map(); for (const l of links) { if (!out.has(l.from)) out.set(l.from, []); out.get(l.from).push(l); }
  const seen = new Set(), queue = [...roots].filter((r) => N[r]);
  while (queue.length) { const id = queue.shift(); if (seen.has(id)) continue; seen.add(id); for (const l of out.get(id) || []) if (N[l.to] && !seen.has(l.to)) queue.push(l.to); }
  graph.roots = [...roots];
  for (const n of Object.values(N)) if (!seen.has(n.id)) add("warn", n, `unreachable from ${start ? `@meta start ${start}` : "any entry point"}`, n.id);
  Object.assign(X, { seen, start, roots });
  return X;
}

// dead ends: a node that runs out returns only when it was called
function deadEnds(X) {
  const { N, add, links, graph, roots } = X;
  const called = new Set(links.filter((l) => l.kind === "call" || l.kind === "passive").map((l) => l.to));
  for (const n of Object.values(N)) {
    const g = graph.nodes[n.id];
    if (!g.terminates && !called.has(n.id) && !n.event && !roots.has(n.id)) add("warn", n, "dead end: runs out with no go, option, end, exit or return", n.id);
  }
  return X;
}

// names, calls and flags
function namesAndFlags(X) {
  const { C, book, rs, N, issues, add, exprs, links, sets, assigned, graph } = X;
  const declared = new Set([...Object.keys(rs.vars), ...assigned]);
  const nightTerms = new Set([...Object.values(C.nights).flatMap((n) => n.keys.map((k) => k.term))]);
  const has = { flag: (id) => true, place: (id) => !!book.places[id] || Object.values(C.map.areas).some((a) => a.place === id), node: (id) => !!N[id] || !!(X.carry && X.carry.nodes && X.carry.nodes.includes(id)), area: (id) => !!C.map.areas[id], district: (id) => !!C.map.districts[id] || Object.values(book.places).some((p) => p.district === id),
    item: (id) => !!rs.items[id], trait: (id) => !!rs.traits[id], quest: (id) => !!rs.quests[id], faction: (id) => !!rs.factions[id], meter: (id) => !!C.meters[id], project: (id) => !!C.projects[id],
    interrogation: (id) => !!(C.interrogations || {})[id], sneak: (id) => !!C.sneaks[id], object: (id) => !!C.objects[id], encounter: (id) => !!((book.records || {}).encounter || {})[id], skill: (id) => !!rs.skills[id], attr: (id) => !!rs.attrs[id], resource: (id) => !!rs.resources[id], char: (id) => !!rs.chars[id], run: (id) => !!C.runs[id] };
  const reads = new Map();
  for (const { c, at, node } of exprs) {
    for (const id of c.ids) {
      if (BUILTIN.has(id) || nightTerms.has(id) || declared.has(id) || rs.skills[id] || rs.attrs[id]) continue;
      const dot = id.indexOf("."), pre = dot > 0 ? id.slice(0, dot) : "", k = id.slice(dot + 1);
      if (pre && PREFIXES.includes(pre)) { const kind = { attr: "attr", skill: "skill", rep: "faction", trait: "trait", quest: "quest", project: "project", meter: "meter", item: "item", run: "run" }[pre]; if (kind && !has[kind](k)) add("warn", at, `${id}: no ${kind} ${k}`, node); if (pre === "var" && !declared.has(k)) add("warn", at, `${id} is never declared or set`, node); continue; }
      if (c.words && c.words.has(id)) continue;
      add("warn", at, `undefined name ${id}`, node);
    }
    for (const [name, calls] of c.calls) {
      if (!KNOWN_CALLS.has(name)) { add("error", at, `unknown function ${name}()`, node); continue; }
      const kind = ID_ARG_CALLS[name];
      for (const args of calls) {
        const id = args[0]; if (id == null || !kind) continue;
        if (name === "has") { if (!reads.has(id)) reads.set(id, []); reads.get(id).push({ at, node }); continue; }
        if (kind !== "flag" && has[kind] && !has[kind](String(id))) add("warn", at, `${name}(${id}): no ${kind} ${id}`, node);
        if (name === "quest" && args[1] != null && rs.quests[id] && !rs.quests[id].stages.some((s) => s.id === String(args[1]))) add("warn", at, `quest(${id}, ${args[1]}): no such stage`, node);
      }
    }
  }
  // flags the combat layer sets when a fight ends (combat/encounter.mjs, NOTES C1)
  // flags the engine sets itself: combat (NOTES C1), verbs, and stealth outcomes
  const COMBAT_SET = /^(struck\.|fought\.|book\.|done\.|seen\.|noticed\.)/;
  for (const g of Object.values((C.gates && C.gates.gates) || {})) { const never = g.resolved.filter((f) => !sets.has(f) && !COMBAT_SET.test(f)); if (never.length === g.resolved.length) add("warn", g, `gate ${g.id}: none of its resolved flags is ever set (${never.join(", ")}), so it never pays`); }
  for (const [id, where] of reads) if (!sets.has(id) && !COMBAT_SET.test(id)) add("warn", where[0].at, `flag ${id} is read${where.length > 1 ? ` (${where.length} times)` : ""} but never set`, where[0].node);
  return X;
}

// speakers, when the content has @char records
function speakers(X) {
  const { C, book, rs, N, issues, add, exprs, links, sets, assigned, graph } = X;
  if (Object.keys(rs.chars).length) {
    const speakers = new Set([...Object.values(rs.chars).map((c) => c.speaker), "LAMB"]);
    for (const n of Object.values(N)) for (const s of n.steps) if (s.kind === "line" && s.who && !speakers.has(s.who.toUpperCase())) add("warn", s, `speaker ${s.who} has no @char`, n.id);
  }
  return X;
}

// names() is re-exported so tools can list what an expression reads.
export { names };
