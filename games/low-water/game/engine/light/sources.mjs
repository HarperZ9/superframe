// The kinds of light in The Quota's five eras, each with its colour from physics (kelvin.mjs), how it
// moves (flicker.mjs profile), and what it says (design/art/LIGHT.md). A place's lights name a kind;
// the older Low Water kinds (paraffin, sodium, white, arc, beam, window, lantern) map onto these.
//   SOURCES[kind] -> { rgb, K, flicker, sss, era, note }
//   sourceOf(L)   -> the kind record for a place light { kind, group }, with legacy names resolved
import { kelvinRgb, spectrumRgb, lineRgb, warmthOf } from "./kelvin.mjs";

const S = (K, flicker, note, extra = {}) => ({ K, rgb: kelvinRgb(K), flicker, note, ...extra });
const M = (parts, flicker, note, extra = {}) => { const rgb = spectrumRgb(parts); return { K: warmthOf(rgb), rgb, flicker, note, ...extra }; };

export const SOURCES = {
  // fire and flame (eras 1 to 3 indoors; the brazier and the stove in every era)
  embers:     S(1250, "embers", "a stove's kept-in embers: barely light, a red the eye reads as warmth"),
  stove:      S(1650, "fire", "the stove's open door: the room's one heat and one light"),
  brazier:    S(1700, "fire", "the militia's brazier at the granary: their warmth, not the village's"),
  tallow:     S(1700, "tallow", "a tallow dip: smoky, guttering, the poor house's candle"),
  rush:       S(1750, "rush", "a rushlight in its nip: fast, thin, burns out in half an hour"),
  candle:     S(1850, "candle", "a wax candle: steady, the merchant's light"),
  paraffin:   S(1950, "lamp", "a paraffin lamp: steady, warm, the light of a table that can pay for oil"),
  gas:        M([{ K: 2700, w: 0.85 }, { nm: 555, w: 0.15 }], "gas", "the exchange's gas mantles: white with a green cast"),
  // the requisition and the street (era 2): carbide lamps hiss, white and hard
  carbide:    S(3100, "carbide", "the requisition brigade's carbide lamps: hard white, the colour of the count"),
  headlamp:   S(2900, "steady", "the export train's headlamp: electric, the brightest thing on the plain"),
  // electric (eras 3 to 5)
  bulb:       S(2600, "mains", "a bare reconstruction bulb on a flex"),
  fluorescent: M([{ K: 4100, w: 0.8 }, { nm: 546, w: 0.14 }, { nm: 436, w: 0.06 }], "tube", "the mill's tubes: cold, green, ticking, one always failing"),
  sodium:     M([{ K: 2050, w: 0.45 }, { nm: 589, w: 0.55 }], "sodium", "the sodium heads: one colour for everyone, skin turned to the colour of the road"),
  phone:      M([{ K: 6500, w: 0.8 }, { nm: 450, w: 0.2 }], "screen", "a phone's glow under a face: the clip, the comments"),
  police:     { K: 12000, rgb: lineRgb(465), flicker: "strobe", note: "the police blue: it lights every window on the street at once" },
  // sky
  sun:        S(5200, "steady", "the sun (its colour by air mass in clock.mjs)"),
  moon:       S(4100, "steady", "the moon (drawn cooler than it is: the eye's night shift)", { night: [0.62, 0.72, 1.0] }),
  window:     S(6500, "steady", "daylight through glass: the sky's colour, set per hour by clock.mjs"),
};
// the light kinds the old plates use
const LEGACY = { white: "bulb", arc: "fluorescent", beam: "headlamp", lantern: "paraffin", fire: "stove" };

export function sourceOf(L) {
  // a plate's fire is often written as paraffin with group fire (the bake's own spectrum); here it burns as a fire
  const fire = L && L.group === "fire" && (!L.kind || L.kind === "paraffin" || L.kind === "fire");
  const k = fire ? (L.source || "stove") : L && L.source && SOURCES[L.source] ? L.source : L && (SOURCES[L.kind] ? L.kind : LEGACY[L.kind] || "paraffin");
  return { kind: k, ...SOURCES[k] };
}
// fires, which melt frost round them and take fuel from the street's stock
export const FIRE = new Set(["embers", "stove", "brazier", "tallow", "rush", "candle"]);
export const isFire = (kind) => FIRE.has(kind);
