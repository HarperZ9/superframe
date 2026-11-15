// The Quota's heads as gameplay shows them: side and three-quarter, at about 300 px a head, under the
// sheet light (characters/notes/FIDELITY.md, profiles).   node proto/face_sheet.mjs <out.png>
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";

const out = process.argv[2] || "out/faces.png";
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const members = await roster("quota"), ids = Object.keys(members).sort((a, b) => members[a].P.h - members[b].P.h);
const cast = createCast({ timing, members }), rig = { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } };
const cw = 150, ch = 170, cols = 11, rowsPer = Math.ceil(ids.length / cols), W = cw * cols, H = ch * 2 * rowsPer, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.47, 0.44, 0.41, 1], i * 4);
ids.forEach((who, k) => [-62, -25].forEach((facing, r) => {
  const a = cast.actor(who, { facing }); a.play("idle", { force: true, fade: 1 }); for (let i = 0; i < 14; i++) a.update(1 / 60);
  const hy = a.toWorld(a.skeleton()[INDEX.head].p)[1];
  const im = a.render({ yawDeg: 0, elevDeg: 4, height: 0.42, centre: [a.pos[0], hy + 0.08, a.pos[2]] }, cw, ch, rig, { ss: 2, bands: 4, shadows: false });
  paste(img, W, H, im.rgba, im.w, im.h, (k % cols) * cw, (Math.floor(k / cols) * 2 + r) * ch);
}));
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) }); console.log(ids.join(", "));
