// The lore graph (design/PITCHES.md 3c.2 and 3c.6, design/quota/04-SYSTEMS.md section 7). Lore comes in three
// layers: surface (anyone sees it in passing), deep (found by looking, reading and connecting, often by class)
// and hidden (found only on certain runs: by class, by a choice, or by what an earlier run left in the world
// record). A fragment is found where it is (a prop in a state, a node, a record event) when its requirements
// hold. A chain is the full answer a player can assemble, with the routes that complete it.
//
//   @lore q.lore.cell_log
//   chain: q.missing_tomas
//   layer: deep                                  surface | deep | hidden
//   where: node q.will.post.arrest               prop <id> [state,state] | touch <prop> [kind] | echo <id> | node <id>
//                                                | record <type>   (repeatable; touch and echo: the hand and the changed
//                                                place, world/props.mjs touch: and world/echo.mjs, 2026-10-23)
//   requires: class militia                      class <value> | lore <id> | choice <condition> | prior <fact>   (repeatable)
//   gives: q.fact.cell_log                       facts the world record keeps for later runs (comma separated)
//   about: The cell log: Haldane, T., held for hoarding grain.    (for designers; the game shows nothing of it)
//
//   @chain q.missing_tomas
//   name: The missing Haldane brother
//   route: two-classes | q.lore.bowls, q.lore.ledger, q.lore.cell_log     one-run | two-classes | across-runs
//
// The class is the variable @meta class-var names (The Quota: q_class). prior(fact) reads the facts an earlier
// run left (G.lore.seedPrior, the world record of world/worldrecord.mjs). Found fragments: flag lore.<id>,
// G.state.lore [{ id, layer, chain, via, clock }], event lore.found; their facts: G.state.facts, event fact.kept.
// tools/lorecheck.mjs lints the graph and plays it.
import { compile, evaluate } from "../core/expr.mjs";
import { registerCalls } from "../core/scope.mjs";

export const LAYERS = ["surface", "deep", "hidden"];
export const RULES = ["one-run", "two-classes", "across-runs"];
const list = (v) => (v ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);

function parseWhere(value, line) {
  const w = value.trim().split(/\s+/);
  if (w[0] === "prop") return { kind: "prop", id: w[1], states: list(w.slice(2).join(" ")) };
  if (w[0] === "touch") return { kind: "touch", id: w[1], states: w[2] ? [w[2]] : [] };
  if (w[0] === "node" || w[0] === "record" || w[0] === "echo") return { kind: w[0], id: w[1] };
  throw new SyntaxError(`line ${line}: where: expected prop <id> [states], touch <prop> [kind], echo <id>, node <id> or record <type>`);
}
function parseReq(value, line) {
  const m = value.trim().match(/^(class|lore|choice|prior)\s+(.+)$/);
  if (!m) throw new SyntaxError(`line ${line}: requires: expected class <value>, lore <id>, choice <condition> or prior <fact>`);
  return m[1] === "choice" ? { kind: "choice", src: m[2].trim(), cond: compile(m[2].trim()) } : { kind: m[1], id: m[2].trim() };
}

export function loadLore(book) {
  const fragments = {}, chains = {}, errors = [];
  const recs = (book.records || {});
  for (const r of Object.values(recs.lore || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!["chain", "layer", "where", "requires", "gives", "about"].includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      const layer = one("layer"); if (!LAYERS.includes(layer)) throw new SyntaxError(`layer: expected ${LAYERS.join(", ")}`);
      const where = r.kv.filter((e) => e.key === "where").map((e) => parseWhere(e.value, e.line)); if (!where.length) throw new SyntaxError("needs where:");
      const requires = r.kv.filter((e) => e.key === "requires").map((e) => parseReq(e.value, e.line));
      fragments[r.id] = { id: r.id, chain: one("chain") || null, layer, where, requires, gives: list(one("gives")), about: one("about") || "", file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `lore ${r.id}: ${e.message}` }); }
  }
  for (const r of Object.values(recs.chain || {})) {
    try {
      const routes = r.kv.filter((e) => e.key === "route").map((e) => {
        const bar = e.value.indexOf("|"); if (bar < 0) throw new SyntaxError(`line ${e.line}: route: expected "<rule> | lore, lore"`);
        const rule = e.value.slice(0, bar).trim(); if (!RULES.includes(rule)) throw new SyntaxError(`line ${e.line}: route: rule ${rule} (one of ${RULES.join(", ")})`);
        return { rule, needs: list(e.value.slice(bar + 1)), line: e.line };
      });
      if (!routes.length) throw new SyntaxError("needs at least one route:");
      const name = r.kv.find((e) => e.key === "name");
      chains[r.id] = { id: r.id, name: name ? name.value.trim() : r.id, routes, file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `chain ${r.id}: ${e.message}` }); }
  }
  return { fragments, chains, errors };
}

registerCalls({ prior: (G, [fact]) => (G.lore ? G.lore.prior(fact) : false) });

export function installLore(G, L) {
  if (G.lore) return G.lore;
  const F = L.fragments || {}, classVar = String((G.book.meta || {})["class-var"] || "class").trim();
  const st = () => G.state, found = () => (st().lore ||= []), facts = () => (st().facts ||= []);
  let prior = new Set(st().prior || []);
  const met = (q) => {
    if (q.kind === "class") return String(G.scope.get(`var.${classVar}`)) === q.id;
    if (q.kind === "lore") return found().some((x) => x.id === q.id);
    if (q.kind === "choice") return !!evaluate(q.cond, G.scope);
    return prior.has(q.id);
  };
  const api = {
    fragments: F, chains: L.chains || {},
    isFound: (id) => found().some((x) => x.id === id),
    found: () => found().map((x) => ({ ...x })),
    facts: () => [...facts()],
    prior: (fact) => prior.has(fact),
    // what an earlier run left (the world record): facts read by prior() and by requires: prior
    seedPrior(list) { prior = new Set(list); st().prior = [...prior]; },
    // find a fragment: when its requirements hold and it is not found yet; returns whether it was found now
    find(id, { via = "" } = {}) {
      const f = F[id]; if (!f) throw new Error(`no lore ${id}`);
      if (api.isFound(id) || !f.requires.every(met)) return false;
      found().push({ id, layer: f.layer, chain: f.chain, via, clock: Math.round(G.clock()) });
      G.setFlag(`lore.${id}`, true);
      G.emit("lore.found", { id, layer: f.layer, chain: f.chain, via });
      for (const k of f.gives) if (!facts().includes(k)) { facts().push(k); G.emit("fact.kept", { id: k, from: id }); }
      return true;
    },
  };
  // the triggers: a prop looked at in a state, a node played, a record event made
  const by = (kind) => Object.values(F).filter((f) => f.where.some((w) => w.kind === kind));
  G.on("prop.examine", (e) => { for (const f of by("prop")) for (const w of f.where) if (w.kind === "prop" && w.id === e.id && (!w.states.length || w.states.includes(e.state))) api.find(f.id, { via: `prop:${e.id}` }); });
  G.on("prop.touch", (e) => { for (const f of by("touch")) for (const w of f.where) if (w.kind === "touch" && w.id === e.id && (!w.states.length || w.states.includes(e.kind))) api.find(f.id, { via: `touch:${e.id}` }); });
  G.on("echo", (e) => { for (const f of by("echo")) for (const w of f.where) if (w.kind === "echo" && w.id === e.id) api.find(f.id, { via: `echo:${e.id}` }); });
  G.on("community.record", (e) => { for (const f of by("record")) for (const w of f.where) if (w.kind === "record" && w.id === e.type) api.find(f.id, { via: `record:${e.type}` }); });
  const onNode = new Map(); for (const f of by("node")) for (const w of f.where) if (w.kind === "node") onNode.set(w.id, [...(onNode.get(w.id) || []), f.id]);
  if (onNode.size) { const visit = G.memory.visit.bind(G.memory); G.memory.visit = (id) => { const r = visit(id); for (const f of onNode.get(id) || []) api.find(f, { via: `node:${id}` }); return r; }; }
  G.lore = api;
  return api;
}
