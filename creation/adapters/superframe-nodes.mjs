// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// superframe-nodes.mjs: every creation-engine generator as a superframe node (superframe/lib/node.mjs),
// so the superframe's graph, explorer and CLI can call them. The adapter wraps; it never forks a generator.
// Ports: an optional 'field' input becomes the generator's source layer (and its drive); outputs are the layer's
// ticks as a 'field' and its picture through combine() as a 'raster'. Parameters: seconds to run, and the
// generator's numeric weights where they have a safe range. To register: copy this file into the superframe's
// adapters/ folder or import NODES from here (the superframe registry picks up any adapters/*.mjs exporting NODES);
// this folder does not edit the superframe.
import { defineNode } from '../../superframe/lib/node.mjs';
import * as G from '../lib/gen/index.mjs';
import { combine } from '../lib/core/combine.mjs';
import { makeLayer } from '../lib/core/layer.mjs';

const LANE = { advect: 'matter', rd: 'field', life: 'field', rule110: 'field', lenia: 'field', frost: 'matter', front: 'field', unravel: 'field', heat: 'matter', leaf: 'matter', dry: 'matter', marble: 'matter', mosaic: 'image', intaglio: 'image', glass: 'image', sheet: 'image', path: 'field', glyph: 'type', orbit: 'image', ribbon: 'image', contour: 'image', sound: 'sound' };
const SKIP = new Set(['timing', 'soundclock', 'sound']);   // clocks have no picture; sound needs the features file (use gen/sound.mjs directly)

// the node's own seed substream, in the form the generator takes: an integer where its default seed is a number,
// the substream string otherwise. Generators with no seed parameter are deterministic and take none.
const SEED_KIND = g => { const m = /seed\s*=\s*(['"\d])/.exec(g.raw.create.toString()); return !m ? null : /\d/.test(m[1]) ? 'int' : 'string'; };
export function seedParam(g, ctx) { const k = SEED_KIND(g); return k === 'int' ? { seed: ctx.seedInt } : k === 'string' ? { seed: ctx.seed } : {}; }

export const NODES = Object.entries(G).filter(([id, g]) => g?.create && !SKIP.has(id)).map(([id, g]) => {
  const d = g.describe();
  return defineNode({
    id: `engine.${id}`, title: `${id} (creation engine)`, lane: LANE[id] ?? 'field', domains: ['first principles', 'weighted laws'],
    source: `creation/lib/gen (${id})`, doc: d.mechanism, kind: 'technique',
    inputs: { field: { type: 'field', optional: true, doc: 'becomes the source (and drive) layer' } },
    outputs: { field: 'field', raster: 'raster' },
    params: { seconds: { type: 'number', min: 0, max: 30, default: 3, unit: 's', doc: 'how long the law runs' } },
    cost: p => 30 * (p.seconds ?? 3) * 4,
    render: async ctx => {
      const w = Math.min(ctx.w, 256), h = Math.min(ctx.h, 256), L = g.create({ w, h, ...seedParam(g, ctx) }), steps = Math.round(30 * ctx.params.seconds);
      let src = null; if (ctx.inputs.field) { src = makeLayer('src', { w, h, law: { shape: 'absorb', params: {} } }); const f = ctx.inputs.field; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) src.fields.amount[j * w + i] = f.data[Math.floor(j * f.h / h) * f.w + Math.floor(i * f.w / w)] ?? 0; }
      for (let s = 0; s < steps; s++) g.step(L, 1 / 30, src ? { source: src, drive: src } : {});
      const rgb = combine([L]).rgb, raster = { w, h, data: new Float32Array(w * h * 4) };
      for (let k = 0; k < w * h; k++) { raster.data[4 * k] = rgb[3 * k]; raster.data[4 * k + 1] = rgb[3 * k + 1]; raster.data[4 * k + 2] = rgb[3 * k + 2]; raster.data[4 * k + 3] = 1; }
      return { field: { w, h, channels: 1, data: Float32Array.from(L.fields.amount) }, raster };
    },
  });
});
