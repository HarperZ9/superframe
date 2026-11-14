// Saves the light layer's canvases for one view (debugging the light pass by eye).
//   node game/engine/paint/tools/layers.mjs --port 8760 --view floor-dark --out game/capture/paint/layers
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { VIEWS } from "./views.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const out = opt.out || "game/capture/paint/layers", v = VIEWS.find((x) => x.id === (opt.view || "floor-dark"));
await mkdir(out, { recursive: true });
const B = await launch({ exe: `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`, port: 9400 + Math.floor(Math.random() * 400) });
try {
  const P = await B.page(1920, 1080);
  await P.go(`http://127.0.0.1:${opt.port || 8760}/engine/play.html?capture=1`);
  await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
  for (const s of v.steps) await P.eval(s);
  await sleep(2500);
  const urls = await P.eval(`(() => { const L = window.__lw.play.light; return L ? { pool: L.pool.toDataURL(), mirror: L.mirror.toDataURL(), glint: L.glint.toDataURL(), stats: { ...(globalThis.__lwLightStats || {}), lobe: globalThis.__lwLobeDbg } } : null; })()`);
  for (const k of ["pool", "mirror", "glint"]) await writeFile(join(out, `${v.id}-${k}.png`), Buffer.from(urls[k].split(",")[1], "base64"));
  console.log("light layer", JSON.stringify(urls.stats));
} finally { await B.close(); }
