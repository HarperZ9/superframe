// The peoples' palettes (the author, 2026-10-22: stronger people and class differences, carried by the
// painted portraits too, without caricature). A game's config names its peoples (The Quota's: the Tarn of
// the plain, the Hesh who came down from the hills, the Vell, refugees from the Vellmark, "a shade
// darker"). Each has a light and a shadow tone for skin and a hair tone. They are moved toward by a small
// fixed share, never set, so the sitter's own render leads and the people is a
// temperature, not a mask. A sitter of two peoples ("Hesh and Tarn") takes half of each.
//   peopleOf(member) -> { name, weights }   tintTones(tones, people) -> tones   peopleSwatches(people) -> swatches
//   peoples() share()
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { game } from "./game.mjs";

// the peoples and the share come from the game's config (games/<name>.mjs peoples); a game without them
// leaves every sitter as rendered
const table = () => { const { share, ...rest } = game().peoples || {}; return { share: share ?? 0, peoples: rest }; };
export const peoples = () => table().peoples;
export const share = () => table().share;
export function peopleOf(member) {
  const s = String(member?.info?.quota?.people || ""), names = Object.keys(peoples()).filter((k) => s.includes(k));
  if (!names.length) return { name: s || "unknown", weights: {} };
  return { name: names.join(" and "), weights: Object.fromEntries(names.map((k) => [k, 1 / names.length])) };
}
const blendOf = (people, key) => {
  const ws = Object.entries(people.weights); if (!ws.length) return null;
  return ws.reduce((a, [k, w]) => a.map((c, i) => c + peoples()[k][key][i] * w), [0, 0, 0]);
};
export function tintTones(tones, people) {
  const l = blendOf(people, "light"), d = blendOf(people, "shadow"); if (!l) return tones;
  return { light: kmMix(tones.light, l, share()), shadow: kmMix(tones.shadow, d, share()) };
}
export function peopleSwatches(people) {
  const l = blendOf(people, "light"); if (!l) return [];
  const sw = (name, c) => ({ name, c: c.map((v) => +v.toFixed(4)), v: +(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]).toFixed(3) });
  return [sw(`${people.name}: skin light`, l), sw(`${people.name}: skin shadow`, blendOf(people, "shadow")), sw(`${people.name}: hair`, blendOf(people, "hair"))];
}
