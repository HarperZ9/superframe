// Strips of the reaction and answer clips as combat drives them (its warp, its frame counts at 60 fps):
// knockdown, getup, world.lunge, world.throw, step_l, flinch with a hit reaction, at even frames.
//   node proto/feel_sheet.mjs [out]
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { makeReactions } from "../runtime/feel.mjs";
import { RIGS } from "../render/rigs.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import * as warden from "../cast/warden.mjs";
import { warp } from "../../game/engine/combat/anim/drive.mjs";
const out = process.argv[2] || "out/feel-sheet.png";
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8")), combat = JSON.parse(readFileSync(new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), "utf8"));
const cast = createCast({ timing, combat, members: { warden: { ...warden } } }), table = cast.clips("warden");
// combat's moves (frames at 60 fps), from game/engine/combat/data (copied numbers; the sheet only illustrates)
const MOVES = {
  knockdown: { startup: 0, active: 0, recovery: 48, total: 48 },
  getup: { startup: 0, active: 0, recovery: 50, total: 50 },
  "world.lunge": { startup: 28, active: 6, recovery: 26, total: 60, tell: { at: [4, 27] } },
  "world.throw": { startup: 48, active: 1, recovery: 36, total: 85, tell: { at: [6, 47] } },
  step_l: { startup: 0, active: 0, recovery: 26, total: 26 },
};
const N = 9, cw = 200, ch = 260, rows = Object.keys(MOVES).length + 1, W = cw * N, H = ch * rows, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.15, 0.11, 0.12, 1], i * 4);
const rig = { ...RIGS.brine.rig, lamps: [{ pos: [-1.6, 2.6, 1.6], c: [1, 0.75, 0.45], power: 9 }] };
const view = (a) => ({ yawDeg: 60, elevDeg: 16, height: 2.6, centre: [a.pos[0], a.pos[1] + 0.95, a.pos[2]] });
const blit = (R, r, c) => { for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const s = (y * R.w + x) * 4, al = R.rgba[s + 3]; if (al <= 0) continue; const d = ((r * ch + y) * W + c * cw + x) * 4; for (let k = 0; k < 3; k++) img[d + k] = img[d + k] * (1 - al) + R.rgba[s + k] * al; } };
Object.entries(MOVES).forEach(([anim, m], r) => {
  const a = cast.actor("warden", { tool: "w.stick" }), clip = table[`holder.${anim}`];
  for (let i = 0; i < 20; i++) a.drive({ x: 0, z: 0, face: 0, pose: { anim: "guard", loop: true }, dt: 1 / 60 });
  if (anim === "getup") for (let f = 0; f <= 48; f++) a.drive({ x: 0, z: 0, face: 0, pose: { anim: "knockdown", clip: "holder.knockdown", t: warp(MOVES.knockdown, f, table["holder.knockdown"]), loop: false }, dt: 1 / 60 });   // as combat: getup follows the fall
  let col = 0;
  for (let f = 0; f <= m.total; f++) {
    a.drive({ x: 0, z: 0, face: 0, pose: { anim, clip: `holder.${anim}`, t: warp(m, f, clip), loop: false }, dt: 1 / 60 });
    if (f === Math.round((col * m.total) / (N - 1))) { blit(a.render(view(a), cw, ch, rig, { ss: 1 }), r, col); col++; }
  }
});
// a hit from the front on a standing guard, with the additive reaction (power 1), at 0 to 0.4 s
{
  const a = cast.actor("warden", { tool: "w.stick" }), r = rows - 1; for (let i = 0; i < 20; i++) a.drive({ x: 0, z: 0, face: 0, pose: { anim: "guard", loop: true }, dt: 1 / 60 });
  const W0 = { tick: 1, events: [], byId: (id) => (id === "t" ? { x: 0, z: 0, face: 0 } : { x: 1.2, z: 0, face: Math.PI }) };
  const R = makeReactions(() => ({ contacts: [{ kind: "hit", id: "t", by: "s", power: 1 }] })); R.read(W0); const t0 = performance.now() / 1000;
  for (let col = 0; col < N; col++) { const now = t0 + col * 0.05; a.adjust(R.layer("t", 0, now), "hit"); blit(a.render(view(a), cw, ch, rig, { ss: 1 }), r, col); }
}
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) });
console.log(out);
