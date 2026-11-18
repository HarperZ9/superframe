// The shared kit of building parts. Every region builds from the same parts (walls, roofs,
// windows, doors, eaves, chimneys, signs, lanterns, clutter, people) and differs by its
// vernacular: what the walls are made of, what the roof is, what hangs by the door. A part is
// drawn into a Kit mesh in a house's frame (kit.mjs), so a part never needs to know where the
// house stands. built.wgsl reads the materials:
//   10 boards  11 sheet roof  12 snow  13 window  14 door  15 stone  16 light  17 icicles
//   18 sign (hue index, seed, upright)  19 cloth (colour)  20 steel (colour)  22 render/concrete
//   28 slate or tile roof (tone)  29 thatch or reed (tone)  30 leaf card (atlas)
import { put, dir } from "./kit.mjs";
import { CELLS } from "../flora/atlas.mjs";
import { HUE } from "../lights.mjs";

// what each region builds in: wall, roof, trim, footing and the lamp by the door
export const VERNACULAR = {
  snow: { wall: [10, 0.5, 0, 0], roof: [11, 0.5, 0, 0], footing: [15, 0.5, 0, 0], trim: [14, 0.3, 0, 0], lantern: "paper", snowy: true },
  coast: { wall: [22, 0.55, 0, 0], roof: [28, 0.5, 0, 0], footing: [15, 0.5, 0, 0], trim: [20, 0.30, 0.32, 0.30], lantern: "storm", snowy: false },
  marsh: { wall: [29, 0.6, 0, 0], roof: [29, 0.4, 0, 0], footing: [15, 0.5, 0, 0], trim: [14, 0.6, 0, 0], lantern: "paraffin", snowy: false },
};

// the light of a part, so every part that glows also lights
const glowAt = (T, f, p, col, power, reach, o = {}) => { if (!T.lights) return; const q = put(f, p); T.lights.add({ x: q[0] + T.O[0], y: q[1], z: q[2] + T.O[2], col, power, reach, ...o }); };

// a window in the wall plane z (facing +z when sgn > 0), lit by chance, with a snow sill
export function window(T, f, x, y, w, h, z, sgn, lit, panes) {
  const { K, R } = T, seed = R(), m = [13, lit ? 0.55 + 0.45 * R() : 0.4 * R(), seed, panes], zz = z + sgn * 0.05;
  if (sgn > 0) K.face(f, [x - w / 2, y, zz], [x + w / 2, y, zz], [x + w / 2, y + h, zz], [x - w / 2, y + h, zz], m, true); else K.face(f, [x + w / 2, y, zz], [x - w / 2, y, zz], [x - w / 2, y + h, zz], [x + w / 2, y + h, zz], m, true);
  // a frame proud of the wall, and a sill (of snow where it snows)
  K.box(f, x - w / 2 - 0.08, y - 0.1, sgn > 0 ? z : z - 0.18, x + w / 2 + 0.08, y + 0.04, sgn > 0 ? z + 0.18 : z, T.V.snowy ? [12, 0.2, 0, 0] : [15, 0.5, 0, 0]);
  K.box(f, x - w / 2 - 0.1, y + h, sgn > 0 ? z : z - 0.12, x + w / 2 + 0.1, y + h + 0.1, sgn > 0 ? z + 0.12 : z, T.V.trim);
  if (lit) { const hue = seed > 0.86 ? HUE.led : seed * 3 % 1 > 0.5 ? HUE.paper : HUE.paraffin; const p = [x, y + h * 0.5, z + sgn * 0.5]; glowAt(T, f, p, hue, 5 + 7 * w, 8 + 2 * w, { aim: dir(f, [0, -0.55, sgn * 0.83]), cone: 0.15, size: 0, glow: 0, haze: 0 }); }
}

// a door with a small roof over it
export function door(T, f, x, z, w = 1.0, h = 1.95) {
  const { K } = T;
  K.face(f, [x - w / 2, 0.55, z + 0.04], [x + w / 2, 0.55, z + 0.04], [x + w / 2, 0.55 + h, z + 0.04], [x - w / 2, 0.55 + h, z + 0.04], [14, T.R(), 0, 0]);
  K.box(f, x - w / 2 - 0.3, 0.6 + h, z, x + w / 2 + 0.3, 0.68 + h, z + 0.7, T.V.roof);
  if (T.V.snowy) K.box(f, x - w / 2 - 0.3, 0.68 + h, z, x + w / 2 + 0.3, 0.9 + h + 0.15 * T.R(), z + 0.75, [12, 0.15, 0, 0]);
}

// A real lantern: a paper body turned on a lathe, dark rims top and bottom, on a bracket off the
// wall. Red ones hang in rows by the doors of bars; paper ones hang singly.
export function lantern(T, f, x, y, z, kind = "paper", out = 0.45) {
  const { K } = T, p = put(f, [x, y, z + out]), red = kind === "red", r = red ? 0.2 + 0.04 * T.R() : 0.15, h = red ? 0.58 : 0.4;
  const col = red ? [1.0, 0.16, 0.07] : kind === "storm" ? [1.0, 0.82, 0.55] : [1.0, 0.70, 0.36];
  K.pipe([put(f, [x, y + h + 0.3, z]), put(f, [x, y + h + 0.3, z + out]), [p[0], p[1] + h + 0.04, p[2]]], 0.016, 3, [20, 0.04, 0.04, 0.04]);
  const prof = []; for (let i = 0; i <= 6; i++) { const t = i / 6; prof.push([r * (0.55 + 0.45 * Math.sin(t * Math.PI)), t * h]); }
  K.lathe(p[0], p[1], p[2], prof, 10, [16, ...col]);
  for (const yy of [-0.02, h - 0.02]) K.lathe(p[0], p[1] + yy, p[2], [[r * 0.58, 0], [r * 0.6, 0.06], [0.02, 0.07]], 8, [20, 0.03, 0.03, 0.03]);
  if (T.V.snowy && T.R() < 0.7) K.lathe(p[0], p[1] + h + 0.05, p[2], [[r * 0.62, 0], [r * 0.45, 0.07], [0.02, 0.1]], 8, [12, 0.1, 0, 0]);
  if (T.lights) T.lights.add({ x: p[0] + T.O[0], y: p[1] + h * 0.5, z: p[2] + T.O[2], col: red ? [1.0, 0.30, 0.12] : HUE.paper, power: red ? 8 : 6, reach: red ? 7 : 9, size: 0.2, flicker: 0.12, glow: 0.4 });
}

// A sign: a board flat on the wall over the door, or a light box standing out from it, upright.
// The lettering is drawn in the shader from a seed (built.wgsl, material 18).
export function sign(T, f, x, y, z, upright) {
  const { K, R } = T, hue = Math.floor(R() * 6), seed = R(), lit = R() < 0.8;
  if (upright) {
    const w = 0.42 + 0.2 * R(), h = 1.3 + 1.0 * R(), d = 0.14, out = 0.25 + 0.55 * R();
    // two faces seen from up and down the lane, a dark case round them
    K.face(f, [x, y, z + out], [x, y, z + out + w], [x, y + h, z + out + w], [x, y + h, z + out], [18, hue, seed, 1], true);
    K.face(f, [x + d, y, z + out + w], [x + d, y, z + out], [x + d, y + h, z + out], [x + d, y + h, z + out + w], [18, hue, seed + 0.5, 1], true);
    K.box(f, x - 0.02, y - 0.04, z, x + d + 0.02, y + 0.0, z + out + w + 0.03, [20, 0.05, 0.05, 0.05], true, true);
    K.box(f, x - 0.02, y + h, z + out - 0.03, x + d + 0.02, y + h + 0.05, z + out + w + 0.03, [20, 0.05, 0.05, 0.05], true, true);
    if (T.V.snowy) K.box(f, x - 0.03, y + h + 0.05, z + out - 0.03, x + d + 0.03, y + h + 0.17 + 0.1 * R(), z + out + w + 0.03, [12, 0.1, 0, 0]);
    if (lit) glowAt(T, f, [x + d / 2, y + h / 2, z + out + w / 2], SIGN_HUES[hue], 6, 7, { size: 0, glow: 0 });
  } else {
    const w = 1.4 + 1.6 * R(), h = 0.55 + 0.35 * R();
    K.face(f, [x - w / 2, y, z + 0.08], [x + w / 2, y, z + 0.08], [x + w / 2, y + h, z + 0.08], [x - w / 2, y + h, z + 0.08], [18, hue, seed, 0], true);
    K.box(f, x - w / 2 - 0.04, y - 0.04, z, x + w / 2 + 0.04, y + h + 0.04, z + 0.07, [20, 0.06, 0.05, 0.04]);
    if (lit) glowAt(T, f, [x, y + h / 2, z + 0.6], SIGN_HUES[hue], 5, 6, { size: 0, glow: 0, aim: dir(f, [0, -0.3, 1]), cone: 0.1 });
  }
}
// the light a sign throws, by its hue index (the same order as built.wgsl signHue)
export const SIGN_HUES = [[1.0, 0.92, 0.78], [1.0, 0.85, 0.55], [1.0, 0.3, 0.2], [0.55, 0.95, 0.7], [0.65, 0.8, 1.0], [1.0, 0.6, 0.25]];

// a chimney from the ridge, capped with snow where it snows
export function chimney(T, f, x, y, z) {
  const { K } = T;
  K.box(f, x - 0.32, y - 0.6, z - 0.33, x + 0.32, y + 1.3, z + 0.33, [15, T.R(), 0, 0]);
  if (T.V.snowy) K.box(f, x - 0.4, y + 1.3, z - 0.4, x + 0.4, y + 1.52 + 0.2 * T.R(), z + 0.4, [12, 0.1, 0, 0]);
}

// Clutter along a wall: what people keep outside. Each piece stands on the ground in the frame,
// against the wall plane z, at x.
export function clutter(T, f, x, z) {
  const { K, R } = T, pick = R(), snow = T.V.snowy;
  const cap = (x0, y, z0, x1, z1) => { if (snow) K.box(f, x0 - 0.02, y, z0 - 0.02, x1 + 0.02, y + 0.08 + 0.12 * R(), z1 + 0.02, [12, 0.15, 0, 0]); };
  if (pick < 0.2) {
    // an air conditioner's outdoor box on a bracket, and its duct up the wall
    const y = 0.3 + (R() < 0.4 ? 2.6 : 0); K.box(f, x - 0.4, y, z, x + 0.4, y + 0.6, z + 0.3, [20, 0.42, 0.42, 0.40], true); cap(x - 0.4, y + 0.6, z, x + 0.4, z + 0.3);
    K.box(f, x + 0.3, y + 0.6, z, x + 0.38, y + 2.4, z + 0.08, [20, 0.40, 0.40, 0.38]);
  } else if (pick < 0.38) {
    // potted plants, bare or green, with snow in the leaves
    for (let i = 0; i < 1 + Math.floor(R() * 3); i++) { const px = x + (i - 1) * 0.42, h = 0.3 + 0.2 * R(); K.lathe(...put(f, [px, 0, z + 0.3]), [[0.14, 0], [0.18, h], [0.16, h]], 8, [22, 0.3 + 0.3 * R(), 0, 0]); const tip = put(f, [px, h + 0.5 + 0.6 * R(), z + 0.3]), base = put(f, [px, h, z + 0.3]); K.cardAt([base[0] - 0.35, tip[1], base[2]], [base[0] + 0.35, tip[1], base[2]], [base[0] + 0.35, base[1], base[2]], [base[0] - 0.35, base[1], base[2]], CELLS.shrub, [30, 0, 0, 0]); }
  } else if (pick < 0.5) {
    // a bicycle against the wall: two wheels and a frame, in pipe
    const w = (cx) => { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.2832; pts.push(put(f, [cx + Math.cos(a) * 0.33, 0.34 + Math.sin(a) * 0.33, z + 0.2])); } K.pipe(pts, 0.018, 3, [20, 0.03, 0.03, 0.03]); };
    w(x - 0.52); w(x + 0.52); K.pipe([put(f, [x - 0.52, 0.34, z + 0.2]), put(f, [x, 0.75, z + 0.2]), put(f, [x + 0.52, 0.34, z + 0.2])], 0.025, 4, [20, ...[[0.35, 0.05, 0.04], [0.05, 0.12, 0.3], [0.5, 0.5, 0.48]][Math.floor(R() * 3)]]);
  } else if (pick < 0.62) {
    // crates and gas bottles
    for (let i = 0; i < 2 + Math.floor(R() * 3); i++) { const s = 0.35 + 0.2 * R(), px = x + (R() - 0.5) * 1.2, y = i > 2 ? 0.45 : 0; K.box(f, px - s / 2, y, z + 0.05, px + s / 2, y + s, z + 0.05 + s, [10, 0.7, 0, 0], true); cap(px - s / 2, y + s, z + 0.05, px + s / 2, z + 0.05 + s); }
    K.lathe(...put(f, [x + 0.6, 0, z + 0.25]), [[0.16, 0], [0.16, 0.8], [0.08, 0.95], [0.03, 1.0]], 8, [20, 0.55, 0.52, 0.48]);
  } else if (pick < 0.7) {
    // a lit vending machine: the brightest thing in a lane
    K.box(f, x - 0.5, 0, z, x + 0.5, 1.85, z + 0.75, [20, 0.6, 0.6, 0.62], true);
    K.face(f, [x - 0.42, 0.75, z + 0.76], [x + 0.42, 0.75, z + 0.76], [x + 0.42, 1.75, z + 0.76], [x - 0.42, 1.75, z + 0.76], [16, 0.9, 0.95, 1.0]); cap(x - 0.5, 1.85, z, x + 0.5, z + 0.75);
    glowAt(T, f, [x, 1.2, z + 1.1], [0.85, 0.92, 1.0], 9, 6, { size: 0, glow: 0 });
  } else if (pick < 0.82 && snow) {
    // a heap of snow shovelled off the roof against the wall
    const s = 0.8 + 0.8 * R(); K.lathe(...put(f, [x, -0.1, z + 0.5]), [[s, 0], [s * 0.85, s * 0.35], [s * 0.5, s * 0.65], [0.05, s * 0.8]], 10, [12, 0.35, 0, 0]);
  }
}

// Overhead cables from wall to wall across a lane: a sagging line of pipe between two world points.
export function cable(T, a, b, sag = 0.5) {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]); }
  T.K.pipe(pts, 0.012, 3, [20, 0.02, 0.02, 0.02]);
}

// A person, small and legible at a distance: two legs, a long coat turned on a lathe, a head, and
// sometimes an umbrella. Dark coats with a few colours, the way people dress for snow at night.
export function person(T, x, y, z, turn, o = {}) {
  const { K, R } = T, c = Math.cos(turn), s = Math.sin(turn), at = (u, h, v) => [x + u * c + v * s, y + h, z - u * s + v * c];
  const H = (o.child ? 1.2 : 1.62 + 0.18 * R()), coat = [[0.04, 0.04, 0.05], [0.06, 0.05, 0.04], [0.02, 0.02, 0.025], [0.22, 0.06, 0.05], [0.10, 0.12, 0.14], [0.35, 0.30, 0.24]][Math.floor(R() * 6)];
  const stride = (R() - 0.5) * 0.35;
  for (const side of [-1, 1]) K.pipe([at(side * 0.09, 0, side * stride), at(side * 0.08, H * 0.48, 0)], 0.06 * H / 1.7, 4, [19, 0.02, 0.02, 0.02]);
  K.lathe(...at(0, H * 0.42, 0), [[0.21, 0], [0.19, H * 0.18], [0.17, H * 0.32], [0.2, H * 0.38], [0.08, H * 0.43]], 8, [19, ...coat]);
  K.lathe(...at(0, H * 0.84, 0), [[0.06, 0], [0.105, 0.05], [0.11, 0.12], [0.07, 0.2], [0.01, 0.23]], 8, [19, ...(R() < 0.5 ? [0.03, 0.025, 0.02] : coat)]);
  if (o.umbrella ?? R() < 0.45) {
    const top = at(0.1, H + 0.25, 0.05), col = R() < 0.6 ? [0.55, 0.57, 0.58] : coat.map((v) => v * 2 + 0.05);
    K.pipe([at(0.12, H * 0.7, 0.1), top], 0.012, 3, [20, 0.03, 0.03, 0.03]);
    K.lathe(top[0], top[1] - 0.32, top[2], [[0.55, 0], [0.42, 0.18], [0.2, 0.3], [0.01, 0.34]], 12, [19, ...col]);
    if (T.V.snowy) K.lathe(top[0], top[1] - 0.12, top[2], [[0.38, 0], [0.22, 0.12], [0.01, 0.16]], 10, [12, 0.1, 0, 0]);
  } else if (T.V.snowy) K.lathe(...at(0, H * 0.79, 0), [[0.17, 0], [0.1, 0.05], [0.01, 0.06]], 6, [12, 0.1, 0, 0]);
}
