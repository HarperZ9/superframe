// Glyph stability in motion (author, 2026-10-21: "stable glyphs in motion (measure flicker as you
// did for strokes)"). Lamb walks back and forth on the quay with the camera following, in glyph mode;
// every drawn frame the Glyph renderer's cells are read (glyph per cell, the cells the figures set,
// and the grid's first world cell). Between consecutive frames the same world cells are compared,
// leaving out any a figure set (or rings) in either frame. Only the camera and the lantern moved.
//   with hysteresis (the renderer as it is) against the control without it (?glyph=nohyst).
//   node game/engine/paint/tools/glyphmotion.mjs --port 8760 [--frames 80]
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const frames = +(opt.frames || 80);
const PAGE = `(async () => {
  globalThis.__lwGlyphMasks = true;
  const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('quay');
  for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) { f.wander = 0; f.at = [60, 0, 60]; }
  c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
  for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 2500));
  await p.renderersReady; const GR = p.renderers.glyph, snaps = []; let last = null, leg = 0;
  const A = [0.4, 0, -1.4], B = [3.2, 0, -0.4]; p.people.walkTo(B, () => {});
  const t0 = performance.now();
  while (snaps.length < ${frames} && performance.now() - t0 < 120000) {
    await new Promise((r) => requestAnimationFrame(r));
    const st = GR.state, B = st.buf, pv = st.prev; if (!B || !pv || (last && last.I0 === pv.I0 && last.J0 === pv.J0 && last.n === GR.state.stats.frame)) continue;
    const f = p.cam.frameNow(), info = st.grid;
    if (!info) continue; last = { I0: pv.I0, J0: pv.J0, n: GR.state.stats.frame };
    // figure cells: those the figures were set into this frame (the figure renderer marks them)
    snaps.push({ I0: info.I0, J0: info.J0, cols: info.cols, rows: info.rows, k: Int16Array.from(B.G), fig: Uint8Array.from(st.figMask || []), left: f.left, top: f.top });
    if (!p.people.walking()) { leg++; p.people.walkTo(leg % 2 ? A : B, () => {}); }
  }
  let pairs = 0, moved = 0, cells = 0, changed = 0;
  for (let s = 1; s < snaps.length; s++) {
    const a = snaps[s - 1], b = snaps[s]; pairs++; if (a.left !== b.left || a.top !== b.top) moved++;
    const nearFig = (S2, x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S2.cols && Y < S2.rows && S2.fig[Y * S2.cols + X]) return true; } return false; };
    for (let y = 2; y < a.rows - 2; y++) for (let x = 2; x < a.cols - 2; x++) {
      const xb = x + a.I0 - b.I0, yb = y + a.J0 - b.J0; if (xb < 2 || yb < 2 || xb >= b.cols - 2 || yb >= b.rows - 2) continue;
      if (nearFig(a, x, y) || nearFig(b, xb, yb)) continue;
      cells++; if (a.k[y * a.cols + x] !== b.k[yb * b.cols + xb]) changed++;
    }
  }
  return { frames: snaps.length, pairs, cameraMoved: moved, groundCells: cells, changed, flicker: +(changed / Math.max(1, cells)).toFixed(4), glyphMs: globalThis.__lwGlyphStats && globalThis.__lwGlyphStats.ms };
})()`;
const B = await launch({ exe: `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`, port: 9400 + Math.floor(Math.random() * 400) });
try {
  for (const [name, q] of (opt.builds ? JSON.parse(opt.builds) : [["hysteresis", "look=glyph"], ["no hysteresis", "look=glyph&glyph=nohyst"]])) {
    const P = await B.page(1280, 720);
    try {
      await P.go(`http://127.0.0.1:${opt.port || 8760}/engine/play.html?capture=1&${q}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      await sleep(500);
      console.log(name.padEnd(16), JSON.stringify(await P.eval(PAGE)));
    } catch (e) { console.error(`glyphmotion: ${name}: ${e.message}`); }
    await P.close();
  }
} finally { await B.close(); }
