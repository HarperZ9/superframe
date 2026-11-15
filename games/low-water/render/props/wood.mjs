// Carpentry props: board walls with grooves and through-gaps, framing (posts, beams, braces, rafters), trestle tables,
// benches, the barn doors, the hatch and ladder, barrels, buckets, stools. Grain comes from kinds.mjs; the geometry here
// carries board seams, bevels, wane, pegs and wear. Original code (2026-10-23).
import { prop, bbc, bbr, rot, box, cyl, cap, ell, slab, lathe, chain, n3, fb3, hash, sstep, ID, sat } from "./prim.mjs";

// Distance to a vertical-board wall. u: coordinate along the wall, y: height, w: depth from the wall's mid plane.
// Boards bw wide with a groove; with gapFrac > 0 some seams are through-gaps `gap` wide that let light pass.
export function boardWall(u, y, w, { hu, y0 = 0, y1, th = 0.05, bw = 0.2, gap = 0, gapFrac = 0, seed = 1, dir = 1 }) {
  const k = Math.floor(u / bw), fu = u / bw - k, bu = Math.min(fu, 1 - fu) * bw, off = (hash(k, seed, 2) - 0.5) * 0.014, warp = 0.006 * Math.sin(y * 3 + k);
  let d = Math.max(Math.abs(u) - hu, Math.abs(y - (y0 + y1) / 2) - (y1 - y0) / 2, Math.abs(w - off - warp) - th) + 0.012 * (1 - sat(bu / 0.018)) * 0.9;
  if (gapFrac > 0 && hash(k, seed, 7) < gapFrac) d = Math.max(d, -(gap * (0.6 + 0.8 * hash(k, seed, 8)) / 2 - bu) * 0.9);
  return d - (n3(u * 13, y * 3, w * 13) - 0.5) * 0.006 * 0.0;
}
// A brace or a rafter: a slightly squared member from a to b, radius r, with wane and adze marks.
export function brace(a, b, r, name = "brace", id = ID.beamoak) {
  const bb = [Math.min(a[0], b[0]) - r - 0.05, Math.min(a[1], b[1]) - r - 0.05, Math.min(a[2], b[2]) - r - 0.05, Math.max(a[0], b[0]) + r + 0.05, Math.max(a[1], b[1]) + r + 0.05, Math.max(a[2], b[2]) + r + 0.05];
  return prop(name, bb, (x, y, z, T) => T((cap(x, y, z, a, b, r) * 0.9) - (fb3(x * 9, y * 9, z * 9) - 0.5) * 0.01, id));
}
// An axis beam, the common case: centre c, half sizes h, grain along its long axis.
export function timber(name, c, h, id = ID.beamoak, wane = 0.012) {
  return prop(name, bbc(c[0], c[1], c[2], h[0] + 0.05, h[1] + 0.05, h[2] + 0.05), (x, y, z, T) => T(slab(x, y, z, c, h, 0.014) - (fb3(x * 9, y * 9, z * 9) - 0.5) * wane, id));
}
// A trestle table: top of boards with seams and a split, two A-frame trestles with a stretcher, wear along the edges.
export function trestleTable(cx, cz, hx, hz, { h = 0.76, name = "trestle_table", seed = 1 } = {}) {
  return prop(name, bbc(cx, h / 2, cz, hx + 0.08, h / 2 + 0.03, hz + 0.1), (x, y, z, T) => {
    const dz = z - cz, k = Math.floor((dz + hz) / 0.19), fu = (dz + hz) / 0.19 - k, bu = Math.min(fu, 1 - fu) * 0.19;
    const top = Math.max(slab(x, y, z, [cx, h - 0.025, cz], [hx, 0.025, hz], 0.008), -(0.004 - bu) * 0.5 * 0 - 0) + 0.003 * (1 - sstep(0, 0.006, bu)) - (n3(x * 6, k, seed) - 0.5) * 0.004;
    T(top, ID.oakx);
    const nT = Math.max(2, Math.round(hx / 0.9) + 1);
    for (let i = 0; i < nT; i++) {
      const tx = cx - hx + 0.28 + (2 * hx - 0.56) * i / (nT - 1);
      for (const s of [-1, 1]) T(cap(x, y, z, [tx, h - 0.05, cz + s * (hz - 0.1)], [tx + 0.03 * s * 0, 0.0, cz + s * (hz + 0.12)], 0.034) * 0.9, ID.oaky);
      T(box(x, y, z, tx, h - 0.075, cz, 0.04, 0.025, hz - 0.08), ID.oakz);
    }
    T(slab(x, y, z, [cx, 0.28, cz], [hx - 0.25, 0.03, 0.035], 0.008), ID.oakx);
    for (let i = 0; i < nT; i++) { const tx = cx - hx + 0.28 + (2 * hx - 0.56) * i / (nT - 1); T(cyl(x, y, z, tx, 0.28, cz, 0.012, 0.06) * 0 + box(x, y, z, tx, 0.28, cz, 0.012, 0.06, 0.012), ID.oaky); }
  });
}
// A bench: a thick seat plank on two cut-out end boards, a stretcher pinned between them.
export function bench(cx, cz, hx, { h = 0.44, name = "bench", seed = 1, side = 1, id = ID.oakx } = {}) {
  return prop(name, bbc(cx, h / 2, cz, hx + 0.05, h / 2 + 0.03, 0.2), (x, y, z, T) => {
    T(slab(x, y, z, [cx, h - 0.022, cz], [hx, 0.022, 0.15], 0.008) - (fb3(x * 6, y * 6, z * 6) - 0.5) * 0.006, id);
    for (const s of [-1, 1]) { const ex = cx + s * (hx - 0.18); let d = slab(x, y, z, [ex, (h - 0.044) / 2, cz], [0.022, (h - 0.044) / 2, 0.13], 0.006); d = Math.max(d, -cyl(z, y, x, cz, 0.04 + h * 0.5, ex, 0.07 * 0 + 0.09, 0.1) * 0, -(Math.hypot(z - cz, y - 0.02) < 0.06 ? 0.01 : -1)); T(d, id); }
    T(slab(x, y, z, [cx, 0.17, cz], [hx - 0.2, 0.014, 0.024], 0.005), id);
    void seed; void side;
  });
}
// A three-legged stool with a worn round seat.
export function stool(x, z, { h = 0.42, name = "milking_stool" } = {}) {
  return prop(name, bbc(x, h / 2, z, 0.22, h / 2 + 0.02, 0.22), (px, py, pz, T) => {
    T(Math.max(cyl(px, py, pz, x, h - 0.02, z, 0.15, 0.02) , 0) - (n3(px * 12, 0, pz * 12) - 0.5) * 0.004, ID.oaky);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.4; T(cap(px, py, pz, [x + Math.cos(a) * 0.09, h - 0.03, z + Math.sin(a) * 0.09], [x + Math.cos(a) * 0.17, 0, z + Math.sin(a) * 0.17], 0.017), ID.oaky); }
  });
}
// A staved barrel, standing or on its side on a cradle: bulge, iron hoops, stave seams, a bung and tap.
export function barrel(x, y, z, { r = 0.3, h = 0.85, lying = false, a = 0, tap = false, name = "barrel" } = {}) {
  const bb = lying ? bbr(x, y, z, h / 2 + 0.1, y + 2 * r + 0.1, r + 0.1) : bbr(x, y, z, r + 0.08, y + h + 0.05, r + 0.08);
  return prop(name, bb, (px, py, pz, T) => {
    let lx, ly, lz; if (lying) { const [rx, rz] = rot(px, pz, x, z, a); lx = rz - z; ly = py - y - r - 0.0; lz = rx - x; } else { lx = px - x; ly = py - y - h / 2; lz = pz - z; }
    const hh = lying ? h : h, t = ly / (hh / 2), rad = lying ? Math.hypot(lx, ly) : Math.hypot(lx, lz), ang = lying ? Math.atan2(ly, lx) : Math.atan2(lz, lx);
    const ax = lying ? lz : ly, tt = ax / (hh / 2), bulge = r * (1 + 0.1 * (1 - tt * tt)), stave = 0.004 * Math.abs(Math.sin(ang * 12));
    let d = Math.max((rad - bulge + stave) * 0.9, Math.abs(ax) - hh / 2); void t;
    T(d, lying ? ID.oakz : ID.oaky);
    for (const k of [-0.74, -0.42, 0.42, 0.74]) { const hr = r * (1 + 0.1 * (1 - (k * hh / 2 / (hh / 2)) ** 2)); T(Math.max(Math.abs(rad - hr - 0.004) - 0.006, Math.abs(ax - k * hh / 2) - 0.022), ID.iron); }
    if (tap) { const [tx, tz] = [x, z]; void tz; T(cap(px, py, pz, [tx - 0.0, y + (lying ? r : 0.25), z - r - 0.0], [tx, y + (lying ? r : 0.25) - 0.02, z - r - 0.1], 0.013), ID.brass); }
  });
}
// A wooden bucket with a rope bail and a tilt of water-darkened staves.
export function bucket(x, y, z, { name = "wood_bucket", s = 1 } = {}) {
  return prop(name, bbc(x, y + 0.15 * s, z, 0.2 * s, 0.24 * s, 0.2 * s), (px, py, pz, T) => {
    const ang = Math.atan2(pz - z, px - x);
    let d = lathe(px, py, pz, x, y, z, y + 0.26 * s, (t) => s * (0.14 + 0.05 * t) + 0.003 * Math.abs(Math.sin(ang * 10))); d = Math.max(d, -cyl(px, py, pz, x, y + 0.31 * s, z, 0.17 * s, 0.26 * s)); T(d, ID.oaky);
    for (const k of [0.2, 0.75]) T(Math.max(Math.abs(Math.hypot(px - x, pz - z) - s * (0.14 + 0.05 * k) - 0.004) - 0.005, Math.abs(py - y - 0.26 * s * k) - 0.012), ID.iron);
    T(chain(px, py, pz, [[x - 0.19 * s, y + 0.26 * s, z], [x - 0.12 * s, y + 0.4 * s, z], [x + 0.12 * s, y + 0.4 * s, z], [x + 0.19 * s, y + 0.26 * s, z]], 0.006), ID.rope);
  });
}
// A ladder: two rails and rungs let into them, set at a lean about z. from/to are foot and head positions.
export function ladder(foot, head, name = "ladder", width = 0.46, rungs = 9) {
  const bb = [Math.min(foot[0], head[0]) - width, Math.min(foot[1], head[1]) - 0.05, Math.min(foot[2], head[2]) - 0.1, Math.max(foot[0], head[0]) + width, Math.max(foot[1], head[1]) + 0.1, Math.max(foot[2], head[2]) + 0.1];
  return prop(name, bb, (x, y, z, T) => {
    for (const s of [-1, 1]) { const a = [foot[0] + s * width / 2, foot[1], foot[2]], b = [head[0] + s * width / 2, head[1], head[2]]; T(cap(x, y, z, a, b, 0.026) * 0.9 - (n3(x * 9, y * 3, z * 9) - 0.5) * 0.006, ID.oaky); }
    for (let i = 0; i < rungs; i++) { const t = (i + 0.7) / (rungs + 0.4), p = [foot[0] + (head[0] - foot[0]) * t, foot[1] + (head[1] - foot[1]) * t, foot[2] + (head[2] - foot[2]) * t]; T(cap(x, y, z, [p[0] - width / 2 - 0.02, p[1], p[2]], [p[0] + width / 2 + 0.02, p[1], p[2]], 0.017), ID.oakx); }
  });
}
// A leaf of a door: planks with seams, three battens and strap hinges; pivots about the hinge post a given angle.
export function doorLeaf(hinge, wdt, hgt, ang, { name = "plank_door", seed = 1, z0 = 0 } = {}) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return prop(name, bbc(hinge[0] + (wdt / 2) * c, hinge[1] + hgt / 2, hinge[2] + (wdt / 2) * s, wdt / 2 + 0.2, hgt / 2 + 0.05, wdt / 2 + 0.2), (x, y, z, T) => {
    const dx = x - hinge[0], dz = z - hinge[2], u = dx * c + dz * s, w = -dx * s + dz * c + z0;
    T(boardWall(u - wdt / 2, y, w, { hu: wdt / 2, y0: hinge[1], y1: hinge[1] + hgt, th: 0.035, bw: 0.17, seed }), ID.greyy);
    for (const k of [0.15, 0.5, 0.85]) T(slab(u, y, w, [wdt / 2, hinge[1] + hgt * k, 0.05], [wdt / 2 - 0.02, 0.055, 0.016], 0.004), ID.beamoak);
    for (const k of [0.15, 0.85]) T(box(u, y, w, wdt * 0.38, hinge[1] + hgt * k, 0.068, wdt * 0.38, 0.03, 0.004), ID.iron);
  });
}
// A hatch lid standing open on its hinge: a framed board panel.
export const hatchLid = (x, y, z, w, d, ang) => prop("hatch_lid", bbc(x, y + 0.3, z, w, 0.5, d), (px, py, pz, T) => {
  const c = Math.cos(ang), s = Math.sin(ang), dz = pz - z, dy = py - y, u = dz * c + dy * s, v = -dz * s + dy * c;
  T(boardWall(px - x, u, v, { hu: w / 2, y0: 0, y1: d, th: 0.025, bw: 0.14, seed: 4 }) * 1, ID.greyz);
});
void ell; void bbr;
