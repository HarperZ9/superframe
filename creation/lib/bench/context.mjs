// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// context.mjs: one standard bench per generator, so every generator is measured in motion with something to act on:
// a word as source (the 5x7 face), a path as flow, a timing layer as clock. The same bench feeds the section 13
// series, the settle test and the metamer breakdown.
import * as G from '../gen/index.mjs';
import { textMask, makeLayer } from '../core/layer.mjs';

export function bench(id, { w = 96, h = 60, features = null } = {}) {
  const word = makeLayer('word', { w, h, law: { shape: 'sheet', params: { law: 'density_add' } }, ink: [0.1, 0.1, 0.14] }); word.fields.amount.set(textMask('claim', w, h, { y0: 0.3, y1: 0.7 }));
  const path = G.path.create({ w, h, kind: 'sweep', speed: 0.2 }), clock = G.timing.create({ curves: [{ curve: 'logistic', weight: 1, params: { tau: 5 } }], span: 6 });
  const P = { w, h };
  const special = {
    sheet: { create: { ...P, text: 'claim', lift: 10 }, ctx: () => ({ timing: clock }) },
    advect: { create: { ...P, pour: 0.8 }, ctx: () => ({ source: word, flow: path }) },
    front: { create: { ...P }, ctx: () => ({ flow: null }) },
    unravel: { create: { ...P, seeds: [[0.02, 0.5]] }, ctx: () => ({}) },
    heat: { create: { ...P }, ctx: () => ({ source: word, timing: clock }) },
    rd: { create: { ...P, seedSpots: 2 }, ctx: () => ({ source: path }) },
    lenia: { create: { ...P }, ctx: () => ({}) },
    frost: { create: { ...P, seeds: [[0.5, 0.5]] }, ctx: () => ({ source: null }) },
    glass: { create: { ...P, shape: 'lens' }, ctx: () => ({ drive: path }) },
    glyph: { create: { ...P, word: 'claim' }, ctx: () => ({ timing: clock }) },
    mosaic: { create: { ...P, text: 'tide', speed: 5 }, ctx: () => ({}) },
    intaglio: { create: { ...P, text: 'claim', speed: 0.5 }, ctx: () => ({}) },
    sound: { create: { ...P, features }, ctx: () => ({}) },
    afterglow: { create: { ...P }, ctx: () => ({ source: path }) },
    physarum: { create: { ...P }, ctx: () => ({ source: word }) },
    material: { create: { ...P, from: 'stone', to: 'ice', speed: 0.15 }, ctx: () => ({}) },
    ascii: { create: { ...P }, ctx: () => ({ source: path }) },
    crt: { create: { ...P }, ctx: () => ({ source: word }) },
    develop: { create: { ...P }, ctx: () => ({ source: path }) },
    soundclock: { create: { features }, ctx: () => ({}) },
  };
  const s = special[id] ?? { create: P, ctx: () => ({}) };
  const L = G[id].create(s.create);
  return { L, step: dt => { path.state && G.path.step(path, dt, {}); G.timing.step(clock, dt, {}); G[id].step(L, dt, s.ctx()); }, extras: { word, path, clock } };
}
