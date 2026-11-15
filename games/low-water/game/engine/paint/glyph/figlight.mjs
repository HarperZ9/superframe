// Light on a figure in type (design/art/GLYPH-LANGUAGE.md section 4). The light model gives each figure a
// key, a fill and a rim (glyph/lightmodel.mjs figure()); here they are turned to the screen and read per
// covered cell from the cell's pseudo-normal (its place across the limb or body):
//   key   density and weight: the lit side takes its part's densest glyph in the bold cut, the turning
//         side the middle of the ramp, the shadow side the sparse end in the regular cut, dim
//   fill  the shadow side's floor (the sky or the room), so a shadow is never a hole
//   rim   a bright edge: an edge cell whose outward side faces the rim light takes a line along the bone
//         (or the shape-matched mark) in the rim's colour, bold
// Then the figure is held apart from its ground by value, in whichever direction it already leans: a lit
// mass at SEP times the ground round it, or a dark mass under 1/SEP of it with its rim kept (the coordinator's
// rule, 2026-10-21: a figure beats the ground on value or texture, not hue alone). Original code.
import { camBasis } from "../../world/plateworld.mjs";
import { shownLum } from "./figcover.mjs";

export const SEP = 2.0, SPARSE = 0.12;
// each part's ramp from the shadow side to the lit side (wool, trousers, boots, skin, hat, the tool)
export const PART_RAMP = { coat: "%&&MW", trouser: ":|!H#", boot: ".mm@@", skin: ".oO00", hat: "-==##", tool: "||" };
export const MAT = { coat: [0.22, 0.23, 0.27], trouser: [0.18, 0.17, 0.18], boot: [0.13, 0.1, 0.09], skin: [0.84, 0.64, 0.52], hat: [0.1, 0.09, 0.1], tool: [0.62, 0.5, 0.3] };
const enc = (v) => Math.round(255 * (1 - Math.exp(-2.2 * Math.max(0, v))));
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// a world direction toward a light as a screen vector: x right, y down, z toward the camera
export function screenLights(rig, cam) {
  const B = camBasis(cam), to = (d) => { const v = [d[0] * B.right[0] + d[1] * B.right[1] + d[2] * B.right[2], -(d[0] * B.up[0] + d[1] * B.up[1] + d[2] * B.up[2]), -(d[0] * B.f[0] + d[1] * B.f[1] + d[2] * B.f[2])], l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  return { key: { v: to(rig.key.dir), c: rig.key.c, wrap: rig.key.wrap ?? 0.3 }, fill: { v: to(rig.fill.dir), c: rig.fill.c }, rim: { v: to(rig.rim.dir), c: rig.rim.c }, amb: rig.amb };
}
// one covered cell: its pseudo-normal from the place across the part, and what each light gives it
export function lightCell(cell, foot, L) {
  const [d, , qx, qy] = foot, s = cell.best, r = Math.min(0.999, d / s.r), ux = d > 1e-3 ? (cell.cx - qx) / d : 0, uy = d > 1e-3 ? (cell.cy - qy) / d : 0, nz = Math.sqrt(1 - r * r);
  const n = [ux * r, uy * r, nz], dot = (v) => n[0] * v[0] + n[1] * v[1] + n[2] * v[2];
  const key = Math.max(0, (dot(L.key.v) + L.key.wrap) / (1 + L.key.wrap)), fill = Math.max(0, dot(L.fill.v)) * 0.6 + 0.4;
  const rim = r > 0.55 ? Math.max(0, ux * L.rim.v[0] + uy * L.rim.v[1]) * (r - 0.55) / 0.45 : 0;
  return { key, fill, rim, edge: r };
}
// the cell's glyph character, colour and ground from its part, its light and the part's albedo
export function shadeCell(cell, lc, L, col) {
  const m = cell.best.m, rp = PART_RAMP[m] || "#", kl = lum(L.key.c), rimOn = lc.rim * lum(L.rim.c) > 0.05 && lc.rim > 0.35;
  const lin = [0, 1, 2].map((c) => col[c] * (L.amb[c] * 1.4 + L.key.c[c] * lc.key + L.fill.c[c] * lc.fill));
  const step = Math.min(rp.length - 1, Math.floor(Math.min(0.999, lc.key * Math.min(1.4, 0.5 + kl)) * rp.length));
  if (rimOn) { const rc = L.rim.c, k = 0.35 + lc.rim * 1.6; return { rim: true, ch: null, fg: [enc(rc[0] * k + 0.15), enc(rc[1] * k + 0.13), enc(rc[2] * k + 0.12)], bold: true }; }
  const fg = lin.map((v) => enc(v * 1.6)), bold = lc.key > 0.62 && kl > 0.25;
  return { rim: false, ch: rp[step], fg, bg: fg.map((v) => Math.round(v * 0.34)), bold };
}
// hold the figure apart from its ground by value, toward whichever side it already leans
export function separate(out, atlas, cover, ring, rims) {
  let fl = 0, n = 0; for (const oi of cover.keys()) { if (rims.has(oi)) continue; fl += shownLum(out, atlas, oi); n++; } fl = n ? fl / n : 0;
  const dark = n > 0 && fl < ring * 0.85 && ring > 30;
  const want = dark ? ring / SEP : Math.min(235, Math.max(ring * SEP, 60)), k = fl > 0 ? (dark ? Math.min(1, want / fl) : Math.max(1, want / fl)) : 1;
  if (k !== 1) for (const oi of cover.keys()) { if (rims.has(oi)) continue; for (let c = 0; c < 3; c++) { out.FG[oi * 3 + c] = Math.min(255, out.FG[oi * 3 + c] * k); out.BG[oi * 3 + c] = Math.min(255, out.BG[oi * 3 + c] * k); } }
  return { dark, figure: fl * k, k };
}
// the band round the figure: a lit mass stands on a cleared dark ring; a dark mass on ground thinned to sparse
// marks (its value kept, so the figure is darker than it), two cells out
export function quietBand(out, atlas, grid, box, cover, dark) {
  const { cols, rows } = grid, dot = atlas.index("."), blank = atlas.index(" ");
  for (let y = Math.max(0, box.y0 - 2); y <= Math.min(rows - 1, box.y1 + 2); y++) for (let x = Math.max(0, box.x0 - 2); x <= Math.min(cols - 1, box.x1 + 2); x++) {
    const q = y * cols + x; if (cover.has(q) || out.EM[q]) continue;
    let near = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (cover.has((y + dy) * cols + x + dx)) near = Math.max(near, Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 2 : 1);
    if (!near) continue;
    if (!dark && near === 2) { out.G[q] = blank; out.BG[q * 3] = 8; out.BG[q * 3 + 1] = 6; out.BG[q * 3 + 2] = 9; }
    else if ((atlas.cov[out.G[q]] || 0) > SPARSE) out.G[q] = dot;
  }
}
