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
// buf (optional, kept by the caller): reused arrays; the linear values of the figure's pixels are
// computed once and shared by the median and by apply (the same numbers either way)
// opts (a figure rendered in bands, runtime/figworker.mjs): range [i0, i1) samples only those pixels and
// returns them as X.samples; irr skips the sampling and takes the median the bands' samples gave
export function exposure(rgba, n, stats, alb = null, si = (i) => i, buf = null, { range = null, irr: irrIn } = {}) {
  let gain = 1, ceil = 1, samples = null;
  const lin = buf ? (buf.lin && buf.lin.length >= n * 3 ? buf.lin : (buf.lin = new Float64Array(n * 3))) : null;
  const has = buf ? (buf.has && buf.has.length >= n ? buf.has : (buf.has = new Uint8Array(n))) : null;
  if (has) has.fill(0, 0, n);
  const linOf = (i) => { if (!has[i]) { lin[i * 3] = LIN(rgba[i * 4]); lin[i * 3 + 1] = LIN(rgba[i * 4 + 1]); lin[i * 3 + 2] = LIN(rgba[i * 4 + 2]); has[i] = 1; } };
  if (stats) {
    const qs = irrIn !== undefined ? null : buf ? (buf.qs && buf.qs.length >= n ? buf.qs : (buf.qs = new Float64Array(n))) : new Float64Array(n); let nq = 0;
    if (qs) for (let i = range ? range[0] : 0, i1 = range ? range[1] : n; i < i1; i++) {
      if (rgba[i * 4 + 3] <= 0.5) continue;
      let y;
      if (lin) { linOf(i); y = Y(lin[i * 3], lin[i * 3 + 1], lin[i * 3 + 2]); } else y = Y(LIN(rgba[i * 4]), LIN(rgba[i * 4 + 1]), LIN(rgba[i * 4 + 2]));
      if (!alb) { qs[nq++] = y / PLATE_ALBEDO; continue; }
      const j = si(i), ya = Y(LIN(alb[j * 3]), LIN(alb[j * 3 + 1]), LIN(alb[j * 3 + 2]));
      if (ya > 0.01) qs[nq++] = y / ya;
    }
    if (qs && range) samples = qs.slice(0, nq);
    const q = qs ? qs.subarray(0, nq).sort() : null;   // numeric, ascending: the same order as sort((a, b) => a - b)
    const irr = irrIn !== undefined ? irrIn : nq ? q[Math.floor(nq * 0.5)] : 0;   // the light the figure was rendered under
    if (irr > 1e-5) gain = Math.min(GAIN_RANGE[1], Math.max(GAIN_RANGE[0], (Math.max(stats.mid * MID_MATCH, READ_FLOOR)) / (PLATE_ALBEDO * irr)));
    ceil = Math.min(1, Math.max(stats.hi * HI_ABOVE, stats.mid * 2.2, 0.02));
  }
  const knee = 0.6 * ceil, span = ceil - knee;
  // pixel i with an extra lift (faces and hands), rolled off above the knee toward the ceiling, into out
  function applyTo(i, lift, out) {
    let r, g, b;
    if (lin) { linOf(i); r = lin[i * 3] * gain * lift; g = lin[i * 3 + 1] * gain * lift; b = lin[i * 3 + 2] * gain * lift; }
    else { r = LIN(rgba[i * 4]) * gain * lift; g = LIN(rgba[i * 4 + 1]) * gain * lift; b = LIN(rgba[i * 4 + 2]) * gain * lift; }
    const y = Y(r, g, b);
    if (y > knee && y > 0) { const y2 = knee + span * (1 - Math.exp(-(y - knee) / span)), k = y2 / y; r *= k; g *= k; b *= k; }
    const m = Math.max(r, g, b); if (m > 1) { r /= m; g /= m; b /= m; }
    out[0] = Math.round(ENC(r) * 255); out[1] = Math.round(ENC(g) * 255); out[2] = Math.round(ENC(b) * 255); return out;
  }
  return {
    gain, ceil, applyTo, samples,
    apply(i, lift = 1) { return applyTo(i, lift, [0, 0, 0]); },
    // a colour (0..1 sRGB) held at or under the ceiling, for the outline
    cap(rgb, floor = 0.22) { const l = rgb.map(LIN), y = Y(...l), c = Math.max(ceil, floor), k = y > c ? c / y : 1;   // never so dim it stops separating the figure on a dark plate
       return l.map((v) => Math.round(ENC(v * k) * 255)); },
  };
}

// the median of the bands' samples, as exposure takes it from one figure's (the same value: one sort of the union)
export function medianOf(parts) {
  let n = 0; for (const p of parts) n += p.length;
  const all = new Float64Array(n); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
  all.sort(); return n ? all[Math.floor(n * 0.5)] : 0;
}
