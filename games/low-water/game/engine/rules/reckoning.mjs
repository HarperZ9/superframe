// The reckoning: the gap between what Lamb professes and what Lamb does (game director, 2026-10-21;
// design/DIRECTOR.md, pillar 4). The author's theme: living a lie, failing to face one's own
// dissonance, and refusing growth carry real costs. This module only measures; the costs are content
// (content/act1/reckoning.lwd: modifiers, and lines gated on the flags below) and the confrontation
// scenes that quote Lamb's own words back.
//
// What counts as a gap (each adds to var.gap and sets a flag the script can quote):
//   - a drift move against an inked conviction (THEMES.md section 5). Each conviction professes a
//     direction on one axis; a move the other way while it is held is a gap, flag gap.<conviction>.
//     The Assessor Takes No Side professes no side, so any side taken while it is held is a gap.
//     Nobody Owns the Truth professes the examination, so feeding the Lantern Man (var.lantern up) is a gap.
//   - a lie that matters (a lied.* flag set), flag gap.lied.
//   - a promise broken (a broke.<id> flag set while said.<id> or promise.<id> is held), flag gap.promise, 2.
// What never counts: what the belief is. The measure holds Lamb only to what Lamb professed, so an
// honest bad belief costs nothing here and a good belief betrayed does. Relapse (theme.relapse) is
// not a lie and is not counted: recovery is an hour and then the next (THEMES.md section 9).
// Owning a gap is content (var.owned += n in a confrontation, at a cost paid there); denying it is
// var.denied += 1. The open gap is gap - owned. Nothing here shows a number to the player.
//   import { installReckoning } from "./rules/reckoning.mjs"; installReckoning(G);
//   G.reckoning.open()  G.reckoning.log()  (the log is in G.state.vars["reckoning.log"] as a string)

export const PROFESSES = {
  "conviction.fire": { lean: "lean_rise", sign: +1 },      // Some Lamps Have to Go Out: the town takes the lamps
  "conviction.wall": { lean: "lean_sea", sign: -1 },       // Gullet Looks After Gullet: the wall
  "conviction.sea": { lean: "lean_sea", sign: +1 },        // The Sea Belongs to Nobody: the open sea
  "conviction.jars": { lean: "lean_faith", sign: +1 },     // Leave the Jars Alone: reverence
  "conviction.ledger": { lean: "lean_hang", sign: -1 },    // Follow the Money: name the arithmetic
  "conviction.checked": { lean: "lantern", sign: -1 },     // Nobody Owns the Truth: starve the rumour
  "conviction.dry": { lean: "*", sign: 0 },                // The Assessor Takes No Side: no side at all
};
const AXES = ["lean_rise", "lean_faith", "lean_sea", "lean_kin", "lean_hang"];
const keyOf = (name) => { const d = name.indexOf("."); return d > 0 && name.slice(0, d) === "var" ? name.slice(d + 1) : name; };

export function gapsFor(flags, lean, delta) {
  if (!delta) return [];
  const out = [];
  for (const [cv, p] of Object.entries(PROFESSES)) {
    if (!flags.includes(cv)) continue;
    if (p.lean === "*") { if (AXES.includes(lean)) out.push(cv); continue; }
    if (p.lean === lean && Math.sign(delta) === -p.sign) out.push(cv);
  }
  return out;
}

export function installReckoning(G) {
  if (G.reckoning) return G.reckoning;
  const vars = () => G.state.vars;
  // a gap names who it fell on and where when the script says (The Quota: a record event's victim household
  // and street, world/community.mjs record()): logged as clock:why@victim/street
  let lastRecord = null;
  const add = (n, flag, why, meta = {}) => {
    const V = vars();
    V.gap = (+V.gap || 0) + n;
    const who = meta.victim || meta.street ? `@${meta.victim || ""}/${meta.street || ""}` : "";
    V["reckoning.log"] = `${V["reckoning.log"] ? `${V["reckoning.log"]}|` : ""}${Math.round(G.clock())}:${why}${who}`;
    if (flag && G.setFlag) G.setFlag(flag, true); else if (flag && !G.state.flags.includes(flag)) G.state.flags.push(flag);
    G.emit("var", { name: "gap", value: V.gap });
    G.emit("reckoning.gap", { n, flag, why, gap: V.gap, victim: meta.victim || null, street: meta.street || null });
  };
  const assign = G.scope.assign.bind(G.scope);
  G.scope.assign = (name, v) => {
    const k = keyOf(name), before = +vars()[k] || 0;
    const r = assign(name, v);
    const delta = (+vars()[k] || 0) - before;
    if (delta && (AXES.includes(k) || k === "lantern")) for (const cv of gapsFor(G.state.flags, k, delta)) add(1, `gap.${cv.slice("conviction.".length)}`, `${cv} against ${k} ${delta > 0 ? "+" : ""}${delta}`);
    return r;
  };
  G.on("flag", (e) => {
    if (!e.on) return;
    const near = lastRecord && Math.abs(lastRecord.clock - Math.round(G.clock())) <= 1 ? { victim: lastRecord.victim, street: lastRecord.street } : {}; // set in the same beat as a record event
    if (e.id.startsWith("lied.")) add(1, "gap.lied", e.id, near);
    else if (e.id.startsWith("broke.")) {
      const id = e.id.slice("broke.".length);
      if (G.state.flags.includes(`said.${id}`) || G.state.flags.includes(`promise.${id}`)) add(2, "gap.promise", e.id, near);
    }
  });
  G.reckoning = {
    open: () => (+vars().gap || 0) - (+vars().owned || 0),
    log: () => String(vars()["reckoning.log"] || "").split("|").filter(Boolean),
    // the record (04-SYSTEMS.md section 6): every record event with its victim and street, kept with the game
    record(ev) { lastRecord = ev; (G.state.record ||= []).push({ ...ev }); },
    events: () => [...(G.state.record || [])],
  };
  return G.reckoning;
}
