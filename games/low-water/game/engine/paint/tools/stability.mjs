// Temporal stability of the painted figures (design/RENDER-TARGET.md T2). Lamb walks along the quay
// while the painter records each frame of Lamb (bind point, stroke, unpainted and painted value per
// pixel). Consecutive frames are matched point to point in bind space (the same spot on the body,
// within 3 mm); per matched point it counts:
//   kept     the stroke under the point is the same stroke (persistence)
//   flicker  the painted value changed by more than 6/255 beyond the change in the unpainted value
// Runs three builds: the painter (bind), the screen-anchored control (which must fail) and the
// unpainted drawer (trace, its own change only).
//   node game/engine/paint/tools/stability.mjs --port 8760 [--frames 90] [--place quay] [--out file.json]
import { writeFile } from "node:fs/promises";
import { launch, sleep } from "../../tools/visualcheck/cdp.mjs";

const argv = process.argv.slice(2), opt = {};
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
const port = +(opt.port || 8760), frames = +(opt.frames || 90), place = opt.place || "quay", W = +(opt.w || 1920), H = +(opt.h || 1080);
const from = (opt.from || "0.4,-1.4").split(",").map(Number), to = (opt.to || "2.6,-0.6").split(",").map(Number);
const exe = opt.chrome || `${process.env.LOCALAPPDATA}/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe`;

const PAGE = `(async () => {
  globalThis.__lwPaintDebug = ${opt.debug || "{}"};
  const c = window.__lw; c.newGame(11); c.G.create({ archetype: 'p.wader', enter: false }); c.G.setPlace('${place}');
  for (const ar of Object.values(c.G.content.map.areas)) for (const f of ar.figures) { f.wander = 0; f.at = [60, 0, 60]; }   // the quay cleared: nobody in Lamb's way
  c.play(); const p = c.play; if (p.P.talk) { p.P.talk = null; p.P.beat = null; p.render(); }
  for (let i = 0; i < 400 && !(p.cam.ready() && p.cam.arena()); i++) await new Promise((r) => setTimeout(r, 100));
  // deterministic: the camera held, Lamb hidden from the live layer and drawn here frame by frame, walking
  // at 1.5 m/s at 60 frames a second, then turning a full circle on the spot
  p.people.walkTo([${from[0]}, 0, ${from[1]}], () => {}); for (let i = 0; i < 300 && p.people.walking(); i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 2500));
  p.people.hide(['lamb']);
  const { personDrawer } = await import('/engine/ui/figures.mjs');
  const pj = p.cam.place(), variant = (p.cam.area() && p.cam.area().variant) || pj.variants[0], lights = (pj.lights && pj.lights[variant]) || [];
  const cv = document.createElement('canvas'); cv.width = ${W}; cv.height = ${H}; const g = cv.getContext('2d');
  const pos0 = [...c.G.state.pos], dir = [${to[0]} - pos0[0], ${to[1]} - pos0[2]], dl = Math.hypot(dir[0], dir[1]) || 1; dir[0] /= dl; dir[1] /= dl;
  globalThis.__lwPaintTrace = { who: 'lamb', frames: [] };
  const t0 = performance.now(), walkN = Math.round(${frames} * 0.6);
  for (let f = 0; f < ${frames}; f++) {
    const walking = f < walkN, d = walking ? (1.5 / 60) * f : (1.5 / 60) * walkN, at = [pos0[0] + dir[0] * d, pos0[1], pos0[2] + dir[1] * d];
    const face = Math.atan2(dir[1], dir[0]) + (walking ? 0 : ((f - walkN) / (${frames} - walkN)) * Math.PI * 2), s = p.cam.toScreen(at);
    g.clearRect(0, 0, cv.width, cv.height);
    personDrawer()(g, { who: 'lamb', at, face, walking }, { x: s[0], y: s[1], ppm: p.cam.scaleAt(at), at, face, walking, running: false, talking: false, gesture: null, cam: pj.camera, plate: pj.place, depth: p.cam.depthOf(at), depthAt: p.cam.depthAt, lights, darkness: p.cam.darkness(), pose: null, seatY: null, reach: 2, room: null });
  }
  const walked = true, secs = (performance.now() - t0) / 1000, pos1 = [pos0[0] + dir[0] * (1.5 / 60) * walkN, 0, pos0[2] + dir[1] * (1.5 / 60) * walkN];
  const F = globalThis.__lwPaintTrace.frames; globalThis.__lwPaintTrace = null;
  const enc = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const R = +(globalThis.__lwMatchR || 0.0015), cellK = (x, y, z) => Math.floor(x / R) + ',' + Math.floor(y / R) + ',' + Math.floor(z / R);
  let bigOut = 0, bigBase = 0, flickIn = 0, still = 0, pairs = 0, kept = 0, flick = 0, dOut = 0, dBase = 0, moved = 0;
  for (let f = 1; f < F.length; f++) {
    const A = F[f - 1], B = F[f], grid = new Map();
    for (let q = 0; q < B.idx.length; q++) { const k = cellK(B.loc[q * 3], B.loc[q * 3 + 1], B.loc[q * 3 + 2]); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(q); }
    for (let q = 0; q < A.idx.length; q += 2) {
      const x = A.loc[q * 3], y = A.loc[q * 3 + 1], z = A.loc[q * 3 + 2], cx = Math.floor(x / R), cy = Math.floor(y / R), cz = Math.floor(z / R);
      let best = -1, bd = R * R;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const l = grid.get((cx + dx) + ',' + (cy + dy) + ',' + (cz + dz)); if (l) for (const b of l) { const d = (B.loc[b * 3] - x) ** 2 + (B.loc[b * 3 + 1] - y) ** 2 + (B.loc[b * 3 + 2] - z) ** 2; if (d < bd) { bd = d; best = b; } } }
      if (best < 0) continue;
      pairs++;
      const sa = [A.x0 + (A.idx[q] % A.w), A.y0 + ((A.idx[q] / A.w) | 0)], sb = [B.x0 + (B.idx[best] % B.w), B.y0 + ((B.idx[best] / B.w) | 0)];
      if (sa[0] !== sb[0] || sa[1] !== sb[1]) moved++;
      if (A.key[q] === B.key[best]) kept++;
      const o = Math.abs(enc(A.out[q]) - enc(B.out[best])), b = Math.abs(enc(A.base[q]) - enc(B.base[best]));
      dOut += o; dBase += b; if (o > 6) bigOut++; if (b > 6) bigBase++; if (o - b > 6) { flick++; if (A.key[q] === B.key[best]) flickIn++; }
    }
  }
  return { walked, metres: +Math.hypot(pos1[0] - pos0[0], pos1[2] - pos0[2]).toFixed(2), secs: +secs.toFixed(1), frames: F.length, stillPairs: still, pairs, movedShare: +(moved / Math.max(1, pairs)).toFixed(3), kept: +(kept / Math.max(1, pairs)).toFixed(4), flicker: +(flick / Math.max(1, pairs)).toFixed(4), flickerInStroke: +(flickIn / Math.max(1, pairs)).toFixed(4), jumpPainted: +(bigOut / Math.max(1, pairs)).toFixed(4), jumpUnpainted: +(bigBase / Math.max(1, pairs)).toFixed(4), meanDOut: +(dOut / Math.max(1, pairs)).toFixed(2), meanDBase: +(dBase / Math.max(1, pairs)).toFixed(2), stats: globalThis.__lwPaintStats && globalThis.__lwPaintStats.lamb };
})()`;

const B = await launch({ exe, port: 9400 + Math.floor(Math.random() * 400) }), out = {};
try {
  for (const mode of (opt.modes || "bind,screen,trace").split(",")) {
    const P = await B.page(W, H);
    try {
      await P.go(`http://127.0.0.1:${port}/engine/play.html?capture=1&paint=${mode === "bind" ? "1" : mode}`);
      await P.until("document.documentElement.dataset.ready === '1' && !!window.__lw");
      await sleep(500);
      out[mode] = await P.eval(PAGE);
    } catch (e) { out[mode] = { error: e.message }; console.error(`stability: ${mode}: ${e.message}`); }
    await P.close(); console.log(mode, JSON.stringify(out[mode]));
  }
} finally { await B.close(); }
if (opt.out) await writeFile(opt.out, JSON.stringify(out, null, 1));
