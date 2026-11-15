// Snow at night in type (the author's references of 2026-10-22, techniques only: a near 1-bit snowy road
// under one streetlamp with tracks through the pool; pixel snow seen only inside a lamp's cone):
//   falling snow   flakes drift in screen space with the wind, but a flake shows only where the cell under
//                  it is lit (the frame's light cells, the shared model's when it is in): sparse bright marks in
//                  the lamp pools, nothing in the dark
//   footprints     where people walk on snow, their feet leave prints (world points kept per place); inside a
//                  pool a print is a darker stroke in the lit snow, outside it is not seen
// Cart ruts are open: the plates carry no cart path. Original code.
//   const S = makeSnowfall(atlas); S.prints(scene, figures); S.draw(scene, grid, out, model)
import { projectPlate } from "../../world/camera.mjs";
const LIT = 0.06, MAX_PRINTS = 600, FLAKES = 700;

export function makeSnowfall(atlas) {
  const rnd = (() => { let s = 911; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  let flakes = null, last = performance.now(), place = "", prints = [], lastPrint = 0;
  const marks = [".", "'", "*"].map((c) => atlas.index(c)), print = atlas.index(",");
  const litAt = (grid, x, y) => { const { C, E } = grid, I = grid.I0 + x, J = grid.J0 + y; if (!E || I < 0 || J < 0 || I >= C.nI || J >= C.nJ) return 0; const k = J * C.nI + I; return 0.2126 * E[k * 3] + 0.7152 * E[k * 3 + 1] + 0.0722 * E[k * 3 + 2]; };
  return {
    // feet on the ground every half second, per place
    prints(scene, figs) {
      if (scene.place.place !== place) { place = scene.place.place; prints = []; }
      const now = performance.now(); if (now - lastPrint < 500 || !figs) return; lastPrint = now;
      for (const F of figs) for (const j of [16, 19]) { const p = F.joints && F.joints[j]; if (p && !prints.some((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.25)) prints.push([p[0], p[1], p[2]]); }
      if (prints.length > MAX_PRINTS) prints.splice(0, prints.length - MAX_PRINTS);
    },
    draw(scene, grid, out, model) {
      if (!(model.snow > 0) || model.day > 0.5) return 0;   // the famine winter's night
      const { C, cols, rows, ox, oy, cw, ch, z, left, top } = grid, pj = C.pj, now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
      let n = 0;
      for (const p of prints) {
        const s = projectPlate(pj.camera, pj.width, pj.height, p), x = Math.floor(((s[0] - left) * z - ox) / cw), y = Math.floor(((s[1] - top) * z - oy) / ch);
        if (x < 0 || y < 0 || x >= cols || y >= rows || litAt(grid, x, y) < LIT) continue;
        const i = y * cols + x; if (out.EM[i] || out.HOT[i]) continue; out.G[i] = print; for (let c = 0; c < 3; c++) { out.FG[i * 3 + c] = Math.round(out.BG[i * 3 + c] * 0.45); out.BG[i * 3 + c] = Math.round(out.BG[i * 3 + c] * 0.8); } n++;
      }
      flakes ||= Array.from({ length: FLAKES }, () => ({ x: rnd(), y: rnd(), v: 0.15 + 0.2 * rnd(), w: rnd() }));
      const wind = (scene.terms && scene.terms.wind) || 0.3;
      for (const f of flakes) {
        f.y += dt * f.v * 0.25; f.x += dt * (wind * 0.02 + Math.sin(now / 900 + f.w * 6) * 0.004); if (f.y > 1) { f.y -= 1; f.x = rnd(); } f.x = (f.x + 1) % 1;
        const x = Math.floor(f.x * cols), y = Math.floor(f.y * rows); if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        const l = litAt(grid, x, y); if (l < LIT) continue;   // a flake is seen only in the light
        const i = y * cols + x; if (out.EM[i] > 100 || out.HOT[i]) continue;
        out.G[i] = marks[Math.min(2, Math.floor(f.w * 3))]; const k = Math.min(1, 0.55 + l * 2); out.FG[i * 3] = 225 * k; out.FG[i * 3 + 1] = 232 * k; out.FG[i * 3 + 2] = 245 * k; n++;
      }
      return n;
    },
  };
}
