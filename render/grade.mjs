// The Low Water grade: a toe that sets how deep the darks go, a split tone (cool violet shadows,
// lamp-warm highlights kept), and saturation. Applied to scene-linear light before the display
// encode. Every term is keyed to the eight time-of-day slots through the engine's look keys
// (web/look/keys.mjs), so a key frame at 23:07 reads the curve between the night and midnight keys.
// Original code; the terms are the look bible's.
import { rn } from "./rn.mjs";
const { createLookKeys } = await import(rn("web/look/keys.mjs"));

// Slots (SLOTS_8): midnight, predawn, dawn, morning, noon, golden, dusk, night.
export const LW_TERMS = {
  toe: { values: [0.28, 0.25, 0.15, 0.06, 0.03, 0.1, 0.2, 0.26], min: 0, max: 1 },
  shadowTint: [[0.42, 0.42, 1.3], [0.5, 0.5, 1.2], [0.85, 0.78, 0.95], [0.95, 0.95, 1], [1, 1, 1], [0.9, 0.8, 0.95], [0.62, 0.52, 1.1], [0.44, 0.42, 1.28]],
  shadowRange: { values: [0.22, 0.2, 0.1, 0.05, 0.04, 0.08, 0.15, 0.22], min: 0.01, max: 1 },
  // additive cool lift in the shadows (scene-linear), the ambient half of the direct-to-ambient balance
  lift: [[0.006, 0.007, 0.024], [0.006, 0.007, 0.02], [0.004, 0.004, 0.008], [0, 0, 0], [0, 0, 0], [0.002, 0.001, 0.004], [0.006, 0.004, 0.016], [0.006, 0.007, 0.024]],
  saturation: { values: [1.1, 1.05, 1.0, 1.0, 1.0, 1.08, 1.12, 1.1], min: 0, max: 2 },
  exposure: { values: [1, 1, 1, 1, 1, 1, 1, 1], min: 0.1, max: 4 },
};
export const lwLook = createLookKeys({ slots: 8, params: LW_TERMS });

export function gradeLinear(frame, hour, over = {}) {
  const t = { ...lwLook.at(hour), ...over }, d = frame.data, o = new Float64Array(d.length), k = t.toe * 0.12;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * t.exposure, g = d[i + 1] * t.exposure, b = d[i + 2] * t.exposure;
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b, crush = L / (L + k + 1e-9), m = Math.min(1, L / t.shadowRange), s = m * m * (3 - 2 * m);
    r *= crush * (t.shadowTint[0] + (1 - t.shadowTint[0]) * s); g *= crush * (t.shadowTint[1] + (1 - t.shadowTint[1]) * s); b *= crush * (t.shadowTint[2] + (1 - t.shadowTint[2]) * s);
    const sh = 1 - s; r += t.lift[0] * sh; g += t.lift[1] * sh; b += t.lift[2] * sh;
    const l2 = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    o[i] = Math.max(0, l2 + (r - l2) * t.saturation); o[i + 1] = Math.max(0, l2 + (g - l2) * t.saturation); o[i + 2] = Math.max(0, l2 + (b - l2) * t.saturation); o[i + 3] = 1;
  }
  return { width: frame.width, height: frame.height, data: o };
}
