// Frame time on the GPU (coordinator, 2026-10-21: GPU timings per scene beside the CPU ones). Takes
// the shared GPU lock (tools/gpu-lock.mjs), launches headless Chromium with the GPU on (ANGLE on D3D11), and per scene
// and build measures: mean and 95th percentile ms between frames over four seconds, the glyph raster's
// GPU ms (WebGL2 timer query), the glyph renderer's CPU ms, the painter's ms a figure.
//   node game/engine/paint/tools/gpu-timing.mjs --port 8760 [--views quay-talk,...] [--out file.json] [--shots dir] [--builds json]
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { VIEWS } from "./views.mjs";
import { acquireGpuLock } from "../../../../tools/gpu-lock.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const views = (opt.views || "quay-walk,quay-talk,quay-fight,quay-rain,floor-dark,brine-bar").split(",").map((id) => VIEWS.find((v) => v.id === id));
const BUILDS = opt.builds ? JSON.parse(opt.builds) : [["painted", "paint=1"], ["glyph gpu", "look=glyph"], ["glyph cpu", "look=glyph&glyph=cpu"]];

// the shared GPU lock (tools/gpu-lock.mjs: <lock root>/lock.d, heartbeat, stale takeover, release on exit)
let gpuLock = null;
const takeLock = async () => { gpuLock = await acquireGpuLock({ job: "low-water rendering lead, gpu-timing" }); };
const dropLock = async () => { if (gpuLock) gpuLock.release(); gpuLock = null; };

async function browser(cport) {
  const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
  const proc = spawn(exe, ["--headless", `--remote-debugging-port=${cport}`, "--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--enable-webgl", "--no-first-run", "--window-size=1920,1080", "about:blank"], { stdio: "ignore", windowsHide: true });
  for (let i = 0; i < 100; i++) { try { await (await fetch(`http://127.0.0.1:${cport}/json/version`)).json(); break; } catch { await sleep(100); } }
  const page = async (w, h) => {
    const t = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: "PUT" })).json(), ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
    let id = 0; const wait = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
    const send = (method, params = {}) => new Promise((ok) => { const k = ++id; wait.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
    await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront"); await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    const evalJ = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
    return { go: (u) => send("Page.navigate", { url: u }), eval: evalJ, shot: async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); await writeFile(path, Buffer.from(r.result.data, "base64")); }, close: async () => { ws.close(); try { await fetch(`http://127.0.0.1:${cport}/json/close/${t.id}`); } catch { /* gone */ } } };
  };
  return { page, close: () => proc.kill() };
}

const MEASURE = `(async () => {
  const gaps = [], paint = [], gcpu = [], ggpu = []; let last = performance.now(), stop = false;
  const tick = (t) => { gaps.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  const t0 = performance.now();
  while (performance.now() - t0 < 4000) { await new Promise((r) => setTimeout(r, 100)); const S = globalThis.__lwPaintStats || {}; for (const k of Object.keys(S)) paint.push(S[k].ms); const g = globalThis.__lwGlyphStats; if (g) { gcpu.push(g.ms); if (g.gpuMs != null) ggpu.push(g.gpuMs); } }
  stop = true; gaps.shift(); gaps.sort((a, b) => a - b);
  const mean = (a) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(3) : null);
  return { frameMs: mean(gaps), frameP95: gaps.length ? +gaps[Math.floor(gaps.length * 0.95)].toFixed(1) : null, paintMsPerFigure: mean(paint), glyphCpuMs: mean(gcpu), glyphGpuMs: mean(ggpu), raster: globalThis.__lwGlyphStats && globalThis.__lwGlyphStats.raster };
})()`;

const t00 = Date.now(), results = {};
await takeLock();
const B = await browser(9500 + Math.floor(Math.random() * 300));
try {
  const P0 = await B.page(400, 300); await P0.go("about:blank"); await sleep(300);
  results.renderer = await P0.eval(`(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return 'no webgl2'; const d = g.getExtension('WEBGL_debug_renderer_info'); return (d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : '?') + ' timer:' + !!g.getExtension('EXT_disjoint_timer_query_webgl2'); })()`);
  await P0.close(); console.log("renderer:", results.renderer);
  for (const v of views) {
    results[v.id] = {};
    for (const [name, q] of BUILDS) {
      if (Date.now() - t00 > 40 * 60000) { console.log("gpu-timing: 40 minutes used; stopping"); break; }
      const P = await B.page(1920, 1080);
      try {
        await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&${q}`);
        for (let i = 0; i < 600; i++) { try { if (await P.eval("document.documentElement.dataset.ready === '1' && !!window.__lw")) break; } catch { /* loading */ } await sleep(200); }
        for (const s of v.steps) await P.eval(s);
        await sleep(2500);
        results[v.id][name] = await P.eval(MEASURE);
        if (opt.shots) { await mkdir(opt.shots, { recursive: true }); await P.shot(`${opt.shots}/${v.id}-${name.replace(/ /g, '-')}.png`); }
      } catch (e) { results[v.id][name] = { error: e.message }; }
      await P.close(); console.log(v.id.padEnd(12), name.padEnd(10), JSON.stringify(results[v.id][name]));
    }
  }
} finally { B.close(); await dropLock(); }
if (opt.out) await writeFile(opt.out, JSON.stringify(results, null, 1));

