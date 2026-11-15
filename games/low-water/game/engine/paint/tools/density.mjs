// The glyph density ramp measured, not chosen by eye: the game's own atlas (glyph/atlas.mjs, the game's font at
// the cell size) built in a headless page, every printable ASCII character's ink coverage, and the 16-level
// ramp the trace style takes from them (glyph/tonemap.mjs measuredRamp). Writes glyph/styles/density.json.
//   node game/engine/paint/tools/density.mjs --port 8760
import { writeFile } from "node:fs/promises";
import { launch } from "../../tools/visualcheck/cdp.mjs";
const port = +(process.argv[process.argv.indexOf("--port") + 1] || 8760);
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), P = await B.page(800, 600);
try {
  await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0`);
  const r = JSON.parse(await P.eval(`(async () => {
    await document.fonts.load('12px "LW Conso"');   // the house mono, as the renderer waits for it
    const { buildAtlas } = await import("/engine/paint/glyph/atlas.mjs"), { GLYPH_DEFAULTS } = await import("/engine/paint/glyph/renderer.mjs"), { measuredRamp } = await import("/engine/paint/glyph/tonemap.mjs");
    const st = await (await fetch("/engine/paint/glyph/styles/trace.json")).json();
    const A = buildAtlas({ cw: GLYPH_DEFAULTS.cw, ch: GLYPH_DEFAULTS.ch, font: GLYPH_DEFAULTS.font });
    const cov = {}; for (let c = 32; c < 127; c++) { const ch = String.fromCharCode(c); cov[ch] = +A.cov[A.index(ch)].toFixed(4); }
    const ramp = measuredRamp(A.cov, [...st.charset].map((ch) => A.index(ch))).map((g) => A.chars[g]);
    return JSON.stringify({ font: GLYPH_DEFAULTS.font, cell: [GLYPH_DEFAULTS.cw, GLYPH_DEFAULTS.ch], coverage: cov, ramp: ramp.join(""), rampCoverage: ramp.map((ch) => cov[ch] ?? null) });
  })()`));
  r.note = "Measured by game/engine/paint/tools/density.mjs in the headless browser; coverage is the share of the cell the glyph's ink covers.";
  await writeFile(new URL("../glyph/styles/density.json", import.meta.url), JSON.stringify(r, null, 1) + "\n");
  console.log(`ramp ${JSON.stringify(r.ramp)}`, r.rampCoverage.join(" "));
} finally { await P.close(); await B.close(); }
