// The light of each era (design/art/LIGHT.md): the season the era is played in, the air, what burns in
// the street and at the table, and what the night sky carries. The same district over 120 years; the
// light is how the player knows the year before anyone speaks.
//   ERAS[n]               -> { name, doy, haze, snow, overcast, street, table, rich, poor, authority, skyglow, note }
//   eraOf(n)              -> ERAS[n] (era 2 when n is missing)
//   skyOptions(era, opt)  -> the options for clock.skyAt (doy, haze, snow, skyglow)
import { SOURCES } from "./sources.mjs";

export const ERAS = {
  1: { name: "The Exchange", doy: 240, haze: 1.5, snow: 0, overcast: 0,
    street: "gas", table: "paraffin", rich: "candle", poor: "tallow", authority: "gas",
    note: "Harvest. A warm afternoon on the exchange, chaff in the air; gas mantles at dusk; the merchants' candles, the Hesh hands' tallow in the barns." },
  2: { name: "The Quota", doy: 58, haze: 0.7, snow: 0.8, overcast: 0.15,
    street: null, table: "tallow", rich: "paraffin", poor: "rush", authority: "carbide",
    note: "The famine winter. A low frost sun and a short day; no street lamp lit; tallow and rush at the poor table, embers kept in; paraffin only where the Directorate pays; the requisition's carbide; the export train's headlamp." },
  3: { name: "Allocation", doy: 290, haze: 1.3, snow: 0, overcast: 0.4,
    street: "bulb", table: "bulb", rich: "bulb", poor: "candle", authority: "bulb",
    note: "Reconstruction. Bare bulbs on flexes, ten families to a house, the mains failing in the evening; coal smoke." },
  4: { name: "The Closure", doy: 315, haze: 1.1, snow: 0, overcast: 0.6,
    street: "sodium", table: "bulb", rich: "bulb", poor: "bulb", authority: "fluorescent",
    note: "November. The mill's tubes, cold and ticking, one failing; the first sodium on the main road; dark by five." },
  5: { name: "The Clearance", doy: 75, haze: 1.0, snow: 0, overcast: 0.3,
    street: "sodium", table: "bulb", rich: "bulb", poor: "phone", authority: "police",
    skyglow: { source: "sodium", k: 0.05 },
    note: "Sodium streets, one colour for everyone; phones under faces; the police blue that lights every window at once. The night is never black." },
};
export const eraOf = (n) => ERAS[n] || ERAS[2];
export function skyOptions(era, opt = {}) {
  const E = eraOf(era), sg = E.skyglow ? { rgb: SOURCES[E.skyglow.source].rgb, k: E.skyglow.k } : null;
  return { doy: opt.doy ?? E.doy, haze: opt.haze ?? E.haze, snow: opt.snow ?? E.snow, overcast: opt.overcast ?? E.overcast, skyglow: sg, north: opt.north ?? 0, lat: opt.lat };
}
// who sits in which light at a table, by what the household can burn (portion and food, 0 to 1): the
// table's own source and its strength. A full table under the era's table light; a poorer one under the
// poor light; one with nothing to burn sits by the embers or in the window's light alone.
export function tableLight(era, { portion = 1, food = 1 } = {}) {
  const E = eraOf(era), w = Math.min(portion, food * 1.6);
  if (w >= 0.75) return { source: E.table, k: 1 };
  if (w >= 0.4) return { source: E.poor, k: 0.75 };
  if (w >= 0.15) return { source: "embers", k: 0.6 };
  return { source: null, k: 0 };
}
