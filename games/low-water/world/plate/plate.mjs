// The island as a plate: a hand-lettered, hachured map drawn from the same files the traversal
// walks on. Paper ground, ink hairlines, shadow hachures lit from the north-west, water-lining
// round the coast, one accent colour for what people built, and lettering from the game's own
// stroke skeletons (game/engine/ui/lettering).
//   node games/low-water/world/plate/plate.mjs [--world games/low-water/world/out/20261118] [--out plate.svg] [--png]
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePgm } from "../pgm.mjs";
import { writePng } from "../../game/engine/light/tools/png.mjs";
import { letter, textWidth } from "./lettering.mjs";
import { contours, chaikin, seaDistance } from "./lines.mjs";

const here = dirname(fileURLToPath(import.meta.url)), argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const dir = opt.world || join(here, "..", "out", "20261118"), out = opt.out || join(dir, "plate.svg");
const J = JSON.parse(readFileSync(join(dir, "world.json"), "utf8")), W = J.width, H = J.height;
const load = (n) => parsePgm(readFileSync(join(dir, `${n}.pgm`))).data;
const HGT = load("height"), WAT = load("water"), BIO = load("biome"), REG = load("region");
const m = (k) => HGT[k] / 16 - 512, wet = (k) => WAT[k] > 0;

// ---------------------------------------------------------------- the sheet
const S = 1.15, MX = 120, MY = 150, MAPW = W * S, MAPH = H * S, SW = Math.round(MAPW + MX * 2), SH = Math.round(MAPH + MY + 130);
const X = (cx) => +(MX + cx * S).toFixed(1), Y = (cy) => +(MY + cy * S).toFixed(1);
const INK = "#1f1a15", ACCENT = "#b3471f", PAPER = "#e9e1cd", SEA_INK = "#3d5560";
function rnd(a, b = 0) { let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; return (h >>> 0) / 4294967296; }
const parts = [];
const push = (s) => parts.push(s);

// ---------------------------------------------------------------- 1. the wash: region tints under a soft relief
{
  const TINT = [[203, 212, 211], [227, 229, 231], [213, 219, 194], [188, 202, 188], [201, 205, 210], [227, 201, 172], [206, 204, 172], [221, 205, 180], [213, 188, 168], [226, 220, 205], [188, 205, 205], [232, 232, 237]];
  const w = W >> 1, h = H >> 1, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * 2) * W + x * 2, e = m(k), sea = wet(k) && e < 0.5;
    let c = sea ? TINT[0] : TINT[REG[k]] || TINT[0];
    if (!sea) {
      if (BIO[k] === 9 || BIO[k] === 7) c = [240, 241, 244];
      const xe = Math.min(W - 1, x * 2 + 2), xw = Math.max(0, x * 2 - 2), ys = Math.min(H - 1, y * 2 + 2), yn = Math.max(0, y * 2 - 2);
      const dx = (m(y * 2 * W + xe) - m(y * 2 * W + xw)) / 256, dz = (m(ys * W + x * 2) - m(yn * W + x * 2)) / 256;
      const shade = Math.max(-1, Math.min(1, (dx + dz) * 1.6));           // light from the north-west
      c = c.map((v) => v * (0.93 - 0.16 * shade));
      if (wet(k)) c = [176, 196, 200];                                    // lakes
    } else c = c.map((v) => v - Math.min(14, -e / 30));
    data.set([c[0], c[1], c[2], 255], (y * w + x) * 4);
  }
  const tmp = join(mkdtempSync(join(tmpdir(), "lw-plate-")), "wash.png");
  writePng(tmp, { width: w, height: h, data });
  push(`<image x="${MX}" y="${MY}" width="${MAPW}" height="${MAPH}" preserveAspectRatio="none" opacity="0.92" href="data:image/png;base64,${readFileSync(tmp).toString("base64")}"/>`);
}

// ---------------------------------------------------------------- 2. the coast and its water-lining
{
  const st = 2, w = W / st, h = H / st, land = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * st * W + x * st; land[y * w + x] = wet(k) && m(k) < 0.5 ? -1 : 1; }
  const d = seaDistance(land, w, h);
  const seg = (list, sw, op, col = SEA_INK) => push(`<path d="${list.map((s) => `M${X(s[0] * st)},${Y(s[1] * st)}L${X(s[2] * st)},${Y(s[3] * st)}`).join("")}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-opacity="${op}" stroke-linecap="round"/>`);
  for (const [dist, sw, op] of [[14, 0.35, 0.28], [9, 0.4, 0.38], [5.5, 0.45, 0.5], [3, 0.5, 0.62], [1.4, 0.55, 0.75]]) seg(contours(d, w, h, dist), sw, op);
  seg(contours(land, w, h, 0), 1.25, 1, INK);
  // lakes: an outline and a few level lines
  const lake = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * st * W + x * st; lake[y * w + x] = wet(k) && m(k) >= 0.5 ? 1 : -1; }
  seg(contours(lake, w, h, 0), 0.7, 0.9, SEA_INK);
}

// ---------------------------------------------------------------- 3. hachures: short strokes down the slope, heavier in shadow
{
  let d = "", dHeavy = "", dFine = "";
  const G = 5;
  for (let gy = 2; gy < H / G - 2; gy++) for (let gx = 2; gx < W / G - 2; gx++) {
    const cx = gx * G + (rnd(gx, gy) - 0.5) * G * 0.9, cy = gy * G + (rnd(gx + 7, gy + 3) - 0.5) * G * 0.9, x = Math.round(cx), y = Math.round(cy), k = y * W + x;
    if (wet(k)) continue;
    const dx = (m(k + 2) - m(k - 2)) / 256, dz = (m(k + 2 * W) - m(k - 2 * W)) / 256, s = Math.hypot(dx, dz);
    if (s < 0.045) continue;
    const ux = -dx / s, uz = -dz / s;                                     // downhill
    const len = Math.min(8.5, 1.6 + s * 20) * S, shade = Math.max(0, (ux + uz) * 0.7071);   // faces away from the north-west light
    const x0 = X(cx) - ux * len / 2, y0 = Y(cy) - uz * len / 2, seg = `M${x0.toFixed(1)},${y0.toFixed(1)}l${(ux * len).toFixed(1)},${(uz * len).toFixed(1)}`;
    if (shade > 0.55 && s > 0.12) dHeavy += seg; else if (shade > 0.15 || s > 0.2) d += seg; else dFine += seg;
  }
  push(`<path d="${dFine}" fill="none" stroke="${INK}" stroke-width="0.32" stroke-opacity="0.55" stroke-linecap="round"/>`);
  push(`<path d="${d}" fill="none" stroke="${INK}" stroke-width="0.5" stroke-opacity="0.75" stroke-linecap="round"/>`);
  push(`<path d="${dHeavy}" fill="none" stroke="${INK}" stroke-width="0.85" stroke-opacity="0.9" stroke-linecap="round"/>`);
}

// ---------------------------------------------------------------- 4. cover signs: trees, reeds, stipple
{
  let trees = "", birch = "", reeds = "", dots = "";
  const G = 7;
  for (let gy = 1; gy < H / G - 1; gy++) for (let gx = 1; gx < W / G - 1; gx++) {
    const cx = gx * G + (rnd(gx * 3, gy) - 0.5) * G, cy = gy * G + (rnd(gx, gy * 5) - 0.5) * G, k = Math.round(cy) * W + Math.round(cx), b = BIO[k], r = rnd(gx + 11, gy + 17);
    const x = X(cx), y = Y(cy);
    if (b === 5 && r < 0.8) { if (r < 0.62) trees += `M${x},${(y - 3.4).toFixed(1)}l-1.9,2.6h1.2l-1.6,2.2h4.6l-1.6,-2.2h1.2z`; else birch += `M${x},${(y + 1.6).toFixed(1)}v-2.2m-1.8,-0.6a1.8,1.9 0 1,1 3.6,0a1.8,1.9 0 1,1 -3.6,0`; }
    else if (b === 6 && r < 0.4) birch += `M${x},${(y + 1.6).toFixed(1)}v-2.2m-1.5,-0.5a1.5,1.6 0 1,1 3,0a1.5,1.6 0 1,1 -3,0`;
    else if (b === 3 && r < 0.75) reeds += `M${(x - 1.8).toFixed(1)},${y}l-0.4,-2.2M${x},${y}v-3M${(x + 1.8).toFixed(1)},${y}l0.4,-2.2M${(x - 3.2).toFixed(1)},${(y + 1).toFixed(1)}h6.4`;
    else if ((b === 10 || b === 11) && r < 0.5) dots += `M${x},${y}h0.01`;
    else if (b === 12 && r < 0.3) dots += `M${x},${y}h0.01M${(x + 1.6).toFixed(1)},${(y - 0.8).toFixed(1)}h0.01`;
  }
  push(`<path d="${trees}" fill="${INK}" fill-opacity="0.5" stroke="${INK}" stroke-width="0.3"/>`);
  push(`<path d="${birch}" fill="none" stroke="${INK}" stroke-width="0.4" stroke-opacity="0.8"/>`);
  push(`<path d="${reeds}" fill="none" stroke="${INK}" stroke-width="0.4" stroke-opacity="0.8" stroke-linecap="round"/>`);
  push(`<path d="${dots}" fill="none" stroke="${INK}" stroke-width="0.8" stroke-opacity="0.65" stroke-linecap="round"/>`);
}

// ---------------------------------------------------------------- 5. rivers, widening to the sea
for (const r of J.rivers) {
  const pts = []; for (let i = 0; i < r.pts.length; i += 2) pts.push([r.pts[i] + 0.5, r.pts[i + 1] + 0.5]);
  if (pts.length < 3) continue;
  const sm = chaikin(chaikin(pts)), wd = Math.min(2.6, 0.35 + Math.sqrt(r.q_km2) * 0.11);
  push(`<path d="M${sm.map((p) => `${X(p[0])},${Y(p[1])}`).join("L")}" fill="none" stroke="${SEA_INK}" stroke-width="${wd.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`);
}

// ---------------------------------------------------------------- 6. roads, paths and the ferry, in the accent
for (const r of J.roads) {
  const pts = []; for (let i = 0; i < r.pts.length; i += 2) pts.push([r.pts[i], r.pts[i + 1]]);
  const sm = chaikin(chaikin(pts)), d = `M${sm.map((p) => `${X(p[0])},${Y(p[1])}`).join("L")}`;
  if (r.kind === "path") push(`<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="0.55" stroke-dasharray="0.6 2.2" stroke-linecap="round" stroke-opacity="0.85"/>`);
  else push(`<path d="${d}" fill="none" stroke="${ACCENT}" stroke-width="${r.kind === "ferry" ? 0.8 : 1.0}" stroke-dasharray="${r.kind === "ferry" ? "1.5 3" : "5 2"}" stroke-linecap="round"/>`);
}

// ---------------------------------------------------------------- 7. landmarks as signs
const SIGN = {
  tower: (x, y) => `<path d="M${x - 3},${y}L${x},${y - 26}L${x + 3},${y}z" fill="${INK}"/><path d="M${x},${y - 26}v-5h4l-1.5,1.5l1.5,1.5h-4" fill="${ACCENT}" stroke="${INK}" stroke-width="0.3"/>`,
  spire: (x, y) => `<path d="M${x - 1.8},${y}L${x},${y - 13}L${x + 1.8},${y}z" fill="${INK}" fill-opacity="0.85"/>`,
  ziggurat: (x, y) => `<path d="M${x - 7},${y}v-2.5h2.3v-2.5h2.3v-2.5h4.8v2.5h2.3v2.5h2.3v2.5z" fill="${PAPER}" stroke="${INK}" stroke-width="0.6"/>`,
  dome: (x, y) => `<path d="M${x - 4.5},${y}a4.5,5 0 0,1 9,0z" fill="${PAPER}" stroke="${INK}" stroke-width="0.6"/>`,
  stack: (x, y) => `<path d="M${x - 0.9},${y}l0.3,-7h1.2l0.3,7z" fill="${INK}"/><path d="M${x},${y - 7.5}q2,-2.5 4.5,-2" fill="none" stroke="${INK}" stroke-width="0.35" stroke-opacity="0.7"/>`,
  furnace: (x, y) => `<path d="M${x - 2.6},${y}l0.8,-6.5h3.6l0.8,6.5z" fill="${ACCENT}" stroke="${INK}" stroke-width="0.4"/>`,
  coolingtower: (x, y) => `<path d="M${x - 3},${y}q1.6,-3.5 0.4,-7h5.2q-1.2,3.5 0.4,7z" fill="${PAPER}" stroke="${INK}" stroke-width="0.5"/>`,
  seastack: (x, y) => `<path d="M${x - 1.6},${y + 1}l0.5,-4.2l1.3,-0.8l1.2,1.4l0.3,3.6z" fill="${INK}"/>`,
  lighthouse: (x, y) => `<path d="M${x - 1.2},${y}l0.5,-7h1.4l0.5,7z" fill="${PAPER}" stroke="${INK}" stroke-width="0.5"/><path d="M${x - 5},${y - 8.5}h3M${x + 2},${y - 8.5}h3M${x - 3.4},${y - 11.5}l2,1.6M${x + 3.4},${y - 11.5}l-2,1.6" stroke="${ACCENT}" stroke-width="0.6" fill="none"/>`,
  mudhif: (x, y) => `<path d="M${x - 3},${y}a3,3.4 0 0,1 6,0" fill="${PAPER}" stroke="${INK}" stroke-width="0.5"/>`,
  slab: (x, y) => `<rect x="${x - 2.4}" y="${y - 2.6}" width="4.8" height="2.6" fill="${PAPER}" stroke="${INK}" stroke-width="0.4"/>`,
  saucer: (x, y) => `<path d="M${x - 5},${y - 3}h10l-2.5,2h-5zM${x - 1},${y - 1}v1.5h2v-1.5" fill="${PAPER}" stroke="${INK}" stroke-width="0.5"/>`,
  drowned: (x, y) => `<path d="M${x - 2},${y}v-3h4v3M${x - 3.5},${y + 0.6}q1.2,-1 2.4,0t2.4,0t2.4,0" fill="none" stroke="${SEA_INK}" stroke-width="0.45"/>`,
  church: (x, y) => `<path d="M${x},${y}v-7M${x - 2},${y - 5}h4" stroke="${INK}" stroke-width="0.7" fill="none"/>`,
  chapel: (x, y) => `<path d="M${x},${y}v-6M${x - 1.6},${y - 4.2}h3.2" stroke="${INK}" stroke-width="0.6" fill="none"/>`,
  starfort: (x, y) => { let d = ""; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 4 : 8; d += `${i ? "L" : "M"}${(x + Math.cos(a) * r).toFixed(1)},${(y + Math.sin(a) * r).toFixed(1)}`; } return `<path d="${d}z" fill="none" stroke="${INK}" stroke-width="0.7"/>`; },
  cashmachine: (x, y) => `<rect x="${x - 1}" y="${y - 2.4}" width="2" height="2.4" fill="${ACCENT}" stroke="${INK}" stroke-width="0.3"/>`,
  cairn: (x, y) => `<path d="M${x - 1.5},${y}l1.5,-2.6l1.5,2.6z" fill="none" stroke="${INK}" stroke-width="0.4"/>`,
  stairs: (x, y) => `<path d="M${x - 3},${y}h1.5v-1.2h1.5v-1.2h1.5v-1.2h1.5" fill="none" stroke="${INK}" stroke-width="0.5"/>`,
};
const seen = new Map();
for (const mk of J.marks) {
  const f = SIGN[mk.kind]; if (!f) continue;
  const n = seen.get(mk.kind) || 0; seen.set(mk.kind, n + 1);
  if ((mk.kind === "slab" || mk.kind === "drowned") && n % 3) continue;      // a few stand for the many
  push(f(X(mk.x), Y(mk.y)));
}

// ---------------------------------------------------------------- 8. settlements and their names
const boxes = [];
const clash = (b) => boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);
function label(text, x, y, size, { hand = "insular", ink = INK, opacity = 1, track = 0, seed = 1, anchor = "start", weight = 1 } = {}) {
  const w = textWidth(text, size, hand, track), x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  boxes.push([x0 - 2, y - size * 1.1, x0 + w + 2, y + size * 0.4]);
  push(letter(text, x0, y, size, { hand, ink, opacity, track, seed, weight }));
}
for (const s of J.settlements) {
  const x = X(s.x), y = Y(s.y);
  if (s.kind === "seat") push(`<circle cx="${x}" cy="${y}" r="6.2" fill="${PAPER}" stroke="${INK}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="3.1" fill="${ACCENT}" stroke="${INK}" stroke-width="0.5"/>`);
  else if (s.kind === "town") push(`<circle cx="${x}" cy="${y}" r="4.6" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><circle cx="${x}" cy="${y}" r="1.7" fill="${ACCENT}"/>`);
  else if (s.kind === "village") push(`<circle cx="${x}" cy="${y}" r="1.7" fill="${PAPER}" stroke="${INK}" stroke-width="0.7"/>`);
  else push(`<rect x="${x - 1.3}" y="${y - 1.3}" width="2.6" height="2.6" fill="${PAPER}" stroke="${INK}" stroke-width="0.6"/>`);
  boxes.push([x - 7, y - 7, x + 7, y + 7]);
}
for (const s of J.settlements.filter((q) => q.kind === "seat" || q.kind === "town")) {
  const x = X(s.x), y = Y(s.y), size = s.kind === "seat" ? 11.5 : 9.5, w = textWidth(s.name, size, "insular", 0);
  const spots = [[x + 10, y + size * 0.35, "start"], [x - 10, y + size * 0.35, "end"], [x, y - 11, "middle"], [x, y + 11 + size, "middle"]];
  const spot = spots.find(([px, py, a]) => { const x0 = a === "middle" ? px - w / 2 : a === "end" ? px - w : px; return !clash([x0 - 2, py - size * 1.1, x0 + w + 2, py + size * 0.4]) && x0 > MX + 4 && x0 + w < MX + MAPW - 4; }) || spots[0];
  // a paper halo under the name so hachures do not cut through it
  const x0 = spot[2] === "middle" ? spot[0] - w / 2 : spot[2] === "end" ? spot[0] - w : spot[0];
  push(`<rect x="${(x0 - 2).toFixed(1)}" y="${(spot[1] - size * 0.95).toFixed(1)}" width="${(w + 4).toFixed(1)}" height="${(size * 1.25).toFixed(1)}" fill="${PAPER}" fill-opacity="0.72" rx="2"/>`);
  label(s.name, spot[0], spot[1], size, { seed: s.id + 3, anchor: spot[2], weight: s.kind === "seat" ? 1.15 : 1 });
}
// the Tower, the one landmark that earns a name on the sheet
const tower = J.marks.find((q) => q.kind === "tower");
if (tower) label("the Tower", X(tower.x) + 7, Y(tower.y) - 14, 9, { seed: 77 });
// rivers that reach the sea with a name
for (const r of J.rivers.filter((q) => q.name)) {
  const i = Math.floor(r.pts.length / 4) * 2, x = X(r.pts[i]) + 5, y = Y(r.pts[i + 1]) - 3, w = textWidth(r.name, 7.5, "insular", 0);
  if (clash([x - 2, y - 9, x + w + 2, y + 3])) continue;
  label(r.name, x, y, 7.5, { ink: SEA_INK, seed: r.id });
}

// ---------------------------------------------------------------- 9. the eleven names, in spaced capitals
for (const r of J.regions) {
  const words = r.name.replace(/^The /, "").toUpperCase(), size = r.cells > 150000 ? 17 : r.cells > 40000 ? 13 : 10, track = size * 0.42;
  const lines = words.length > 16 ? [words.slice(0, words.lastIndexOf(" ", 14)), words.slice(words.lastIndexOf(" ", 14) + 1)] : [words];
  let x = X(r.cx), y = Y(r.cy);
  if (r.id === 7 || r.id === 10 || r.id === 8) { x += r.id === 8 ? 40 : -10; y += r.id === 7 ? 112 : r.id === 10 ? -96 : -44; }
  if (r.id === 4) x += 40;   // small regions are named beside themselves
  lines.forEach((ln, i) => {
    const w = textWidth(ln, size, "caps", track);
    let yy = y + i * size * 1.7, tries = 0;
    while (clash([x - w / 2 - 2, yy - size * 1.1, x + w / 2 + 2, yy + size * 0.4]) && tries++ < 8) yy += size * 0.9;
    label(ln, x, yy, size, { hand: "caps", opacity: 0.78, track, seed: r.id * 13 + i, anchor: "middle", weight: 1.1 });
  });
}
label("THE LOWER SHELF", MX + 26, MY + MAPH * 0.22, 12, { hand: "caps", ink: SEA_INK, opacity: 0.7, track: 7, seed: 5 });
label("THE STRAIT", X(J.isle_centre[0] + 95), Y(J.isle_centre[1] - 70), 8.5, { hand: "caps", ink: SEA_INK, opacity: 0.75, track: 4, seed: 6 });

// ---------------------------------------------------------------- 10. the frame, title, scale and key
const frame = [];
frame.push(`<rect x="${MX - 14}" y="${MY - 14}" width="${MAPW + 28}" height="${MAPH + 28}" fill="none" stroke="${INK}" stroke-width="2.2"/><rect x="${MX - 8}" y="${MY - 8}" width="${MAPW + 16}" height="${MAPH + 16}" fill="none" stroke="${INK}" stroke-width="0.6"/>`);
{
  let ticks = "";
  const km = 1000 / J.cell_m;                                             // cells to the kilometre
  for (let k = 0; k * km < W; k += 5) { const x = X(k * km), big = k % 10 === 0; ticks += `M${x},${MY - 8}v${big ? -6 : -3}M${x},${MY + MAPH + 8}v${big ? 6 : 3}`; if (big && k) frame.push(letter(String(k), x - textWidth(String(k), 6, "caps", 0) / 2, MY - 18, 6, { hand: "caps", ink: INK, seed: k })); }
  for (let k = 0; k * km < H; k += 5) { const y = Y(k * km), big = k % 10 === 0; ticks += `M${MX - 8},${y}h${big ? -6 : -3}M${MX + MAPW + 8},${y}h${big ? 6 : 3}`; if (big && k) frame.push(letter(String(k), MX - 34, y + 2.5, 6, { hand: "caps", ink: INK, seed: k + 50 })); }
  frame.push(`<path d="${ticks}" stroke="${INK}" stroke-width="0.6" fill="none"/>`);
}
frame.push(letter("LOW WATER", MX - 8, 78, 46, { hand: "caps", ink: INK, track: 16, seed: 1, weight: 1.25 }));
frame.push(letter("the island and its eleven countries, drawn from the survey of seed " + J.seed, MX - 6, 112, 12.5, { hand: "insular", ink: INK, seed: 2 }));
// compass: a four-point star, north marked in the accent
{
  const cx = MX + MAPW - 62, cy = 80, pts = (r1, r2, rot) => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * Math.PI * 2 + rot, r = i % 2 ? r2 : r1; return `${(cx + Math.sin(a) * r).toFixed(1)},${(cy - Math.cos(a) * r).toFixed(1)}`; }).join(" ");
  frame.push(`<polygon points="${pts(34, 6, 0)}" fill="${PAPER}" stroke="${INK}" stroke-width="0.8"/><polygon points="${cx},${cy - 34} ${cx + 4.2},${cy - 4.2} ${cx},${cy}" fill="${ACCENT}" stroke="${INK}" stroke-width="0.4"/><circle cx="${cx}" cy="${cy}" r="40" fill="none" stroke="${INK}" stroke-width="0.4"/>`);
  frame.push(letter("N", cx - 4, cy - 44, 10, { hand: "caps", ink: INK, seed: 9 }));
}
// scale: ten-kilometre steps, and the day's walk between ring towns measured on this world's roads
{
  const x0 = MX, y0 = MY + MAPH + 58, km = 1000 / J.cell_m * S, roads = J.roads.filter((r) => r.kind !== "path"), med = (v) => v.sort((a, b) => a - b)[v.length >> 1];
  const dayKm = med(roads.map((r) => r.km100 / 100)), dayH = med(roads.map((r) => r.hours100 / 100));
  let d = `M${x0},${y0}h${km * 40}`;
  for (let k = 0; k <= 40; k += 10) { d += `M${x0 + k * km},${y0 - 5}v10`; frame.push(letter(String(k), x0 + k * km - 3, y0 + 20, 8, { hand: "caps", ink: INK, seed: k })); }
  for (let k = 0; k < 10; k += 2) d += `M${x0 + k * km},${y0 - 3}v6`;
  frame.push(`<path d="${d}" stroke="${INK}" stroke-width="0.8" fill="none"/><rect x="${x0}" y="${y0 - 2}" width="${km * 10}" height="4" fill="${INK}"/><rect x="${x0 + km * 20}" y="${y0 - 2}" width="${km * 10}" height="4" fill="${INK}"/>`);
  frame.push(letter("kilometres", x0 + km * 40 + 14, y0 + 4, 9, { hand: "insular", ink: INK, seed: 4 }));
  frame.push(`<path d="M${x0},${y0 - 22}v-6h${dayKm * km}v6" stroke="${ACCENT}" stroke-width="0.9" fill="none"/>`);
  frame.push(letter(`a day's walk between ring towns: ${dayKm.toFixed(0)} km, ${dayH.toFixed(1)} hours by road`, x0 + dayKm * km + 12, y0 - 22, 9, { hand: "insular", ink: INK, seed: 8 }));
}
// key
{
  const x0 = MX + MAPW - 640, y0 = MY + MAPH + 44, item = (i, sign, text) => { const x = x0 + (i % 4) * 165, y = y0 + Math.floor(i / 4) * 24; frame.push(sign(x, y)); frame.push(letter(text, x + 16, y + 3.5, 8.5, { hand: "insular", ink: INK, seed: 20 + i })); };
  item(0, (x, y) => `<circle cx="${x}" cy="${y}" r="6.2" fill="${PAPER}" stroke="${INK}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="3.1" fill="${ACCENT}" stroke="${INK}" stroke-width="0.5"/>`, "seat of a region");
  item(1, (x, y) => `<circle cx="${x}" cy="${y}" r="4.6" fill="${PAPER}" stroke="${INK}" stroke-width="0.9"/><circle cx="${x}" cy="${y}" r="1.7" fill="${ACCENT}"/>`, "ring town");
  item(2, (x, y) => `<circle cx="${x}" cy="${y}" r="1.7" fill="${PAPER}" stroke="${INK}" stroke-width="0.7"/>`, "village");
  item(3, (x, y) => `<path d="M${x - 8},${y}h16" stroke="${ACCENT}" stroke-width="1" stroke-dasharray="5 2"/>`, "road");
  item(4, (x, y) => `<path d="M${x - 8},${y}h16" stroke="${ACCENT}" stroke-width="0.6" stroke-dasharray="0.6 2.2" stroke-linecap="round"/>`, "path");
  item(5, (x, y) => `<path d="M${x - 8},${y}h16" stroke="${ACCENT}" stroke-width="0.8" stroke-dasharray="1.5 3"/>`, "ferry");
  item(6, (x, y) => SIGN.stack(x, y + 3), "stack");
  item(7, (x, y) => SIGN.tower(x, y + 9), "megastructure");
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}" role="img" aria-labelledby="t d">
<title id="t">Low Water: the island</title>
<desc id="d">A hachured map of an island ${(W * J.cell_m / 1000).toFixed(0)} km wide and ${(H * J.cell_m / 1000).toFixed(0)} km deep, with eleven regions, ${J.settlements.filter((s) => s.kind === "seat" || s.kind === "town").length} ring towns, their roads and ${J.rivers.length} river lines, generated from seed ${J.seed}.</desc>
<rect width="${SW}" height="${SH}" fill="${PAPER}"/>
<clipPath id="map"><rect x="${MX}" y="${MY}" width="${MAPW}" height="${MAPH}"/></clipPath>
<g clip-path="url(#map)">
${parts.join("\n")}
</g>
${frame.join("\n")}
</svg>
`;
writeFileSync(out, svg);
console.log(`plate: ${out} (${(svg.length / 1e6).toFixed(1)} MB, ${SW} x ${SH})`);
