// Runtime cost of the real-time path (prototype A) at game sizes: skin + raster + shade + ink, per figure.
import * as Lamb from "../cast/lamb.mjs";
import { library } from "../anim/library.mjs";
import { solve } from "../rig/skeleton.mjs";
import { skin } from "../rig/body.mjs";
import { spriteView, rasterize, makeG, placeFn } from "../render/raster.mjs";
import { albedo, light, ink, compose } from "../render/shade.mjs";
import { RIGS } from "../render/rigs.mjs";
const C = { ...Lamb }, { M, B } = C.build(), L = library();
for (const [label, hpx, ss] of [["quay now (45 px)", 45, 1], ["quay 2.5x (110 px)", 110, 1], ["room (180 px)", 180, 1], ["room ss2", 180, 2], ["close (420 px)", 420, 1]]) {
  const w = Math.ceil(hpx * 0.9 * ss), h = Math.ceil(hpx * 1.3 * ss), V = spriteView({ yawDeg: 36, elevDeg: 26 }, { w, h, height: 2.6, centre: [0, 1.05, 0] });
  const N = 30, t = { skin: 0, raster: 0, shade: 0 };
  for (let k = 0; k < N; k++) {
    let a = performance.now(); const S = skin(M, B, solve(C.P, L.pose("lamb", "walk", k))); t.skin += performance.now() - a;
    a = performance.now(); const G = rasterize(V, M, S, makeG(w, h), placeFn(36 + k * 7)); t.raster += performance.now() - a;
    a = performance.now(); const A = albedo(G, C.palette), E = light(G, RIGS.quay.rig, C.palette), I = ink(G, { scale: ss }); compose(G, A, E, I, { bands: 4 }); t.shade += performance.now() - a;
  }
  console.log(label.padEnd(20), Object.entries(t).map(([k, v]) => `${k} ${(v / N).toFixed(2)} ms`).join("  "), " total", ((t.skin + t.raster + t.shade) / N).toFixed(2), "ms");
}
