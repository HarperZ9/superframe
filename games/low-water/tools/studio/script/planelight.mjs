// A scripted form override, part two: the light painted from the planes. Two layers (the coordinator,
// 2026-10-22): "form shadow" holds the shadow side as one darker mass, laid in large overlapping strokes
// that follow the jaw and the cheek (their angle turning with the form, never stacked verticals), and the
// small planes that turn away (the nose's side and base, under the jaw); "form light" holds the planes
// that face the key as value and colour only, at partial opacity (the layer's), so the underpainting's own
// stroke light shows through on the lit side. Each coat covers its plane (no gaps: the mosaic check reads
// the coat's own cover, not its opacity); soft plane edges get a scumble, the true breaks (the brow shelf,
// the side of the nose) stay hard. Records only.
//   planeLight(ref, lm, g, doc) -> [record]   fillStrokes(ref, doc, open) -> [record]
import { mix as kmMix } from "../../../game/engine/paint/km.mjs";
import { IDS } from "./landmarks.mjs";
import { rec } from "./face.mjs";
import { planeAt } from "./planes.mjs";
import { planeNormal, formLight, formNormalAt } from "../core/form.mjs";
import { rnd } from "../core/brush.mjs";

const SIDE = new Set(["temple", "brow, side", "socket, side", "cheek, side", "jaw, side"]);
const solid = { tool: "brush", flow: 0.85, load: 1, dry: 0, depletion: 0.003, pickup: 0.15, bristles: 30, spread: 2.6, impasto: 0.25, wetUnder: true };
const line = (x, y, d, L, p = 0.85) => { const m = Math.hypot(...d) || 1, ux = d[0] / m, uy = d[1] / m; return [[x - ux * L / 2, y - uy * L / 2, p * 0.7], [x, y, p], [x + ux * L / 2, y + uy * L / 2, p * 0.7]]; };
const turn = (d, a) => [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)];
const dark = (q) => q.v < 0.15;
const layerOf = (q) => (dark(q) ? "form shadow" : "form light");

function samples(lm, g, doc, step) {
  const f = g.face, skin = lm.mask([...IDS.skin, ...IDS.lip]), K = doc.meta.keyDir, km = Math.hypot(...K) || 1, out = [];
  for (let y = f.y0; y <= f.y1; y += step) for (let x = f.x0; x <= f.x1; x += step) {
    if (!skin[y * lm.w + x]) continue; const p = planeAt(x, y, g), n = planeNormal(p, g.facing);
    out.push({ x, y, p, n, v: (n[0] * K[0] + n[1] * K[1] + n[2] * K[2]) / km });
  }
  return out;
}
// the shadow side: one tone over the whole mass, large overlapping strokes along each plane's run, the
// angle turned a little each time (down the cheek, along the jaw), so it reads as one shape that turns
function shadowMass(ref, doc, g, out) {
  const size = doc.w / 16, S = samples(g.lm, g, doc, Math.round(size * 0.7)).filter((q) => SIDE.has(q.p.name) && dark(q)), rand = rnd(74); if (S.length < 2) return;
  const tone = S.reduce((a, q) => a.map((c, k) => c + formLight(doc, q.n)[k] / S.length), [0, 0, 0]);
  for (const q of S) out.push(rec(ref, "form shadow", { ...solid, colour: tone.map((c) => c * (0.96 + rand() * 0.08)), size: size * (0.9 + rand() * 0.3), flow: 0.8 }, line(q.x, q.y, turn(q.p.dir, (rand() - 0.5) * 0.9), size * 2.4), 14000 + out.length));
}
// every other plane: its coat, broad or small, along the way it runs, on the layer its light belongs to
function baseCoats(ref, doc, g, out) {
  for (const big of [true, false]) {
    const size = big ? doc.w / 30 : doc.w / 75, S = samples(g.lm, g, doc, Math.round(size * 0.8)), rand = rnd(big ? 71 : 72);
    for (const q of S) {
      if (q.p.big !== big || (SIDE.has(q.p.name) && dark(q))) continue;
      out.push(rec(ref, layerOf(q), { ...solid, colour: formLight(doc, q.n), size: size * (0.9 + rand() * 0.25) }, line(q.x + (rand() - 0.5) * size * 0.3, q.y + (rand() - 0.5) * size * 0.3, turn(q.p.dir, (rand() - 0.5) * 0.5), size * 2.2), 15000 + out.length));
    }
  }
}
// plane edges: a soft scumble of both planes' colours across each soft edge; the true breaks stay hard
function edges(ref, doc, g, out) {
  const step = Math.round(doc.w / 60), S = samples(g.lm, g, doc, step), at = new Map(S.map((q) => [`${q.x},${q.y}`, q]));
  for (const q of S) for (const [dx, dy] of [[step, 0], [0, step]]) {
    const r = at.get(`${q.x + dx},${q.y + dy}`); if (!r || r.p.name === q.p.name || q.p.hard || r.p.hard) continue;
    const c = kmMix(formLight(doc, q.n), formLight(doc, r.n), 0.5);
    out.push(rec(ref, dark(q) && dark(r) ? "form shadow" : "form light", { tool: "brush", colour: c, size: step * 1.4, flow: 0.45, load: 0.9, pickup: 0.7, bristles: 30, spread: 3, impasto: 0, depletion: 0.004, wetUnder: true }, line(q.x + dx / 2, q.y + dy / 2, [dy, dx], step * 2.2, 0.7), 16000 + out.length));
  }
}
export function planeLight(ref, lm, g, doc) {
  const out = [], G2 = { ...g, lm }; shadowMass(ref, doc, G2, out); baseCoats(ref, doc, G2, out); edges(ref, doc, G2, out);
  return out;
}
// the open places left after the coats: one solid stroke of the plane's own light per open cell
export function fillStrokes(ref, doc, open) {
  const cell = Math.round(doc.w / 64), seen = new Set(), out = [];
  for (const i of open) {
    const x = i % doc.w, y = (i / doc.w) | 0, k = `${(x / cell) | 0},${(y / cell) | 0}`; if (seen.has(k)) continue; seen.add(k);
    const n = formNormalAt(doc, i); if (!n) continue;
    const K = doc.meta.keyDir, v = (n[0] * K[0] + n[1] * K[1] + n[2] * K[2]) / (Math.hypot(...K) || 1);
    out.push(rec(ref, v < 0.15 ? "form shadow" : "form light", { ...solid, colour: formLight(doc, n), size: cell * 0.9, flow: 0.9 }, line(x, y, [1, 0.3], cell * 1.2), 18000 + out.length));
  }
  return out;
}
