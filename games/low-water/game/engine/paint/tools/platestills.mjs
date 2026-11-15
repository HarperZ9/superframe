// The fidelity bar's stills: every plate and variant shown in the game at the screen size given (1080p or 4K),
// painted or glyph, with no one about, Lamb at the plate's first spot or exit, and a contact sheet per mode.
//   node game/engine/paint/tools/platestills.mjs --port 8760 --content <dir> --out <dir> [--w 1920 --h 1080] [--query look=glyph] [--only plate,...]
import { readdirSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";
const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const content = opt.content || "content", out = opt.out || "game/capture/paint/plates", W = +(opt.w || 1920), H = +(opt.h || 1080);
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
mkdirSync(out, { recursive: true });
const jobs = [];
for (const d of readdirSync(content).sort()) {
  const f = join(content, d, "place.json"); if (!existsSync(f) || /^wide_/.test(d) || (opt.only && !opt.only.split(",").includes(d))) continue;
  const pj = JSON.parse(readFileSync(f, "utf8")), m = pj.marks || {}, at = ((m.spots || [])[0] || (m.exits || [])[0] || { at: pj.camera.target }).at;
  for (const v of pj.variants || []) jobs.push({ plate: d, place: pj.place || d, variant: v, at: [at[0], 0, at[2]] });
}
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) });
try {
  for (const j of jobs) {
    const P = await B.page(W, H);
    try {
      await P.go(`http://127.0.0.1:${opt.port || 8760}/engine/play.html?capture=1&tips=0&smoke=0${opt.query ? "&" + opt.query : ""}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      await P.eval(`(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); const A = c.G.content.map.areas, j = ${JSON.stringify(j)};
        const base = Object.values(A)[0]; for (const k of Object.keys(A)) if (A[k].place === j.place || (A[k].places || []).includes(j.place) || A[k].plate === j.plate) delete A[k];
        A['t.' + j.plate] = { ...base, id: 't.' + j.plate, name: j.plate, plate: j.plate, variant: j.variant, place: j.place, places: [], spawn: j.at, hotspots: [], figures: [], scale: 1 };
        c.G.setPlace(j.place); c.G.state.pos = j.at; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
        for (let i = 0; i < 300 && !(p.cam.ready()); i++) await new Promise((q) => setTimeout(q, 100)); for (const el of document.querySelectorAll('.screen.play .here, .hud, .topbar, aside.talk')) el.style.visibility = 'hidden'; return true; })()`);
      await sleep(2500); await P.shot(join(out, `${j.plate}-${j.variant}.png`)); console.log(`${j.plate}/${j.variant}: ok`);
    } catch (e) { console.log(`${j.plate}/${j.variant}: ${e.message}`); }
    await P.close();
  }
} finally { await B.close(); }
