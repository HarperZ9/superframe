// A cinematic in the page (design/CINEMATICS.md section 3.3): the shots of a script (cine/timeline.mjs) drawn on
// the art lead's plates with the observer camera, the tilt-shift lens (cine/lens.mjs), the light model's snow
// (fx/weather.mjs), the character pipeline's people (ui/figures.mjs) and the record look as a time morph; the
// sound is the script's cue (cine/sound.mjs: its stems rendered in the score's workers), started at the film's zero.
//   const A = preloadFilm(script); await A.ready
//   const F = playFilm(host, script, A, { calm, skippable, onEnd, clock })   F.seek(t) F.skip() F.stop() F.t
// clock: "real" (requestAnimationFrame) or "manual" (cine/tools/cinecapture.mjs steps it with F.seek).
import { compile, shotAt, keyAt, viewOf, toScreen, peopleAt, morphAt, textAt, geoPoint, FRAME } from "./timeline.mjs";
import { LOOKS, lensOf, lensGeom } from "../fx/focus.mjs";
import { cineLens } from "./lens.mjs";
import { figureDrawer } from "../ui/figures.mjs";
import { fxContext, runEffects, fxSettings } from "../fx/core.mjs";
import "../fx/weather.mjs";
import { paintCanvas } from "../fx/paint.mjs";
import { buildSteps, runSteps } from "../light/steps.mjs";
import { camBasis, depthOf } from "../world/plateworld.mjs";
import { recordGrade } from "./grade.mjs";

const get = async (url, as) => { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return as === "json" ? r.json() : r.arrayBuffer(); };
const image = async (url) => { const im = new Image(); im.src = url; await im.decode(); return im; };
const idle = () => new Promise((ok) => (globalThis.requestIdleCallback ? requestIdleCallback(ok, { timeout: 50 }) : setTimeout(ok, 0)));

// Every plate the script shows, read once: place.json, the variant's colour, the world positions and ids, and the
// light model built in slices where a shot asks for the snow (so the boot cards cover the cost).
export function preloadFilm(script) {
  const plates = new Map(), C = compile(script);
  for (const s of C.shots) if (s.plate) { const k = `${s.plate}|${s.variant}`; const e = plates.get(k) || { plate: s.plate, variant: s.variant, fx: false }; e.fx ||= !!s.fx; plates.set(k, e); }
  const ready = Promise.all([...plates.values()].map(async (e) => {
    const base = `/content/${e.plate}/`;
    [e.pj, e.img, e.pos, e.ids] = await Promise.all([get(`${base}place.json`, "json"), image(`${base}${e.variant}.png`), get(`${base}geo-pos.f32`).then((b) => new Float32Array(b)), get(`${base}geo-id.u8`).then((b) => new Uint8Array(b))]);
    e.basis = camBasis(e.pj.camera);
    if (e.fx) {
      try { const job = buildSteps({ pj: e.pj, geo: { pos: e.pos, ids: e.ids }, variant: e.variant }); let done = null; while (!(done = runSteps(job, 8))) await idle(); e.scene = done; }
      catch (err) { console.warn(`film: no light model for ${e.plate} (${err.message}); no snow there`); }
    }
    return e;
  })).then(() => plates);
  return { plates, ready, C };
}

// the look's lens with the record morph's weight w mixed in (the miniature strength and the plane rise toward it)
// over: a shot's own lens settings over its look (K, fNumber, tiltDeg), for the observer's miniature in a wide shot
function lookAt(name, w, over = null) {
  const a = { ...(LOOKS[name] || LOOKS.daily), ...(over || {}) }, b = LOOKS.record;
  return w <= 0 ? a : { ...a, K: a.K + (b.K - a.K) * w, tiltDeg: a.tiltDeg + (b.tiltDeg - a.tiltDeg) * w, fNumber: a.fNumber + (b.fNumber - a.fNumber) * w };
}

function drawPeople(g, e, view, list) {
  // through the fighters' hook with a person's pose, so a body the queue repeats gets its own actor (the person
  // hook keys an actor by the cast id, and two of the same cast in one frame would share one)
  const pj = e.pj, draw = figureDrawer(), lights = (pj.lights && pj.lights[e.variant]) || [], W = { defs: {}, moves: {} };
  const depthAt = (sx, sy) => { const P = geoPoint(pj, e.pos, view.left + sx / view.zoom, view.top + sy / view.zoom); return P ? depthOf(pj.camera, P, e.basis) : Infinity; };
  const items = list.map((p) => ({ p, depth: depthOf(pj.camera, p.at, e.basis) })).sort((a, b) => b.depth - a.depth);
  for (const { p, depth } of items) {
    const [x, y] = toScreen(pj, view, p.at), [, y1] = toScreen(pj, view, [p.at[0], p.at[1] + 1, p.at[2]]);
    if (x < -200 || x > FRAME[0] + 200 || y < -200 || y > FRAME[1] + 400) continue;
    const pose = p.gesture ? { anim: p.gesture.anim, t: p.gesture.t } : { anim: p.walking ? "walk" : "idle", loop: true };
    const F = { id: `${p.who}#${p.slot ?? "1"}`, who: p.who, person: true, team: "town", x: p.at[0], z: p.at[2], face: p.face, pose };
    try { draw(g, F, { x, y, ppm: Math.abs(y - y1), at: p.at, face: p.face, down: false, W, cam: pj.camera, plate: pj.place, depth, depthAt, lights, darkness: 0 }); }
    catch (err) { console.warn(`film: could not draw ${p.who}: ${err.message}`); }
  }
}

function drawStencil(g, e, view, x) {
  const [sx, sy] = toScreen(e.pj, view, x.at);
  g.save(); g.font = `600 ${Math.round(18 * Math.min(2, view.zoom / 2))}px "LW Conso", monospace`; g.textAlign = "center"; g.textBaseline = "bottom";
  g.fillStyle = "rgba(29, 20, 24, 0.92)"; g.fillText(x.text, sx, sy - 6); g.restore();
}

// One shot at local second s, drawn into g (the frame's 2D context).
function drawShot(g, A, shot, s, opt) {
  g.fillStyle = A.C.ground || "#070a11"; g.fillRect(0, 0, FRAME[0], FRAME[1]);
  if (shot.black) return;
  const e = A.plates.get(`${shot.plate}|${shot.variant}`); if (!e || !e.img) return;
  const cam = { at: keyAt(shot.cam, s, "at", opt.calm), zoom: keyAt(shot.cam, s, "zoom", opt.calm) }, view = viewOf(e.pj, cam);
  g.drawImage(e.img, view.left * (e.img.width / e.pj.width), view.top * (e.img.height / e.pj.height), view.w * (e.img.width / e.pj.width), view.h * (e.img.height / e.pj.height), 0, 0, FRAME[0], FRAME[1]);
  const w = morphAt(shot, s, opt.calm), focus = keyAt(shot.focus, s, "at", opt.calm, "cut");
  if (opt.lens && focus) {
    opt.lens.place(`${shot.plate}|${shot.variant}`, e.img, e.pj, e.pos);
    const geom = lensGeom(lensOf(lookAt(shot.look, w, shot.lens), focus, [1, 0, 0]), e.pj.camera, e.pj.width, e.pj.height, 1080), L = opt.lens.draw(view, geom);
    if (L) g.drawImage(L, (+L.dataset.rx - view.left) * view.zoom, (+L.dataset.ry - view.top) * view.zoom, L.width * view.zoom, L.height * view.zoom);
  }
  if (shot.fx && e.scene) {
    const M = e.scene.M; M.terms = { ...M.terms, ...shot.fx };
    const ctx = fxContext({ M, F: e.scene.F, pj: e.pj, t: opt.t, figures: [], wind: 0.4 }), r = runEffects(ctx, { ...fxSettings(null), only: ["snowfall"], motion: opt.calm ? "reduced" : "full" });
    paintCanvas(g, r.prims, view);
  }
  drawPeople(g, e, view, peopleAt(shot, s));
  if (w > 0) recordGrade(g, w);
  for (const x of textAt(shot, s)) if (x.kind === "stencil") { g.save(); g.globalAlpha = w; drawStencil(g, e, view, x); g.restore(); }
}

export function playFilm(host, script, A, { calm = false, skippable = false, onEnd = () => {}, clock = "real", captions = false } = {}) {
  const C = A.C, root = document.createElement("div"), cv = document.createElement("canvas"), back = document.createElement("canvas");
  root.className = "film"; root.setAttribute("role", "img"); root.setAttribute("aria-label", script.title);
  root.style.cssText = `position:fixed;inset:0;background:${C.ground};display:grid;place-items:center;z-index:50;cursor:none`;
  cv.width = back.width = FRAME[0]; cv.height = back.height = FRAME[1];
  cv.style.cssText = "width:min(100vw, calc(100vh * 16 / 9));height:auto;aspect-ratio:16/9;display:block";
  const title = document.createElement("div"), cap = document.createElement("div"), hint = document.createElement("div");
  title.style.cssText = "position:absolute;inset:0;display:grid;place-items:center;color:#c4d8ee;font:500 clamp(1.4rem, 3.4vw, 3rem)/1.2 'LW Hanken', sans-serif;letter-spacing:0.32em;text-align:center;opacity:0;pointer-events:none";
  cap.style.cssText = "position:absolute;left:0;right:0;bottom:7vh;text-align:center;color:#e9e3d4;font:400 clamp(0.9rem, 1.4vw, 1.2rem) 'LW Hanken', sans-serif;text-shadow:0 0 6px #070a11;pointer-events:none";
  hint.style.cssText = "position:absolute;right:4vmin;bottom:4vmin;color:rgba(196,216,238,0.72);font:400 0.85rem 'LW Hanken', sans-serif;pointer-events:none";
  hint.textContent = skippable ? "Any key: skip" : "";
  root.append(cv, title, cap, hint); host.append(root);
  const g = cv.getContext("2d", { willReadFrequently: true }), gb = back.getContext("2d", { willReadFrequently: true }), lens = cineLens();
  // the character drawer draws on this thread while the film runs: its workers wait for the play screen's occlusion
  // data, which a film does not make (2026-10-22: every figure but the plain placeholder was missing)
  const wasSync = globalThis.__lwFigsSync; globalThis.__lwFigsSync = true;
  const F = { t: 0, done: false, lens };
  const render = (t) => {
    const { shot, local } = shotAt(C, t), opt = { calm, lens, t };
    const dis = !calm && shot.dissolve && local < shot.dissolve && shot.i > 0 ? local / shot.dissolve : 1;
    drawShot(g, A, shot, local, opt);
    if (dis < 1) { const prev = C.shots[shot.i - 1]; drawShot(gb, A, prev, prev.dur - 1e-3, opt); g.save(); g.globalAlpha = 1 - dis; g.drawImage(back, 0, 0); g.restore(); }
    const words = textAt(shot, local).find((x) => x.kind === "title");
    title.textContent = words ? words.text : ""; title.style.opacity = words ? String(calm ? 1 : Math.min(1, (local - words.s0) / 1.5)) : "0";
    const c = captions && (shot.captions || []).find((x) => local >= x.s0 && local < x.s1); cap.textContent = c ? c.text : "";
  };
  let raf = 0, t0 = null;
  const finish = (how) => { if (F.done) return; F.done = true; cancelAnimationFrame(raf); removeEventListener("keydown", onKey, true); root.removeEventListener("pointerdown", onKey); if (A.sound) A.sound.stop(); globalThis.__lwFigsSync = wasSync; root.remove(); onEnd(how); };
  const onKey = (e) => { if (!skippable) return; if (e.preventDefault) e.preventDefault(); finish("skipped"); };
  addEventListener("keydown", onKey, true); root.addEventListener("pointerdown", onKey);
  const loop = (now) => { if (F.done) return; if (t0 === null) { t0 = now; if (A.sound) A.sound.start(); } F.t = (now - t0) / 1000; if (F.t >= C.total) return finish("ended"); render(F.t); raf = requestAnimationFrame(loop); };
  if (clock === "real") raf = requestAnimationFrame(loop); else render(0);
  return Object.assign(F, { seek(t) { F.t = t; if (t >= C.total) finish("ended"); else render(t); }, skip: () => finish("skipped"), stop: () => finish("stopped"), canvas: cv, C });
}
