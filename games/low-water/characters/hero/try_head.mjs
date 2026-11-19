// node hero/try_head.mjs OUT.png [cell]: the hero head alone as clay, front, three-quarter, profile
import { prepare, polygonise } from "../forge/mesher.mjs";
import { headShapes, headDisp, eyeCentres, EYE_R } from "./head.mjs";
import { clay } from "./preview.mjs";
import { writePng } from "../render/io.mjs";
const out = process.argv[2] || "head.png", cell = +(process.argv[3] || 0.0015), face = { gaunt: 0.6, nose: { len: 1.12, hook: 0.5 } };
const t0 = Date.now(), F = prepare(headShapes(face), { band: 0.01, disp: headDisp(face) });
const pos = [], nrm = [], tri = [];
polygonise(F, { lo: [-0.11, -0.2, -0.14], hi: [0.11, 0.15, 0.13], cell, tri, vert: (p, n) => { pos.push(...p); nrm.push(...n); return pos.length / 3 - 1; } });
console.log(`head: ${tri.length / 3} triangles, ${pos.length / 3} vertices, ${Date.now() - t0} ms`);
// eyeballs as spheres for the preview
const eyes = { pos: [], nrm: [], tri: [], col: [] };
for (const c of eyeCentres({ s: 1 })) {
  const b = eyes.pos.length / 3, N = 24;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const th = (i / N) * Math.PI, ph = (j / N) * 2 * Math.PI, n = [Math.sin(th) * Math.sin(ph), Math.cos(th), Math.sin(th) * Math.cos(ph)]; eyes.pos.push(c[0] + n[0] * EYE_R, c[1] + n[1] * EYE_R, c[2] + n[2] * EYE_R); eyes.nrm.push(...n); const ir = Math.hypot(n[0], n[1]); eyes.col.push(...(n[2] > 0 && ir < 0.45 ? (ir < 0.2 ? [0.02, 0.02, 0.02] : [0.25, 0.32, 0.38]) : [0.85, 0.82, 0.78])); }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = b + i * (N + 1) + j; eyes.tri.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
}
const M = { pos, nrm, tri }, d = 0.42;
const views = [{ eye: [0, 0, d], at: [0, -0.03, 0.02], fov: 32 }, { eye: [d * 0.7, 0.04, d * 0.7], at: [0, -0.03, 0.02], fov: 32 }, { eye: [d, 0, 0.02], at: [0, -0.03, 0.02], fov: 32 }];
const W = 700, H = 900;
writePng(out, { width: W * 3, height: H, data: clay([M, eyes], views, W, H) });
