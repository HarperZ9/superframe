// The visual defect check (coordinator, 2026-10-17, after the author's "The clipping is pretty bad").
// Headless, GPU off, no window. Opens the game over a fixed set of views (tools/visualcheck/views.mjs)
// and, per view, measures what the author saw (tools/visualcheck/analyse.js):
//   - silhouettes of two figures passing through each other: where both are drawn (each drawn alone,
//     held props included, the drawer's own per-pixel depth), surfaces within 4 cm or crossing (each in
//     front of the other over 20 px or more): over 40 px or 2% of the smaller;
//   - a seated figure not on a seat the plate shows (sitting on air); a figure in a prop unless seated
//     on its own seat;
//   - figure footprints (a 0.25 m body) over prop cells: the check's own grid, samples 0.4 to 2 m
//     over the floor; and feet more than 0.3 m over the floor around (on a counter or bench);
//   - shadow pixels (dark and translucent, at the feet) where the plate under them is not the floor
//     the figure stands on (more than 0.2 m off);
//   - each figure's mid-tone luminance against the plate's around it, with a pass band (0.25 to 1.6: two stops darker to two thirds of a stop brighter; it was 2.0 until the author called the figures overblown);
//   - figure pixels drawn over painting more than 0.5 m nearer than the pixel's own depth (its height
//     up the figure times sin(elevation) nearer than the feet), over 5% of the figure (occlusion);
//   - shadow pixels (each once, none within 2 px of the figure's own opaque pixels) darker than one
//     shadow by 0.08 or more, one shadow measured as the 98th percentile alpha under a single figure's
//     contact ellipse (the view's median rule when too few lone pixels): stacked.
// Writes a still and metrics per view and a summary; exits 1 when any view fails, loudly.
//   node tools/visual-check.mjs [--port 8754] [--out dir] [--only view,view] [--chrome path] [--query "paint=0&light=0"]
// Run it before every capture that goes out.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { launch, sleep } from "./visualcheck/cdp.mjs";
import { VIEWS } from "./visualcheck/views.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const here = dirname(fileURLToPath(import.meta.url));
const port = +(opt.port || 8754), out = opt.out || join(here, "..", "..", "capture", "visual-check");
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const analyse = await readFile(join(here, "visualcheck", "analyse.js"), "utf8");
// glyph mode (--query look=glyph): figures and shadows are judged in painted mode (Glyph draws its figures in
// type, not on the people layer); here the UI is judged, with a control that turns the glyph panel layout off
const GLYPH = /look=glyph/.test(opt.query || "");
// the unpainted control: the plate in view under a 4 x 4 ordered-dither screen (seven of sixteen pixels darkened by
// two fifths), as the palette plates are screened
const SCREEN = "(async () => { await new Promise((q) => setTimeout(q, 1500)); const c = document.querySelector('canvas.platecam-img'), f = window.__lw.play.cam.frameNow(); if (!c || !f) return false; const g = c.getContext('2d'), x0 = Math.max(0, Math.floor(f.left)), y0 = Math.max(0, Math.floor(f.top)), w = Math.min(c.width - x0, Math.ceil(innerWidth / f.zoom)), h = Math.min(c.height - y0, Math.ceil(innerHeight / f.zoom)), im = g.getImageData(x0, y0, w, h), d = im.data; const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (B[(y & 3) * 4 + (x & 3)] < 7) { const i = (y * w + x) * 4; d[i] *= 0.6; d[i + 1] *= 0.6; d[i + 2] *= 0.6; } g.putImageData(im, x0, y0); return true; })()";
// the camouflage control: blotches 6 to 18 plate pixels across, green, blue and red as lamps lit the Spit's old rime,
// painted onto the plate canvas inside the view (a seeded generator, so the plant is the same every run)
const CAMO = "(async () => { await new Promise((q) => setTimeout(q, 1500)); const c = document.querySelector('canvas.platecam-img'), f = window.__lw.play.cam.frameNow(); if (!c || !f) return false; const g = c.getContext('2d'); let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); const cols = ['#9fb36a', '#6f86c8', '#d0503a', '#e6d8a0']; for (let i = 0; i < 2500; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); g.ellipse(f.left + r() * innerWidth / f.zoom, f.top + r() * innerHeight / f.zoom, 3 + r() * 6, 3 + r() * 6, 0, 0, Math.PI * 2); g.fill(); } return true; })()";
// the dark-plate control: the glyph renderer's night floor off and its exposure cut, the light baked again
const DARKEN = "(async () => { const p = window.__lw.play; await p.renderersReady; for (let i = 0; i < 100 && !(p.renderers && p.renderers.mode() === 'glyph'); i++) await new Promise((q) => setTimeout(q, 50)); const g = p.renderers.glyph; g.opts.floor = 0; g.opts.glow = false; g.opts.exposure = 0.05; g.state.key = ''; await new Promise((q) => setTimeout(q, 900)); return true; })()";
// the control's plant: two paper panels laid one over the other (the page's own layout may no longer overlap anything)
const PLANT = "(async () => { for (const [x, y] of [[700, 300], [760, 340]]) { const d = document.createElement('div'); d.className = 'sheet'; d.textContent = 'planted panel'; Object.assign(d.style, { position: 'absolute', left: x + 'px', top: y + 'px', width: '320px', height: '140px', zIndex: 60 }); document.body.append(d); } await new Promise((q) => setTimeout(q, 600)); return true; })()";
const ALL = GLYPH ? [...VIEWS.filter((v) => !(v.expectFail && /silhouettes/.test(String(v.expectFail)))), { ...VIEWS.find((v) => v.id === "fight-against-a-wall"), id: "control-glyph-panels-overlap", expectFail: /ui \(glyph\)/, why: "self-test: glyph panel layout off and two panels planted one over the other", steps: ["(() => { globalThis.__lwGlyphNoLayout = true; return true; })()", ...VIEWS.find((v) => v.id === "fight-against-a-wall").steps, PLANT] },
  { ...VIEWS.find((v) => v.id === "fight-against-a-wall"), id: "control-glyph-ways-hidden", expectFail: /ways \(glyph\)/, why: "self-test: the glyph layer for ways out turned off, as when the outline was drawn only on the fight canvas under the type", steps: ["(() => { globalThis.__lwGlyphNoWays = true; return true; })()", ...VIEWS.find((v) => v.id === "fight-against-a-wall").steps] },
  { ...VIEWS.find((v) => v.id === "notes-walking"), id: "control-glyph-dark-plate", expectFail: /legibility \(glyph\)/, why: "self-test: the night floor off and the exposure cut to a twentieth, so the plate goes unreadably dark", steps: [...VIEWS.find((v) => v.id === "notes-walking").steps, DARKEN] }] : [...VIEWS, { ...VIEWS.find((v) => v.id === "notes-walking"), id: "control-unpainted", expectFail: /unpainted/, why: "self-test: a one-pixel dither screen laid over the plate in view, as the palette Gut showed in Act 3", steps: [...VIEWS.find((v) => v.id === "notes-walking").steps, SCREEN] }, { ...VIEWS.find((v) => v.id === "notes-walking"), id: "control-camouflage", expectFail: /camouflage/, why: "self-test: compact blotches in lamp colours planted on the plate in view, as the Spit's old frost had them", steps: [...VIEWS.find((v) => v.id === "notes-walking").steps, CAMO] }];
const views = opt.only ? ALL.filter((v) => opt.only.split(",").includes(v.id)) : ALL;

await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9333 + Math.floor(Math.random() * 500) }), report = [];
try {
  for (const v of views) {
    const P = await B.page(1280, 720), r = { view: v.id, why: v.why, fails: [], error: null };
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0&smoke=0${/figs=/.test(opt.query || "") ? "" : "&figs=sync"}${opt.query ? "&" + opt.query : ""}`);   // figures drawn in the frame they are judged in (?figs=sync): a worker's image arriving late made the gate flaky
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      for (const s of v.steps) await P.eval(s);
      await sleep(2500); // the figures' drawer settles, the camera arrives
      const m = await P.eval(`(${analyse})(${JSON.stringify(opt.band ? { band: opt.band.split(",").map(Number) } : {})})`);
      if (!m || m.error) throw new Error(m ? m.error : "no result");
      Object.assign(r, m);
      await P.shot(join(out, `${v.id}.png`));
    } catch (e) { r.error = e.message; r.fails.push(`could not judge this view: ${e.message}`); }
    r.logs = P.logs.slice(0, 20); await P.close();
    report.push(r);
  }
} finally { await B.close(); }
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
let bad = 0, judged = 0;
for (const r of report) {
  const v = ALL.find((x) => x.id === r.view) || {};
  // a control plants a defect: it must fail on that defect, or the check has gone blind and the run fails
  if (v.expectFail) { const ok = r.fails.some((f) => v.expectFail.test(f)); console.log(`${ok ? "ctrl" : "FAIL"}  ${r.view.padEnd(22)} ${ok ? "failed as it must: the check sees what the control plants" : "PASSED: the check is blind to what this control plants"}`); if (!ok) bad++; continue; }
  judged++;
  const s = r.shadow || {};
  console.log(`${r.fails.length ? "FAIL" : "pass"}  ${r.view.padEnd(22)} figures ${(r.figures || []).length}, in props ${(r.figures || []).filter((f) => f.inProp).length}, luminance ratios ${(r.figures || []).map((f) => f.ratio).join(" ")}; shadow px ${s.pixels ?? "-"}, off floor ${s.offFloor ?? "-"}, stacked ${s.stacked ?? "-"}${r.blotch ? `; blotch ${r.blotch.score}` : ""}${r.unpainted ? `; screen ${r.unpainted.screen}` : ""}${r.ways && r.ways.length ? `; ways ${r.ways.map((x) => x.shown).join(" ")}` : ""}${r.glyphLegible ? `; glyph legibility ${r.glyphLegible.structure} of ${r.glyphLegible.structural}` : ""}`);
  for (const f of r.fails) console.log(`        ${f}`);
  if (r.fails.length) bad++;
}
console.log(bad ? `
VISUAL CHECK FAILED: ${bad} of ${report.length} views (controls included). Stills and report in ${out}` : `
visual check passed: ${judged} views, and every control failed as it must. Stills and report in ${out}`);
process.exit(bad ? 1 : 0);
