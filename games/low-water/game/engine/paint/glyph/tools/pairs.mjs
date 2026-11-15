// Painted and glyph stills of one scene at one framing: the scene is set up once, a painted still is
// taken, the style is switched in place (globalThis.__lwLook, as F7 does), and a glyph still is taken from
// the same camera. The game state is read before and after the switch; any difference is printed.
//   node game/engine/paint/glyph/tools/pairs.mjs --port 8790 --out game/capture/glyph/pairs [--only id,id] [--w 1920 --h 1080] [--query ...]
// Start the worktree server first (glyph/tools/serve.mjs). Original code.
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { launch, sleep } from "../../../tools/visualcheck/cdp.mjs";
import { SCENES } from "./scenes.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8790), out = opt.out || "game/capture/glyph/pairs", W = +(opt.w || 1920), H = +(opt.h || 1080);
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const ids = opt.only ? opt.only.split(",") : Object.keys(SCENES);
// the state a style switch must not touch: the game state, the open beat, the area, the fight's clock
export const SNAP = `(() => { const c = window.__lw, p = c.play, F = c.G.ext && c.G.ext.combat && c.G.ext.combat.current; return JSON.stringify({ state: c.G.state, clock: c.G.clock(), beat: p.P.beat ? [p.P.beat.id, p.P.beat.text, (p.P.beat.options || []).map((o) => o.label)] : null, area: c.G.world.area() && c.G.world.area().id, fight: F && F.W ? { t: F.W.t, result: F.W.result || null } : null }); })()`;
export const LOOK = (m) => `(async () => { globalThis.__lwLook = '${m}'; const p = window.__lw.play; await p.renderersReady; for (let i = 0; i < 100 && !(p.renderers && p.renderers.mode() === '${m === "glyph" ? "glyph" : "oilInk"}'); i++) await new Promise((q) => setTimeout(q, 50)); await new Promise((q) => setTimeout(q, 1800)); return p.renderers.mode(); })()`;
export function diffKeys(a, b, path = "") {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return [path || "(root)"];
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) => diffKeys(a[k], b[k], path ? `${path}.${k}` : k));
}

if (process.argv[1] && process.argv[1].endsWith("pairs.mjs")) {
  await mkdir(out, { recursive: true });
  const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), report = [];
  try {
    for (const id of ids) {
      const S = SCENES[id], P = await B.page(W, H), r = { id, why: S.why };
      try {
        await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0&smoke=0&blot=0&content=quota${opt.query ? "&" + opt.query : ""}`);
        await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
        r.steps = []; for (const s of S.steps) r.steps.push(await P.eval(s));
        await sleep(2500);
        const a = JSON.parse(await P.eval(SNAP)); await P.shot(join(out, `${id}-painted.png`));
        r.mode1 = await P.eval(LOOK("glyph")); await P.shot(join(out, `${id}-glyph.png`));
        const b = JSON.parse(await P.eval(SNAP)); r.stateDiff = diffKeys(a, b);
        r.stats = await P.eval("JSON.stringify(globalThis.__lwGlyphStats || null)");
      } catch (e) { r.error = e.message; }
      r.logs = P.logs.slice(0, 12); await P.close(); report.push(r);
      console.log(`${id}: ${r.error ? "ERROR " + r.error : `steps ${JSON.stringify(r.steps)}, switched to ${r.mode1}, state differs in ${r.stateDiff.length ? r.stateDiff.join(", ") : "nothing"}`}`);
    }
  } finally { await B.close(); }
  await writeFile(join(out, "report.json"), JSON.stringify(report, null, 1));
}
