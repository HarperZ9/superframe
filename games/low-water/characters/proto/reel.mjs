// The animation reel, rendered offscreen on the CPU, one part at a time:
//   node proto/reel.mjs <turntable|lamb|npcs|quay|walkquay> <outDir>
// Writes <outDir>/<part>/NNNN.png and <outDir>/<part>/labels.json ({ frame: label }).
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import * as lamb from "../cast/lamb.mjs";
import * as fennick from "../cast/fennick.mjs";
import * as marrow from "../cast/marrow.mjs";
import * as warden from "../cast/warden.mjs";
import * as salvor from "../cast/salvor.mjs";
import { existsSync } from "node:fs";
import { NEUTRAL } from "../render/shade.mjs";
import { RIGS } from "../render/rigs.mjs";
import { loadPlate, zoomPlate, clonePlate, shadow, place, ppmAt } from "../render/plate.mjs";
import { paste } from "../render/image.mjs";
import { writePng, toRgba8 } from "../render/io.mjs";

const [part = "turntable", outRoot] = process.argv.slice(2), dir = `${outRoot}/${part}`; mkdirSync(dir, { recursive: true });
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
if (!combat) console.error("combat timing export missing: combat clips fall back to the art's numbers");
const cast = createCast({ timing, combat, members: { lamb, fennick, marrow, warden, salvor } }), L = cast.library, labels = {};
const W = 1280, H = 720, BG = [0.12, 0.095, 0.1], STUDIO = { ...NEUTRAL, fresnel: { c: [0.14, 0.11, 0.1], pow: 3 } };
let n = 0; const MAX = +(process.env.REEL_MAX || 1e9);
const frame = (img, label) => { if (n >= MAX) { writeFileSync(`${dir}/labels.json`, JSON.stringify(labels)); process.exit(0); } writePng(`${dir}/${String(n).padStart(4, "0")}.png`, { width: W, height: H, data: toRgba8(img, W, H) }); if (label) labels[n] = label; n++; };
const blank = () => { const im = new Float32Array(W * H * 4); for (let i = 0; i < W * H; i++) im.set([BG[0], BG[1], BG[2], 1], i * 4); return im; };
// a studio floor: a faint metre grid on y = 0 under an orthographic iso view, centred on c
function floor(im, x0, w, h, view, c) {
  const y = (view.yawDeg * Math.PI) / 180, e = (view.elevDeg * Math.PI) / 180, ppm = h / view.height;
  const f = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)], r = [Math.cos(y), 0, -Math.sin(y)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const a = (px - w / 2) / ppm, b = -(py - h / 2) / ppm, o = [view.centre[0] + r[0] * a + u[0] * b, view.centre[1] + r[1] * a + u[1] * b, view.centre[2] + r[2] * a + u[2] * b];
    const t = -o[1] / f[1]; if (t < -50) continue; const gx = o[0] + f[0] * t, gz = o[2] + f[2] * t, d = Math.hypot(gx - c[0], gz - c[2]);
    const lx = Math.abs(gx - Math.round(gx)), lz = Math.abs(gz - Math.round(gz)), line = Math.min(lx, lz) < 0.012 ? 1 : 0, fade = Math.max(0, 1 - d / 4.5);
    const k = (0.05 + 0.1 * line) * fade, i = (py * W + x0 + px) * 4; im[i] += k * 0.8; im[i + 1] += k * 0.7; im[i + 2] += k * 0.65;
    const sh = Math.max(0, 1 - ((gx - c[0]) ** 2 + (gz - c[2]) ** 2) / 0.16); im[i] *= 1 - 0.5 * sh; im[i + 1] *= 1 - 0.5 * sh; im[i + 2] *= 1 - 0.5 * sh;
  }
}
// draw an actor into a panel of the frame (x0, w), camera following the actor
function panel(im, a, x0, w, { yawDeg = 36, elevDeg = 24, height = 2.8, rig = STUDIO, follow = true } = {}) {
  const c = follow ? a.pos : [0, 0, 0], view = { yawDeg, elevDeg, height, centre: [c[0], 1.05, c[2]] };
  floor(im, x0, w, H, view, a.pos);
  const r = a.render(view, w, H, rig, { ss: 2, bands: 4 });
  paste(im, W, H, r.rgba, r.w, r.h, x0, 0);
}
const SEQ = [["idle", 1], ["walk", 2], ["run", 2], ["stop", 1], ["turn", 1], ["talk_a", 1], ["talk_b", 1], ["talk_c", 1], ["examine", 1], ["dodge_f", 1], ["dodge_b", 1], ["dodge_l", 1], ["dodge_r", 1], ["light_1", 1], ["light_2", 1], ["light_3", 1], ["heavy", 1], ["hit", 1], ["stagger", 1], ["fall", 1], ["getup", 1]];
const run = (a, name, loops, each) => { a.play(name, { force: true, fade: 3 }); const len = L.length(a.who, name) * loops; for (let f = 0; f < len; f++) { each(f); a.update(1 / 30); } };

if (part === "turntable") {
  const as = ["lamb", "fennick", "marrow", "warden", "salvor"].map((w) => cast.actor(w, { pos: [0, 0, 0] }));
  for (let f = 0; f < 150; f++) {
    const im = blank(); as.forEach((a, k) => { a.facing = 36 + (360 * f) / 150; panel(im, a, k * 256, 256, { height: 2.9, follow: false }); a.update(1 / 30); });
    frame(im, f === 0 ? "Turntable: Lamb, Fennick, Marrow, a tide-warden (holder), a salvor (skirmisher)" : null);
  }
}
if (part === "lamb") {
  const a = cast.actor("lamb"), b = cast.actor("lamb");
  for (const [name, loops] of SEQ) {
    a.facing = 36 - 35; b.facing = 36 + 90; a.state.pos = [0, 0, 0]; b.state.pos = [0, 0, 0];
    a.play(name, { force: true, fade: 3 }); b.play(name, { force: true, fade: 3 });
    const len = L.length("lamb", name) * loops;
    for (let f = 0; f < len; f++) { const im = blank(); panel(im, a, 0, 640); panel(im, b, 640, 640); frame(im, f === 0 ? `Lamb: ${name}  (${L.length("lamb", name)} frames)` : null); a.update(1 / 30); b.update(1 / 30); }
  }
}
if (part === "npcs") {
  const a = cast.actor("fennick"), b = cast.actor("marrow");
  for (const [name, loops] of SEQ.filter(([c]) => ["walk", "talk_a", "talk_c", "dodge_b", "light_1", "light_2", "light_3", "heavy", "hit", "fall", "getup"].includes(c))) {
    a.facing = b.facing = 36 - 35; a.state.pos = [0, 0, 0]; b.state.pos = [0, 0, 0];
    a.play(name, { force: true, fade: 3 }); b.play(name, { force: true, fade: 3 });
    const len = Math.max(L.length("fennick", name), L.length("marrow", name)) * loops;
    for (let f = 0; f < len; f++) { const im = blank(); panel(im, a, 0, 640); panel(im, b, 640, 640); frame(im, f === 0 ? `Fennick and Marrow: ${name}` : null); a.update(1 / 30); b.update(1 / 30); }
  }
}
// secondary motion and planted feet: the coat swings on a stop and a turn; the floor grid shows the feet holding still
if (part === "secondary") {
  const a = cast.actor("lamb", { facing: 36 + 90 }), b = cast.actor("marrow", { facing: 36 + 90 });
  const seq = [["walk", 64, "walk: the speed comes from the planted foot, so the feet hold on the floor"], ["run", 40, "run"], ["stop", 18, "stop: the coat swings on past the body and settles"], ["idle", 36, null], ["run", 30, "run into a turn"], ["turn_run", 28, "turn_run: 28 frames, free from 8 (spec v2 numbers); the hem flares"], ["idle", 40, null]];
  for (const [name, frames, label] of seq) {
    a.play(name, { force: true, fade: 4 }); b.play(name, { force: true, fade: 4 });
    for (let f = 0; f < frames; f++) { const im = blank(); panel(im, a, 0, 640); panel(im, b, 640, 640); frame(im, f === 0 && label ? `Secondary motion. ${label}` : null); a.update(1 / 30); b.update(1 / 30); }
  }
}
// the Fray set under combat's names, with the tool each needs (combat's timings)
if (part === "fray") {
  const SET = [["stick", "guard", 1], ["stick", "light_1", 1], ["stick", "light_2", 1], ["stick", "light_3", 1], ["stick", "heavy_charged", 1], ["stick", "catch", 1], ["case", "guard", 1], ["case", "light_1", 1], ["case", "catch", 1], ["case", "heavy", 1],
    ["boathook", "guard", 1], ["boathook", "light_1", 1], ["boathook", "light_2", 1], ["boathook", "heavy", 1], ["hammer", "heavy", 1], ["knife", "light_1", 1], ["knife", "light_2", 1],
    ["stick", "step_l", 2], ["stick", "roll_dash_f", 2], ["stick", "roll_f", 1], ["stick", "roll_b", 1], ["stick", "roll_l", 1], ["stick", "roll_hop_f", 1], ["stick", "lurch_f", 1],
    ["stick", "riposte", 1], ["stick", "shove", 1], ["stick", "grapple", 1], ["stick", "use_lantern", 1], ["stick", "parried", 1], ["stick", "ducked", 1], ["stick", "knockdown", 1], ["stick", "getup", 1], ["stick", "yield", 1], ["stick", "wade", 2]];
  const a = cast.actor("lamb"), b = cast.actor("lamb");
  for (const [tool, name, loops] of SET) {
    a.tool = b.tool = tool; a.facing = 36 - 35; b.facing = 36 + 90; a.state.pos = [0, 0, 0]; b.state.pos = [0, 0, 0];
    a.play(name, { force: true, fade: 3 }); b.play(name, { force: true, fade: 3 });
    const len = Math.max(12, L.length("lamb", a.state.clip)) * loops * (L.length("lamb", a.state.clip) < 12 ? 2 : 1);
    for (let f = 0; f < len; f++) { const im = blank(); panel(im, a, 0, 640); panel(im, b, 640, 640); frame(im, f === 0 ? `Lamb, ${tool}: ${a.state.clip} (${L.length("lamb", a.state.clip)} frames, combat's timing)` : null); a.update(1 / 30); b.update(1 / 30); if (a.state.clip === "guard" && name !== "guard") break; }
  }
}
if (part === "enemies") {
  const zoom = 2.5, base = loadPlate("quay"), R = RIGS.quay, Z = zoomPlate(base, zoom, [-0.7, 0, -2.5], -30);
  const A = cast.actor("lamb", { pos: [-0.6, 0, -2.5] }), Wd = cast.actor("warden", { pos: [-2.4, 0, -2.6] }), S = cast.actor("salvor", { pos: [1.4, 0, -2.3] });
  const face = (a, b) => (Math.atan2(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) * 180) / Math.PI, all = [A, Wd, S];
  const script = [[0, A, "guard", Wd], [0, Wd, "guard", A], [0, S, "guard", A], [20, Wd, "holder.chain", A], [34, A, "step_b", Wd], [80, S, "skirmisher.mud", A], [88, A, "ducked", S],
    [130, Wd, "holder.drag", A], [160, A, "roll_r", Wd], [200, A, "light_1", Wd], [212, Wd, "hit", A], [240, S, "skirmisher.rope", A], [262, A, "roll_dash_l", S], [290, A, "heavy", S], [300, S, "skirmisher.scuttle", A], [330, Wd, "holder.braced", A], [345, A, "catch", Wd], [380, A, "guard", Wd]];
  for (let f = 0; f < 410; f++) {
    for (const [t, a, clip, at] of script) if (t === f) { a.facing = face(a, at); a.play(clip, { force: true, fade: 3 }); }
    const P = clonePlate(Z), order = [...all].sort((a, b) => (a.pos[0] * base.cam.fwd[0] + a.pos[2] * base.cam.fwd[2]) < (b.pos[0] * base.cam.fwd[0] + b.pos[2] * base.cam.fwd[2]) ? 1 : -1);
    for (const a of order) shadow(P, a.pos, a.who === "warden" ? 0.5 : 0.4);
    for (const a of order) { const ppm = ppmAt(base, a.pos) * zoom, hM = 2.9, h = Math.ceil(hM * ppm), w = Math.ceil(h * 0.95), view = { yawDeg: 36, elevDeg: 26, height: hM, centre: [a.pos[0], 1.05, a.pos[2]] }; const r = a.render(view, w, h, R.rig, { ss: 2, bands: 4, tone: R.tone }); place(P, r.full, r.G, 2, view.centre); }
    frame(P.img, f === 0 ? "The holder (a tide-warden: chain, drag, braced) and the skirmisher (a salvor: mud, rope, scuttle) against Lamb, 2.5x camera" : null);
    for (const a of all) { a.update(1 / 30); a.pos[0] = Math.max(-3.2, Math.min(2.2, a.pos[0])); a.pos[2] = Math.max(-3.4, Math.min(-1.7, a.pos[2])); }
  }
}
// the quay at a closer gameplay camera: a scripted exchange, driven through the runtime
if (part === "quay" || part === "walkquay") {
  const zoom = part === "quay" ? 2.5 : 1, base = loadPlate("quay"), R = RIGS.quay;
  const A = cast.actor("lamb", { pos: [0.4, 0, -2.6] }), B = cast.actor("marrow", { pos: [-1.6, 0, -2.4] });
  const Z = zoomPlate(base, zoom, [-0.7, 0, -2.5], zoom > 1 ? -30 : 0);
  const keepIn = (a) => { a.pos[0] = Math.max(-3.2, Math.min(1.6, a.pos[0])); a.pos[2] = Math.max(-3.4, Math.min(-1.7, a.pos[2])); };
  const face = (a, b) => (Math.atan2(b.pos[0] - a.pos[0], b.pos[2] - a.pos[2]) * 180) / Math.PI;
  const script = part === "quay" ? [
    [0, A, "walk"], [0, B, "guard"], [26, A, "guard"], [34, A, "light_1"], [38, B, "hit"], [48, A, "light_2"], [52, B, "hit"], [64, A, "light_3"], [70, B, "stagger"], [110, A, "guard"],
    [120, B, "heavy"], [136, A, "roll_b"], [180, B, "light_1"], [182, A, "step_l"], [200, A, "heavy_charged"], [214, B, "knockdown"], [250, B, "getup"], [300, A, "guard"], [310, B, "yield"], [350, A, "talk_c"], [392, A, "idle"],
  ] : [[0, A, "walk"], [0, B, "idle"], [70, A, "talk_b"], [130, A, "idle"]];
  const end = part === "quay" ? 400 : 150;
  for (let f = 0; f < end; f++) {
    for (const [t, a, clip] of script) if (t === f) { const other = a === A ? B : A; if (!["dodge_l", "dodge_r", "dodge_b"].includes(clip) || true) a.facing = face(a, other); a.play(clip, { force: true, fade: 3 }); }
    if (A.state.clip === "walk") A.facing = face(A, B);
    const P = clonePlate(Z);
    const order = [A, B].sort((a, b) => (a.pos[0] * base.cam.fwd[0] + a.pos[2] * base.cam.fwd[2]) < (b.pos[0] * base.cam.fwd[0] + b.pos[2] * base.cam.fwd[2]) ? 1 : -1);
    for (const a of order) shadow(P, a.pos, a.who === "marrow" ? 0.5 : 0.4);
    for (const a of order) {
      const ppm = ppmAt(base, a.pos) * zoom, hM = 2.8, h = Math.ceil(hM * ppm), w = Math.ceil(h * 0.9), view = { yawDeg: 36, elevDeg: 26, height: hM, centre: [a.pos[0], 1.05, a.pos[2]] };
      const r = a.render(view, w, h, R.rig, { ss: 2, bands: 4, tone: R.tone });
      // place expects the layer at G size: re-render the layer at ss 2 and hand both over
      place(P, r.full, r.G, 2, view.centre);
    }
    frame(P.img, f === 0 ? (part === "quay" ? "Lamp Quay at a closer gameplay camera (2.5x): the actor runtime driving both figures" : "Lamp Quay at today's camera") : null);
    A.update(1 / 30); B.update(1 / 30); keepIn(A); keepIn(B);
  }
}
writeFileSync(`${dir}/labels.json`, JSON.stringify(labels));
console.log(part, n, "frames");
