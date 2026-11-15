// Poses from proto/poses.mjs at portrait and play size: node proto/pose_sheet.mjs <who> <pose,pose> <out.png>
// Each pose in three views at 105 px a metre (play size at 1080p) with the seat top and the floor
// drawn as lines, and a portrait framing beside them; prints the ground contact.
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createCast } from "../runtime/actor.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { INDEX } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";
import { POSES, pose } from "./poses.mjs";
import { PORTRAIT_RIG } from "./portrait_light.mjs";

const [who = "wenna", list = "stand,seated-bollard", out = "out/poses.png"] = process.argv.slice(2);
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8")), root = new URL("../../", import.meta.url);
globalThis.fetch = async (u) => { const path = String(u).replace(/^\/engine\//, "game/engine/").replace(/^\//, ""); try { const t = await readFile(new URL(path, root), "utf8"); return { ok: true, json: async () => JSON.parse(t) }; } catch { return { ok: false, status: 404 }; } };
const { makeFightDrawer } = await import("../runtime/fightdrawer.mjs"), drawer = await makeFightDrawer({ poseOf: () => ({ anim: "idle", loop: true }) });
const members = await roster(), names = list.split(","), ppm = 105, cw = Math.round(1.3 * ppm), ch = Math.round(2.2 * ppm), pw = 256, ph = 320;
const views = [[26, 30], [90, 8], [0, 8]], W = cw * views.length + pw, H = Math.max(ch, ph) * names.length, img = new Float32Array(W * H * 4);
for (let i = 0; i < W * H; i++) img.set([0.54, 0.48, 0.4, 1], i * 4);
const blend = (R, ox, oy) => { for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const s = (y * R.w + x) * 4, al = R.rgba[s + 3]; if (al <= 0) continue; const d = ((oy + y) * W + ox + x) * 4; for (let k = 0; k < 3; k++) img[d + k] = img[d + k] * (1 - al) + R.rgba[s + k] * al; } };
const rig = PORTRAIT_RIG.paraffin.rig, row = Math.max(ch, ph);
const stand = (() => { const a = createCast({ timing, members: { [who]: { ...members[who] } } }).actor(who); return pose(a, "stand", drawer).contact.feet_m; })();
names.forEach((n, r) => {
  const a = createCast({ timing, members: { [who]: { ...members[who] } } }).actor(who), res = pose(a, n, drawer), P = POSES[n];
  console.log(who, n, "feet", (res.contact.feet_m - stand).toFixed(3), "m against standing; seat fit error", res.contact.seat_err_m);
  views.forEach(([yaw, el], c) => {
    blend(a.render({ yawDeg: yaw, elevDeg: el, height: ch / ppm, centre: [0, ch / ppm / 2 - 0.05, 0] }, cw, ch, rig, { ss: 2 }), c * cw, r * row);
    const cos = Math.cos((el * Math.PI) / 180), lineAt = (yy, col) => { const py = Math.round(ch / 2 + (ch / ppm / 2 - 0.05 - yy) * ppm * cos); if (py >= 0 && py < ch) for (let x = 6; x < cw - 6; x += 2) img.set([...col, 1], ((r * row + py) * W + c * cw + x) * 4); };
    lineAt(0, [0.25, 0.22, 0.2]); if (P.seatY != null) lineAt(P.seatY, [0.95, 0.9, 0.7]);
  });
  const hy = a.skeleton()[INDEX.head].p[1];
  blend(a.render({ yawDeg: 58, elevDeg: 6, height: 0.8, centre: [0, hy - 0.02, 0] }, pw, ph, rig, { ss: 2 }), views.length * cw, r * row);
});
writePng(out, { width: W, height: H, data: toRgba8(img, W, H) });
