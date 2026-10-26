// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// front: transformation as a moving front (BLEED section 13), and unravel, its reveal-under-a-sheet case.
// The tick automaton is the engine's one tick model, lib/core/ticks.mjs (merged from the superframe medium's and the
// universe's tick modules). Each tick holds a weight vector [from, to]; the 'to' element's law grows its weight where
// the smooth-kernel sum of neighbours plus the local drive passes its threshold (raised by the tick's thickness):
//   lenia   w += rate * dt * tanh((S + drive - threshold - thick * h) / softness)  (continuous, after Chan 2019)
//   life    w := 1 once S + drive > threshold                                       (binary, after Conway, Rule 110)
//   global  w += rate * dt everywhere                                               (the control: a crossfade)
// Drive is local, from motion: distance travelled, speed, contact with the floor, thickness, and a context field
// (any layer's amount, read where the medium reads heat). The ticks ride a context flow layer's velocity if given.
// Output: amount = weight in 'to' at each cell, the section 13 progress field. Every step is transformational
// (the weights change the element's formula, BLEED section 19).
// unravel = a front whose amount is the share of a sheet already lifted away; feed it to sheet as `cut`.
import { tickField, stepTicks, rasterTicks, measureTicks } from '../core/ticks.mjs';
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32 } from '../core/layer.mjs';

const build = (id, credits, extraMech) => defineGen({
  id,
  kind: 'transformational',
  law: { shape: 'front', params: { automaton: 'lib/core/ticks.mjs' } },
  weights: { threshold: '0..1', softness: 'lenia width', rate: 'per second', radius: 'kernel radius, cells', thick: 'threshold rise per unit thickness', drive: '{ travel, speed, contact, thin, heat (= context field), age }', mode: 'lenia | life | global' },
  inputs: { flow: 'optional layer with vel: ticks ride it', drive: 'optional layer whose amount drives the flip locally' },
  mechanism: `per tick: S = sum_k K(d_k) w_k / sum K, x = S + drive - threshold - thick h; ${extraMech}`,
  credits,
  create({ w = 160, h = 100, seeds = [[0.05, 0.5]], seedRadius = 3, mode = 'lenia', threshold = 0.13, softness = 0.08, rate = 3, radius = 1.6, ring = false, thick = 0, drive = { age: 0.1, ageScale: 8 }, spacing = 1, seed = 'front', thickness = null, from = null, to = null } = {}) {
    const law = { radius, threshold, softness, rate, mode, ring, thick, drive };
    const T = tickField({ w, h, spacing, thickness, seeds, seedRadius, seed, elements: [{ name: 'from' }, { name: 'to', law }] });
    const L = makeLayer(id, { w, h, law: { shape: 'front', params: { mode, ...(from ? { from, to } : {}) } }, weights: law, state: { T, prev: null, series: [], cnt: F32(w * h) } });
    rasterTicks(T, 1, L.fields.amount, L.state.cnt); return L;
  },
  step(L, dt, ctx) {
    const S = L.state, V = ctx.flow?.fields.vel;
    let u = null, v = null; if (V) { u = F32(L.n); v = F32(L.n); for (let k = 0; k < L.n; k++) { u[k] = V[2 * k]; v[k] = V[2 * k + 1]; } }
    stepTicks(S.T, dt, { u, v, drive: ctx.drive?.fields.amount ?? null });
    const r = measureTicks(S.T, 1, S.prev); S.prev = r.snapshot;
    S.series.push({ t: S.T.time, mean: r.mean, spread: r.spread, front: r.front, frontAt: r.frontAt, change: r.change });
    rasterTicks(S.T, 1, L.fields.amount, S.cnt);
  },
});

export const front = build('front', ['lib/core/ticks.mjs (merged from superframe lib/medium/ticks.mjs and universe lib/ticks.mjs)', 'Chan 2019, Lenia', 'Conway 1970, Life; Wolfram, Rule 110', 'Mordvintsev et al. 2020, Growing Neural Cellular Automata'], 'the to-weight is taken from the from-weight, so each tick stays a partition of 1');
export const unravel = build('unravel', ['lib/core/ticks.mjs', 'the palimpsest and the lifted claim (BLEED sections 2 and 5)', 'paper burning from an edge, frost from a seed (BLEED section 13)'], 'amount is the share of the covering sheet already lifted: feed it to sheet as cut');
