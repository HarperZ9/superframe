// What makes one hero house differ from the next, so the street reads as a town that grew over
// years: a style (tarred boards, cedar, plaster in a timber frame, or plaster below and boards
// above), a jettied upper floor, dormers, a porch, a balcony, a shed beside it, a run of fence,
// a gable window, and the lean and sag of an old frame. Each takes the house context T, its frame f
// and its sizes; all are drawn from the house's own seed.
import { put, dir } from "../kit.mjs";
import { snowPillow } from "./hparts.mjs";

export function chooseStyle(R, age) {
  const k = R();
  const style = k < 0.38 ? "boards" : k < 0.58 ? "cedar" : k < 0.8 ? "framed" : "mixed";
  return {
    style, roofMat: R() < 0.72 ? "shingle" : "iron", ov: 0.35 + 0.6 * R(),
    jetty: R() < 0.35, dormers: R() < 0.45 ? 1 + Math.floor(R() * 2) : 0, porch: R() < 0.4, balcony: R() < 0.3,
    shed: R() < 0.4, fence: R() < 0.45, gableWindow: R() < 0.7, lean: (R() - 0.5) * 0.02 * (0.5 + age), sag: 0.03 + 0.09 * age * R(),
  };
}

// studs, rails and braces of a timber-framed wall over its plaster, in the wall's plane z (facing +z)
export function halfTimber(T, f, a, b, z, y0, y1, top) {
  const { M, R } = T, B = (x0, yy0, x1, yy1) => M.bbox("timber", f, x0, yy0, z, x1, yy1, z + 0.045, 0.01, 1, [R() * 9, R() * 9]);
  const n = Math.max(2, Math.round((b - a) / 1.1));
  for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; B(x - 0.06, y0, x + 0.06, Math.min(y1, top(x))); }
  for (const y of [y0, (y0 + y1) / 2]) B(a, y, b, y + 0.12);
  // a brace in each end bay, a long timber turned on the diagonal
  for (const [x0, x1] of [[a, a + (b - a) / n], [b, b - (b - a) / n]]) {
    const p = put(f, [x0, y0 + 0.15, z + 0.03]), q = put(f, [x1, (y0 + y1) / 2, z + 0.03]);
    M.tube("timber", [p, q], 0.055, 4);
  }
}

// a dormer through the front slope: a box with a window, its own little gable roof and snow
export function dormer(T, f, x, D, hw, pitch, windowAt) {
  const { M, R } = T, w = 1.4 + 0.4 * R(), z0 = D * 0.25, y0 = hw + (D - z0) * Math.tan(pitch) - 0.35, h = 1.25, zf = D * 0.62;
  M.bbox("boards", f, x - w / 2, y0, z0, x + w / 2, y0 + h, zf, 0.01, 1, [R() * 9, R() * 9]);
  windowAt(T, f, x, y0 + 0.25, w * 0.55, h * 0.6, zf, 1, R() < 0.6, 2, 2);
  const ry = y0 + h, rr = w / 2 + 0.2, apex = ry + 0.6;
  for (const sx of [-1, 1]) {
    const a = put(f, [x + sx * rr, ry, zf + 0.25]), b = put(f, [x + sx * rr, ry, z0]), c = put(f, [x, apex, z0]), d = put(f, [x, apex, zf + 0.25]);
    M.quad("shingle", a, b, c, d);
    // snow on each little slope
    M.grid("snow", (s, t) => { const p = [x + sx * rr * (1 - t) * 1.02, ry + (apex - ry) * t + 0.12 + 0.06 * Math.sin(s * 9 + x), zf + 0.3 - (zf - z0 + 0.3) * s]; return put(f, p); }, 8, 4, (s, t) => [s * 2, t]);
  }
}

// a porch: a roof on two posts before the door, a board floor and a step, snow on its roof
export function porch(T, f, x, D) {
  const { M, R } = T, w = 2.4 + R(), d = 1.5 + 0.4 * R(), h = 2.55;
  for (const sx of [-1, 1]) M.bbox("timber", f, x + sx * w / 2 - 0.07, 0.45, D + d - 0.14, x + sx * w / 2 + 0.07, h, D + d, 0.015);
  M.bbox("timber", f, x - w / 2 - 0.1, 0.4, D, x + w / 2 + 0.1, 0.55, D + d, 0.01, 1, [R() * 9, 0]);
  M.bbox("timber", f, x - w / 2 - 0.15, h, D, x + w / 2 + 0.15, h + 0.12, D + d + 0.1, 0.012);
  M.bbox(T.roofMat || "shingle", f, x - w / 2 - 0.25, h + 0.12, D, x + w / 2 + 0.25, h + 0.18, D + d + 0.3, 0.01);
  snowPillow(T, f, x - w / 2 - 0.25, D, x + w / 2 + 0.25, D + d + 0.3, h + 0.18, 0.28 + 0.15 * R(), 0.08);
}

// a balcony on the upper floor: a deck on brackets, a railing of balusters, snow along its rail
export function balcony(T, f, x, y, D) {
  const { M, R } = T, w = 2.2 + 0.8 * R(), d = 0.85;
  M.bbox("timber", f, x - w / 2, y - 0.1, D, x + w / 2, y, D + d, 0.01, 1, [R() * 9, 0]);
  for (const sx of [-1, 1]) M.tube("timber", [put(f, [x + sx * (w / 2 - 0.1), y - 0.9, D + 0.02]), put(f, [x + sx * (w / 2 - 0.1), y - 0.05, D + d - 0.1])], 0.05, 4);
  for (let px = x - w / 2 + 0.05; px <= x + w / 2 - 0.04; px += 0.14) M.bbox("timber", f, px - 0.02, y, D + d - 0.06, px + 0.02, y + 0.9, D + d - 0.02, 0.005);
  for (const sx of [-1, 1]) for (let pz = D + 0.1; pz < D + d - 0.05; pz += 0.14) M.bbox("timber", f, x + sx * (w / 2 - 0.04) - 0.02, y, pz - 0.02, x + sx * (w / 2 - 0.04) + 0.02, y + 0.9, pz + 0.02, 0.005);
  M.bbox("timber", f, x - w / 2, y + 0.9, D + d - 0.08, x + w / 2, y + 0.97, D + d, 0.01);
  snowPillow(T, f, x - w / 2, D + d - 0.08, x + w / 2, D + d, y + 0.97, 0.07, 0.015);
  snowPillow(T, f, x - w / 2 + 0.05, D + 0.05, x + w / 2 - 0.05, D + d - 0.1, y, 0.12, 0.0);
}

// a shed against the gable end: plank walls, a lean-to roof of tin or boards, a door, snow on top
export function shed(T, f, side, W, D) {
  const { M, R } = T, w = 1.8 + R(), d = Math.min(2 * D - 1, 2.0 + R()), h0 = 2.2, h1 = 1.6, x0 = side > 0 ? W + 0.25 : -W - 0.25 - w, x1 = x0 + w, z0 = -d / 2 + (R() - 0.5);
  M.bbox("cedar", f, x0, 0.1, z0, x1, h1, z0 + d, 0.01, 1, [R() * 9, R() * 9]);
  const hi = side > 0 ? x0 : x1, lo = side > 0 ? x1 : x0;
  const a = put(f, [hi, h0 + 0.05, z0 - 0.25]), b = put(f, [hi, h0 + 0.05, z0 + d + 0.25]), c = put(f, [lo + side * 0.3, h1 - 0.1, z0 + d + 0.25]), e = put(f, [lo + side * 0.3, h1 - 0.1, z0 - 0.25]);
  M.quad(R() < 0.5 ? "iron" : "timber", a, b, c, e);
  M.grid("snow", (s, t) => { const x = hi + (lo + side * 0.3 - hi) * t, y = h0 + 0.05 + (h1 - 0.1 - h0 - 0.05) * t, z = z0 - 0.25 + (d + 0.5) * s, th = 0.22 * Math.sqrt(Math.max(0, Math.min(s, 1 - s, t, 1 - t) * 6)) * (0.8 + 0.2 * Math.sin(z * 3 + x)); return put(f, [x, y + 0.03 + th, z]); }, 10, 6, (s, t) => [s * 2, t * 2]);
  M.bbox("timber", f, x0 + w * 0.3, 0.1, z0 + d - 0.02, x0 + w * 0.3 + 0.8, 1.45, z0 + d + 0.03, 0.01);
}

// a run of picket fence from the front corner along the lane, its pickets capped with snow
export function fence(T, f, side, W, D) {
  const { M, R } = T, x0 = side * (W + 0.2), x1 = side * (W + 1.6 + 1.6 * R()), z = D + 0.6 + 0.4 * R(), lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  for (const y of [0.45, 1.0]) M.bbox("timber", f, lo, y, z, hi, y + 0.07, z + 0.04, 0.008);
  for (let x = lo; x <= hi; x += 0.16) {
    const ht = 1.15 + 0.06 * (R() - 0.5), tilt = (R() - 0.5) * 0.03;
    M.bbox("cedar", f, x - 0.035, 0.0, z + 0.04, x + 0.035, ht, z + 0.065, 0.006, 1, [R() * 9, R() * 9]);
    M.lathe("snow", put(f, [x + tilt, ht, z + 0.052]), [[0.045, 0], [0.035, 0.03], [0.01, 0.045]], 6);
  }
  for (const x of [lo, hi]) M.bbox("timber", f, x - 0.06, -0.3, z - 0.02, x + 0.06, 1.3, z + 0.1, 0.012);
}

// The lean and sag of an old frame: every vertex the house added moves by the lean along its turn,
// growing with height, and the ridge line dips in the middle.
export function settle(M, mark, f, st, hw, W) {
  for (const [name, k] of M.b) {
    const from = mark.get(name) || 0;
    for (let i = from; i < k.pos.length; i += 3) {
      const lx = (k.pos[i] - f.o[0]) * f.c - (k.pos[i + 2] - f.o[2]) * f.s, hy = k.pos[i + 1] - f.o[1];
      const lean = st.lean * Math.max(0, hy), sag = hy > hw ? st.sag * (1 - Math.min(1, (lx / (W + 0.5)) ** 2)) * Math.min(1, (hy - hw) / 1.5) : 0;
      const d = dir(f, [lean, 0, 0]);
      k.pos[i] += d[0]; k.pos[i + 2] += d[2]; k.pos[i + 1] -= sag;
    }
  }
}
export const mark = (M) => new Map([...M.b].map(([n, k]) => [n, k.pos.length]));
