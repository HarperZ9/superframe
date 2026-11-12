// Each defensive and combo move at a fast build and a heavy build, side by side, at 60 fps.
// The attribute settings warp the phases unequally (combat's attribute table will set the real
// factors): fast = startup x0.7, active x1, recovery x0.6; heavy = startup x1.45, active x1.1,
// recovery x1.5. The clip is never sped up as a whole.
//   node proto/attr_reel.mjs <outDir>     frames to <outDir>/NNNN.png, labels.json
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import * as lamb from "../cast/lamb.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat0 = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : { lamb: {} };
const warp = (k) => { const c = JSON.parse(JSON.stringify(combat0)); for (const [n, t] of Object.entries(c.lamb)) { const s = t.startup || 0, a = t.active || 0, r = t.recovery || 0;
  if (s || a) { t.startup = Math.max(1, Math.round(s * k.s)); t.active = Math.max(1, Math.round(a * k.a)); t.recovery = Math.max(1, Math.round(r * k.r)); } else t.recovery = Math.max(2, Math.round(r * (k.s + k.r) / 2)); } return c; };
const FAST = { s: 0.7, a: 1, r: 0.6 }, HEAVY = { s: 1.45, a: 1.1, r: 1.5 };
const mk = (k) => createCast({ timing, combat: warp(k), members: { lamb } }).actor("lamb", { tool: "stick" });
const A = mk(FAST), B = mk(HEAVY), W = 1280, H = 720, labels = {}; let n = 0;
const STUDIO = { ...NEUTRAL, fresnel: { c: [0.14, 0.11, 0.1], pow: 3 } };
function panel(im, a, x0) {
  const view = { yawDeg: 36, elevDeg: 24, height: 2.8, centre: [a.pos[0], 1.05, a.pos[2]] };
  const r = a.render(view, 640, H, STUDIO, { ss: 2, bands: 4 }); paste(im, W, H, r.rgba, r.w, r.h, x0, 0);
}
const SEQ = [["roll_dash_f"], ["step_l"], ["roll_f"], ["roll_b"], ["roll_hop_f"], ["catch"], ["light_1", "light_2", "light_3"], ["heavy"], ["heavy_charged"], ["parried"], ["hit"], ["stagger"]];
for (const chain of SEQ) {
  for (const a of [A, B]) { a.state.pos = [0, 0, 0]; a.facing = 36 - 50; a.play("guard", { force: true, fade: 1 }); for (let i = 0; i < 6; i++) a.update(1 / 60); }
  const q = { A: [...chain], B: [...chain] }; let f = 0, doneA = false, doneB = false;
  for (const [a, key] of [[A, "A"], [B, "B"]]) a.play(q[key].shift(), { force: true, fade: 3 });
  while (!(doneA && doneB) && f < 400) {
    const im = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) im.set([0.12, 0.095, 0.1, 1], i * 4);
    panel(im, A, 0); panel(im, B, 640);
    writePng(`${out}/${String(n).padStart(4, "0")}.png`, { width: W, height: H, data: toRgba8(im, W, H) });
    if (f === 0) labels[n] = `${chain.join(" > ")}: left a fast build (startup x0.7, recovery x0.6), right a heavy build (startup x1.45, recovery x1.5), 60 fps`;
    n++; f++;
    for (const [a, key] of [[A, "A"], [B, "B"]]) {
      const e = a.update(1 / 60);
      if (q[key].length && (e.cancel || e.done)) a.play(q[key].shift(), { force: true, fade: 2 });
      if (!q[key].length && (a.state.clip === "guard" || a.state.clip === "idle")) { if (key === "A") doneA = true; else doneB = true; }
    }
  }
  for (let k = 0; k < 15; k++) { const im = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) im.set([0.12, 0.095, 0.1, 1], i * 4); panel(im, A, 0); panel(im, B, 640); writePng(`${out}/${String(n).padStart(4, "0")}.png`, { width: W, height: H, data: toRgba8(im, W, H) }); n++; A.update(1 / 60); B.update(1 / 60); }
}
writeFileSync(`${out}/labels.json`, JSON.stringify(labels)); console.log("frames", n);
