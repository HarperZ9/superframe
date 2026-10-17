// Tools: the harbour's weapons (SYSTEMS-FULL 18.4). A tool belongs to a class; the class profile
// generates the strikes (light chain, heavy, charged heavy) so every tool in a class moves alike,
// and a tool record can override any profile number.
//
// Units follow the director's scale (18.2, 18.3): damage in Standing, costs in Breath, poise
// damage in hits-before-stagger. Frames at 60 a second. TUNING.md gives each number's source.
//
// Profile fields: weight (load and the GRIP rule), reach (metres), arc (degrees either side),
// speed (frame multiplier: above 1 is slower), chain (light strikes in the string), light and
// heavy damage and poise, catch (the parry window frames), chip (share of damage that gets
// through a block), blockCost (Breath per blocked blow, light then heavy), special (the heavy's
// character: pull, sweep, break, slash, bash).
export const TOOL_CLASSES = {
  shield: { weight: 3, reach: 1.3, arc: 60, speed: 1.25, chain: 2, light: [1, 1], heavy: [2, 2], catch: [5, 15], chip: 0, blockCost: [1, 1], special: "bash" },
  light: { weight: 1, reach: 1.5, arc: 55, speed: 0.8, chain: 3, light: [0.7, 0.6], heavy: [1.5, 1.2], catch: [6, 12], chip: 0.5, blockCost: [1, 2], special: "none" },
  long: { weight: 4, reach: 2.6, arc: 22, speed: 1.15, chain: 2, light: [1, 1], heavy: [2, 2], catch: [6, 13], chip: 0.25, blockCost: [1, 2], special: "pull" },
  short: { weight: 1, reach: 1.1, arc: 50, speed: 0.7, chain: 3, light: [0.8, 0.5], heavy: [1.6, 1], catch: [6, 12], chip: 0.75, blockCost: [1, 2], special: "slash" },
  heavy: { weight: 6, reach: 1.5, arc: 45, speed: 1.6, chain: 1, light: [2, 2], heavy: [3, 3], catch: [7, 12], chip: 0.25, blockCost: [1, 2], special: "break" },
  bar: { weight: 3, reach: 1.5, arc: 40, speed: 1.0, chain: 2, light: [1.2, 1], heavy: [2, 2], catch: [6, 12], chip: 0.4, blockCost: [1, 2], special: "break" },
  unarmed: { weight: 0, reach: 1.0, arc: 50, speed: 0.85, chain: 3, light: [0.5, 0.5], heavy: [1, 1], catch: [6, 12], chip: 1, blockCost: [1, 2], special: "none" },
};

// The tools of Act 1 by id (content/act1/combat.lwd), with their class; @weapon records add to
// and override these when content is loaded (encounter.mjs).
export const TOOLS = {
  "w.case": { name: "The claims case", cls: "shield" },
  "w.stick": { name: "The Vane's folding stick", cls: "light" },
  "w.boathook": { name: "A boathook", cls: "long", special: "pull" },
  "w.pole": { name: "A Lamplighter's brass pole", cls: "long", special: "sweep", arc: 30 },
  "w.knife": { name: "A gutting knife", cls: "short" },
  "w.hammer": { name: "The weigh-house lump hammer", cls: "heavy" },
  "w.crowbar": { name: "A crowbar", cls: "bar" },
  "w.hands": { name: "Bare hands", cls: "unarmed" },
};

export const profileOf = (toolId, over = {}) => {
  const t = TOOLS[toolId] || { cls: over.cls || "unarmed" };
  return { ...TOOL_CLASSES[over.cls || t.cls], ...t, ...over, id: toolId };
};

const F = (n, s) => Math.max(1, Math.round(n * s));

// The light string: each link a little longer, the last with the most weight. The only cancel
// is into a step or roll once the committed part (startup, active and 8 frames) is over.
function lightLink(P, i, n, s, prefix, w) {
  const last = i === n, su = F((14 + 2 * (i - 1) + (last && n > 1 ? 3 : 0)) * w, s), ac = 6, rc = F(22 + (last ? 6 : 0), s);
  const commit = su + ac + 5, end = su + ac + rc - 1;
  const m = {
    startup: su, active: ac, recovery: rc, stamina: 1, dmg: P.light[0] * (last && n > 1 ? 1.4 : 1), poise: P.light[1] * (last && n > 1 ? 1.5 : 1),
    hits: [{ arc: [-P.arc - (i === 2 ? 15 : 0), P.arc], r: [0.25, P.reach + 0.4] }], root: [[2, su, 1.8 + (last ? 0.8 : 0)]],
    cancel: { step: [commit, end], roll: [commit, end] }, track: 6, hitstop: last ? 3 : 2, knock: last ? 2.2 : 1.0, shake: last ? 0.2 : 0.08, anim: `${P.cls}.light_${i}`,
  };
  if (w > 1) { m.tell = { at: [3, su - 1], kind: "swing" }; m.track = 9; m.trackUntil = su - 3; }
  if (!last) { m.next = { light: `${prefix}light_${i + 1}` }; m.cancel.light = [su + ac + 3, end]; }
  return m;
}

function heavyMoves(P, s, prefix, w) {
  const sp = P.special, su = F(26 * w, s), rc = F(34, s);
  const wide = sp === "sweep" ? 75 : P.arc + 10;
  const heavy = {
    startup: su, active: 6, recovery: rc, stamina: 2, dmg: P.heavy[0], poise: P.heavy[1], hits: [{ arc: [-wide, wide], r: [0.25, P.reach + 0.6] }],
    root: [[F(16, s), su + 3, 2.0]], armor: [6, su + 4, 1], charge: { at: F(14, s), max: 48, min: 15, into: `${prefix}heavy_charged` },
    cancel: { step: [su + 6 + 6, su + 6 + rc - 1], roll: [su + 6 + 6, su + 6 + rc - 1] }, track: 4, guardBreak: true,
    hitstop: 4, knock: sp === "pull" ? -3.4 : 3.0, shake: 0.4, knockdown: sp === "pull" || sp === "sweep", anim: `${P.cls}.heavy`,
  };
  const charged = {
    startup: 8, active: 6, recovery: F(32, s), stamina: 1, dmg: P.heavy[0] * 1.5, poise: P.heavy[1] + 1.5, hits: [{ arc: [-wide - 10, wide + 10], r: [0.25, P.reach + 0.8] }],
    root: [[0, 10, 3.0]], armor: [0, 12, 2], knockdown: true, guardBreak: true, cancel: { step: [24, 40], roll: [24, 40] }, track: 2,
    hitstop: 6, knock: sp === "pull" ? -4.2 : 4.2, shake: 0.75, anim: `${P.cls}.heavy_charged`,
  };
  if (w > 1) { heavy.tell = { at: [3, su - 1], kind: "swing" }; heavy.track = 9; heavy.trackUntil = su - 4; }
  return { heavy, heavy_charged: charged };
}

// All strikes of one tool for one fighter. prefix keeps fighters' tables apart ("lamb:").
// slow: the tool is heavier than the wielder's GRIP allows (18.2): slower and double Breath.
// windup: opponents' wind-ups run longer, track harder and carry a tell (COMBAT-FEEL v2 6).
export function buildToolMoves(P, { prefix = "", slow = false, windup = 1 } = {}) {
  const s = P.speed * (slow ? 1.3 : 1), out = {};
  for (let i = 1; i <= P.chain; i++) out[`${prefix}light_${i}`] = lightLink(P, i, P.chain, s, prefix, windup);
  const h = heavyMoves(P, s, prefix, windup);
  out[`${prefix}heavy`] = h.heavy; out[`${prefix}heavy_charged`] = h.heavy_charged;
  out[`${prefix}catch`] = { kind: "parry", startup: P.catch[0], active: P.catch[1] - P.catch[0] + 1, recovery: 20, stamina: 1, parry: P.catch, anim: `${P.cls}.catch` };
  if (slow) for (const m of Object.values(out)) m.stamina *= 2;
  return out;
}
