// Surface kinds for authored props: each is registered into kit/ids.mjs's tables on import (appended after the
// shared ids, so no other place's ids move) and carries a detail function that turns a hit point and normal into
// a material, a scale and a tone. Strands, grain, crust and weave are decided here, per hit point, from the
// world position; the painter then follows the structure these give it. Original code (2026-10-23).
import { KIND, ID, BY_ID } from "../kit/ids.mjs";
import { n3, fb3, hash, sstep } from "./noise.mjs";

let next = BY_ID.length;
const kind = (name, mat, scale, tone, detail) => { if (ID[name]) return; const k = { id: next++, name, mat, scale, wet: 0, tone, cls: 2, flags: "", emit: null, detail }; KIND[name] = k; ID[name] = k.id; BY_ID[k.id] = k; };
const S = (mat, scale) => ({ mat, scale, wet: 0, emit: null });
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Straw: bands about 1.8 cm wide run along a direction that swirls slowly over the surface; each band breaks into
// 10 cm lengths of its own tone. Three tones: brown-tan, pale sand, gold (gold is the rare one, for restraint).
function straw(P, N, dirAt, wide = 55) {
  const a = Math.abs(N[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], t1 = nrm(cross(N, a)), t2 = cross(N, t1);
  const th = dirAt ? dirAt(P) : 6.283 * fb3(P[0] * 0.8, P[1] * 0.8, P[2] * 0.8);
  const dir = [Math.cos(th) * t1[0] + Math.sin(th) * t2[0], Math.cos(th) * t1[1] + Math.sin(th) * t2[1], Math.cos(th) * t1[2] + Math.sin(th) * t2[2]], per = cross(N, dir);
  const s = dot(P, per) * wide, i = Math.floor(s), al = dot(P, dir) * 9, v = hash(i, Math.floor(al + hash(i, 3, 1) * 6), 5), edge = Math.abs(s - i - 0.5);
  return { v, edge, shade: 0.7 + 0.5 * hash(i, 9, 2) };
}
const strawMat = (v, edge, shade, gold = 0.22) => { if (edge > 0.42) return S("lw rope", 0.22); return v < 0.25 ? S("lw rope", 0.5 * shade) : v < 1 - gold ? S("lw bone", 0.58 * shade + 0.08) : S("lw mustard", 0.42 * shade); };

kind("hay", "lw sand", 1, 0.55, (P, N) => { const s = straw(P, N, null, 55); const m = strawMat(s.v, s.edge, s.shade); m.scale *= 0.55 + 0.7 * fb3(P[0] * 2.2, P[1] * 2.2, P[2] * 2.2); return m; });
// bale: long straw along x on the sides and top; the cut ends (normal along x) are a dense pale speckle
kind("bale", "lw sand", 1, 0.55, (P, N) => {
  if (Math.abs(N[0]) > 0.7) { const v = hash(Math.floor(P[1] * 70), Math.floor(P[2] * 70), 11), s = v < 0.3 ? S("lw rope", 0.55) : v < 0.85 ? S("lw sand", 1.05) : S("lw mustard", 0.8); s.scale *= 0.7 + 0.5 * n3(P[1] * 9, P[2] * 9, 2); return s; }
  const s = straw(P, N, () => 0, 21); const m = strawMat(s.v, s.edge * 0.8, s.shade, 0.18); m.scale *= 0.36 + 0.36 * fb3(P[0] * 1.7, P[1] * 3, P[2] * 1.7); return m;
});
// stalk: vertical straw for sheaves and corn dollies; the ears (gold) are a separate kind
kind("stalk", "lw sand", 1, 0.55, (P, N) => { const s = straw(P, N, () => 1.5708, 120); return strawMat(s.v, s.edge * 0.9, s.shade, 0.3); });
kind("ear", "lw sand", 0.5, 0.6, (P) => { const v = hash(Math.floor(P[0] * 150), Math.floor(P[1] * 150), Math.floor(P[2] * 150)); return v < 0.45 ? S("lw rope", 0.32) : S("lw sand", 0.3 + 0.12 * v); });
// chaff on the boards: dark boards with scattered straw bits, walkable like the floor it lies on
kind("chaff", "lw wood", 0.7, 0.4, (P) => {
  const g = Math.floor(P[0] * 14), h = Math.floor(P[2] * 14), r = hash(g, h, 3), ang = hash(g, h, 4) * 6.283, fx = P[0] * 14 - g - 0.5, fz = P[2] * 14 - h - 0.5, al = fx * Math.cos(ang) + fz * Math.sin(ang), pe = -fx * Math.sin(ang) + fz * Math.cos(ang);
  if (r < 0.32 && Math.abs(al) < 0.48 && Math.abs(pe) < 0.07) return S("lw sand", 0.9 + 0.4 * hash(g, h, 6));
  const seam = (P[2] / 0.19) % 1; return S("lw rope", 0.3 * (seam < 0.05 ? 0.35 : 0.65 + 0.35 * hash(Math.floor(P[2] / 0.19), Math.floor(P[0] / 1.7), 1)) * (0.8 + 0.4 * fb3(P[0] * 3, 0, P[2] * 3)));
});
// wood: grain runs along the axis; rings wobble with noise; weathered boards go silver-grey and dry
function wood(P, N, ax, grey, tone) {
  const o = [0, 1, 2].filter((i) => i !== ax), ac = Math.abs(N[o[0]]) < Math.abs(N[o[1]]) ? o[0] : o[1], al = P[ax], cr = P[ac];
  const g = n3(cr * 16 + 6 * n3(al * 1.5, cr * 3, 1), al * 0.8, P[3 - ax - ac] * 4), ring = 0.5 + 0.5 * Math.sin(cr * 42 + 9 * g), fine = n3(cr * 90, al * 5, 3);
  const knot = sstep(0.93, 1, n3(al * 2.1, cr * 2.1, 9)), t = (0.62 + 0.4 * ring + 0.18 * fine - 0.35 * knot) * tone;
  if (grey) return fine < 0.16 ? S("lw rope", 0.22 * tone) : fine > 0.55 ? S("lw canvas", 0.3 * tone) : S("lw rope", t * 0.25);
  return S("lw rope", t * 0.72);
}
for (const [nm, ax] of [["oakx", 0], ["oaky", 1], ["oakz", 2]]) kind(nm, "lw wood", 1, 0.42, (P, N) => wood(P, N, ax, false, 1.0));
for (const [nm, ax] of [["greyx", 0], ["greyy", 1], ["greyz", 2]]) kind(nm, "lw wood", 1, 0.42, (P, N) => wood(P, N, ax, true, 1.15));
kind("beamoak", "lw wood", 0.6, 0.3, (P, N) => { const m = wood(P, N, Math.abs(N[0]) > 0.7 ? 2 : 0, false, 0.78); m.scale *= 0.8 + 0.3 * fb3(P[0] * 5, P[1] * 5, P[2] * 5); return m; });
// bread crust: gold-brown top, darker base, flour dust in pale patches; the split along the score is geometry
kind("crust", "lw rust", 1, 0.5, (P, N) => {
  const f = fb3(P[0] * 24, P[1] * 24, P[2] * 24), dust = sstep(0.55, 0.7, fb3(P[0] * 9 + 3, P[1] * 9, P[2] * 9)) * (N[1] > 0.3 ? 1 : 0.2);
  if (dust > 0.5) return S("lw bone", 0.55 + 0.25 * f); const top = sstep(0.1, 0.8, N[1]);
  return f < 0.35 ? S("lw rust", 0.5 + 0.35 * top) : S("lw mustard", 0.4 + 0.3 * top + 0.2 * f);
});
kind("crumb", "lw bone", 0.55, 0.7, (P) => S("lw sand", 0.7 + 0.35 * n3(P[0] * 60, P[1] * 60, P[2] * 60)));
// linen: a faint weave and a brighter nap along the folds; slightly yellowed
kind("cloth", "lw bone", 0.85, 0.75, (P) => { const w = 0.5 + 0.5 * Math.sin(P[0] * 520) * Math.sin(P[2] * 520 + P[1] * 300), a = n3(P[0] * 4, P[1] * 6, P[2] * 4); return S("lw canvas", 0.15 + 0.04 * w + 0.07 * a); });
kind("clay", "lw rust", 0.6, 0.35, (P) => S("lw rust", 0.42 + 0.35 * fb3(P[0] * 14, P[1] * 14, P[2] * 14)));
kind("pewter", "metal", 0.85, 0.5, (P) => S("metal", 0.3 + 0.16 * fb3(P[0] * 20, P[1] * 20, P[2] * 20)));
kind("leather", "lw rope", 0.5, 0.35, (P) => S("lw wood", 0.4 + 0.35 * fb3(P[0] * 30, P[1] * 30, P[2] * 30)));
kind("fruit", "lw mustard", 0.7, 0.5, (P) => { const f = fb3(P[0] * 30, P[1] * 30, P[2] * 30); return f < 0.4 ? S("lw weed", 0.55) : S("lw mustard", 0.55 + 0.4 * f); });
kind("wicker", "lw wood", 0.8, 0.4, (P) => { const a = 0.5 + 0.5 * Math.sin(P[0] * 130 + 4 * n3(P[2] * 5, 0, 0)) * Math.sin(P[2] * 130); return S("lw rope", 0.45 + 0.5 * a); });
kind("web", "lw bone", 0.8, 0.8, () => S("lw bone", 0.8));

// mill kinds (appended last so earlier ids stay put): sackcloth with a coarse weave, stitching and flour dust; grain
kind("sackcloth", "lw canvas", 0.5, 0.6, (P, N) => {
  const w = 0.5 + 0.5 * Math.sin(P[0] * 210 + P[1] * 40) * Math.sin(P[2] * 210 + P[1] * 190), st = Math.abs(((P[1] * 5) % 1) - 0.5), dust = sstep(0.5, 0.75, fb3(P[0] * 7, P[1] * 5, P[2] * 7)) * (0.4 + 0.6 * Math.max(0, N[1]));
  if (dust > 0.6) return S("lw bone", 0.62); return S(st < 0.04 ? "lw rope" : "lw canvas", 0.5 + 0.14 * w + 0.22 * fb3(P[0] * 3, P[1] * 3, P[2] * 3));
});
kind("grain", "lw mustard", 0.5, 0.6, (P) => { const v = hash(Math.floor(P[0] * 120), Math.floor(P[1] * 120), Math.floor(P[2] * 120)); return v < 0.5 ? S("lw sand", 0.5) : v < 0.85 ? S("lw mustard", 0.4) : S("lw rope", 0.3); });
// the surf wrapper: a place's surface function that knows these kinds
export const withDetail = (surf) => (id, P, N, V) => { const k = BY_ID[id]; return k && k.detail ? k.detail(P, N, V) : surf(id, P, N, V); };
export { ID };
