// Marks what the visual check counts, per view: red = figure drawn over nearer painting, yellow = stacked shadow,
// cyan = shadow off the floor, green = other shadow pixels. node markup.mjs <port> <out> [views]
import { readFile, writeFile, mkdir } from "node:fs/promises";
const T = "file:///C:/dev/mission-control/2026-10-16-low-water/game/engine/tools/visualcheck/";
const { launch, sleep } = await import(T + "cdp.mjs"), { VIEWS } = await import(T + "views.mjs");
const [port, out, only] = process.argv.slice(2), analyse = await readFile(new URL("./analyse_marks.js", import.meta.url), "utf8");
await mkdir(out, { recursive: true });
const B = await launch({ exe: `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`, port: 9900 + Math.floor(Math.random() * 90) });
try {
  for (const v of VIEWS.filter((v) => !only || only.split(",").includes(v.id))) {
    const P = await B.page(1280, 720);
    await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1`); await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    for (const s of v.steps) await P.eval(s); await sleep(2500);
    const m = await P.eval(`(${analyse})({})`); if (process.env.PROBE) m.probe = await P.eval(process.env.PROBE); await P.shot(`${out}/${v.id}.png`);
    await writeFile(`${out}/${v.id}.json`, JSON.stringify(m)); console.log(v.id, (m.fails || []).join(" | ")); P.close();
  }
} finally { await B.close(); }
