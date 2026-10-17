// The visual defect check (coordinator, 2026-10-17, after the author's "The clipping is pretty bad").
// Headless, GPU off, no window. Opens the game over a fixed set of views (tools/visualcheck/views.mjs)
// and, per view, measures what the author saw (tools/visualcheck/analyse.js):
//   - silhouettes of two figures passing through each other: pixels where both are drawn (each drawn
//     alone, held props included) at depths within 0.25 m: over 40 px or 2% of the smaller;
//   - a seated figure not on a seat the plate shows (sitting on air); a figure in a prop unless seated
//     on its own seat;
//   - figure footprints (a 0.25 m body) over prop cells: the check's own grid, samples 0.4 to 2 m
//     over the floor; and feet more than 0.3 m over the floor around (on a counter or bench);
//   - shadow pixels (dark and translucent, at the feet) where the plate under them is not the floor
//     the figure stands on (more than 0.2 m off);
//   - each figure's mid-tone luminance against the plate's around it, with a pass band (0.25 to 2.0: two stops darker to one stop brighter);
//   - figure pixels drawn over painting more than 0.5 m nearer than the pixel's own depth (its height
//     up the figure times sin(elevation) nearer than the feet), over 5% of the figure (occlusion);
//   - shadow pixels (each once, none within 2 px of the figure's own opaque pixels) darker than one
//     shadow by 0.08 or more, one shadow measured as the 98th percentile alpha under a single figure's
//     contact ellipse (the view's median rule when too few lone pixels): stacked.
// Writes a still and metrics per view and a summary; exits 1 when any view fails, loudly.
//   node tools/visual-check.mjs [--port 8754] [--out dir] [--only view,view] [--chrome path]
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
const views = opt.only ? VIEWS.filter((v) => opt.only.split(",").includes(v.id)) : VIEWS;

await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9333 + Math.floor(Math.random() * 500) }), report = [];
try {
  for (const v of views) {
    const P = await B.page(1280, 720), r = { view: v.id, why: v.why, fails: [], error: null };
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      for (const s of v.steps) await P.eval(s);
      await sleep(2500); // the figures' drawer settles, the camera arrives
      const m = await P.eval(`(${analyse})(${JSON.stringify(opt.band ? { band: opt.band.split(",").map(Number) } : {})})`);
      if (!m || m.error) throw new Error(m ? m.error : "no result");
      Object.assign(r, m);
      await P.shot(join(out, `${v.id}.png`));
    } catch (e) { r.error = e.message; r.fails.push(`could not judge this view: ${e.message}`); }
    r.logs = P.logs.slice(0, 20); P.close();
    report.push(r);
  }
} finally { await B.close(); }
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
let bad = 0;
for (const r of report) {
  const s = r.shadow || {};
  console.log(`${r.fails.length ? "FAIL" : "pass"}  ${r.view.padEnd(22)} figures ${(r.figures || []).length}, in props ${(r.figures || []).filter((f) => f.inProp).length}, luminance ratios ${(r.figures || []).map((f) => f.ratio).join(" ")}; shadow px ${s.pixels ?? "-"}, off floor ${s.offFloor ?? "-"}, stacked ${s.stacked ?? "-"}`);
  for (const f of r.fails) console.log(`        ${f}`);
  if (r.fails.length) bad++;
}
console.log(bad ? `\nVISUAL CHECK FAILED: ${bad} of ${report.length} views. Stills and report in ${out}` : `\nvisual check passed: ${report.length} views. Stills and report in ${out}`);
process.exit(bad ? 1 : 0);
