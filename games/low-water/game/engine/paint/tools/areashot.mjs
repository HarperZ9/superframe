// A still of a wired area as the game enters it: an act's content, an area id, Lamb's spot, the clock, a query.
//   node game/engine/paint/tools/areashot.mjs --port 8760 --content act2 --area a2.spit --at 10,0.2,3.6 --clock 1411 --out <png> [--query ...]
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
import { readFile } from "node:fs/promises";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), P = await B.page(1920, 1080);
try {
  await P.go(`http://127.0.0.1:${opt.port || 8760}/engine/play.html?capture=1&tips=0${opt.content ? "&content=" + opt.content : ""}${opt.query ? "&" + opt.query : ""}`);
  await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
  const r = await P.eval(`(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); const A = c.G.content.map.areas, a = A[${JSON.stringify(opt.area)}]; if (!a) return 'no area ' + Object.keys(A).join(','); const place = a.place;
    for (const k of Object.keys(A)) if (A[k] !== a && (A[k].place === place || (A[k].places || []).includes(place))) delete A[k];
    c.G.setPlace(place); c.G.state.pos = ${JSON.stringify((opt.at || "0,0,0").split(",").map(Number))}; ${opt.clock ? `try { c.G.state.clock = ${+opt.clock}; } catch {}` : ""} c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
    for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((q) => setTimeout(q, 100)); return 'ok ' + a.plate + '/' + (a.variant || '-'); })()`);
  console.log(r); await sleep(3000); await P.shot(opt.out || "areashot.png");
  if (opt.analyse) { const an = await readFile(new URL("../../tools/visualcheck/analyse.js", import.meta.url), "utf8"); const m = await P.eval(`(${an})({})`); console.log(JSON.stringify({ blotch: m.blotch, legible: m.glyphLegible, fails: m.fails })); }
} finally { await P.close(); await B.close(); }
