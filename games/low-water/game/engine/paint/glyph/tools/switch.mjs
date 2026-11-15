// The style switch mid-scene loses no state (design/art/STYLE-PARITY.md, style-switch). For each proof scene
// (glyph/tools/scenes.mjs: walking in the wide lens, a kitchen, a conversation open, the granary-door fight
// running), the game is paused, its state read (the game state, the open beat and its options, the area, the
// fight's clock and result), the style switched painted -> glyph -> painted as F7 does, and the state read again
// after each switch. Any difference fails. The control switches with a planted change of state on the switch
// (the clock moved a minute) and must fail.
//   node game/engine/paint/glyph/tools/switch.mjs --port 8790 [--only id,id]   (exit 1 on a failure)
// Original code.
import { launch, sleep } from "../../../tools/visualcheck/cdp.mjs";
import { SCENES } from "./scenes.mjs";
import { SNAP, LOOK, diffKeys } from "./pairs.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const ids = opt.only ? opt.only.split(",") : Object.keys(SCENES);
const PLANT = "(() => { window.__lw.G.env.advance(1); return true; })()";   // the control's planted state change

async function run(B, id, control) {
  const P = await B.page(1280, 720);
  try {
    await P.go(`http://127.0.0.1:${opt.port || 8790}/engine/play.html?capture=1&tips=0&smoke=0&blot=0&content=quota`);
    await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    for (const s of SCENES[id].steps) await P.eval(s);
    await P.eval("(() => { const G = window.__lw.G; if (G.loop) G.loop.paused = true; return true; })()"); await sleep(800);
    const a = JSON.parse(await P.eval(SNAP)), modes = [];
    modes.push(await P.eval(LOOK("glyph"))); if (control) await P.eval(PLANT);
    const b = JSON.parse(await P.eval(SNAP)); modes.push(await P.eval(LOOK("paint"))); const c = JSON.parse(await P.eval(SNAP));
    return { id, control, modes, diff: [...new Set([...diffKeys(a, b), ...diffKeys(a, c)])], errors: P.logs.filter((l) => /exception/.test(l)) };
  } finally { await P.close(); }
}
const B = await launch({ exe, port: 9600 + Math.floor(Math.random() * 300) }); let bad = 0;
try {
  for (const id of ids) {
    const r = await run(B, id, false), ok = r.diff.length === 0 && r.modes.join() === "glyph,oilInk" && !r.errors.length; if (!ok) bad++;
    console.log(`${ok ? "pass" : "FAIL"}  ${id.padEnd(15)} modes ${r.modes.join(" -> ")}; state differs in ${r.diff.length ? r.diff.join(", ") : "nothing"}${r.errors.length ? `; ${r.errors.join("; ")}` : ""}`);
  }
  const c = await run(B, ids[0], true), seen = c.diff.length > 0; if (!seen) bad++;
  console.log(`${seen ? "ctrl" : "FAIL"}  control         a clock change planted on the switch: ${seen ? `seen in ${c.diff.join(", ")}` : "NOT seen: the check is blind"}`);
} finally { await B.close(); }
process.exit(bad ? 1 : 0);
