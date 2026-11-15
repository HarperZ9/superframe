// Halftone falloff from the light record (the author's section 11 reference, for the glyph lead's night look): the
// irradiance is continuous, linear and per sample, so a screen can quantise it directly. A dot's radius in a cell goes
// with the square root of the cell's light against a reference (area follows light), on a world-anchored grid so the
// dots stay with the stones. Original code.
//   halftoneCover(E, x, y, cell, ref) -> 0..1 coverage at pixel (x, y) for a cell of `cell` px, E the light there
//   halftoneRgba(F, E, W, H, { cell, ref, ink, paper }) -> an RGBA image of the plate's light as dots (a proof and a reference)
export function halftoneCover(e, x, y, cell = 6, ref = 0.25) {
  const cx = (Math.floor(x / cell) + 0.5) * cell, cy = (Math.floor(y / cell) + 0.5) * cell, r = 0.5 * cell * Math.min(1.25, Math.sqrt(Math.max(0, e) / ref));
  const d = Math.hypot(x - cx, y - cy); return d <= r - 0.5 ? 1 : d >= r + 0.5 ? 0 : r + 0.5 - d;
}
export function halftoneRgba(F, E, W, H, { cell = 6, ref = null, ink = [233, 227, 212], paper = [12, 10, 16] } = {}) {
  if (ref == null) { const v = []; for (let i = 0; i < F.n; i += 7) if (Number.isFinite(F.N[i * 3])) v.push(0.2126 * E[i * 3] + 0.7152 * E[i * 3 + 1] + 0.0722 * E[i * 3 + 2]); v.sort((a, b) => a - b); ref = Math.max(1e-3, v[Math.floor(v.length * 0.95)] || 0.25); }   // the eye's level: the scene's brighter samples fill a cell
  const out = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4) }, sx = F.w / W, sy = F.h / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // the light at the dot's own centre, so a dot is one value
    const cx = (Math.floor(x / cell) + 0.5) * cell, cy = (Math.floor(y / cell) + 0.5) * cell, i = Math.min(F.h - 1, Math.floor(cy * sy)) * F.w + Math.min(F.w - 1, Math.floor(cx * sx));
    const e = Number.isFinite(F.N[i * 3]) ? 0.2126 * E[i * 3] + 0.7152 * E[i * 3 + 1] + 0.0722 * E[i * 3 + 2] : 0, k = halftoneCover(e, x, y, cell, ref), q = (y * W + x) * 4;
    const col = E && e > 0 ? [0, 1, 2].map((c) => ink[c] * Math.min(1, 0.5 + 0.5 * E[i * 3 + c] / Math.max(1e-3, e))) : ink;
    for (let c = 0; c < 3; c++) out.data[q + c] = paper[c] * (1 - k) + col[c] * k; out.data[q + 3] = 255;
  }
  return out;
}
