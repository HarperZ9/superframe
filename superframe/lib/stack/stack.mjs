// stack.mjs: the one operation under every effect in this folder. Slice a volume along an axis, then read the slices
// back by stacking: each entry names a slice, an offset, an opacity, a tint and a compositing mode. Time slices give
// the echo and the onion skin (echo.mjs), the shutter integral (shutter.mjs) and the living still (still.mjs). Height
// slices give sprite stacking (below).
//   readStack(ground, entries) with entries = [{ layer, dx, dy, opacity, tint, mode: 'over' | 'add' }], back to front
import { frame, layer, over, addInto, luma } from './frame.mjs';

// Shift a layer by whole pixels (dx, dy). Whole-pixel shifts keep hard sprite edges hard, as sprite stacking needs.
export function shiftLayer(L, dx, dy) {
  const out = layer(L.w, L.h), ix = Math.round(dx), iy = Math.round(dy);
  for (let y = 0; y < L.h; y++) { const sy = y - iy; if (sy < 0 || sy >= L.h) continue;
    for (let x = 0; x < L.w; x++) { const sx = x - ix; if (sx < 0 || sx >= L.w) continue;
      const s = sy * L.w + sx, d = y * L.w + x; out.a[d] = L.a[s];
      for (let c = 0; c < 3; c++) out.px[3 * d + c] = L.px[3 * s + c]; } }
  return out;
}

// Replace a layer's colour by tint x luma, keeping its alpha: the echo's look (tint is an authored colour).
export function tintLayer(L, tint) {
  const out = layer(L.w, L.h), n = L.w * L.h;
  const Y = luma(L);                                     // premultiplied luma, so Y already carries alpha
  for (let i = 0; i < n; i++) { out.a[i] = L.a[i]; for (let c = 0; c < 3; c++) out.px[3 * i + c] = tint[c] * Y[i]; }
  return out;
}
// A flat silhouette in one colour: the onion skin's look.
export function flatLayer(L, rgb) {
  const out = layer(L.w, L.h);
  for (let i = 0; i < L.w * L.h; i++) { out.a[i] = L.a[i]; for (let c = 0; c < 3; c++) out.px[3 * i + c] = rgb[c] * L.a[i]; }
  return out;
}

export function readStack(ground, entries) {
  const F = ground.px ? { w: ground.w, h: ground.h, px: ground.px.slice() } : frame(ground.w, ground.h, ground.rgb);
  for (const e of entries) {
    let L = e.layer;
    if (e.tint) L = tintLayer(L, e.tint); else if (e.flat) L = flatLayer(L, e.flat);
    if (e.dx || e.dy) L = shiftLayer(L, e.dx ?? 0, e.dy ?? 0);
    if ((e.mode ?? 'over') === 'add') addInto(F, L, e.opacity ?? 1); else over(F, L, e.opacity ?? 1);
  }
  return F;
}

// A voxel volume: nx x ny x nz cells, each with an RGB colour and an occupancy 0..1.
export const volume = (nx, ny, nz) => ({ nx, ny, nz, rgb: new Float32Array(nx * ny * nz * 3), occ: new Float32Array(nx * ny * nz) });
export const vidx = (V, x, y, z) => (z * V.ny + y) * V.nx + x;

// One plane section of the volume at height z, rotated by theta about the volume's vertical axis and placed with
// its centre at (cx, cy) on a w x h layer. Nearest-cell sampling keeps the voxel look.
export function sliceZ(V, z, { w, h, cx, cy, theta = 0, scale = 1 }) {
  const L = layer(w, h), c = Math.cos(theta), s = Math.sin(theta), hx = V.nx / 2, hy = V.ny / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5 - cx) / scale, v = (y + 0.5 - cy) / scale;
    const vx = Math.floor(c * u + s * v + hx), vy = Math.floor(-s * u + c * v + hy);
    if (vx < 0 || vy < 0 || vx >= V.nx || vy >= V.ny) continue;
    const k = vidx(V, vx, vy, z), a = V.occ[k], d = y * w + x; if (a <= 0) continue;
    L.a[d] = a; for (let ch = 0; ch < 3; ch++) L.px[3 * d + ch] = V.rgb[3 * k + ch] * a;
  }
  return L;
}

// Sprite stacking: the height axis read by stacking. Each slice is drawn `rise` pixels above the one below it, all
// rotated together, bottom first, so a stack of flat slices reads as a solid seen from above at an angle.
export function spriteStack(V, ground, { cx, cy, theta = 0, scale = 1, rise = 1, shade = 0.5 } = {}) {
  const entries = [];
  for (let z = 0; z < V.nz; z++) {
    const L = sliceZ(V, z, { w: ground.w, h: ground.h, cx, cy: cy - z * rise, theta, scale });
    const k = shade + (1 - shade) * (z + 1) / V.nz;        // lower slices darker: an authored ambient cue
    for (let i = 0; i < L.px.length; i++) L.px[i] *= k;
    entries.push({ layer: L });
  }
  return readStack(ground, entries);
}
