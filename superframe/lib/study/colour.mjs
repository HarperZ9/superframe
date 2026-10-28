// colour.mjs: the colour criterion. measure() returns plain numbers, each block with its method; plates() turns them
// into plate specs. Working data (the histogram and the per-pixel labels) rides along on a non-enumerable field, so
// it is never written to study.json.
import { palette, histogram, PALETTE_METHOD } from './palette.mjs';
import { balance, SCALES } from './extension.mjs';
import { hueWheel, valueStructure, colourfulness, composition, residual, bezold, simultaneous } from './measures.mjs';
import { palettePlate, extensionPlate } from './plates-palette.mjs';
import { bezoldPlate, simultaneousPlate } from './plates-perception.mjs';
import { huePlate, valuePlate, compositionPlate } from './plates-structure.mjs';
import { rgb8ToLab, METHOD } from './cmath.mjs';
import { runControls } from './controls.mjs';

const PLATES = ['Palette', "Extension, Goethe's lights", 'Extension, measured L*', 'Bezold lace', 'One colour, four grounds', 'Hue and chroma', 'Value structure', 'Where each colour lives'];

export const colour = {
  id: 'colour',
  title: 'Colour',
  plateTitles: PLATES,
  frameDefaults: subject => ({
    object: `${subject.file}, ${subject.w} x ${subject.h} px`,
    perspective: 'the picture as displayed on an sRGB screen, read through the colour lens: CIELAB under D65, 2 degree observer',
    need: 'a person who wants to learn how a picture is built in colour and make the same kind of study of their own subject',
    objective: 'a palette with area weights, the balance of those areas by light, and how the colours act on each other, each with its method',
    criteria: 'colour: palette, contrast of extension (two light scales), Bezold lace, simultaneous contrast, hue, value, composition',
    intent: { studier: 'to learn the colour structure of the subject and keep the method, not the material' },
  }),
  measure(subject, { k = 10, seed = 'study/palette', mergeDE = 4, controls = true } = {}) {
    const P = palette(subject, { k, seed, mergeDE }), { pts, total } = histogram(subject), sw = P.swatches;
    const comp = sw.length ? composition(subject, P.binToSwatch, sw.length) : { method: 'no opaque pixels', coherence: 1, where: [], adjacency: [], labels: null };
    const out = {
      space: METHOD,
      opaque_pixels: total,
      palette: { method: PALETTE_METHOD, params: { k, seed, mergeDE }, swatches: sw },
      residual: sw.length ? residual(pts, total, P.binToSwatch, sw) : null,
      extension: Object.fromEntries(Object.keys(SCALES).map(id => [id, balance(sw, id)])),
      hue: hueWheel(pts, total),
      value: valueStructure(pts, total),
      colourfulness: colourfulness(subject),
      composition: { method: comp.method, coherence: comp.coherence, where: comp.where, adjacency: comp.adjacency },
      bezold: bezold(sw),
      simultaneous: simultaneous(sw),
    };
    if (controls) out.controls = runControls(subject, out, { k, seed, mergeDE });
    Object.defineProperty(out, 'work', { value: { labels: comp.labels, binToSwatch: P.binToSwatch }, enumerable: false });
    return out;
  },
  plates(M, subject, { first = 2, of } = {}) {
    const ctx = n => ({ n, of, criterion: 'colour' });
    const specs = [palettePlate(M, subject, ctx(first)), extensionPlate(M, subject, ctx(first + 1), 'goethe'), extensionPlate(M, subject, ctx(first + 2), 'lstar'),
      bezoldPlate(M, subject, ctx(first + 3)), simultaneousPlate(M, subject, ctx(first + 4)), huePlate(M, subject, ctx(first + 5)), valuePlate(M, subject, ctx(first + 6)), compositionPlate(M, subject, ctx(first + 7))];
    const images = { recon: reconImage(M, subject), value: valueImage(subject) };
    for (const s of specs) s.images = images;
    return specs;
  },
};

function reconImage(M, S) {
  const sw = M.palette.swatches.map(s => s.rgb), L = M.work.labels, out = new Uint8ClampedArray(S.w * S.h * 4);
  for (let i = 0; i < S.w * S.h; i++) { const c = L && L[i] >= 0 ? sw[L[i]] : [13, 11, 18]; out[4 * i] = c[0]; out[4 * i + 1] = c[1]; out[4 * i + 2] = c[2]; out[4 * i + 3] = 255; }
  return { w: S.w, h: S.h, rgba: out };
}
const BAND = [10, 30, 50, 70, 90].map(L => { const v = Math.round(255 * enc(((L + 16) / 116) ** 3 > 216 / 24389 ? ((L + 16) / 116) ** 3 : L / (24389 / 27))); return v; });
function enc(v) { return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055; }
function valueImage(S) {
  const out = new Uint8ClampedArray(S.w * S.h * 4), d = S.rgba, cache = new Map();
  for (let i = 0; i < S.w * S.h; i++) {
    const p = 4 * i, key = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2];
    let g = cache.get(key); if (g === undefined) { g = BAND[Math.min(4, Math.floor(rgb8ToLab(d[p], d[p + 1], d[p + 2])[0] / 20))]; cache.set(key, g); }
    out[p] = out[p + 1] = out[p + 2] = g; out[p + 3] = 255;
  }
  return { w: S.w, h: S.h, rgba: out };
}
