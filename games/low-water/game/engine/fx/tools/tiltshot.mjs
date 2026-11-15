// Stills of the tilt-shift lens in the real page (fx/tiltshift.mjs, design/sensory/08-FOCUS.md): one plate with a
// few figures, the lens off and on, then each focus intent driven through the game's own state (walk; talk, with
// the speaker set as the dialogue runner sets it; examine, through the close look's focus request; a fight, as
// the play screen marks it; a dream, through G.state.dream). Writes PNGs and stats.json (the director's intent,
// target and f-number, and the lens's ms a render) under --out.
//   node game/engine/fx/tools/tiltshot.mjs --port 8756 [--plate q_square_wide] [--look daily] [--out dir] [--gpu]
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { PLATE } from "../../paint/tools/views.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const plate = opt.plate || "q_square_wide", look = opt.look || "daily", out = opt.out || "game/capture/focus-2026-10-22", port = +(opt.port || 8756);
const spawn = plate === "q_granary" ? [0.4, 0, 2] : [8.5, 0, 9.5], figs = [["ned", 1.2, 0, 0.6], ["will", -3, 0, 3], ["mary", 5, 0, -4], ["anni", -6, 0, -7]];
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9600 + Math.floor(Math.random() * 200), args: opt.gpu ? ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader"] });
const stats = [];
const scenes = [
  ["walk", ""],
  ["talk", "c.G.activeTalk = { speaker: 'will' }; document.body.classList.add('talking');"],
  ["examine", `c.G.activeTalk = null; document.body.classList.remove('talking'); globalThis.__lwFocusRequest = { at: [${spawn[0] - 6}, 1.0, ${spawn[2] - 7}], range: 0.5 };`],
  ["fight", "globalThis.__lwFocusRequest = null; document.body.classList.add('fighting');"],
  ["dream", "document.body.classList.remove('fighting'); c.G.state.dream = 0.8;"],
];
try {
  for (const arm of ["off", look]) {
    const P = await B.page(1920, 1080);
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0&blot=0&tilt=${arm}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      await P.eval(PLATE(plate, plate, spawn, figs.map(([w, x, y, z]) => [w, spawn[0] + x, y, spawn[2] + z])));
      await sleep(3000);
      for (const [name, js] of arm === "off" ? scenes.slice(0, 1) : scenes) {
        await P.eval(`(() => { const c = window.__lw; ${js} return true; })()`);
        await sleep(2500);   // the rack settles (naturalist: about 0.5 s; the dream's child a little longer)
        const file = `${plate}-${arm}-${name}.png`;
        await P.shot(join(out, file));
        const st = JSON.parse(await P.eval("JSON.stringify(globalThis.__lwTilt ? globalThis.__lwTilt.stats : null)"));
        stats.push({ arm, scene: name, file, ...(st || {}) });
        console.log(JSON.stringify(stats[stats.length - 1]));
      }
      stats.push({ arm, logs: P.logs.filter((l) => /tilt|error|Error/.test(l)).slice(0, 12) });
    } finally { await P.close(); }
  }
} finally { await B.close(); }
await writeFile(join(out, "stats.json"), JSON.stringify(stats, null, 1));
