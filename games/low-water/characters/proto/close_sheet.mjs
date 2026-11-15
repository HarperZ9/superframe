// One person at four facings, standing and walking (the close look at cloth and hands).   node proto/close_sheet.mjs <who> <out.png> [facings]
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { roster } from "./heads_roster.mjs";
const [who = "mary", out = "out/close.png", ...fac] = process.argv.slice(2);
const m = await roster("quota"), timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const facings = fac.length ? fac.map(Number) : [-30, 30, 90, 160], cw = 260, ch = 420, W = cw * facings.length * 2, img = new Float32Array(W * ch * 4).fill(0.45);
for (let i = 0; i < W * ch; i++) img[i * 4 + 3] = 1;
let k = 0;
for (const walk of [false, true]) for (const f of facings) {
  const a = createCast({ timing, members: { [who]: m[who] } }).actor(who, { facing: f }); a.play(walk ? "walk" : "idle", { force: true }); a.state.vWant = 1.3;
  for (let i = 0; i < (walk ? 47 : 10); i++) a.update(1 / 60);
  const im = a.render({ yawDeg: 0, elevDeg: 8, height: 1.9, centre: [a.pos[0], 0.85, a.pos[2]] }, cw, ch, { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } }, { ss: 2, bands: 4, shadows: false });
  paste(img, W, ch, im.rgba, im.w, im.h, k++ * cw, 0);
}
writePng(out, { width: W, height: ch, data: toRgba8(img, W, ch) });
