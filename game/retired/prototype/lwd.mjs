// LWD/0 loader and dialogue runner for the Low Water prototype. Runs in the browser and in Node.
//   const book = loadLwd(text);
//   const talk = book.start("keel.start", world);   // world: { notes:Set, clock, place, term(name) }
//   talk.beat -> { lines: [{ kind, who, text }], options: [{ label, index }] | null, end }
//   talk.choose(index)
// "world" supplies the game state: notes held (facts), the clock in minutes since 00:00 of the
// evening (23:00 = 1380), the place, terms read from the environment, and hooks for commands.

const toMin = (s) => { const [h, m] = s.split(":").map(Number); return (h < 12 ? h + 24 : h) * 60 + m; };

function parse(text) {
  const recs = []; let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (!line.trim() || line.startsWith("#")) continue;
    if (line.startsWith("@")) { const [kind, id = ""] = line.slice(1).split(/\s+/, 2); cur = { kind, id, kv: [] }; recs.push(cur); continue; }
    const k = line.indexOf(": "); if (k < 0 || !cur) continue;
    cur.kv.push({ key: line.slice(0, k).trim(), value: line.slice(k + 2) });
  }
  return recs;
}
function parseOpt(v) {
  const m = v.match(/^"([^"]*)"\s*->\s*([\w.]+)(?:\s*\/\s*([\w.]+))?(?:\s*\?\s*(.*?))?(?:\s*\+(\d+))?\s*$/);
  return m ? { label: m[1], target: m[2], fail: m[3] || null, cond: m[4] ? compile(m[4].trim()) : null, cost: m[5] ? +m[5] : 0 } : null;
}
export function compile(src) {
  const toks = src.match(/has\([\w.]+\)|at\([\w.]+\)|\d+:\d+|-?\d+(?:\.\d+)?|[a-z][\w.]*|<=|>=|==|!=|[<>&|!()]/g) || [];
  let p = 0; const out = [];
  const peek = () => toks[p];
  function or() { and(); while (peek() === "|") { p++; and(); out.push("|"); } }
  function and() { unary(); while (peek() === "&") { p++; unary(); out.push("&"); } }
  function unary() { if (peek() === "!") { p++; unary(); out.push("!"); } else atom(); }
  function atom() {
    const t = peek();
    if (t === "(") { p++; or(); p++; return; }
    if (/^(has|at)\(/.test(t)) { out.push(t); p++; return; }
    p++; const op = toks[p++], v = toks[p++]; out.push(`${t}${op}${v}`);
  }
  or(); return out;
}
export function test(pf, world) {
  if (!pf) return true;
  const s = [];
  for (const t of pf) {
    if (t === "&") { const b = s.pop(), a = s.pop(); s.push(a && b); continue; }
    if (t === "|") { const b = s.pop(), a = s.pop(); s.push(a || b); continue; }
    if (t === "!") { s.push(!s.pop()); continue; }
    let m;
    if ((m = t.match(/^has\(([\w.]+)\)$/))) { s.push(world.notes.has(m[1])); continue; }
    if ((m = t.match(/^at\(([\w.]+)\)$/))) { s.push(world.place === m[1]); continue; }
    m = t.match(/^([a-z][\w.]*)(<=|>=|==|!=|<|>)(.+)$/);
    const [, term, op, raw] = m, lhs = term === "hour" ? world.clock : world.term(term), rhs = term === "hour" ? toMin(raw) : isNaN(+raw) ? raw : +raw;
    s.push(op === "<" ? lhs < rhs : op === "<=" ? lhs <= rhs : op === ">" ? lhs > rhs : op === ">=" ? lhs >= rhs : op === "==" ? lhs === rhs : lhs !== rhs);
  }
  return s.pop();
}

export function loadLwd(text) {
  const recs = parse(text), book = { meta: {}, places: {}, facts: {}, events: [], nodes: {} };
  for (const r of recs) {
    const get = (k) => (r.kv.find((x) => x.key === k) || {}).value;
    if (r.kind === "meta") for (const { key, value } of r.kv) book.meta[key] = value;
    else if (r.kind === "place") book.places[r.id] = { name: get("name"), light: +get("light"), sodium: +get("sodium"), dark: +get("dark-light"), zone: get("zone") };
    else if (r.kind === "fact") book.facts[r.id] = { about: get("about"), against: r.kv.filter((x) => x.key === "against").map((x) => x.value.split(" ")[0]) };
    else if (r.kind === "event") book.events.push({ id: r.id, at: toMin(get("at")), kv: r.kv.filter((x) => x.key !== "at") });
    else if (r.kind === "node") book.nodes[r.id] = { id: r.id, steps: r.kv.map(({ key, value }) => {
      if (key === "opt" || key === "claim") return { kind: key, ...parseOpt(value) };
      if (key === "alt") { const m = value.match(/^([\w.]+)\s*\?\s*(.*)$/); return { kind: "alt", target: m[1], cond: compile(m[2]) }; }
      return { kind: key, value };
    }) };
  }
  book.clock0 = toMin(book.meta.clock || "23:00");
  book.start = (id, world, opts) => runner(book, id, world, opts);
  return book;
}

// A dialogue in progress. exits: node ids that end the conversation and hand control back to
// walking (the script's travel menus, which the game replaces with the world itself).
function runner(book, startId, world, { exits = new Set(), onCmd = () => {}, onEnd = () => {} } = {}) {
  const talk = { beat: null, done: false };
  function speakerOf(v) { const k = v.indexOf(": "); return k < 0 ? { who: "", text: v } : { who: v.slice(0, k), text: v.slice(k + 2) }; }
  function play(id) {
    const lines = [];
    for (let hop = 0; hop < 40; hop++) {
      if (exits.has(id)) { talk.done = true; talk.beat = { lines, options: null, exit: id }; onEnd(id); return; }
      const n = book.nodes[id]; if (!n) throw new Error(`no node ${id}`);
      world.visit && world.visit(id);
      let next = null; const options = [];
      for (const s of n.steps) {
        if (s.kind === "cost") world.spend(+s.value);
        else if (s.kind === "place") world.place = s.value;
        else if (s.kind === "set") { if (!world.notes.has(s.value)) { world.notes.add(s.value); world.noted && world.noted(s.value); } }
        else if (s.kind === "clear") world.notes.delete(s.value);
        else if (s.kind === "cmd") onCmd(s.value.split(/\s+/));
        else if (s.kind === "nar") lines.push({ kind: "nar", who: "", text: s.value });
        else if (s.kind === "line" || s.kind === "inst") lines.push({ kind: s.kind, ...speakerOf(s.value) });
        else if (s.kind === "read") continue;
        else if (s.kind === "alt") { if (test(s.cond, world)) { next = s.target; break; } }
        else if (s.kind === "go") { next = s.value; break; }
        else if (s.kind === "end") { talk.done = true; talk.beat = { lines, options: null, end: s.value }; onEnd(s.value); return; }
        else if (s.kind === "opt") { if (test(s.cond, world)) options.push(s); }
        else if (s.kind === "claim") options.push(s);
      }
      if (next) { id = next; continue; }
      talk.beat = { lines, options: options.map((o, index) => ({ label: o.label, claim: o.kind === "claim", index, o })) };
      return;
    }
    throw new Error(`dialogue: too many hops from ${startId}`);
  }
  talk.choose = (i) => {
    const o = talk.beat.options[i].o;
    if (o.cost && !exits.has(o.target)) world.spend(o.cost);
    play(o.kind === "claim" ? (test(o.cond, world) ? o.target : o.fail) : o.target);
  };
  talk.jump = (id) => play(id);
  play(startId);
  return talk;
}
