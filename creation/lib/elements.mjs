// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// elements.mjs: novel elements made by weighted recombination of three or more generators (BLEED section 16). The
// same module runs in the browser (demo/index.html) and in node (tools/render_elements.mjs), so what is watched is
// what is measured. Each element gives its recipe (generators, weights, roles), its layers in combine order, a step
// function, the layer whose ticks carry its transformation (for the section 13 series), and a failing control.
import * as G from './gen/index.mjs';
import { combine, combineSummary } from './core/combine.mjs';

const T = (curves, span = 8) => G.timing.create({ curves, span });

export const ELEMENTS = {
  'claim-under-frost': {
    title: 'A claim sheet unravels as frost spreads over intaglio lines, on forge timing',
    recipe: [['timing', 'forge curve', 1, 'clock'], ['frost', 'Reiter automaton, screen law', 0.8, 'agent of the change'], ['unravel', 'front driven by the frost', 1, 'transfer'], ['glyph', 'claim in Accession Burin, LINE axis on the forge clock, density_add ink, opacity 0.85', 1, 'what covers'], ['intaglio', 'under: phase-field burin, tone by line, pitch 4.2', 0.7, 'what lies beneath']],
    build({ w, h, atlas }) {
      const clock = T([{ curve: 'forge', weight: 1, params: { up: 2, peak: 6, tau: 4 } }], 14);
      const under = G.intaglio.create({ w, h, text: 'under', speed: 0.6, pitch: 4.2 });
      const frost = G.frost.create({ w, h, seeds: [0.12, 0.25, 0.4, 0.55, 0.7, 0.85].map((y, i) => [0.01 + 0.03 * (i % 2), y]), rate: 40, gamma: 0.01, beta: 0.45 });
      const cut = G.unravel.create({ w, h, seeds: [], threshold: 0.2, rate: 3, drive: { heat: 1 } });
      const claim = atlas ? G.glyph.create({ w, h, word: 'claim', font: 'burin', atlas, opacity: 0.85, ink: [0.12, 0.2, 0.55] }) : G.sheet.create({ w, h, text: 'claim', opacity: 0.92, sheetLaw: 'density_add', ink: '#2a3f8f' });
      claim.name = 'claim'; const base = Float32Array.from(claim.fields.amount);
      return { layers: [under, claim, frost], weights: [0.7, 1, 0.8], progress: cut, transfer: () => cut.fields.amount, step(dt) {
        G.timing.step(clock, dt, {}); G.intaglio.step(under, dt, {}); G.frost.step(frost, dt, { timing: clock }); G.unravel.step(cut, dt, { drive: frost });
        if (claim.gen === 'glyph') G.glyph.step(claim, dt, { timing: clock });
        const src = claim.gen === 'glyph' ? Float32Array.from(claim.fields.amount) : base; for (let k = 0; k < claim.n; k++) claim.fields.amount[k] = src[k] * (1 - cut.fields.amount[k]);
      }, control() { cut.law.params.mode = 'global'; cut.weights.mode = 'global'; cut.state.T.elements[1].law.mode = 'global'; cut.state.T.elements[1].law.rate = 0.12; } };
    },
  },
  'tide-palimpsest': {
    title: 'Tesserae laid in andamento, written over by the tide line, seen through rippled glass',
    recipe: [['timing', 'tide curve', 1, 'clock'], ['mosaic', 'tide, andamento courses, laid in course order', 1, 'the ground'], ['dry', 'tide mode: strandlines where the water dwells', 1, 'the writing over'], ['path', 'a sweep that strikes the glass', 1, 'motion in'], ['glass', 'slab, ripple wave equation, Cauchy dispersion', 1, 'the witness']],
    build({ w, h }) {
      const clock = T([{ curve: 'tide', weight: 1, params: { period: 7 } }], 7), tiles = G.mosaic.create({ w, h, text: 'tide', size: 3.2, speed: 9 });
      const tide = G.dry.create({ w, h, mode: 'tide', width: 0.04, ink: '#2a1a10' }), walk = G.path.create({ w, h, kind: 'loop', speed: 0.05, loop: true, radius: 4 }), slab = G.glass.create({ w, h, shape: 'slab', depth: 9, strike: 0.5 });
      return { layers: [tiles, tide, slab], weights: [1, 1, 1], progress: tiles, transfer: () => tiles.state.laid, step(dt) { G.timing.step(clock, dt, {}); G.mosaic.step(tiles, dt, {}); G.dry.step(tide, dt, { timing: clock }); G.path.step(walk, dt, {}); G.glass.step(slab, dt, { drive: walk }); },
        control() { tiles.weights.global = true; } };
    },
  },
  'forge-leaf': {
    title: 'A leaf turns where the forge heat passes, under a breathing contour eye',
    recipe: [['timing', 'heartbeat 54 BPM', 1, 'clock'], ['path', 'a sweep across the leaf', 1, 'where the heat goes'], ['heat', 'blackbody glow, conduction, Newton cooling', 0.7, 'the drive'], ['leaf', 'chlorophyll front, carotenoid revealed, anthocyanin made', 1, 'the turning'], ['contour', 'nested contours, line count 12', 0.22, 'the observer']],
    build({ w, h }) {
      const beat = T([{ curve: 'heartbeat', weight: 1, params: { bpm: 54 } }], 6), walk = G.path.create({ w, h, kind: 'sweep', speed: 0.07, radius: 5, wake: 0.25 });
      const fire = G.heat.create({ w, h, peak: 1900, q: 3400, tau: 2.2, kappa: 1.4 }), leaf = G.leaf.create({ w, h, kc: 0.012, margin: 3, driveGain: 14 }), eye = G.contour.create({ w, h, count: 12, width: 0.3, speed: 0.25 }); let cross = false;
      return { layers: [leaf, eye, fire], weights: [1, 0.22, 0.7], progress: leaf, transfer: () => Float32Array.from(leaf.state.C, (c, k) => (leaf.state.mask[k] > 0.5 ? 1 - c / leaf.state.mask[k] : -1)), step(dt) { G.timing.step(beat, dt, {}); G.path.step(walk, dt, {}); G.heat.step(fire, dt, { source: walk }); G.leaf.step(leaf, dt, cross ? {} : { drive: fire }); G.contour.step(eye, dt, { timing: beat }); },
        control() { cross = true; leaf.weights.margin = 0; leaf.weights.veins = 0; leaf.state.edge.fill(1); leaf.weights.kc = 0.12; } };
    },
  },
  'signal-orbits': {
    title: 'A signal ribbon switched on by an automaton front, running on orbit paths that unravel into a contour eye, on audio timing',
    recipe: [['soundclock', 'beats and onsets of the features', 1, 'clock'], ['orbit', 'five tilted orbits, phase-lit bodies, dotted rings', 1, 'the paths'], ['front', 'lenia front: gates the ribbon, then moves weight to the eye', 1, 'transfer'], ['ribbon', 'metaball signal, flowing', 1, 'the signal'], ['contour', 'the eye it unravels into', 1, 'what it becomes']],
    build({ w, h, features }) {
      const clock = G.soundclock.create({ features }), orb = G.orbit.create({ w, h, orbits: 4, bodyR: 2.6 }); orb.timing = clock; orb.name = 'orbit';
      const sig = G.ribbon.create({ w, h, kind: 'circle', gain: 4.5, flow: 0.18, discs: 110 }); sig.name = 'ribbon';
      const eye = G.contour.create({ w, h, count: 10, width: 0.3 }); eye.name = 'eye';
      const shift = G.front.create({ w, h, seeds: [[0.5, 0.5]], seedRadius: 4, threshold: 0.12, rate: 1.4, from: ['orbit', 'ribbon'], to: ['eye'] }); shift.name = 'shift';
      return { layers: [orb, sig, eye, shift], weights: [1, 1, 1, 1], progress: shift, transfer: () => shift.fields.amount, step(dt) { G.soundclock.step(clock, dt, {}); G.orbit.step(orb, dt, {}); G.front.step(shift, dt, {}); G.ribbon.step(sig, dt, { timing: clock }); G.contour.step(eye, dt, { timing: clock }); },
        control() { const L = shift.state.T.elements[1].law; L.mode = 'global'; L.rate = 0.06; } };
    },
  },
  'coral-under-lens': {
    title: 'Turing coral grown along a stirred current, under a dispersing lens',
    recipe: [['path', 'a spiral pour', 1, 'motion in'], ['advect', 'stable fluids, stirred, carries the reaction', 0.6, 'the current'], ['rd', 'Gray-Scott coral, seeded by the path, carried by the current', 0.75, 'the pattern'], ['glass', 'lens, Abbe 32, depth 34: dispersion and caustic', 1, 'the witness']],
    build({ w, h }) {
      const walk = G.path.create({ w, h, kind: 'spiral', speed: 0.06, radius: 3 }), water = G.advect.create({ w, h, stir: 0.9, pour: 0.5, kappa: 0.08, ink: '#2a4a5a' });
      const coral = G.rd.create({ w, h, preset: 'coral', seedSpots: 1, ink: '#5a1f2a', sub: 10 }), lens = G.glass.create({ w, h, shape: 'lens', abbe: 32, depth: 34 }); let cross = false;
      return { layers: [water, coral, lens], weights: [0.6, 0.75, 1], progress: coral, transfer: () => coral.fields.amount, step(dt) { G.path.step(walk, dt, {}); G.advect.step(water, dt, { source: walk, flow: walk }); G.rd.step(coral, dt, { source: walk, flow: water }); if (cross) { const A = coral.fields.amount; let m = 0; for (const v of A) m += v / A.length; A.fill(m); } G.glass.step(lens, dt, {}); },
        control() { cross = true; } };
    },
  },
};

// one frame of an element: its combined picture and the numbers watched beside it
// The section 13 numbers come from the element's transfer ticks (cells where the element lives; -1 marks outside),
// not from its picture, so a pattern that merely exists is not mistaken for a front.
export function frame(el, { summary = false } = {}) {
  const out = (summary ? combineSummary : combine)(el.layers, el.weights);
  const T = el.transfer ? el.transfer() : el.progress.fields.amount; let s = 0, s2 = 0, n = 0, d = 0;
  for (let k = 0; k < T.length; k++) { const v = T[k]; if (v < 0) continue; s += v; s2 += v * v; n++; if (el.prevT) d += Math.abs(v - el.prevT[k]); }
  el.prevT = Float32Array.from(T); const mean = n ? s / n : 0, change = n ? d / n : 0;
  el.calm = change < 2e-4 ? (el.calm ?? 0) + 1 : 0;
  return { rgb: out.rgb, w: out.w, h: out.h, spread: n ? Math.sqrt(Math.max(0, s2 / n - mean * mean)) : 0, change, mean, settled: el.calm > 12 };
}
