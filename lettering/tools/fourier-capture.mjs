// Stills and frame timing for the fourier technique, from lettering/demo/fourier.html in a headless Chromium.
//   node lettering/tools/fourier-capture.mjs <out-dir> [--no-bench] [--hardware-gpu]   (--hardware-gpu: ANGLE on D3D11, under the GPU lock)
// Writes PNG stills at device scale 1 (the build at four moments, the machine, a morph midway, the band reveal, the
// oscilloscope while the shape plays) and timing.json: per-frame ms (mean, p95, max) with the CPU unthrottled and
// throttled 4x, on the GPU renderer and the 2D fallback. Holds the shared bench lock while timing.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireBench, acquireGpuLock } from '../../games/low-water/tools/gpu-lock.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url)), OUT = process.argv[2], BENCH = !process.argv.includes('--no-bench'), HW = process.argv.includes('--hardware-gpu');
if (!OUT) throw new Error('usage: fourier-capture.mjs <out-dir>');
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.wasm': 'application/wasm' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// letter.mjs bench() waits for the GPU but not for a 2D canvas, whose drawing is rasterised later. This one reads a
// pixel back after every frame on both, so the two renderers are timed the same way: the frame's work and its raster.
const synced = `(d, seconds) => {
  const c = d.canvas, gl = c.getContext('webgl2'), x = gl ? null : c.getContext('2d'), px = new Uint8Array(4), ms = [];
  d.impl.replay?.();
  for (let f = 0; f <= seconds * 60; f++) { const a = performance.now(), more = d.impl.draw(null, f / 60); if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); else x.getImageData(0, 0, 1, 1); ms.push(performance.now() - a); if (!more && f > 60) break; }
  d.impl.finish?.(); const s = ms.slice().sort((p, q) => p - q);
  return { frames: ms.length, meanMs: ms.reduce((p, q) => p + q, 0) / ms.length, p95Ms: s[Math.floor(0.95 * s.length)], maxMs: s.at(-1), synced: true };
}`;

const server = createServer(async (req, res) => {
  const p = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!p.startsWith(normalize(ROOT))) { res.writeHead(403).end(); return; }
  try { const b = await readFile(p); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }).end(b); } catch { res.writeHead(404).end(); }
}).listen(0);
const port = server.address().port, cport = 9300 + Math.floor(Math.random() * 400);
await mkdir(OUT, { recursive: true });
const proc = spawn(EXE, ['--headless', `--remote-debugging-port=${cport}`, '--autoplay-policy=no-user-gesture-required', ...(HW ? ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] : []), '--no-first-run', '--window-size=1600,2400', 'about:blank'], { stdio: 'ignore', windowsHide: true });
let lock = null, gpuLock = null;
try {
  let t = null;
  for (let i = 0; i < 50 && !t; i++) { try { t = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: 'PUT' })).json(); } catch { await sleep(200); } }
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener('open', r));
  let id = 0; const wait = new Map(), logs = [];
  ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400)); });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600)); return r.result?.result?.value; };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 2400, deviceScaleFactor: 1, mobile: false });
  const open = async (qs = '') => { await send('Page.navigate', { url: `http://127.0.0.1:${port}/lettering/demo/fourier.html${qs}` }); for (let i = 0; i < 150; i++) { if (await ev('!!(window.demo && window.demo.ready)')) return; await sleep(100); } throw new Error('demo did not start: ' + logs.join('\n')); };
  const shot = async (sel, name) => {
    const box = await ev(`(() => { const r = document.querySelector('${sel}').getBoundingClientRect(); return { x: r.left - 24, y: r.top + scrollY - 24, width: r.width + 48, height: r.height + 48 }; })()`);
    const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 1 }, captureBeyondViewport: true });
    await writeFile(join(OUT, name), Buffer.from(r.result.data, 'base64')); return name;
  };
  const files = [];
  await open();
  for (const s of [0.25, 0.8, 1.4, 2.6]) { await ev(`demo.items.build.seek(${s})`); files.push(await shot('#build', `build-t${s.toFixed(2)}.png`)); }
  await ev('demo.items.machine.seek(1.6)'); files.push(await shot('#machine', 'machine-t1.60.png'));
  for (const s of [5.0, 7.0, 8.4]) { await ev(`demo.items.morph.seek(${s})`); files.push(await shot('#morph', `morph-t${s.toFixed(2)}.png`)); }
  for (const s of [0.5, 1.2, 2.6]) { await ev(`demo.items.band.seek(${s})`); files.push(await shot('#band', `band-t${s.toFixed(2)}.png`)); }
  // the art under the real text: the text shown in translucent red over the settled letters
  await ev(`demo.items.build.finish(); document.getElementById('build').style.setProperty('-webkit-text-fill-color', 'rgba(230,0,40,.45)')`);
  files.push(await shot('#build', 'overlay-text-on-art.png'));
  await ev(`document.getElementById('build').style.removeProperty('-webkit-text-fill-color')`);
  const info = await ev('JSON.stringify(Object.fromEntries(Object.entries(demo.items).map(([k, d]) => [k, { ...d.impl.info, setupMs: Math.round(d.stats.setupMs), glyphMs: Math.round(d.stats.glyphMs) }])))');
  let scopeOk = false;
  try { await ev('demo.items.build.finish(); demo.items.build.act("play")'); await sleep(1600); files.push(await shot('#build', 'scope-playing.png')); scopeOk = true; } catch (e) { logs.push('scope: ' + e.message); }
  const timing = { info: JSON.parse(info), runs: [] };
  if (BENCH) {
    lock = await acquireBench({ job: 'fourier lettering timing' }); timing.drain = lock.drain;
    if (HW) gpuLock = await acquireGpuLock({ job: 'fourier lettering timing' });
    for (const renderer of ['gpu', '2d']) {
      for (const rate of [1, 4]) {
        // throttled before the page loads, so setup is timed under the same CPU as the frames
        await send('Emulation.setCPUThrottlingRate', { rate }); await open(`?renderer=${renderer}`);
        timing.setup = timing.setup || []; timing.setup.push({ renderer, cpuThrottle: rate, ...(await ev('JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(demo.items).map(([k, d]) => [k, Math.round(d.stats.setupMs)]))))')) });
        for (const item of ['build', 'machine', 'morph']) timing.runs.push({ renderer, cpuThrottle: rate, item, ...(await ev(`(${synced})(demo.items.${item}, ${item === 'morph' ? 9 : 5})`)), kind: await ev(`demo.items.${item}.impl.info.renderer`) });
        await send('Emulation.setCPUThrottlingRate', { rate: 1 });
      }
    }
  }
  timing.webgl = await ev(`(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return 'none'; const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER); })()`);
  timing.files = files; timing.scopeCaptured = scopeOk; timing.logs = logs.slice(0, 40); timing.when = new Date().toISOString();
  await writeFile(join(OUT, 'timing.json'), JSON.stringify(timing, null, 2));
  console.log(JSON.stringify(timing, null, 2));
  ws.close();
} finally { gpuLock?.release?.(); lock?.release?.(); proc.kill(); server.close(); }
