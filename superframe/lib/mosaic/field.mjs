// lib/mosaic/field.mjs: a marks field as a medium element with weights and timing (CORE.md, "Marks"; BLEED sections
// 11 to 15). Every cell is a tick (the creation engine's core tick model) carrying a weight vector over mark laws,
// for example blue noise 1.0 and code 0.0. A law grows across the cells by its own automaton, driven by a grid that
// anything can supply (the top view's pigment, living type's progress, a tone), so a change of law runs as a front,
// cell by cell, never a crossfade. Each law may carry a timing layer (lib/medium/timing.mjs) that sets its pace.
//   const F = marksField({ cols, rows, laws: ['blue', 'code'], law: { ...automaton }, timing: { code: [layers] } })
//   F.drive(grid, w, h)  resample any 0..1 grid (y down) to the cells as the drive
//   F.fromTopView(weights)   the top view's weights(): its pigment and pours, normalised, as the drive
//   F.step(dt)  F.weights(e)  F.measure(e, prev)
//   F.render(ink, W, H, ctx) -> Float32Array coverage: per cell, the law picked by its weights (a stable per-cell
//   hash against the cumulative weights), each law's marks computed once per call. ctx: { cw, ch, ramp, atlas,
//   corpus, n, cell, angle }
import { tickField, stepTicks, rasterTicks, measureTicks } from '../../../creation/lib/core/ticks.mjs';
import { progress } from '../medium/timing.mjs';
import { marks, LAWS } from './marks.mjs';
import { asciiField, drawField } from './glyphs.mjs';
import { codeMosaic } from './codemosaic.mjs';

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const FIELD_LAWS = Object.freeze([...Object.keys(LAWS), 'ascii', 'code']);

export function marksField({ cols, rows, laws = ['blue', 'code'], start = 0, law = {}, timing = {} } = {}) {
  for (const l of laws) if (!FIELD_LAWS.includes(l)) throw new Error(`marksField: no law "${l}" (one of ${FIELD_LAWS.join(', ')})`);
  const elements = laws.map((name, i) => ({ name, law: i === 0 ? null : { radius: 1.6, threshold: 0.55, softness: 0.08, rate: 1.4, mode: 'lenia', drive: { heat: 1 }, ...law } }));
  const T = tickField({ w: cols, h: rows, elements, spacing: 1, jitter: 0, start });
  let grid = new Float32Array(cols * rows), clock = 0;
  const F = {
    T, cols, rows, laws,
    drive(src, w = cols, h = rows) {
      grid = new Float32Array(cols * rows);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) grid[r * cols + c] = Math.min(1, Math.max(0, src[Math.min(h - 1, Math.floor((r + 0.5) * h / rows)) * w + Math.min(w - 1, Math.floor((c + 0.5) * w / cols))]));
      return F;
    },
    fromTopView(wt) { const n = wt.w * wt.h, g = new Float32Array(n); let mx = 1e-9; for (let i = 0; i < n; i++) { g[i] = (wt.P?.[i] ?? 0) + wt.A[i] + wt.B[i]; if (g[i] > mx) mx = g[i]; } for (let i = 0; i < n; i++) g[i] /= mx; return F.drive(g, wt.w, wt.h); },
    // a law's timing layer scales its rate by the pace of its own clock (the first derivative of its progress)
    step(dt) {
      clock += dt;
      for (let e = 1; e < laws.length; e++) { const L = timing[laws[e]]; if (L) elements[e].law.rate = (law.rate ?? 1.4) * Math.max(0.05, 4 * (progress(L, clock + 0.05) - progress(L, clock)) / 0.05); }   // pace 1 = linear over 4 s
      stepTicks(T, dt, { still: true, drive: grid }); return F;
    },
    weights: e => rasterTicks(T, e),
    measure: (e = laws.length - 1, prev = null) => measureTicks(T, e, prev),
    render(ink, W, H, ctx = {}) {
      const cw = Math.max(1, Math.floor(W / cols)), ch = Math.max(1, Math.floor(H / rows)), byLaw = new Map();
      const of = (name) => {
        if (byLaw.has(name)) return byLaw.get(name);
        let r;
        if (name === 'ascii') r = drawField(asciiField(ink, W, H, { cw: ctx.cw ?? 10, ch: ctx.ch ?? 16, ramp: ctx.ramp }), W, H, ctx.atlas);
        else if (name === 'code') r = codeMosaic(ink, W, H, { cw: ctx.cw ?? 10, ch: ctx.ch ?? 16, corpus: ctx.corpus }).coverage;
        else r = marks(name, ink, W, H, ctx);
        byLaw.set(name, r); return r;
      };
      const out = new Float32Array(W * H), E = laws.length;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const i = r * cols + c, u = hash(c, r); let acc = 0, e = 0;
        for (; e < E - 1; e++) { acc += T.W[i * E + e]; if (u < acc) break; }
        const src = of(laws[e]);
        for (let y = r * ch; y < Math.min(H, (r + 1) * ch); y++) for (let x = c * cw; x < Math.min(W, (c + 1) * cw); x++) out[y * W + x] = src[y * W + x];
      }
      return out;
    },
  };
  return F;
}
