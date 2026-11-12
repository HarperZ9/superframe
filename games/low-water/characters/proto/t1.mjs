// Painted figure test: one pose, neutral light, painter vs live, side by side.
import * as Lamb from "../cast/lamb.mjs";
import { library } from "../anim/library.mjs";
import { gbuffer, live, paste } from "../render/figure.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { writePng, toRgba8, down } from "../render/io.mjs";
const C = { ...Lamb }, L = library(), pose = L.pose("lamb", "talk_b", 24);
const view = { yawDeg: 36, elevDeg: 26, height: 2.4, centre: [0, 1.0, 0] }, w = 360, h = 520;
let t = Date.now(); const a = live([{ C, pose, facing: 36 - 25 }], view, w, h, { bands: 0 }); const tA = Date.now() - t;
t = Date.now(); const { G } = gbuffer([{ C, pose, facing: 36 - 25 }], view, w, h, 2); const F = paintFigure(G, C.palette); const c = down(relight(G, F, NEUTRAL, C.palette), G.w, G.h, 2); const tC = Date.now() - t;
const W = w * 2, img = new Float32Array(W * h * 4); for (let i = 0; i < W * h; i++) img.set([0.55, 0.53, 0.5, 1], i * 4);
paste(img, W, h, a.rgba, a.w, a.h, 0, 0); paste(img, W, h, c.rgba, c.w, c.h, w, 0);
writePng("out/t1-live-vs-painted.png", { width: W, height: h, data: toRgba8(img, W, h) });
console.log("live ms", tA, "painted ms", tC);
