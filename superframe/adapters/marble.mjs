// adapters/marble.mjs: marbling between sources (lib/marble/bath.mjs) as nodes. Every point of the bath keeps which
// source it came from, so the outputs include the provenance next to the picture.
//   marble.bath      up to four pictures, each with a weight, marbled on one bath
//   marble.concepts  ideas as inks: each source is a study's concepts with weights, laid as rings and marbled; the
//                    text output is the reading (concept shares, borders inside a study, meetings across studies)
//   fluid.flow       the physics under the bath: the thin-layer viscous flow (lib/fluid/stokes.mjs) of a stylus and an
//                    ink drop, as a vector field. The bath's closed-form maps are this flow's exact results
//                    (docs/prereg/FLUID-INK-PREREG.md).
// Browser-safe: no node:fs. Library studies become a `sources` JSON through lib/marble/library.mjs (Node).
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { lay, read, render, readElements, conceptReading, renderConcepts } from '../lib/marble/bath.mjs';
import { makeGrid, forceKernel, sourceKernel, sample } from '../lib/fluid/stokes.mjs';

const B = 'lib/marble/bath.mjs';
const comb = {
  tines: { type: 'int', min: 0, max: 24, default: 8, unit: 'comb teeth' },
  comb: { type: 'number', min: 0, max: 0.2, default: 0.08, unit: 'share of width per tooth pull' },
  fill: { type: 'number', min: 0.05, max: 0.8, default: 0.5, unit: 'share of the bath the inks cover' },
};
const labelField = (map, n) => { const F = make.field(map.w, map.h); for (let i = 0; i < map.src.length; i++) F.data[i] = map.src[i] < 0 ? 0 : (map.src[i] + 1) / n; return F; };

// three studies from the library (concept ids and measured colours from concepts.jsonl), so the node runs alone
export const DEFAULT_CONCEPTS = JSON.stringify([
  { id: 'water study', weight: 3, elements: [{ id: 'water', weight: 3, colour: '#34415e' }, { id: 'turbulence', weight: 2, colour: '#db4b2a' }, { id: 'light', weight: 1, colour: '#9c7f6b' }] },
  { id: 'print study', weight: 2, elements: [{ id: 'halftone-dither', weight: 2, colour: '#8378b2' }, { id: 'ink', weight: 2, colour: '#557e7d' }, { id: 'grid', weight: 1, colour: '#d6915f' }] },
  { id: 'form study', weight: 2, elements: [{ id: 'spiral', weight: 2, colour: '#fcc46e' }, { id: 'field', weight: 1, colour: '#9c7f6b' }, { id: 'sound', weight: 1, colour: '#ebe19b' }] },
]);

export const NODES = [
  defineNode({
    id: 'marble.bath', title: 'Marbling between pictures', lane: 'image', domains: ['marbling', 'fluids', 'provenance'], source: `${B} lay, read, render`,
    doc: 'Each input picture is an ink with a weight: dropped on one bath (later drops push earlier ink outward) and combed. Area is preserved, so each picture keeps a share of the bath equal to its weight while the ink stays in frame. The label field says which picture each point came from (0 ground, k/n picture k).',
    inputs: { a: 'raster', b: 'raster', c: { type: 'raster', optional: true }, d: { type: 'raster', optional: true } },
    outputs: { raster: 'raster', labels: 'field' },
    params: { wa: { type: 'number', min: 0.1, max: 10, default: 3 }, wb: { type: 'number', min: 0.1, max: 10, default: 2 }, wc: { type: 'number', min: 0.1, max: 10, default: 2 }, wd: { type: 'number', min: 0.1, max: 10, default: 1 }, ...comb },
    cost: () => 60,
    render: ({ inputs, params, w, h, seed, rng }) => {
      const pics = ['a', 'b', 'c', 'd'].filter(k => inputs[k]), wts = { a: params.wa, b: params.wb, c: params.wc, d: params.wd };
      const bath = lay({ size: [w, h], sources: pics.map(k => ({ id: k, weight: wts[k] })), seed: `${seed}/marble`, tines: params.tines, comb: params.comb, fill: params.fill });
      const map = read(bath), images = pics.map(k => ({ w: inputs[k].w, h: inputs[k].h, rgba: px.toSRGB8(inputs[k], rng, { ground: '#ebe5d8' }) }));
      const out = render(map, images);
      return { raster: px.fromSRGB8(w, h, out.rgba), labels: labelField(map, pics.length) };
    },
  }),
  defineNode({
    id: 'marble.concepts', title: 'Marbling between ideas', lane: 'data', domains: ['marbling', 'concept mapping', 'provenance'], source: `${B} readElements, conceptReading`,
    doc: 'Each source is a study: its concepts with weights, laid in one drop as wedges (or rings), each covering its weight share, then marbled with the other studies. The picture is coloured by concept; the text is the reading: each concept\'s share of the bath, the borders inside one study, and the meetings across studies, which the marbling made and no single study held.',
    inputs: {}, outputs: { raster: 'raster', labels: 'field', reading: 'text' },
    params: { sources: { type: 'string', default: DEFAULT_CONCEPTS, doc: 'JSON: [{ id, weight, elements: [{ id, weight, colour? }] }]' },
      layout: { type: 'enum', options: ['sectors', 'rings'], default: 'sectors', doc: 'sectors: wedges, each idea reaches the rim by its weight; rings: concentric, inner ideas meet little' },
      ...comb },
    cost: () => 60,
    render: ({ params, w, h, seed }) => {
      const sources = JSON.parse(params.sources);
      const bath = lay({ size: [w, h], sources, seed: `${seed}/marble`, tines: params.tines, comb: params.comb, fill: params.fill, layout: params.layout });
      const map = read(bath), elem = readElements(bath, map), out = renderConcepts(bath, map, elem), reading = conceptReading(bath, map, elem);
      reading.across = reading.across.slice(0, 24); reading.within = reading.within.slice(0, 24);
      return { raster: px.fromSRGB8(w, h, out.rgba), labels: labelField(map, sources.length), reading: { text: JSON.stringify(reading), role: 'description' } };
    },
  }),
  defineNode({
    id: 'fluid.flow', title: 'Thin-layer flow under the bath', lane: 'image', domains: ['fluids', 'marbling', 'physics'], source: 'lib/fluid/stokes.mjs forceKernel, sourceKernel',
    doc: 'Slow viscous flow in a thin layer with floor friction (Stokes flow, Brinkman form): a stylus pulled along the middle and an ink drop beside it. Velocity as a 2-channel field in px per unit time. The friction length sets how far a comb reaches; with it, a stylus crossing the bath moves ink exactly by the bath tine map z exp(-d / lambda), and a drop moves it by the drop map.',
    inputs: {},
    outputs: { field: 'field' },
    params: {
      lambda: { type: 'number', min: 0.01, max: 0.2, default: 0.04, unit: 'friction length, share of width' },
      drop: { type: 'number', min: 0, max: 4, default: 1, unit: 'drop strength against stylus' },
    },
    cost: () => 20,
    render: ({ params, w, h }) => {
      const g = makeGrid(128), F = forceKernel(g, { w: 0.008, lambda: params.lambda }), S = sourceKernel(g, { w: 0.008 });
      const out = make.field(w, h, new Float32Array(w * h * 2), 2), cx = 0.68, cy = 0.35;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const x = (i + 0.5) / w, y = (j + 0.5) / h, X = x - 0.5 - Math.floor(x - 0.5), Y = y - 0.5 - Math.floor(y - 0.5);
        const DX = x - cx - Math.floor(x - cx), DY = y - cy - Math.floor(y - cy);
        const ux = 0.02 * sample(g, F.ux, X, Y) + params.drop * 0.05 * sample(g, S.ux, DX, DY);
        const uy = 0.02 * sample(g, F.uy, X, Y) + params.drop * 0.05 * sample(g, S.uy, DX, DY);
        out.data[2 * (j * w + i)] = ux * w; out.data[2 * (j * w + i) + 1] = uy * h;
      }
      return { field: out };
    },
  }),
];
