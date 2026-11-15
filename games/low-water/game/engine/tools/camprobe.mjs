// The fight camera's framing, measured (systems engineer, 2026-10-22; bounds in PROGRESS.md 37).
// Opens the quay fight at 1920 x 1080 with combat's pilot playing Lamb and samples, on every animation frame in
// real time, the view (left, top, zoom) and where a fixed ground point (Lamb's spot at the start) and the
// fighters land on the screen. Three phases:
//   live    the fight plays (pilot on), 4 s;
//   rest    the world held (no body moves), 4 s: after its first 2 s any motion of the view is drift;
//   change  the farthest opponent taken out while held, 3 s: the view's answer to new bounds.
// Reports, in screen px at 1080p, per frame at 60 a second (scaled by each frame's own time, since a headless
// page under the painted figures runs slower than 60):
//   restDrift   the largest move of the fixed point over the rest phase after 2 s;
//   step        the largest change in per-frame motion (the view's speed jumping), per phase;
//   jitter      frames where the view moves one way and straight back (each over 0.5 px);
//   framing     the fighters' box in the view at the end of the rest phase: its centre against the view
//               clear of the paper, and its share of that view.
// Writes log.json, summary.json and three stills (live end, rest end, change end) under --out.
// --query camfollow=old: the follow and the way-out framing as they were before PROGRESS 37 (the control).
// --pilot off: Lamb stands still (the opponents come to her), so a short fight lasts the whole probe.
// --fight brawl: Lamb and six wardens on the quay (the bench's brawl) in place of the lamplighters.
//   node tools/camprobe.mjs [--port 8754] [--out dir] [--query "a=1"] [--label name] [--fight brawl] [--pilot off]
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./visualcheck/cdp.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const here = dirname(fileURLToPath(import.meta.url)), port = +(opt.port || 8754);
const out = opt.out || join(here, "..", "..", "capture", "camprobe", opt.label || "now");
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;
await mkdir(out, { recursive: true });
const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) });
const SAMPLE = `(() => { const c = window.__lw, p = c.play, cam = p.cam, f = cam.frameNow(), C = c.G.ext.combat, W = C.current && C.current.W;
  const fx = p.fight, live = W ? W.fighters.filter((F) => !F.out && !F.fallen && (window.__probeOld || !F.yielded)) : [];
  const pts = live.map((F) => cam.toScreen(fx.stage.toWorld([F.x, F.z], 1)) || [NaN, NaN]);
  const fix = cam.toScreen(window.__probeFix) || [NaN, NaN];
  const fb = cam.framing && cam.framing(), free = (fb && fb.free) || null, bnd = fb ? [(fb[0] - f.left) * f.zoom, (fb[1] - f.top) * f.zoom, (fb[2] - f.left) * f.zoom, (fb[3] - f.top) * f.zoom].map(Math.round) : null;
  return { left: f.left, top: f.top, zoom: +f.zoom.toFixed(4), bnd, fix, box: pts.length ? [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))] : null, free, n: live.length }; })()`;
const summary = {};
try {
  const P = await B.page(1920, 1080);
  await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&tips=0&impact=off${opt.query ? `&${opt.query}` : ""}`);
  await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
  if (/camfollow=old/.test(opt.query || "")) await P.eval("window.__probeOld = true");
  await P.eval(`(async () => { const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('quay'); for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) f.wander = 0; c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); } for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100)); p.people.walkTo([-0.4, 0, -2.4], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100)); return true; })()`);
  await P.eval(`(async () => { const c = window.__lw, p = c.play, G = c.G; G.loop.paused = true; p.cam.hold(true); const { createPilot } = await import('/engine/combat/tools/pilot.mjs'); const C = G.ext.combat, step = C.step.bind(C), pilot = createPilot(); if (${opt.pilot !== "off"}) C.step = (input) => step(C.current && !C.current.W.result ? pilot(C.current.W) : input); if (${opt.fight === "brawl"}) { const d = C.defs['e.wardens']; C.defs['e.probe.brawl'] = { ...d, id: 'e.probe.brawl', name: 'Brawl (probe)', foes: d.foes.map((f) => ({ ...f, n: 6 })) }; p.fightThen('e.probe.brawl'); } else { p.people.talkingWith('fewell'); p.startTalk('quay.lamplighters.stop'); const i = p.P.beat.options.findIndex((o) => /Stand your ground/.test(o.label)); p.choose(i); } for (let k = 0; k < 150 && !(C.current && p.fight); k++) await new Promise((r) => setTimeout(r, 100)); if (!C.current) return "no fight";
    const W = C.current.W, A = W.field.arena, L = W.lamb(); window.__probeFix = p.fight.stage.toWorld([L.x, L.z], 0);
    return true; })()`);
  const log = [];
  // the first fight's keys open for twelve seconds and then fold, which changes the view clear of the paper; fold
  // them now so the phases below see one layout (the fold's own re-frame is a separate, deliberate move)
  await P.eval(`(() => { const k = document.querySelector('.fightkeys'); if (k) k.open = false; return true; })()`);
  const REC = `(() => { window.__probeLog = []; const tick = () => { if (!window.__probeLog) return; window.__probeLog.push({ t: performance.now(), ...${SAMPLE.replace(/`/g, "\`")} }); requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`;
  // every phase in real time: the camera's own follow on animation frames, as a player sees it
  const phase = async (name, ms, { loop }) => {
    await P.eval(`(() => { const c = window.__lw; c.play.cam.hold(false); c.G.loop.paused = ${!loop}; return true; })()`);
    await P.eval(REC); await sleep(ms);
    const L = await P.eval(`(() => { const L = window.__probeLog; window.__probeLog = null; window.__lw.G.loop.paused = true; return L; })()`);
    L.forEach((x, f) => log.push({ phase: name, f, ...x }));
  };
  await phase("live", 4000, { loop: true }); await P.shot(join(out, "live-end.png"));
  await phase("rest", 4000, { loop: false }); await P.shot(join(out, "rest-end.png"));
  // a new set of bounds: the farthest opponent leaves the fight (as one beaten or fled would)
  await P.eval(`(() => { const C = window.__lw.G.ext.combat.current; if (!C) return -1; const W = C.W, L = W.lamb(); const foes = W.fighters.filter((F) => F.team !== L.team && !F.out && !F.fallen).sort((a, b) => Math.hypot(b.x - L.x, b.z - L.z) - Math.hypot(a.x - L.x, a.z - L.z)); if (foes[0]) foes[0].out = true; return foes.length; })()`);
  await phase("change", 3000, { loop: false }); await P.shot(join(out, "change-end.png"));
  // per-frame figures at 60 frames a second whatever the page managed: a move is the motion over 1/60 s at that
  // frame's speed; a step is the change in that motion from one frame to the next
  const stats = (name, skipMs = 0) => {
    const all = log.filter((x) => x.phase === name && !x.done && x.fix && Number.isFinite(x.fix[0])), t0 = all.length && all[0].t, L = all.filter((x) => x.t - t0 >= skipMs), v = [], jerk = [];
    for (let i = 1; i < L.length; i++) { const dt = Math.max(1, L[i].t - L[i - 1].t) / (1000 / 60); v.push([(L[i].fix[0] - L[i - 1].fix[0]) / dt, (L[i].fix[1] - L[i - 1].fix[1]) / dt]); }
    for (let i = 1; i < v.length; i++) jerk.push(Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1]));
    const moves = v.map((q) => Math.hypot(...q));
    // jitter: the view moving one way and straight back the next frame, each by more than half a pixel
    let jitter = 0; for (let i = 1; i < v.length; i++) if (moves[i] > 0.5 && moves[i - 1] > 0.5 && v[i][0] * v[i - 1][0] + v[i][1] * v[i - 1][1] < 0) jitter++;
    const fps = L.length > 1 ? +((L.length - 1) / ((L[L.length - 1].t - L[0].t) / 1000)).toFixed(1) : 0;
    return { frames: L.length, fps, maxMovePx: +Math.max(0, ...moves).toFixed(2), framesMoving: moves.filter((m) => m > 0.01).length, maxStepPx: +Math.max(0, ...jerk).toFixed(2), jitter, zoomRange: L.length ? [Math.min(...L.map((x) => x.zoom)), Math.max(...L.map((x) => x.zoom))] : null };
  };
  const end = log.filter((x) => x.phase === "rest" && x.box).pop();
  const fr = end && (end.free || [0, 0, 1920, 1080]);
  summary.restDrift = stats("rest", 2000); summary.restAll = stats("rest"); summary.change = stats("change"); summary.live = stats("live");
  if (end) summary.framing = { box: end.box.map(Math.round), free: fr.map(Math.round), centreOffsetPx: [Math.round((end.box[0] + end.box[2]) / 2 - (fr[0] + fr[2]) / 2), Math.round((end.box[1] + end.box[3]) / 2 - (fr[1] + fr[3]) / 2)], share: +(((end.box[2] - end.box[0]) * (end.box[3] - end.box[1])) / ((fr[2] - fr[0]) * (fr[3] - fr[1]))).toFixed(3), zoom: end.zoom, fighters: end.n };
  summary.logs = P.logs.slice(0, 8);
  await writeFile(join(out, "log.json"), JSON.stringify(log));
  await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  await P.close();
} finally { await B.close(); }
