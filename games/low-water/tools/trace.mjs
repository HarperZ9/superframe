// A Chrome trace of the game's frames, summed by thread and event, for the work that is not
// JavaScript on the main thread (compositing, raster, GPU commands, uploads). GPU on (ANGLE D3D11),
// under the shared GPU lock. Per view: each thread's busy ms a frame and its top events by self time.
//   node tools/trace.mjs --port 8790 [--views quay-walk,brine-bar] [--query "paint=1&figures=plain"] [--ms 3000] [--top 10] [--out f.json]
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { VIEWS } from "../game/engine/paint/tools/views.mjs";
import { acquireGpuLock } from "./gpu-lock.mjs";
import { MORE_VIEWS } from "./bench-views.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8790), MS = +(opt.ms || 3000), TOP = +(opt.top || 10), query = opt.query || "paint=1";
const ALL = [...VIEWS, ...MORE_VIEWS], views = (opt.views || "quay-walk").split(",").map((id) => ALL.find((v) => v.id === id));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const CATS = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "toplevel", "blink", "cc", "gpu", "viz", "v8", "disabled-by-default-gpu.service"];

async function page(cport) {
  const t = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: "PUT" })).json(), ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const wait = new Map(), events = []; let done = null;
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else if (d.method === "Tracing.dataCollected") events.push(...d.params.value); else if (d.method === "Tracing.tracingComplete" && done) done(); };
  const send = (method, params = {}) => new Promise((ok) => { const k = ++id; wait.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
  await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront"); await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text); return r.result.result.value; };
  return { send, ev, events, stop: () => new Promise((ok) => { done = ok; send("Tracing.end"); }), close: () => { ws.close(); } };
}

const L = await acquireGpuLock({ job: "low-water perf trace" });
const cport = 9800 + Math.floor(Math.random() * 100);
const proc = spawn(EXE, ["--headless", `--remote-debugging-port=${cport}`, "--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--enable-webgl", "--no-first-run", "--window-size=1920,1080", "about:blank"], { stdio: "ignore", windowsHide: true });
const out = {};
try {
  for (let i = 0; i < 100; i++) { try { await (await fetch(`http://127.0.0.1:${cport}/json/version`)).json(); break; } catch { await sleep(100); } }
  for (const v of views) {
    const P = await page(cport);
    await P.send("Page.navigate", { url: `http://127.0.0.1:${port}/engine/play.html?capture=1&${query}` });
    for (let i = 0; i < 600; i++) { try { if (await P.ev("document.documentElement.dataset.ready === '1' && !!window.__lw")) break; } catch { /* loading */ } await sleep(200); }
    for (const s of v.steps) await P.ev(s);
    await sleep(2500);
    await P.send("Tracing.start", { traceConfig: { includedCategories: CATS, recordMode: "recordContinuously" }, transferMode: "ReportEvents" });
    // a view with a during() (a move between places): run half a second into the trace
    if (v.during) setTimeout(() => P.ev(`(${v.during})()`).catch((e) => console.warn(`trace: during: ${e.message}`)), 500);
    await sleep(MS); await P.stop(); P.close();
    // threads by name; complete events (X) and B/E pairs, self time per event name per thread
    const tname = new Map(), pname = new Map();
    for (const e of P.events) if (e.ph === "M" && e.name === "thread_name") tname.set(`${e.pid}:${e.tid}`, e.args.name); else if (e.ph === "M" && e.name === "process_name") pname.set(e.pid, e.args.name);
    const frames = P.events.filter((e) => e.name === "BeginFrame" || e.name === "DrawFrame").reduce((m, e) => (m[e.name] = (m[e.name] || 0) + 1, m), {});
    const nFrames = frames.DrawFrame || frames.BeginFrame || 1;
    const spans = new Map();   // thread -> [{ts, end, name}]
    const stacks = new Map();
    for (const e of P.events.sort((a, b) => a.ts - b.ts)) {
      const k = `${e.pid}:${e.tid}`;
      if (e.ph === "X" && e.dur != null) (spans.get(k) || spans.set(k, []).get(k)).push({ ts: e.ts, end: e.ts + e.dur, name: e.name });
      else if (e.ph === "B") (stacks.get(k) || stacks.set(k, []).get(k)).push(e);
      else if (e.ph === "E") { const st = stacks.get(k); const b = st && st.pop(); if (b) (spans.get(k) || spans.set(k, []).get(k)).push({ ts: b.ts, end: e.ts, name: b.name }); }
    }
    const res = {};
    for (const [k, S] of spans) {
      S.sort((a, b) => a.ts - b.ts || b.end - a.end);
      // self time: subtract direct children (nesting by containment)
      const self = new Map(), stack = [];
      let busy = 0, lastEnd = -Infinity;
      for (const s of S) {
        while (stack.length && stack[stack.length - 1].end <= s.ts) stack.pop();
        const parent = stack[stack.length - 1]; if (parent) parent.child += Math.min(s.end, parent.end) - s.ts;
        s.child = 0; stack.push(s);
        if (s.end > lastEnd) { busy += s.end - Math.max(s.ts, lastEnd); lastEnd = s.end; }
      }
      for (const s of S) self.set(s.name, (self.get(s.name) || 0) + (s.end - s.ts - s.child));
      const [pid] = k.split(":"), name = `${pname.get(+pid) || pid}/${tname.get(k) || k}`;
      res[name] = { busyMsPerFrame: +(busy / 1000 / nFrames).toFixed(2), top: [...self].sort((a, b) => b[1] - a[1]).slice(0, TOP).map(([n, t]) => [n, +(t / 1000 / nFrames).toFixed(2)]) };
    }
    // the longest spans on the renderer's main thread (a hitch: what held the frame), with their longest children
    let t00 = Infinity; for (const e of P.events) if (e.ts && e.ts < t00) t00 = e.ts;
    for (const [k, S] of spans) { if (tname.get(k) !== "CrRendererMain") continue;
      const long = S.filter((x) => x.end - x.ts > 40000).sort((a, b) => (b.end - b.ts) - (a.end - a.ts)).slice(0, 10);
      for (const L0 of long) { const kids = S.filter((x) => x !== L0 && x.ts >= L0.ts && x.end <= L0.end && x.end - x.ts > 5000).sort((a, b) => (b.end - b.ts) - (a.end - a.ts)).slice(0, 6);
        console.log(`  long: ${((L0.ts - t00) / 1000).toFixed(0)} ms in, ${((L0.end - L0.ts) / 1000).toFixed(1)} ms ${L0.name}: ${kids.map((x) => `${x.name} ${((x.end - x.ts) / 1000).toFixed(1)}`).join(", ")}`); } }
    // and on every other thread, the spans over 40 ms (what a main thread waiting on a commit waited for)
    if (opt.allthreads) for (const [k, S] of spans) { if (tname.get(k) === "CrRendererMain") continue;
      for (const L0 of S.filter((x) => x.end - x.ts > 40000).sort((a, b) => (b.end - b.ts) - (a.end - a.ts)).slice(0, 5)) console.log(`  other: ${tname.get(k) || k} ${((L0.ts - t00) / 1000).toFixed(0)} ms in, ${((L0.end - L0.ts) / 1000).toFixed(1)} ms ${L0.name}: ${S.filter((x) => x !== L0 && x.ts >= L0.ts && x.end <= L0.end && x.end - x.ts > 5000).sort((a, b) => (b.end - b.ts) - (a.end - a.ts)).slice(0, 5).map((x) => `${x.name} ${((x.end - x.ts) / 1000).toFixed(1)}`).join(", ")}`); }
    out[v.id] = { frames, windowMs: MS, msPerFrame: +(MS / nFrames).toFixed(2), threads: Object.fromEntries(Object.entries(res).sort((a, b) => b[1].busyMsPerFrame - a[1].busyMsPerFrame).slice(0, 8)) };
    console.log(`${v.id}: ${nFrames} frames in ${MS} ms (${out[v.id].msPerFrame} ms a frame)`);
    for (const [n, r] of Object.entries(out[v.id].threads)) console.log(`  ${String(r.busyMsPerFrame).padStart(6)} ms  ${n}: ${r.top.slice(0, 6).map(([a, b]) => `${a} ${b}`).join(", ")}`);
  }
} finally { proc.kill(); L.release(); }
if (opt.out) await writeFile(opt.out, JSON.stringify(out, null, 1));
