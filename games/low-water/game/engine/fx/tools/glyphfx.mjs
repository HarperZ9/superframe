// Effects proof, glyph form: each effects scene through the real glyph renderer under the light model, without and with
// the effects' marks (light/tools/harness.html, fxscene and fx), then one sheet with the painted pairs beside them.
//   node game/engine/fx/tools/glyphfx.mjs --port 8780 [--oil <fxsheet out>] [--out <dir>]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { readPng, writePng } from "../../light/tools/png.mjs";
import { sheet } from "../../light/tools/sheet.mjs";
import { FX_SCENES } from "./scenes.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), out = opt.out || join(root, "game/capture/fx/glyph"), oil = opt.oil || join(root, "game/capture/fx/oil");
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
mkdirSync(out, { recursive: true });
const B = await launch({ exe, port: 9600 + Math.floor(Math.random() * 200) }), cells = [];
try {
  for (const sc of FX_SCENES) {
    for (const fx of ["0", "1"]) {
      const P = await B.page(960, 600);
      try {
        await P.go(`http://127.0.0.1:${opt.port || 8780}/engine/light/tools/harness.html?plate=${sc.plate}&hour=${sc.hour}&t=${sc.t ?? 4}&light=model&fxscene=${sc.id}&fx=${fx}`);
        await P.until("document.documentElement.dataset.ready === '1'"); await sleep(300);
        console.log(sc.id, fx, (await P.eval("JSON.stringify(window.__light.fx || window.__light.error || null)")));
        await P.shot(join(out, `${sc.id}-${fx === "1" ? "after" : "before"}.png`));
      } finally { await P.close(); }
    }
    cells.push({ img: readPng(join(oil, `${sc.id}-before.png`)), label: `${sc.label} OIL` }, { img: readPng(join(oil, `${sc.id}-after.png`)), label: "OIL FX" },
      { img: readPng(join(out, `${sc.id}-before.png`)), label: "GLYPH" }, { img: readPng(join(out, `${sc.id}-after.png`)), label: "GLYPH FX" });
  }
} finally { await B.close(); }
writePng(join(out, "sheet.png"), sheet(cells, { cols: 4, cellW: 480, cellH: 300, title: "EFFECTS: BOTH STYLES, BEFORE AND AFTER" }));
