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
import MOVES from "./moves.json" with { type: "json" };
export const TOOL_CLASSES = MOVES.toolClasses; // the data: moves.json

// The tools of Act 1 by id (content/act1/combat.lwd), with their class; @weapon records add to
// and override these when content is loaded (encounter.mjs).
export const TOOLS = MOVES.tools; // the data: moves.json

export const profileOf = (toolId, over = {}) => {
  const t = TOOLS[toolId] || { cls: over.cls || "unarmed" };
  return { ...TOOL_CLASSES[over.cls || t.cls], ...t, ...over, id: toolId };
};

const F = (n, s) => Math.max(1, Math.round(n * s));
// T9: an opponent's parryable blow shows its tell at least 18 frames before its first active frame
// (COMBAT-SPEC section 3). The tell starts at frame 3 unless that leaves less lead; light wind-ups
// shorter than 18 frames are lengthened to 18.
export const TELL_MIN = 18;
const tellStart = (su) => Math.max(0, Math.min(3, su - TELL_MIN));

// The light string: each link a little longer, the last with the most weight. The only cancel
// is into a step or roll once the committed part (startup, active and 8 frames) is over.
// A light strike's impact: hit-stop frames and shake for a link and for the string's last blow
// (design/COMBAT-WORLD.md, "Feel": retuned after the 1080p capture; LIGHT_HS in the environment overrides
// for a measurement run only, "link,last").
const lhs = (typeof process !== "undefined" && process.env && process.env.LIGHT_HS) || "";
export const LIGHT_IMPACT = lhs ? { hitstop: lhs.split(",").map(Number), shake: [0.08, 0.2] } : { hitstop: [4, 6], shake: [0.15, 0.3] };
function lightLink(P, i, n, s, prefix, w) {
  const last = i === n, su = Math.max(w > 1 ? TELL_MIN : 0, F((14 + 2 * (i - 1) + (last && n > 1 ? 3 : 0)) * w, s)), ac = 6, rc = F(22 + (last ? 6 : 0), s);
  const commit = su + ac + 5, end = su + ac + rc - 1;
  const m = {
    startup: su, active: ac, recovery: rc, stamina: 1, dmg: P.light[0] * (last && n > 1 ? 1.4 : 1), poise: P.light[1] * (last && n > 1 ? 1.5 : 1),
    hits: [{ arc: [-P.arc - (i === 2 ? 15 : 0), P.arc], r: [0.25, P.reach + 0.4] }], root: [[2, su, 1.8 + (last ? 0.8 : 0)]],
    cancel: { step: [commit, end], roll: [commit, end] }, track: 6, hitstop: LIGHT_IMPACT.hitstop[last ? 1 : 0], knock: last ? 2.2 : 1.0, shake: LIGHT_IMPACT.shake[last ? 1 : 0], anim: `${P.cls}.light_${i}`,
  };
  if (w > 1) { m.tell = { at: [tellStart(su), su - 1], kind: "swing" }; m.track = 9; m.trackUntil = su - 3; }
  // the swing's travel sits in the end of the wind-up: 4 frames, 7 on the string's last and widest link
  m.sweep = [su - Math.min(su - 1, F(last && n > 1 ? 7 : 4, s)), su];
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
    // the dodge cancel runs to the move's end (engine PROGRESS 37: it stopped at 40 and locked the last 14 frames)
    root: [[0, 10, 3.0]], armor: [0, 12, 2], knockdown: true, guardBreak: true, cancel: { step: [24, 8 + 6 + F(32, s) - 1], roll: [24, 8 + 6 + F(32, s) - 1] }, track: 2,
    hitstop: 6, knock: sp === "pull" ? -4.2 : 4.2, shake: 0.75, anim: `${P.cls}.heavy_charged`,
  };
  if (w > 1) { heavy.tell = { at: [tellStart(su), su - 1], kind: "swing" }; heavy.track = 9; heavy.trackUntil = su - 4; }
  // the heavy's long arc travels in the last 10 frames of the wind-up (after the charge point), the
  // charged release in its 6; the 6 active frames are the contact
  heavy.sweep = [su - Math.min(su - F(14, s) - 1, F(10, s)), su]; charged.sweep = [2, 8];
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
