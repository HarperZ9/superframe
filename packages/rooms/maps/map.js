// SPDX-License-Identifier: FSL-1.1-MIT
// A map between two domains, as a typed object that can fail. An analogy states a likeness; a map states which
// quantities correspond, with units, what stays preserved, over what range, what a round trip loses, one prediction it
// can get wrong, and the condition that would show it wrong. Status comes from a rule on that test.

const BASES = "MLTIK$Nb"; // mass length time current temperature money count bit

/** "M L2 T-2" to exponents. Fractions as decimals are enough for the groups used here. */
export function parseUnit(s = "") {
  const out = {};
  for (const tok of String(s).trim().split(/\s+/).filter(Boolean)) {
    const b = tok[0];
    if (!BASES.includes(b)) throw new Error(`unknown base ${b} in "${s}"`);
    out[b] = (out[b] || 0) + (tok.length > 1 ? Number(tok.slice(1)) : 1);
  }
  for (const k of Object.keys(out)) if (Math.abs(out[k]) < 1e-12) delete out[k];
  return out;
}

export function groupResidual(expr, table) {
  const out = {};
  for (const [sym, p] of Object.entries(expr)) {
    if (!(sym in table)) throw new Error(`no unit for ${sym}`);
    for (const [b, e] of Object.entries(parseUnit(table[sym]))) out[b] = (out[b] || 0) + e * p;
  }
  for (const k of Object.keys(out)) if (Math.abs(out[k]) < 1e-12) delete out[k];
  return out;
}

/** Every group claimed dimensionless, checked by exponent. Returns the list of faults. */
export function unitFaults(map) {
  const ta = Object.fromEntries(map.quantities.map((q) => [q.a, q.a_unit]));
  const tb = Object.fromEntries(map.quantities.map((q) => [q.b, q.b_unit]));
  const bad = [];
  for (const g of map.groups) {
    if (g.expr_a && Object.keys(groupResidual(g.expr_a, ta)).length) bad.push(`${g.name}: side a carries units`);
    if (g.expr_b && Object.keys(groupResidual(g.expr_b, tb)).length) bad.push(`${g.name}: side b carries units`);
  }
  return bad;
}

export const STATUS = ["homology", "broken", "analogy"];

/** The rule. A pass never sets shared mechanism, which stays its own field. */
export function statusFrom({ held_out_pass, passed_region, break_point }) {
  if (held_out_pass === null || held_out_pass === undefined) return "analogy";
  if (break_point && passed_region) return "broken";
  if (held_out_pass && !break_point) return "homology";
  return "analogy";
}

/** The author's nine words. Each is true, false or null (not run). There is no total, so none can become a target. */
export const WORDS = ["cross_applicable", "renderable", "interpretable", "perceptible", "applicable", "testable", "measurable", "fallible", "disprovable"];

const REQUIRED = ["id", "domains", "family", "quantities", "groups", "preserved", "invariants", "claimed_range", "failure_condition", "held_out", "status", "shared_mechanism", "words", "bits_lost"];

/** Faults in a map record. An empty list means the object states everything a map must state. */
export function mapFaults(m) {
  const bad = REQUIRED.filter((k) => !(k in m)).map((k) => `missing ${k}`);
  if (bad.length) return bad;
  if (!STATUS.includes(m.status)) bad.push(`status ${m.status}`);
  if (m.status === "broken" && !m.break_point) bad.push("broken needs the point where it breaks");
  if (m.status === "homology" && !(m.value <= m.threshold || m.higher_is_better)) bad.push("homology needs a held-out pass");
  for (const w of WORDS) if (!(w in m.words)) bad.push(`word ${w} missing`);
  if ("score" in m || "total" in m.words) bad.push("a map carries no total");
  return bad.concat(unitFaults(m));
}
