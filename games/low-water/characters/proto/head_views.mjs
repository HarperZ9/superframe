// The Quota's heads large, at the views gameplay and the talk panel use: front, three-quarter (40 degrees) and
// profile, idle, under the sheet light (characters/notes/HEAD-BOUNDS.md). One row a person.
//   node proto/head_views.mjs <out.png> [who,who] [--old]      (--old: the old head, the control)
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";
import { SCULPT } from "../cast/sculpt.mjs";

const args = process.argv.slice(2), out = args[0] || "out/head-views.png", old = args.includes("--old"), list = args[1] && !args[1].startsWith("--") ? args[1].split(",") : null;
SCULPT.on = !old; SCULPT.bald = !!process.env.HV_BALD; SCULPT.tagEars = !!process.env.HV_BALD;
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const members = await roster("quota"), ids = list || Object.keys(members).sort((a, b) => members[a].P.h - members[b].P.h);
const facings = (process.env.HV_F || "0,-40,-90").split(",").map(Number), cw = 300, ch = 340, W = cw * facings.length, H = ch * ids.length, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.47, 0.44, 0.41, 1], i * 4);
const rig = { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } };
ids.forEach((who, r) => facings.forEach((facing, k) => {
  const a = createCast({ timing, members: { [who]: { ...members[who] } } }).actor(who, { facing }); a.play("idle", { force: true, fade: 1 }); for (let i = 0; i < 14; i++) a.update(1 / 60);
  const hp = a.skeleton()[INDEX.head].p, hw0 = a.toWorld(hp), fd = +(process.env.HV_FWD || 0.05), hw = [hw0[0] + Math.sin(facing * Math.PI / 180) * fd, hw0[1], hw0[2] + Math.cos(facing * Math.PI / 180) * fd], hy = hw[1], dy = +(process.env.HV_DY || 0.13);
  const im = a.render({ yawDeg: 0, elevDeg: 4, height: +(process.env.HV_H || 0.4), centre: [hw[0], hy + dy, hw[2]] }, cw, ch, rig, { ss: 2, bands: 4, shadows: false });
  paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch);
}));
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) }); console.log(ids.join(", "));
