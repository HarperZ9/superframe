// Reputation per faction, clamped to @rules rep-min and rep-max, with tier labels from content.
//   state.rep = { faction: value }
import { tierOf } from "./ruleset.mjs";

export function createFactions(G) {
  const rs = G.rs, R = () => (G.state.rep ||= {});
  const api = {
    get: (id) => (R()[id] ?? (rs.factions[id] ? rs.factions[id].start : 0)),
    add(id, n) {
      if (!rs.factions[id]) throw new Error(`no faction ${id}`);
      const before = api.get(id), after = Math.max(rs.rules["rep-min"], Math.min(rs.rules["rep-max"], before + n));
      R()[id] = after;
      const t0 = tierOf(rs.factions[id], before), t1 = tierOf(rs.factions[id], after);
      G.emit("rep", { id, before, after, tier: t1, tierChanged: t0 !== t1 });
    },
    set(id, v) { api.add(id, v - api.get(id)); },
    tier: (id) => (rs.factions[id] ? tierOf(rs.factions[id], api.get(id)) : ""),
    list: () => Object.values(rs.factions).map((f) => ({ ...f, value: api.get(f.id), tier: api.tier(f.id) })),
  };
  return api;
}
