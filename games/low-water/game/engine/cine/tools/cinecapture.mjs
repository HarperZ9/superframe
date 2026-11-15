// The opening film in the real page, headless, the GPU off (SwiftShader WebGL2), played through the real boot
// (play.html?boot=1) on a manual clock: each frame is drawn at its own film time, so a slow frame never drops one.
// Writes stills at the named times, frames for a recording (encoded to H.264 with imageio's ffmpeg), the flash
// rule F5 over every frame at --fps (cine/flash.mjs), and summary.json with the boot steps seen and the page's errors.
//   node game/engine/cine/tools/cinecapture.mjs --port 8761 [--out game/capture/cinematic-2026-10-22] [--fps 30]
//     [--from 0 --to 100] [--still 2,12,26,44,57,70,84,90,96] [--rec 46:62] [--recfps 15] [--calm] [--gpu]
// Run long captures under the machine lock: node tools/gpu-lock.mjs run --lock heavy-cpu film -- node ...
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { judgeFlash } from "../flash.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8761), out = opt.out || "game/capture/cinematic-2026-10-22", fps = +(opt.fps || 30), from = +(opt.from || 0), to = +(opt.to || 100);
const stills = String(opt.still || "2,12,26,41,44,57,61,70,84,90,96").split(",").map(Number);
const [r0, r1] = String(opt.rec || "46:62").split(":").map(Number), recfps = +(opt.recfps || 15);
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const FFMPEG = opt.ffmpeg || `${process.env.LOCALAPPDATA}/Programs/Python/Python312/Lib/site-packages/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe`;
// in the page: the film canvas's 7 x 7 windows (cine/flash.mjs windowsOf, run where the pixels are)
const PROBE = `(async () => { const { windowsOf } = await import('/engine/cine/windows.mjs'); const c = window.__lwBoot.film.canvas, g = c.getContext('2d'); return windowsOf(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height, 3); })()`;

await mkdir(join(out, "rec"), { recursive: true });
const B = await launch({ exe, port: 9500 + Math.floor(Math.random() * 300), args: opt.gpu ? ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader"] });
const summary = { fps, from, to, frames: 0, stills: [], rec: null, steps: [], errors: [], msPerFrame: 0, calm: !!opt.calm };
try {
  const P = await B.page(1920, 1080);
  await P.go(`http://127.0.0.1:${port}/engine/play.html?content=quota&boot=1&filmclock=manual&tips=0${opt.calm ? "&calm=1" : ""}`);
  // the boot as it runs: each step seen, until the film is drawn
  let last = "";
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const s = await P.eval("window.__lwBoot ? window.__lwBoot.step + (window.__lwBoot.film ? '+film' : '') : ''").catch(() => "");
    if (s && s !== last) { summary.steps.push({ step: s, at: +((Date.now() - t0) / 1000).toFixed(1) }); last = s; if (s.startsWith("studio") || s.startsWith("notice")) await P.shot(join(out, `boot-${s}.png`)); }
    if (s.endsWith("+film")) break;
    await sleep(200);
  }
  if (!last.endsWith("+film")) throw new Error(`the film never started (last step ${last}); page: ${P.logs.join(" | ")}`);
  await sleep(4000);   // the character drawers load their bodies after the first draw
  const frames = [], n = Math.round((to - from) * fps), tStart = Date.now(); let recN = 0;
  const want = new Set(stills.map((s) => Math.round((s - from) * fps)));
  for (let k = 0; k <= n; k++) {
    const t = from + k / fps;
    await P.eval(`window.__lwBoot.film.seek(${t.toFixed(4)})`);
    frames.push(await P.eval(PROBE));
    if (want.has(k)) { const name = `still-${t.toFixed(1).padStart(5, "0")}s.png`; await P.shot(join(out, name)); summary.stills.push(name); }
    // the recording's frames numbered from 0 with no gap (ffmpeg's image sequence stops at the first missing number)
    if (t >= r0 - 1e-6 && t <= r1 && Math.floor((t - r0) * recfps + 1e-6) >= recN) await P.shot(join(out, "rec", `f${String(recN++).padStart(5, "0")}.png`));
    if (k % 150 === 0) console.log(`film ${t.toFixed(1)} s, ${((Date.now() - tStart) / Math.max(1, k + 1)).toFixed(0)} ms a frame`);
  }
  summary.frames = frames.length; summary.msPerFrame = Math.round((Date.now() - tStart) / frames.length);
  Object.assign(summary, judgeFlash(frames, fps));
  summary.errors = P.logs.filter((l) => /error|exception/i.test(l)).slice(0, 20);
  summary.lens = await P.eval("window.__lwBoot.film.lens.stats");
  await P.close();
} finally { await B.close(); }
const mp4 = join(out, `opening-${r0}-${r1}s.mp4`);
if (r1 >= from && r0 <= to) {
  const enc = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(recfps), "-i", join(out, "rec", "f%05d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", mp4], { encoding: "utf8" });
  summary.rec = enc.status === 0 ? mp4 : `ffmpeg failed: ${enc.stderr}`;
  if (enc.status === 0) await rm(join(out, "rec"), { recursive: true, force: true });
} else { summary.rec = "none asked in this range"; await rm(join(out, "rec"), { recursive: true, force: true }); }
await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 1));
console.log(`${summary.frames} frames, ${summary.msPerFrame} ms each; F5 ${summary.flashesPerSecond} flashes/s, red ${summary.redTransitions}${summary.errs.length ? `\nERROR ${summary.errs.join("\nERROR ")}` : ""}\nstills ${summary.stills.length}; recording ${summary.rec}\npage errors: ${summary.errors.length}`);
if (summary.errs.length) process.exit(1);
