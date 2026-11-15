// Glyph mode on a still camera (research note GAME.md item 4: "any cell changing glyph with no change
// in the scene" fails): two glyph frames five seconds apart in one view, the world clock held, the
// cells that changed counted apart from the cells people cover (people idle and breathe).
//   node game/engine/paint/tools/glyphstill.mjs --port 8760 [--view quay-talk]
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { VIEWS } from "./views.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const v = VIEWS.find((x) => x.id === (opt.view || "quay-talk"));
const B = await launch({ exe: `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`, port: 9400 + Math.floor(Math.random() * 400) });
try {
  const P = await B.page(1280, 720);
  await P.go(`http://127.0.0.1:${opt.port || 8760}/engine/play.html?capture=1&look=glyph`);
  await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
  for (const s of v.steps) await P.eval(s);
  await sleep(3000);
  const grab = `(() => { const p = window.__lw.play, c = p.glyph.canvas, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, pc = p.people.canvas, pd = pc.getContext('2d').getImageData(0, 0, pc.width, pc.height).data; const f = p.cam.frameNow(); return { d: Array.from(d.filter((_, i) => i % 4 === 0)), fig: Array.from(pd.filter((_, i) => i % 4 === 3)), w: c.width, h: c.height, cam: [f.left, f.top, f.zoom], drawn: (globalThis.__lwGlyphStats || {}).drawn }; })()`;
  await P.eval("(() => { const G = window.__lw.G; if (G.loop) G.loop.paused = true; return true; })()");
  // a still camera: wait until the follow camera has come to rest (it eases for some seconds after a walk)
  await P.eval(`(async () => { const cm = window.__lw.play.cam, k = () => { const f = cm.frameNow(); return f.left + ',' + f.top + ',' + f.zoom; }; let a = k(), still = 0; for (let i = 0; i < 300 && still < 20; i++) { await new Promise((r) => requestAnimationFrame(r)); const b = k(); still = b === a ? still + 1 : 0; a = b; } return still; })()`);
  const a = await P.eval(grab); await sleep(5000); const b = await P.eval(grab);
  const cw = 8, ch = 12, cols = Math.floor(a.w / cw), rows = Math.floor(a.h / ch); let changed = 0, changedFig = 0, cells = 0, figCells = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let diff = false, fig = false;
    for (let j = 0; j < ch && !diff; j++) for (let i = 0; i < cw; i++) { const k = (y * ch + j) * a.w + x * cw + i; if (a.d[k] !== b.d[k]) { diff = true; break; } }
    for (let j = 0; j < ch && !fig; j++) for (let i = 0; i < cw; i++) { const k = (y * ch + j) * a.w + x * cw + i; if (a.fig[k] > 0 || b.fig[k] > 0) { fig = true; break; } }
    if (fig) { figCells++; if (diff) changedFig++; } else { cells++; if (diff) changed++; }
  }
  console.log(JSON.stringify({ camA: a.cam, camB: b.cam, drawnB: b.drawn, view: v.id, groundCells: cells, groundChanged: changed, figureCells: figCells, figureChanged: changedFig }));
} finally { await B.close(); }
