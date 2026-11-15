// The GPU painter against the CPU reference (paint/gpu.mjs, painter.mjs). In a browser with the GPU on (under
// the shared GPU lock), two painters paint the same sequence of figures (the test fixture: three figures at
// three sizes, turning and walking, 24 frames): one with the CPU's strokeAt, one with the GPU's membership
// pass. Per frame, over figure pixels:
//   off      share of pixels whose largest channel differs by more than 8 of 255 (budget OFF_MAX)
//   mean     mean absolute difference per channel, of 255 (budget MEAN_MAX)
//   ssim     structural similarity of the two images' luminance (8 x 8 windows; floor SSIM_MIN)
// and the control: the GPU painter with its paint order reversed (gpu.bug = 1) must break the budget.
// Also each painter's time per figure.
//   node game/engine/paint/tools/gpuverify.mjs --port 8760 [--sw]      (--sw: SwiftShader, no GPU lock)
import { spawn } from "node:child_process";
import { acquireGpuLock } from "../../../../tools/gpu-lock.mjs";
const argv = process.argv.slice(2), port = +(argv[argv.indexOf("--port") + 1] || 8760), sw = argv.includes("--sw");
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const BUDGET = { OFF_MAX: 0.02, MEAN_MAX: 1.5, SSIM_MIN: 0.97 };
const lock = sw ? null : await acquireGpuLock({ job: "low-water gpu painter verify" });
const cport = 9800 + Math.floor(Math.random() * 150);
const flags = sw ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--enable-webgl"];
const proc = spawn(EXE, ["--headless", `--remote-debugging-port=${cport}`, ...flags, "--no-first-run", "about:blank"], { stdio: "ignore", windowsHide: true });
try {
  for (let i = 0; i < 100; i++) { try { await (await fetch(`http://127.0.0.1:${cport}/json/version`)).json(); break; } catch { await sleep(100); } }
  const t = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: "PUT" })).json(), ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const wait = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0` }); await sleep(2500);
  const run = async (bug, fresh = 1) => {
    const r = await send("Runtime.evaluate", { expression: `(async () => {
      const { makePainter } = await import("/engine/paint/painter.mjs"), { makePaintGpu } = await import("/engine/paint/gpu.mjs"), { tables } = await import("/engine/paint/install.mjs"), { paletteAt } = await import("/engine/paint/palette.mjs"), { figure } = await import("/engine/paint/tests/fixture.mjs");
      const MATS = { coat: { id: 1 }, skin: { id: 4 }, hat: { id: 6 }, cheek: { id: 29 }, jawcool: { id: 39 }, eye: { id: 15 } };
      const gpu = makePaintGpu(); if (!gpu) return JSON.stringify({ error: "no WebGL2 with float colour buffers" }); gpu.bug = ${bug};
      const C = makePainter({ ...tables(MATS) }), Gp = makePainter({ ...tables(MATS), gpu: ${bug} < 0 ? null : gpu });
      const frames = [], tc = [], tg = [];
      const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      for (let f = 0; f < 24; f++) for (const [key, ppm, yaw] of [["a", 87, 0.02 * f], ["b", 140 + (f % 3) * 20, 1 + 0.05 * f], ["c", 230, -0.5 + 0.01 * f]]) {
        const A = figure({ w: Math.round(1.4 * ppm), h: Math.round(2.9 * ppm), ppm, yaw, dx: 0.004 * f }), B = { ...A, rgba: Uint8ClampedArray.from(A.rgba) };
        const ctx = { key, ppm, yawDeg: 26, palette: paletteAt("quay", 23 + f / 60), haze: 0 };
        if (${fresh}) { Gp.actors.clear(); for (const [k, v] of C.actors) Gp.actors.set(k, structuredClone(v)); }   // the same state before the frame: differences are this frame's only
        let t0 = performance.now(); C.paint(A.rgba, A.w, A.h, A.G, 1, { ...ctx }); tc.push(performance.now() - t0);
        t0 = performance.now(); Gp.paint(B.rgba, B.w, B.h, B.G, 1, { ...ctx }); tg.push(performance.now() - t0);
        let n = 0, off = 0, sum = 0; const w = A.w, h = A.h;
        for (let i = 0; i < w * h; i++) { if (!A.rgba[i * 4 + 3]) continue; n++; let mx = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A.rgba[i * 4 + c] - B.rgba[i * 4 + c]); sum += d; if (d > mx) mx = d; } if (mx > 8) off++; }
        // SSIM on luminance, 8 x 8 windows over the figure
        let ss = 0, sn = 0;
        for (let y = 0; y + 8 <= h; y += 8) for (let x = 0; x + 8 <= w; x += 8) {
          let ma = 0, mb = 0, k = 0; for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) { const i = ((y + yy) * w + x + xx) * 4; if (!A.rgba[i + 3]) continue; ma += lum(A.rgba, i); mb += lum(B.rgba, i); k++; }
          if (k < 32) continue; ma /= k; mb /= k; let va = 0, vb = 0, cv = 0;
          for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) { const i = ((y + yy) * w + x + xx) * 4; if (!A.rgba[i + 3]) continue; const a = lum(A.rgba, i) - ma, b = lum(B.rgba, i) - mb; va += a * a; vb += b * b; cv += a * b; }
          va /= k - 1; vb /= k - 1; cv /= k - 1; const c1 = 6.5, c2 = 58.5; ss += ((2 * ma * mb + c1) * (2 * cv + c2)) / ((ma * ma + mb * mb + c1) * (va + vb + c2)); sn++;
        }
        frames.push({ off: off / n, mean: sum / (n * 3), ssim: sn ? ss / sn : 1 });
      }
      const worst = { off: Math.max(...frames.map((x) => x.off)), mean: Math.max(...frames.map((x) => x.mean)), ssim: Math.min(...frames.map((x) => x.ssim)) };
      const med = (a) => { const s = [...a].sort((x, y) => x - y); return +s[s.length >> 1].toFixed(2); };
      return JSON.stringify({ frames: frames.length, worst, cpuMs: med(tc.slice(6)), gpuMs: med(tg.slice(6)), renderer: gpu.gl.getParameter(gpu.gl.RENDERER) });
    })()`, awaitPromise: true, returnByValue: true });
    return JSON.parse(r.result.result.value || '{"error":"no result"}');
  };
  if (argv.includes("--self")) { console.log("cpu against its own state copy", JSON.stringify(await run(-1))); }
  const ref = await run(0), ctl = await run(1), drift = await run(0, 0);   // drift: the two painters each keep their own history
  const pass = (x) => !x.error && x.worst.off <= BUDGET.OFF_MAX && x.worst.mean <= BUDGET.MEAN_MAX && x.worst.ssim >= BUDGET.SSIM_MIN;
  console.log("gpu painter  ", JSON.stringify(ref), pass(ref) ? "within budget" : "OUT OF BUDGET");
  console.log("own histories", JSON.stringify(drift.worst), "(history accumulates small differences; not judged)");
  console.log("control (order reversed)", JSON.stringify(ctl), pass(ctl) ? "PASSED: the check is blind" : "fails as it must");
  process.exitCode = pass(ref) && !pass(ctl) ? 0 : 1;
  ws.close();
} finally { proc.kill(); if (lock) lock.release(); }
