// The world record (design/quota/04-SYSTEMS.md section 6, pillar 2): what each finished run did to the world,
// kept beside the saves and never cleared by a new game, so the next run, whatever its class, starts in a world
// that keeps the damage: the facts its lore found, the people it harmed, the dead and their stones, the lies, how
// its choices ended, and the line its character said, quoted.
//
// How it is stored (local only: nothing is sent anywhere):
//   two copies in the same storage the saves use (browser localStorage in the game, a folder of files in the
//   harness): lw.world.<story> and lw.world.<story>.b. Each is JSON
//   { format: "low-water.world", version: 1, story, runs: [entry...], sum } where sum is a hash of the runs.
//   Neither key is a save slot: deleting a slot (save/save.mjs remove) or starting a new game touches neither.
//   On every read both copies are checked; a copy that is missing, unreadable or whose sum does not match is
//   rewritten from the good one (the longer, when both are good), so removing one key does not clear it.
//   Clearing the browser's data for the site clears both: that is the only way, and it is the player's.
//   Loading an older save does not take a run back out: the record is outside the save state, and each run
//   is written once, by its run id, when it reaches an end.
//
// An entry: { run, story, class, end, day, facts, harmed, lies, stones, keep, line }
//   facts   the lore facts the run kept (world/lore.mjs gives) and each @worldfact whose when held at the end
//   harmed  the households record events fell on (world/community.mjs record, victim)
//   lies    lied.* flags set; stones: the names on the @worldfact stones; keep: @meta world-keep variables
//   line    the last option the character chose that set a said.* flag (@meta world-line narrows which): { words, flag, node }
//
//   @worldfact world.dead.tomas
//   when: has(q.tomas_held)
//   stone: T. HALDANE
//   about: Tomas Haldane died in the cells on day 45.
//
//   const W = createWorldRecord(storage, "quota");   W.read()   W.runs()   W.priorFacts()   W.add(entry)
//   installWorldRecord(G, W)  seeds the game from the record (lore prior facts; var.prior_line, var.prior_who,
//   var.prior_stones, var.prior_runs) and writes the entry at the run's end (the "end" event).
import { compile, evaluate } from "../core/expr.mjs";

export const WORLD_FORMAT = "low-water.world";
const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); };

export function loadWorldFacts(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).worldfact || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!["when", "stone", "about"].includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      if (!one("when")) throw new SyntaxError("needs when:");
      out[r.id] = { id: r.id, when: compile(one("when")), src: one("when"), stone: one("stone") || null, about: one("about") || "", file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `worldfact ${r.id}: ${e.message}` }); }
  }
  return { worldfacts: out, errors };
}

export function createWorldRecord(storage, story = "story") {
  const keys = [`lw.world.${story}`, `lw.world.${story}.b`];
  const empty = () => ({ format: WORLD_FORMAT, version: 1, story, runs: [], sum: hash("[]") });
  const parse = (raw) => {
    if (!raw) return null;
    try { const d = JSON.parse(raw); return d && d.format === WORLD_FORMAT && Array.isArray(d.runs) && d.sum === hash(JSON.stringify(d.runs)) ? d : null; }
    catch (e) { console.warn(`world record: a copy is unreadable (${e.message}); rewriting it from the other`); return null; }
  };
  const write = (d) => { d.sum = hash(JSON.stringify(d.runs)); const s = JSON.stringify(d); for (const k of keys) storage.set(k, s); return d; };
  const api = {
    keys,
    // both copies, healed: the good one (the longer when both are good) written over the other
    read() {
      const raws = keys.map((k) => storage.get(k)), [a, b] = raws.map(parse);
      const best = a && b ? (b.runs.length > a.runs.length ? b : a) : a || b || empty();
      if (raws.some((r, i) => !r || ![a, b][i] || [a, b][i].runs.length !== best.runs.length)) { if (raws.some(Boolean) && !(a && b)) console.warn(`world record: healed a missing or damaged copy (${story})`); write(best); }
      return best;
    },
    runs: () => api.read().runs,
    has: (run) => api.read().runs.some((e) => e.run === run),
    add(entry) { const d = api.read(); if (d.runs.some((e) => e.run === entry.run)) return false; d.runs.push(entry); write(d); return true; },
    priorFacts: () => [...new Set(api.read().runs.flatMap((e) => e.facts || []))],
    last: () => { const r = api.read().runs; return r.length ? r[r.length - 1] : null; },
  };
  return api;
}

// The run's entry from a finished game
export function runEntry(G, { story = "story", worldfacts = {} } = {}) {
  const book = G.book.meta || {}, keepVars = String(book["world-keep"] || "").split(/\s+/).filter(Boolean);
  const held = Object.values(worldfacts).filter((w) => { try { return !!evaluate(w.when, G.scope); } catch (e) { console.warn(`world record: ${w.id}: ${e.message}`); return false; } });
  const events = G.reckoning ? G.reckoning.events() : [];
  const classVar = String(book["class-var"] || "class").trim();
  return {
    run: G.state.runId, story, class: G.scope.get(`var.${classVar}`) ?? null, end: G.state.ended || null, day: G.community ? G.community.day() : null,
    facts: [...new Set([...(G.lore ? G.lore.facts() : []), ...held.map((w) => w.id)])],
    harmed: [...new Set(events.map((e) => e.victim).filter(Boolean))],
    lies: G.state.flags.filter((f) => f.startsWith("lied.")),
    stones: held.map((w) => w.stone).filter(Boolean),
    keep: Object.fromEntries(keepVars.map((v) => [v, G.scope.get(`var.${v}`) ?? null])),
    line: G.state.lastSaid || null,
  };
}

export function installWorldRecord(G, W, { story = "story", worldfacts = {} } = {}) {
  if (G.worldRecord) return G.worldRecord;
  G.state.runId ||= `${story}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  // seed from the earlier runs: the facts they kept, the last character's line, the stones
  const runs = W.runs(), last = runs.length ? runs[runs.length - 1] : null, V = G.state.vars;
  if (G.lore) G.lore.seedPrior([...new Set([...(G.state.prior || []), ...W.priorFacts()])]);
  if (last && last.line) { V.prior_line = last.line.words; V.prior_who = last.class || ""; }
  V.prior_stones = [...new Set(runs.flatMap((e) => e.stones || []))].join(", ");
  V.prior_runs = runs.length;
  // the line the character says (the last chosen option that set a said.* flag), kept for the next run's quote
  // @meta world-line: the said.* flags worth quoting, as patterns (* matches any run of letters); default any said.*
  const pats = String((G.book.meta || {})["world-line"] || "").split(/\s+/).filter(Boolean).map((p) => new RegExp(`^${p.replace(/[.]/g, "\\.").replace(/\*/g, "[\\w.]*")}$`));
  const quotable = (flag) => flag.startsWith("said.") && (!pats.length || pats.some((re) => re.test(flag)));
  let lastLabel = null;
  const say = G.memory.say.bind(G.memory);
  G.memory.say = (key, label) => { lastLabel = { key, label, node: G.activeTalk ? G.activeTalk.node : null }; return say(key, label); };
  G.on("flag", (e) => { if (e.on && quotable(e.id) && lastLabel) G.state.lastSaid = { words: String(lastLabel.label).replace(/^"|"$/g, ""), flag: e.id, node: lastLabel.node }; });
  G.on("end", (e) => { G.state.ended = e.id; W.add(runEntry(G, { story, worldfacts })); G.emit("world.recorded", { run: G.state.runId }); });
  G.worldRecord = W;
  return W;
}
