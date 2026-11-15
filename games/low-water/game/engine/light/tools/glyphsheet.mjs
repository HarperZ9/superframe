// Both styles, before and after, for every proof scene: the painted reference relight (oilsheet.mjs, already
// written to --oil) and the glyph renderer through harness.html under its own light and under the model's.
// Needs the worktree server (game/engine/paint/tools/serve.mjs) on --port.
//   node game/engine/light/tools/glyphsheet.mjs --port 8780 --oil <dir> --out <dir> [--only id,...]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { readPng, writePng } from "./png.mjs";
import { sheet } from "./sheet.mjs";
import { SCENES } from "./oilsheet.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const root = join(fileURLToPath(import.meta.url), "../../../../.."), out = opt.out || join(root, "game/capture/light/glyph"), oil = opt.oil || join(root, "game/capture/light/oil");
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
mkdirSync(out, { recursive: true });
const only = opt.only ? opt.only.split(",") : null, B = await launch({ exe, port: 9500 + Math.floor(Math.random() * 300) }), stats = {}, cells = [];
try {
  for (const sc of SCENES) {
    if (only && !only.includes(sc.id)) continue;
    for (const light of ["own", "model"]) {
      const P = await B.page(960, 600);
      try {
        await P.go(`http://127.0.0.1:${opt.port || 8780}/engine/light/tools/harness.html?plate=${sc.plate}&hour=${sc.hour}&state=${sc.state}&t=${sc.t ?? 0}&light=${light}`);
        await P.until("document.documentElement.dataset.ready === '1'"); await sleep(300);
        const r = await P.eval("JSON.stringify(window.__light)"); stats[`${sc.id}/${light}`] = JSON.parse(r);
        await P.shot(join(out, `${sc.id}-${light}.png`)); console.log(`${sc.id} ${light}: ${r.slice(0, 160)}`);
      } finally { await P.close(); }
    }
    const img = (f) => readPng(f);
    cells.push({ img: img(join(oil, `${sc.id}-before.png`)), label: `${sc.label} OIL BEFORE` }, { img: img(join(oil, `${sc.id}-after.png`)), label: "OIL AFTER" },
      { img: img(join(out, `${sc.id}-own.png`)), label: "GLYPH BEFORE" }, { img: img(join(out, `${sc.id}-model.png`)), label: "GLYPH AFTER" });
  }
} finally { await B.close(); }
writeFileSync(join(out, "stats.json"), JSON.stringify(stats, null, 1));
writePng(join(out, "sheet.png"), sheet(cells, { cols: 4, cellW: 480, cellH: 300, title: "LIGHT MODEL: BOTH STYLES, BEFORE AND AFTER" }));
