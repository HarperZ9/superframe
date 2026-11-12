// Review a forged sheet against its costume-script original: turnaround and a close-up, side by side.
//   node forge/review.mjs <sheet name>      writes out/forge-<name>.png
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { forged } from "./compile.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
const name = process.argv[2] || "keel", sheet = JSON.parse(readFileSync(new URL(`../sheets/${name}.json`, import.meta.url), "utf8"));
const base = sheet.base ? { ...(await import(`../cast/${sheet.base}.mjs`)) } : null, F = forged(sheet, base);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cast = createCast({ timing, members: { orig: base, forged: F } });
const rig = { ...NEUTRAL, key: { dir: [-0.5, 0.5, 0.7], c: [0.95, 0.85, 0.75], wrap: 0.3 }, fresnel: { c: [0.14, 0.12, 0.12], pow: 3 } };
const cw = 300, ch = 440, W = cw * 6, H = ch * 2, img = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) img.set([0.4, 0.38, 0.36, 1], i * 4);
let t0 = Date.now();
["orig", "forged"].forEach((who, r) => {
  [-30, 50, 180].forEach((a, k) => {
    const A = cast.actor(who, { facing: 36 + a }); A.play("idle", { force: true, fade: 1 }); A.update(1 / 60);
    const im = A.render({ yawDeg: 36, elevDeg: 18, height: 2.6, centre: [0, 1.05, 0] }, cw, ch, rig, { ss: 2, bands: 4 }); paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch);
  });
  const A = cast.actor(who, { facing: 36 - 30 }); A.play("idle", { force: true, fade: 1 }); A.update(1 / 60);
  const P = (who === "orig" ? base : F).P, im = A.render({ yawDeg: 36, elevDeg: 8, height: 0.62, centre: [0, P.h - 0.2, 0] }, cw * 3, ch, rig, { ss: 2, bands: 4 });
  paste(img, W, H, im.rgba, im.w, im.h, 3 * cw, r * ch);
});
writePng(`out/forge-${name}.png`, { width: W, height: H, data: toRgba8(img, W, H) }); console.log("forge review", name, ((Date.now() - t0) / 1000).toFixed(1), "s");
