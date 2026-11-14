// Measures for the glyph proof scenes (glyph/tools/scenes.mjs), each with a control:
//   legibility  the plate's structure read in type (glyph/legibility.mjs: share of structural cells that
//               read); control: the night floor off and the exposure cut to a twentieth (must fall)
//   outline     agreement of the figures' outlines between the styles at one framing: the painted people
//               layer's alpha reduced to the glyph grid's cells (a cell is figure when a quarter of it is
//               covered) against the cells the glyph figures set; intersection over union. Control: the glyph
//               mask moved four cells right (must fall)
//   rim, face   per figure, how many cells carry a rim and a face (__lwGlyphSep)
//   node game/engine/paint/glyph/tools/measure.mjs --port 8790 [--only id,id]   -> JSON lines
// Original code.
import { launch, sleep } from "../../../tools/visualcheck/cdp.mjs";
import { SCENES } from "./scenes.mjs";
import { LOOK } from "./pairs.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const ids = opt.only ? opt.only.split(",") : ["square-dawn", "square-night", "kitchen-night", "granary-fight", "dialogue"];

// the painted figures' alpha per glyph cell, read in painted mode (the grid from the glyph renderer's last layout)
const PAINTED_MASK = `(() => { const pc = document.querySelector('canvas.peoplecanvas'); if (!pc) return null; const d = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data; return { w: pc.width, h: pc.height, a: Array.from(d.filter((_, i) => i % 4 === 3)) }; })()`;
const GLYPH_MASK = `(() => { const S = window.__lw.play.renderers.glyph.state; return S.figMask ? { m: Array.from(S.figMask), g: S.grid, leg: window.__lw.play.renderers.glyph.measure(), sep: globalThis.__lwGlyphSep, light: [S.lightFrom, window.__lw.play.renderers.glyph.opts.adapt, S.hour, window.__lw.G.clock()] } : null; })()`;
const DARK = "(async () => { const g = window.__lw.play.renderers.glyph; g.opts.floor = 0; g.opts.exposure = 0.05; g.state.key = ''; await new Promise((q) => setTimeout(q, 1200)); return true; })()";
function iou(pm, gm, shift = 0) {
  const { g } = gm; let inter = 0, uni = 0;
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    let cov = 0, n = 0; for (let j = 0; j < g.ch; j += 2) for (let i = 0; i < g.cw; i += 2) { const X = g.ox + x * g.cw + i, Y = g.oy + y * g.ch + j; if (X < 0 || Y < 0 || X >= pm.w || Y >= pm.h) continue; n++; if (pm.a[Y * pm.w + X] > 40) cov++; }
    const p = n && cov / n > 0.25, xs = x - shift, q = xs >= 0 && xs < g.cols && gm.m[y * g.cols + xs] === 1;
    if (p && q) inter++; if (p || q) uni++;
  }
  return uni ? +(inter / uni).toFixed(3) : null;
}
const B = await launch({ exe, port: 9650 + Math.floor(Math.random() * 300) });
try {
  for (const id of ids) {
    const P = await B.page(1920, 1080), r = { id };
    try {
      await P.go(`http://127.0.0.1:${opt.port || 8790}/engine/play.html?capture=1&tips=0&smoke=0&blot=0&content=quota${opt.query ? "&" + opt.query : ""}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      for (const s of SCENES[id].steps) await P.eval(s); await sleep(2500);
      const pm = await P.eval(PAINTED_MASK); await P.eval("(() => { globalThis.__lwGlyphMasks = true; return true; })()"); await P.eval(LOOK("glyph")); await sleep(600);
      const gm = await P.eval(GLYPH_MASK);
      if (pm && gm) { r.outline = iou(pm, gm); r.outlineControl = iou(pm, gm, 4); }
      r.legibility = gm && gm.leg ? { structure: gm.leg.structure, coverage: gm.leg.coverage, median: gm.leg.median } : null;
      r.figures = gm && gm.sep; r.light = gm && gm.light;
      await P.eval(DARK); const dk = await P.eval(GLYPH_MASK); r.legibilityControl = dk && dk.leg ? { structure: dk.leg.structure, coverage: dk.leg.coverage, median: dk.leg.median } : null;
    } catch (e) { r.error = e.message; }
    await P.close(); console.log(JSON.stringify(r));
  }
} finally { await B.close(); }
