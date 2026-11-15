// Light temporal stability: does the light's own movement (fire and lamp flicker, the crowd, the clock) make
// either style crawl? Over 2 s at 60 frames a second, a still camera, per proof scene:
//   oil    mean and 99th-percentile frame-to-frame change in L* of the relit plate's lit pixels
//   glyph  the share of world cells whose tone level (16 levels, the glyph pipeline's tone map) changes between
//          frames, with the renderer's 0.35-level hysteresis applied as the glyph renderer applies it
// against a control: the same lights with white-noise flicker of the same amplitude (a new random gain each
// frame), which must be clearly worse. Pass lines, set before measuring: oil p99 under 3 L*, glyph under 1%;
// set after the first run showed the control also under them (amplitudes are small): the model's p99 step
// a third of the control's or less. swingP99: how far a lit pixel moves over the run (is the flicker seen at all).
//   node game/engine/light/tools/stability.mjs [--plates <dir>] [--out file.json]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScene } from "../scene.mjs";
import { stocksReader } from "./stocks.mjs";
import { Lstar } from "../legible.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), plates = opt.plates || join(root, "game/capture/light/plates");
const SC = [["granary", "q_granary", 23.7], ["kitchen-furrowe", "q_furrowe_kitchen", 18.6], ["kitchen-brack", "q_brack_kitchen", 19.1], ["kitchen-haldane", "q_haldane", 7.6], ["square-night", "q_square_wide", 22]];
const LIMIT = { oilP99: 3, glyphShare: 0.01 };
const tone = (E, i) => { const l = 0.2126 * E[i * 3] + 0.7152 * E[i * 3 + 1] + 0.0722 * E[i * 3 + 2]; return Math.min(15.999, 16 * Math.sqrt(Math.min(1, l * 1.6))); };

function run(S, gainsAt, frames = 120) {
  const F = S.F, n = F.n, lit = []; let prevL = null, prevT = null, held = null, lo = null, hi = null; const dL = [], share = [];
  for (let f = 0; f < frames; f++) {
    const E = S.compose({ t: f / 60, gains: gainsAt(f) });
    const L = new Float32Array(n), T = new Float32Array(n);
    for (let i = 0; i < n; i++) { if (!Number.isFinite(F.N[i * 3])) continue; const c = (k) => Math.min(1, Math.pow(Math.max(0, E[i * 3 + k]) * 1.6, 1 / 2.2)); L[i] = Lstar(c(0), c(1), c(2)); T[i] = tone(E, i); }
    if (!held) { held = Int8Array.from(T, (v) => Math.floor(v)); for (let i = 0; i < n; i++) if (L[i] > 8) lit.push(i); lo = L.slice(); hi = L.slice(); }
    for (const i of lit) { if (L[i] < lo[i]) lo[i] = L[i]; if (L[i] > hi[i]) hi[i] = L[i]; }
    if (prevL) {
      const d = lit.map((i) => Math.abs(L[i] - prevL[i])).sort((a, b) => a - b); dL.push([d.reduce((a, b) => a + b, 0) / (d.length || 1), d[Math.floor(d.length * 0.99)] || 0]);
      let ch = 0, tot = 0; for (let i = 0; i < n; i++) { if (!Number.isFinite(F.N[i * 3])) continue; tot++; const h = held[i]; if (T[i] > h + 1 + 0.35 || T[i] < h - 0.35) { held[i] = Math.floor(T[i]); ch++; } } share.push(ch / (tot || 1));
    }
    prevL = L; prevT = T;
  }
  const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const sw = lit.map((i) => hi[i] - lo[i]).sort((a, b) => a - b);
  return { swingP99: +(sw[Math.floor(sw.length * 0.99)] || 0).toFixed(2), oilMean: +mean(dL.map((d) => d[0])).toFixed(3), oilP99: +mean(dL.map((d) => d[1])).toFixed(3), glyphShare: +mean(share).toFixed(5) };
}
const out = {};
for (const [id, plate, hour] of SC) {
  const dir = join(plates, plate), pj = JSON.parse(readFileSync(join(dir, "place.json"), "utf8")), b = readFileSync(join(dir, "geo-pos.f32"));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(join(dir, "geo-id.u8"))) };
  const S = buildScene({ pj, geo, read: stocksReader(root, "start") }); S.M.setHour(hour);
  // the control's amplitude: each light's own largest swing over the run, drawn fresh each frame
  const amp = S.M.lights.map((L) => { let lo = Infinity, hi = -Infinity; for (let f = 0; f < 120; f++) { const g = S.M.gains(f / 60)[S.M.lights.indexOf(L)]; lo = Math.min(lo, g); hi = Math.max(hi, g); } return [lo, hi]; });
  let seed = 7; const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const model = run(S, (f) => S.M.gains(f / 60)), control = run(S, () => Float32Array.from(amp, ([lo, hi]) => lo + (hi - lo) * rnd()));
  out[id] = { model, control, calmer: +(control.oilP99 / Math.max(1e-6, model.oilP99)).toFixed(1), pass: model.oilP99 < LIMIT.oilP99 && model.glyphShare < LIMIT.glyphShare && model.oilP99 * 3 < control.oilP99 };
  console.log(id, JSON.stringify(out[id]));
}
if (opt.out) writeFileSync(opt.out, JSON.stringify({ limits: LIMIT, scenes: out }, null, 1));
