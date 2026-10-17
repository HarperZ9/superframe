// Temporal stability: two neighbouring frames of a slow clip, the mean per-pixel change inside the
// figure for A (object-anchored brushwork) and C (screen-space painter). Lower is steadier.
import * as Lamb from "../cast/lamb.mjs";
import { library } from "../anim/library.mjs";
import { gbuffer } from "../render/figure.mjs";
import { albedo, light, ink, compose, NEUTRAL } from "../render/shade.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
const C = { ...Lamb }, L = library(), view = { yawDeg: 36, elevDeg: 26, height: 2.6, centre: [0, 1.05, 0] };
const frame = (f, mode) => { const { G } = gbuffer([{ C, pose: L.pose("lamb", "idle", f), facing: 20 }], view, 200, 280, 2);
  if (mode === "A") return { G, o: compose(G, albedo(G, C.palette), light(G, NEUTRAL, C.palette), ink(G, { scale: 2 })) };
  const F = paintFigure(G, C.palette); return { G, o: relight(G, F, NEUTRAL, C.palette) }; };
for (const mode of ["A", "C"]) {
  const a = frame(10, mode), b = frame(11, mode); let s = 0, n = 0, big = 0;
  for (let i = 0; i < a.G.w * a.G.h; i++) if (a.G.id[i] && b.G.id[i]) { let d = 0; for (let c = 0; c < 3; c++) d += Math.abs(a.o[i * 4 + c] - b.o[i * 4 + c]); s += d / 3; n++; if (d / 3 > 0.05) big++; }
  console.log(mode, "mean change", (s / n).toFixed(4), "pixels changed > 5%:", ((100 * big) / n).toFixed(1) + "%");
}
