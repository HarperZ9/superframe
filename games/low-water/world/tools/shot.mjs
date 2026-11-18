// Stills and frame times from the island traversal, in a headless browser.
//   node games/low-water/world/tools/shot.mjs --out DIR [--views name,name | all] [--gpu 0|1]
//        [--size 1600x900] [--perf seconds] [--quality 1] [--world out/20261118] [--port 8741]
// --gpu 0 (the default) draws on the CPU with SwiftShader, so it runs beside other GPU work;
// --gpu 1 uses the machine's adapter. It starts the game's own server (game/serve.mjs) and stops
// it at the end. Frame times are gaps between animation frames over --perf seconds per view, and
// the record says which adapter drew them and how busy the machine was.
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { cpus, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { viewsFor } from "./views.mjs";

const here = dirname(fileURLToPath(import.meta.url)), lw = join(here, "..", "..");
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8741), cport = port + 1, gpu = opt.gpu === "1", [w, h] = (opt.size || "1600x900").split("x").map(Number), out = opt.out || "world-stills";
const worldDir = opt.world || "out/20261118", sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The CPU adapter runs in the headless shell. The machine's own adapter needs the full browser
// (the shell ships without the D3D shader compiler), in its new headless mode.
async function chromePath() {
  if (opt.chrome) return opt.chrome;
  const root = `${process.env.LOCALAPPDATA}/ms-playwright`, all = await readdir(root);
  if (gpu) return `${root}/${all.filter((d) => /^chromium-\d+$/.test(d)).sort().at(-1)}/chrome-win64/chrome.exe`;
  return `${root}/${all.filter((d) => d.startsWith("chromium_headless_shell-")).sort().at(-1)}/chrome-headless-shell-win64/chrome-headless-shell.exe`;
}
async function cpuLoad(ms = 1500) {
  const snap = () => cpus().map((c) => c.times), a = snap(); await sleep(ms); const b = snap();
  let busy = 0, all = 0;
  b.forEach((t, i) => { const d = (k) => t[k] - a[i][k], tot = d("user") + d("nice") + d("sys") + d("idle") + d("irq"); all += tot; busy += tot - d("idle"); });
  return all ? Math.round((1000 * busy) / all) / 10 : 0;
}
function gpuLoad() {
  try { return execFileSync("nvidia-smi", ["--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"], { encoding: "utf8" }).trim() + " %"; } catch { return "unknown"; }
}

const server = spawn(process.execPath, [join(lw, "game", "serve.mjs"), "--port", String(port)], { stdio: "ignore", windowsHide: true });
// the CPU adapter, with the rest of Chrome kept off the GPU too (native/scripts/motion_render.py)
const flags = gpu
  ? ["--enable-unsafe-webgpu", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-features=Vulkan"]
  : ["--enable-unsafe-webgpu", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-webgpu-adapter=swiftshader", "--disable-gpu-compositing", "--disable-accelerated-2d-canvas", "--disable-gpu-rasterization"];
const chrome = spawn(await chromePath(), [gpu ? "--headless=new" : "--headless", ...(gpu ? [`--user-data-dir=${join(tmpdir(), "lw-world-shot")}`] : []), `--remote-debugging-port=${cport}`, ...flags, "--no-first-run", `--window-size=${w},${h}`, "about:blank"], { stdio: "ignore", windowsHide: true });
const stop = () => { try { chrome.kill(); } catch { /* gone */ } try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);

try {
  for (let i = 0; i < 100; i++) { try { await (await fetch(`http://127.0.0.1:${cport}/json/version`)).json(); break; } catch { await sleep(100); } }
  const t = await (await fetch(`http://127.0.0.1:${cport}/json/new?about:blank`, { method: "PUT" })).json(), ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  let id = 0; const wait = new Map(), logs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
    else if (d.method === "Runtime.exceptionThrown") logs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    else if (d.method === "Runtime.consoleAPICalled" && (d.params.type === "error" || d.params.type === "warning")) logs.push(d.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  const send = (method, params = {}) => new Promise((ok) => { const k = ++id; wait.set(k, ok); ws.send(JSON.stringify({ id: k, method, params })); });
  const ev = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await mkdir(out, { recursive: true });
  const worldJson = JSON.parse(await readFile(join(lw, "world", worldDir, "world.json"), "utf8"));
  // lets a view ask the cover raster where a cover stands thickest near a place
  const { parsePgm } = await import("../pgm.mjs");
  const bio = parsePgm(await readFile(join(lw, "world", worldDir, "biome.pgm"))).data, BW = worldJson.width, BH = worldJson.height;
  const probe = { densest(cover, near) {
    let best = -1, at = null;
    for (let y = 16; y < BH - 16; y += 8) for (let x = 16; x < BW - 16; x += 8) {
      let n = 0; for (let j = -12; j <= 12; j += 4) for (let i = -12; i <= 12; i += 4) if (bio[(y + j) * BW + x + i] === cover) n++;
      const d = Math.hypot(x - (near.x ?? near.cx), y - (near.y ?? near.cy)), score = n - d / 60;
      if (score > best) { best = score; at = { x: x * 0.064, z: y * 0.064 }; }
    }
    return at;
  } };
  const all = viewsFor(worldJson, probe), pick = opt.at || ((opt.play || opt.check) && !opt.views) ? [] : !opt.views || opt.views === "all" ? all : opt.views.split(",").map((n) => all.find((v) => v.name === n) || (() => { throw new Error(`no view ${n}; have ${all.map((v) => v.name).join(", ")}`); })());
  // --at "name:x,z,alt,yaw,pitch,clock,day;name:..." (km, m, degrees, hours) draws views of your own
  if (opt.at) for (const [i, part] of opt.at.split(";").entries()) { const named = part.includes(":"), [x, z, alt, yaw, pitch, clock, day, fov] = (named ? part.split(":")[1] : part).split(",").map(Number); pick.push({ name: named ? part.split(":")[0] : opt.name || `at${i}`, fly: alt > 2.5, x, z, alt, yaw, pitch, clock, day: day ?? 3, fov: fov || 60 }); }
  await send("Page.navigate", { url: `http://127.0.0.1:${port}/world/walk/index.html?still=1&world=${worldDir}&quality=${opt.quality || 1}${opt.hud ? "" : "&nohud=1"}${opt.query ? "&" + opt.query : ""}` });
  let ready = false, said = "";
  for (let i = 0; i < 1200 && !ready; i++) {
    await sleep(250);
    const s = await ev("globalThis.__lwWorldError ? 'error: ' + globalThis.__lwWorldError : (globalThis.__lwWorld ? 'ready' : document.getElementById('note')?.textContent || '')");
    if (s.startsWith("error")) throw new Error(s);
    if (opt.verbose && s !== said) { said = s; console.log(`  page: ${s}`); }
    ready = s === "ready";
  }
  if (!ready) throw new Error(`the page did not start; ${logs.join(" | ")}`);
  if (!opt.hud) await ev("document.getElementById('hud').hidden = true");
  // --probe EXPR prints what a JavaScript expression gives in the page (for finding a place to stand)
  if (opt.probe) console.log(JSON.stringify(await ev(opt.probe)));
  const record = { adapter: null, gpu, size: [w, h], quality: +(opt.quality || 1), cpuBefore: await cpuLoad(), gpuBefore: gpuLoad(), views: [] };
  for (const v of pick) {
    await ev(`globalThis.__lwWorld.view(${JSON.stringify({ ...v, hold: true })})`);
    let st = await ev("globalThis.__lwWorld.settle(4)");
    if (opt.perf) { await ev("globalThis.__lwWorld.clearGaps()"); await sleep(+opt.perf * 1000); st = await ev("globalThis.__lwWorld.stats()"); }
    // --bench N: the time the GPU takes to finish N frames drawn back to back, with no wait for the display
    let bench = null;
    if (opt.bench) { bench = { ms: await ev(`globalThis.__lwWorld.bench(${+opt.bench || 120})`), gpuLoad: gpuLoad() }; await ev("globalThis.__lwWorld.settle(3)"); console.log(`  ${v.name}: ${bench.ms} ms a frame over ${+opt.bench || 120} frames, the GPU at ${bench.gpuLoad} before the run ended`); }
    // the page hands over its own canvas: a screenshot of a page drawn on the CPU adapter can come back blank
    const png = opt.hud ? (await send("Page.captureScreenshot", { format: "png" })).result.data : (await ev("globalThis.__lwWorld.grab()")).split(",")[1];
    await writeFile(join(out, `${v.name}.png`), Buffer.from(png, "base64"));
    if (opt.after) console.log(v.name, JSON.stringify(await ev(opt.after)));
    record.adapter = st.adapter;
    record.views.push({ bench, name: v.name, region: st.region, air: st.air, part: st.part, nodes: st.nodes, triangles: st.triangles, trees: st.trees, frameMs: opt.perf ? st.frameMs : null, p95: opt.perf ? st.p95 : null });
    console.log(`${v.name}: region ${st.region}, ${st.air}, ${st.part}; ${st.nodes} nodes, ${st.triangles} triangles${opt.perf ? `; ${st.frameMs} ms a frame (p95 ${st.p95})` : ""}`);
  }
  // --walk "name:x0,z0,x1,z1,clock,day,seconds,speed[,road]": a walk at a steady 30 frames a second, written as
  // <name>.webm. From (x0, z0) toward (x1, z1) in km, or along the nearest road when the last word is "road".
  if (opt.walk) for (const part of opt.walk.split(";")) {
    const [name, rest] = part.split(":"), f = rest.split(","), [x0, z0, x1, z1, clock, day, seconds, speed] = f.map(Number), onRoad = f[8] === "road";
    await ev(`(() => { const W = globalThis.__lwWorld, a = [${x0 * 1000}, ${z0 * 1000}], b = [${x1 * 1000}, ${z1 * 1000}], len = ${seconds * speed + 40};
      let pts = ${onRoad} ? W.roads.walkFrom(a[0], a[1], len) : null;
      if (pts && Math.hypot(pts[pts.length - 1][0] - b[0], pts[pts.length - 1][1] - b[1]) > Math.hypot(pts[0][0] - b[0], pts[0][1] - b[1]) + len * 0.5) pts = null;
      if (!pts) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]); pts = []; for (let s = 0; s <= len; s += 3) pts.push([a[0] + (b[0] - a[0]) * s / d, a[1] + (b[1] - a[1]) * s / d]); }
      W.view({ x: pts[0][0] / 1000, z: pts[0][1] / 1000, alt: 1.7, fly: false, pitch: 2, clock: ${clock}, day: ${day}, hold: false }); W.time.rate = 1; W.walk(pts, ${speed}); })()`);
    await ev("globalThis.__lwWorld.settle(6)"); await ev("globalThis.__lwWorld.hold(true)");
    const ffRoot = `${process.env.LOCALAPPDATA}/ms-playwright`, ff = opt.ffmpeg || `${ffRoot}/${(await readdir(ffRoot)).filter((d) => d.startsWith("ffmpeg-")).sort().at(-1)}/ffmpeg-win64.exe`;
    const enc = spawn(ff, ["-loglevel", "error", "-f", "image2pipe", "-avioflags", "direct", "-fpsprobesize", "0", "-probesize", "32", "-analyzeduration", "0", "-c:v", "mjpeg", "-i", "pipe:0", "-y", "-an", "-r", "30", "-c:v", "libvpx-vp9", "-crf", "42", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", join(out, `${name}.webm`)], { stdio: ["pipe", "ignore", "inherit"], windowsHide: true });
    const frames = Math.round(seconds * 30), t0 = performance.now(); let dead = false; enc.setMaxListeners(0); enc.on("close", () => { dead = true; }); enc.stdin.on("error", () => { dead = true; });
    for (let i = 0; i < frames && !dead; i++) { const url = await ev("globalThis.__lwWorld.step(1 / 30, 'image/jpeg', 0.93)"); if (!enc.stdin.write(Buffer.from(url.split(",")[1], "base64"))) await Promise.race([new Promise((r) => enc.stdin.once("drain", r)), new Promise((r) => enc.once("close", r))]); }
    enc.stdin.end(); if (!dead) await new Promise((r) => enc.on("close", r));
    if (!existsSync(join(out, `${name}.webm`))) throw new Error(`walk: the encoder stopped before ${name}.webm was written`);
    await ev("globalThis.__lwWorld.hold(false)");
    console.log(`${name}.webm: ${frames} frames of a ${seconds} s walk at ${speed} m/s, captured in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  }
  // --check "viewpoint[,seconds];...": the follow camera on a scripted walk from each viewpoint, every eye tested
  // against the drawn triangles (walk/checks.mjs); then the same walk with collision off, and with a wall planted
  // behind the walker halfway, on and off. The off runs must show frames in geometry, or the check proves nothing.
  if (opt.check) {
    await ev("globalThis.__lwWorld.settle(2)");
    await ev("import('/world/walk/checks.mjs').then((m) => { globalThis.__lwCheck = m; })");
    record.checks = [];
    for (const part of opt.check.split(";")) {
      const [vp, secs] = part.split(","), seconds = +secs || 40;
      for (const o of [{ collide: true }, { collide: false }, { collide: true, plant: true }, { collide: false, plant: true }]) {
        const r = await ev(`globalThis.__lwCheck.checkWalk(globalThis.__lwWorld, ${JSON.stringify({ viewpoint: vp, seconds, ...o })})`);
        record.checks.push(r);
        console.log(`check ${vp}${o.plant ? " with a planted wall" : ""}, collision ${o.collide ? "on" : "off"}: ${r.bad} of ${r.frames} frames in geometry (${r.clipped} clipped, ${r.enclosed} enclosed, ${r.under} under the ground); ${r.triangles} triangles; nearest ${r.nearest} m; shortest arm ${r.armMin} m`);
      }
    }
  }
  // --play "name=viewpoint,camera[,seconds[,run]];...": the walker stands at a named viewpoint (play/viewpoints.mjs)
  // with a camera (follow, first, iso, nav) and is held a moment so its springs settle; a still is written as
  // <name>.png, and with seconds also a walk at a steady 30 frames a second as <name>.webm, along the road when
  // one is near and straight ahead when not. --bench N measures each.
  if (opt.play) for (const part of opt.play.split(";")) {
    const [name, rest] = part.split("="), [vp, mode, secs, run] = rest.split(","), seconds = +secs || 0;
    await ev("globalThis.__lwWorld.settle(2)");
    const v = await ev(`(() => { const W = globalThis.__lwWorld, v = W.play.stand(${JSON.stringify(vp)}, ${JSON.stringify(mode)}); W.time.hold = true; return v; })()`);
    await ev("globalThis.__lwWorld.hold(true)");
    for (let i = 0; i < 45; i++) await ev("globalThis.__lwWorld.step(1 / 30, 'image/jpeg', 0.5).then(() => 0)");
    let bench = null;
    if (opt.bench) { await ev("globalThis.__lwWorld.hold(false)"); bench = { ms: await ev(`globalThis.__lwWorld.bench(${+opt.bench || 120})`), gpuLoad: gpuLoad() }; await ev("globalThis.__lwWorld.hold(true)"); }
    const png = (await ev("globalThis.__lwWorld.step(1 / 30, 'image/png')")).split(",")[1];
    await writeFile(join(out, `${name}.png`), Buffer.from(png, "base64"));
    const st = await ev("globalThis.__lwWorld.stats()");
    console.log(`${name}: ${v.says} (${(v.x / 1000).toFixed(2)} km E, ${(v.z / 1000).toFixed(2)} km S), camera ${mode}; region ${st.region}${bench ? `; ${bench.ms} ms a frame, the GPU at ${bench.gpuLoad}` : ""}`);
    record.views.push({ name, viewpoint: vp, mode, at: [v.x, v.z], bench, region: st.region });
    if (seconds) {
      await ev(`(() => { const W = globalThis.__lwWorld, v = ${JSON.stringify(v)}, len = ${seconds} * ${run ? 5 : 1.6} + 20;
        let pts = W.roads.walkFrom(v.x, v.z, len); const near = pts && Math.hypot(pts[0][0] - v.x, pts[0][1] - v.z) < 8;
        if (!near) { pts = []; for (let s = 0; s <= len; s += 3) pts.push([v.x + Math.sin(v.yaw) * s, v.z - Math.cos(v.yaw) * s]); }
        else { const a = pts[0], b = pts[Math.min(4, pts.length - 1)]; if ((b[0] - a[0]) * Math.sin(v.yaw) - (b[1] - a[1]) * Math.cos(v.yaw) < 0) pts = W.roads.walkFrom(v.x, v.z, len).reverse(); }
        W.time.hold = false; W.time.rate = 1; W.play.walk(pts, { run: ${run ? "true" : "false"} }); })()`);
      const ffRoot = `${process.env.LOCALAPPDATA}/ms-playwright`, ff = opt.ffmpeg || `${ffRoot}/${(await readdir(ffRoot)).filter((d) => d.startsWith("ffmpeg-")).sort().at(-1)}/ffmpeg-win64.exe`;
      const enc = spawn(ff, ["-loglevel", "error", "-f", "image2pipe", "-c:v", "mjpeg", "-i", "pipe:0", "-y", "-an", "-r", "30", "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", join(out, `${name}.webm`)], { stdio: ["pipe", "ignore", "inherit"], windowsHide: true });
      const frames = Math.round(seconds * 30); let dead = false; enc.on("close", () => { dead = true; }); enc.stdin.on("error", () => { dead = true; });
      for (let i = 0; i < frames && !dead; i++) { const url = await ev("globalThis.__lwWorld.step(1 / 30, 'image/jpeg', 0.9)"); if (!enc.stdin.write(Buffer.from(url.split(",")[1], "base64"))) await new Promise((r) => enc.stdin.once("drain", r)); }
      enc.stdin.end(); if (!dead) await new Promise((r) => enc.on("close", r));
      await ev("globalThis.__lwWorld.play.stop()");
      console.log(`${name}.webm: ${frames} frames, ${seconds} s`);
    }
    await ev("globalThis.__lwWorld.hold(false)");
  }
  record.cpuAfter = await cpuLoad(); record.gpuAfter = gpuLoad(); record.log = logs.slice(0, 20);
  await writeFile(join(out, "record.json"), JSON.stringify(record, null, 1));
  if (logs.length) console.log(`page log: ${logs.slice(0, 5).join(" | ")}`);
  ws.close();
} finally { stop(); }
