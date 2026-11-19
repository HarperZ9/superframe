// Emit the works at night, doubled in water, for the native frame (region 8): stacks in red and white
// bands, distillation columns ringed with lit platforms, tanks, pipe racks, lattice towers and a
// furnace, along a quay over black water that doubles every light.
//   node games/low-water/world/walk/build/hero/emit-works.mjs <world out dir> <out dir>
// Writes <out>/the-works.glb and <out>/the-works.frame.json (lw_frame --view the-works). Placed at
// the world's works anchor; every part comes from the seed, so the same seed gives the same works.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadWorldNode } from "./world-node.mjs";
import { HeroMesh } from "./hmesh.mjs";
import { writeGlb } from "./glb.mjs";
import { HUE } from "./hparts.mjs";
import { frame } from "../kit.mjs";

const [worldDir, outDir] = process.argv.slice(2);
if (!worldDir || !outDir) { console.error("usage: emit-works.mjs <world out dir> <out dir>"); process.exit(2); }
const world = await loadWorldNode(worldDir);
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = mulberry(world.json.seed ^ 0x3077c5);
const M = new HeroMesh(), L = [], smoke = [], I = { lamps: 0 };
const MERCURY = [0.55, 1.0, 0.72], WHITE = HUE.white, SODIUM = HUE.sodium, RED = HUE.red;
const lightHue = () => { const r = R(); return r < 0.5 ? SODIUM : r < 0.82 ? MERCURY : WHITE; };

// a small lit fitting: an emissive box (drawn, traced, doubled in the water); every few a real light
function fitting(x, y, z, col, real = 0.12, power = 9) {
  const s = 0.18 + 0.12 * R();
  M.bbox("lamp", frame(x, y, z), -s, -s * 0.5, -s, s, s * 0.5, s, 0.02, 1, [0, 0], { col: [col[0], col[1], col[2], 1.4] });
  I.lamps++;
  if (R() < real) L.push({ p: [x, y - 0.3, z], col, power, radius: 0.12 });
}
const F0 = frame(0, 0, 0);
const box = (m, x0, y0, z0, x1, y1, z1, bev = 0.02) => M.bbox(m, F0, x0, y0, z0, x1, y1, z1, bev);

// a stack: banded red and white near the top, a ring of aviation lights, a plume
function stack(x, z, h, r) {
  const bands = 7, top = h, base = h * 0.55;
  M.lathe("plaster", [x, 0, z], [[r * 1.25, 0], [r * 1.05, base]], 20, 0.5);
  for (let b = 0; b < bands; b++) {
    const y0 = base + (top - base) * b / bands, y1 = base + (top - base) * (b + 1) / bands, k = 1 - 0.18 * (y0 / h);
    M.lathe(b % 2 ? "plaster" : "paint_red", [x, 0, z], [[r * k, y0], [r * (1 - 0.18 * (y1 / h)), y1]], 20, 0.5);
  }
  for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2; fitting(x + Math.cos(a) * r * 0.9, top - 2, z + Math.sin(a) * r * 0.9, RED, k === 0 ? 1 : 0, 5); }
  smoke.push([x, top + 1, z, 0.6 + 0.4 * R()]);
}
// a distillation column: a cylinder ringed every few metres by a platform with rails and lamps
function column(x, z, h, r) {
  M.lathe(R() < 0.5 ? "iron" : "plaster", [x, 0, z], [[r, 0], [r, h], [r * 0.6, h + r * 0.5], [0.15, h + r * 0.7]], 16, 0.5);
  const step = 5 + 2 * R(), col = lightHue();
  for (let y = step; y < h; y += step) {
    M.lathe("iron", [x, 0, z], [[r + 1.2, y - 0.15], [r + 1.2, y], [r + 0.05, y]], 16, 1);
    const n = 3 + Math.floor(r * 2);
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + y; fitting(x + Math.cos(a) * (r + 1.1), y + 1.8, z + Math.sin(a) * (r + 1.1), R() < 0.85 ? col : lightHue(), 0.06); }
  }
  // a pipe down its side
  M.tube("iron", [[x + r + 0.4, 0, z], [x + r + 0.4, h * 0.9, z], [x + r + 0.4, h * 0.95, z + 0.6]], 0.18, 6);
}
// a tank: a squat cylinder or a sphere on legs, painted pale, lamps at the stair
function tank(x, z, r, sphere) {
  if (sphere) {
    const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI; prof.push([Math.max(0.05, Math.sin(t) * r), r * 0.4 + r - Math.cos(t) * r]); }
    M.lathe("plaster", [x, 0, z], prof, 24, 0.3);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; M.tube("iron", [[x + Math.cos(a) * r * 0.8, 0, z + Math.sin(a) * r * 0.8], [x + Math.cos(a) * r * 0.8, r * 0.9, z + Math.sin(a) * r * 0.8]], 0.3, 6); }
  } else {
    const h = r * (0.7 + 0.4 * R());
    M.lathe("plaster", [x, 0, z], [[r, 0], [r, h], [r * 0.9, h + r * 0.08], [0.2, h + r * 0.12]], 32, 0.3);
    for (let y = 2; y < h; y += 4) fitting(x + r + 0.3, y, z, lightHue(), 0.1);
  }
  fitting(x, sphere ? r * 2.5 : r * 0.9, z - r - 0.2, lightHue(), 0.4, 12);
}
// a lattice tower: four legs and cross braces, lamps up a corner
function lattice(x, z, h, w) {
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [a, b] of legs) M.tube("iron", [[x + a * w, 0, z + b * w], [x + a * w * 0.4, h, z + b * w * 0.4]], 0.18, 5);
  for (let y = 0; y < h - 4; y += 5) for (let k = 0; k < 4; k++) {
    const [a0, b0] = legs[k], [a1, b1] = legs[(k + 1) % 4], s0 = 1 - 0.6 * y / h, s1 = 1 - 0.6 * (y + 5) / h;
    M.tube("iron", [[x + a0 * w * s0, y, z + b0 * w * s0], [x + a1 * w * s1, y + 5, z + b1 * w * s1]], 0.07, 4);
  }
  for (let y = 6; y < h; y += 7) fitting(x + w * (1 - 0.6 * y / h), y, z - w * (1 - 0.6 * y / h), lightHue(), 0.08);
  fitting(x, h + 0.5, z, RED, 1, 4);
}
// the furnace: a tapering hearth under a gantry, its tap hole glowing
function furnace(x, z) {
  M.lathe("iron", [x, 0, z], [[9, 0], [10, 8], [8, 26], [5, 38], [3.5, 46]], 24, 0.4);
  box("iron", x - 14, 30, z - 2, x + 14, 31.5, z + 2);
  for (const s of [-1, 1]) M.tube("iron", [[x + s * 14, 0, z], [x + s * 14, 31, z]], 0.6, 8);
  M.tube("iron", [[x + 3, 46, z], [x + 3, 58, z], [x + 20, 70, z + 4], [x + 34, 70, z + 4], [x + 34, 20, z + 4]], 1.4, 10);
  L.push({ p: [x, 3, z - 11], col: [1.0, 0.45, 0.12], power: 900, radius: 1.2 });
  M.bbox("lamp", F0, x - 1.5, 1.5, z - 10.4, x + 1.5, 4, z - 10, 0.05, 1, [0, 0], { col: [1.0, 0.42, 0.1, 6] });
  smoke.push([x + 3, 60, z, 1.0]);
}

// the quay and the water: the site on a concrete apron, the water doubling it
const W = 520;
box("stone", -W / 2, -1.5, 0, W / 2, 1.2, 360, 0.05);
box("stone", -W / 2, -3, -2, W / 2, 1.25, 0.2, 0.08);
for (let x = -W / 2 + 6; x < W / 2; x += 12) fitting(x, 4.5, 1.2, R() < 0.7 ? SODIUM : WHITE, 0.35, 14);
for (let x = -W / 2 + 6; x < W / 2; x += 12) M.tube("iron", [[x, 1.2, 1.2], [x, 4.3, 1.2]], 0.08, 5);
M.grid("water", (s, t) => [-900 + 1800 * s, -0.4, -2 - 900 * t], 60, 30, (s, t, q) => [q[0], q[2]]);

// the plant, in loose blocks back from the quay
const cell = (x, z) => ({ x: x + (R() - 0.5) * 6, z: z + (R() - 0.5) * 6 });
for (let i = 0; i < 9; i++) { const p = cell(-230 + i * 55 + R() * 20, 120 + R() * 90); stack(p.x, p.z, 70 + 60 * R(), 2.2 + 1.6 * R()); }
for (let gx = -230; gx <= 230; gx += 17) for (let gz = 22; gz <= 330; gz += 17) {
  const p = cell(gx, gz), r = R();
  if (Math.abs(p.x - 60) < 30 && Math.abs(p.z - 70) < 25) continue;   // the furnace's yard
  if (r < 0.42) column(p.x, p.z, 18 + 40 * R() * (1 - gz / 400), 1 + 1.6 * R());
  else if (r < 0.62) tank(p.x, p.z, 6 + 6 * R(), R() < 0.35);
  else if (r < 0.75) lattice(p.x, p.z, 25 + 30 * R(), 2.5 + R());
  else if (r < 0.88) { const h = 6 + 8 * R(); box("plaster", p.x - 8, 0.5, p.z - 6, p.x + 8, 0.5 + h, p.z + 6, 0.1); for (let k = 0; k < 5; k++) fitting(p.x - 7 + k * 3.5, h - 1, p.z - 6.3, lightHue(), 0.05); }
}
furnace(60, 70);
// pipe racks: long runs on bents, the town's veins
for (let k = 0; k < 7; k++) {
  const z = 18 + k * 27 + R() * 6, y = 5 + 4 * R(), n = 2 + Math.floor(R() * 4);
  for (let j = 0; j < n; j++) M.tube("iron", [[-W / 2 + 10, y + j * 0.7, z], [W / 2 - 10, y + j * 0.7, z]], 0.25 + 0.2 * R(), 8);
  for (let x = -W / 2 + 12; x < W / 2 - 10; x += 9) { box("iron", x - 0.2, 0, z - 1.5, x + 0.2, y - 0.2, z - 1.2); box("iron", x - 0.2, 0, z + 1.2, x + 0.2, y - 0.2, z + 1.5); box("iron", x - 0.25, y - 0.3, z - 1.6, x + 0.25, y - 0.1, z + 1.6); }
}

// cameras: low over the water facing the quay (the doubled view), the far shore with a long lens,
// at the quay's edge looking up a stack, and from a little height across the whole plant
const look = (e, t, fov) => { const d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]], l = Math.hypot(...d); return { eye: e, yaw: Math.atan2(d[0], -d[2]), pitch: Math.asin(d[1] / l), fov }; };
const cams = { main: look([-20, 1.2, -140], [20, 18, 100], 62) };
cams.close = look([40, 2.2, -6], [70, 40, 60], 70);
const views = {
  doubled: look([-30, 0.9, -190], [10, 16, 100], 54),
  far: look([120, 2.5, -520], [0, 28, 120], 26),
  stacks: look([-80, 2.0, 30], [-40, 70, 140], 78),
  above: look([-260, 70, -240], [20, 10, 110], 46),
};
cams.walk = [];
await mkdir(outDir, { recursive: true });
const glb = writeGlb(M, { iron: [0.1, 0.1, 0.1], plaster: [0.8, 0.8, 0.75], paint_red: [0.55, 0.08, 0.06], stone: [0.3, 0.3, 0.3], lamp: [1, 0.8, 0.5], water: [0.02, 0.03, 0.04] },
  { seed: world.json.seed, view: "the-works", origin: [0, 0, 0] });
await writeFile(join(outDir, "the-works.glb"), glb);
const frameFile = { format: "lw-hero-frame-1", seed: world.json.seed, view: "the-works", origin: [0, 0, 0], region: 8, anchor: world.json.works_anchor, cameras: cams, views,
  lights: L.map((l) => ({ p: l.p.map((v) => +v.toFixed(3)), col: l.col, power: l.power, radius: l.radius })), smoke,
  counts: { triangles: M.triangles, lights: L.length, fittings: I.lamps, materials: [...M.b.keys()] } };
await writeFile(join(outDir, "the-works.frame.json"), JSON.stringify(frameFile));
console.log(`the works: ${M.triangles} triangles, ${L.length} lights, ${I.lamps} lit fittings, ${smoke.length} plumes; glb ${(glb.length / 1e6).toFixed(1)} MB`);
