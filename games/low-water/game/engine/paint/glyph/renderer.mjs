// The Glyph renderer: renderFrame(scene, camera, lights, ui) draws the game from the scene into the
// character grid (design/GLYPH-PIPELINE.md, design/art/GLYPH-LANGUAGE.md). It reads no other renderer's output.
//   const R = createGlyphRenderer({ parent, before, kinds }); R.renderFrame(scene, camera, lights, ui); R.show(on); R.stop()
// scene:  { place (place.json), geo: { pos, ids }, variant, hour, era, terms: { rain, fog, wind, snow }, figures: [...],
//           crowd: [{ at, face, walk }] | null, talkFace: { who, face } | null, blot: the ink-blot mask canvas | null, darkness }
// camera: { left, top, zoom, W, H }   lights: { place: [...], lantern: [x, y, z] | null }   ui: the panels (ui.mjs)
// The light comes from the shared light model (glyph/lightmodel.mjs); the era's palette grades the frame
// before the panels are set (glyph/eras.mjs). Original code.
import { buildAtlas } from "./atlas.mjs";
import { sceneCells } from "./cells.mjs";
import { bakeLight, addLantern } from "./light.mjs";
import { makeComposer } from "./compose.mjs";
import { makeRaster } from "./raster.mjs";
import { makeGpuRaster } from "./gpu.mjs";
import { drawFigures } from "./figures.mjs";
import { drawCrowd } from "./crowd.mjs";
import { makeEffects } from "./effects.mjs";
import { drawUi } from "./ui.mjs";
import { LANG } from "./materials.mjs";
import { measureLegibility } from "./legibility.mjs";
import { applyGlow } from "./glow.mjs";
import { drawMarks } from "./marks.mjs";
import { drawBlot } from "./blot.mjs";
import { drawArenaTells } from "./tells.mjs";
import { reflect } from "./water.mjs";
import { glyphLight } from "./lightmodel.mjs";
import { gradeFrame } from "./eras.mjs";
import { makeSmoke } from "./smoke.mjs";
import { makeSnowfall } from "./snowfall.mjs";
import { makeFxMarks } from "./fxmarks.mjs";
import { modelCells, adaptOf, dayness } from "./modellight.mjs";

export const GLYPH_DEFAULTS = { cw: 8, ch: 12, font: '12px "LW Conso", Consolas, monospace', palette: "full", exposure: 0.9, hyst: 0.35, edges: true, motif: true, floor: 1, glow: false, fog: true, light: true, figures: true, effects: true, crt: false, bloom: 0.4, halation: 0.18, weight: true };

function makeCanvas(parent, before) {
  const c = document.createElement("canvas"); c.className = "glyphframe"; c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none";
  if (before && before.parentNode === parent) parent.insertBefore(c, before); else parent.append(c);
  return c;
}
// cellScale: the cell in screen pixels times this (4K: 2, so a 4K screen shows the same grid of type as 1080p)
function scaled(o) {
  if (!o.cellScale || o.cellScale === 1) return o;
  const k = o.cellScale; return { ...o, cw: Math.round(GLYPH_DEFAULTS.cw * k), ch: Math.round(GLYPH_DEFAULTS.ch * k), font: o.font.replace(/(\d+(?:\.\d+)?)px/, (_, n) => `${(+n * k).toFixed(1)}px`) };
}
// per place, variant, zoom and era: the cells, the static light (tinted by the era's sky), the hysteresis levels
function preparer(o, S, raster, kinds) {
  return function prepare(scene, zq, model) {
    const pj = scene.place, key = `${pj.place}|${scene.variant}|${zq}|${model.era}`;
    if (key === S.key) return;
    const t0 = performance.now();
    const C = sceneCells({ pj, pos: scene.geo.pos, ids: scene.geo.ids, cw: o.cw, ch: o.ch, zoom: zq }); C.pj = pj; C.ppm = pj.pxPerMetre || 80;
    const hour = (pj.variantInfo && pj.variantInfo[scene.variant] && pj.variantInfo[scene.variant].hour) ?? scene.hour ?? 23;
    S.C = C; S.E = bakeLight(C, { lights: scene.lightsPlace || [], hour, kinds, tint: model.look.sky }); S.Edyn = new Float32Array(S.E.length); S.levels = new Uint8Array(C.nI * C.nJ).fill(255);
    S.key = key; S.prev = null; S.hour = hour; S.modelKey = null; S.lightFrom = "own"; raster.reset();
    o.adapt = o.adaptClock === false ? 1 : Math.round(adaptOf(S.E, hour) * 50) / 50; o.lightGen = (o.lightGen || 0) + 1;
    S.stats.bakeMs = +(performance.now() - t0).toFixed(1);
  };
}
// the shared light model's cells for the clock, when it is ready for this place (glyph/modellight.mjs): the
// renderer's light swapped for the model's, the exposure adapted to it at the clock's hour, the cells composed again
function takeModelLight(S, o, scene) {
  if (o.modelLight === false) return;
  S.expose = o.expose || "glyph"; const ME = modelCells(S, scene); if (!ME || ME === S.E) return;
  S.E = ME; S.Edyn = new Float32Array(ME.length); S.lastTouched = null; S.levels.fill(255); S.lightFrom = "model";
  o.adapt = o.adaptClock === false || S.expose === "light" ? 1 : Math.round(adaptOf(ME, scene.hour ?? S.hour) * 50) / 50; o.lightGen = (o.lightGen || 0) + 1;
  // at night the floor carries the form: contours and faint texture raised as the day goes (the light stays dark)
  o.halftone = o.halftoneNight !== false && dayness(scene.hour ?? S.hour) < 0.5;   // the halftone falloff at night (compose.mjs)
  o.floorK = o.adaptClock === false ? 1 : +(1 + NIGHT_FLOOR * (1 - dayness(scene.hour ?? S.hour))).toFixed(2);   // a multiplier: a floor set to 0 stays 0
}
const NIGHT_FLOOR = 1.2;
// the grid: world cells from the one under the screen's corner; their screen place from the true zoom
function gridOf(S, o, camera) {
  const C = S.C, z = camera.zoom, I0 = Math.floor(camera.left / C.pw), J0 = Math.floor(camera.top / C.ph), ox = Math.round((I0 * C.pw - camera.left) * z), oy = Math.round((J0 * C.ph - camera.top) * z);
  const cols = Math.ceil((camera.W - ox) / o.cw) + 1, rows = Math.ceil((camera.H - oy) / o.ch) + 1;
  return { I0, J0, cols, rows, ox, oy, cw: o.cw, ch: o.ch, z, left: camera.left, top: camera.top, C, W: camera.W, H: camera.H };
}
function frameBuffers(S, n) {
  const out = S.buf && S.buf.n === n && S.buf.HOT ? S.buf : (S.buf = { n, G: new Int16Array(n), FG: new Uint8ClampedArray(n * 3), BG: new Uint8ClampedArray(n * 3), EM: new Uint8Array(n), T: new Uint8Array(n), HOT: new Uint8Array(n) });   // T: the tone map (glyph/tonemap.mjs); HOT: cells the grade leaves alone
  out.HOT.fill(0); return out;
}
// the world: light (the bake and the carried lantern), composed cells, the glow
function composeWorld(ctx, scene, lights, grid, out, model) {
  const { S, o, compose } = ctx, lit = o.light && o.lantern !== false && lights.lantern;
  const E = lit ? addLantern(grid.C, S.E, lights.lantern, S.Edyn) : S.E;
  const dirty = lit ? [...(S.lastTouched || []), ...(S.Edyn.__touched || [])] : S.lastTouched || null; S.lastTouched = lit ? [...(S.Edyn.__touched || [])] : null;
  const fogT = Math.min(1, 0.25 + (scene.terms.fog || 0) * 1.5), C = grid.C;
  Object.assign(o, { snow: model.snow || 0, decay: o.decayOverride ?? (scene.decay ?? model.look.decay ?? 0), era: model.era });
  compose({ dirty, C, E, levels: S.levels, I0: grid.I0, J0: grid.J0, cols: grid.cols, rows: grid.rows, palette: o.palette, opts: o, focus: (C.depth[Math.floor(C.nJ / 2) * C.nI + Math.floor(C.nI / 2)] || 70), fog: { near: 4, far: 40, k: fogT, col: model.sky.amb.map((v) => v * 3) } }, out);
  if (o.glow && o.light) applyGlow(out, grid.cols, grid.rows, grid.cw, grid.ch);   // layered glow round lamps and lit type (glyph/glow.mjs)
  return E;
}
// people, crowds, water, smoke, marks and effects over the world; the masks the measures ask for
function drawScene(ctx, scene, grid, out, model) {
  const { S, o, atlas, fx, smoke } = ctx, n = grid.cols * grid.rows;
  if (o.effects) fx.before(scene, grid, out, o);
  const masks = !!globalThis.__lwGlyphMasks, G0 = masks ? out.G.slice() : null;   // the measures ask which cells figures and panels set
  out.figOcc = new Map(); out.figPart = new Map();
  // the effects layer's marks in the grid's own cells where the light model runs (glyph/fxmarks.mjs); else glyph's own snow
  S.fxCells = o.fx !== false ? ctx.fxm.draw(scene, grid, out) : null;
  if (S.fxCells == null && o.snowfall !== false) { ctx.snowfall.prints(scene, scene.figures); S.snowCells = ctx.snowfall.draw(scene, grid, out, model); }   // snow in the light, prints in the pools (glyph/snowfall.mjs)
  if (o.figures && scene.crowd) S.crowdDrawn = drawCrowd(scene.crowd, grid, out, atlas, model);   // the wide lens's crowd tier in type (glyph/crowd.mjs)
  if (o.figures && scene.figures) drawFigures(scene.figures, grid, out, atlas, o, scene, model);
  if (masks) { S.figMask = new Uint8Array(n); for (let i = 0; i < n; i++) if (out.G[i] !== G0[i]) S.figMask[i] = 1; }
  if (o.reflect !== false) S.reflected = reflect(grid, out, atlas, scene, performance.now() / 1000);   // water mirrors the frame above it (glyph/water.mjs)
  if (o.smoke !== false) smoke(scene, grid, out);   // smoke and steam in sparse type (glyph/smoke.mjs)
  S.marks = drawMarks(scene.ways, grid, out, atlas);   // a fight's ways out, in type (glyph/marks.mjs)
  S.tells = scene.fight ? drawArenaTells(scene.fight.W, scene.fight.toScreen, grid, out, atlas) : 0;   // the arena's ground telegraphs (glyph/tells.mjs)
  if (o.effects) fx.after(scene, grid, out, o);
  gradeFrame(out, n, model.look, out.HOT);   // the era's palette (glyph/eras.mjs); hot marks keep their colour
  return masks;
}
// the panels in the grid, then the ink blot over everything (a transition covers the panels too)
function drawOver(ctx, scene, ui, grid, out, masks) {
  const { S, o, atlas } = ctx, n = grid.cols * grid.rows, G1 = masks ? out.G.slice() : null, B1 = masks ? out.BG.slice() : null;
  if (ui) { drawUi(ui, grid, out, atlas, o, scene); S.ui = { placed: ui.placed, left: ui.left }; }
  if (masks) for (let i = 0; i < n; i++) if (out.G[i] !== G1[i] || out.BG[i * 3] !== B1[i * 3]) S.figMask[i] = 2;   // panels: screen-fixed, not world
  S.blot = drawBlot(scene.blot, grid, out, atlas);   // the ink-blot transition in type (glyph/blot.mjs)
}
// the pan as a whole-pixel shift of last frame's pixels; a cell keeps its pixels when its key is unchanged
function rasterise(ctx, grid, out) {
  const { S, o, gpu, raster, canvas } = ctx, { I0, J0, ox, oy, cols, rows, W, H, z, cw } = grid, P = S.prev;
  const sx = P ? ox - I0 * cw - (P.ox - P.I0 * cw) : 0, sy = P ? oy - J0 * grid.ch - (P.oy - P.J0 * grid.ch) : 0;
  const prevKey = P && Math.abs(z - P.z) < 1e-6 ? (x, y, prev) => { const px = x + I0 - P.I0, py = y + J0 - P.J0; return px >= 0 && py >= 0 && px < prev.cols && py < prev.rows ? prev.keys[py * prev.cols + px] : -1; } : null;
  const fx = { bloom: o.light ? o.bloom : 0, halation: o.light ? o.halation : 0, crt: o.crt };
  let R;
  if (gpu) { R = gpu.draw({ ...out, cols, rows, ox, oy, W, H, ...fx }); R.drawn = cols * rows; S.stats.gpuMs = R.gpuMs == null ? null : +R.gpuMs.toFixed(3); }
  else { R = raster.draw({ ...out, cols, rows, ox, oy, W, H, shiftX: P && prevKey ? sx : 0, shiftY: P && prevKey ? sy : 0, prevKey, ...fx }); canvas.getContext("2d").putImageData(R.img, 0, 0); }
  S.prev = { I0, J0, ox, oy, z };
  return R;
}

export function createGlyphRenderer({ parent, before = null, kinds, opts = {} }) {
  const o = scaled({ ...GLYPH_DEFAULTS, ...opts });
  let canvas = makeCanvas(parent, before);
  const extra = Object.values(LANG).map((L) => L.ramp).join("") + "*#=^io~{}%&@0Ob d<>";
  const atlas = buildAtlas({ cw: o.cw, ch: o.ch, font: o.font, extra }), raster = makeRaster(atlas);
  // the raster on the GPU when WebGL2 is there (o.gpu false or ?glyph=cpu keeps the CPU reference)
  let gpu = null;
  if (o.gpu !== false) { try { gpu = makeGpuRaster(canvas, atlas); } catch (e) { console.warn(`glyph: GPU raster unavailable (${e.message}); CPU raster`); gpu = null; } if (!gpu) { canvas.remove(); canvas = makeCanvas(parent, before); } }
  const S = { key: "", C: null, E: null, Edyn: null, levels: null, prev: null, stats: {} };
  const ctx = { S, o, atlas, raster, gpu, compose: makeComposer(kinds, atlas), fx: makeEffects(atlas), smoke: makeSmoke(atlas), snowfall: makeSnowfall(atlas), fxm: makeFxMarks(atlas), get canvas() { return canvas; } };
  const prepare = preparer(o, S, raster, kinds);
  return {
    get canvas() { return canvas; }, atlas, opts: o, state: S,
    measure: () => measureLegibility(S, atlas),   // the plate's legibility in the last frame (glyph/legibility.mjs)
    // another light for the cells (a light-cell array as bakeLight returns, e.g. light/consume.mjs cellsFromField), with the
    // exposure adapted to it at the hour: for harnesses that light the renderer from outside the game
    setLight(E, hour) { S.E = E; S.Edyn = new Float32Array(E.length); S.lastTouched = null; if (S.levels) S.levels.fill(255); S.prev = null; S.lightFrom = "set"; o.adapt = o.adaptClock === false ? 1 : Math.round(adaptOf(E, hour ?? S.hour ?? 23) * 50) / 50; o.lightGen = (o.lightGen || 0) + 1; },
    show(on) { canvas.hidden = !on; if (!on) { S.prev = null; raster.reset(); } },
    renderFrame(scene, camera, lights, ui) {
      if (canvas.hidden || !scene || !scene.place || !scene.geo) return null;
      const t0 = performance.now(), zq = Math.round(camera.zoom * 20) / 20;
      if (canvas.width !== camera.W || canvas.height !== camera.H) { canvas.width = camera.W; canvas.height = camera.H; raster.reset(); S.prev = null; }
      scene.lightsPlace = lights.place; scene.lantern = lights.lantern; const model = glyphLight(scene); S.model = model;
      prepare(scene, zq, model); takeModelLight(S, o, scene);
      const grid = gridOf(S, o, camera), out = frameBuffers(S, grid.cols * grid.rows);
      grid.E = composeWorld(ctx, scene, lights, grid, out, model); const tc1 = performance.now();
      S.grid = { I0: grid.I0, J0: grid.J0, cols: grid.cols, rows: grid.rows, ox: grid.ox, oy: grid.oy, cw: o.cw, ch: o.ch }; S.stats.frame = (S.stats.frame || 0) + 1;
      const masks = drawScene(ctx, scene, grid, out, model), tu0 = performance.now();
      drawOver(ctx, scene, ui, grid, out, masks); const tR = performance.now();
      S.stats.parts = { compose: +(tc1 - t0).toFixed(2), scene: +(tu0 - tc1).toFixed(2), ui: +(tR - tu0).toFixed(2) };
      const R = rasterise(ctx, grid, out);
      S.stats.rasterMs = +(performance.now() - tR).toFixed(2); S.stats.raster = gpu ? "gpu" : "cpu";
      Object.assign(S.stats, { ms: +(performance.now() - t0).toFixed(2), drawn: R.drawn, cells: grid.cols * grid.rows, figures: (scene.figures || []).length, era: model.era, sharedLight: model.shared, lightFrom: S.lightFrom, adapt: o.adapt });
      (globalThis.__lwGlyphStats ||= {}).ms = S.stats.ms; Object.assign(globalThis.__lwGlyphStats, S.stats);
      return out;
    },
    // a frame with no place to draw (a place still to be baked, as the Quota's are): the panels alone on the
    // night ground, so the interface never goes dark with the plate (the UI art lead's, 2026-10-21)
    renderUi(camera, ui) {
      if (canvas.hidden) return null;
      const W = camera.W, H = camera.H; if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; raster.reset(); }
      const cw = o.cw, ch = o.ch, cols = Math.ceil(W / cw) + 1, rows = Math.ceil(H / ch) + 1, n = cols * rows, sp = atlas.index(" ");
      const out = S.buf && S.buf.n === n && S.buf.HOT ? S.buf : (S.buf = { n, G: new Int16Array(n), FG: new Uint8ClampedArray(n * 3), BG: new Uint8ClampedArray(n * 3), EM: new Uint8Array(n), T: new Uint8Array(n) });
      out.G.fill(sp); out.FG.fill(0); out.EM.fill(0); out.T.fill(0); for (let i = 0; i < n; i++) { out.BG[i * 3] = 8; out.BG[i * 3 + 1] = 6; out.BG[i * 3 + 2] = 10; }
      if (ui) { drawUi(ui, { I0: 0, J0: 0, cols, rows, ox: 0, oy: 0, cw, ch, z: 1, W, H }, out, atlas, o); S.ui = { placed: ui.placed, left: ui.left }; }
      const D = { ...out, cols, rows, ox: 0, oy: 0, W, H, bloom: 0, halation: 0, crt: o.crt };
      if (gpu) gpu.draw(D); else canvas.getContext("2d").putImageData(raster.draw({ ...D, shiftX: 0, shiftY: 0, prevKey: null }).img, 0, 0);
      S.prev = null; return out;
    },
    stop() { canvas.remove(); },
  };
}
