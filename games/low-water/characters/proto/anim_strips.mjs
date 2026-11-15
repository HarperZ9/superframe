// Frame strips and onion-skins for looking at the animation (characters/notes/ANIM-BOUNDS.md, target 6).
//   node proto/anim_strips.mjs <outdir>
// Writes into <outdir>:
//   onion-<name>.png   a fixed camera, side view, exposures laid over each other: a planted foot is one
//                      sharp foot where the exposures agree, a sliding one a smear (with -ikoff: locks off)
//   strip-<name>.png   eight frames, the camera following
//   frames-<name>/NN.png  every frame of a strip (for a GIF)
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { makeReactions } from "../runtime/feel.mjs";
import { NEUTRAL } from "../render/shade.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";
import { roster } from "./heads_roster.mjs";
import * as lamb from "../cast/lamb.mjs";

const out = process.argv[2] || "out/anim"; mkdirSync(out, { recursive: true });
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const q = await roster("quota"), members = { lamb, tomas: q.tomas, aaron: q.aaron };
const rig = { ...NEUTRAL, fresnel: { c: [0.12, 0.1, 0.1], pow: 3 } }, BG = [0.47, 0.44, 0.41];
const mkActor = (who, opts = {}) => { const c = createCast({ timing, combat, members }); const a = c.actor(who, { tool: who === "lamb" ? "stick" : "hands", ...opts }); return a; };
const blank = (W, H) => { const im = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) im.set([...BG, 1], i * 4); return im; };
const save = (file, im, W, H) => writePng(`${out}/${file}`, { width: W, height: H, data: toRgba8(im, W, H) });
// a ground line through the feet: the cell's rows where the floor is (side view, low camera)
function groundLine(im, W, H, y) { if (y < 0 || y + 1 >= H) return; for (let x = 0; x < W; x++) for (let t = 0; t < 2; t++) im.set([0.3, 0.27, 0.25, 1], ((y + t) * W + x) * 4); }

// onion: drive(a, f) per 60 Hz tick; exposures every `every` ticks from `from`; camera fixed at x0..x1 metres
function onion(name, who, drive, { ticks, from = 0, every = 8, span = [-1.5, 1.5], ikoff = false, yaw = 90, elev = 4 } = {}) {
  const a = mkActor(who); if (ikoff) a.state.footIK = false;
  const W = 1000, mpp = (span[1] - span[0]) / W, H = Math.round(2.2 / mpp), view = { yawDeg: yaw, elevDeg: elev, height: H * mpp, centre: [0, 0.95, (span[0] + span[1]) / 2] };
  const im = blank(W, H); let n = 0;
  for (let f = 0; f < ticks; f++) {
    drive(a, f);
    if (f >= from && (f - from) % every === 0) {
      const r = a.render(view, W, H, rig, { ss: 1, bands: 4, smear: false, shadows: false });
      const last = f + every >= ticks;
      for (let i = 0; i < W * H; i++) { const al = r.rgba[i * 4 + 3]; if (al < 0.5) continue; const k = last ? 1 : 0.3; for (let c = 0; c < 3; c++) im[i * 4 + c] = im[i * 4 + c] * (1 - k) + r.rgba[i * 4 + c] * k; }
      n++;
    }
  }
  save(`onion-${name}${ikoff ? "-ikoff" : ""}.png`, im, W, H); console.log("onion", name, ikoff ? "(locks off)" : "", n, "exposures");
}
// strip: eight frames, the camera following, every frame also written for a GIF
function strip(name, who, drive, { ticks, from = 0, n = 8, yaw = 62, elev = 14, h = 2.3 } = {}) {
  const a = mkActor(who), cw = 220, ch = 320, W = cw * n, H = ch, im = blank(W, H), dir = `${out}/frames-${name}`; mkdirSync(dir, { recursive: true });
  const every = Math.max(2, 2 * Math.floor((ticks - from) / n / 2)); let k = 0, g = 0;   // even: frames are rendered on even ticks
  for (let f = 0; f < ticks; f++) {
    drive(a, f);
    if (f < from) continue;
    const view = { yawDeg: yaw, elevDeg: elev, height: h, centre: [a.pos[0], 0.95, a.pos[2]] };
    if ((f - from) % 2 === 0) { const r = a.render(view, cw, ch, rig, { ss: 2, bands: 4 }), fr = blank(cw, ch); paste(fr, cw, ch, r.rgba, r.w, r.h, 0, 0); save(`frames-${name}/${String(g++).padStart(3, "0")}.png`, fr, cw, ch);
      if ((f - from) % every === 0 && k < n) { paste(im, W, H, r.rgba, r.w, r.h, k * cw, 0); k++; } }
  }
  save(`strip-${name}.png`, im, W, H); console.log("strip", name, k, "frames,", g, "for the GIF");
}

// foot trace: each ankle's world position along the walk (across) against time (down), locks on (dark) and
// off (pale), planted frames (clip down, final foot down) drawn thick: a planted foot is a vertical line
function trace(name, who, drive, { ticks, axis = 2, span = [-1.5, 3] } = {}) {
  const W = 900, H = ticks * 3, im = blank(W, H), X = (v) => Math.round(((v - span[0]) / (span[1] - span[0])) * (W - 1));
  for (const ik of [false, true]) {
    const a = mkActor(who); if (!ik) a.state.footIK = false;
    for (let f = 0; f < ticks; f++) {
      drive(a, f); const S = a.skeleton(), K = a.skeleton(a.basePose(), null);
      for (const [s, col] of [["L", ik ? [0.12, 0.1, 0.2] : [0.7, 0.66, 0.78]], ["R", ik ? [0.45, 0.12, 0.08] : [0.85, 0.66, 0.6]]]) {
        const j = s === "L" ? 16 : 19, w = a.toWorld(S[j].p), down = K[j].p[1] < 0.035 && S[j].p[1] < 0.035, x = X(w[axis]);
        for (let t = 0; t < 3; t++) for (let dx = down ? -1 : 0; dx <= (down ? 1 : 0); dx++) { const xx = x + dx, yy = f * 3 + t; if (xx >= 0 && xx < W) im.set([...col, 1], (yy * W + xx) * 4); }
      }
    }
  }
  save(`trace-${name}.png`, im, W, H); console.log("trace", name);
}
const seq = (list) => (a, f) => { for (const [t, fn] of list) if (t === f) fn(a); a.update(1 / 60); };
const walkAt = (v, who) => (a) => { a.state.pos = [0, 0, -1.4]; a.play("walk", { force: true }); a.state.vWant = v; };
const runAt = (v) => (a) => { a.state.pos = [0, 0, -2.6]; a.play("run", { force: true }); a.state.vWant = v; };
const P = (n) => (a) => a.play(n, { force: true });

onion("walk", "lamb", seq([[0, walkAt(1.5)]]), { ticks: 150, from: 70, every: 10 });
onion("run", "lamb", seq([[0, runAt(3.6)]]), { ticks: 110, from: 70, every: 4, span: [-1, 3] });
for (const ik of [false, true]) {
  onion("stop", "lamb", seq([[0, runAt(3.6)], [50, P("stop")]]), { ticks: 120, from: 46, every: 8, span: [-1.4, 2.6], ikoff: ik });
  onion("turn", "lamb", seq([[0, P("idle")], [10, P("turn")]]), { ticks: 100, from: 8, every: 10, span: [-1.4, 1.4], ikoff: ik, yaw: 70, elev: 10 });
}
onion("child-walk-tomas", "tomas", seq([[0, walkAt(1.3)]]), { ticks: 150, from: 70, every: 10 });
onion("child-walk-aaron", "aaron", seq([[0, walkAt(1.3)]]), { ticks: 150, from: 70, every: 10 });

strip("walk", "lamb", seq([[0, walkAt(1.5)]]), { ticks: 100, from: 52 });
strip("run", "lamb", seq([[0, runAt(3.6)]]), { ticks: 100, from: 72 });
strip("stop", "lamb", seq([[0, runAt(3.6)], [50, P("stop")]]), { ticks: 112, from: 48 });
strip("turn", "lamb", seq([[0, P("idle")], [10, P("turn")]]), { ticks: 100, from: 10 });
strip("strike-while-walking", "lamb", seq([[0, walkAt(1.4)], [40, (a) => a.playUpper("light_1")]]), { ticks: 84, from: 38 });
// a hit reaction while walking: the fight drawer's additive layer (runtime/feel.mjs), fed one blow from the front
{
  const W = { tick: 0, byId: (id) => (id === "lamb" ? { x: 0, z: 0, face: Math.PI / 2 } : { x: 0, z: 2, face: -Math.PI / 2 }), defs: { foe: { tool: { cls: "heavy" } } } };
  const R = makeReactions((w) => ({ contacts: w.tick === 46 ? [{ id: "lamb", by: "foe", kind: "hit", power: 0.8, t: 46 }] : [], frozen: [] }));
  strip("hit-while-walking", "lamb", (a, f) => { if (f === 0) walkAt(1.2)(a); W.tick = f; R.read(W); a.adjust(R.layer("lamb", Math.PI / 2), "hit"); a.update(1 / 60); }, { ticks: 84, from: 42 });
}
strip("child-walk-tomas", "tomas", seq([[0, walkAt(1.3)]]), { ticks: 100, from: 52 });
strip("child-walk-aaron", "aaron", seq([[0, walkAt(1.3)]]), { ticks: 100, from: 52 });

trace("stop", "lamb", seq([[0, runAt(3.6)], [50, P("stop")]]), { ticks: 140, span: [-3, 3] });
trace("turn", "lamb", seq([[0, P("idle")], [10, P("turn")]]), { ticks: 120, axis: 0, span: [-0.6, 0.6] });
trace("walk-start-stop", "lamb", seq([[0, P("idle")], [20, walkAt(1.5)], [110, P("idle")]]), { ticks: 170, span: [-1.6, 1.4] });
