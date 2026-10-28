// adapters/spectral.mjs: Newton's programme as nodes. Light taken into spectra and put back together.
//   spectral.prism     a picture into reflectance spectra (16 bands) and out again under another light
//   spectral.metamers  one colour's metamer set: spectra that match for an observer under one light, shown under a
//                      second light where they come apart, with their spectra drawn and the spread as text
//   spectral.hidden    a picture that matches another in daylight and becomes a second picture by candlelight
// Built on lib/medium/spectral.mjs and lib/medium/metamers.mjs. Browser-safe.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { spectrumRGB, spectrumOf, LAMBDA, BANDS } from '../lib/medium/spectral.mjs';
import { metamerSet, spread, matchError, reflectanceOf } from '../lib/medium/metamers.mjs';
import { makeHidden } from '../lib/medium/hidden.mjs';

const LIGHTS = ['D65', 'A', 'candle'];

export const NODES = [
  defineNode({
    id: 'spectral.prism', title: 'Prism: relight a picture through its spectra', lane: 'image', domains: ['optics', 'colour science'], source: 'lib/medium/metamers.mjs reflectanceOf; lib/medium/spectral.mjs spectrumRGB',
    doc: 'Each colour becomes a smooth reflectance spectrum (16 bands, Jakob-Hanika sigmoid, cached per colour), then is lit by the chosen illuminant and seen by a viewer adapted to it. Under D65 the picture returns (median delta E 0.000; 95 percent within 0.5; the misses are very dark saturated colours). Under A or candle, colours shift the way surfaces do, unlike a white-balance tint.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { light: { type: 'enum', options: LIGHTS, default: 'A' } },
    cost: () => 40,
    render: ({ inputs, params }) => {
      const R = inputs.raster, out = make.raster(R.w, R.h);
      for (let i = 0; i < R.w * R.h; i++) {
        const c = spectrumRGB(reflectanceOf([R.data[4 * i], R.data[4 * i + 1], R.data[4 * i + 2]]), params.light);
        out.data[4 * i] = Math.max(0, c[0]); out.data[4 * i + 1] = Math.max(0, c[1]); out.data[4 * i + 2] = Math.max(0, c[2]); out.data[4 * i + 3] = R.data[4 * i + 3];
      }
      return { raster: out };
    },
  }),
  defineNode({
    id: 'spectral.metamers', title: 'Metamers of one colour', lane: 'image', domains: ['colour science', 'perception', 'optics'], source: 'lib/medium/metamers.mjs metamerSet, spread',
    doc: 'Samples the set of reflectances an observer cannot tell apart from the chosen colour under D65 (hit-and-run in the null space of the observer\'s rows, bands kept in (0.001, 0.999)). Top band: each member under D65 as the standard observer sees it. Bottom band: the same members under the second light, where they part. The vector draws their spectra; the text gives the match error and the spread. A dichromat observer has two rows, so its set is larger and visibly varied to the standard observer even under D65.',
    inputs: {}, outputs: { raster: 'raster', vector: 'vector', reading: 'text' },
    params: {
      colour: { type: 'color', default: '#7a8a5a' },
      light: { type: 'enum', options: ['A', 'candle'], default: 'A' },
      observer: { type: 'enum', options: ['standard', 'protan', 'deutan', 'tritan'], default: 'standard' },
      count: { type: 'int', min: 2, max: 128, default: 24, unit: 'metamers' },
    },
    cost: p => 2 * p.count,
    render: ({ params, w, h, rng }) => {
      const T = spectrumOf(params.colour), set = metamerSet(T, { observer: params.observer, n: params.count, rng });
      const R = make.raster(w, h), n = set.length, top = set.map(s => spectrumRGB(s, 'D65')), bot = set.map(s => spectrumRGB(s, params.light));
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const k = Math.min(n - 1, Math.floor(x / w * n)), c = (y < h / 2 ? top : bot)[k], i = y * w + x;
        R.data[4 * i] = Math.max(0, c[0]); R.data[4 * i + 1] = Math.max(0, c[1]); R.data[4 * i + 2] = Math.max(0, c[2]); R.data[4 * i + 3] = 1;
      }
      const paths = set.map(s => ({ pts: s.map((v, i) => [(i / (BANDS - 1)) * w, h - v * h]), width: 1 }));
      const sp = spread(set, params.light), reading = { colour: params.colour, observer: params.observer, light: params.light, members: n, match_dE_D65: matchError(set, T), spread_dE: sp.max, wavelengths_nm: LAMBDA };
      return { raster: R, vector: make.vector(w, h, paths), reading: { text: JSON.stringify(reading), role: 'description' } };
    },
  }),
  defineNode({
    id: 'spectral.hidden', title: 'Hidden by candlelight', lane: 'image', domains: ['colour science', 'optics', 'perception'], source: 'lib/medium/hidden.mjs makeHidden, lpMax',
    doc: 'Each colour of the day picture gets two extreme metamers (linear programming: smallest and largest candle-lit luminance while matching exactly under D65). Each pixel blends them by the brightness of the hidden picture. Under D65 the result matches the day picture (worst delta E about 4e-6 in tests); by candlelight the hidden picture appears (luminance change correlates 0.99 with it in tests). The hidden picture can only move each colour within the range its metamer set allows: saturated, very dark and very light colours carry little.',
    inputs: { day: 'raster', hidden: 'raster' }, outputs: { day: 'raster', night: 'raster', range: 'field' },
    params: { light: { type: 'enum', options: ['candle', 'A'], default: 'candle' }, invert: { type: 'bool', default: false } },
    cost: () => 120,
    render: ({ inputs, params, w, h }) => {
      const D = inputs.day.w === w && inputs.day.h === h ? inputs.day : px.resampleRaster(inputs.day, w, h), Hd = inputs.hidden.w === w && inputs.hidden.h === h ? inputs.hidden : px.resampleRaster(inputs.hidden, w, h), n = w * h;
      const rgb = new Float32Array(3 * n), t = new Float32Array(n);
      for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) rgb[3 * i + c] = D.data[4 * i + c]; const l = Math.min(1, Math.max(0, 0.2126 * Hd.data[4 * i] + 0.7152 * Hd.data[4 * i + 1] + 0.0722 * Hd.data[4 * i + 2])); t[i] = params.invert ? 1 - l : l; }
      const out = makeHidden(rgb, t, n, { night: params.light, render: spectrumRGB }), Rd = make.raster(w, h), Rn = make.raster(w, h), F = make.field(w, h);
      let top = 0; for (let i = 0; i < n; i++) top = Math.max(top, out.range[i]);
      for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) { Rd.data[4 * i + c] = Math.max(0, out.day[3 * i + c]); Rn.data[4 * i + c] = Math.max(0, out.night[3 * i + c]); } Rd.data[4 * i + 3] = Rn.data[4 * i + 3] = 1; F.data[i] = top ? out.range[i] / top : 0; }
      return { day: Rd, night: Rn, range: F };
    },
  }),
];
