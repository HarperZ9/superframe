// The wide lens's crowd tier in type (characters/runtime/crowd.mjs holds the people: each { at, face, walk, u }).
// Painted mode draws them as cards from one atlas; glyph mode sets each as a few letters by its size on
// screen, its facing and its walk phase:
//   under 2 cells tall   one letter: i ! l j by the phase (a far figure is a mark that steps)
//   2 to 3 cells         a head over a body: o over | or A by the stride
//   4 cells              head, shoulders by facing, legs by phase: o / [#] / /\ |\ /|
//   5 cells and more     a material card (glyph/matcard.mjs): letters that are materials, dyed by era and people,
//                        lit from their neighbours toward the light model's key
// Lit by the light model's key at the person (density and colour), hidden where the world stands nearer.
// Original code.   drawCrowd(people | { people }, grid, out, atlas, model) -> people drawn
import { projectPlate } from "../../world/camera.mjs";
import { CARDS, MATERIALS, litCard, dyeOf } from "./matcard.mjs";
import { screenLights } from "./figlight.mjs";

const FAR = ["i", "!", "l", "j"], MID_BODY = ["|", "A", "|", "A"], LEGS = ["/\\", "|\\", "||", "/|"];
const enc = (v) => Math.round(255 * (1 - Math.exp(-2.2 * Math.max(0, v))));
function put(out, grid, atlas, x, y, ch0, col, depth) {
  const { cols, rows, C } = grid; if (x < 0 || y < 0 || x >= cols || y >= rows) return;
  const I = grid.I0 + x, J = grid.J0 + y; if (I >= 0 && J >= 0 && I < C.nI && J < C.nJ && C.depth[J * C.nI + I] < depth - 0.35) return;   // the world stands nearer here
  const i = y * cols + x; if (out.EM[i] > 100) return;
  out.G[i] = atlas.index(ch0); for (let c = 0; c < 3; c++) { out.FG[i * 3 + c] = col[c]; out.BG[i * 3 + c] = Math.round(out.BG[i * 3 + c] * 0.55); }
}
// a person's letters by its height in cells, as rows of [dx, string] from the head down
function shapeOf(rowsTall, phase, side) {
  const k = Math.floor(phase * 4) % 4;
  if (rowsTall < 2) return [[0, FAR[k]]];
  if (rowsTall < 4) return [[0, "o"], [0, MID_BODY[k]]];
  return [[0, "o"], [side ? 0 : -1, side ? "#" : "[#]"], [side ? 0 : -1, side ? LEGS[k][0] : LEGS[k]]];
}
function drawOne(p, grid, out, atlas, model) {
  const { C, ox, oy, cw, ch, z, left, top } = grid, pj = C.pj, f = C.fwd, cp = C.camPos;
  const s = projectPlate(pj.camera, pj.width, pj.height, p.at), sx = (s[0] - left) * z, sy = (s[1] - top) * z;
  const ppm = (pj.pxPerMetre || 80) * z, tall = (1.7 * ppm) / ch, depth = (p.at[0] - cp[0]) * f[0] + (p.at[1] - cp[1]) * f[1] + (p.at[2] - cp[2]) * f[2];
  const rig = model.figure(p.at), kl = 0.2126 * rig.key.c[0] + 0.7152 * rig.key.c[1] + 0.0722 * rig.key.c[2], v = 0.18 + 0.5 * Math.min(1, kl);
  const col = [enc(0.24 * v * 3), enc(0.23 * v * 3), enc(0.27 * v * 3)], side = Math.abs(Math.cos((p.face || 0) - ((pj.camera.yawDeg || 0) * Math.PI) / 180)) > 0.7;
  if (tall >= 5) return drawCard(p, { sx, sy, tall, depth, side, rig }, grid, out, atlas, model);
  const rows = shapeOf(tall, p.walk ? p.u || 0 : 0, side), x0 = Math.floor((sx - ox) / cw), yTop = Math.floor((sy - tall * ch - oy) / ch) + Math.max(0, Math.round(tall) - rows.length);
  rows.forEach(([dx, str], r) => { for (let k = 0; k < str.length; k++) put(out, grid, atlas, x0 + dx + k, yTop + r, str[k], col, depth); });
}
// a near person as a material card, lit from its neighbours toward the key on screen
function drawCard(p, { sx, sy, tall, depth, side, rig }, grid, out, atlas, model) {
  const { ox, oy, cw, ch, C } = grid, card = CARDS[p.card || (side ? "side" : p.people === "hesh" ? "heshFront" : "front")];
  const L = screenLights(rig, C.pj.camera), x0 = Math.floor((sx - ox) / cw) - (card[0].length >> 1), y0 = Math.floor((sy - tall * ch - oy) / ch) + Math.max(0, Math.round(tall) - card.length);
  for (const c of litCard(card, [L.key.v[0], L.key.v[1]])) {
    const dye = dyeOf(c.mat, model.era || 0), k = [0.25, 0.6, 1.1][c.step], col = dye.map((d, i) => enc(d * (rig.amb[i] * 1.4 + rig.key.c[i] * k + rig.fill.c[i] * 0.3) * 1.6));
    put(out, grid, atlas, x0 + c.dx, y0 + c.dy, MATERIALS[c.mat].g[c.step], col, depth);
  }
}
export function drawCrowd(crowd, grid, out, atlas, model) {
  const people = Array.isArray(crowd) ? crowd : crowd && crowd.people; if (!people || !people.length) return 0;
  const f = grid.C.fwd, cp = grid.C.camPos, dep = (p) => (p.at[0] - cp[0]) * f[0] + (p.at[1] - cp[1]) * f[1] + (p.at[2] - cp[2]) * f[2];
  const list = [...people].sort((a, b) => dep(b) - dep(a));   // far first, so a nearer person is set over
  for (const p of list) drawOne(p, grid, out, atlas, model);
  return list.length;
}
