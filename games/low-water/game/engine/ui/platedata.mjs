// What a plate camera reads from a plate once it is loaded, as pure functions, so the plate camera
// (ui/platecam.mjs) and its worker (ui/plateworker.mjs) compute the same:
//   occludeData(pj, pos, arena, basis, overhead) -> { s, gw, gh, D, up }   the occlusion test's data (ui/occlude.mjs)
//   plateGround(pj, pos, ids)                     -> arena                  the walking ground, props closed
//   mixInto(cv, layers, weights, lensCv)          the plate and its lens layers composed (from ui/platecam.mjs)
//   depthPlanes(pj, pos, arena, occ, step)        the plate's occluders in depth bands (multiplane, below)
import { depthOf, groundAt, hardenGround, GROUND_CELL } from "../world/plateworld.mjs";
import { plateArena } from "../combat/sim/plate.mjs";

// each geo sample's depth along the camera's axis, and the height of a point hanging more than overhead m
// over open floor (a lamp, a beam: it never hides a figure)
export function occludeData(pj, pos, arena, basis, OVERHEAD) {
  const s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s), n = gw * gh, D = new Float32Array(n), up = new Float32Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (!(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) || (x === 0 && y === 0 && z === 0)) { D[i] = Infinity; continue; }
    D[i] = depthOf(pj.camera, [x, y, z], basis);
    const g0 = arena ? groundAt(arena, x, z) : null; if (g0 != null && y - g0 > OVERHEAD) up[i] = y;   // hanging over open floor
  }
  return { s, gw, gh, D, up };
}

// the ground at quarter-metre cells, props closed and a body's margin kept (world/plateworld.mjs hardenGround)
export function plateGround(pj, pos, ids) {
  const arena = plateArena(pj, pos, ids, { datum: pj.datum || null, cell: GROUND_CELL });
  arena.collision = hardenGround(arena, pj, pos, ids, { margin: "soft" });
  return arena;
}

// plate + w * layers into a canvas: the additive layers by compositing, the signed fringe layer
// (centred on 128) by a pixel pass.
// With lensCv given, the additive layers go there instead (on black, shown with plus-lighter above the
// figures), so a lamp's streak and halo cross a person standing in front as they cross the painting:
// one lens over plate and people in every mode (LOOK-UNIFIED R5, author 2026-10-17 "one look").
export function mixInto(cv, L, w, lensCv = null) {
  cv.width = L.plate.naturalWidth || L.plate.width; cv.height = L.plate.naturalHeight || L.plate.height;   // an Image here, an ImageBitmap in the worker
  const g = cv.getContext("2d", { willReadFrequently: false });
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; g.drawImage(L.plate, 0, 0);
  if (lensCv) {
    lensCv.width = cv.width; lensCv.height = cv.height;
    const lg = lensCv.getContext("2d"); lg.globalCompositeOperation = "source-over"; lg.globalAlpha = 1; lg.fillStyle = "#000"; lg.fillRect(0, 0, lensCv.width, lensCv.height);
    lg.globalCompositeOperation = "lighter";
    for (const [k, wt] of [["streak", w.streak]]) {
      if (!L[k]) continue;
      for (let left = wt; left > 0.001; left -= 1) { lg.globalAlpha = Math.min(1, left); lg.drawImage(L[k], 0, 0); }
    }
    lg.globalCompositeOperation = "source-over"; lg.globalAlpha = 1;
  }
  // the halo (bloom round each lamp) and the flare (its star and core) stay in the plate, under the figures:
  // a lamp behind a head must not bloom over the face (harbour office, 2026-10-21); streaks are thin lines
  // and cross everything
  g.globalCompositeOperation = "lighter";
  for (const [k, wt] of lensCv ? [["flare", w.flare], ["halo", w.halo]] : [["flare", w.flare], ["streak", w.streak], ["halo", w.halo]]) {
    if (!L[k]) continue;
    for (let left = wt; left > 0.001; left -= 1) { g.globalAlpha = Math.min(1, left); g.drawImage(L[k], 0, 0); }
  }
  g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
  if (L.ca && w.ca > 0) {
    const c2 = new OffscreenCanvas(cv.width, cv.height), x2 = c2.getContext("2d"); x2.drawImage(L.ca, 0, 0);
    const C = x2.getImageData(0, 0, cv.width, cv.height).data, out = g.getImageData(0, 0, cv.width, cv.height), o = out.data;
    for (let i = 0; i < o.length; i += 4) { o[i] += w.ca * (C[i] - 128); o[i + 1] += w.ca * (C[i + 1] - 128); o[i + 2] += w.ca * (C[i + 2] - 128); }
    g.putImageData(out, 0, 0);
  }
}

// Multiplane, made from the plate and its geo buffer (design/state/perf.md): where the plate stands above the
// ground (walls, columns, arcades, posts, carts: whatever a person can pass behind), cut into bands `step`
// metres deep along the camera's axis. Each band is a mask of those pixels (opaque where an occluder stands),
// cropped to them. The people layer draws the far tier's cards into their own canvas and, going from far to
// near, erases each band from the cards deeper than it; what shows through is the plate as drawn, with its
// light and weather. Pixels on the ground (within 0.15 m of the walking grid) and with no geo sample are left out.
//   -> [{ d0, d1, x0, y0, w, h, data: Uint8ClampedArray (RGBA, alpha the mask) }] far to near, in plate pixels
export function depthPlanes(pj, pos, arena, occ, step = 1) {
  const W = pj.width, H = pj.height, s = occ.s, gw = occ.gw, gh = occ.gh, D = occ.D;
  let lo = Infinity, hi = -Infinity; const band = new Int32Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = Math.min(gw - 1, Math.floor(x * s)), gy = Math.min(gh - 1, Math.floor(y * s)), g = gy * gw + gx, d = D[g];
    if (!Number.isFinite(d)) continue;
    const py = pos[g * 3 + 1], h0 = arena ? groundAt(arena, pos[g * 3], pos[g * 3 + 2]) : null;
    if (h0 != null && Math.abs(py - h0) < 0.15) continue;   // ground: people stand on it, it never covers them
    band[y * W + x] = 1; if (d < lo) lo = d; if (d > hi) hi = d;
  }
  if (!(hi >= lo)) return [];
  const n = Math.floor((hi - lo) / step) + 1, box = Array.from({ length: n }, () => [W, H, -1, -1]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (band[i] < 0) continue;
    const g = Math.min(gh - 1, Math.floor(y * s)) * gw + Math.min(gw - 1, Math.floor(x * s)), k = Math.min(n - 1, Math.floor((D[g] - lo) / step)), b = box[k];
    band[i] = k; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
  }
  const out = [];
  for (let k = n - 1; k >= 0; k--) {
    const [x0, y0, x1, y1] = box[k]; if (x1 < 0) continue;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, data = new Uint8ClampedArray(w * h * 4);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * W + x; if (band[i] !== k) continue;
      data[((y - y0) * w + (x - x0)) * 4 + 3] = 255;
    }
    out.push({ d0: lo + k * step, d1: lo + (k + 1) * step, x0, y0, w, h, data });
  }
  return out;
}
