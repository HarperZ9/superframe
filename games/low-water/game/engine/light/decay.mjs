// Decay in light: as a street's stock falls, its lamps go out one by one, its windows darken, its fires
// get smaller (design/art/LIGHT.md section 5). Read from the community model (world/community.mjs: the
// `stock(name, subject)` call), never shown as a number: the street shows it.
//   lightIndex(read, street)        -> 0..1, what a street can still burn
//   decayLights(lights, read, opt)  -> per light { on, gain, reachK, dying } in the lights' order
// read(name, subject) is G.community.stock; a street with its own `light` stock uses that directly.
// A light says which street it belongs to with `street` (a place light's field); otherwise opt.street.
import { sourceOf, isFire } from "./sources.mjs";

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const num = (v, d) => (Number.isFinite(+v) && v !== undefined && v !== null ? +v : d);
const hash01 = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

export function lightIndex(read, street) {
  if (!read || !street) return 1;
  const own = read("light", street); if (own !== undefined) return clamp(num(own, 1));
  const food = num(read("food", street), 0.6), work = num(read("work", street), 0.6), hunger = num(read("hunger", street), 0.2), theft = num(read("theft", street), 0.1);
  // a street at its slice level (food 0.45, work 0.5, hunger 0.25) reads about 0.57: lit, but thinly
  return clamp(0.45 * food + 0.25 * work + 0.15 * (1 - hunger) + 0.15 * (1 - theft));
}
// the role of a light in decay: a street lamp, a window, a fire, or one that does not decay (the sun, the
// train, the requisition, the militia's brazier: the state's own light never goes out for want of bread)
export function roleOf(L) {
  const src = sourceOf(L);
  if (L.decay === false || ["carbide", "headlamp", "police", "sun", "moon", "brazier"].includes(src.kind)) return "state";
  if (src.kind === "window") return "sky";   // daylight through a pane: the sky's, not the street's
  if (L.group === "window") return "window";
  if (isFire(src.kind) || L.group === "fire") return "fire";
  return "lamp";
}
// each lamp and window has its own threshold (a hash of its place in the world), so they go out one at a
// time in a fixed order as the index falls, and come back in the reverse order
function threshold(L, i) { return 0.15 + 0.6 * hash01(`${L.at ? L.at.map((v) => v.toFixed(1)).join(",") : i}|${L.group || ""}`); }

export function decayLights(lights, read, { street = null, households = {} } = {}) {
  const idx = new Map();
  const indexOf = (s) => { if (!idx.has(s)) idx.set(s, lightIndex(read, s)); return idx.get(s); };
  return lights.map((L, i) => {
    const role = roleOf(L), s = L.street || street;
    if (role === "state" || role === "sky" || !read || !s) return { on: true, gain: 1, reachK: 1, dying: false, role };
    if (role === "fire") {
      // a fire is fed by its household when it has one (the table's fuel), else by its street
      const h = L.household || households[s], fuel = h ? clamp(num(read("portion", h), 1) * 0.5 + num(read("food", h), indexOf(s)) * 0.5) : indexOf(s);
      const k = clamp(fuel * 1.4);
      return { on: k > 0.04, gain: 0.25 + 0.75 * Math.sqrt(k), reachK: 0.55 + 0.45 * Math.sqrt(k), dying: k < 0.25, role };
    }
    const x = indexOf(s), th = threshold(L, i), on = x >= th;
    return { on, gain: on ? 1 : 0, reachK: 1, dying: on && x < th + 0.06, role };
  });
}
