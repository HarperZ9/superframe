// Keel (and Merrow) seated, the scene's `pose: seated`: three views of the sit loop through the actor
// runtime, hips fitted to the plate's seat (Keel's chair 0.487 m, Merrow's wet bench 0.458 m, as the
// engine passes in args.seatY), the seat's top drawn as a pale line and the floor as a grey one.
//   node proto/seated_sheet.mjs [out]
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createCast } from "../runtime/actor.mjs";
import { RIGS } from "../render/rigs.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import * as keel from "../cast/keel.mjs";
import * as merrow from "../cast/merrow.mjs";
const out = process.argv[2] || "out/seated.png", timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const root = new URL("../../", import.meta.url);
globalThis.fetch = async (u) => { const path = String(u).replace(/^\/engine\//, "game/engine/").replace(/^\//, ""); try { const t = await readFile(new URL(path, root), "utf8"); return { ok: true, json: async () => JSON.parse(t) }; } catch { return { ok: false, status: 404 }; } };
const { makeFightDrawer } = await import("../runtime/fightdrawer.mjs"), drawer = await makeFightDrawer({ poseOf: () => ({ anim: "sit", loop: true }) });
const SEAT = { keel: 0.487, merrow: 0.458 };
const cast = createCast({ timing, combat: null, members: { keel: { ...keel }, merrow: { ...merrow } } });
const cw = 360, ch = 480, views = [[34, 30], [90, 10], [0, 10]], who = ["keel", "merrow"], W = cw * views.length, H = ch * who.length, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.16, 0.11, 0.1, 1], i * 4);
const rig = { ...RIGS.brine.rig, lamps: [{ pos: [-1.6, 2.6, 1.6], c: [1, 0.75, 0.45], power: 9 }] };
who.forEach((n, r) => {
  const a = cast.actor(n); for (let i = 0; i < 30; i++) a.drive({ x: 0, z: 0, face: 0, pose: { anim: "sit", loop: true }, dt: 1 / 30 }); drawer.fitSeat(a, SEAT[n]);
  views.forEach(([yaw, el], c) => {
    const R = a.render({ yawDeg: yaw, elevDeg: el, height: 2.0, centre: [a.pos[0], a.pos[1] + 0.8, a.pos[2]] }, cw, ch, rig, { ss: 1 });
    for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const s = (y * R.w + x) * 4, al = R.rgba[s + 3]; if (al <= 0) continue; const d = ((r * ch + y) * W + c * cw + x) * 4; for (let k = 0; k < 3; k++) img[d + k] = img[d + k] * (1 - al) + R.rgba[s + k] * al; }
    const seatY = Math.round(ch / 2 + (0.8 - SEAT[n]) * (ch / 2.0) * Math.cos((el * Math.PI) / 180)), floorY = Math.round(ch / 2 + 0.8 * (ch / 2.0) * Math.cos((el * Math.PI) / 180));
    for (const [yy, col] of [[seatY, [0.9, 0.8, 0.5]], [floorY, [0.5, 0.5, 0.5]]]) for (let x = 20; x < cw - 20; x += 2) if (yy >= 0 && yy < ch) img.set([...col, 1], ((r * ch + yy) * W + c * cw + x) * 4);
  });
});
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) });
console.log(out);
