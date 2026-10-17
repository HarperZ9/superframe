// The fastest strikes frame by frame at 60 fps with smears: node proto/smear_sheet.mjs
import { readFileSync, existsSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import * as lamb from "../cast/lamb.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const cast = createCast({ timing: JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8")), combat, members: { lamb } });
const rows = [["stick", "light_3"], ["stick", "heavy"], ["hammer", "heavy"]], cw = 200, ch = 260, N = 10, W = cw * N, H = ch * rows.length, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.5, 0.48, 0.46, 1], i * 4);
rows.forEach(([tool, clip], r) => {
  const a = cast.actor("lamb", { tool, facing: 36 - 60 }); a.play("guard", { force: true, fade: 1 }); a.update(1 / 60); a.play(clip, { force: true, fade: 1 });
  const T = cast.library.timing("lamb", a.state.clip), start = Math.max(0, ((T.startup || 6) - 3) * 2);
  for (let f = 0; f < start; f++) { a.update(1 / 60); a.render({ yawDeg: 36, elevDeg: 20, height: 2.8, centre: [a.pos[0], 1.05, a.pos[2]] }, 40, 52, NEUTRAL, { shadows: false }); }
  for (let k = 0; k < N; k++) { a.update(1 / 60); const im = a.render({ yawDeg: 36, elevDeg: 20, height: 2.8, centre: [a.pos[0], 1.05, a.pos[2]] }, cw, ch, NEUTRAL, { ss: 2, bands: 4 }); paste(img, W, H, im.rgba, im.w, im.h, k * cw, r * ch); }
});
writePng("out/smear.png", { width: W, height: H, data: toRgba8(img, W, H) });
