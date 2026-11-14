// Frame benchmark for painted mode (perf/PROGRESS.md). Per scene (the six views of
// game/engine/paint/tools/views.mjs) and per browser (GPU on, ANGLE on D3D11, or GPU off), it
// reports:
//   - frame: mean and 95th percentile ms between animation frames over four seconds;
//   - sections: the figure drawer's own timers (characters/runtime/perf.mjs), ms per frame and calls
//     per frame, summed over every figure in the frame;
//   - profile: a V8 sampling profile over three seconds, self time per frame grouped by stage
//     (figure raster and shading, painter, plate, lighting, weather, UI, the engine loop, GC, the
//     browser's own work) and the top functions.
// Every run holds the `bench` lock (tools/gpu-lock.mjs, <lock root>/bench.d), which keeps heavy CPU jobs
// out and waits up to 10 minutes for running ones to finish; GPU runs also take the GPU lock. Machine load
// is sampled for 3 s before and after the run (the bench's own browser closed), and the result is called
// quiet only when both are at or under 15 %.
// --repeat N measures every view N times under the one bench hold and prints the spread.
// --q2 a=1,b=2 appends query parameters (for shells where & is awkward); --prio idle|below sets priority.
// --hog N runs the loaded-machine benchmark: tools/cpuhog.mjs spins N threads (default all logical cores
// but two) for the whole run, and the result is labelled loaded.
//   node tools/bench.mjs --port 8790 [--gpu 1|0|both] [--views quay-walk,...] [--query "paint=1"] [--out file.json] [--shots dir] [--top 12] [--repeat N] [--hog [N]]
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { cpus, availableParallelism, setPriority } from "node:os";
import { acquireGpuLock, acquireBench } from "./gpu-lock.mjs";
import { VIEWS as PAINT_VIEWS } from "../game/engine/paint/tools/views.mjs";
import { MORE_VIEWS } from "./bench-views.mjs";
const VIEWS = [...PAINT_VIEWS, ...MORE_VIEWS];

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8790), sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const views = (opt.views || "quay-walk,quay-talk,quay-fight,quay-rain,floor-dark,brine-bar").split(",").map((id) => VIEWS.find((v) => v.id === id) || (() => { throw new Error(`bench: no view ${id}`); })());
const modes = opt.gpu === "both" ? [true, false] : [opt.gpu !== "0"];
// --prio idle|below: this process, and so the browser and hog it starts, at idle or below-normal priority.
// The loaded benchmark runs game and hog at the same class (below), so the hog competes as other apps would
// while the machine's normal-priority work still comes first.
if (opt.prio) setPriority(0, { idle: 19, below: 10, normal: 0 }[opt.prio] ?? 0);
const query = (opt.query || "paint=1") + (opt.q2 ? `&${String(opt.q2).replace(/,/g, "&")}` : ""), TOP = +(opt.top || 12);
const EXE = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;

// stage of a profile node, by its script and function
function stageOf(url, fn) {
  if (fn === "(garbage collector)") return "gc";
  if (fn === "(idle)") return "idle";
  if (fn === "(program)" || fn === "(root)") return "browser";
  const u = url || "";
  if (/characters\/render\/raster/.test(u)) return "figure raster";
  if (/characters\/render\/(shade|image)/.test(u)) return "figure shading";
  if (/characters\/(rig|anim|cast)\//.test(u) || /runtime\/actor/.test(u)) return "figure pose and skin";
  if (/characters\/runtime\//.test(u)) return "figure drawer";
  if (/engine\/paint\/glyph\//.test(u)) return "glyph";
  if (/engine\/paint\/(lightlayer|lightfield)/.test(u)) return "lighting";
  if (/engine\/paint\//.test(u)) return "painter";
  if (/ui\/(platecam|worldlayer)/.test(u) || /world\/camera/.test(u)) return "plate";
  if (/ui\/weatherlayer/.test(u)) return "weather";
  if (/ui\/(peoplelayer|figures|fightlayer)/.test(u) || /world\/plateworld/.test(u)) return "people layer";
  if (/ui\//.test(u)) return "ui";
  if (/engine\/(combat|rules|core|world|dialogue|wiring)/.test(u)) return "engine";
  return u ? "other script" : "browser";
}

// the shared GPU lock (tools/gpu-lock.mjs: heartbeat, stale takeover by rename, release on exit)
let gpuLock = null;
const takeLock = async () => { gpuLock = await acquireGpuLock({ job: "low-water perf bench" }); };
const dropLock = () => { if (gpuLock) gpuLock.release(); gpuLock = null; };

// busy share of every logical core over ms, in percent
async function cpuLoad(ms = 3000) {
  const snap = () => cpus().map((c) => c.times), a = snap(); await sleep(ms); const b = snap();
  let busy = 0, all = 0;
  b.forEach((t, i) => { const d = (k) => t[k] - a[i][k]; const tot = d("user") + d("nice") + d("sys") + d("idle") + d("irq"); all += tot; busy += tot - d("idle"); });
  return all ? Math.round((1000 * busy) / all) / 10 : 0;
}
const QUIET = 15, REPS = Math.max(1, +(opt.repeat || 1));

async function browser(gpu, cport) {
  const flags = gpu ? ["--use-angle=d3d11", "--enable-gpu-rasterization", "--ignore-gpu-blocklist", "--enable-webgl"] : ["--disable-gpu", "--disable-gpu-compositing"];
  const proc = spawn(EXE, ["--headless", `--remote-debugging-port=${cport}`, ...flags, "--no-first-run", "--window-size=1920,1080", "about:blank"], { stdio: "ignore", windowsHide: true });
  for (let i = 0; i < 100; i++) { try { await (await fetch(`http://127.0.0.1:${cport}/json/version`)).json(); break; } catch { await sleep(100); } }
  const page = async (w, h) => {
    const t = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: "PUT" })).json(), ws = new WebSocket(t.webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
    let id = 0; const wait = new Map(), logs = [];
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); } else if (d.method === "Runtime.exceptionThrown") logs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); };
    const send = (method, params = {}) => new Promise((ok) => { const k = ++id; wait.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
    await send("Runtime.enable"); await send("Page.enable"); await send("Page.bringToFront"); await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
    return { send, logs, go: (u) => send("Page.navigate", { url: u }), eval: ev, shot: async (path) => { const r = await send("Page.captureScreenshot", { format: "png" }); await writeFile(path, Buffer.from(r.result.data, "base64")); }, close: async () => { ws.close(); try { await fetch(`http://127.0.0.1:${cport}/json/close/${t.id}`); } catch { /* gone */ } } };
  };
  return { page, close: () => proc.kill() };
}

// frame gaps and the drawer's section timers over ms
const MEASURE = (ms, during = null) => `(async () => {
  const shown0 = structuredClone(globalThis.__lwFigShown || {}), tool0 = { ...(globalThis.__lwToolSearch || {}) };
  globalThis.__lwPerf = {}; const pool0 = globalThis.__lwFigPoolStats ? structuredClone(globalThis.__lwFigPoolStats) : null;
  const gaps = []; let last = performance.now(), stop = false;
  const tick = (t) => { gaps.push(t - last); last = t; if (!stop) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  ${during ? `const seq = []; const tick2 = (t) => { seq.push(+t.toFixed(1)); if (!stop) requestAnimationFrame(tick2); }; requestAnimationFrame(tick2); setTimeout(() => { globalThis.__lwDuringAt = performance.now(); (${during})(); }, 500);` : ""}
  await new Promise((r) => setTimeout(r, ${ms}));
  stop = true; const S = globalThis.__lwPerf; globalThis.__lwPerf = null; const frames = gaps.length - 1; gaps.shift(); gaps.sort((a, b) => a - b);
  const sections = {}; for (const [k, e] of Object.entries(S)) sections[k] = { msPerFrame: +(e.ms / frames).toFixed(2), perFrame: +(e.n / frames).toFixed(2) };
  const T1 = globalThis.__lwToolSearch, tn = T1 ? T1.answered - (tool0.answered || 0) : 0;   // the tool worker's answers (runtime/fightdrawer.mjs)
  sections["tool.answers"] = { msPerFrame: tn ? +((T1.ms - (tool0.ms || 0)) / tn).toFixed(2) : 0, perFrame: +(tn / frames).toFixed(2), waitMs: tn ? +((T1.wait - (tool0.wait || 0)) / tn).toFixed(1) : null };
  const P = globalThis.__lwPaintStats || {};
  const trans = ${during ? `(() => { const t0 = globalThis.__lwDuringAt, g = []; for (let i = 1; i < seq.length; i++) if (seq[i] > t0) g.push([+(seq[i - 1] - t0).toFixed(0), +(seq[i] - seq[i - 1]).toFixed(1)]); g.sort((a, b) => b[1] - a[1]); return { worst: g.slice(0, 6), over50: g.filter((x) => x[1] > 50).length, frames: g.length }; })()` : "null"};   // the frames after the view's during(): [ms after it, gap ms], worst first
  return { transition: trans, frameMs: +(gaps.reduce((x, y) => x + y, 0) / gaps.length).toFixed(2), frameP95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1), frameMax: +gaps[gaps.length - 1].toFixed(1), over50: gaps.filter((g) => g > 50).length, frames, sections, shownMs: Object.fromEntries(Object.entries(globalThis.__lwFigShown || {}).map(([k, Q]) => { const Q0 = shown0[k] || { n: 0, ms: 0 }, c = Q.n - Q0.n; return [k, c ? +((Q.ms - Q0.ms) / c).toFixed(1) : null]; })), pool: pool0 ? (() => { const p1 = globalThis.__lwFigPoolStats, n = p1.done - pool0.done; return { jobs: n, jobMs: n ? +((p1.ms - pool0.ms) / n).toFixed(1) : null, latencyMs: n ? +((p1.lat - pool0.lat) / n).toFixed(1) : null, perSecond: +(n / (${ms} / 1000)).toFixed(1), byFig: Object.fromEntries(Object.entries(p1.byFig || {}).map(([k, F]) => { const F0 = (pool0.byFig || {})[k] || { n: 0, lat: 0, render: 0, paint: 0 }, c = F.n - F0.n; return [k, c ? { images: c, latencyMs: +((F.lat - F0.lat) / c).toFixed(1), renderMs: +((F.render - F0.render) / c).toFixed(1), paintMs: +((F.paint - F0.paint) / c).toFixed(1) } : null]; })), workers: p1.workers, cap: p1.cap ?? null, laneLat: p1.laneLat ?? null }; })() : null, painterMsPerFigure: Object.values(P).length ? +(Object.values(P).reduce((a, s) => a + s.ms, 0) / Object.values(P).length).toFixed(2) : null };
})()`;

async function profile(P, ms) {
  await P.send("Profiler.enable"); await P.send("Profiler.setSamplingInterval", { interval: 250 });
  const f0 = await P.eval("(globalThis.__lwBenchFrames ||= (() => { const o = { n: 0 }; const t = () => { o.n++; requestAnimationFrame(t); }; requestAnimationFrame(t); return o; })()).n");
  await P.send("Profiler.start"); await sleep(ms); const r = await P.send("Profiler.stop");
  const f1 = await P.eval("globalThis.__lwBenchFrames.n"), frames = Math.max(1, f1 - f0);
  const prof = r.result.profile, byId = new Map(prof.nodes.map((n) => [n.id, n])), self = new Map();
  for (let i = 0; i < prof.samples.length; i++) self.set(prof.samples[i], (self.get(prof.samples[i]) || 0) + (prof.timeDeltas[i] || 0) / 1000);
  const stages = {}, fns = {};
  for (const [id, t] of self) {
    const cf = byId.get(id).callFrame, st = stageOf(cf.url, cf.functionName), key = `${cf.functionName || "(anon)"} ${(cf.url || "").replace(/^.*?:\d+\//, "")}:${cf.lineNumber + 1}`;
    stages[st] = (stages[st] || 0) + t; fns[key] = (fns[key] || { t: 0, st }); fns[key].t += t;
  }
  const per = (t) => +(t / frames).toFixed(2);
  const busy = Object.entries(stages).reduce((a, [k, t]) => a + (k === 'idle' ? 0 : t), 0);
  return { frames, mainBusy: per(busy), stages: Object.fromEntries(Object.entries(stages).sort((a, b) => b[1] - a[1]).map(([k, t]) => [k, per(t)])), top: Object.entries(fns).sort((a, b) => b[1].t - a[1].t).slice(0, TOP).map(([k, v]) => [k, v.st, per(v.t)]) };
}

const results = {}, t00 = Date.now();
// the GPU lock first, then bench: a bench must not hold heavy jobs off while it waits for the GPU
if (modes.includes(true)) await takeLock();
const benchLock = await acquireBench({ job: `low-water perf bench${opt.hog ? " (loaded)" : ""}` });
const machine = { drain: benchLock.drain, loadBefore: await cpuLoad() };
let hog = null;
if (opt.hog) {
  const n = opt.hog === true ? availableParallelism() - 2 : +opt.hog;
  hog = spawn(process.execPath, [new URL("./cpuhog.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), String(n)], { stdio: "ignore", windowsHide: true });
  machine.hog = { threads: n, of: availableParallelism() }; await sleep(1000);
}
console.log(`bench: machine load before ${machine.loadBefore} %${machine.drain.heavyLeft.length ? `; heavy jobs still running after ${Math.round(machine.drain.waitedMs / 1000)} s: ${machine.drain.heavyLeft.join(", ")}` : ""}${hog ? `; hog on ${machine.hog.threads} of ${machine.hog.of} threads` : ""}`);
try {
for (const gpu of modes) {
  const mode = gpu ? "gpu" : "cpu";
  if (gpu && !gpuLock) await takeLock();
  const B = await browser(gpu, 9700 + Math.floor(Math.random() * 200));
  try {
    for (let rep = 0; rep < REPS; rep++) for (const v of views) {
      if (Date.now() - t00 > 42 * 60000) { console.log("bench: 42 minutes used; stopping"); break; }
      const P = await B.page(1920, 1080);
      try {
        await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&${query}`);
        for (let i = 0; i < 600; i++) { try { if (await P.eval("document.documentElement.dataset.ready === '1' && !!window.__lw")) break; } catch { /* loading */ } await sleep(200); }
        for (const s of v.steps) await P.eval(s);
        await sleep(2500);
        // a view with a during() (a move between places) is profiled over the same window as its frames
        const both = v.during && !opt.noprofile, [m, pd] = await Promise.all([P.eval(MEASURE(v.measureMs || 4000, v.during || null)), both ? profile(P, (v.measureMs || 4000) - 200) : null]);
        if (both) m.profile = pd; else if (!opt.noprofile) m.profile = await profile(P, 3000);
        if (opt.shots) { await mkdir(opt.shots, { recursive: true }); await P.shot(`${opt.shots}/${v.id}-${mode}.png`); }
        if (P.logs.length) m.errors = P.logs.slice(0, 5);
        const R = (results[v.id] ||= {}); if (!rep) R[mode] = m; if (REPS > 1) (R[`${mode}Runs`] ||= []).push(m);
        const sec = Object.entries(m.sections).sort((a, b) => b[1].msPerFrame - a[1].msPerFrame).map(([k, e]) => `${k} ${e.msPerFrame}`).join(", ");
        if (m.transition) console.log(`  transition: ${m.transition.over50} frames over 50 ms of ${m.transition.frames}; worst [ms after, gap]: ${JSON.stringify(m.transition.worst)}`);
        console.log(`${v.id.padEnd(11)} ${mode} frame ${m.frameMs} ms (p95 ${m.frameP95}, max ${m.frameMax}, ${m.over50} over 50 ms); pool ${JSON.stringify(m.pool)}; drawer: ${sec}`); if (m.errors) console.log('  errors:', m.errors.join(' | ').slice(0, 600));
        if (m.profile) console.log(`  main thread busy ${m.profile.mainBusy} ms a frame; figure images ${m.pool ? (m.pool.perSecond / (m.sections.figure ? m.sections.figure.perFrame : 1)).toFixed(1) : '-'} a second each`);
        if (m.profile) console.log(`  stages/frame: ${Object.entries(m.profile.stages).map(([k, t]) => `${k} ${t}`).join(", ")}`);
        if (m.profile) for (const [k, st, t] of m.profile.top) console.log(`    ${String(t).padStart(6)}  ${st.padEnd(20)} ${k}`);
      } catch (e) { (results[v.id] ||= {})[mode] = { error: e.message }; console.error(`bench: ${v.id} ${mode}: ${e.message}`); }
      await P.close();
    }
  } finally { B.close(); }
}
} finally {
  if (hog) { hog.kill(); await sleep(1500); }
  machine.loadAfter = await cpuLoad();
  benchLock.release(); dropLock();
}
machine.quiet = !opt.hog && machine.loadBefore <= QUIET && machine.loadAfter <= QUIET && !machine.drain.heavyLeft.length;
machine.label = opt.hog ? "loaded" : machine.quiet ? "quiet" : `NOT QUIET (load over ${QUIET} % before or after, or heavy jobs running)`;
results._machine = machine;
// spread over the repeats: frame mean and p95, and how long Lamb's image took to show after its pose was sent
for (const [id, R] of Object.entries(results)) for (const mode of ["gpu", "cpu"]) {
  const runs = (R[`${mode}Runs`] || (R[mode] ? [R[mode]] : [])).filter((m) => m.frameMs);
  if (!runs.length) continue;
  const span = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length ? { min: v[0], median: v[Math.floor(v.length / 2)], max: v[v.length - 1] } : null; };
  R[`${mode}Spread`] = { runs: runs.length, frameMs: span(runs.map((m) => m.frameMs)), frameP95: span(runs.map((m) => m.frameP95)), lambShownMs: span(runs.map((m) => m.shownMs && m.shownMs.lamb)) };
  const f = (o) => (o ? `${o.min} / ${o.median} / ${o.max}` : "-");
  console.log(`spread ${id.padEnd(11)} ${mode} x${runs.length} (min / median / max): frame ${f(R[`${mode}Spread`].frameMs)} ms, p95 ${f(R[`${mode}Spread`].frameP95)}, Lamb shown ${f(R[`${mode}Spread`].lambShownMs)} ms [${machine.label.split(" (")[0]}]`);
}
console.log(`bench: machine load before ${machine.loadBefore} %, after ${machine.loadAfter} %: ${machine.label}`);
if (opt.out) { await writeFile(opt.out, JSON.stringify(results, null, 1)); console.log(`bench: wrote ${opt.out}`); }
