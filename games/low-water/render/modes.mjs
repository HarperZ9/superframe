// The same place in the three modes, by the rules of design/LOOK-UNIFIED.md: walking (the camera
// on Lamb at the plate's own density), talking (the subject slid to a third, the talk panel on
// paper at the right), fighting (in place on the plate, framed on the fighters, a hit flash painted
// in the light's own colour, a catch star from the engine's lens star table, the paper strip of
// notches). The panels are mock-ups of the paper style (ruled lines and ink bars stand in for text).
//   node render/modes.mjs <place> <variant> [--out render/stills/modes]
import { readFileSync, mkdirSync } from "node:fs";
import { rn } from "./rn.mjs";
import { placeFigures } from "./v2/figs.mjs";
import { glow, lensAt } from "./v2/post2.mjs";
const CAM = await import(rn("web/shaders/paintover/camera.mjs")), { readPng, writePng } = await import(rn("tools/shaders/png.mjs"));
const a = process.argv.slice(2), name = a[0], v = a[1], out = (() => { const i = a.indexOf("--out"); return i >= 0 ? a[i + 1] : "render/stills/modes"; })();
mkdirSync(out, { recursive: true });
const root = new URL("../content/", import.meta.url), info = JSON.parse(readFileSync(new URL(`${name}/place.json`, root), "utf8")), W = info.width, H = info.height, cam = CAM.isoCamera(info.camera);
const plate = readPng(readFileSync(new URL(`${name}/${v}.png`, root))), VW = 1920, VH = 1080;

const SET = {
  quay: { rig: "quay", lamps: [[17.5, 4.45, -1.3], [10.5, 4.45, -1.3]], light: [1.0, 0.62, 0.26],
    walk: [{ who: "lamb", at: [15.8, 0, -3.4], facing: -30, clip: "walk", frame: 8 }],
    talk: [{ who: "lamb", at: [15.6, 0, -3.3], facing: 35, clip: "talk_b" }, { who: "marrow", at: [16.9, 0, -4.1], facing: -145, clip: "talk_c" }],
    fight: [{ who: "lamb", at: [15.9, 0, -3.3], facing: 40, clip: "light.light_1", frame: 9 }, { who: "warden", at: [17.0, 0, -4.1], facing: -140, clip: "hit", frame: 4 }, { who: "salvor", at: [14.6, 0, -4.6], facing: 20, clip: "skirmisher.scuttle", frame: 6 }],
    hit: [16.75, 1.35, -3.9], star: [15.2, 1.2, -4.2] },
  brine: { rig: "brine", lamps: null, light: [1.0, 0.78, 0.45],
    walk: [{ who: "lamb", at: [0.6, 0, 0.9], facing: -50, clip: "walk", frame: 8 }],
    talk: [{ who: "lamb", at: [0.5, 0, 0.9], facing: -80, clip: "talk_b" }, { who: "fennick", at: [-0.9, 0, 0.9], facing: 50, clip: "talk_a" }],
    fight: [{ who: "lamb", at: [0.4, 0, 1.0], facing: -80, clip: "light.light_1", frame: 9 }, { who: "salvor", at: [-0.8, 0, 0.8], facing: 90, clip: "hit", frame: 4 }, { who: "warden", at: [1.8, 0, 2.0], facing: -120, clip: "guard" }],
    hit: [-0.55, 1.35, 0.85], star: [1.4, 1.25, 1.7] },
};
const S = SET[name]; if (!S) throw new Error(`no mode set for ${name}`);
const mid = (fs) => fs.reduce((m, f) => [m[0] + f.at[0] / fs.length, m[1] + f.at[1] / fs.length, m[2] + f.at[2] / fs.length], [0, 0, 0]);
function window(centre, slideX = 0.5) {
  const p = CAM.project(cam, W, H, [centre[0], centre[1] + 1.0, centre[2]]);
  const x0 = Math.round(Math.max(0, Math.min(W - VW, p[0] - VW * slideX))), y0 = Math.round(Math.max(0, Math.min(H - VH, p[1] - VH / 2)));
  const img = new Float32Array(VW * VH * 4); for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) for (let c = 0; c < 4; c++) img[(y * VW + x) * 4 + c] = plate.data[((y0 + y) * W + x0 + x) * 4 + c] / 255;
  return { W: VW, H: VH, img, x0, y0 };
}
const px = (still, p) => { const q = CAM.project(cam, W, H, p); return [q[0] - still.x0, q[1] - still.y0]; };
const fill = (st, x0, y0, w, h, c, k = 1) => { for (let y = Math.max(0, y0); y < Math.min(VH, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(VW, x0 + w); x++) { const i = (y * VW + x) * 4; for (let j = 0; j < 3; j++) st.img[i + j] = st.img[i + j] * (1 - k) + c[j] * k; } };
const PAPER = [0.91, 0.89, 0.84], INK = [0.10, 0.067, 0.094], RED = [0.6, 0.23, 0.12];
const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// the talk panel on paper (a mock: ruled lines, ink bars for lines of text, a red-ruled choice)
function talkPanel(st) {
  const x0 = Math.round(VW * 2 / 3); fill(st, x0, 0, VW - x0, VH, PAPER);
  fill(st, x0 + 26, 30, 200, 10, INK, 0.55);
  for (let r = 0; r < 16; r++) { const y = 96 + r * 38; fill(st, x0, y + 30, VW - x0, 1, INK, 0.12); if (r < 7) { fill(st, x0 + 26, y + 10, 80, 9, INK, 0.45); fill(st, x0 + 120, y + 8, 200 + 260 * hash(r, 3), 12, INK, 0.85); } }
  fill(st, x0 + 14, 650, VW - x0 - 28, 2, RED); fill(st, x0 + 14, 690, VW - x0 - 28, 2, RED); fill(st, x0 + 14, 650, 2, 42, RED); fill(st, VW - 16, 650, 2, 42, RED);
  for (let r = 0; r < 6; r++) { const y = 662 + r * 52; fill(st, x0 + 30, y, 12, 14, INK, 0.7); fill(st, x0 + 64, y, 220 + 200 * hash(r, 9), 14, INK, 0.9); }
}
// the fight strip: Standing and Breath notches on paper, bottom left
function fightStrip(st) {
  fill(st, 24, VH - 104, 330, 80, PAPER);
  for (let row = 0; row < 2; row++) { fill(st, 40, VH - 90 + row * 34, 70, 8, INK, 0.5); for (let k = 0; k < 6; k++) fill(st, 130 + k * 26, VH - 94 + row * 34, 18, 16, k < (row ? 4 : 5) ? INK : [0.78, 0.75, 0.7]); }
}
// a hit flash: one brush dab in the light's own colour, an ink rim on its first frame
function hitFlash(st, p, col, r = 40) {
  const [cx, cy] = px(st, p);
  for (let y = Math.floor(cy - r * 1.6); y < cy + r * 1.6; y++) for (let x = Math.floor(cx - r * 2); x < cx + r * 2; x++) {
    if (x < 0 || y < 0 || x >= VW || y >= VH) continue; const ang = Math.atan2(y - cy, x - cx), u = (x - cx) / (r * 1.7), w = (y - cy) / r, q = u * u + w * w, edge = 0.7 + 0.35 * hash(Math.floor(ang * 5 + 9), 3) + 0.12 * Math.sin(ang * 7);
    if (q > edge * 1.1) continue; const i = (y * VW + x) * 4;
    if (q > edge * 0.86) { for (let j = 0; j < 3; j++) st.img[i + j] = st.img[i + j] * 0.25 + INK[j] * 0.75; continue; }
    const k = 0.92 * (1 - q / edge) ** 0.35, stroke = 0.88 + 0.12 * hash(Math.floor((x - cx) * 0.25 + (y - cy) * 0.6), Math.floor((y - cy) * 0.15)); for (let j = 0; j < 3; j++) st.img[i + j] = st.img[i + j] * (1 - k) + Math.min(1, col[j] * 1.15 * stroke) * k;
  }
}
// a catch star: the engine's lens starburst at the catch point (as the plate's flare layer is made)
function catchStar(st, p, col, E = 30000) {
  const [cx, cy] = px(st, p), n = VW * VH, lin = new Float32Array(n * 3), lens = lensAt(info.variantInfo?.[v]?.hour ?? 23);
  const S2 = glow(lin, VW, VH, [{ x: cx, y: cy, E: [E * col[0], E * col[1], E * col[2]] }], { ...lens, starGain: lens.starGain * 3 }, "star");
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const s = 1 - Math.exp(-S2[i * 3 + j] * 1.6); st.img[i * 4 + j] = 1 - (1 - st.img[i * 4 + j]) * (1 - s); }
}
const to8 = (st) => { const o = new Uint8ClampedArray(VW * VH * 4); for (let i = 0; i < VW * VH * 4; i++) o[i] = Math.round(Math.min(1, Math.max(0, st.img[i])) * 255); return o; };
const custom = (figs) => ({ rig: S.rig, lamps: S.lamps, figs });

const walk = window(S.walk[0].at); await placeFigures(walk, { info, cam, W, H, name, custom: custom(S.walk) });
writePng(`${out}/${name}-${v}-walk.png`, { width: VW, height: VH, data: to8(walk) });
const talk = window(mid(S.talk), 1 / 3); await placeFigures(talk, { info, cam, W, H, name, custom: custom(S.talk) }); talkPanel(talk);
writePng(`${out}/${name}-${v}-talk.png`, { width: VW, height: VH, data: to8(talk) });
const fight = window(mid(S.fight)); await placeFigures(fight, { info, cam, W, H, name, custom: custom(S.fight) }); hitFlash(fight, S.hit, S.light); catchStar(fight, S.star, S.light); fightStrip(fight);
writePng(`${out}/${name}-${v}-fight.png`, { width: VW, height: VH, data: to8(fight) });
console.log(`${name} ${v}: walk, talk, fight`);
