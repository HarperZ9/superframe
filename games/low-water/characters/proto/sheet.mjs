// Pose sheet: a clip sampled at N frames, two views. node proto/sheet.mjs <who> <clip> [n] [out]
import { library } from "../anim/library.mjs";
import { live, paste } from "../render/figure.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { BY_CLASS } from "../cast/tools.mjs";
const [who = "lamb", clipName = "walk", nArg = "8", out] = process.argv.slice(2);
const C = { ...(await import(`../cast/${who}.mjs`)) }, L = library(C.style ? { [who]: C.style } : {}), n = +nArg, len = L.length(who, clipName);
const cw = 220, ch = 300, W = cw * n, H = ch * 2, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) { img[i * 4] = 0.55; img[i * 4 + 1] = 0.53; img[i * 4 + 2] = 0.5; img[i * 4 + 3] = 1; }
for (let k = 0; k < n; k++) {
  const f = (k / (n - 1)) * (len - (L.clips[clipName].loop ? len / n : 0) - 1e-3) * (L.clips[clipName].loop ? 1 : 1), pose = L.pose(who, clipName, f);
  const z = pose.root?.z || 0, x = pose.root?.x || 0; pose.root = { ...pose.root, z: 0, x: 0 };
  for (const [row, facing] of [[0, 36 + 60], [1, 36 - 20]]) {
    const cls = clipName.includes(".") ? clipName.split(".")[0] : null, tool = process.env.TOOL || (cls && BY_CLASS[cls]) || undefined;
    const r = live([{ C, pose, facing, tool }], { yawDeg: 36, elevDeg: 26, height: 2.7, centre: [0, 0.95, 0] }, cw, ch);
    paste(img, W, H, r.rgba, r.w, r.h, k * cw, row * ch);
  }
}
writePng(out || `out/sheet-${who}-${clipName}.png`, { width: W, height: H, data: toRgba8(img, W, H) });
console.log(clipName, "frames", len);
