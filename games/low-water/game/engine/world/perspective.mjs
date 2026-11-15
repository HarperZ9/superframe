// Perspective chapters (design/PITCHES.md, Perspectives: the same event from both sides): a short stretch inside a
// run played as somebody else, on their own character sheet, after which the run's own character comes back
// exactly as they were. Two sheets in one run: the protagonist's is put aside whole (sheet, pack, cabinet, the
// checks' memory, ink) and the chapter's is made from an archetype; at the end the chapter's is dropped and the
// protagonist's put back. What the chapter did to the world stays: flags, variables, the model, the record. What
// it did to the chapter's own person goes with them. Every record event made during the chapter carries pov: <id>.
//
//   @perspective q.pov.bet
//   name: Bet Haldane, outside the granary
//   archetype: q.bet                 the chapter's sheet
//   figure: bet                      the player figure while it lasts (ui/figures.mjs reads G.playerFigure)
//   start: q.persp.bet.door          the chapter's first node (which says perspective(q.pov.bet))
//   return: q.coda                   where the run goes on (the chapter's last node says endperspective())
//
// In content: do: perspective(<id>) on the chapter's first node, and do: endperspective() on its last. Events
// perspective.start { id }, perspective.end { id }. State: G.state.perspective { id, stash } while it lasts.
// tools/perspectivecheck.mjs checks that every run that played one came back clean.
import { registerCalls } from "../core/scope.mjs";
import { newSheet, applyArchetype } from "../rules/sheet.mjs";

export function loadPerspectives(book) {
  const out = {}, errors = [];
  for (const r of Object.values((book.records || {}).perspective || {})) {
    try {
      const one = (k) => { const x = r.kv.find((e) => e.key === k); return x ? x.value.trim() : undefined; };
      for (const e of r.kv) if (!["name", "archetype", "figure", "start", "return", "about"].includes(e.key)) throw new SyntaxError(`line ${e.line}: unknown key "${e.key}"`);
      for (const k of ["archetype", "start", "return"]) if (!one(k)) throw new SyntaxError(`needs ${k}:`);
      out[r.id] = { id: r.id, name: one("name") || r.id, archetype: one("archetype"), figure: one("figure") || null, start: one("start"), ret: one("return"), file: r.file, line: r.line };
    } catch (e) { errors.push({ file: r.file, line: r.line, msg: `perspective ${r.id}: ${e.message}` }); }
  }
  return { perspectives: out, errors };
}

// what belongs to the person, not the world: put aside whole and put back whole
export const PERSON_KEYS = ["sheet", "inv", "cabinet", "checks", "ink"];

registerCalls({
  perspective: (G, [id]) => { if (G.perspective) G.perspective.begin(id); },
  endperspective: (G) => { if (G.perspective) G.perspective.end(); },
  // pov(): the chapter being played, or "" in the run's own person
  pov: (G) => (G.state.perspective ? G.state.perspective.id : ""),
}, { perspective: "perspective" });

export function installPerspectives(G, P) {
  if (G.perspective) return G.perspective;
  const clone = (x) => (x === undefined ? undefined : structuredClone(x));
  // the chapter's figure, which G.playerFigure (game.mjs) asks first
  G.povFigure = () => { const s = G.state.perspective; return s && P[s.id] && P[s.id].figure ? P[s.id].figure : null; };
  // a record event made in a chapter says whose eyes it was made through
  G.on("community.record", (e) => { if (G.state.perspective) e.pov = G.state.perspective.id; });
  const api = {
    all: P,
    active: () => (G.state.perspective ? G.state.perspective.id : null),
    begin(id) {
      const p = P[id]; if (!p) throw new Error(`no perspective ${id}`);
      if (G.state.perspective) throw new Error(`perspective ${id}: ${G.state.perspective.id} is still being played`);
      const stash = Object.fromEntries(PERSON_KEYS.map((k) => [k, clone(G.state[k])]));
      G.state.perspective = { id, stash, at: Math.round(G.clock()) };
      // the chapter's person: a fresh sheet from its archetype, an empty pack and cabinet, no check memory
      const sheet = newSheet(G.rs), a = applyArchetype(G.rs, sheet, p.archetype); sheet.name = a.name || sheet.name;
      G.state.sheet = sheet; G.state.inv = { items: {}, equipped: {}, upgrades: {} }; G.state.cabinet = { found: [], slots: [], done: [], extra: 0 }; G.state.checks = {}; G.state.ink = false;
      for (const it of a.items) { G.inv.give(it.id, it.n, { quiet: true }); if (G.rs.items[it.id] && G.rs.items[it.id].slot) G.inv.equip(it.id); }
      G.emit("perspective.start", { id, name: p.name, figure: p.figure });
      return true;
    },
    end() {
      const s = G.state.perspective; if (!s) return false;
      for (const k of PERSON_KEYS) { if (s.stash[k] === undefined) delete G.state[k]; else G.state[k] = s.stash[k]; }
      delete G.state.perspective;
      G.emit("perspective.end", { id: s.id });
      return true;
    },
  };
  G.perspective = api;
  return api;
}
