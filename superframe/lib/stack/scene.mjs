// scene.mjs: an analytic moving scene, so every planted answer is known in closed form. Items are axis-aligned
// rectangles moving at constant velocity; the camera pans at its own velocity, so an item's image velocity is its
// world velocity minus the camera's. Each pixel is a box filter: its value is the exact area of the rectangle inside
// it. Opaque items composite "over"; emissive items add light; a flash item exists only during its window.
//   scene = { w, h, ground: [r,g,b], cam: { vx, vy }, items: [{ x, y, w, h, vx, vy, rgb, emit, flash: { t, dur, energy } }] }
import { frame } from './frame.mjs';

const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

// Where an item's rectangle sits in the image at time t.
export function placeAt(item, cam, t) {
  const x = item.x + ((item.vx ?? 0) - (cam?.vx ?? 0)) * t, y = item.y + ((item.vy ?? 0) - (cam?.vy ?? 0)) * t;
  return { x0: x, y0: y, x1: x + item.w, y1: y + item.h };
}
export const imageSpeed = (item, cam) => Math.hypot((item.vx ?? 0) - (cam?.vx ?? 0), (item.vy ?? 0) - (cam?.vy ?? 0));

// Paint one rectangle into F with weight k: over for opaque, add for emissive. Only its bounding box is visited.
export function paintRect(F, r, rgb, { k = 1, emit = false, alpha = 1 } = {}) {
  const i0 = Math.max(0, Math.floor(r.x0)), i1 = Math.min(F.w, Math.ceil(r.x1)), j0 = Math.max(0, Math.floor(r.y0)), j1 = Math.min(F.h, Math.ceil(r.y1));
  for (let j = j0; j < j1; j++) { const cy = overlap(j, j + 1, r.y0, r.y1); if (cy <= 0) continue;
    for (let i = i0; i < i1; i++) { const cov = cy * overlap(i, i + 1, r.x0, r.x1) * alpha; if (cov <= 0) continue;
      const p = 3 * (j * F.w + i);
      for (let c = 0; c < 3; c++) F.px[p + c] = emit ? F.px[p + c] + k * cov * rgb[c] : F.px[p + c] * (1 - k * cov) + k * cov * rgb[c];
    } }
  return F;
}

// The scene at one instant, flashes excluded unless `flashes` is set (then a flash item is drawn as if lit, with
// radiance energy / dur scaled by `flashScale`).
export function sharpAt(scene, t, { flashes = false, flashScale = 1, only = null } = {}) {
  const F = frame(scene.w, scene.h, only ? [0, 0, 0] : scene.ground ?? [0, 0, 0]);
  for (const it of scene.items) {
    if (only && !only(it)) continue;
    if (it.flash && !flashes) continue;
    const r = placeAt(it, scene.cam, it.flash && flashes ? it.flash.t : t);
    const k = it.flash ? it.flash.energy * flashScale : 1;
    paintRect(F, r, it.rgb, { k, emit: !!(it.emit || it.flash), alpha: it.alpha ?? 1 });
  }
  return F;
}

// A row of world-fixed stripes across the frame: the background a panning camera streaks.
export function stripes({ y, h, period, width, rgb, from = -400, to = 2400 }) {
  const out = [];
  for (let x = from; x < to; x += period) out.push({ x, y, w: width, h, vx: 0, vy: 0, rgb });
  return out;
}
