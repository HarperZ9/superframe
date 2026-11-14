// The renderer interface (design/GLYPH-PIPELINE.md section 1): the play screen holds one renderer
// at a time, each with renderFrame(scene, camera, lights, ui), and switches on F7 (or ?look=glyph, or
// globalThis.__lwLook). Two implementations:
//   oilInk  the existing layer stack (plate, painter, light, weather, people, fights); its layers run
//           their own frame loops, so its renderFrame only keeps them shown
//   glyph   the character-grid pipeline (glyph/renderer.mjs), drawn from the scene alone
// The simulation is shared: in Glyph mode the figure drawers record each posed skeleton for the glyph
// renderer instead of rasterising it. F7 switches, F8 cycles the presets, F9 the phosphor stage; the hint is set in the grid.
//   const R = createRenderers(ctx, host, api); R.stop()
import { createGlyphRenderer, GLYPH_DEFAULTS } from "./glyph/renderer.mjs";
import { collectUi } from "./glyph/ui.mjs";
import { measuredRamp, TONES } from "./glyph/tonemap.mjs";
import { installDream } from "./dream.mjs";
import { installDecals } from "./decals.mjs";
import { eraOf } from "./glyph/lightmodel.mjs";

// what the talk panel shows: the speaker's id and face, read from the portrait slot's picture
// (ui/portrait.mjs: /characters/<set>/<who>/<face>-<light>.png), for the face in the world and the glyph portrait
function talkFaceOf() {
  const img = document.querySelector(".portrait .pimg.on"), el = document.querySelector(".portrait"); if (!img || !el || el.hidden || !img.src) return null;
  const m = /\/characters\/([^/]+)\/([^/]+)\/([^/-]+)-([^/.]+)\.png/.exec(decodeURIComponent(img.src)); return m ? { set: m[1], who: m[2], face: m[3], light: m[4] } : null;
}

const OIL_LAYERS_ALL = "canvas.platecam-img, .platecam-lens, canvas.paintlight, canvas.weathercanvas, canvas.peoplecanvas, canvas.fightcanvas";
// ?glyph=paintfigs: the A/B hybrid, the glyph world with the painted figures over it (render/PROGRESS.md 73)
const OIL_LAYERS_WORLD = "canvas.platecam-img, .platecam-lens, canvas.paintlight, canvas.weathercanvas";

export async function createRenderers(ctx, host, api) {
  const parent = host.parentElement || host, G = () => ctx.G;
  let kinds = []; try { kinds = await (await fetch("/engine/paint/glyph/kinds.json")).json(); } catch (e) { console.warn(`glyph: no surface kinds (${e.message})`); }
  const byId = []; for (const k of kinds) byId[k.id] = k;
  try { await document.fonts.load('12px "LW Conso"'); } catch (e) { console.warn(`glyph: the house mono did not load (${e.message}); the atlas falls back`); }   // the atlas is measured in the house face
  const saved = (() => { try { return JSON.parse(localStorage.getItem("lw.glyph") || "{}"); } catch { return {}; } })();
  const glyph = createGlyphRenderer({ parent: host, kinds, opts: { ...saved, ...(ctx.q && ctx.q.get("glyph") === "nohyst" ? { hyst: -0.5 } : {}), ...(ctx.q && ctx.q.get("lantern") === "0" ? { lantern: false } : {}), ...(ctx.q && ctx.q.get("glyph") === "cpu" ? { gpu: false } : {}), ...(ctx.q && /nofloor/.test(ctx.q.get("glyph") || "") ? { floor: 0 } : {}), ...(ctx.q && /noglow/.test(ctx.q.get("glyph") || "") ? { glow: false } : {}), ...(ctx.q && /noshape/.test(ctx.q.get("glyph") || "") ? { shape: false } : {}), ...(ctx.q && /noparts/.test(ctx.q.get("glyph") || "") ? { parts: false } : {}), ...(ctx.q && /noreflect/.test(ctx.q.get("glyph") || "") ? { reflect: false } : {}), ...(ctx.q && /screendither/.test(ctx.q.get("glyph") || "") ? { ditherScreen: true } : {}), ...(ctx.q && /noshadow/.test(ctx.q.get("glyph") || "") ? { shadow: false } : {}), ...(ctx.q && ctx.q.get("glyphexpose") ? { expose: ctx.q.get("glyphexpose") } : {}), ...(ctx.q && ctx.q.get("smoke") === "0" ? { smoke: false } : {}), cellScale: ctx.q && ctx.q.get("glyphcell") ? +ctx.q.get("glyphcell") : innerWidth > 2600 ? 2 : 1, /* the canvas is drawn in CSS pixels: a 3840-wide window takes cells twice the size */ ...(ctx.q && ctx.q.get("smoke") === "0" ? { smoke: false } : {}), cellScale: ctx.q && ctx.q.get("glyphcell") ? +ctx.q.get("glyphcell") : innerWidth * (devicePixelRatio || 1) > 2600 ? 2 : 1, ...(ctx.q && /(^|,)glow/.test(ctx.q.get("glyph") || "") ? { glow: true } : {}) } });   // ?glyph=glow: the layered glow on (off by default: see render/PROGRESS.md 50)   // ?glyph=nofloor: without the night floor   // ?glyph=nohyst: the control without hysteresis
  const S = { raf: 0, stopped: false, mode: null, figs: [], figsNext: [] }, paintFigs = !!(ctx.q && /paintfigs/.test(ctx.q.get("glyph") || "")), OIL_LAYERS = paintFigs ? OIL_LAYERS_WORLD : OIL_LAYERS_ALL;
  const want = () => (globalThis.__lwLook || (ctx.q && ctx.q.get("look")) || "paint") === "glyph" ? "glyph" : "oilInk";
  // switches: F7 the renderer, F8 the next preset, F9 the phosphor stage; the hint is set in the grid (Glyph) or in type (Oil and Ink)
  const hint = document.createElement("div"); hint.className = "glyphhint"; hint.style.cssText = "position:absolute;right:1rem;bottom:0.6rem;z-index:6;font:12px Consolas,monospace;color:rgba(233,227,212,0.7);pointer-events:none";
  parent.append(hint);
  // no F7 tip on the play screen (engine PROGRESS 37: "F7 switches to type" stood in the corner of every first
  // screen a viewer saw, and of every capture); F7 still switches. The keys list does not name it yet (UI lead)
  // styles (glyph/styles/*.json): saved parameter sets over one tone map; F8 cycles them, ?glyphstyle=<name>
  // (or the older ?glyphpreset=<palette>) picks one. A "measured" style takes one ramp for every surface from
  // the atlas's ink coverage (glyph/tonemap.mjs measuredRamp)
  let styles = []; try { const idx = await (await fetch("/engine/paint/glyph/styles/index.json")).json(); styles = await Promise.all(idx.map(async (n) => (await fetch(`/engine/paint/glyph/styles/${n}.json`)).json())); } catch (e) { console.warn(`glyph: no styles (${e.message}); full colour only`); }
  if (!styles.length) styles = [{ name: "full", palette: "full", crt: false, bloom: 0.4, halation: 0.18, floor: 1, glow: false, ramp: "materials" }];
  const apply = (st) => {
    const ramp = st.ramp === "measured" && st.charset ? measuredRamp(glyph.atlas.cov, [...st.charset].map((ch) => glyph.atlas.index(ch))) : null;
    Object.assign(glyph.opts, { dither: ctx.q && /nodither/.test(ctx.q.get("glyph") || "") ? 0 : st.dither ?? 0, palette: st.palette, crt: !!st.crt, bloom: st.bloom ?? 0.4, halation: st.halation ?? 0.18, floor: st.floor ?? 1, glow: !!st.glow, style: st.name, toneRamp: ramp && ramp.length === TONES ? ramp : null });
    glyph.state.key = "";
  };
  const qs = ctx.q && (ctx.q.get("glyphstyle") || ctx.q.get("glyphpreset"));
  let preset = (styles.find((st) => st.name === (qs || saved.style)) || styles.find((st) => st.palette === (qs || glyph.opts.palette)) || styles[0]).name;
  apply(styles.find((st) => st.name === preset));
  const save = () => { try { localStorage.setItem("lw.glyph", JSON.stringify({ style: preset, palette: glyph.opts.palette, crt: glyph.opts.crt, effects: glyph.opts.effects })); } catch { /* a per-viewer convenience only */ } };
  const onKey = (e) => {
    if (/input|textarea/i.test((e.target && e.target.tagName) || "")) return;
    if (e.code === "F7") { e.preventDefault(); globalThis.__lwLook = want() === "glyph" ? "paint" : "glyph"; }
    else if (e.code === "F8" && S.mode === "glyph") { e.preventDefault(); const k = styles.findIndex((st) => st.name === preset); preset = styles[(k + 1) % styles.length].name; apply(styles[(k + 1) % styles.length]); save(); }
    else if (e.code === "F9" && S.mode === "glyph") { e.preventDefault(); glyph.opts.crt = !glyph.opts.crt; glyph.state.key = ""; save(); }
  };
  window.addEventListener("keydown", onKey);
  function setMode(m) {
    S.mode = m; const on = m === "glyph";
    glyph.show(on); document.documentElement.classList.toggle("look-glyph-ui", on);
    for (const el of document.querySelectorAll(OIL_LAYERS)) el.style.visibility = on ? "hidden" : "";
    for (const el of document.querySelectorAll("canvas.inkblot")) el.style.visibility = on ? "hidden" : "";
    for (const el of document.querySelectorAll("canvas.fxcanvas")) el.style.visibility = on ? "hidden" : "";   // glyph mode writes the effects' marks into its own cells (glyph/fxmarks.mjs)
    globalThis.__lwGlyphTakesFx = on;   // for fx/install.mjs: glyph sets the marks itself, the overlay need not be drawn   // glyph mode sets the blot in type (glyph/blot.mjs)
    if (paintFigs) for (const el of document.querySelectorAll("canvas.peoplecanvas, canvas.fightcanvas")) { el.style.position = el.style.position || "absolute"; el.style.zIndex = on ? "3" : ""; }   // the hybrid: painted figures over the glyph world
    globalThis.__lwGlyphFigure = on && !paintFigs ? (rec) => { if (!rec.solo) S.figsNext.push(rec); } : null;
    hint.textContent = "";
  }
  if (!document.querySelector("link[data-glyph-ui]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/engine/paint/glyph/glyph-ui.css"; l.dataset.glyphUi = "1"; document.head.append(l); }
  function frame() {
    if (S.stopped) return;
    S.raf = requestAnimationFrame(frame);
    if (want() !== S.mode) setMode(want());
    if (S.mode !== "glyph") return;
    for (const el of document.querySelectorAll(OIL_LAYERS)) if (el.style.visibility !== "hidden") el.style.visibility = "hidden";
    for (const el of document.querySelectorAll("canvas.fxcanvas")) if (el.style.visibility !== "hidden") el.style.visibility = "hidden";   // a fight's canvases arrive later
    if (paintFigs) for (const el of document.querySelectorAll("canvas.peoplecanvas, canvas.fightcanvas")) if (el.style.zIndex !== "3") el.style.zIndex = "3";
    const cam = api.cam, pj = cam.place(), geo = cam.geo(), view = cam.frameNow && cam.frameNow();
    if (!pj || !geo || !view || !cam.ready()) { if (glyph.renderUi && !(pj && !cam.ready())) { const ui = collectUi(document.body, glyph.opts.cw, glyph.opts.ch); ui.hint = "F7 painted"; glyph.renderUi({ W: Math.round(host.clientWidth), H: Math.round(host.clientHeight) }, ui); } return; }   // no plate: the panels alone (the UI art lead's)
    // the figures recorded since the last frame (people, and a fight's fighters)
    if (S.figsNext.length) { S.figs = S.figsNext; S.figsNext = []; }
    const variant = (cam.area() && cam.area().variant) || (pj.variants && pj.variants[0]), g = G();
    const term = (k) => { try { return +g.env.term(k, g.state.place) || 0; } catch { return 0; } };
    const pos = g.state.pos, fc = api.people && api.people.facing ? api.people.facing() : 0;
    const lantern = pos ? [pos[0] - Math.sin(fc) * 0.3, pos[1] + 0.75, pos[2] + Math.cos(fc) * 0.3] : null;
    const ways = waysOut(g, api.cam);   // a fight's ways out, read from the fight itself (as ui/fightways.mjs chalks them)
    const tideY = pj.datum ? pj.datum.a + pj.datum.b * (term("tide") || 0) : null;   // the harbour's water level (as the weather layer reads it)
    const scene = { ways, waterY: tideY, place: pj, geo, variant, hour: g.clock ? (g.clock() / 60) % 24 : 23, era: eraOf(g), terms: { rain: term("rain"), fog: term("fog"), wind: term("wind") }, figures: S.figs, crowd: S.crowd || null, fight: fightOf(g, cam), talkFace: talkFaceOf(), blot: document.querySelector("canvas.inkblot"), darkness: cam.darkness ? cam.darkness() : 0, kinds: byId };
    const W = Math.round(host.clientWidth), H = Math.round(host.clientHeight);
    const tu = performance.now(); const ui = collectUi(document.body, glyph.opts.cw, glyph.opts.ch); ui.readback = /readback/.test(`${(api.P && api.P.talk && api.P.talk.node) || ""} ${(api.P && api.P.talk && api.P.talk.startId) || ""}`); (globalThis.__lwGlyphStats ||= {}).collectMs = +(performance.now() - tu).toFixed(2);
    ui.hint = `F7 painted   F8 ${(styles.find((st) => st.name === preset) || {}).label || preset}   F9 crt ${glyph.opts.crt ? "on" : "off"}`;
    glyph.renderFrame(scene, { left: view.left, top: view.top, zoom: view.zoom, W, H }, { place: (pj.lights && pj.lights[variant]) || [], lantern }, ui);
  }
  // the wide lens's crowd tier (characters/runtime/crowd.mjs): kept here as well, so glyph mode sets it in type
  if (api.people && api.people.crowd) { const set = api.people.crowd.bind(api.people); api.people.crowd = (c) => { S.crowd = c || null; return set(c); }; }
  S.raf = requestAnimationFrame(frame);
  const dream = installDream({ root: parent, glyph });
  const decals = installDecals({ parent, G, cam: api.cam, isGlyph: () => S.mode === "glyph" });   // painted mode's telegraph decals (paint/decals.mjs)   // the dream look's hook (paint/dream.mjs)
  return { glyph, dream, mode: () => S.mode, stop() { S.stopped = true; cancelAnimationFrame(S.raf); dream.stop(); decals.stop(); window.removeEventListener("keydown", onKey); glyph.stop(); hint.remove(); globalThis.__lwGlyphFigure = null; document.documentElement.classList.remove("look-glyph-ui"); } };
}
export { GLYPH_DEFAULTS };

// the fight in play, for the arena's ground telegraphs in type (glyph/tells.mjs), on the plate camera
function fightOf(G, cam) {
  const C = G && G.ext && G.ext.combat, W = C && C.current && C.current.W; if (!W || W.result || !cam || !cam.toScreen) return null;
  const A = W.field && W.field.arena; return { W, toScreen: (p) => { const s = cam.toScreen([p[0], (A && A.grid && groundAtRef.fn ? groundAtRef.fn(A, p[0], p[2]) : 0) ?? 0, p[2]]); return s ? { x: s[0], y: s[1] } : null; } };
}
// A fight's ways out in screen pixels, the way ui/fightways.mjs chalks them: each arena exit's outline on
// the fight's ground and an arrow from its middle, outward from the fight's middle; hot while Lamb is in it.
function waysOut(G, cam) {
  const C = G && G.ext && G.ext.combat, W = C && C.current && C.current.W; if (!W || W.result || !cam || !cam.toScreen || !groundAtRef.fn) return [];
  const A = W.field && W.field.arena, ex = (A && A.exits) || [], L = W.lamb && W.lamb(); if (!ex.length || !L || !A.grid) return [];
  const b = W.field.bounds, cx = b ? (b.x0 + b.x1) / 2 : 0, cz = b ? (b.z0 + b.z1) / 2 : 0, at = (x, z, y = 0) => cam.toScreen([x, (groundAtRef.fn(A, x, z) ?? 0) + y, z]);
  const out = [];
  for (const [x0, z0, x1, z1] of ex) {
    const corners = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([x, z]) => at(x, z)); if (corners.some((c) => !c)) continue;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, dx = mx - cx, dz = mz - cz, d = Math.hypot(dx, dz) || 1, p0 = at(mx - (dx / d) * 0.4, mz - (dz / d) * 0.4), p1 = at(mx + (dx / d) * 0.6, mz + (dz / d) * 0.6);
    out.push({ corners, arrow: p0 && p1 ? [p0, p1] : null, hot: L.x >= x0 && L.x <= x1 && L.z >= z0 && L.z <= z1 });
  }
  return out;
}
const groundAtRef = { fn: null };
import("../world/plateworld.mjs").then((m) => { groundAtRef.fn = m.groundAt; }).catch((e) => console.warn(`glyph: no ground for the ways out (${e.message})`));
