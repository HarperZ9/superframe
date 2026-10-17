// A fight in the world: no separate screen and no change of look (author, 2026-10-17). The fight
// plays over the plate view under the game camera; the figures are drawn where the stage puts
// them on the plate (world/stage.mjs). ux: the paper is the UI lead's strip (ui/strip.mjs,
// design/UI-SYSTEM.md 7 and 7.2b): Standing, Breath, Composure and each opponent bottom left,
// built once and updated in place, with hit, block and catch responses; voice barks in the voice
// line above it; the talk-exit offer slides in on the right and takes the focus; Esc or Start
// pauses; when the fight ends the body gets 700 ms to land and the outcome flows into the talk
// panel (no result card), behind a 450 ms guard so a held catch cannot choose an option.
//   fightLayer(ctx, host, id, onDone, { cam })   cam: the play screen's plate camera
//   (ui/platecam.mjs); without one (a test harness) the arena is drawn as plain ground.
// Figures: setFigureDrawer(fn) (ui/figures.mjs, re-exported here) lets the character pipeline draw
//   each fighter: fn(g, F, { x, y, ppm, face, down, W, at, cam, plate, depth, depthAt, lights })
//   where (x, y) are the feet on screen, ppm pixels per metre, at the world point, cam the plate's
//   bake camera and depthAt the painted room's depth under a screen pixel (ui/figures.mjs says
//   more); the default draws a plain ink figure with a facing mark.
// On a painted plate the fight plays on the plate's own ground: the play screen hands combat the
//   plate's arena (combat/sim/plate.mjs through usePlate), so fighters stand in world x, z and the
//   art lead's fight marks place them; otherwise the stage lays combat's arena on the plate.
// Keys and pad: ui/fightkeys.mjs, from ui/bindings.mjs.
import { h, btn } from "./dom.mjs";
import { stageFor, fightBounds } from "../world/stage.mjs";
import { bindFightKeys, keyList } from "./fightkeys.mjs";
import { createDock, fightStrip } from "./strip.mjs";
import { glyph } from "./bindings.mjs";
import { figureDrawer } from "./figures.mjs";
import { fightFx } from "./fightfx.mjs";
import { groundAt, clearAhead } from "../world/plateworld.mjs";
export { setFigureDrawer } from "./figures.mjs";
// one drawer for fights, sneaks and runs (ui/runlayer.mjs and ui/sneaklayer.mjs draw through this)
export const drawFigure = (g, F, args) => figureDrawer()(g, F, args);
import { clearOfPaper } from "./worldlayer.mjs";

const SETTLE_MS = 700, GUARD_MS = 450;
const skillName = (G, id) => String(((G.rs.skills || {})[id] || {}).name || id).toUpperCase();

export function fightLayer(ctx, host, id, onDone, { cam = null } = {}) {
  const G = ctx.G, C = G.ext.combat, W = C.start(id), def = C.defs[id] || {};
  const canvas = h("canvas.fightcanvas"), fxCanvas = h("canvas.fightcanvas.fightfx"), offer = h("div.talkoffer.sheet"); // effects on their own canvas, above the bodies
  offer.hidden = true;
  const keys = h("details.fightkeys.sheet", h("summary.caps.quiet", "Keys"), ...keyList().map(([k, what, pad]) => h("div", h("span.k", k), " ", what, pad ? h("span.quiet.small", `  ${pad}`) : null)));
  const root = h("div.fightlayer", canvas, fxCanvas, offer, keys);
  host.append(root);
  const dock = createDock(root), strip = fightStrip(dock, { G, W, title: def.name || id });
  const bounds = W.field.bounds, size = [bounds.x1 - bounds.x0, bounds.z1 - bounds.z0];
  const A = W.field.arena, onPlate = !!(A && A.plate && A.grid && A.origin);
  const stage = onPlate ? { placed: true, plate: true, toWorld: ([x, z], hh = 0) => [x, (groundAt(A, x, z) ?? 0) + hh, z] } : stageFor(G, A.name, size);
  const live = () => W.fighters.filter((F) => !F.out);
  if (cam) cam.frameOn((project) => clearOfPaper(fightBounds(project, stage, live()), cam, [dock.el, document.querySelector(".hud")])); // fighters stay clear of the strip and the HUD tab
  let closed = false, ended = null, layer = null, raf = 0, pauseEl = null, settle = 0;
  G.loop.clockRate = C.clockRate || 8;
  const unbind = bindFightKeys(G, { onPause: () => (pauseEl ? resume() : pause()) });
  const RESPONDS = ["hit", "block", "guardbreak", "parry", "evade", "breathless", "nocomposure", "knockdown", "yield", "lock"];
  const offs = [
    G.on("fight.end", (e) => { ended = e; G.loop.clockRate = 0; offer.hidden = true; settle = setTimeout(finish, SETTLE_MS); }),
    G.on("fight.talk.offer", (e) => showOffer(e)),
    G.on("fight.talk.withdrawn", () => { offer.hidden = true; }),
    G.on("fight.bark", (e) => dock.say(skillName(G, e.voice), e.text || "")),
    ...RESPONDS.map((t) => G.on(`fight.${t}`, (e) => strip.event(t, e))),
    G.on("fight.shake", (e) => shakeStart(e)),
    G.on("fight.rumble", (e) => rumble(e)),
  ];
  const prefs = ctx.prefs || {};
  const onBlur = () => { if (prefs.pauseOnBlur !== false) pause(); };
  addEventListener("blur", onBlur);

  // Screen shake (LOOK-UNIFIED R5: at most 2 plate pixels, snapped; no zoom punch): the plate and
  // the figures move together on a damped spring, the paper stays still. Off, light or on.
  let shake = null;
  function shakeStart(e) {
    if (prefs.shake === "off" || document.documentElement.classList.contains("calm")) return;
    const amp = Math.min(1, e.amp || 0.2) * (prefs.shake === "light" ? 0.5 : 1);
    shake = { amp, t: 0, frames: e.frames || 8, dir: e.dir || [1, 0], k: (e.spring && e.spring.k) || 200, damp: (e.spring && e.spring.damp) || 16 };
  }
  function shakeStep() {
    const els = [cam && cam.element, canvas].filter(Boolean);
    if (!shake) return;
    shake.t += 1;
    const w = Math.sqrt(shake.k), env = Math.exp(-shake.damp * shake.t / 120), v = shake.amp * env * Math.cos(w * shake.t / 60);
    const zoom = cam && cam.frameNow && cam.frameNow() ? cam.frameNow().zoom : 1, px = Math.round(v * 2 * zoom); // whole plate pixels, at most 2
    const [dx, dy] = Array.isArray(shake.dir) ? shake.dir : [1, 0], L = Math.hypot(dx, dy) || 1;
    for (const el of els) el.style.translate = `${Math.round((px * dx) / L)}px ${Math.round((px * dy) / L)}px`;
    if (shake.t > shake.frames * 3 || env < 0.05) { shake = null; for (const el of els) el.style.translate = ""; }
  }
  // Controller rumble for blows that touch Lamb (combat emits low and high motor strengths).
  function rumble(e) {
    if (prefs.rumble === false) return;
    const L = W.lamb(); if (!L || (e.id !== L.id && e.by !== L.id)) return;
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null, act = p && p.vibrationActuator;
    if (act && act.playEffect) act.playEffect("dual-rumble", { duration: Math.round(((e.frames || 6) * 1000) / 60), strongMagnitude: Math.min(1, e.low || 0), weakMagnitude: Math.min(1, e.high || 0) }).catch((err) => console.warn(`fight: rumble failed: ${err && err.message}`));
  }

  function showOffer(e) {
    offer.hidden = false;
    const take = btn([glyph("talk"), h("span", e.label || "Talk")], () => G.input.press("talk"), { cls: "go" });
    offer.replaceChildren(h("div.caps.quiet", "A way out"), take);
    if (ctx.F && !pauseEl) ctx.F.focus(take, { scroll: false }); // the offer holds the one hot mark
  }
  function pause() {
    if (pauseEl || ended) return;
    G.loop.paused = true;
    const resumeBtn = btn(["Resume", glyph("pause")], resume, { cls: "btn" });
    pauseEl = h("div.fightpause", h("div.menu.sheet.fade-in", h("h2", "Paused"), h("p.quiet.small", def.name || ""), resumeBtn,
      btn("Settings", () => ctx.settings && ctx.settings(), { cls: "btn" }),
      btn("Back to the title", () => { G.loop.paused = false; ctx.title && ctx.title(); }, { cls: "btn" })));
    root.append(pauseEl);
    if (ctx.F) ctx.F.focus(resumeBtn, { scroll: false });
  }
  function resume() { if (!pauseEl) return; pauseEl.remove(); pauseEl = null; G.loop.paused = false; if (document.activeElement && root.contains(document.activeElement)) document.activeElement.blur(); }

  function screenOf(F) {
    const p = stage.toWorld([F.x, F.z]);
    if (cam && cam.ready()) {
      const s = cam.toScreen(p); if (!s) return null;
      const pj = cam.place && cam.place(), a = cam.area && cam.area(), variant = (a && a.variant) || (pj && pj.variants && pj.variants[0]);
      return { x: s[0], y: s[1], ppm: cam.scaleAt(p), at: p, cam: pj && pj.camera, plate: pj && pj.place, depth: cam.depthOf ? cam.depthOf(p) : 0, depthAt: cam.depthAt, lights: (pj && pj.lights && pj.lights[variant]) || [], darkness: cam.darkness ? cam.darkness() : 0 };
    }
    const sc = Math.min(canvas.width / (size[0] + 2), canvas.height / (size[1] + 2)); // no plate: the arena as plain ground
    return { x: (F.x - bounds.x0 + 1) * sc, y: (F.z - bounds.z0 + 1) * sc, ppm: sc };
  }
  const fx = fightFx(); let lastT = performance.now();
  // a world point (x, y up, z) to the screen for the fx: the stage lays the arena on the plate
  const fxScreen = ([x, y, z]) => { const p = stage.toWorld([x, z], y); if (cam && cam.ready()) { const s = cam.toScreen(p); return s && { x: s[0], y: s[1], ppm: cam.scaleAt(p) }; } const sc = Math.min(canvas.width / (size[0] + 2), canvas.height / (size[1] + 2)); return { x: (x - bounds.x0 + 1) * sc, y: (z - bounds.z0 + 1) * sc - y * sc, ppm: sc }; };
  function draw() {
    const r = root.getBoundingClientRect(); if (canvas.width !== Math.round(r.width) || canvas.height !== Math.round(r.height)) { canvas.width = Math.round(r.width); canvas.height = Math.round(r.height); }
    const g = canvas.getContext("2d"); g.clearRect(0, 0, canvas.width, canvas.height);
    if (!cam) { g.fillStyle = "#1a1416"; g.fillRect(0, 0, canvas.width, canvas.height); }
    const far = (F) => (cam && cam.depthOf ? -cam.depthOf(stage.toWorld([F.x, F.z])) : F.z), order = [...W.fighters].sort((a, b) => far(a) - far(b)); // far ones first
    const now = performance.now(), dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    fx.read(W); // this frame's tells, contacts and things in the air (combat/anim/fx.mjs)
    for (const F of order) { const s = screenOf(F); if (!s) continue; const args = { ...s, face: F.face, down: F.fallen || F.out || F.yielded, W, reach: onPlate && s.at ? clearAhead(A, s.at, F.face) : null, tell: fx.tellOf(F.id) }; figureDrawer()(g, F, args); }
    if (fxCanvas.width !== canvas.width || fxCanvas.height !== canvas.height) { fxCanvas.width = canvas.width; fxCanvas.height = canvas.height; }
    const gf = fxCanvas.getContext("2d"); gf.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fx.draw(gf, fxScreen, dt); // stones, mud, rope and lanterns in the air, and each contact's mark, over the bodies
    strip.update();
  }
  function frame() { if (closed) return; if (!G.loop.paused) shakeStep(); draw(); raf = requestAnimationFrame(frame); }
  function finish() {
    if (closed || !ended) return; closed = true; clearTimeout(settle); cancelAnimationFrame(raf);
    for (const off of offs) off(); unbind(); removeEventListener("blur", onBlur); shake = null; if (cam) { cam.frameOn(null); cam.element.style.translate = ""; }
    G.loop.clockRate = 0; G.loop.paused = false;
    if (ctx.F && layer) ctx.F.pop(layer);
    strip.leave().then(() => root.remove());
    if (ctx.F) { // the guard: a held catch (pad A is also confirm) cannot choose the next option
      const guard = ctx.F.push({ name: "fight-guard", root: h("div"), onAction: () => true, onBack: () => true });
      setTimeout(() => ctx.F.pop(guard), GUARD_MS);
    }
    onDone();
  }
  if (ctx.F) layer = ctx.F.push({ name: "fight", root, onAction: () => !pauseEl, onBack: () => { if (pauseEl) resume(); return true; } });
  raf = requestAnimationFrame(frame);
  return { W, finish, draw, stage, strip, dock, pause, resume };
}
