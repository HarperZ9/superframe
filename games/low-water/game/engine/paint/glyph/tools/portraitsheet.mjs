// A contact sheet of glyph portraits beside the painted ones from the same head reference: per sitter, the
// painted portrait (characters/portraits-<cast>/), the glyph portrait at play size (30 x 25 cells of 8 x 12,
// the talk panel's frame at 1080p) and at portrait size (60 x 50 cells), for each mood asked for.
//   node game/engine/paint/glyph/tools/portraitsheet.mjs --port 8790 --who mary,ned --moods neutral,wary,angry --out <png> [--set portraits-quota] [--era 2] [--light paraffin]
// Original code.
import { writeFile } from "node:fs/promises";
import { launch } from "../../../tools/visualcheck/cdp.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const who = (opt.who || "mary").split(","), moods = (opt.moods || "neutral").split(","), set = opt.set || "portraits-quota", light = opt.light || "paraffin", era = +(opt.era ?? 2);
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const PAGE = `(async () => {
  await document.fonts.load('12px "LW Conso"');
  const { buildAtlas } = await import('/engine/paint/glyph/atlas.mjs'), { glyphPortrait, portraitCells, MOOD_BASE } = await import('/engine/paint/glyph/portrait.mjs'), { eraLook } = await import('/engine/paint/glyph/eras.mjs');
  const A = buildAtlas({ cw: 8, ch: 12 }), look = eraLook(${era}), who = ${JSON.stringify(who)}, moods = ${JSON.stringify(moods)};
  const PW = 240, PH = 300, BW = 480, BH = 600, gap = 16, colW = PW + BW + 2 * gap + 8, rowH = BH + 40;
  const cv = document.createElement('canvas'); cv.width = moods.length * (colW + PW) + gap; cv.height = who.length * rowH + gap; const g = cv.getContext('2d'); g.fillStyle = '#100c10'; g.fillRect(0, 0, cv.width, cv.height);
  const img = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });
  const draw = (cells, cols, rows, x0, y0) => { const id = g.createImageData(cols * 8, rows * 12); cells.forEach((c, k) => { const cx = (k % cols) * 8, cy = Math.floor(k / cols) * 12, a = A.alpha[c.g]; for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) { const t = a[y * 8 + x] / 255, q = ((cy + y) * cols * 8 + cx + x) * 4; for (let ch = 0; ch < 3; ch++) id.data[q + ch] = c.bg[ch] + (c.fg[ch] - c.bg[ch]) * t; id.data[q + 3] = 255; } }); g.putImageData(id, x0, y0); };
  for (let r = 0; r < who.length; r++) {
    const P = await glyphPortrait('${set}', who[r]); g.fillStyle = '#c8c0b0'; g.font = '14px "LW Conso"'; g.fillText(who[r], gap, r * rowH + gap + 12);
    for (let m = 0; m < moods.length; m++) {
      const x0 = gap + m * (colW + PW), y0 = r * rowH + gap + 22;
      const pi = await img('/characters/${set}/' + who[r] + '/' + (MOOD_BASE[moods[m]] || 'neutral') + '-${light}.png'); if (pi) g.drawImage(pi, x0, y0, PW, PH);
      g.fillStyle = '#c8c0b0'; g.fillText(moods[m] + ' (' + (MOOD_BASE[moods[m]] || 'neutral') + ')', x0, y0 + PH + 18);
      if (!P) continue; draw(portraitCells(P, { mood: moods[m], light: '${light}', cols: 30, rows: 25 }, A, look), 30, 25, x0 + PW + gap, y0);
      draw(portraitCells(P, { mood: moods[m], light: '${light}', cols: 60, rows: 50 }, A, look), 60, 50, x0 + 2 * PW + 2 * gap, y0);
    }
  }
  return cv.toDataURL('image/png'); })()`;
const B = await launch({ exe, port: 9500 + Math.floor(Math.random() * 300) });
try {
  const P = await B.page(800, 600); await P.go(`http://127.0.0.1:${opt.port || 8790}/engine/play.html?capture=1&tips=0`); await P.until("document.documentElement.dataset.ready === '1'");
  const url = await P.eval(PAGE); await writeFile(opt.out || "portraits-glyph.png", Buffer.from(url.split(",")[1], "base64")); console.log(`wrote ${opt.out}`);
} finally { await B.close(); }
