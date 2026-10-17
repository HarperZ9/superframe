// Close-ups through the painter (prototype C's strength: a still or slow portrait).
import { library } from "../anim/library.mjs";
import { gbuffer, paste } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { RIGS } from "../render/rigs.mjs";
import { writePng, toRgba8, down } from "../render/io.mjs";
const [clip = "idle", fr = "0", out = "out/closeups-painted.png"] = process.argv.slice(2), names = ["lamb", "fennick", "marrow"];
const cast = await Promise.all(names.map(async (n) => ({ ...(await import(`../cast/${n}.mjs`)) })));
const L = library(Object.fromEntries(names.map((n, i) => [n, cast[i].style]).filter(([, s]) => s)));
const cw = 480, ch = 560, W = cw * 3, img = new Float32Array(W * ch * 4); for (let i = 0; i < W * ch; i++) img.set([0.16, 0.11, 0.1, 1], i * 4);
const rig = { ...RIGS.brine.rig, lamps: [{ pos: [-1.6, 2.6, 1.6], c: [1, 0.75, 0.45], power: 9 }, { pos: [1.8, 1.6, -1.2], c: [0.6, 0.45, 0.5], power: 3 }] };
names.forEach((n, k) => {
  const P = cast[k].P, view = { yawDeg: 34, elevDeg: 14, height: 1.15, centre: [0, P.h - 0.42, 0] };
  const { G } = gbuffer([{ C: cast[k], pose: L.pose(n, clip, +fr), facing: 34 - 30 }], view, cw, ch, 2);
  const F = paintFigure(G, cast[k].palette, { rig }), r = down(relight(G, F, rig, cast[k].palette), G.w, G.h, 2);
  paste(img, W, ch, r.rgba, r.w, r.h, k * cw, 0);
});
writePng(out, { width: W, height: ch, data: toRgba8(img, W, ch) });
