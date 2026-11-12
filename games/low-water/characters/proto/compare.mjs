// Prototype comparison on the baked plates: A (real-time look: skinned mesh, object-anchored
// brushwork, banded light, ink) against C (the engine painter over the same G-buffer, relit).
//   node proto/compare.mjs <quay|brine> <A|C> [zoom] [clip] [frame]
import { library } from "../anim/library.mjs";
import { gbuffer } from "../render/figure.mjs";
import { albedo, light, ink, compose } from "../render/shade.mjs";
import { paintFigure, relight } from "../render/painted.mjs";
import { loadPlate, ppmAt, shadow, place } from "../render/plate.mjs";
import { RIGS } from "../render/rigs.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
const [where = "quay", mode = "A", zoomArg = "1", clip = "idle", fr = "10", tag = ""] = process.argv.slice(2), zoom = +zoomArg, SCALE = +(process.env.FIG_SCALE || 1);
const names = ["lamb", "fennick", "marrow"], cast = Object.fromEntries(await Promise.all(names.map(async (n) => [n, { ...(await import(`../cast/${n}.mjs`)) }])));
const L = library(Object.fromEntries(names.map((n) => [n, cast[n].style]).filter(([, s]) => s)));
const SCENES = {
  quay: [{ who: "fennick", at: [-2.7, -2.3, 2.9], facing: 10, clip: "talk_a" }, { who: "marrow", at: [-2.15, 0, -2.25], facing: 70 }, { who: "lamb", at: [-1.3, 0, -2.5], facing: -40 }],
  brine: [{ who: "fennick", at: [-0.9, 0, 0.9], facing: 50, clip: "talk_a" }, { who: "lamb", at: [0.5, 0, 0.9], facing: -80, clip: "talk_b" }],
  weigh: [{ who: "marrow", at: [0.9, 0, -0.4], facing: 30, clip: "talk_c" }, { who: "lamb", at: [2.1, 0, 1.1], facing: -150, clip: "idle" }],
};
const plate = loadPlate(where), R = RIGS[where], t0 = Date.now();
for (const f of [...SCENES[where]].sort((a, b) => b.at[2] + b.at[0] - a.at[2] - a.at[0])) shadow(plate, f.at, f.who === "marrow" ? 0.55 : 0.42);
const order = [...SCENES[where]].map((f) => ({ ...f, d: -(f.at[0] * plate.cam.fwd[0] + f.at[2] * plate.cam.fwd[2]) })).sort((a, b) => a.d - b.d);
for (const f of order) {
  const C = cast[f.who], ppm = ppmAt(plate, f.at) * zoom, hM = 2.8 * SCALE, h = Math.ceil(hM * ppm), w = Math.ceil(h * 0.8), ss = zoom > 1 ? 2 : 3;
  const view = { yawDeg: plate.info.camera.yawDeg, elevDeg: plate.info.camera.elevDeg, height: hM, centre: [f.at[0], f.at[1] + 1.05 * SCALE, f.at[2]] };
  const pose = L.pose(f.who, f.clip || clip, +fr); pose.root = { ...pose.root, x: 0, z: 0 };
  const { G } = gbuffer([{ C, pose, facing: plate.info.camera.yawDeg + f.facing, at: f.at, scale: SCALE }], view, w, h, ss, R.rig);
  let layer;
  if (mode === "A") { const A = albedo(G, C.palette), E = light(G, R.rig, C.palette), I = ink(G, { scale: ss * 0.7 }); layer = compose(G, A, E, I, { bands: 4 }); if (R.tone) for (let i = 0; i < G.w * G.h; i++) if (G.id[i]) { const t = R.tone([layer[i * 4], layer[i * 4 + 1], layer[i * 4 + 2]]); layer.set(t, i * 4); } }
  else { const F = paintFigure(G, C.palette, { scale: 1.2 }); layer = relight(G, F, R.rig, C.palette, R.tone); }
  place(zoom > 1 ? null : plate, layer, G, ss, view.centre);
  f.layer = layer; f.G = G; f.ss = ss; f.centre = view.centre;
}
let out = plate.img, W = plate.W, H = plate.H;
if (zoom > 1) {
  // crop around the group and upscale the plate; figures re-rendered at the zoomed scale
  const c = order.map((f) => plate.project(f.at)), cx = c.reduce((a, p) => a + p[0], 0) / c.length, cy = c.reduce((a, p) => a + p[1], 0) / c.length - 40;
  const x0 = Math.round(cx - W / zoom / 2), y0 = Math.round(cy - H / zoom / 2), img = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.min(W - 1, Math.max(0, Math.floor(x0 + x / zoom))), sy = Math.min(H - 1, Math.max(0, Math.floor(y0 + y / zoom))); img.set(plate.img.subarray((sy * W + sx) * 4, (sy * W + sx) * 4 + 4), (y * W + x) * 4); }
  const zp = { ...plate, img, project: (p) => { const q = plate.project(p); return [(q[0] - x0) * zoom, (q[1] - y0) * zoom]; }, depth: new Float32Array(W * H) };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const sx = Math.min(W - 1, Math.max(0, Math.floor(x0 + x / zoom))), sy = Math.min(H - 1, Math.max(0, Math.floor(y0 + y / zoom))); zp.depth[y * W + x] = plate.depth[sy * W + sx]; }
  for (const f of order) place(zp, f.layer, f.G, f.ss, f.centre);
  out = img;
}
writePng(`out/cmp-${where}-${mode}-z${zoom}${tag}.png`, { width: W, height: H, data: toRgba8(out, W, H) });
console.log(where, mode, zoom, ((Date.now() - t0) / 1000).toFixed(1), "s");
