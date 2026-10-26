// adapters/marks.mjs: lib/mosaic's marks law family as superframe nodes. Any raster (or field) comes in as tone; the
// node lays it as marks by one law (Bayer, Floyd-Steinberg, blue noise, AM halftone, ASCII, the code mosaic) or one
// of the site's recipes (riso, duotone, poster, hue poster, xerox tiles). Without an input it marks a soft disc.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { luma } from '../lib/pix.mjs';
import * as MZ from '../lib/mosaic/index.mjs';

const LAWS = ['bayer', 'floyd-steinberg', 'blue', 'halftone', 'ascii', 'code'], RECIPE = ['riso', 'duotone', 'poster', 'hue', 'xerox'];
const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function toneOf(inputs, w, h) {
  const src = inputs.raster ? luma(inputs.raster) : inputs.field ?? null, t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (src) { t[y * w + x] = src.data[Math.min(src.h - 1, Math.floor(y * src.h / h)) * src.w + Math.min(src.w - 1, Math.floor(x * src.w / w))]; continue; }
    const r = Math.hypot((x - w / 2) / (0.36 * Math.min(w, h)), (y - h / 2) / (0.36 * Math.min(w, h)));
    t[y * w + x] = Math.min(1, 0.15 + 0.85 * r * r);
  }
  return t;
}

export const NODES = [
  defineNode({
    id: 'marks.field', title: 'Tone laid as binary marks', lane: 'print', domains: ['halftone', 'dithering', 'typography', 'perception'], source: 'superframe lib/mosaic',
    doc: 'One law family: ordered dither, error diffusion, blue noise, an AM screen, ASCII from measured glyph coverage, and a code mosaic of real lines from our public repositories; or a site recipe built on them. Up close the marks or the text read; at a distance the tone does.',
    inputs: { raster: { type: 'raster', optional: true }, field: { type: 'field', optional: true } },
    outputs: { raster: 'raster' },
    params: {
      law: { type: 'enum', options: [...LAWS, ...RECIPE], default: 'blue' },
      cell: { type: 'number', min: 2, max: 48, default: 8, unit: 'px (halftone cell, glyph height / 1.6)' },
      angle: { type: 'number', min: 0, max: 90, default: 45, unit: 'degrees (halftone screen)' },
      ink: { type: 'string', default: '#141414' }, paper: { type: 'string', default: '#ebe5d8' },
    },
    cost: () => 4,
    render: async ({ inputs, params, w, h }) => {
      const tone = toneOf(inputs, w, h), ink = Float32Array.from(tone, v => 1 - v), R = make.raster(w, h), d = R.data;
      if (RECIPE.includes(params.law)) {
        const rgb = MZ.RECIPES[params.law](tone, w, h, params.law === 'riso' ? { ink: '#e87018', ground: '#5058c8', cell: Math.max(2, Math.round(params.cell / 3)) } : {});
        for (let i = 0; i < w * h; i++) { d[4 * i] = rgb[3 * i]; d[4 * i + 1] = rgb[3 * i + 1]; d[4 * i + 2] = rgb[3 * i + 2]; d[4 * i + 3] = 1; }
        return { raster: R };
      }
      const ch = Math.max(6, Math.round(params.cell * 1.6)), cw = Math.max(4, Math.round(ch * 0.6));
      let cov;
      if (params.law === 'ascii') { const A = MZ.atlas(MZ.ASCII, cw, ch); cov = MZ.drawField(MZ.asciiField(ink, w, h, { cw, ch, ramp: MZ.rampOf(A) }), w, h, A); }
      else if (params.law === 'code') cov = MZ.codeMosaic(ink, w, h, { cw, ch, corpus: await MZ.loadCorpus() }).coverage;
      else cov = MZ.marks(params.law, ink, w, h, { cell: params.cell, angle: params.angle });
      const I = [1, 3, 5].map(k => lin(parseInt(params.ink.slice(k, k + 2), 16) / 255)), P = [1, 3, 5].map(k => lin(parseInt(params.paper.slice(k, k + 2), 16) / 255));
      for (let i = 0; i < w * h; i++) { const a = cov[i]; for (let c = 0; c < 3; c++) d[4 * i + c] = P[c] + (I[c] - P[c]) * a; d[4 * i + 3] = 1; }
      return { raster: R };
    },
  }),
];
