// Stills of the game for the painter's before-and-after record. Headless, GPU off (the GPU belongs to
// training while it runs). Each view boots a fresh Act 1 game (seed 11, the Wader), puts Lamb and the
// named people somewhere, waits for the drawer to settle and takes a still.
//   node game/engine/paint/tools/capture.mjs --port 8760 --out game/capture/paint/after [--query paint=0] [--only quay-walk,...] [--w 1920 --h 1080]
// Start the worktree server first: node game/engine/paint/tools/serve.mjs --port 8760
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { VIEWS } from "./views.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), out = opt.out || "game/capture/paint/now", W = +(opt.w || 1920), H = +(opt.h || 1080);
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const views = opt.only ? VIEWS.filter((v) => opt.only.split(",").includes(v.id)) : VIEWS;
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), report = [];
try {
  for (const v of views) {
    const P = await B.page(W, H), r = { view: v.id };
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0${opt.query ? "&" + opt.query : ""}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      if (opt.debug) await P.eval(`globalThis.__lwPaintDebug = ${opt.debug}`);
      for (const s of v.steps) await P.eval(s);
      await sleep(v.settle || 3000);
      r.stats = await P.eval("JSON.stringify(globalThis.__lwPaintStats || null)");
      await P.shot(join(out, `${v.id}.png`));
      // each figure alone, as a mask for the readability measure (tools/readability.py)
      const masks = await P.eval(`(() => { const p = window.__lw.play; if (!p || !p.people) return {}; const o = {}; for (const f of p.people.figures()) { const c = p.people.drawSolo(f.who); o[f.who] = c.toDataURL("image/png"); } return o; })()`);
      for (const [who, url] of Object.entries(masks || {})) await writeFile(join(out, `${v.id}.mask-${who}.png`), Buffer.from(url.split(",")[1], "base64"));
      if (P.logs.length) r.logs = P.logs.slice(0, 8);
    } catch (e) { r.error = e.message; console.error(`capture: ${v.id}: ${e.message}`); }
    await P.close(); report.push(r); console.log(`${v.id}: ${r.error || "ok"}`);
  }
} finally { await B.close(); }
await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
