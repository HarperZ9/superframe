// Re-projection: carry painted layers from one reference to another (an older age, another era's dress,
// a moved camera or key) through the form, not the picture. Every rendered pixel knows the point of the
// body it shows in the rest pose (G.loc) and its material; both are expressed in a head frame (the skin's
// centre and size) so a child's head and an old man's head line up. A new pixel takes the paint of the old
// pixel showing the same material at the nearest point (head frame for the face, stature for the body).
// Where the match is far or missing (a hat now, a collar changed, a face turned away before) the pixel is
// flagged: that region needs repainting.
import { IDS } from "./ids.mjs";
//   correspond(oldRef, newRef, { cell, tol }) -> { from: Int32Array (new -> old, -1), flags: Uint8Array }
//   warpLayer(L, corr, { dropFlagged }) -> { rgba, height }     pointMap(corr, oldW, w, h) -> (x, y) -> [x, y] | null
const has = (k, id) => IDS[k].includes(id);
export const classOf = (id) => (!id ? 0 : has("skin", id) || has("lip", id) ? 1 : has("eye", id) || has("white", id) ? 2 : has("hair", id) || has("brow", id) ? 3 : 100 + id);

// the head frame: centred between the eyes and scaled by their spacing (a hat, a collar or hair that
// covers skin does not move it); the skin's centre and spread when the eyes are not both in view
export function headFrame(G) {
  const eyes = [[0, 0, 0, 0], [0, 0, 0, 0]], skin = [0, 0, 0, 0]; let ex = 0, en = 0;
  for (let i = 0; i < G.w * G.h; i++) if (classOf(G.id[i]) === 2) { ex += G.loc[i * 3]; en++; }
  ex = en ? ex / en : 0;
  for (let i = 0; i < G.w * G.h; i++) {
    const cl = classOf(G.id[i]); if (cl !== 1 && cl !== 2) continue;
    const acc = cl === 2 ? eyes[G.loc[i * 3] < ex ? 0 : 1] : skin; for (let k = 0; k < 3; k++) acc[k] += G.loc[i * 3 + k]; acc[3]++;
  }
  if (eyes[0][3] > 3 && eyes[1][3] > 3) {
    const a = eyes[0].slice(0, 3).map((v) => v / eyes[0][3]), b = eyes[1].slice(0, 3).map((v) => v / eyes[1][3]), d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    if (d > 1e-4) return { c: a.map((v, k) => (v + b[k]) / 2), r: d * 1.6 };
  }
  if (!skin[3]) throw new Error("studio: re-projection needs a face in the reference");
  const c = skin.slice(0, 3).map((v) => v / skin[3]); let r2 = 0;
  for (let i = 0; i < G.w * G.h; i++) if (classOf(G.id[i]) === 1) for (let k = 0; k < 3; k++) r2 += (G.loc[i * 3 + k] - c[k]) ** 2;
  return { c, r: Math.sqrt(r2 / skin[3]) || 1 };
}
const keyOf = (cls, x, y, z) => ((cls * 4096 + (x & 4095)) * 4096 + (y & 4095)) * 4096 + (z & 4095);

// a point in the frame its class is matched in: the face, eyes and hair by the head frame (eyes apart),
// the clothes and the rest by the body (stature), so a child's coat lines up with the grown one's
function framer(ref) {
  const f = headFrame(ref.G), S = ref.meta?.stature || f.r * 16, G = ref.G;
  return (i, cl) => { const k = cl >= 100 ? S : f.r; return [(G.loc[i * 3] - f.c[0]) / k, (G.loc[i * 3 + 1] - f.c[1]) / k, (G.loc[i * 3 + 2] - f.c[2]) / k]; };
}
const cellOf = (cl, cell) => (cl >= 100 ? cell * 0.4 : cell);
function nearest(grid, PA, cl, p, cell, reach, lim) {
  const c = cellOf(cl, cell), gx = Math.floor(p[0] / c) + 2048, gy = Math.floor(p[1] / c) + 2048, gz = Math.floor(p[2] / c) + 2048; let best = -1, bd = lim;
  for (let dz = -reach; dz <= reach; dz++) for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
    const bucket = grid.get(keyOf(cl, gx + dx, gy + dy, gz + dz)); if (!bucket) continue;
    for (const j of bucket) { const d = (PA[j * 3] - p[0]) ** 2 + (PA[j * 3 + 1] - p[1]) ** 2 + (PA[j * 3 + 2] - p[2]) ** 2; if (d < bd) { bd = d; best = j; } }
  }
  return best;
}
// A pixel with a near match takes its paint; one whose nearest match is further (the form changed: a
// child's larger eyes, a longer jaw) still takes the paint but is flagged to check; one with no pixel of
// its material near at all (a hat, a new collar) is left to the new underpainting and flagged
export function correspond(oldRef, newRef, { cell = 0.05, tol = 1.6 } = {}) {
  const A = oldRef.G, B = newRef.G, na = framer(oldRef), nb = framer(newRef), grid = new Map(), PA = new Float32Array(A.w * A.h * 3);
  for (let i = 0; i < A.w * A.h; i++) {
    const cl = classOf(A.id[i]); if (!cl) continue; const p = na(i, cl), c = cellOf(cl, cell); PA.set(p, i * 3);
    const k = keyOf(cl, Math.floor(p[0] / c) + 2048, Math.floor(p[1] / c) + 2048, Math.floor(p[2] / c) + 2048);
    let b = grid.get(k); if (!b) grid.set(k, (b = [])); b.push(i);
  }
  const n = B.w * B.h, from = new Int32Array(n).fill(-1), flags = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const cl = classOf(B.id[i]); if (!cl) continue; const p = nb(i, cl), c = cellOf(cl, cell);
    let j = nearest(grid, PA, cl, p, cell, 1, (tol * c) ** 2);
    if (j < 0) { j = nearest(grid, PA, cl, p, cell, 3, (3 * tol * c) ** 2); flags[i] = 1; }
    from[i] = j;
  }
  // the ground: same place on the canvas (scaled), never flagged
  for (let i = 0; i < n; i++) if (!B.id[i]) { const x = i % B.w, y = (i / B.w) | 0, ox = Math.min(A.w - 1, Math.round((x * A.w) / B.w)), oy = Math.min(A.h - 1, Math.round((y * A.h) / B.h)); from[i] = A.id[oy * A.w + ox] ? -1 : oy * A.w + ox; }
  return { from, flags, oldW: A.w, oldH: A.h, w: B.w, h: B.h };
}

// dropFlagged: a flagged pixel shows the new underpainting rather than paint pulled from a far match
// (a child's eye stretched over a grown one reads worse than a clean place to repaint)
export function warpLayer(L, corr, { dropFlagged = true } = {}) {
  const n = corr.w * corr.h, rgba = new Float32Array(n * 4), height = L.height ? new Float32Array(n) : null;
  for (let i = 0; i < n; i++) {
    const j = corr.from[i]; if (j < 0 || (dropFlagged && corr.flags[i])) continue;
    for (let k = 0; k < 4; k++) rgba[i * 4 + k] = L.rgba[j * 4 + k];
    if (height) height[i] = L.height[j];
  }
  return { rgba, height };
}
// which flagged pixels matter: only where the old layers carried a person's paint near the same place
export function repaintMask(corr, paintedOld) {
  const out = new Uint8Array(corr.w * corr.h);
  for (let i = 0; i < out.length; i++) if (corr.flags[i]) {
    const x = Math.min(corr.oldW - 1, Math.round(((i % corr.w) * corr.oldW) / corr.w)), y = Math.min(corr.oldH - 1, Math.round((((i / corr.w) | 0) * corr.oldH) / corr.h));
    if (paintedOld[y * corr.oldW + x]) out[i] = 1;
  }
  return out;
}
// old canvas point -> new canvas point: the mean of the new pixels that took paint from near that old pixel
export function pointMap(corr, r = 3) {
  const sum = new Map();
  for (let i = 0; i < corr.from.length; i++) { const j = corr.from[i]; if (j < 0) continue; const s = sum.get(j) || [0, 0, 0]; s[0] += i % corr.w; s[1] += (i / corr.w) | 0; s[2]++; sum.set(j, s); }
  return (x, y) => {
    let sx = 0, sy = 0, n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const ox = Math.round(x) + dx, oy = Math.round(y) + dy; if (ox < 0 || oy < 0 || ox >= corr.oldW || oy >= corr.oldH) continue;
      const s = sum.get(oy * corr.oldW + ox); if (s) { sx += s[0] - dx * s[2] * (corr.w / corr.oldW); sy += s[1] - dy * s[2] * (corr.h / corr.oldH); n += s[2]; }
    }
    return n ? [sx / n, sy / n] : null;
  };
}
