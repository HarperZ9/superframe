// Reference consumers of the light record, one per style, so the record can be seen and measured before
// each style lead draws it their own way (design/state/light.md). They are proofs of the interface, not the
// styles: the painter and the glyph renderer stay their leads'.
//   relightRatio(F, Enow, Ebake, { owners, gains }) -> Float32Array rgb per sample: how much brighter or darker each
//                                           sample is now than the plate was baked (lamps out, the clock moved)
//   relightRgba(rgba, W, H, F, ratio)    -> Uint8ClampedArray: the painted plate relit by the ratio
//   cellsFromField(C, F, E)              -> Float32Array rgb per glyph cell (glyph/cells.mjs sceneCells C)
//   cellRecord(C, F)                     -> { wet, frost, fog, K, shadow, rim } per glyph cell (Uint8 / Uint16)
import { idAt } from "./surface.mjs";
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255;

export function relightRatio(F, Enow, Ebake, { lo = 0.04, hi = 10, eps = 0.012, owners = null, gains = null, chroma = [0.7, 1.4] } = {}) {
  const { w, h, n, N } = F, R = new Float32Array(n * 3).fill(1), T = new Float32Array(n * 3).fill(1);
  for (let i = 0; i < n; i++) { if (!Number.isFinite(N[i * 3])) continue; const ln = 0.2126 * Enow[i * 3] + 0.7152 * Enow[i * 3 + 1] + 0.0722 * Enow[i * 3 + 2], lb = 0.2126 * Ebake[i * 3] + 0.7152 * Ebake[i * 3 + 1] + 0.0722 * Ebake[i * 3 + 2], rL = (ln + eps) / (lb + eps);
      // the change in value in full; the change in hue held to a glaze (a paint film cannot turn a wall violet)
      for (let k = 0; k < 3; k++) { const rc = (Enow[i * 3 + k] + eps) / (Ebake[i * 3 + k] + eps) / rL, r = rL * (rc < chroma[0] ? chroma[0] : rc > chroma[1] ? chroma[1] : rc); T[i * 3 + k] = r < lo ? lo : r > hi ? hi : r; } }
  // a 3 x 3 mean over the samples that hold a surface, so the plate's own detail carries the edges
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!Number.isFinite(N[i * 3])) continue; let a = 0, b = 0, c = 0, m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const j = Y * w + X; if (!Number.isFinite(N[j * 3])) continue; a += T[j * 3]; b += T[j * 3 + 1]; c += T[j * 3 + 2]; m++; }
    R[i * 3] = a / m; R[i * 3 + 1] = b / m; R[i * 3 + 2] = c / m;
  }
  fillGaps(F, R, skyRatio(F, Enow, Ebake));
  // a pane or a flame goes as its own light goes (its glow was painted in at full gain)
  if (owners && gains) for (let i = 0; i < n; i++) { const j = owners[i]; if (j >= 0) { const k = Math.max(lo, Math.min(hi, gains[j])); R[i * 3] = R[i * 3 + 1] = R[i * 3 + 2] = k; } }
  return R;
}
// the glow of a pane the bake left dark (glass) when its window is lit now: added light, in the window's colour
export function paneEmit(F, owners, lights, gains, { dark = [44], k = 0.55 } = {}) {
  const D = new Set(dark), out = new Float32Array(F.n * 3); let any = false;
  for (let i = 0; i < F.n; i++) {
    const j = owners[i]; if (j < 0 || !lights[j].generated || !D.has(idAt(F, i))) continue; const g = gains[j] * k; if (g <= 0) continue;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = lights[j].rgb[c] * g; any = true;
  }
  return any ? out : null;
}
// samples with no single surface (ink lines, edges, the void past the world) take the ratio of the surface
// beside them, grown outward a few samples; past that, the sky's own change
function fillGaps(F, R, sky) {
  const { w, h, n, N } = F, done = new Uint8Array(n); for (let i = 0; i < n; i++) done[i] = Number.isFinite(N[i * 3]) ? 1 : 0;
  for (let pass = 0; pass < 4; pass++) {
    const add = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (done[i]) continue; let a = 0, b = 0, c = 0, m = 0;
      for (const j of [i - 1, i + 1, i - w, i + w]) { if (j < 0 || j >= n || !done[j] || Math.abs((j % w) - x) > 1) continue; a += R[j * 3]; b += R[j * 3 + 1]; c += R[j * 3 + 2]; m++; }
      if (m) add.push([i, a / m, b / m, c / m]);
    }
    for (const [i, a, b, c] of add) { R[i * 3] = a; R[i * 3 + 1] = b; R[i * 3 + 2] = c; done[i] = 1; }
  }
  for (let i = 0; i < n; i++) if (!done[i]) { R[i * 3] = sky[0]; R[i * 3 + 1] = sky[1]; R[i * 3 + 2] = sky[2]; }
}
// the median change over the open, up-facing samples: the sky's own change, for the void
function skyRatio(F, Enow, Ebake) {
  const ch = [[], [], []];
  for (let i = 0; i < F.n; i += 7) if (Number.isFinite(F.N[i * 3]) && F.up[i] > 230) for (let k = 0; k < 3; k++) ch[k].push((Enow[i * 3 + k] + 0.012) / (Ebake[i * 3 + k] + 0.012));
  return ch.map((a) => (a.sort((x, y) => x - y), a.length ? a[a.length >> 1] : 1));
}
export function relightRgba(rgba, W, H, F, ratio, emit = null) {
  const out = new Uint8ClampedArray(rgba.length), s = F.w / W;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 4, gx = Math.min(F.w - 1, Math.floor(x * s)), gy = Math.min(F.h - 1, Math.floor(y * s)), i = gy * F.w + gx;
    for (let k = 0; k < 3; k++) out[p + k] = enc(LIN[rgba[p + k]] * ratio[i * 3 + k] + (emit ? emit[i * 3 + k] : 0));
    out[p + 3] = rgba[p + 3];
  }
  return out;
}
// each glyph cell's light: the mean over the cell's samples that belong to its own surface (within 0.6 m of
// the cell's point), so a lamp's pool on a wall does not leak onto the floor cell in front of it
function cellSamples(C, F, c, fn) {
  const s = F.w / C.pj.width, I = c % C.nI, J = (c / C.nI) | 0, x0 = Math.floor(I * C.pw * s), x1 = Math.max(x0 + 1, Math.floor((I + 1) * C.pw * s)), y0 = Math.floor(J * C.ph * s), y1 = Math.max(y0 + 1, Math.floor((J + 1) * C.ph * s));
  const px = C.P[c * 3], py = C.P[c * 3 + 1], pz = C.P[c * 3 + 2]; let m = 0;
  for (let y = y0; y < Math.min(F.h, y1); y++) for (let x = x0; x < Math.min(F.w, x1); x++) {
    const i = y * F.w + x; if (!Number.isFinite(F.N[i * 3])) continue;
    const dx = F.pos[i * 3] - px, dy = F.pos[i * 3 + 1] - py, dz = F.pos[i * 3 + 2] - pz; if (dx * dx + dy * dy + dz * dz > 0.36) continue;
    fn(i); m++;
  }
  return m;
}
export function cellsFromField(C, F, E = F.E) {
  const n = C.nI * C.nJ, out = new Float32Array(n * 3);
  for (let c = 0; c < n; c++) {
    if (!Number.isFinite(C.P[c * 3 + 1])) continue; let r = 0, g = 0, b = 0;
    const m = cellSamples(C, F, c, (i) => { r += E[i * 3]; g += E[i * 3 + 1]; b += E[i * 3 + 2]; });
    if (m) { out[c * 3] = r / m; out[c * 3 + 1] = g / m; out[c * 3 + 2] = b / m; continue; }
    // no sample of the cell's own surface holds a normal (an edge, a thin thing): the nearest sample that does
    const j = nearestLit(C, F, c); if (j >= 0) { out[c * 3] = E[j * 3]; out[c * 3 + 1] = E[j * 3 + 1]; out[c * 3 + 2] = E[j * 3 + 2]; }
  }
  return out;
}
function nearestLit(C, F, c) {
  const s = F.w / C.pj.width, I = c % C.nI, J = (c / C.nI) | 0, cx = Math.floor((I + 0.5) * C.pw * s), cy = Math.floor((J + 0.5) * C.ph * s);
  for (let r = 0; r <= 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= F.w || y >= F.h) continue;
    const i = y * F.w + x; if (Number.isFinite(F.N[i * 3])) return i;
  }
  return -1;
}
export function cellRecord(C, F) {
  const n = C.nI * C.nJ, R = { wet: new Uint8Array(n), frost: new Uint8Array(n), fog: new Uint8Array(n), shadow: new Uint8Array(n), rim: new Uint8Array(n), K: new Uint16Array(n) };
  for (let c = 0; c < n; c++) {
    if (!Number.isFinite(C.P[c * 3 + 1])) continue; const acc = { wet: 0, frost: 0, fog: 0, shadow: 0, rim: 0, K: 0 };
    const m = cellSamples(C, F, c, (i) => { for (const k of Object.keys(acc)) acc[k] += F.rec[k][i]; });
    if (m) for (const k of Object.keys(acc)) R[k][c] = Math.round(acc[k] / m);
  }
  return R;
}
