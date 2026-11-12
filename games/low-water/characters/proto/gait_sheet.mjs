// Locomotion at several speeds, 8 frames across one cycle each: node proto/gait_sheet.mjs [who]
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
const who = process.argv[2] || "lamb", M = await import(`../cast/${who}.mjs`);
const cast = createCast({ timing: JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8")), members: { [who]: M } });
const speeds = [1.4, 2.0, 2.6, 3.6], cw = 200, ch = 280, W = cw * 8, H = ch * speeds.length, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.5, 0.48, 0.46, 1], i * 4);
speeds.forEach((v, r) => {
  const a = cast.actor(who, { facing: 36 + 90 }); a.play("walk", { force: true, fade: 1 }); a.state.vWant = v;
  for (let i = 0; i < 30; i++) a.update(1 / 60);
  const cyc = cast.library.loco(who, v, 0).cycle, per = cyc / v / 8;
  for (let k = 0; k < 8; k++) {
    const im = a.render({ yawDeg: 36, elevDeg: 20, height: 2.6, centre: [a.pos[0], 1.0, a.pos[2]] }, cw, ch, NEUTRAL, { ss: 2, bands: 4 });
    paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch);
    for (let t = 0; t < per; t += 1 / 60) a.update(1 / 60);
  }
});
writePng(`out/gait-${who}.png`, { width: W, height: H, data: toRgba8(img, W, H) }); console.log("speeds", speeds.join(", "));
