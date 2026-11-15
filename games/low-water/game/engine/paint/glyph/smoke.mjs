// Smoke and steam in type: the same puffs as painted mode (paint/smoke.mjs); a cell takes a sparse mark
// when the density there beats the blue noise at that WORLD cell, its mark by density (. : ; ~), in a
// cool grey. Moved out of glyph/renderer.mjs unchanged (render/PROGRESS.md 75). Original code.
//   const draw = makeSmoke(atlas); draw(scene, grid, out)
import { smokeField } from "../smoke.mjs";
import { blueNoise } from "./bluenoise.mjs";
import { projectPlate } from "../../world/camera.mjs";
const BNS = blueNoise(64);

function stamp(q, grid, out, SM, ppm) {
  const { cols, rows, ox, oy, cw, ch, z, left, top, I0, J0, C } = grid, pj = C.pj;
  const c = projectPlate(pj.camera, pj.width, pj.height, q.p), sx = (c[0] - left) * z, sy = (c[1] - top) * z, r = q.r * ppm;
  for (let y = Math.max(0, Math.floor((sy - r - oy) / ch)); y <= Math.min(rows - 1, Math.ceil((sy + r - oy) / ch)); y++) for (let x = Math.max(0, Math.floor((sx - r - ox) / cw)); x <= Math.min(cols - 1, Math.ceil((sx + r - ox) / cw)); x++) {
    const e = ((ox + x * cw + cw / 2 - sx) ** 2 + (oy + y * ch + ch / 2 - sy) ** 2) / (r * r); if (e >= 1) continue;
    const d = q.d * (1 - e) * (1 - e); if (d < BNS.at(I0 + x, J0 + y)) continue;
    const v = y * cols + x; if (out.EM[v] > 100) continue;
    out.G[v] = SM[Math.min(3, Math.floor(d * 4))]; const g = 90 + 70 * d; out.FG[v * 3] = g; out.FG[v * 3 + 1] = g * 0.98; out.FG[v * 3 + 2] = g * 1.06;
  }
}
export function makeSmoke(atlas) {
  const smoke = smokeField(7), SM = [".", ":", ";", "~"].map((c) => atlas.index(c)); let t = performance.now();
  return function draw(scene, grid, out) {
    const now = performance.now(), dt = Math.min(0.1, (now - t) / 1000); t = now;
    const pj = scene.place, puffs = smoke.step(pj, scene.variant, dt, 0.25 + 0.5 * Math.min(1, (scene.terms.wind || 0) / 1.5)); if (!puffs.length) return;
    const ppm = (pj.pxPerMetre || 80) * grid.z;
    for (const q of puffs) if (q.d >= 0.03) stamp(q, grid, out, SM, ppm);
  };
}
