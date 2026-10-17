// The character sheet: attributes, skill ranks, resources, XP and levels. Values a check reads
// are the base plus every active modifier (items worn, traits, the environment), each listed
// with its source so the interface can show why a number is what it is.
import { evaluate } from "../core/expr.mjs";

export function newSheet(rs) {
  const attrs = Object.fromEntries(Object.keys(rs.attrs).map((k) => [k, rs.rules["attr-min"]]));
  return { attrs, ranks: {}, xp: 0, level: 1, points: 0, res: {}, name: "", archetype: null };
}

// G: { rs, state: { sheet }, scope, modSources(): [mod...] }
export function createSheetApi(G) {
  const rs = G.rs, S = () => G.state.sheet;
  const active = (target) => G.modSources().filter((m) => m.target === target && (!m.cond || evaluate(m.cond, G.scope)));
  const api = {
    mods: (target) => active(target).map((m) => ({ amount: m.amount, why: m.label || m.source })),
    attrBase: (id) => S().attrs[id] ?? 0,
    attr: (id) => api.attrBase(id) + sum(active(`attr.${id}`)),
    skillBase(id) {
      const sk = rs.skills[id]; if (!sk) return 0;
      if (sk.base) return +evaluate(sk.base, G.scope) || 0;
      return sk.attr ? api.attr(sk.attr) : 0;
    },
    ranks: (id) => S().ranks[id] || 0,
    // The effective level: base, ranks, every item and trait modifier, and the environment's
    // @modifier records (the same sum a check shows).
    skill: (id) => G.checks.breakdown(id).total,
    cap: (id) => { const sk = rs.skills[id]; return (sk && sk.attr ? api.attrBase(sk.attr) : 0) + rs.rules["skill-cap"]; },
    // Pages (points) buy ranks up to the cap. Skills with train: no never take ranks (R2).
    canRaise: (id) => S().points > 0 && !!rs.skills[id] && rs.skills[id].train !== false && api.skillBase(id) + api.ranks(id) < api.cap(id),
    raise(id) { if (!api.canRaise(id)) return false; S().ranks[id] = api.ranks(id) + 1; S().points--; G.emit("skill.raised", { id, value: api.skill(id) }); return true; },
    xpForLevel: (level) => (level - 1) * rs.rules["xp-per-level"],
    addXp(n) {
      const s = S(); s.xp += n; G.emit("xp", { amount: n, total: s.xp });
      while (s.xp >= api.xpForLevel(s.level + 1)) { s.level++; s.points += rs.rules["points-per-level"]; G.emit("level", { level: s.level, points: s.points }); }
    },
    resMax: (id) => { const r = rs.resources[id]; return r ? (+evaluate(r.max, G.scope) || 0) + sum(active(`res.${id}.max`)) : 0; },
    res: (id) => { const s = S(); if (s.res[id] == null) s.res[id] = api.resStart(id); return s.res[id]; },
    resStart: (id) => { const r = rs.resources[id]; return r && r.start ? +evaluate(r.start, G.scope) || 0 : api.resMax(id); },
    setRes(id, v) {
      if (!rs.resources[id]) return;
      const s = S(), before = api.res(id), after = Math.max(0, Math.min(api.resMax(id), v)); s.res[id] = after;
      if (after !== before) G.emit("res", { id, before, after });
      if (after <= 0 && before > 0 && rs.resources[id].onZero) G.emit("res.zero", { id, node: rs.resources[id].onZero });
    },
  };
  return api;
}
const sum = (ms) => ms.reduce((a, m) => a + m.amount, 0);

// Character creation: an archetype as a starting point, then points spent between attr-min and
// attr-max. Returns errors (empty when the build is valid).
export function validateBuild(rs, attrs) {
  const R = rs.rules, errs = [], spent = Object.values(attrs).reduce((a, v) => a + v, 0);
  for (const k of Object.keys(rs.attrs)) { const v = attrs[k] ?? 0; if (v < R["attr-min"] || v > R["attr-max"]) errs.push(`${rs.attrs[k].name} must be between ${R["attr-min"]} and ${R["attr-max"]}`); }
  if (spent !== R["creation-points"]) errs.push(`spend exactly ${R["creation-points"]} points (now ${spent})`);
  return errs;
}
export function applyArchetype(rs, sheet, id) {
  const a = rs.archetypes[id]; if (!a) throw new Error(`no archetype ${id}`);
  for (const k of Object.keys(rs.attrs)) sheet.attrs[k] = a.attrs[k] ?? rs.rules["attr-min"];
  sheet.ranks = { ...a.skills }; sheet.archetype = id;
  return a;
}
