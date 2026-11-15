// Frame time (design/RENDER-TARGET.md T11), headless with the GPU off, so every canvas is drawn on
// the CPU: the numbers compare builds on this machine, they are not the game's frame rate on a GPU.
// For each build, one view: the mean and 95th percentile of the time between animation frames over
// four seconds, and, sampled through the same seconds, the painter's milliseconds per figure, the
// light layer's and the glyph layer's.
//   node game/engine/paint/tools/timing.mjs --port 8760 [--view quay-talk] [--w 1280 --h 720]
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { VIEWS } from "./views.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), W = +(opt.w || 1280), H = +(opt.h || 720), v = VIEWS.find((x) => x.id === (opt.view || "quay-talk"));
const BUILDS = [["before", "paint=0&light=0"], ["paint", "light=0"], ["paint+light", ""], ["glyph", "look=glyph"]];
const MEASURE = `(async () => {
  globalThis.__lwGlyphFlush = ${!!opt.flush};
  const gaps = [], paint = [], light = [], glyph = []; let last = performance.now(), stop = false;
  const tick = (t) => { gaps.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  const t0 = performance.now();
  while (performance.now() - t0 < 4000) { await new Promise((r) => setTimeout(r, 120)); const S = globalThis.__lwPaintStats || {}; for (const k of Object.keys(S)) paint.push(S[k].ms); if (globalThis.__lwLightStats) light.push(globalThis.__lwLightStats.ms); if (globalThis.__lwGlyphStats) glyph.push(globalThis.__lwGlyphStats.ms); }
  stop = true; gaps.shift(); gaps.sort((a, b) => a - b);
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : null);
  return { frameMs: mean(gaps), frameP95: gaps.length ? +gaps[Math.floor(gaps.length * 0.95)].toFixed(1) : null, frames: gaps.length, paintMsPerFigure: mean(paint), lightMs: mean(light), glyphMs: mean(glyph), glyphParts: globalThis.__lwGlyphStats && globalThis.__lwGlyphStats.parts };
})()`;
const B = await launch({ exe: `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`, port: 9400 + Math.floor(Math.random() * 400) });
try {
  for (const [name, q] of BUILDS) {
    const P = await B.page(W, H);
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&${q}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      for (const s of v.steps) await P.eval(s);
      await sleep(2000);
      console.log(name.padEnd(12), JSON.stringify(await P.eval(MEASURE)));
    } catch (e) { console.error(`timing: ${name}: ${e.message}`); }
    await P.close();
  }
} finally { await B.close(); }
