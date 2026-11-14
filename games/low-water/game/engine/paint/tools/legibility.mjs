// Night plate legibility in glyph mode: every wired area whose variant falls at night, and the new plates'
// night variants, each loaded in the game in glyph mode with no one about; the plate's legibility measured
// (glyph/legibility.mjs) with figures and panels left out. Headless, GPU off.
//   node game/engine/paint/tools/legibility.mjs --port 8760 --out game/capture/paint/legible [--query glyph=...] [--only plate/variant,...] [--shots]
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), out = opt.out || "game/capture/paint/legible";
const exe = `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
// the new plates (design/PLACES-NEW.md) have no area yet: a spot of their own to stand on
const NEW = [["ferry", "ferry", [1.3, 0, -1.0]], ["hall", "hall", [1.6, 0, 1.6]], ["smokehouse", "smokehouse", [1.6, 0, 0.9]], ["loft", "loft", [0.6, 0, 0.6]], ["roof", "roof", [2.2, 0, 1.2]], ["weighoffice", "weighoffice", [-0.2, 0, -0.3]]];
const night = (h) => h >= 19 || h < 6.5;
const url = `http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0&look=glyph${opt.query ? "&" + opt.query : ""}`;
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), rows = [];
try {
  // the jobs: wired areas at night, then the new plates' night variants
  let P = await B.page(1920, 1080); await P.go(url); await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
  const jobsAll = JSON.parse(await P.eval(`(async () => { const c = window.__lw; c.newGame(11); const A = c.G.content.map.areas, J = [], seen = new Set();
    const pj = async (p) => { try { const r = await fetch('/content/' + p + '/place.json'); return r.ok ? await r.json() : null; } catch { return null; } };
    for (const [id, a] of Object.entries(A)) { if (!a.plate) continue; const j = await pj(a.plate); if (!j) continue; const v = a.variant || (j.variants || [])[0]; const h = j.variantInfo && j.variantInfo[v] && j.variantInfo[v].hour; const k = a.plate + '/' + v; if (h == null || seen.has(k)) continue; seen.add(k); J.push({ id, plate: a.plate, variant: v, hour: h }); }
    for (const [plate, place, spawn] of ${JSON.stringify(NEW)}) { const j = await pj(plate); if (!j) continue; for (const v of j.variants || []) J.push({ plate, place, spawn, variant: v, hour: (j.variantInfo[v] || {}).hour, fresh: true }); }
    return JSON.stringify(J); })()`)); console.log(`jobs before the night filter: ${jobsAll.length}`, JSON.stringify(jobsAll.slice(0, 3)));
  const jobs2 = jobsAll.filter((j) => night(j.hour) && (!opt.only || opt.only.split(",").includes(`${j.plate}/${j.variant}`)));
  await P.close();
  const jobs = jobs2;
  for (const j of jobs) {
    const r = { plate: j.plate, variant: j.variant, hour: j.hour };
    P = await B.page(1920, 1080);
    try {
      await P.go(url); await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      await P.eval(`(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); const A = c.G.content.map.areas, j = ${JSON.stringify(j)};
        let a; if (j.fresh) { const base = Object.values(A)[0]; a = A['t.' + j.plate] = { ...base, id: 't.' + j.plate, name: j.plate, plate: j.plate, place: j.place, places: [], spawn: j.spawn, hotspots: [], figures: [] }; } else a = A[j.id];
        a.variant = j.variant; if (!${JSON.stringify(!!opt.people)}) a.figures = []; const place = a.place;
        for (const k of Object.keys(A)) if (A[k] !== a && (A[k].place === place || (A[k].places || []).includes(place))) delete A[k];
        c.G.setPlace(place); c.G.state.pos = a.spawn ? [...a.spawn] : [0, 0, 0]; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
        for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((q) => setTimeout(q, 100)); return true; })()`);
      await sleep(2500); await P.eval("globalThis.__lwGlyphMasks = true"); await sleep(600);
      Object.assign(r, JSON.parse(await P.eval("JSON.stringify(window.__lw.play.renderers.glyph.measure())")));
      r.sep = JSON.parse(await P.eval("JSON.stringify(Object.values(globalThis.__lwGlyphSep || {}).map((x) => +(x.figure / Math.max(1, x.ring)).toFixed(2)))"));
      if (opt.shots) await P.shot(join(out, `${j.plate}-${j.variant}.png`));
    } catch (e) { r.error = e.message; }
    await P.close(); rows.push(r);
    console.log(`${(j.plate + "/" + j.variant).padEnd(24)} ${r.error || `structure ${r.structure}  coverage ${r.coverage}  median ${r.median}  outline ${r.outlineWorld} / ${r.outlineFigure}  parts ${r.partsRead} of ${r.partMeets}  figure/ground ${(r.sep || []).join(" ")}`}`);
  }
} finally { await B.close(); }
const ok = rows.filter((r) => r.structure != null), mean = (k) => +(ok.reduce((s, r) => s + r[k], 0) / Math.max(1, ok.length)).toFixed(3);
console.log(`mean over ${ok.length}: structure ${mean("structure")}  coverage ${mean("coverage")}  median ${mean("median")}  p90 ${mean("p90")}`);
await writeFile(join(out, "legibility.json"), JSON.stringify(rows, null, 1));
