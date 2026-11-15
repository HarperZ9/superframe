// Stills of the painted dialogue box (paint/portrait/box.html), headless, for the contact sheets.
//   node game/engine/paint/tools/boxshots.mjs --port 8760 --out DIR --shots "id|query;id|query;..."
// each query is box.html's (look, who, mood, set, name, text, bg, src). Run under the heavy-cpu lock.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { launch } from "../../tools/visualcheck/cdp.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), out = opt.out || "game/capture/paint/box";
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
await mkdir(out, { recursive: true });
const shots = String(opt.shots || "").split(";").filter(Boolean).map((s) => s.split("|"));
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) });
try {
  for (const [id, query] of shots) {
    const P = await B.page(1280, 720);
    await P.go(`http://127.0.0.1:${port}/engine/paint/portrait/box.html?${query}`);
    await P.until("document.documentElement.dataset.ready === '1'");
    await P.shot(join(out, `${id}.png`)); console.log(`boxshots: ${id}`);
    await P.close?.();
  }
} finally { await B.close(); }
