// The painter's palette as data, per place and per hour (ART-DIRECTION 7.2; the eight look slots of
// render/grade.mjs: midnight 0, predawn 4, dawn 6, morning 9, noon 12, golden 17, dusk 19, night 21).
// A palette says how a stroke's value plane is coloured: the two shadow glazes (by which side of the
// form faces the camera's right), the light glaze, the skin halftone and skin light, the value-plane
// edges, the haze the plate's distance carries, and how strong each glaze is. Linear RGB.
//   paletteAt(place, hour) -> palette     SLOTS
export const SLOTS = [0, 4, 6, 9, 12, 17, 19, 21];

// Night regimes, one per light that rules a place (LOOK-BIBLE section 3)
const NIGHT = {
  sodium: { shadowA: [0.34, 0.16, 0.62], shadowB: [0.20, 0.20, 0.66], light: [1.0, 0.56, 0.18], skinMid: [0.42, 0.42, 0.20], skinLight: [0.95, 0.55, 0.42], haze: [0.10, 0.07, 0.16], hazeK: 0.010, shadowK: 0.65, lightK: 0.30, skinK: 0.30, planes: [0.012, 0.035, 0.09, 0.22, 0.48] },
  paraffin: { shadowA: [0.34, 0.14, 0.30], shadowB: [0.12, 0.26, 0.24], light: [1.0, 0.70, 0.36], skinMid: [0.46, 0.44, 0.22], skinLight: [0.98, 0.58, 0.44], haze: [0.14, 0.08, 0.06], hazeK: 0.006, shadowK: 0.45, lightK: 0.22, skinK: 0.32, planes: [0.015, 0.04, 0.10, 0.25, 0.52] },
  moon: { shadowA: [0.22, 0.18, 0.55], shadowB: [0.08, 0.30, 0.42], light: [0.70, 0.78, 1.0], skinMid: [0.36, 0.40, 0.26], skinLight: [0.80, 0.62, 0.62], haze: [0.06, 0.07, 0.14], hazeK: 0.014, shadowK: 0.6, lightK: 0.20, skinK: 0.26, planes: [0.010, 0.03, 0.08, 0.20, 0.45] },
  gut: { shadowA: [0.40, 0.10, 0.60], shadowB: [0.06, 0.44, 0.50], light: [0.70, 0.40, 1.0], skinMid: [0.30, 0.42, 0.34], skinLight: [0.90, 0.50, 0.70], haze: [0.10, 0.04, 0.16], hazeK: 0.012, shadowK: 0.65, lightK: 0.35, skinK: 0.25, planes: [0.012, 0.035, 0.09, 0.22, 0.48] },
  candle: { shadowA: [0.24, 0.16, 0.56], shadowB: [0.10, 0.30, 0.44], light: [1.0, 0.74, 0.30], skinMid: [0.44, 0.42, 0.22], skinLight: [0.98, 0.60, 0.44], haze: [0.08, 0.06, 0.14], hazeK: 0.010, shadowK: 0.55, lightK: 0.28, skinK: 0.30, planes: [0.012, 0.035, 0.09, 0.22, 0.48] },
  arc: { shadowA: [0.30, 0.34, 0.20], shadowB: [0.10, 0.32, 0.22], light: [0.80, 1.0, 0.86], skinMid: [0.40, 0.44, 0.26], skinLight: [0.90, 0.66, 0.56], haze: [0.06, 0.10, 0.08], hazeK: 0.010, shadowK: 0.5, lightK: 0.25, skinK: 0.25, planes: [0.012, 0.035, 0.09, 0.22, 0.48] },
};
// Day regimes, shared by every place: the town's true colours come back (LOOK-BIBLE: daylight and dawn)
const DAY = {
  dawn: { shadowA: [0.42, 0.30, 0.60], shadowB: [0.20, 0.36, 0.46], light: [1.0, 0.66, 0.50], skinMid: [0.48, 0.46, 0.28], skinLight: [1.0, 0.64, 0.52], haze: [0.36, 0.30, 0.36], hazeK: 0.008, shadowK: 0.40, lightK: 0.25, skinK: 0.28, planes: [0.03, 0.08, 0.18, 0.36, 0.62] },
  day: { shadowA: [0.36, 0.34, 0.56], shadowB: [0.22, 0.40, 0.44], light: [1.0, 0.92, 0.78], skinMid: [0.50, 0.48, 0.30], skinLight: [1.0, 0.70, 0.58], haze: [0.52, 0.48, 0.42], hazeK: 0.005, shadowK: 0.30, lightK: 0.12, skinK: 0.26, planes: [0.04, 0.10, 0.22, 0.42, 0.70] },
  golden: { shadowA: [0.40, 0.26, 0.56], shadowB: [0.16, 0.34, 0.40], light: [1.0, 0.72, 0.36], skinMid: [0.48, 0.44, 0.24], skinLight: [1.0, 0.62, 0.44], haze: [0.50, 0.36, 0.24], hazeK: 0.007, shadowK: 0.40, lightK: 0.30, skinK: 0.30, planes: [0.03, 0.08, 0.19, 0.38, 0.64] },
  dusk: { shadowA: [0.36, 0.18, 0.58], shadowB: [0.12, 0.30, 0.44], light: [1.0, 0.50, 0.30], skinMid: [0.44, 0.40, 0.24], skinLight: [1.0, 0.56, 0.46], haze: [0.30, 0.16, 0.24], hazeK: 0.009, shadowK: 0.50, lightK: 0.32, skinK: 0.30, planes: [0.02, 0.05, 0.12, 0.28, 0.54] },
};
// Which regime rules a place at night (plates by name; others take sodium, the town's light)
const PLACE = { quay: "sodium", floor: "moon", mole: "sodium", stairs: "sodium", wide_arrival: "sodium", wide_blackout: "moon", wide_dawn: "sodium", brine: "paraffin", room: "paraffin", weigh: "paraffin", office: "paraffin", harbour: "paraffin", station: "candle", hill: "candle", gasholder: "sodium", ropewalk: "sodium", spit: "moon", gut: "gut", lamp: "arc" };
export const INDOOR = new Set(["brine", "room", "weigh", "office", "harbour", "station", "lamp"]);

const lerp = (a, b, t) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : a + (b - a) * t);
function blend(p, q, t) { const o = {}; for (const k of Object.keys(p)) o[k] = lerp(p[k], q[k], t); return o; }

// the palette at each slot for a place: indoors keep their lamp all day with a little daylight
function slotsFor(place) {
  const name = String(place || "").replace(/_day$/, ""), night = NIGHT[PLACE[name] || "sodium"];
  if (INDOOR.has(name)) { const d = blend(night, DAY.day, 0.35); return [night, night, blend(night, DAY.dawn, 0.3), d, d, blend(night, DAY.golden, 0.3), night, night]; }
  return [night, blend(night, DAY.dawn, 0.25), DAY.dawn, DAY.day, DAY.day, DAY.golden, DAY.dusk, blend(night, DAY.dusk, 0.2)];
}
const cache = new Map();
// a smooth key blend round the 24-hour circle (smoothstep between neighbouring slots)
export function paletteAt(place, hour) {
  const m = Math.round(((((+hour || 0) % 24) + 24) % 24) * 60) % 1440, h = m / 60, key = `${place}|${m}`;   // blended at the minute itself, so the cache is pure (the same minute, the same paint)
  if (cache.has(key)) return cache.get(key);
  const S = slotsFor(place); let i = SLOTS.length - 1; for (let k = 0; k < SLOTS.length; k++) if (SLOTS[k] <= h) i = k;
  const j = (i + 1) % SLOTS.length, h0 = SLOTS[i], h1 = j === 0 ? 24 : SLOTS[j], t0 = (h - h0 + 24) % 24 / (h1 - h0), t = t0 * t0 * (3 - 2 * t0);
  const p = blend(S[i], S[j], t); p.place = place; p.hour = h;
  if (cache.size > 4000) cache.clear(); cache.set(key, p);
  return p;
}
