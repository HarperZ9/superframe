// The cast standing together, two views: node proto/lineup.mjs [clip] [frame]
import { library } from "../anim/library.mjs";
import { live, paste } from "../render/figure.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
const [clip = "idle", fr = "0"] = process.argv.slice(2), names = ["lamb", "fennick", "marrow"];
const cast = await Promise.all(names.map(async (n) => ({ ...(await import(`../cast/${n}.mjs`)) })));
const L = library(Object.fromEntries(names.map((n, i) => [n, cast[i].style]).filter(([, s]) => s)));
const cw = 300, ch = 420, W = cw * 6, H = ch, img = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) img.set([0.55, 0.53, 0.5, 1], i * 4);
names.forEach((n, k) => [[36, 0], [36 + 75, 1]].forEach(([facing, j]) => {
  const r = live([{ C: cast[k], pose: L.pose(n, clip, +fr), facing }], { yawDeg: 36, elevDeg: 26, height: 2.6, centre: [0, 1.05, 0] }, cw, ch);
  paste(img, W, H, r.rgba, r.w, r.h, (k * 2 + j) * cw, 0);
}));
writePng(`out/lineup-${clip}.png`, { width: W, height: H, data: toRgba8(img, W, H) });
