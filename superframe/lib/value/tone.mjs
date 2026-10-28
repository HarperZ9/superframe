// tone.mjs: the value budget's tone curve and its control. Physics sets the ceiling: a diffuse surface of albedo at
// most 1 returns at most E / pi, so with a key of irradiance E_key and surroundings of radiance at most L_amb no
// diffuse radiance exceeds C = (E_key + pi L_amb) / pi. The curve is the authored part (a convention, labelled):
// display luminance d_w x for x = radiance / C up to 1, then an exponential shoulder toward 1 with the same slope at
// x = 1, so pure white is reachable only by radiance the diffuse bound forbids. Pure, no state.
import { enc } from '../study/cmath.mjs';

export const D_W = 0.8;
export const TONE_METHOD = {
  ceiling: 'C = (E_key + pi L_amb) / pi, the largest radiance a diffuse surface of albedo 1 can return (physics)',
  curve: 'T(x) = d_w x for x <= 1; 1 - (1 - d_w) exp(-k (x - 1)) above, k = d_w / (1 - d_w) (authored convention)',
  colour: 'luminance is tone-mapped and the colour scaled with it; a channel over 1 is pulled toward the grey of the same luminance',
};
export const ceiling = (Ekey, Lamb) => (Ekey + Math.PI * Lamb) / Math.PI;
export const lumOf = (r, g, b) => 0.2126729 * r + 0.7151522 * g + 0.072175 * b;

export function curve(x, dw = D_W) {
  if (x <= 1) return dw * Math.max(0, x);
  return 1 - (1 - dw) * Math.exp(-(dw / (1 - dw)) * (x - 1));
}
// the radiance ratio at which the curve reaches display luminance y (y > d_w)
export const xAt = (y, dw = D_W) => (y <= dw ? y / dw : 1 + Math.log((1 - dw) / (1 - y)) / (dw / (1 - dw)));

// one linear RGB radiance to display linear RGB in [0, 1], hue kept, overflow desaturated toward white
export function mapPixel(r, g, b, C, dw = D_W) {
  const Y = lumOf(r, g, b) / C;
  if (Y <= 0) return [0, 0, 0];
  const s = curve(Y, dw) / Y / C, o = [r * s, g * s, b * s], m = Math.max(...o);
  if (m <= 1) return o;
  const t = curve(Y, dw), k = (1 - t) / (m - t);           // keeps luminance t, brings the largest channel to 1
  return o.map(v => t + (v - t) * k);
}

// the control: expose so the brightest diffuse pixel reaches 1.0, then clip each channel ("expose for the paper")
export function clampPixel(r, g, b, gain) { return [r, g, b].map(v => Math.min(1, Math.max(0, v * gain))); }

// whole-image mapping. img = { w, h, rgb: Float64Array(3n) total radiance, dif: Float64Array(3n) diffuse part }
export function toDisplay(img, { mode = 'budget', C, dw = D_W } = {}) {
  const n = img.w * img.h, rgba = new Uint8ClampedArray(4 * n);
  let gain = 0;
  if (mode === 'clamp') { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, lumOf(img.dif[3 * i], img.dif[3 * i + 1], img.dif[3 * i + 2])); gain = m > 0 ? 1 / m : 1; }
  for (let i = 0; i < n; i++) {
    const r = img.rgb[3 * i], g = img.rgb[3 * i + 1], b = img.rgb[3 * i + 2];
    const o = mode === 'clamp' ? clampPixel(r, g, b, gain) : mapPixel(r, g, b, C, dw);
    for (let c = 0; c < 3; c++) rgba[4 * i + c] = Math.round(enc(Math.min(1, Math.max(0, o[c]))) * 255);
    rgba[4 * i + 3] = img.alpha ? img.alpha[i] : 255;
  }
  return { w: img.w, h: img.h, rgba, gain };
}
