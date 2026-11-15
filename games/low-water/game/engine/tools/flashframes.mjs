#!/usr/bin/env node
// The flash rule (F5, design/sensory/05-CARE.md section 2) offline, over a run of captured frames on disk: the same
// windows (cine/windows.mjs) and the same judge (cine/flash.mjs) the cinematics and the inner arena use, read from
// PNGs in name order (tools/impact-capture.mjs --dump a,b writes a fight's every frame). Before it judges the run it
// judges the controls, each planted on the run's first frame held still for the run's length (planting on the live
// frames would carry the run's own transitions into every control), so a pass means the detector works on this path:
//   still    the first frame held, nothing planted                         must pass
//   flash5   a 5 Hz full-frame white flash planted over the frames        must fail (flashes)
//   red2     a 2 Hz saturated red pulse over the top-left quarter          must fail (red)
//   breath   a 0.5 Hz 5% darkening of the whole frame                      must pass
//   dimred   a 2 Hz pulse of dark red (sRGB 90, 0, 0) over the top-left quarter               must fail (red)
//   pan      the frame panned 240 px left and back over 4 s, as a fight camera follows     must pass (no light changes)
// The report names the windows (7 x 7, sliding by half) where red transitions fall, with the frames and the window's
// pixel box, so the source can be found in the picture. The red rule is WCAG 2.2's (cine/redflash.mjs).
//   node tools/flashframes.mjs <dir> [--prefix both-frame-] [--fps 60] [--step 2] [--json out.json]
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readPng } from "../light/tools/png.mjs";
import { windowsOf } from "../cine/windows.mjs";
import { judgeFlash } from "../cine/flash.mjs";
import { transitions } from "../combat/tools/inner-capture.mjs";
import { redTransitions, chroma } from "../cine/redflash.mjs";

// a plant: (rgba copy, w, h, frame index, fps) -> rgba changed in place
export const PLANTS = {
  still: (d) => d,
  flash5: (d, w, h, i, fps) => { if (Math.floor((i * 10) / fps) % 2) d.fill(255); return d; },
  red2: (d, w, h, i, fps) => { if (Math.floor((i * 4) / fps) % 2) for (let y = 0; y < h / 2; y++) for (let x = 0; x < w / 2; x++) { const k = (y * w + x) * 4; d[k] = 255; d[k + 1] = 0; d[k + 2] = 0; } return d; },
  dimred: (d, w, h, i, fps) => { if (Math.floor((i * 4) / fps) % 2) for (let y = 0; y < h / 2; y++) for (let x = 0; x < w / 2; x++) { const k = (y * w + x) * 4; d[k] = 90; d[k + 1] = 0; d[k + 2] = 0; } return d; },
  pan: (d, w, h, i, fps) => { const off = Math.round(120 - 120 * Math.cos((2 * Math.PI * i) / (4 * fps))), src = new Uint8ClampedArray(d); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, j = (y * w + Math.min(w - 1, x + off)) * 4; d[k] = src[j]; d[k + 1] = src[j + 1]; d[k + 2] = src[j + 2]; } return d; },
  breath: (d, w, h, i, fps) => { const s = 1 - 0.05 * (0.5 + 0.5 * Math.sin((2 * Math.PI * 0.5 * i) / fps)); for (let k = 0; k < d.length; k += 4) { d[k] *= s; d[k + 1] *= s; d[k + 2] *= s; } return d; },
};
export const EXPECT = { still: "pass", flash5: "fail", red2: "fail", dimred: "fail", breath: "pass", pan: "pass" };

// where each red transition falls: window k's box in pixels, and the frames
export function redSites(frames, w, h) {
  const out = [];
  for (let k = 0; k < (frames[0] ? frames[0].R.length : 0); k++) {
    const t = redTransitions(frames.map((f) => f.M[k])), ts = transitions(frames.map((f) => f.R[k]), { abs: 0.05 }); if (!t.length && !ts.length) continue;
    const ox = k % 7, oy = Math.floor(k / 7), cw = w / 8, ch = h / 8;
    out.push({ window: k, box: [Math.round(ox * cw), Math.round(oy * ch), Math.round(cw * 2), Math.round(ch * 2)], transitions: t.length, shareTransitions: ts.length, frames: (t.length ? t : ts).slice(0, 12), share: +Math.max(...frames.map((f) => f.R[k])).toFixed(4), measure: +Math.max(...frames.map((f) => f.E[k])).toFixed(1), ratio: +Math.max(...frames.map((f) => { const [r, g, b] = f.M[k]; return r / Math.max(1e-9, r + g + b); })).toFixed(3) });
  }
  return out.sort((a, b) => b.transitions - a.transitions || b.shareTransitions - a.shareTransitions);
}

export function judgeDir(dir, { prefix = "", fps = 60, step = 2 } = {}) {
  const files = readdirSync(dir).filter((f) => f.endsWith(".png") && f.startsWith(prefix)).sort();
  if (!files.length) throw new Error(`flashframes: no ${prefix}*.png in ${dir}`);
  const runs = { real: [], ...Object.fromEntries(Object.keys(PLANTS).map((p) => [p, []])) }; let w = 0, h = 0, base = null;
  files.forEach((f, i) => {
    const img = readPng(join(dir, f)); w = img.width; h = img.height; base ||= img.data;
    runs.real.push(windowsOf(img.data, w, h, step));
    for (const [p, plant] of Object.entries(PLANTS)) runs[p].push(windowsOf(plant(new Uint8ClampedArray(base), w, h, i, fps), w, h, step));
  });
  const controls = Object.keys(PLANTS).map((p) => { const j = judgeFlash(runs[p], fps), failed = j.errs.length > 0; return { plant: p, expect: EXPECT[p], ok: EXPECT[p] === "fail" ? failed : !failed, ...j }; });
  return { dir, frames: files.length, first: files[0], last: files[files.length - 1], fps, size: [w, h], controls, real: { ...judgeFlash(runs.real, fps), sites: redSites(runs.real, w, h) } };
}

const isMain = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/flashframes.mjs");
if (isMain) {
  const argv = process.argv.slice(2), opt = {}, pos = [];
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; else pos.push(argv[i]);
  if (!pos[0]) { console.error("usage: node tools/flashframes.mjs <dir> [--prefix p] [--fps 60] [--step 2] [--json out.json]"); process.exit(2); }
  const r = judgeDir(pos[0], { prefix: opt.prefix || "", fps: +(opt.fps || 60), step: +(opt.step || 2) });
  console.log(`${r.frames} frames (${r.first} to ${r.last}) at ${r.fps} fps, ${r.size.join(" x ")}`);
  for (const c of r.controls) console.log(`control ${c.plant}: ${c.errs.length ? c.errs.join("; ") : "passes"} (must ${c.expect}) ${c.ok ? "ok" : "BROKEN"}`);
  console.log(`run: ${r.real.flashesPerSecond} flashes/s; ${r.real.redTransitions} saturated-red transitions (WCAG 2.2; ${r.real.redE20Transitions} by WCAG 2.0's measure, ${r.real.redShareTransitions} by the first share count)${r.real.errs.length ? `; ${r.real.errs.join("; ")}` : "; passes"}`);
  for (const s of r.real.sites.slice(0, 8)) console.log(`  window ${s.window} at ${s.box.join(",")} (x,y,w,h): ${s.transitions} red transitions (${s.shareTransitions} by share), peak share ${s.share}, peak 2.0 measure ${s.measure}, peak mean-colour ratio ${s.ratio} (red at 0.8), frames ${s.frames.join(" ")}`);
  if (opt.json) writeFileSync(opt.json, JSON.stringify(r, null, 1));
  process.exit(r.controls.some((c) => !c.ok) ? 2 : r.real.errs.length ? 1 : 0);
}
