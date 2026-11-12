// LWD/0 reference checker and night walker (JavaScript reference for the BuildLang track).
//   node slice/lwd_check.mjs slice/lamp_quay_2300.lwd [--walks 1000] [--print out.md] [--json out.json]
// 1. Parses the file (LWD-FORMAT.md) and checks it: unique ids, every target exists, every fact
//    used is declared, every condition parses, every node can continue (no dead end).
// 2. Walks the night: a small environment model (the slice's tide, fog, rain and wind, from
//    design/SYSTEMS.md) and seeded random choices, N times. A walk fails if it reaches a node with
//    no way on before the end, or if the clock stops advancing for 200 steps (a loop that costs no
//    time). Reports coverage, endings and word counts. A control walk with time frozen must fail.
// 3. Optionally prints a reading copy of the script as Markdown.
import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------- parse
export function parse(text) {
  const recs = [], errors = [];
  let cur = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd(), n = i + 1;
    if (!line.trim() || line.startsWith("#")) return;
    if (line.startsWith("@")) { const [kind, id = ""] = line.slice(1).split(/\s+/, 2); cur = { kind, id, line: n, kv: [] }; recs.push(cur); return; }
    if (!cur) { errors.push(`${n}: content before any record`); return; }
    const k = line.indexOf(": "); if (k < 0) { errors.push(`${n}: expected "key: value"`); return; }
    cur.kv.push({ key: line.slice(0, k).trim(), value: line.slice(k + 2), line: n });
  });
  return { recs, errors };
}
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };
// option lines:  "label" -> target [/ fail] [? cond] [+n]
export function parseOpt(v) {
  const m = v.match(/^"([^"]*)"\s*->\s*([\w.]+)(?:\s*\/\s*([\w.]+))?(?:\s*\?\s*(.*?))?(?:\s*\+(\d+))?\s*$/);
  if (!m) return null;
  return { label: m[1], target: m[2], fail: m[3] || null, cond: m[4] ? m[4].trim() : null, cost: m[5] ? +m[5] : 0 };
}
// conditions: tokenise and parse to a postfix array (no boxed tree, as a BuildLang loader would keep it)
export function compileCond(src) {
  const toks = src.match(/has\([\w.]+\)|at\([\w.]+\)|\d+:\d+|-?\d+(?:\.\d+)?|[a-z][\w.]*|<=|>=|==|!=|[<>&|!()]/g) || [];
  let p = 0; const out = [];
  const peek = () => toks[p], eat = (t) => { if (toks[p] !== t) throw new Error(`expected ${t} at "${toks.slice(p).join(" ")}"`); p++; };
  function or() { and(); while (peek() === "|") { p++; and(); out.push("|"); } }
  function and() { unary(); while (peek() === "&") { p++; unary(); out.push("&"); } }
  function unary() { if (peek() === "!") { p++; unary(); out.push("!"); } else atom(); }
  function atom() {
    const t = peek();
    if (t === "(") { p++; or(); eat(")"); return; }
    if (/^(has|at)\(/.test(t)) { out.push(t); p++; return; }
    if (/^[a-z][\w.]*$/.test(t)) { p++; const op = peek(); if (!["<", "<=", ">", ">=", "==", "!="].includes(op)) throw new Error(`no comparison after ${t}`); p++; const v = peek(); p++; out.push(`${t}${op}${v}`); return; }
    throw new Error(`unexpected "${t}"`);
  }
  or(); if (p !== toks.length) throw new Error(`trailing "${toks.slice(p).join(" ")}"`);
  return out;
}

export function build(text) {
  const { recs, errors } = parse(text), meta = {}, places = {}, facts = {}, events = [], nodes = {};
  for (const r of recs) {
    const get = (k) => (r.kv.find((x) => x.key === k) || {}).value;
    if (r.kind === "meta") for (const { key, value } of r.kv) meta[key] = value;
    else if (r.kind === "place") places[r.id] = { light: +get("light"), sodium: +get("sodium"), dark: +get("dark-light"), zone: get("zone"), name: get("name") };
    else if (r.kind === "fact") { if (facts[r.id]) errors.push(`${r.line}: fact ${r.id} declared twice`); facts[r.id] = { about: get("about"), against: r.kv.filter((x) => x.key === "against").map((x) => x.value) }; }
    else if (r.kind === "event") events.push({ id: r.id, at: toMin(get("at")), kv: r.kv.filter((x) => x.key !== "at") });
    else if (r.kind === "node") { if (nodes[r.id]) errors.push(`${r.line}: node ${r.id} declared twice`); nodes[r.id] = { id: r.id, kv: r.kv, line: r.line }; }
    else errors.push(`${r.line}: unknown record kind @${r.kind}`);
  }
  // compile options and conditions; collect references
  const usedFacts = new Set(), checkCond = (c, where) => { try { const pf = compileCond(c); for (const t of pf) { const m = t.match(/^has\(([\w.]+)\)$/); if (m) usedFacts.add([m[1], where]); const a = t.match(/^at\(([\w.]+)\)$/); if (a && !places[a[1]]) errors.push(`${where}: unknown place ${a[1]}`); } return pf; } catch (e) { errors.push(`${where}: condition "${c}": ${e.message}`); return null; } };
  for (const n of Object.values(nodes)) {
    n.steps = [];
    let canContinue = false;
    for (const { key, value, line } of n.kv) {
      const where = `${line} (${n.id})`;
      if (key === "opt" || key === "claim") {
        const o = parseOpt(value); if (!o) { errors.push(`${where}: bad ${key} line`); continue; }
        if (key === "claim" && !o.fail) errors.push(`${where}: a claim needs "ok / fail"`);
        for (const t of [o.target, o.fail].filter(Boolean)) if (!nodes[t] && !recs.some((r) => r.kind === "node" && r.id === t)) errors.push(`${where}: unknown target ${t}`);
        o.pf = o.cond ? checkCond(o.cond, where) : null; o.kind = key; n.steps.push(o); canContinue = true;
      } else if (key === "alt") {
        const m = value.match(/^([\w.]+)\s*\?\s*(.*)$/); if (!m) { errors.push(`${where}: bad alt`); continue; }
        if (!recs.some((r) => r.kind === "node" && r.id === m[1])) errors.push(`${where}: unknown target ${m[1]}`);
        n.steps.push({ kind: "alt", target: m[1], pf: checkCond(m[2], where), cond: m[2] });
      } else if (key === "go") { if (!recs.some((r) => r.kind === "node" && r.id === value)) errors.push(`${where}: unknown target ${value}`); n.steps.push({ kind: "go", target: value }); canContinue = true; }
      else if (key === "end") { n.steps.push({ kind: "end", outcome: value }); canContinue = true; }
      else if (key === "set" || key === "clear") { usedFacts.add([value, where]); n.steps.push({ kind: key, fact: value }); }
      else if (key === "place") { if (!places[value]) errors.push(`${where}: unknown place ${value}`); n.steps.push({ kind: "place", place: value }); }
      else if (key === "cost") n.steps.push({ kind: "cost", n: +value });
      else if (key === "cmd") n.steps.push({ kind: "cmd", cmd: value.split(/\s+/) });
      else if (["nar", "line", "inst", "read"].includes(key)) n.steps.push({ kind: key, text: value });
      else errors.push(`${where}: unknown key ${key}`);
    }
    if (!canContinue) errors.push(`${n.line} (${n.id}): no opt, claim, go or end: a dead end`);
  }
  for (const e of events) for (const { key, value, line } of e.kv) if (key === "set") usedFacts.add([value, `${line} (${e.id})`]);
  for (const [f, where] of usedFacts) if (!facts[f]) errors.push(`${where}: fact ${f} is not declared`);
  if (!nodes[meta.start]) errors.push(`meta: start node ${meta.start} missing`);
  if (meta["at-end"] && !nodes[meta["at-end"]]) errors.push(`meta: at-end node ${meta["at-end"]} missing`);
  return { meta, places, facts, events, nodes, errors };
}

// ---------------------------------------------------------------- the slice's environment model
// Tide: two constituents, low water -0.55 m at 22:58 (design/SYSTEMS.md section 4).
const T_LOW = 22 * 60 + 58;
export function env(clock) {
  const tau = (clock - T_LOW) / 60, tide = 2.4 - 2.2 * Math.cos((2 * Math.PI * tau) / 12.42) - 0.75 * Math.cos((2 * Math.PI * tau) / 12.0);
  const fog = clock < toMin("23:20") ? 0 : Math.min(0.08, (0.08 * (clock - toMin("23:20"))) / 30);
  const rain = clock < toMin("23:35") ? 0 : 1.5;
  return { tide, fog, rain, "wind.dir": clock < toMin("23:35") ? 270 : 225, "wind.speed": clock < toMin("23:35") ? 6 : 9 };
}
function evalCond(pf, st, book) {
  const s = [];
  for (const t of pf) {
    if (t === "&") { const b = s.pop(), a = s.pop(); s.push(a && b); continue; }
    if (t === "|") { const b = s.pop(), a = s.pop(); s.push(a || b); continue; }
    if (t === "!") { s.push(!s.pop()); continue; }
    let m;
    if ((m = t.match(/^has\(([\w.]+)\)$/))) { s.push(st.facts.has(m[1])); continue; }
    if ((m = t.match(/^at\(([\w.]+)\)$/))) { s.push(st.place === m[1]); continue; }
    m = t.match(/^([a-z][\w.]*)(<=|>=|==|!=|<|>)(.+)$/); const [, term, op, raw] = m;
    const lhs = term === "hour" ? st.clock : termOf(term, st, book), rhs = term === "hour" ? toMin(raw) : isNaN(+raw) ? raw : +raw;
    s.push(op === "<" ? lhs < rhs : op === "<=" ? lhs <= rhs : op === ">" ? lhs > rhs : op === ">=" ? lhs >= rhs : op === "==" ? lhs === rhs : lhs !== rhs);
  }
  return s.pop();
}
function termOf(term, st, book) {
  const e = env(st.clock), P = book.places[st.place] || { light: 0, sodium: 0, dark: 0, zone: "" }, quayOff = st.power === "off" && P.zone === "quay";
  if (term in e) return e[term];
  if (term === "light") return st.place === "lamproom" && st.mother === "burning" ? 0.9 : quayOff ? P.dark : P.light;
  if (term === "sodium") return quayOff ? 0 : P.sodium;
  if (term === "power.quay") return st.power;
  if (term === "mother") return st.mother;
  if (term === "chits") return st.facts.has("chits.refused") ? 0 : 10;
  if (term === "paraffin") return 2;
  if (term === "wet") return st.wet;
  throw new Error(`unknown term ${term}`);
}

// ---------------------------------------------------------------- walk
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function walk(book, seed, { freezeTime = false, maxSteps = 4000, novel = null, route = null } = {}) {
  let ri = 0;
  const r = rng(seed), endAt = toMin(book.meta["end-clock"] || "00:00"), st = { clock: toMin(book.meta.clock), facts: new Set(), place: null, power: "on", mother: "dark", wet: 0 }, seen = new Set(), fired = new Set();
  let id = book.meta.start, stall = 0, lastClock = st.clock, forced = false;
  for (let step = 0; step < maxSteps; step++) {
    const n = book.nodes[id]; if (!n) return { ok: false, why: `missing node ${id}`, seen };
    seen.add(id);
    let next = null, choices = [];
    for (const s of n.steps) {
      if (s.kind === "cost" && !freezeTime) st.clock += s.n;
      else if (s.kind === "set") st.facts.add(s.fact); else if (s.kind === "clear") st.facts.delete(s.fact);
      else if (s.kind === "place") st.place = s.place;
      else if (s.kind === "cmd") { const [c, a, b] = s.cmd; if (c === "setPower" && a === "quay") st.power = b; if (c === "restrike") st.mother = "burning"; if (c === "wet") st.wet = Math.min(1, st.wet + +b); }
      else if (s.kind === "alt") { if (evalCond(s.pf, st, book)) { next = s.target; break; } }
      else if (s.kind === "go") { next = s.target; break; }
      else if (s.kind === "end") return { ok: true, outcome: s.outcome, clock: st.clock, seen, facts: st.facts, forced };
      else if (s.kind === "opt") { if (!s.pf || evalCond(s.pf, st, book)) choices.push(s); }
      else if (s.kind === "claim") choices.push(s);
    }
    for (const e of book.events) if (!fired.has(e.id) && st.clock >= e.at) { fired.add(e.id); for (const { key, value } of e.kv) if (key === "set") st.facts.add(value); }
    if (!forced && st.clock >= endAt && book.meta["at-end"]) { forced = true; id = book.meta["at-end"]; continue; }
    if (!next) {
      if (!choices.length) return { ok: false, why: `soft lock at ${id} (no option available) at ${st.clock}`, seen };
      // guided walks prefer an option whose target no walk has reached yet (coverage search)
      const fresh = novel ? choices.filter((o) => !novel.has(o.target) || (o.fail && !novel.has(o.fail))) : [];
      let c;
      if (route) {
        const has = (w) => choices.find((o) => o.label.toLowerCase().includes(w.toLowerCase()));
        let want = route.choices[ri];
        if (id === "midnight.choose" && route.final) want = route.final;
        else if (want === undefined) { want = (route.filler || []).find((w) => has(w)); if (!want) return { ok: false, why: `route ran out of choices at ${id}`, seen }; ri--; }
        c = has(want);
        if (!c) return { ok: false, why: `route step ${ri} "${want}" not available at ${id} (${st.clock}); options: ${choices.map((o) => o.label).join(" | ")}`, seen };
        ri++;
      } else c = fresh.length && r() < 0.85 ? fresh[Math.floor(r() * fresh.length)] : choices[Math.floor(r() * choices.length)];
      if (!freezeTime) st.clock += c.cost;
      next = c.kind === "claim" ? (!c.pf || evalCond(c.pf, st, book) ? c.target : c.fail) : c.target;
    }
    if (st.clock === lastClock) { if (++stall > 200) return { ok: false, why: `no time passes from ${id}: a loop that costs nothing`, seen }; } else { stall = 0; lastClock = st.clock; }
    id = next;
  }
  return { ok: false, why: "step limit", seen };
}

// ---------------------------------------------------------------- reading copy
function readingCopy(book) {
  const out = [`# ${book.meta.title}`, "", "Reading copy, generated from the LWD/0 data by `lwd_check.mjs --print`. The data file is the source.", ""];
  for (const n of Object.values(book.nodes)) {
    out.push(`### ${n.id}`, "");
    for (const s of n.steps) {
      if (s.kind === "nar") out.push(s.text, "");
      else if (s.kind === "line" || s.kind === "inst") { const k = s.text.indexOf(": "); out.push(`**${s.text.slice(0, k)}**: ${s.text.slice(k + 2)}`, ""); }
      else if (s.kind === "opt") out.push(`- *${s.label}* -> ${s.target}${s.cond ? ` (if ${s.cond})` : ""}`);
      else if (s.kind === "claim") out.push(`- CLAIM *${s.label}* -> ${s.target} / ${s.fail} (holds if ${s.cond})`);
      else if (s.kind === "alt") out.push(`- *(if ${s.cond})* -> ${s.target}`);
      else if (s.kind === "go") out.push(`- -> ${s.target}`);
      else if (s.kind === "end") out.push(`- END: ${s.outcome}`);
      else if (s.kind === "set") out.push(`- *(fact: ${s.fact})*`);
    }
    out.push("");
  }
  return out.join("\n");
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1].endsWith("lwd_check.mjs")) {
  const args = process.argv.slice(2), file = args[0], opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const book = build(readFileSync(file, "utf8"));
  const words = Object.values(book.nodes).reduce((a, n) => a + n.steps.filter((s) => ["nar", "line", "inst"].includes(s.kind)).reduce((b, s) => b + s.text.split(/\s+/).length, 0), 0)
    + book.events.reduce((a, e) => a + e.kv.filter((x) => ["nar", "line", "inst"].includes(x.key)).reduce((b, x) => b + x.value.split(/\s+/).length, 0), 0);
  console.log(`records: ${Object.keys(book.nodes).length} nodes, ${Object.keys(book.facts).length} facts, ${book.events.length} events, ${Object.keys(book.places).length} places; ${words} words of game text`);
  if (book.errors.length) { console.log(`ERRORS (${book.errors.length}):\n  ${book.errors.join("\n  ")}`); process.exitCode = 1; }
  else console.log("structure: ok (ids unique, targets exist, facts declared, conditions parse, no dead ends)");
  const N = +opt("--walks", 1000), endings = {}, visited = new Set(), fails = [], factsSeen = {};
  for (let s = 1; s <= N; s++) { const w = walk(book, s); w.seen.forEach((x) => visited.add(x)); if (!w.ok) fails.push(`seed ${s}: ${w.why}`); else { endings[w.outcome] = (endings[w.outcome] || 0) + 1; for (const f of w.facts) factsSeen[f] = (factsSeen[f] || 0) + 1; } }
  const control = walk(book, 7, { freezeTime: true });
  // guided walks: novelty-seeking choices, to show every node is reachable inside the hour
  const novel = new Set(), gEnd = {}; let gFail = 0;
  for (let s = 1; s <= N; s++) { const w = walk(book, 100000 + s, { novel }); w.seen.forEach((x) => novel.add(x)); if (!w.ok) gFail++; else gEnd[w.outcome] = (gEnd[w.outcome] || 0) + 1; }
  const gUnreached = Object.keys(book.nodes).filter((n) => !novel.has(n));
  const unvisited = Object.keys(book.nodes).filter((n) => !visited.has(n));
  console.log(`walks: ${N}, failed ${fails.length}${fails.length ? `\n  ${fails.slice(0, 5).join("\n  ")}` : ""}`);
  console.log(`endings: ${JSON.stringify(endings)}`);
  console.log(`node coverage: ${visited.size} of ${Object.keys(book.nodes).length}${unvisited.length ? `; never reached: ${unvisited.join(", ")}` : ""}`);
  console.log(`guided walks: ${N}, failed ${gFail}; endings ${JSON.stringify(gEnd)}; node coverage ${novel.size} of ${Object.keys(book.nodes).length}${gUnreached.length ? `; never reached: ${gUnreached.join(", ")}` : ""}`);
  console.log(`control (time frozen, must fail): ${control.ok ? "DID NOT FAIL (checker broken)" : `failed as expected: ${control.why}`}`);
  if (control.ok || fails.length || gFail) process.exitCode = 1;
  const rf = opt("--routes", null), routeOut = [];
  if (rf) for (const rt of JSON.parse(readFileSync(rf, "utf8"))) {
    const w = walk(book, 1, { route: rt }); w.seen.forEach((x) => novel.add(x));
    const ok = w.ok && (!rt.expect || w.outcome === rt.expect); routeOut.push({ name: rt.name, ok, outcome: w.outcome || null, clock: w.clock, why: w.why || null });
    console.log(`route ${rt.name}: ${ok ? "ok" : "FAILED"} -> ${w.outcome || w.why}${w.clock ? ` at ${Math.floor(w.clock / 60) % 24}:${String(w.clock % 60).padStart(2, "0")}` : ""}`);
    if (!ok) process.exitCode = 1;
  }
  if (rf) { const left = Object.keys(book.nodes).filter((n) => !novel.has(n)); console.log(`coverage with routes: ${novel.size} of ${Object.keys(book.nodes).length}${left.length ? `; never reached: ${left.join(", ")}` : ""}`); }
  const pr = opt("--print", null); if (pr) writeFileSync(pr, readingCopy(book));
  const js = opt("--json", null); if (js) writeFileSync(js, JSON.stringify({ file, words, nodes: Object.keys(book.nodes).length, facts: Object.keys(book.facts).length, events: book.events.length, walks: N, failed: fails.length, endings, coverage: visited.size, unvisited, guided: { failed: gFail, endings: gEnd, unreached: gUnreached }, routes: routeOut, coverageWithRoutes: novel.size, control: control.ok ? "did not fail" : control.why, factsHeldByWalks: factsSeen }, null, 1));
}
