// Character creation: an archetype (a Precedent) or a custom spread of attribute points, a
// trusted instrument, and ink mode.
//   G.create({ archetype: "a.ledger" })                       the archetype as written
//   G.create({ attrs: { pen: 3, ... }, archetype: "a.wader" }) a custom spread; the archetype
//                                                             gives only its items and traits
//   options: name, trusted (a skill id that starts one higher), ink (one save, final), enter
// Items with a slot are worn at once; the archetype's traits start done (R6).
// Returns a list of problems; an empty list means the character was made.
import { validateBuild, applyArchetype, newSheet } from "./sheet.mjs";

export function createCharacter(G, { archetype = null, attrs = null, name = "", trusted = null, ink = false, enter = true } = {}) {
  const rs = G.rs, errs = [];
  if (archetype && !rs.archetypes[archetype]) errs.push(`no archetype ${archetype}`);
  if (attrs) errs.push(...validateBuild(rs, attrs));
  if (!archetype && !attrs) errs.push("choose an archetype or spend the points");
  if (trusted && !rs.skills[trusted]) errs.push(`no skill ${trusted}`);
  if (errs.length) return errs;
  const sheet = (G.state.sheet = newSheet(rs));
  let a = null;
  if (archetype) a = applyArchetype(rs, sheet, archetype);
  if (attrs) { for (const k of Object.keys(rs.attrs)) sheet.attrs[k] = attrs[k]; if (a) sheet.ranks = {}; }
  sheet.name = name; sheet.trusted = trusted || null;
  G.state.ink = !!ink;
  if (a) {
    for (const it of a.items) { G.inv.give(it.id, it.n); if (rs.items[it.id] && rs.items[it.id].slot) G.inv.equip(it.id); }
    for (const t of a.traits) G.cabinet.grant(t);
  }
  const area = rs.rules["start-area"];
  if (enter && area && G.content.map.areas[area]) G.world.enter(area);
  G.emit("created", { archetype, name });
  return [];
}

// A trusted instrument: one rank of bonus, listed as its own part of the sum.
export const trustedMods = (G) => (G.state.sheet && G.state.sheet.trusted ? [{ target: `skill.${G.state.sheet.trusted}`, amount: 1, label: "trusted", source: "creation" }] : []);
