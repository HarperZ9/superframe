// measure.mjs: the value-budget measures, read from the 8-bit output and graded against the renderer's labels.
//   whiteCheck: of pixels above 0.95 display luminance (CIE Y of the decoded 8-bit sRGB), the share whose radiance
//               is at least half specular-origin. n = 0 is reported as no pass, never a vacuous one.
//   valueBudget: the frame's value histogram in CIE L*: dark share (L* < 25), mid, light, pure white (Y > 0.95).
//   shuffleLabels: the false-accept control, the same labels in a seeded random order.
import { luminance, enc } from '../study/cmath.mjs';
import { lumOf } from './tone.mjs';
import { rngFrom } from '../seed.mjs';

export const WHITE_Y = 0.95, SPEC_SHARE = 0.5, PASS = 0.95, MIN_BRIGHT = 0.0005;
const lstar = Y => (Y > 216 / 24389 ? 116 * Math.cbrt(Y) - 16 : Y * 24389 / 27);

// per-pixel specular label from the render: specular-origin share of luminance >= 0.5
export function specLabels(img) {
  const n = img.w * img.h, L = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const t = lumOf(img.rgb[3 * i], img.rgb[3 * i + 1], img.rgb[3 * i + 2]), d = lumOf(img.dif[3 * i], img.dif[3 * i + 1], img.dif[3 * i + 2]);
    L[i] = t > 0 && (t - d) / t >= SPEC_SHARE ? 1 : 0;
  }
  return L;
}

export function whiteCheck(disp, labels) {
  const n = disp.w * disp.h; let bright = 0, spec = 0;
  for (let i = 0; i < n; i++) {
    const p = 4 * i; if (luminance([disp.rgba[p], disp.rgba[p + 1], disp.rgba[p + 2]]) <= WHITE_Y) continue;
    bright++; spec += labels[i];
  }
  const share = bright ? spec / bright : null, frac = bright / n;
  return { bright, frac, spec, share, pass: bright > 0 && frac >= MIN_BRIGHT && share >= PASS };
}

export function shuffleLabels(labels, seed = 'value/shuffle') {
  const o = Uint8Array.from(labels), rng = rngFrom(seed);
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = o[i]; o[i] = o[j]; o[j] = t; }
  return o;
}

export function valueBudget(disp) {
  const n = disp.w * disp.h, hist = new Uint32Array(101); let dark = 0, white = 0, light = 0;
  for (let i = 0; i < n; i++) {
    const p = 4 * i, Y = luminance([disp.rgba[p], disp.rgba[p + 1], disp.rgba[p + 2]]), L = lstar(Y);
    hist[Math.min(100, Math.round(L))]++; if (L < 25) dark++; else if (L >= 75) light++; if (Y > WHITE_Y) white++;
  }
  return { dark: dark / n, light: light / n, mid: 1 - (dark + light) / n, white: white / n, hist: Array.from(hist).map(v => v / n) };
}

// a uniform field (the structureless input): w x h at display luminance y
export function uniformField(w, h, y) {
  const v = Math.round(enc(y) * 255), rgba = new Uint8ClampedArray(4 * w * h).fill(v);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  return { w, h, rgba };
}
