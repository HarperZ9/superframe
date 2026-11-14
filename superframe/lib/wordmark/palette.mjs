// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// palette.mjs: colour for the wordmark directions. The mark uses the open spectrum; the product's three verdict
// colours (verified, drift, unverifiable, in their light and dark forms from provenance-badges src/ext/canon.css)
// stay reserved for verdicts. So every hue the marks draw comes through openHue, which skips a window around each
// verdict hue, and verdictClearance measures how far a colour sits from the nearest verdict colour (CIEDE2000).
// OKLCH (Ottosson 2020) is the working space: equal steps of lightness look equal across hues.
import { dE00, linToLab } from '../quantize/ciede.mjs';
import { lin, enc, parseHex, hex } from '../study/cmath.mjs';

export const VERDICT = Object.freeze({
  verified: ['#0a6b61', '#63d4ce'], drift: ['#8f3a19', '#e29472'], unverifiable: ['#4e4d85', '#b3b1e6'],
});
export const hexLin = h => parseHex(h).map(v => lin(v / 255));
export const linHex = c => hex(c.map(v => Math.round(255 * enc(Math.min(1, Math.max(0, v))))));

// OKLab -> linear sRGB (unclipped).
export function oklabLin(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
// linear sRGB -> OKLab.
export function linOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export const hueOf = rgbLin => { const [, a, b] = linOklab(rgbLin); return ((Math.atan2(b, a) * 180 / Math.PI) + 360) % 360; };

// OKLCH (h in degrees) -> linear sRGB, chroma reduced until the colour is inside sRGB (keeps L and h).
export function oklch(L, C, h) {
  const r = h * Math.PI / 180;
  for (let c = C; c >= 0; c -= 0.004) {
    const v = oklabLin(L, c * Math.cos(r), c * Math.sin(r));
    if (v.every(x => x >= -1e-6 && x <= 1 + 1e-6)) return v.map(x => Math.min(1, Math.max(0, x)));
  }
  return oklabLin(L, 0, 0).map(x => Math.min(1, Math.max(0, x)));
}

// The verdict hues (OKLCH degrees, from the light forms) and the half-width of the window kept clear around each.
export const VERDICT_HUES = Object.values(VERDICT).map(([light]) => hueOf(hexLin(light)));
export const HUE_WINDOW = 16;

// u in [0, 1) -> a hue in degrees, spread evenly over the circle minus the three verdict windows.
const OPEN_ARCS = (() => {
  const c = [...VERDICT_HUES].sort((a, b) => a - b), arcs = [];
  for (let k = 0; k < c.length; k++) { const a = c[k] + HUE_WINDOW, b = (k + 1 < c.length ? c[k + 1] : c[0] + 360) - HUE_WINDOW; if (b > a) arcs.push([a, b]); }
  return arcs;
})();
export function openHue(u) {
  const total = OPEN_ARCS.reduce((s, [a, b]) => s + b - a, 0);
  let d = (((u % 1) + 1) % 1) * total;
  for (const [a, b] of OPEN_ARCS) { if (d < b - a) return (a + d) % 360; d -= b - a; }
  return OPEN_ARCS[0][0];
}

const VERDICT_LABS = Object.values(VERDICT).flat().map(hx => linToLab(hexLin(hx)));
// Smallest CIEDE2000 distance from a linear sRGB colour to any verdict colour.
export const verdictClearance = rgbLin => Math.min(...VERDICT_LABS.map(v => dE00(linToLab(rgbLin), v)));
