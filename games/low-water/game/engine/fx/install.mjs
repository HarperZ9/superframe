// The effects in the game: one canvas over the painting (painted form, paint.mjs) and one over the type (glyph form,
// glyph.mjs), fed each frame from the light model's scene (light/install.mjs), the figures on the people layer and Lamb.
// Runs only where the light model is built (the Quota's plates by default). Settings: ?fx=off|low|high (quality),
// ?fxflicker=full|reduced|off and ?fxmotion=full|reduced (accessibility, also set on the light model's flicker),
// ?fxonly=snowfall,fire,... Stats on globalThis.__lwFx.stats (ms a frame, primitives, marks).
//   const X = installFx(ctx, host, api, { before }); X.stop()
import { fxContext, runEffects, fxSettings } from "./core.mjs";
import "./weather.mjs";
import "./fire.mjs";
import "./ground.mjs";
import "./decay.mjs";
import "./combat.mjs";
import "./dream.mjs";
import "./shafts.mjs";
import "./water.mjs";
import "./fog.mjs";
import { paintCanvas } from "./paint.mjs";
import { glyphMarks, drawMarks } from "./glyph.mjs";
import { installTiltShift } from "./tiltshift.mjs";

const FLICKER_K = { full: 1, reduced: 0.3, off: 0 };
export function installFx(ctx, host, api, { before = null } = {}) {
  let saved = {}; try { saved = JSON.parse(localStorage.getItem("lw.fx") || "{}"); } catch { /* a per-viewer convenience only */ }
  const set = fxSettings(ctx.q, saved), mk = (z) => { const c = document.createElement("canvas"); c.className = "fxcanvas"; c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`; if (before && before.parentNode === host && z === "") host.insertBefore(c, before); else host.append(c); return c; };
  // three canvases: the static layers (lying snow: redrawn only when the view moves), the moving marks, and the type;
  // a canvas not in use is hidden, so the browser composites only what shows
  const staticC = mk(""), paintC = mk(""), glyphC = mk("4"), S = { raf: 0, stopped: false, prev: null, place: "", viewKey: "", dirty: { p: false, g: false }, stats: { ms: 0, prims: 0, marks: 0, frames: 0 } };
  const term = (k) => { try { return +ctx.G.env.term(k, ctx.G.state.place) || 0; } catch { return 0; } };
  function figures() {
    const out = []; try { for (const f of api.people.figures(true)) out.push({ id: f.who, at: f.at, facing: f.face || 0 }); } catch { /* no people layer yet */ }
    const p = ctx.G && ctx.G.state && ctx.G.state.pos; if (p) out.push({ id: "lamb", at: p, facing: api.people && api.people.facing ? api.people.facing() : 0 });
    return out;
  }
  function frame() {
    if (S.stopped) return; S.raf = requestAnimationFrame(frame);
    const L = globalThis.__lwLightModel, scene = L && L.ready() ? L.scene : null, view = api.cam.frameNow && api.cam.frameNow();
    const W = host.clientWidth, H = host.clientHeight; for (const c of [staticC, paintC, glyphC]) if (c.width !== W || c.height !== H) { c.width = W; c.height = H; S.viewKey = ""; }
    const glyphOn = !!(api.renderers && api.renderers.mode && api.renderers.mode() === "glyph"), on = !!scene && !!view && set.quality !== "off";
    staticC.hidden = paintC.hidden = !on || glyphOn; glyphC.hidden = !on || !glyphOn;
    if (S.dirty.p && (!on || glyphOn)) { paintC.getContext("2d").clearRect(0, 0, W, H); staticC.getContext("2d").clearRect(0, 0, W, H); S.dirty.p = false; S.viewKey = ""; }
    if (S.dirty.g && (!on || !glyphOn)) { glyphC.getContext("2d").clearRect(0, 0, W, H); S.dirty.g = false; }
    if (!on) return;
    const t0 = performance.now(), pj = scene.M.place; scene.M.flickerK = FLICKER_K[set.flicker];
    if (pj.place !== S.place) { S.prev = null; S.place = pj.place; S.viewKey = ""; }
    const fx = fxContext({ M: scene.M, F: scene.F, pj, t: performance.now() / 1000, figures: figures(), wind: Math.min(1.2, 0.2 + term("wind")), prev: S.prev });
    const r = runEffects(fx, set); S.prev = fx;
    const layers = r.prims.filter((p) => p.k === "layer"), marks = r.prims.filter((p) => p.k !== "layer");
    if (!glyphOn) {
      const vk = `${view.left.toFixed(2)},${view.top.toFixed(2)},${view.zoom.toFixed(4)},${layers.length}`;
      if (vk !== S.viewKey) { const g = staticC.getContext("2d"); g.clearRect(0, 0, W, H); paintCanvas(g, layers, view); S.viewKey = vk; }
      const g = paintC.getContext("2d"); g.clearRect(0, 0, W, H); paintCanvas(g, marks, view); S.dirty.p = true;
    } else {
      const gs = api.renderers.glyph.state.grid, g = glyphC.getContext("2d"); g.clearRect(0, 0, W, H);
      if (gs) { const grid = { ...gs, left: view.left, top: view.top, z: view.zoom }, m = glyphMarks(r.prims, grid); drawMarks(g, m, grid, api.renderers.glyph.opts.font); S.stats.marks = m.length; }
      S.dirty.g = true;
    }
    S.stats.ms = +(performance.now() - t0).toFixed(2); S.stats.prims = r.prims.length; S.stats.frames++; S.stats.byEffect = r.ms;
  }
  S.raf = requestAnimationFrame(frame);
  // the tilt-shift lens on the plate (fx/tiltshift.mjs; ?tilt=off turns it off)
  let tilt = null; try { tilt = installTiltShift(ctx, host, api); } catch (e) { console.warn(`tiltshift: ${e.message}`); }
  const api2 = { settings: set, stats: S.stats, tilt, stop() { S.stopped = true; cancelAnimationFrame(S.raf); staticC.remove(); paintC.remove(); glyphC.remove(); if (tilt) tilt.stop(); } };
  globalThis.__lwFx = api2; return api2;
}
