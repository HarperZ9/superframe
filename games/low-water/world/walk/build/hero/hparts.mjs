// Small hero parts: snow pillows on anything that faces up, lanterns, signs, street lamps, cables
// and what people keep outside. Each takes a context T = { M (HeroMesh), R (rng), L (lights), age }
// and a frame f. Lights are { p, col, power (W-ish), radius, aim?, cone? } in the mesh's space.
import { put, dir } from "../kit.mjs";
import { sub, add, mul, norm, lerp } from "./hmesh.mjs";

// The light colours of the town (walk/lights.mjs HUE), repeated so this module stands alone in node.
export const HUE = { sodium: [1.0, 0.56, 0.16], paraffin: [1.0, 0.72, 0.42], paper: [1.0, 0.80, 0.52], red: [1.0, 0.12, 0.06], led: [0.62, 0.78, 1.0], white: [0.92, 0.96, 1.0] };
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy); return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), ux), lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), ux), uy); };
export const fbm = (x, y) => vnoise(x, y) * 0.55 + vnoise(x * 2.1 + 7, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 1, y * 4.3 + 9) * 0.15;

// Snow lying on a level rectangle (x0..x1, z0..z1) at height y in frame f: a pillow `depth` thick at
// its middle, rounded down at every edge, hanging `over` metres past it where it can. The mesh is
// a closed cushion: a displaced top and a skirt tucked under it, so rays from below meet snow too.
export function snowPillow(T, f, x0, z0, x1, z1, y, depth, over = 0.03, n = null) {
  const w = x1 - x0, d = z1 - z0, nu = n || Math.max(3, Math.min(28, Math.round(w / 0.08))), nv = n || Math.max(3, Math.min(28, Math.round(d / 0.08))), ph = T.R() * 50;
  const X = (s) => x0 - over + (w + 2 * over) * s, Z = (t) => z0 - over + (d + 2 * over) * t;
  const h = (s, t) => {
    const ex = Math.min(s, 1 - s) * (w + 2 * over), ez = Math.min(t, 1 - t) * (d + 2 * over), e = Math.min(ex, ez);
    const round = Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, e / Math.max(0.02, Math.min(depth * 1.6, w / 2, d / 2))), 2)));
    return depth * round * (0.82 + 0.36 * fbm(X(s) * 2.3 + ph, Z(t) * 2.3));
  };
  const P = (s, t) => put(f, [X(s), y + h(s, t) - 0.004, Z(t)]);
  T.M.grid("snow", P, nu, nv, (s, t) => [X(s) * 0.6 + ph, Z(t) * 0.6]);
}

// a lantern on a bracket off a wall at (x, y, z) facing +z in the frame
export function lantern(T, f, x, y, z, kind = "paper", out = 0.42) {
  const { M, R } = T, red = kind === "red", r = red ? 0.19 + 0.04 * R() : 0.14, h = red ? 0.56 : 0.4, c = put(f, [x, y, z + out]);
  const col = red ? HUE.red : HUE.paper;
  M.tube("iron", [put(f, [x, y + h + 0.32, z]), put(f, [x, y + h + 0.32, z + out]), [c[0], c[1] + h + 0.05, c[2]]], 0.012, 6);
  const prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10; prof.push([r * (0.55 + 0.45 * Math.sin(t * Math.PI)), t * h]); }
  M.wear = [col[0], col[1], col[2], red ? 0.9 : 1.0];
  M.lathe("lamp", c, prof, 18, 3);
  M.wear = T.col;
  // dark caps top and bottom, closed to the axis, and the paper's ribs
  M.lathe("iron", [c[0], c[1] - 0.03, c[2]], [[0.01, 0], [r * 0.62, 0.005], [r * 0.6, 0.045], [r * 0.5, 0.05]], 16);
  M.lathe("iron", [c[0], c[1] + h - 0.03, c[2]], [[r * 0.5, 0], [r * 0.6, 0.005], [r * 0.62, 0.045], [0.01, 0.07]], 16);
  for (let k = 0; k < 8; k++) { const a = k / 8 * 6.2832, pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6, rr = r * (0.55 + 0.45 * Math.sin(t * Math.PI)) + 0.004; pts.push([c[0] + Math.cos(a) * rr, c[1] + t * h, c[2] + Math.sin(a) * rr]); } M.tube("iron", pts, 0.003, 3); }
  if (R() < 0.75) M.lathe("snow", [c[0], c[1] + h + 0.05, c[2]], [[r * 0.6, 0], [r * 0.48, 0.05], [r * 0.2, 0.09], [0.01, 0.1]], 12);
  T.L.push({ p: [c[0], c[1] + h * 0.5, c[2]], col, power: red ? 14 : 12, radius: r * 0.8 });
}

// a sign board flat on the wall over a door, painted, with lettering the shader draws from its seed
export function signBoard(T, f, x, y, z) {
  const { M, R } = T, w = 1.3 + 1.4 * R(), h = 0.5 + 0.3 * R(), lit = R() < 0.55;
  M.bbox("timber", f, x - w / 2 - 0.05, y - 0.05, z, x + w / 2 + 0.05, y + h + 0.05, z + 0.06, 0.012, 1, [R() * 9, R() * 9]);
  M.wear = [R(), R(), lit ? 1 : 0, 0];
  M.quad("sign", put(f, [x - w / 2, y, z + 0.065]), put(f, [x + w / 2, y, z + 0.065]), put(f, [x + w / 2, y + h, z + 0.065]), put(f, [x - w / 2, y + h, z + 0.065]), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  M.wear = T.col;
  snowPillow(T, f, x - w / 2 - 0.05, z, x + w / 2 + 0.05, z + 0.06, y + h + 0.05, 0.05, 0.01);
  if (lit) { const p = put(f, [x, y + h + 0.3, z + 0.35]); M.tube("iron", [put(f, [x, y + h + 0.05, z + 0.02]), p], 0.01, 5); M.lathe("iron", [p[0], p[1] - 0.1, p[2]], [[0.09, 0], [0.04, 0.1]], 10); T.L.push({ p: [p[0], p[1] - 0.12, p[2]], col: HUE.paraffin, power: 3.5, radius: 0.04, aim: dir(f, [0, -0.6, -0.8]), cone: 0.55 }); }
}

// an upright light box standing out from the wall, lit from inside
export function signBox(T, f, x, y, z) {
  const { M, R } = T, w = 0.42 + 0.2 * R(), h = 1.2 + 0.9 * R(), d = 0.16, out = 0.3 + 0.4 * R(), hue = [[1.0, 0.9, 0.75], [1.0, 0.45, 0.25], [0.6, 0.95, 0.75], [0.7, 0.82, 1.0]][Math.floor(R() * 4)];
  M.bbox("iron", f, x - 0.02, y - 0.05, z + out - 0.03, x + d + 0.02, y + h + 0.05, z + out + w + 0.03, 0.01);
  M.wear = [2 + Math.floor(R() * 4), R(), 1, 0];   // lettered, lit from inside (hf_material.hlsli signPaint)
  for (const sx of [-0.002, d + 0.002]) M.quad("sign", put(f, [x + sx, y, z + out]), put(f, [x + sx, y, z + out + w]), put(f, [x + sx, y + h, z + out + w]), put(f, [x + sx, y + h, z + out]), [[0, 0], [1, 0], [1, 1], [0, 1]]);
  M.wear = T.col;
  M.tube("iron", [put(f, [x + d / 2, y + h * 0.8, z]), put(f, [x + d / 2, y + h * 0.8, z + out])], 0.015, 6);
  snowPillow(T, f, x - 0.02, z + out - 0.03, x + d + 0.02, z + out + w + 0.03, y + h + 0.05, 0.08, 0.02);
  T.L.push({ p: put(f, [x + d / 2, y + h / 2, z + out + w / 2]), col: hue, power: 5, radius: 0.2 });
}

// a street lamp: a timber pole on a stone foot, an iron arm, a shade over a sodium globe
export function streetLamp(T, x, y, z, ax, az) {
  const { M, R } = T, f = { o: [x, y, z], c: 1, s: 0, turn: 0 }, arm = [x + ax * 1.0, y + 5.45, z + az * 1.0];
  M.bbox("stone", f, -0.2, -0.4, -0.2, 0.2, 0.45, 0.2, 0.04, 1, [R() * 9, R() * 9]);
  M.bbox("timber", f, -0.085, 0.45, -0.085, 0.085, 5.7, 0.085, 0.018, 1, [R() * 9, R() * 9]);
  M.lathe("snow", [x, y + 5.7, z], [[0.12, 0], [0.1, 0.06], [0.05, 0.11], [0.01, 0.12]], 10);
  M.tube("iron", [[x, y + 5.2, z], [x + ax * 0.4, y + 5.5, z + az * 0.4], [x + ax * 0.85, y + 5.58, z + az * 0.85], [arm[0], arm[1] + 0.12, arm[2]]], 0.025, 8);
  M.tube("iron", [[x, y + 4.9, z], [x + ax * 0.45, y + 5.48, z + az * 0.45]], 0.015, 6);
  M.lathe("iron", [arm[0], arm[1] - 0.06, arm[2]], [[0.34, 0], [0.3, 0.05], [0.14, 0.16], [0.04, 0.2]], 20);
  M.lathe("snow", [arm[0], arm[1] + 0.1, arm[2]], [[0.3, 0], [0.22, 0.07], [0.08, 0.13], [0.01, 0.14]], 16);
  M.wear = [HUE.sodium[0], HUE.sodium[1], HUE.sodium[2], 1];
  M.lathe("lamp", [arm[0], arm[1] - 0.26, arm[2]], [[0.02, 0], [0.09, 0.05], [0.1, 0.12], [0.07, 0.2]], 14);
  M.wear = T.col;
  T.L.push({ p: [arm[0], arm[1] - 0.14, arm[2]], col: HUE.sodium, power: 140, radius: 0.09, aim: [0, -1, 0], cone: 0.15, street: true });
}

// a cable slung between two points, sagging
export function cable(T, a, b, sag) {
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t) - sag * 4 * t * (1 - t), lerp(a[2], b[2], t)]); }
  T.M.tube("iron", pts, 0.009, 4);
}

// a crate of slats with gaps between them, corner battens and a dark inside
function crate(T, f, x, y, z, s) {
  const { M, R } = T, x0 = x - s / 2, x1 = x + s / 2, z0 = z, z1 = z + s, n = 4, g = 0.012, off = () => [R() * 9, R() * 9];
  M.bbox("timber", f, x0 + 0.02, y + 0.02, z0 + 0.02, x1 - 0.02, y + s - 0.02, z1 - 0.02, 0, 1, [0, 0], { col: [1, 0.3, 0.6, 0] });
  for (let i = 0; i < n; i++) {
    const a = y + i * s / n + g / 2, b = y + (i + 1) * s / n - g / 2;
    M.bbox("timber", f, x0, a, z1 - 0.018, x1, b, z1, 0.004, 1, off()); M.bbox("timber", f, x0, a, z0, x1, b, z0 + 0.018, 0.004, 1, off());
    M.bbox("timber", f, x0, a, z0, x0 + 0.018, b, z1, 0.004, 1, off()); M.bbox("timber", f, x1 - 0.018, a, z0, x1, b, z1, 0.004, 1, off());
  }
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) M.bbox("timber", f, cx - 0.025, y, cz - 0.025, cx + 0.025, y + s, cz + 0.025, 0.006, 1, off());
  for (let i = 0; i < 3; i++) M.bbox("timber", f, x0, y + s - 0.016, z0 + (i + 0.2) * s / 3, x1, y + s, z0 + (i + 0.8) * s / 3, 0.004, 1, off());
}

// the cut end of a log: a disc facing out of the stack (sg), split into a fan; its uv runs -1..1
// across the face, and its numbers carry the log's seed, a crack count and a turn of its rings
function logEnd(M, f, c, sg, r, R) {
  const n = dir(f, [0, 0, sg]), u = dir(f, [1, 0, 0]), v = [0, 1, 0], sides = 16, col = [R(), Math.floor(R() * 4), R() * 6.28, 0];
  const ctr = M.v("logend", c, n, 0, 0, col), ring = [];
  for (let k = 0; k <= sides; k++) { const t = k / sides * 6.2832, x = Math.cos(t), y = Math.sin(t); ring.push(M.v("logend", [c[0] + (u[0] * x + v[0] * y) * r, c[1] + (u[1] * x + v[1] * y) * r, c[2] + (u[2] * x + v[2] * y) * r], n, x, y, col)); }
  for (let k = 0; k < sides; k++) M.tri("logend", ctr, ring[k], ring[k + 1]);
}

// what stands along a wall: crates, a barrel, stacked firewood, a heap of shovelled snow
export function clutter(T, f, x, z) {
  const { M, R } = T, pick = R();
  if (pick < 0.3) for (let i = 0; i < 2 + Math.floor(R() * 2); i++) {
    const s = 0.38 + 0.2 * R(), px = x + (i - 0.5) * 0.55 + (R() - 0.5) * 0.1, py = i === 2 ? 0.45 : 0;
    crate(T, f, px, py, z + 0.05, s);
    snowPillow(T, f, px - s / 2, z + 0.05, px + s / 2, z + 0.05 + s, py + s, 0.06 + 0.06 * R(), 0.02);
  } else if (pick < 0.5) {
    const c = put(f, [x, 0, z + 0.4]), prof = []; for (let i = 0; i <= 8; i++) { const t = i / 8; prof.push([0.27 + 0.04 * Math.sin(t * Math.PI), t * 0.85]); }
    M.lathe("timber", c, prof, 20, 2);
    for (const hy of [0.12, 0.73]) M.lathe("iron", [c[0], c[1] + hy, c[2]], [[0.29, 0], [0.295, 0.03], [0.29, 0.06]], 20);
    M.lathe("snow", [c[0], c[1] + 0.85, c[2]], [[0.28, 0], [0.22, 0.06], [0.1, 0.1], [0.01, 0.11]], 16);
  } else if (pick < 0.75) {
    // firewood: split logs stacked in a rack against the wall, under a board
    const w = 1.2 + R(), hgt = 1.0 + 0.4 * R();
    for (let row = 0; row * 0.14 < hgt; row++) for (let k = 0; k * 0.15 < w; k++) {
      // each log its own size, offset and length; its two ends are discs of the log-end material, whose
      // rings, cracks and bark edge the frame draws from the seed in the vertex numbers
      const rr = 0.05 + 0.022 * R(), px = x - w / 2 + k * 0.15 + (row % 2) * 0.07 + (R() - 0.5) * 0.025, py = 0.08 + row * 0.135 + (R() - 0.5) * 0.02;
      const z0 = z + 0.02 + R() * 0.05, z1 = z + 0.46 + R() * 0.08, a = put(f, [px, py, z0]), b = put(f, [px + (R() - 0.5) * 0.02, py, z1]);
      M.tube("bark", [a, b], rr, 14);
      for (const [p, sg] of [[a, -1], [b, 1]]) logEnd(M, f, p, sg, rr, R);
    }
    M.bbox("timber", f, x - w / 2 - 0.1, hgt + 0.15, z, x + w / 2 + 0.1, hgt + 0.19, z + 0.62, 0.008);
    snowPillow(T, f, x - w / 2 - 0.1, z, x + w / 2 + 0.1, z + 0.62, hgt + 0.19, 0.12, 0.03);
  } else {
    // a heap of shovelled snow: a lumpy mound whose radius wanders round it and whose top is clods
    const c = put(f, [x, -0.25, z + 0.55]), s = 0.7 + 0.6 * R(), ph = R() * 30;
    M.grid("snow", (u, t) => {
      const a = u * 6.2832, rr = s * (1 - Math.pow(t, 2.2)) * (0.8 + 0.35 * (1 - t * t) * fbm(Math.cos(a) * 1.3 + ph, Math.sin(a) * 1.3 + t * 2));
      const hgt = s * 0.75 * Math.sqrt(Math.max(0, t)) * (0.85 + 0.3 * (1 - t) * fbm(Math.cos(a) * 2 + ph, Math.sin(a) * 2 + 5) + 0.15 * t);
      return [c[0] + Math.cos(a) * rr, c[1] + hgt, c[2] + Math.sin(a) * rr];
    }, 48, 16, (u, t) => [u * s * 4, t * s * 2], null, c);   // the apex row closes on the axis
  }
}
