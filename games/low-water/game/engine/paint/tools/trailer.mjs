// The fidelity bar's camera path (coordinator, 2026-10-21: a 60 s trailer-grade path through three places, in both
// modes). Three segments of 20 s: Lamb carried along a smooth path through each place (positions eased frame by frame,
// so the game's own follow camera frames it), the camera held and advanced by exactly 1/30 s a frame, one still a
// frame, then encoded to H.264. Each segment of each mode is its own heavy-cpu job; finished segments are kept, so a
// rerun only makes what is missing.
//   node game/engine/paint/tools/trailer.mjs --port 8760 --out game/capture/paint/trailer [--modes paint,glyph] [--fps 30] [--seconds 20]
import { mkdirSync, existsSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), out = opt.out || "game/capture/paint/trailer", fps = +(opt.fps || 30), secs = +(opt.seconds || 20);
const modes = (opt.modes || "paint,glyph").split(","), exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
// the three places: Lamb's path (world x, z) and who stands about
export const SEGMENTS = [
  { id: "quay", place: "quay", path: [[-6, -1.6], [-2, -2.2], [1.5, -1.8], [4.5, -2.4], [8, -2.0]], figs: [["fewell", 0.6, -1.4], ["strand", 1.4, -2.6], ["hobb", 5.4, -1.6]], hour: 23 * 60 },
  { id: "brine", place: "brine", path: [[3.5, 1.2], [1.6, 0.2], [0.2, -1.0], [-1.6, -0.6], [-3.0, -1.2]], figs: [["sabine", -1.0, -1.9], ["merrow", -2.6, -0.4]], hour: 22 * 60 + 40 },
  { id: "ferry", place: "ferry", plate: "ferry", zoom: 2.2, path: [[1.6, -1.6], [1.2, 0.0], [0.6, 1.4], [0.0, 2.4], [-0.6, 3.2]], figs: [["penhallow", 0.4, 2.6]], hour: 22 * 60 + 25 },
];
const spline = (P, t) => { const n = P.length - 1, u = Math.min(n - 1e-6, Math.max(0, t * n)), i = Math.floor(u), f = u - i, p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)], c = (a, b, cc, d) => 0.5 * (2 * b + (-a + cc) * f + (2 * a - 5 * b + 4 * cc - d) * f * f + (-a + 3 * b - 3 * cc + d) * f * f * f); return [c(p0[0], p1[0], p2[0], p3[0]), c(p0[1], p1[1], p2[1], p3[1])]; };
async function segment(seg, mode) {
  const dir = join(out, `${seg.id}-${mode}`), mp4 = join(out, `${seg.id}-${mode}.mp4`); if (existsSync(mp4)) { console.log(`trailer: ${seg.id} ${mode} done before`); return; }
  mkdirSync(dir, { recursive: true });
  const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), P = await B.page(1920, 1080);
  try {
    await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0${mode === "glyph" ? "&look=glyph" : ""}`);
    await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    const start = spline(seg.path, 0);
    await P.eval(`(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace(${JSON.stringify(seg.place)});
      for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures || []) f.wander = 0;
      const a = c.G.world.area ? null : null; c.G.state.pos = [${start[0]}, 0, ${start[1]}]; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
      for (let i = 0; i < 300 && !(p.cam.ready()); i++) await new Promise((q) => setTimeout(q, 100));
      const A = c.G.world.area(); if (A) for (const [id, x, z] of ${JSON.stringify(seg.figs)}) { const f = (A.figures || []).find((q) => q.id === id); if (f) { f.at = [x, 0, z]; f.cond = null; } else (A.figures ||= []).push({ id, at: [x, 0, z], face: 1, wander: 0, cond: null }); }
      for (const el of document.querySelectorAll('.screen.play .here, .hud, .topbar, aside.talk, #toasts, .placecard, .chip, .glyphhint')) el.style.visibility = 'hidden';
      c.G.state.camera = { ...(c.G.state.camera || {}), mode: ${seg.zoom || 2.6} };   // the trailer's closeness (world/camera.mjs cameraScale)
      await new Promise((q) => setTimeout(q, 2500)); p.cam.hold(true); return true; })()`);
    const N = Math.round(fps * secs);
    for (let k = 0; k < N; k++) {
      const [x, z] = spline(seg.path, k / (N - 1));
      await P.eval(`(async () => { const c = window.__lw; c.G.state.pos = [${x.toFixed(4)}, c.G.state.pos[1], ${z.toFixed(4)}]; c.play.cam.advance(${1 / fps}); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return 1; })()`);
      await P.shot(join(dir, `f${String(k).padStart(4, "0")}.png`));
    }
  } finally { await P.close(); await B.close(); }
  const r = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", mp4], { stdio: "inherit" });
  if (r.status === 0) rmSync(dir, { recursive: true, force: true }); console.log(`trailer: ${seg.id} ${mode} ${r.status === 0 ? "encoded" : "encode failed"}`);
}
mkdirSync(out, { recursive: true });
const one = opt.segment;   // --segment quay:paint runs one piece (the queue below runs each under the heavy-cpu lock)
if (one) { const [id, mode] = one.split(":"); await segment(SEGMENTS.find((s) => s.id === id), mode); }
else {
  for (const mode of modes) for (const s of SEGMENTS) {
    if (existsSync(join(out, `${s.id}-${mode}.mp4`))) continue;
    spawnSync(process.execPath, ["tools/gpu-lock.mjs", "run", "--lock", "heavy-cpu", `trailer ${s.id} ${mode}`, "--", process.execPath, "game/engine/paint/tools/trailer.mjs", "--port", String(port), "--out", out, "--fps", String(fps), "--seconds", String(secs), "--segment", `${s.id}:${mode}`], { stdio: "inherit" });
  }
  // the 60 s cut per mode: the three segments joined
  for (const mode of modes) {
    const parts = SEGMENTS.map((s) => join(out, `${s.id}-${mode}.mp4`)); if (!parts.every(existsSync)) continue;
    const list = join(out, `list-${mode}.txt`); writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, "/")}'`).join("\n"));
    spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", join(out, `trailer-${mode}.mp4`)], { stdio: "inherit" });
    console.log(`trailer: ${mode} cut written`);
  }
}
