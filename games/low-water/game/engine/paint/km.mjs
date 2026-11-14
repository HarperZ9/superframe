// Pigment-space mixing: Kubelka-Munk, one constant per channel. A colour is read as the reflectance
// of an opaque paint layer; two paints mix by adding their absorption-to-scatter ratios (K/S), the
// way pigments in one film do, then the mixture's reflectance is read back. A violet and a sodium
// orange so mixed give a warm dark, where an RGB lerp gives grey. Original code.
//   ks(R) -> K/S    rOf(ks) -> R    mix(a, b, t) linear-RGB paints -> linear-RGB paint
//   glaze(base, tint, t): a transparent tint over a base (the tint's hue, the base's value kept)
//   toLin(byte) / toByte(lin): sRGB transfer
const EPS = 1e-4;
export const ks = (R) => { const r = R < EPS ? EPS : R > 1 ? 1 : R; return ((1 - r) * (1 - r)) / (2 * r); };
export const rOf = (k) => 1 + k - Math.sqrt(k * k + 2 * k);

// t = share of b in the mixture (by pigment concentration)
export function mix(a, b, t, out = [0, 0, 0]) {
  if (t <= 0) { out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; return out; }
  if (t >= 1) { out[0] = b[0]; out[1] = b[1]; out[2] = b[2]; return out; }
  for (let c = 0; c < 3; c++) out[c] = rOf(ks(a[c]) * (1 - t) + ks(b[c]) * t);
  return out;
}

const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// A glaze carries hue, not value: the tint is scaled to the base's luminance, mixed in pigment
// space, and the result is brought back to the base's luminance times (1 + lift).
export function glaze(base, tint, t, lift = 0, out = [0, 0, 0]) {
  const yb = Y(base); if (yb <= 1e-6 || t <= 0) { out[0] = base[0]; out[1] = base[1]; out[2] = base[2]; return out; }
  const yt = Y(tint) || 1, k = Math.min(1 / Math.max(tint[0], tint[1], tint[2], 1e-6), yb / yt);
  const T = [tint[0] * k, tint[1] * k, tint[2] * k];
  mix(base, T, t, out);
  const ym = Y(out) || 1e-6, g = (yb * (1 + lift)) / ym;
  for (let c = 0; c < 3; c++) out[c] = Math.min(1, out[c] * g);
  return out;
}

const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; LUT[i] = v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
export const toLin = (b) => LUT[b | 0];
const encode = (v) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));
// the encode through a table on the square root of the value (even steps in the darks)
const ENC = new Uint8Array(8193); for (let i = 0; i <= 8192; i++) ENC[i] = encode((i / 8192) ** 2);
export const toByte = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : ENC[Math.round(Math.sqrt(v) * 8192)]);
export { Y as lum };
