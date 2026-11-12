// Cast turnaround: each character at four angles (front, three-quarter, side, back), quay-camera elevation.
import { library } from "../anim/library.mjs";
import { live, paste } from "../render/figure.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { NEUTRAL } from "../render/shade.mjs";
const names = (process.env.CAST || "lamb,fennick,marrow").split(","), cast = await Promise.all(names.map(async (n) => ({ ...(await import(`../cast/${n}.mjs`)) })));
const L = library(Object.fromEntries(names.map((n, i) => [n, cast[i].style]).filter(([, s]) => s)));
const cw = 330, ch = 460, A = [0, -40, -90, 180], W = cw * 4, H = ch * names.length, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.42, 0.39, 0.37, 1], i * 4);
names.forEach((n, r) => A.forEach((a, k) => {
  const im = live([{ C: cast[r], pose: L.pose(n, "idle", 0), facing: 36 + a }], { yawDeg: 36, elevDeg: 22, height: 2.7, centre: [0, 1.0, 0] }, cw, ch, { rig: { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } }, bands: 4 });
  paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch);
}));
writePng(process.env.OUT || "stills/04-cast-turnaround.png", { width: W, height: H, data: toRgba8(img, W, H) });
