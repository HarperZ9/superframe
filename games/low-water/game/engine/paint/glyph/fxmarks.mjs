// The effects layer's marks in the glyph renderer's own cells (the light lead's effects, game/engine/fx/: one
// description, two forms). Where the light model is built, the effects are run here from the same scene and their
// glyph form (fx/glyph.mjs glyphMarks) is written straight into the frame's cells after the world, under the figures,
// so a flake or a print is type in the grid, not a mark on a dark box over it. Glyph chooses its own glyphs per kind:
//   flake     . ' * by size, its brightness the air's light (fx/core.mjs airLight): seen only in the light
//   print     , a darker stroke in the lit snow       lie (lying snow)  left to the world's snow cover (compose.mjs)
//   puff, smoke, steam, soot   the sparse smoke marks     flame, ember, spark   bright, kept warm by the era grade
// When no model is built (Low Water's plates), glyph/snowfall.mjs stands in. Original code.
//   const X = makeFxMarks(atlas); X.draw(scene, grid, out) -> marks written (null when the effects did not run)
import { fxContext, runEffects, fxSettings } from "../../fx/core.mjs";
import "../../fx/weather.mjs";
import "../../fx/fire.mjs";
import { glyphMarks } from "../../fx/glyph.mjs";

const GLYPH = { flake: (m) => (m.ch === "*" ? "*" : m.a > 0.6 ? "'" : "."), print: () => ",", puff: () => "~", smoke: () => ":", steam: () => "o", soot: () => "%", flame: (m) => m.ch, ember: () => "*", spark: () => "'", frost: () => "+", mote: () => ".", haze: () => "~" };
const enc = (x) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.2));

export function makeFxMarks(atlas) {
  let prev = null, place = "";
  const settings = () => (globalThis.__lwFx && globalThis.__lwFx.settings) || fxSettings(null, {});
  function prims(scene, L) {
    const sc = L.scene, pj = sc.M.place; if (pj.place !== place) { prev = null; place = pj.place; }
    const figures = (scene.figures || []).filter((F) => F.joints && F.joints[1]).map((F) => ({ id: F.id || F.who, at: F.joints[1], facing: F.face || 0 }));
    const fx = fxContext({ M: sc.M, F: sc.F, pj, t: performance.now() / 1000, figures, wind: Math.min(1.2, 0.2 + ((scene.terms && scene.terms.wind) || 0)), prev });
    const r = runEffects(fx, settings()); prev = fx; return r.prims;
  }
  function write(m, out, cols, atlas) {
    const i = m.r * cols + m.c; if (out.EM[i] > 100 || (out.HOT && out.HOT[i])) return false;
    const g = (GLYPH[m.k] || (() => m.ch))(m);
    if (m.k === "lie") return false;
    if (m.k === "print" || m.k === "soot" || m.k === "smoke") { out.G[i] = atlas.index(g); for (let c = 0; c < 3; c++) out.FG[i * 3 + c] = Math.round(out.BG[i * 3 + c] * (1 - 0.5 * m.a) + enc(m.rgb[c]) * 0.5 * m.a); return true; }
    out.G[i] = atlas.index(g); for (let c = 0; c < 3; c++) out.FG[i * 3 + c] = Math.max(out.FG[i * 3 + c] * (1 - m.a), enc(m.rgb[c]) * Math.max(0.45, m.a));
    if (m.k === "flame" || m.k === "ember" || m.k === "spark") out.EM[i] = Math.max(out.EM[i], 120);
    return true;
  }
  return {
    draw(scene, grid, out) {
      const L = globalThis.__lwLightModel; if (!L || !L.ready || !L.ready() || !L.scene || L.scene.M.place.place !== grid.C.pj.place) return null;
      const s = settings(); if (s && s.quality === "off") return null;
      const marks = glyphMarks(prims(scene, L), { left: grid.left, top: grid.top, z: grid.z, ox: grid.ox, oy: grid.oy, cw: grid.cw, ch: grid.ch, cols: grid.cols, rows: grid.rows });
      let n = 0; for (const m of marks) if (write(m, out, grid.cols, atlas)) n++;
      return n;
    },
  };
}
