// Cast lineup: every built character, idle, front three-quarter, plus a talk pose. node proto/cast_sheet.mjs [out]
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import * as LL from "../cast/lamplighter.mjs";
import * as FOLK from "../cast/folk.mjs";
const names = ["lamb", "keel", "fennick", "sabine", "wenna", "merrow", "marrow", "warden", "salvor"];
const members = Object.fromEntries(await Promise.all(names.map(async (n) => [n, await import(`../cast/${n}.mjs`)])));
for (const k of ["GORM", "HOBB", "FEWELL", "STRAND", "BRIGHT", "COE"]) members[k.toLowerCase()] = LL[k];
for (const [k, m] of Object.entries(FOLK)) members[k.toLowerCase()] = m;
const cast = createCast({ timing: JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8")), members });
const all = Object.keys(members), cw = 210, ch = 330, cols = 8, W = cw * cols, H = ch * 2 * Math.ceil(all.length / cols), img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.44, 0.41, 0.39, 1], i * 4);
const rig = { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } };
all.forEach((who, k) => [["idle", 36 - 30], ["talk_c", 36 + 40]].forEach(([clip, facing], r) => {
  const a = cast.actor(who, { facing }); a.play(clip, { force: true, fade: 1 }); for (let i = 0; i < 14; i++) a.update(1 / 60);
  const im = a.render({ yawDeg: 36, elevDeg: 22, height: 2.5, centre: [0, 1.0, 0] }, cw, ch, rig, { ss: 2, bands: 4 });
  paste(img, W, H, im.rgba, im.w, im.h, (k % cols) * cw, (Math.floor(k / cols) * 2 + r) * ch);
}));
writePng(process.argv[2] || "stills/10-cast.png", { width: W, height: H, data: toRgba8(img, W, H) }); console.log(all.join(", "));
