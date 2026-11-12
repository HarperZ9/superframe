// A figure exposed to the painting around it. The plate's painted brightness at the figure's spot
// (its feet, its body's footprint and the ground ring, from runtime/platectx.mjs) sets the target:
// the figure's mid-tones sit at the plate's local median, and its highlights roll off toward a
// ceiling a little above the plate's local highlights, so a figure never reads brighter than the
// room's own lit surfaces. All of it in linear light; the result is sRGB bytes.
//   const X = exposure(rgba, n, stats, albedo, sampleIndex)    X.apply(i, lift) -> [r, g, b] bytes
const LIN = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const ENC = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const Y = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export const MID_MATCH = 1.0, HI_ABOVE = 1.45, GAIN_RANGE = [0.1, 12];

// The figure's own light is read apart from its clothes: the median over its pixels of rendered
// luminance over albedo luminance (alb: the renderer's albedo at sample index si(i)). A figure of
// PLATE_ALBEDO then lands on the plate's local median, so a black coat stays dark beside a lit floor
// while a pale apron reads as pale as the painted plaster near it.
// READ_FLOOR: the darkest local median a figure is exposed to, so on the quay's darkest stretches it
// stays a figure and not a cut-out (0.03 linear, about 19% grey; the plate there runs near 0.02)
export const READ_FLOOR = 0.03;
export const PLATE_ALBEDO = 0.18;   // the painted ground runs dark (wet stone, oiled boards): tested 0.3 and 0.18 on the Brine and the quay, PROGRESS step 57
export function exposure(rgba, n, stats, alb = null, si = (i) => i) {
  let gain = 1, ceil = 1;
  if (stats) {
    const qs = [];
    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] <= 0.5) continue;
      const y = Y(LIN(rgba[i * 4]), LIN(rgba[i * 4 + 1]), LIN(rgba[i * 4 + 2]));
      if (!alb) { qs.push(y / PLATE_ALBEDO); continue; }
      const j = si(i), ya = Y(LIN(alb[j * 3]), LIN(alb[j * 3 + 1]), LIN(alb[j * 3 + 2]));
      if (ya > 0.01) qs.push(y / ya);
    }
    qs.sort((a, b) => a - b);
    const irr = qs.length ? qs[Math.floor(qs.length * 0.5)] : 0;   // the light the figure was rendered under
    if (irr > 1e-5) gain = Math.min(GAIN_RANGE[1], Math.max(GAIN_RANGE[0], (Math.max(stats.mid * MID_MATCH, READ_FLOOR)) / (PLATE_ALBEDO * irr)));
    ceil = Math.min(1, Math.max(stats.hi * HI_ABOVE, stats.mid * 2.2, 0.02));
  }
  const knee = 0.6 * ceil, span = ceil - knee;
  return {
    gain, ceil,
    // pixel i with an extra lift (faces and hands), rolled off above the knee toward the ceiling
    apply(i, lift = 1) {
      let r = LIN(rgba[i * 4]) * gain * lift, g = LIN(rgba[i * 4 + 1]) * gain * lift, b = LIN(rgba[i * 4 + 2]) * gain * lift;
      const y = Y(r, g, b);
      if (y > knee && y > 0) { const y2 = knee + span * (1 - Math.exp(-(y - knee) / span)), k = y2 / y; r *= k; g *= k; b *= k; }
      const m = Math.max(r, g, b); if (m > 1) { r /= m; g /= m; b /= m; }
      return [Math.round(ENC(r) * 255), Math.round(ENC(g) * 255), Math.round(ENC(b) * 255)];
    },
    // a colour (0..1 sRGB) held at or under the ceiling, for the outline
    cap(rgb, floor = 0.22) { const l = rgb.map(LIN), y = Y(...l), c = Math.max(ceil, floor), k = y > c ? c / y : 1;   // never so dim it stops separating the figure on a dark plate
       return l.map((v) => Math.round(ENC(v * k) * 255)); },
  };
}
