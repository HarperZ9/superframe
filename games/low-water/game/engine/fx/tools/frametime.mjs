// Frame time on a Quota plate with the light model and effects off and on, until perf's bench has a Quota view: the plate
// entered through the PLATE helper with a few figures, then the mean and 95th percentile ms between animation frames
// over 4 s, and the effects' own ms a frame. Headless, GPU off; machine load sampled before and after, labelled.
//   node game/engine/fx/tools/frametime.mjs --port 8780 --plate q_square_wide [--repeat 2]
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { PLATE } from "../../paint/tools/views.mjs";
import { cpus } from "node:os";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const load = async () => { const a = cpus().map((c) => c.times); await sleep(2000); const b = cpus().map((c) => c.times); let busy = 0, tot = 0; b.forEach((t, i) => { const d = (k) => t[k] - a[i][k]; const all = d("user") + d("nice") + d("sys") + d("idle") + d("irq"); tot += all; busy += all - d("idle"); }); return +((100 * busy) / tot).toFixed(1); };
const plate = opt.plate || "q_square_wide", figs = [["ned", 1, 0, 1], ["will", -1, 0, 1.5], ["mary", 2, 0, 3]], spawn = plate === "q_granary" ? [0.4, 0, 2] : [8.5, 0, 9.5];
const B = await launch({ exe, port: 9820 + Math.floor(Math.random() * 50) }), out = [];
for (let rep = 0; rep < +(opt.repeat || 1); rep++) for (const arm of ["lightmodel=0&fx=off", "fx=off", "fx=low", "fx=high"]) {
  const before = await load(), P = await B.page(1920, 1080);
  try {
    await P.go(`http://127.0.0.1:${opt.port || 8780}/engine/play.html?capture=1&tips=0&${arm}`);
    await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    await P.eval(PLATE(plate, plate, spawn, figs.map(([w, x, y, z]) => [w, spawn[0] + x, y, spawn[2] + z])));
    for (let i = 0; i < 40; i++) { if (/fx=off/.test(arm) || await P.eval("!!(window.__lwFx && __lwFx.stats.frames > 20)")) break; await sleep(500); }
    await sleep(1500);
    const r = JSON.parse(await P.eval(`(async () => { const t = []; let last = performance.now(); const end = last + 4000; await new Promise((res) => { const f = () => { const n = performance.now(); t.push(n - last); last = n; if (n < end) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); }); t.sort((a, b) => a - b); const fx = window.__lwFx ? window.__lwFx.stats : null; return JSON.stringify({ mean: +(t.reduce((a, b) => a + b, 0) / t.length).toFixed(1), p95: +t[Math.floor(t.length * 0.95)].toFixed(1), fxMs: fx && fx.ms, prims: fx && fx.prims }); })()`));
    out.push({ plate, arm, ...r, loadBefore: before, loadAfter: await load() }); console.log(JSON.stringify(out[out.length - 1]));
  } finally { await P.close(); }
}
await B.close();
