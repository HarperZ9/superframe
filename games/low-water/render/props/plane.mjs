// Flat things on a plane, for authored props: a sheet on a wall or lying on a table, its frame, its bounding box, and an
// image or text laid on it. Game-agnostic (positions, sizes and pictures are data). Original code (world-layers pass,
// 2026-10-23).
//   planeOf(c, face, a)  face "z" (a back wall, facing +z), "x" (a left wall, facing +x), "y" (lying flat, turned by a)
//                        -> { c, u, v, n }: u rightward on the sheet, v down the sheet, n out of it
//   local(P, F)          -> [lu, lv, ln] of a point in the sheet's frame
//   sheetBB(F, w, h, d)  a box holding a sheet of half sizes w/2, h/2 standing d off its plane
//   topLeft(F, w, h, m)  the corner a text kind starts from, with a margin m (metres)
//   imageKind(name, F, w, h, paint)  a surface kind: paint(s, t) with s, t in 0..1 across and down -> [material, tone]
import { kindL } from "./letters.mjs";
import { n3 } from "./noise.mjs";

export function planeOf(c, face = "z", a = 0) {
  if (face === "x") return { c, u: [0, 0, -1], v: [0, -1, 0], n: [1, 0, 0] };
  if (face === "y") return { c, u: [Math.cos(a), 0, -Math.sin(a)], v: [Math.sin(a), 0, Math.cos(a)], n: [0, 1, 0] };
  if (face === "-x") return { c, u: [0, 0, 1], v: [0, -1, 0], n: [-1, 0, 0] };
  return { c, u: [1, 0, 0], v: [0, -1, 0], n: [0, 0, 1] };
}
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const local = (P, F) => { const d = [P[0] - F.c[0], P[1] - F.c[1], P[2] - F.c[2]]; return [dot3(d, F.u), dot3(d, F.v), dot3(d, F.n)]; };
export function sheetBB(F, w, h, d = 0.03) {
  const e = [0, 1, 2].map((i) => Math.abs(F.u[i]) * (w / 2 + 0.03) + Math.abs(F.v[i]) * (h / 2 + 0.03) + Math.abs(F.n[i]) * (d + 0.02));
  const m = [0, 1, 2].map((i) => F.c[i] + F.n[i] * d / 2);
  return [m[0] - e[0], m[1] - e[1], m[2] - e[2], m[0] + e[0], m[1] + e[1], m[2] + e[2]];
}
export const topLeft = (F, w, h, m = 0.02) => [0, 1, 2].map((i) => F.c[i] - F.u[i] * (w / 2 - m) - F.v[i] * (h / 2 - m));
export function imageKind(name, F, w, h, paint, { grain = 0.1 } = {}) {
  return kindL(name, "lw paper", 1, 0.6, (P) => {
    const [lu, lv] = local(P, F), s = lu / w + 0.5, t = lv / h + 0.5, [mat, tone] = paint(Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, t)));
    return { mat, scale: tone * (1 - grain / 2 + grain * n3(P[0] * 70, P[1] * 70, P[2] * 70)), wet: 0, emit: null };
  });
}
// distance in 2D to a polyline of points [[x, y], ...]
export function seg2(px, py, pts) {
  let d = 1e9;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1], ex = bx - ax, ey = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey || 1)));
    d = Math.min(d, Math.hypot(px - ax - t * ex, py - ay - t * ey));
  }
  return d;
}
