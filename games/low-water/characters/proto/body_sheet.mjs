// The Quota's cast at one scale, idle, front three-quarter over side, sorted by height, with lines every
// 0.25 m: proportions, silhouettes and clipping looked at side by side (characters/notes/ANIM-BOUNDS.md, 4).
//   node proto/body_sheet.mjs <out.png> [walk]      walk: the second row is a walk frame instead of the side
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { roster } from "./heads_roster.mjs";

const [out = "out/bodies.png", mode] = process.argv.slice(2);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const members = await roster("quota"), ids = Object.keys(members).sort((a, b) => members[a].P.h - members[b].P.h);
const cast = createCast({ timing, members }), rig = { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } };
const cw = 120, ch = 300, viewH = 2.1, cols = ids.length, W = cw * cols, H = ch * 2, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.47, 0.44, 0.41, 1], i * 4);
// lines every 0.25 m from the floor (the view's centre is 0.95 m up, viewH metres tall)
const ppm = ch / viewH, floorY = ch / 2 + 0.95 * ppm;
for (let r = 0; r < 2; r++) for (let m = 0; m <= 8; m++) { const y = Math.round(r * ch + floorY - m * 0.25 * ppm); if (y < r * ch || y >= (r + 1) * ch) continue; for (let x = 0; x < W; x++) img.set(m % 4 === 0 ? [0.33, 0.3, 0.28, 1] : [0.42, 0.39, 0.37, 1], (y * W + x) * 4); }
ids.forEach((who, k) => {
  for (let r = 0; r < 2; r++) {
    const walk = mode === "walk" && r === 1, a = cast.actor(who, { facing: r === 0 ? 0 - 30 : walk ? 90 : 90 });
    a.play(walk ? "walk" : "idle", { force: true, fade: 1 }); if (walk) a.state.vWant = 1.3;
    for (let i = 0; i < (walk ? 40 : 14); i++) a.update(1 / 60);
    // elevation 0: the lines are true heights at the figure's depth
    const im = a.render({ yawDeg: 0, elevDeg: 0, height: viewH, centre: [a.pos[0], 0.95, a.pos[2]] }, cw, ch, rig, { ss: 2, bands: 4, shadows: false });
    paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch);
  }
});
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) }); console.log(ids.map((i) => `${i} ${members[i].P.h.toFixed(2)}`).join(", "));
