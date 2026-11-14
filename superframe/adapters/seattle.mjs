// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// adapters/seattle.mjs: the Seattle night nodes (lib/seattle). Each wraps one physical step of the back-seat memory
// scene so it combines with every other node:
//   seattle.droplens   raindrops on glass in front of a raster: each drop a spherical-cap lens showing it inverted
//   seattle.bokeh      the raster defocused through a pupil cut by squinting lids
//   seattle.lash       squint streaks: lid-edge and eyelash diffraction from every bright pixel
//   seattle.floaters   vitreous floaters shadowing the bright areas
//   seattle.lamppalette  a lamp's spectrum to a pixel palette (sodium or filament), drawn as swatches
//   seattle.pixelart   tone curve plus ordered dither to a lamp palette, in linear light
// Rasters are linear light. Randomness comes only from the node's rng.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { fromRaster, toRaster, sample, frame } from '../lib/seattle/raster.mjs';
import { exitRay, waterIndex, baseFromVolume } from '../lib/seattle/droplens.mjs';
import { defocus } from '../lib/seattle/bokeh.mjs';
import { arms, streaks } from '../lib/seattle/lash.mjs';
import { createFloaters, stepFloaters, applyFloaters } from '../lib/seattle/floaters.mjs';
import { lampPalette } from '../lib/seattle/palette.mjs';
import { tone, pairTable, dither } from '../lib/seattle/pixq.mjs';
import { STREET, MATERIALS, ADAPT } from '../lib/seattle/lights.mjs';
import { fromSRGB8 } from '../lib/pix.mjs';

const SRC = 'superframe/lib/seattle';
const DEG = Math.PI / 180;
const N_RGB = [610, 550, 465].map(waterIndex);
const palCache = new Map();
const lampPal = (lamp, n) => { const k = `${lamp}:${n}`; if (!palCache.has(k)) { const P = lampPalette(spec(lamp, n)); palCache.set(k, { P, table: pairTable(P.cb) }); } return palCache.get(k); };
const spec = (lamp, max) => ({ label: lamp, max, lights: [{ spd: STREET[lamp](), adapt: ADAPT, gains: [0.01, 0.04, 0.12, 0.35, 1, 3, 10] }],
  materials: [MATERIALS.cloud, MATERIALS.asphalt, MATERIALS.fir, MATERIALS.maple, MATERIALS.snow, '#c83a2a', '#2a6ac8'] });

function lensDrops({ inputs, params, w, h, rng }) {
  const src = inputs.raster ? fromRaster(inputs.raster) : gradient(w, h), out = fromRaster(toRaster(src));
  const th = params.contact * DEG, pxmm = params.pxPerMm, n = Math.round(params.density * w * h / 400);
  for (let k = 0; k < n; k++) {
    const a = baseFromVolume(0.05 + 6 * rng() ** 3, th), cx = rng() * w, cy = rng() * h, r = a * pxmm;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const u = (x + 0.5 - cx) / pxmm, v = -(y + 0.5 - cy) / pxmm, i = 3 * (y * w + x);
      if (u * u + v * v > a * a) continue;
      for (let c = 0; c < 3; c++) {
        const o = exitRay(u, v, a, th, N_RGB[c], [0, 0, 1]);
        if (!o) { out.d[i + c] *= 0.05; continue; }
        // the exit direction's angle maps to the source at the authored field of view (fovDeg across the width)
        const k2 = w / (params.fovDeg * DEG), sx = cx + Math.atan2(o.T[0], o.T[2]) * k2, sy = cy - Math.atan2(o.T[1], o.T[2]) * k2;
        out.d[i + c] = sample(src, sx, sy)[c] * o.trans;
      }
    }
  }
  return { raster: toRaster(out) };
}
function gradient(w, h) { const F = frame(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) F.d.set([0.02 + 0.5 * (x / w), 0.02 + 0.2 * (y / h), 0.05], 3 * (y * w + x)); return F; }

export const NODES = [
  defineNode({
    id: 'seattle.droplens', title: 'Raindrops on glass, each a lens', lane: 'image', domains: ['optics', 'fluid physics'], source: `${SRC}/droplens.mjs`,
    doc: 'Spherical-cap drops (contact angle) refract the raster behind them through exact vector Snell with measured water dispersion; each shows it inverted and shrunk, dark-rimmed where total internal reflection sets in.',
    inputs: { raster: { type: 'raster', optional: true } }, outputs: { raster: 'raster' },
    params: { density: { type: 'number', min: 0, max: 4, default: 1.2, unit: 'drops per 400 px' }, contact: { type: 'number', min: 20, max: 80, default: 50, unit: 'degrees' },
      pxPerMm: { type: 'number', min: 1, max: 12, default: 3, unit: 'px per mm of glass' }, fovDeg: { type: 'number', min: 10, max: 90, default: 30, unit: 'degrees across' } },
    cost: () => 30, render: lensDrops,
  }),
  defineNode({
    id: 'seattle.bokeh', title: 'Out of focus through a squint', lane: 'image', domains: ['optics', 'vision science'], source: `${SRC}/bokeh.mjs`,
    doc: 'Geometric defocus: blur disc of diameter pupil x |1/focus - 1/object|, shaped like the pupil cut by the lids. Bright pixels are scattered through the exact aperture; the dim rest is box-blurred to the same spread.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { diameter: { type: 'number', min: 1, max: 40, default: 9, unit: 'px' }, open: { type: 'number', min: 0.1, max: 1, default: 0.45, unit: 'lid opening share' } },
    cost: p => p.diameter * 4, render: ({ inputs, params }) => ({ raster: toRaster(defocus(fromRaster(inputs.raster), params.diameter, params.open, { split: 0.3 })) }),
  }),
  defineNode({
    id: 'seattle.lash', title: 'Squint streaks from lids and lashes', lane: 'image', domains: ['optics', 'vision science'], source: `${SRC}/lash.mjs`,
    doc: 'Fraunhofer edge diffraction: energy per unit angle lambda / (2 pi^2 s theta^2) along each arm, perpendicular to the lid edge (slit height s) and to each lash (Babinet), red reaching further than blue.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { slit: { type: 'number', min: 0.4, max: 6, default: 2, unit: 'mm lid opening' }, lashes: { type: 'int', min: 0, max: 12, default: 5, unit: 'lashes' },
      threshold: { type: 'number', min: 0.1, max: 20, default: 1, unit: 'linear luminance' }, pxDeg: { type: 'number', min: 2, max: 40, default: 10, unit: 'px per degree' } },
    cost: () => 20,
    render: ({ inputs, params, rng }) => { const F = fromRaster(inputs.raster); streaks(F, DEG / params.pxDeg, arms({ slit: params.slit * 1e-3, lashes: params.lashes, rng }), { threshold: params.threshold }); return { raster: toRaster(F) }; },
  }),
  defineNode({
    id: 'seattle.floaters', title: 'Floaters in the eye', lane: 'image', domains: ['vision science'], source: `${SRC}/floaters.mjs`,
    doc: 'Muscae volitantes: strings, beads and dots in the vitreous cast soft shadows with a bright core, visible only against bright light; they lag each eye movement as damped springs.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { contrast: { type: 'number', min: 0, max: 0.6, default: 0.25, unit: 'shadow depth' }, strings: { type: 'int', min: 0, max: 8, default: 3, unit: 'strings' } },
    cost: () => 5,
    render: ({ inputs, params, rng, w, h, time }) => {
      const S = createFloaters(rng, w, h, { strings: params.strings, dots: 4 });
      stepFloaters(S, Math.min(4, time?.t ?? 1), [w / 2, h / 2]);
      return { raster: toRaster(applyFloaters(fromRaster(inputs.raster), S, { contrast: params.contrast })) };
    },
  }),
  defineNode({
    id: 'seattle.lamppalette', title: 'Lamp spectrum to pixel palette', lane: 'image', domains: ['colour science', 'lighting'], source: `${SRC}/palette.mjs`,
    doc: 'Materials lit by a lamp spectrum (high-pressure sodium model or a 2700 K filament) through the CIE 1931 observer, tone-mapped at the brightness steps a night scene reaches, merged to a palette in CIELAB. Drawn as swatch columns.',
    inputs: {}, outputs: { raster: 'raster' },
    params: { lamp: { type: 'enum', options: ['sodium', 'incandescent'], default: 'sodium' }, colours: { type: 'int', min: 4, max: 64, default: 24, unit: 'colours' } },
    cost: () => 40,
    render: ({ params, w, h }) => {
      const { P } = lampPal(params.lamp, params.colours), n = P.cb.code.length, rgba = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = P.cb.code[Math.min(n - 1, Math.floor(x * n / w))]; rgba.set([c[0], c[1], c[2], 255], 4 * (y * w + x)); }
      return { raster: fromSRGB8(w, h, rgba) };
    },
  }),
  defineNode({
    id: 'seattle.pixelart', title: 'Pixel art under a lamp palette', lane: 'image', domains: ['colour science', 'print'], source: `${SRC}/pixq.mjs`,
    doc: 'Extended-Reinhard tone curve, then ordered (Bayer 4) dither between the best pair of lamp-palette colours in linear light, so a static pixel never flickers between frames.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { lamp: { type: 'enum', options: ['sodium', 'incandescent'], default: 'sodium' }, colours: { type: 'int', min: 4, max: 64, default: 24, unit: 'colours' }, exposure: { type: 'number', min: 0.05, max: 20, default: 1.5, unit: 'scale' } },
    cost: () => 60,
    render: ({ inputs, params }) => {
      const { P, table } = lampPal(params.lamp, params.colours), F = fromRaster(inputs.raster), q = dither(tone(F, { exposure: params.exposure }), F.w, F.h, P.cb, table);
      return { raster: fromSRGB8(F.w, F.h, q.rgba) };
    },
  }),
];
export { make };
