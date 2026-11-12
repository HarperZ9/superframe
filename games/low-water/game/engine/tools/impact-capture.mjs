// The combat-impact treatments side by side (coordinator, 2026-10-17): the same fight, frame-exact, at
// 1080p, once per treatment (shake, punch, both). The world's loop is held and stepped one fixed frame
// at a time with combat's own pilot playing Lamb, so each treatment sees the same blows on the same
// frames. Around each of the first contacts it writes frames (the contact, +2, +4, +8) and logs the
// camera's offset and zoom on every frame.
//   node tools/impact-capture.mjs [--port 8754] [--out dir] [--frames 600] [--dump a,b]
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./visualcheck/cdp.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const DUMP = opt.dump ? opt.dump.split(",").map(Number) : null; // --dump a,b: every frame from a to b, for a clip
const here = dirname(fileURLToPath(import.meta.url)), port = +(opt.port || 8754), out = opt.out || join(here, "..", "..", "capture", "impact"), FRAMES = +(opt.frames || 600);
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), summary = {};
try {
  for (const mode of ["shake", "punch", "both"]) {
    const P = await B.page(1920, 1080);
    await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&impact=${mode}`);
    await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
    await P.eval(`(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('quay'); for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) f.wander = 0; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); p.people.walkTo([-0.4, 0, -2.4], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`);
    await P.eval(`(async () => { const c = window.__lw, p = c.play, G = c.G; G.loop.paused = true; p.cam.hold(true); const { createPilot } = await import('/engine/combat/tools/pilot.mjs'); const C = G.ext.combat, step = C.step.bind(C), pilot = createPilot(); C.step = (input) => step(C.current && !C.current.W.result ? pilot(C.current.W) : input); p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); await new Promise((r) => setTimeout(r, 600)); return true; })()`);
    const log = [], shots = []; let contacts = 0, after = -1, which = 0;
    for (let f = 0; f < FRAMES; f++) {
      const r = await P.eval(`(() => { const c = window.__lw, G = c.G, F = c.play.fight, C = G.ext.combat; if (!C.current || C.current.W.result || !F) return { done: true }; G.loop.step(); c.play.cam.advance(1 / 60); const W = C.current.W, ev = W.events.filter((e) => ['hit', 'parry', 'guardbreak', 'block'].includes(e.type)).map((e) => e.type); const o = F.tickCam(1 / 60); F.draw(); const fr = c.play.cam.frameNow(); return { ev, dx: o.dx, dy: o.dy, z: o.z, left: fr && fr.left, top: fr && fr.top, zoom: fr && +fr.zoom.toFixed(3) }; })()`);
      if (r.done) { log.push({ f, done: true }); break; }
      log.push({ f, ...r });
      if (DUMP && f >= DUMP[0] && f <= DUMP[1]) { await sleep(40); await P.shot(join(out, `${mode}-frame-${String(f).padStart(4, "0")}.png`)); }
      if (r.ev.length && contacts < 6) { contacts++; after = 0; which = contacts; }
      if (after >= 0) { if ([0, 2, 4, 8].includes(after)) { await sleep(60); const name = `${mode}-c${which}-${r.ev[0] || "after"}-f${after}.png`; await P.shot(join(out, name)); shots.push(name); } after = after >= 8 ? -1 : after + 1; }
    }
    const moves = log.filter((x) => x.dx || x.dy || (x.z && x.z !== 1));
    summary[mode] = { frames: log.length, contacts, framesMoving: moves.length, maxShakePx: +Math.max(0, ...log.map((x) => Math.hypot(x.dx || 0, x.dy || 0))).toFixed(1), maxZoom: +Math.max(1, ...log.map((x) => x.z || 1)).toFixed(4), shots, logs: P.logs.slice(0, 10) };
    await writeFile(join(out, `${mode}-log.json`), JSON.stringify(log));
    await P.close();
    console.log(mode, JSON.stringify({ ...summary[mode], shots: summary[mode].shots.length }));
  }
} finally { await B.close(); }
await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 1));
