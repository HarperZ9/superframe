// The F7 tip's life in painted mode: shown on a first visit, gone after 6 s, not shown on the next visit.
//   node game/engine/paint/tools/tipcheck.mjs --port 8760
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { VIEWS } from "./views.mjs";
const port = +(process.argv[process.argv.indexOf("--port") + 1] || 8760);
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), P = await B.page(1280, 720), v = VIEWS.find((x) => x.id === "ferry-deck");
const read = () => P.eval("(() => { const h = document.querySelector('.glyphhint'); return h ? JSON.stringify({ text: h.textContent, opacity: getComputedStyle(h).opacity }) : 'none'; })()");
const out = [];
try {
  for (const visit of [1, 2]) {
    await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1`);
    await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    for (const s of v.steps) await P.eval(s);
    const t0 = Date.now(); await sleep(3000); out.push(`visit ${visit} at ${((Date.now() - t0) / 1000).toFixed(1)} s: ${await read()}`);
    await sleep(4500); out.push(`visit ${visit} at ${((Date.now() - t0) / 1000).toFixed(1)} s: ${await read()}`);
  }
} finally { await P.close(); await B.close(); }
console.log(out.join("\n"));
