// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// render4k.mjs: the five elements built for 3840 x 2160 delivery. Two resolutions, stated in every record:
//   drawn at 3840 x 2160   every analytic law: intaglio lines, contours, orbits and bodies, ribbons, tesserae, glyph
//                          masks (rendered from the font outlines at 4K, 2x supersampled), and the composite itself;
//                          every combine() law runs per output pixel
//   simulated at 960 x 540 the fields that need a solver step (tick fronts, frost, fluid, reaction, leaf pigments, heat,
//                          tide deposits, glass height). They enter the composite as continuous fields, reconstructed
//                          bilinearly per output pixel; the laws that act on them act at 4K
// So no finished picture is ever upscaled; a simulated field is sampled where a 4K law needs it.
import * as G from './gen/index.mjs';
import { combine } from './core/combine.mjs';

export const OUT = { w: 3840, h: 2160 }, SIM = { w: 960, h: 540 };

// a simulated layer seen at output resolution: its fields reconstructed bilinearly (law, ink and weights unchanged)
export function lift(L, W = OUT.w, H = OUT.h, cache = {}) {
  const fields = {};
  for (const [key, f] of Object.entries(L.fields)) {
    const C = f.length / L.n; if (key === 'vel') continue;
    const out = (cache[key] ??= new Float32Array(W * H * C)), sx = L.w / W, sy = L.h / H;
    for (let y = 0; y < H; y++) { const gy = Math.min(L.h - 1.001, Math.max(0, (y + 0.5) * sy - 0.5)), j = gy | 0, b = gy - j; for (let x = 0; x < W; x++) { const gx = Math.min(L.w - 1.001, Math.max(0, (x + 0.5) * sx - 0.5)), i = gx | 0, a = gx - i, k = j * L.w + i, o = (y * W + x) * C; for (let c = 0; c < C; c++) out[o + c] = (f[k * C + c] * (1 - a) + f[(k + 1) * C + c] * a) * (1 - b) + (f[(k + L.w) * C + c] * (1 - a) + f[(k + L.w + 1) * C + c] * a) * b; } }
    fields[key] = out;
  }
  return { ...L, w: W, h: H, n: W * H, fields, state: {} };
}

const T = (curves, span) => G.timing.create({ curves, span });
// the transfer measured on the ticks themselves: with ticks two cells apart, a raster of them has empty cells that
// would read as untransferred and inflate the spread (found in the first 4K claim render; measurement corrected)
const tickWeights = L => { const TT = L.state.T; return Float32Array.from({ length: TT.n }, (_, i) => TT.W[i * TT.E + 1]); };

export const BUILDS4K = {
  'claim-under-frost': ({ masks, underTone }) => {
    const { w, h } = OUT, s = SIM, clock = T([{ curve: 'forge', weight: 1, params: { up: 2, peak: 6, tau: 4 } }], 14);
    const under = G.intaglio.create({ w, h, tone: underTone, speed: 0.6, pitch: 16, follow: 0.7, bend: 420, soften: 60 });   // tone from the word set in Accession Divisumma at 4K
    const frost = G.frost.create({ ...s, seeds: [0.12, 0.25, 0.4, 0.55, 0.7, 0.85].map((y, i) => [0.01 + 0.03 * (i % 2), y]), rate: 160, gamma: 0.01, beta: 0.45 });
    const cut = G.unravel.create({ ...s, seeds: [], threshold: 0.2, rate: 3, radius: 2.4, spacing: 2, drive: { heat: 1 } });
    const claim = G.glyph.create({ w, h, word: 'claim', masks, opacity: 0.85, ink: [0.12, 0.2, 0.55] }); claim.name = 'claim';
    const lc = {}, lf = {};
    return { progress: cut, transfer: () => tickWeights(cut), step(dt) { G.timing.step(clock, dt, {}); G.intaglio.step(under, dt, {}); G.frost.step(frost, dt, { timing: clock }); G.unravel.step(cut, dt, { drive: frost }); G.glyph.step(claim, dt, { timing: clock }); },
      compose() { const cutL = lift(cut, w, h, lc).fields.amount; const A = claim.fields.amount; for (let k = 0; k < A.length; k++) A[k] *= 1 - cutL[k]; return combine([under, claim, lift(frost, w, h, lf)], [0.7, 1, 0.8]); },
      control() { const L = cut.state.T.elements[1].law; L.mode = 'global'; L.rate = 0.12; } };
  },
  'tide-palimpsest': () => {
    const { w, h } = OUT, s = SIM, clock = T([{ curve: 'tide', weight: 1, params: { period: 7 } }], 7);
    const tiles = G.mosaic.create({ w, h, text: 'tide', size: 96, grout: 10, speed: 9 });
    const tide = G.dry.create({ ...s, mode: 'tide', width: 0.04, ink: '#2a1a10' }), walk = G.path.create({ ...s, kind: 'loop', speed: 0.05, loop: true, radius: 30 }), slab = G.glass.create({ ...s, shape: 'slab', depth: 36, strike: 0.5 });
    const lt = {}, lg = {};
    return { progress: tiles, transfer: () => tiles.state.laid, step(dt) { G.timing.step(clock, dt, {}); G.mosaic.step(tiles, dt, {}); G.dry.step(tide, dt, { timing: clock }); G.path.step(walk, dt, {}); G.glass.step(slab, dt, { drive: walk }); },
      compose() { const gl = lift(slab, w, h, lg); gl.weights = { ...slab.weights, depth: slab.weights.depth * 4 }; return combine([tiles, lift(tide, w, h, lt), gl], [1, 1, 1]); },
      control() { tiles.weights.global = true; } };
  },
  'forge-leaf': () => {
    const { w, h } = OUT, s = SIM, beat = T([{ curve: 'heartbeat', weight: 1, params: { bpm: 54 } }], 6), walk = G.path.create({ ...s, kind: 'sweep', speed: 0.07, radius: 38, wake: 0.25 });
    const fire = G.heat.create({ ...s, peak: 1900, q: 3400, tau: 2.2, kappa: 1.4 }), leaf = G.leaf.create({ ...s, kc: 0.012, margin: 3, driveGain: 14 }), eye = G.contour.create({ w, h, count: 44, width: 2.2, speed: 0.25 });
    let cross = false; const ll = {}, lh = {};
    return { progress: leaf, transfer: () => Float32Array.from(leaf.state.C, (c, k) => (leaf.state.mask[k] > 0.5 ? 1 - c / leaf.state.mask[k] : -1)),
      step(dt) { G.timing.step(beat, dt, {}); G.path.step(walk, dt, {}); G.heat.step(fire, dt, { source: walk }); G.leaf.step(leaf, dt, cross ? {} : { drive: fire }); G.contour.step(eye, dt, { timing: beat }); },
      compose() { return combine([lift(leaf, w, h, ll), eye, lift(fire, w, h, lh)], [1, 0.22, 0.7]); },
      control() { cross = true; leaf.weights.margin = 0; leaf.weights.veins = 0; leaf.state.edge.fill(1); leaf.weights.kc = 0.12; } };
  },
  'signal-orbits': ({ features }) => {
    const { w, h } = OUT, s = SIM, clock = G.soundclock.create({ features });
    const orb = G.orbit.create({ w, h, orbits: 4, bodyR: 70, line: 2.2, dot: 40 }); orb.timing = clock; orb.name = 'orbit';
    const sig = G.ribbon.create({ w, h, kind: 'circle', r0: 30, gain: 120, flow: 0.18, discs: 260 }); sig.name = 'ribbon';
    const eye = G.contour.create({ w, h, count: 30, width: 3 }); eye.name = 'eye';
    const shift = G.front.create({ ...s, seeds: [[0.5, 0.5]], seedRadius: 16, threshold: 0.12, rate: 1.4, radius: 2.4, spacing: 2, from: ['orbit', 'ribbon'], to: ['eye'] }); shift.name = 'shift';
    const ls = {};
    return { progress: shift, transfer: () => tickWeights(shift), step(dt) { G.soundclock.step(clock, dt, {}); G.orbit.step(orb, dt, {}); G.front.step(shift, dt, {}); G.ribbon.step(sig, dt, { timing: clock }); G.contour.step(eye, dt, { timing: clock }); },
      compose() { const sh = lift(shift, w, h, ls); sh.name = 'shift'; sh.law = shift.law; return combine([orb, sig, eye, sh], [1, 1, 1, 1]); },
      control() { const L = shift.state.T.elements[1].law; L.mode = 'global'; L.rate = 0.06; } };
  },
  'coral-under-lens': () => {
    const { w, h } = OUT, s = SIM, walk = G.path.create({ ...s, kind: 'spiral', speed: 0.06, radius: 22 }), water = G.advect.create({ ...s, stir: 0.9, pour: 0.5, kappa: 0.32, ink: '#2a4a5a' });
    const coral = G.rd.create({ ...s, preset: 'coral', seedSpots: 1, ink: '#5a1f2a', sub: 16 }), lens = G.glass.create({ ...s, shape: 'lens', abbe: 32, depth: 34 });
    let cross = false; const lw = {}, lc = {}, ln = {};
    return { progress: coral, transfer: () => coral.fields.amount, step(dt) { G.path.step(walk, dt, {}); G.advect.step(water, dt, { source: walk, flow: walk }); G.rd.step(coral, dt, { source: walk, flow: water }); if (cross) { const A = coral.fields.amount; let m = 0; for (const v of A) m += v / A.length; A.fill(m); } G.glass.step(lens, dt, {}); },
      compose() { const gl = lift(lens, w, h, ln); gl.weights = { ...lens.weights, depth: lens.weights.depth * 4 }; return combine([lift(water, w, h, lw), lift(coral, w, h, lc), gl], [0.6, 0.75, 1]); },
      control() { cross = true; } };
  },
};
