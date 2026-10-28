// adapters/study.mjs: the study generator as a graph node. Any raster in; out comes a score that carries the colour
// criterion's headline readings, and the picture rebuilt from its own palette (each pixel painted with its swatch).
// The full study (study.json, plates, viewer) is tools/study.mjs; this node lets a graph steer by colour balance.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { toSrgb, toLin } from '../lib/pix.mjs';
import { colour } from '../lib/study/colour.mjs';
import { subjectFromRGBA } from '../lib/study/load.mjs';

// Linear float raster to 8-bit sRGB, rounded with no dither, so the reading is deterministic.
function toRGBA8(R) {
  const n = R.w * R.h, o = new Uint8ClampedArray(n * 4), d = R.data;
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) o[4 * i + c] = Math.round(toSrgb(Math.min(1, Math.max(0, d[4 * i + c]))) * 255); o[4 * i + 3] = Math.round(Math.min(1, Math.max(0, d[4 * i + 3])) * 255); }
  return o;
}

export const NODES = [
  defineNode({
    id: 'study.colour', title: 'Colour study of a picture', lane: 'criteria', domains: ['colour science', 'perception', 'painting'], source: 'superframe lib/study (colour criterion)', explore: false,
    doc: 'Palette by k-means in CIELAB with area shares; Goethe contrast-of-extension balance distance on the measured L* scale (the score value, 0 = in balance) and on Goethe\'s light numbers; hue concentration, colourfulness, value key and composition coherence as metrics. The rebuilt raster paints each pixel with its swatch.',
    inputs: { raster: 'raster' }, outputs: { score: 'score', raster: 'raster' },
    params: {
      k: { type: 'int', min: 1, max: 24, default: 8, unit: 'swatches at most' },
      target: { type: 'number', min: 0, max: 1, default: 0.3, unit: 'largest balance distance that passes' },
    },
    cost: () => 40,
    render: ({ inputs, params }) => {
      const R = inputs.raster, S = subjectFromRGBA(R.w, R.h, toRGBA8(R), 'raster'), M = colour.measure(S, { k: params.k, controls: false });
      const sw = M.palette.swatches, L = M.work.labels, out = make.raster(R.w, R.h), lin = sw.map(s => s.rgb.map(v => toLin(v / 255)));
      for (let i = 0; i < R.w * R.h; i++) { const c = L && L[i] >= 0 ? lin[L[i]] : [0, 0, 0]; out.data[4 * i] = c[0]; out.data[4 * i + 1] = c[1]; out.data[4 * i + 2] = c[2]; out.data[4 * i + 3] = L && L[i] >= 0 ? 1 : 0; }
      const d = M.extension.lstar.distance, r4 = v => Math.round(v * 1e4) / 1e4;
      return {
        score: { name: 'colour.balance', value: r4(d), target: [0, params.target], pass: d <= params.target,
          metrics: { swatches: sw.length, largest_share: r4(sw[0]?.share ?? 0), balance_goethe: r4(M.extension.goethe.distance), hue_concentration: M.hue.concentration ?? 0, colourfulness: M.colourfulness.M, mean_L: M.value.mean_L, coherence: M.composition.coherence, residual_dE: M.residual?.mean_dE ?? 0 } },
        raster: out,
      };
    },
  }),
];
