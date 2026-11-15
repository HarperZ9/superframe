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
import { fightCam } from "./fightcam.mjs";
// the combat-impact treatment that ships (CAMERA.md, "Combat impacts", chosen by testing)
export const IMPACT_DEFAULT = "shake";   // the reference has no zoom punch (NRFTW-PRESENTATION-2 3.1): shake and spring only; ?impact=both brings the punch back
import { groundAt, clearAhead, camBasis } from "../world/plateworld.mjs";
import { debugOn } from "./debugflags.mjs";
import { drawHitDebug } from "./hitdebug.mjs";
import { drawWays, offerNote, wayLabels, exitRects, nearestExitPoint, nearestExitPoints, coverShare, COVER, dockSpot, hudSpot, drawTells } from "./fightways.mjs";
import { COMPOSURE, HAT_TALK } from "../combat/data/build.mjs";
export { setFigureDrawer } from "./figures.mjs";
// one drawer for fights, sneaks and runs (ui/runlayer.mjs and ui/sneaklayer.mjs draw through this)
export const drawFigure = (g, F, args) => figureDrawer()(g, F, args);
import { freeOfPaper } from "./worldlayer.mjs";
const FIGHT_CLOSE = 1.6;   // a fight may come in to 1.6 times the area's walking closeness

const SETTLE_MS = 700, GUARD_MS = 450;
const skillName = (G, id) => String(((G.rs.skills || {})[id] || {}).name || id).toUpperCase();

export function fightLayer(ctx, host, id, onDone, { cam = null } = {}) {
  const G = ctx.G, C = G.ext.combat, W = C.start(id), def = C.defs[id] || {};
  const canvas = h("canvas.fightcanvas"), fxCanvas = h("canvas.fightcanvas.fightfx"), offer = h("div.talkoffer.sheet"); // effects on their own canvas, above the bodies
  offer.hidden = true;
  const keys = h("details.fightkeys.sheet", h("summary.caps.quiet", "Keys"), ...keyList().map(([k, what, pad]) => h("div", h("span.k", k), " ", what, pad ? h("span.quiet.small", `  ${pad}`) : null)));
  const marks = h("div.waymarks"), root = h("div.fightlayer", canvas, fxCanvas, marks, offer, keys);
  // the first fight of a night shows the keys open for twelve seconds, then folds them away (UX walk,
  // 2026-10-21: a new player met the first fight with the keys folded under a small tab)
  if (!(G.state.fightsSeen > 0)) { keys.open = true; setTimeout(() => { keys.open = false; }, 12000); }
  G.state.fightsSeen = (G.state.fightsSeen || 0) + 1;
  host.append(root);
  if (cam && cam.lensOver) cam.lensOver(root, offer); // one lens over fighters as over walkers, under the paper
  const dock = createDock(root), strip = fightStrip(dock, { G, W, title: def.name || id });
  // the ways out are chalked over the paper (their own canvas and labels above the strip and the keys), so
  // no panel hides one (2026-10-21)
  const waysCanvas = h("canvas.fightcanvas.fightways"); root.append(waysCanvas, marks);
  const bounds = W.field.bounds, size = [bounds.x1 - bounds.x0, bounds.z1 - bounds.z0];
  const A = W.field.arena, onPlate = !!(A && A.plate && A.grid && A.origin);
  const stage = onPlate ? { placed: true, plate: true, toWorld: ([x, z], hh = 0) => [x, (groundAt(A, x, z) ?? 0) + hh, z] } : stageFor(G, A.name, size);
  const live = () => W.fighters.filter((F) => !F.out);
  // on a plate the keys move Lamb as they do when walking, by the plate camera's screen directions
  // (2026-10-21 UX walk: the fight read them as a top-down arena's, so W walked Lamb down the screen)
  { const pj = onPlate && cam && cam.place && cam.place(); G.fightBasis = pj && pj.camera ? camBasis(pj.camera) : null; }
  // the camera frames the fight: the fighters centred in the view clear of the strip, the keys and the HUD
  // tab, and closer than walking (up to FIGHT_CLOSE times the area's closeness) so they fill it
  // and the way out nearest Lamb with them, so it is in the clear part of the view (2026-10-21: the keys sat on
  // the Gut's way out); the meters at the edge count as paper too
  const papers = () => [dock.el, keys, document.querySelector(".hud"), document.querySelector(".scene > .edge"), ...document.querySelectorAll(".screen .chip")];
  const paperSides = new Map();   // each panel's side, kept for the fight (ui/worldlayer.mjs freeOfPaper)
  if (cam) cam.frameOn((project) => {
    // framed: who is still in it; one who gave in walks off, and framing him pulled the view back (engine PROGRESS 37)
    const old = ctx.q && ctx.q.get && ctx.q.get("camfollow") === "old";   // the control (before PROGRESS 37): whole box, yielded framed
    const b = fightBounds(project, stage, live().filter((F) => old || !F.yielded), 1.2, { ownFloor: !old }); if (!b) return b;
    if (old) for (const [x, z] of nearestExitPoints(W)) { const [px, py] = project(stage.toWorld([x, z])); b[0] = Math.min(b[0], px); b[1] = Math.min(b[1], py); b[2] = Math.max(b[2], px); b[3] = Math.max(b[3], py); }
    // framed at Lamb's own floor height: a way out down steps to the water stands metres lower, and its ground
    // point dragged the view down over open water (engine PROGRESS 37)
    const ex = old ? null : nearestExitPoint(W), L = W.lamb && W.lamb(); if (ex && L) { const at = stage.toWorld(ex), [px, py] = project([at[0], stage.toWorld([L.x, L.z])[1], at[2]]); b[0] = Math.min(b[0], px); b[1] = Math.min(b[1], py); b[2] = Math.max(b[2], px); b[3] = Math.max(b[3], py); }
    b.close = FIGHT_CLOSE; b.free = freeOfPaper(cam, papers(), old ? null : paperSides); return b;
  });
  let closed = false, ended = null, layer = null, raf = 0, pauseEl = null, settle = 0;
  let talkSince = null, noteEl = null; // when the talk exit opened (the tell), and the offer's Composure line
  // a talk exit's price, as sim/world.mjs talkExit reckons it
  const talkCost = (W2, L) => { const d = W2.defs[L.id] || {}; if ((d.breaks || {}).hat8 && !W2.freeTalkUsed) return 0; return W2.talk.cost ?? (((d.levels || {}).hat ?? 0) >= HAT_TALK ? COMPOSURE.talkHat : COMPOSURE.talk); };
  G.loop.clockRate = C.clockRate || 8;
  const unbind = bindFightKeys(G, { onPause: () => (pauseEl ? resume() : pause()) });
  const RESPONDS = ["hit", "block", "guardbreak", "parry", "evade", "breathless", "nocomposure", "knockdown", "yield", "lock"];
  const offs = [
    G.on("fight.end", (e) => { ended = e; G.loop.clockRate = 0; offer.hidden = true; settle = setTimeout(finish, SETTLE_MS); }),
    G.on("fight.talk.offer", (e) => showOffer(e)),
    G.on("fight.talk.withdrawn", () => { offer.hidden = true; talkSince = null; }),
    G.on("fight.bark", (e) => dock.say(skillName(G, e.voice), e.text || "")),
    ...RESPONDS.map((t) => G.on(`fight.${t}`, (e) => strip.event(t, e))),
    G.on("fight.shake", (e) => shakeStart(e)),
    G.on("fight.rumble", (e) => rumble(e)),
  ];
  const prefs = ctx.prefs || {};
  const onBlur = () => { if (prefs.pauseOnBlur !== false) pause(); };
  addEventListener("blur", onBlur);

  // The camera's answer to a blow (ui/fightcam.mjs; CAMERA.md "Combat impacts"): directional shake by
  // weight and a zoom punch on heavy hits and catches, the plate, its people and the fight together, the
  // paper still. Treatment from ?impact=shake|punch|both (testing), else the one CAMERA.md chose.
  const impactMode = (ctx.q && ctx.q.get && ctx.q.get("impact")) || IMPACT_DEFAULT;
  const camfx = fightCam({ prefs, mode: impactMode, layers: () => [cam && cam.element && cam.element.parentElement, canvas, fxCanvas], view: () => { const r = root.getBoundingClientRect(); return { w: r.width, h: r.height }; } });
  function shakeStart(e) {
    const L = W.lamb && W.lamb(), at = L ? [L.x, L.z] : [0, 0], d = e.dir || [1, 0];
    const a = fxScreen([at[0], 1, at[1]]), b = fxScreen([at[0] + d[0], 1, at[1] + (d[1] ?? 0)]);
    camfx.blow(e, a && b ? [b.x - a.x, b.y - a.y] : [1, 0]);
  }
  let lastTick = performance.now();
  function shakeStep(dt = null) { const now = performance.now(), d = dt ?? Math.min(0.05, (now - lastTick) / 1000); lastTick = now; camfx.tick(d); }
  // Controller rumble for blows that touch Lamb (combat emits low and high motor strengths).
  function rumble(e) {
    if (prefs.rumble === false) return;
    const L = W.lamb(); if (!L || (e.id !== L.id && e.by !== L.id)) return;
    const p = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean)[0] : null, act = p && p.vibrationActuator;
    if (act && act.playEffect) act.playEffect("dual-rumble", { duration: Math.round(((e.frames || 6) * 1000) / 60), strongMagnitude: Math.min(1, e.low || 0), weakMagnitude: Math.min(1, e.high || 0) }).catch((err) => console.warn(`fight: rumble failed: ${err && err.message}`));
  }

  function showOffer(e) {
    offer.hidden = false; talkSince = performance.now();
    const take = btn([glyph("talk"), h("span", e.label || "Talk")], () => G.input.press("talk"), { cls: "go" });
    noteEl = h("p.small.quiet", offerNote(W, talkCost));
    offer.replaceChildren(h("div.caps.quiet", "A way out"), take, noteEl);
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
    const fr = fx.read(W); // this frame's tells, contacts and things in the air (combat/anim/fx.mjs)
    camfx.tells(fr.tells.map((t) => { const F = W.fighters.find((x) => x.id === t.id), sp = F && fxScreen([F.x, 0, F.z]); return sp ? [sp.x, sp.y] : null; }).filter(Boolean));
    for (const c of fr.contacts) { const sp = fxScreen([c.x, 1, c.z]); if (sp) camfx.contact(c, [sp.x, sp.y]); }
    for (const F of order) { const s = screenOf(F); if (!s) continue; const args = { ...s, face: F.face, down: F.fallen || F.out || F.yielded, W, reach: onPlate && s.at ? clearAhead(A, s.at, F.face) : null, tell: fx.tellOf(F.id) }; figureDrawer()(g, F, args); }
    if (fxCanvas.width !== canvas.width || fxCanvas.height !== canvas.height) { fxCanvas.width = canvas.width; fxCanvas.height = canvas.height; }
    const gf = fxCanvas.getContext("2d"); gf.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fx.draw(gf, fxScreen, dt); drawTells(gf, W, fxScreen); // the arena's ground telegraphs (ui/fightways.mjs) // stones, mud, rope and lanterns in the air, and each contact's mark, over the bodies
    if (waysCanvas.width !== canvas.width || waysCanvas.height !== canvas.height) { waysCanvas.width = canvas.width; waysCanvas.height = canvas.height; }
    const gw = waysCanvas.getContext("2d"); gw.clearRect(0, 0, waysCanvas.width, waysCanvas.height);
    drawWays(gw, W, fxScreen, now); // the ways out chalked on the ground (ui/fightways.mjs); the tell is a page label below
    { const ls = wayLabels(W, fxScreen, talkSince, now); // and as page labels, which glyph mode draws in its own type
      while (marks.children.length < ls.length) marks.append(h("div.hint.waymark")); while (marks.children.length > ls.length) marks.lastChild.remove();
      ls.forEach((l, i) => { const el = marks.children[i]; if (el.textContent !== l.text) el.textContent = l.text; el.classList.toggle("hot", !!l.hot); el.classList.toggle("tell", !!l.tell); el.style.transform = `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px) translate(-50%, -50%)`; }); }
    clearWays(); // no paper over a way out
    if (!offer.hidden && noteEl) { const t = offerNote(W, talkCost); if (noteEl.textContent !== t) noteEl.textContent = t; }
    if (debugOn("hits")) drawHitDebug(gf, W, fxScreen); // hit and hurt volumes (?debug=hits)
    strip.update();
  }
  // Paper never covers a way out or the meters (2026-10-21 UX walk: the keys hid the Gut's way out and
  // COLD): the keys fold away when they would, shorten to end above the meters, and any other panel over a
  // box lets it show through (.clearway). The layout is kept on the root for captures (root.layout).
  function clearWays() {
    const r0 = root.getBoundingClientRect(), rel = (el) => { const r = el.getBoundingClientRect(); return [r.left - r0.left, r.top - r0.top, r.right - r0.left, r.bottom - r0.top]; };
    const boxes = exitRects(W, fxScreen), edge = document.querySelector(".scene > .edge");
    if (edge && edge.children.length) { const e = rel(edge), room = r0.height - e[3] - 24 - (r0.bottom - keys.getBoundingClientRect().bottom); keys.style.maxHeight = `${Math.max(120, Math.round(room))}px`; } else keys.style.maxHeight = "";
    const view = [r0.width, r0.height], hides = (el) => boxes.some((b) => coverShare(rel(el), b, view) > COVER);
    if (keys.open && hides(keys)) keys.open = false;
    placeDock(rel, boxes, view, edge);
    const panels = [["keys", keys], ["strip", dock.el], ["offer", offer], ["hud", document.querySelector(".hud")], ["edge", edge]].filter(([, el]) => el && el.isConnected && !el.hidden);
    for (const [k, el] of panels) el.classList.toggle("clearway", k !== "strip" && hides(el)); // the status panel moves instead (placeDock)
    root.layout = { view, plate: onPlate, dock: dockAt, hud: hudAt, outs: boxes, panels: Object.fromEntries(panels.map(([k, el]) => [k, { rect: rel(el), faded: el.classList.contains("clearway"), open: k === "keys" ? keys.open : undefined }])), meters: edge && edge.children.length ? rel(edge) : null };
  }
  // the status panel's corner (ui/fightways.mjs dockSpot): moved at most every 1.5 s, so the camera's
  // reframing after a move cannot set it swinging between corners
  let dockAt = "bl", dockMoved = 0;
  function placeDock(rel, boxes, view, edge) {
    const now = performance.now(); if (now - dockMoved < 1500) return;
    const d = rel(dock.el), hud = document.querySelector(".hud"), gap = 12;
    const avoid = [hud, edge, keys, offer].filter((el) => el && el.isConnected && !el.hidden && el.getBoundingClientRect().width).map(rel);
    const tops = { left: hud ? rel(hud)[3] + gap : undefined, right: edge && edge.children.length ? rel(edge)[3] + gap : (document.querySelector(".screen .chip") ? rel(document.querySelector(".screen .chip"))[3] + gap : undefined), keysTop: rel(keys)[1] - gap };
    const { spot, rect } = dockSpot([d[2] - d[0], d[3] - d[1]], view, { boxes, avoid, tops, current: dockAt });
    placeHud(rel, boxes, view, edge, d);
    if (spot === dockAt) return;
    dockAt = spot; dockMoved = now;
    Object.assign(dock.el.style, spot === "bl" ? { left: "", top: "", bottom: "" } : { left: `${Math.round(rect[0])}px`, top: `${Math.round(rect[1])}px`, bottom: "auto" });
  }
  let hudAt = "tl";
  function placeHud(rel, boxes, view, edge, d) {
    const hud = document.querySelector(".hud"); if (!hud || !hud.isConnected) return;
    const r = rel(hud), avoid = [d, edge && edge.children.length ? rel(edge) : null, ...[...document.querySelectorAll(".screen .chip")].map(rel)].filter(Boolean);
    const { spot, rect } = hudSpot([r[2] - r[0], r[3] - r[1]], view, { boxes, avoid, right: edge && edge.children.length ? rel(edge)[3] + 12 : 90, current: hudAt });
    if (spot === hudAt) return;
    hudAt = spot; Object.assign(hud.style, spot === "tl" ? { left: "", top: "", right: "" } : { left: `${Math.round(rect[0])}px`, top: `${Math.round(rect[1])}px`, right: "auto" });
  }
  function frame() { if (closed) return; if (!G.loop.paused) shakeStep(); draw(); raf = requestAnimationFrame(frame); }
  function finish() {
    if (closed || !ended) return; closed = true; clearTimeout(settle); cancelAnimationFrame(raf);
    for (const off of offs) off(); unbind(); removeEventListener("blur", onBlur); camfx.stop(); if (cam) { cam.frameOn(null); if (cam.lensOver) cam.lensOver(); }
    G.loop.clockRate = 0; G.loop.paused = false; G.fightBasis = null;
    { const hud = document.querySelector(".hud"); if (hud) Object.assign(hud.style, { left: "", top: "", right: "" }); } // the HUD home again
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
  // tickCam(dt): the impact camera stepped by hand (tools: frame-exact captures with the loop held)
  return { W, finish, draw, stage, strip, dock, pause, resume, tickCam: (dt) => camfx.tick(dt), camfx };
}
