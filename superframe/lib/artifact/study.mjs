// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// study.mjs: every artifact ships as a study of its own elements, readable by any perceiver. The superframe's
// recipients (lib/recipient.mjs: eye, ear, reader, screenreader, agent) each get their readout, plus touch.
//   agent         study.json: properties, laws, weights the law read and did not read, settled state, and the
//                 measured transparency record: per medium, the correlation between the element's own ticks and
//                 what that medium shows inside the element's region (what survived the crossing, and how much)
//   reader and    study.md: one plain sentence per element, alt text for each medium, the metamer reading
//   screenreader
//   ear, eye      the medium files themselves; touch: tactile.json (sound.mjs)
// The numbers are measured from the rendered outputs, never restated from the recipe.
import * as G from '../../../creation/lib/gen/index.mjs';
import { RECIPIENTS } from '../recipient.mjs';
import { LAWS, MEDIA } from './ir.mjs';
import { weightOf } from './common.mjs';

const KEEPS = {
  paint: { keeps: 'hue, tone and the spectrum under two lights', loses: 'height except as light and shade' },
  type: { keeps: 'tone, as the weight of each letter', loses: 'hue except as ink tint; detail finer than one glyph' },
  lines: { keeps: 'level sets of the field, as contours; height as line weight', loses: 'hue; tone between levels' },
  material: { keeps: 'height and roughness', loses: 'hue' },
  sound: { keeps: 'x as time, y as pitch, tone as loudness', loses: 'hue; detail finer than one band or one column' },
};

// what a law reads: its declared weights plus every parameter its create() destructures
function accepts(g) {
  const m = /create\s*\(\s*\{([^)]*)\}\s*=/.exec(g.raw.create.toString());
  const params = m ? m[1].split(',').map(s => s.split(/[=:]/)[0].trim()).filter(s => /^[A-Za-z_]\w*$/.test(s)) : [];
  return [...new Set([...Object.keys(g.describe().weights), ...params])].filter(k => !['w', 'h', 'seed'].includes(k));
}

function pearson(a, b) {
  const n = a.length; if (n < 3) return null; let sa = 0, sb = 0; for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n; let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? +(num / Math.sqrt(da * db)).toFixed(3) : null;
}

// block mean of a full-resolution scalar over one sim pixel's footprint
const block = (F, W, H, w, h, x, y, C = 1, c = 0) => {
  const x0 = Math.floor(x * W / w), x1 = Math.max(x0 + 1, Math.floor((x + 1) * W / w)), y0 = Math.floor(y * H / h), y1 = Math.max(y0 + 1, Math.floor((y + 1) * H / h)); let s = 0;
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) s += F[(j * W + i) * C + c];
  return s / ((x1 - x0) * (y1 - y0));
};

export function readouts(r, out) {
  const [w, h] = r.sim, [W, H] = r.size, bands = r.sound.bands, T = out.type.rgb;
  // what a reader sees of the type: the darkness of the rendered sheet, block-averaged to the sim grid
  const lum = new Float32Array(W * H); for (let k = 0; k < W * H; k++) lum[k] = 1 - (0.2126 * T[3 * k] + 0.7152 * T[3 * k + 1] + 0.0722 * T[3 * k + 2]);
  const dark = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) dark[y * w + x] = block(lum, W, H, w, h, x, y);
  return {
    paint: (x, y) => { const k = 3 * (y * w + x), d = out.paint.sim.d65; return 1 - (0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]); },
    type: (x, y) => { const k = (y * w + x); return dark[k]; },
    lines: (x, y) => block(out.lines.cover, W, H, w, h, x, y),
    material: (x, y) => block(out.material.height, W, H, w, h, x, y),
    sound: (x, y) => out.sound.env[Math.min(bands - 1, bands - 1 - Math.floor(y * bands / h))][x],
  };
}

export function study(r, layers, out) {
  const [w, h] = r.sim, R = readouts(r, out), stride = Math.max(1, Math.round(Math.sqrt(w * h / 60000)));
  const elements = layers.map(o => {
    const e = o.element, A = o.layer.fields.amount, B = o.bbox, xs = [], ys = [], known = accepts(G[LAWS[e.law].gen]);
    for (let y = B.y0; y < B.y1; y += stride) for (let x = B.x0; x < B.x1; x += stride) if (o.mask[y * w + x] > 0.5) { xs.push(x); ys.push(y); }
    const amount = xs.map((x, i) => A[ys[i] * w + x]);
    const record = Object.fromEntries(MEDIA.map(m => {
      const wt = +weightOf(r, o, m).toFixed(3), shown = xs.map((x, i) => R[m](x, ys[i]));
      return [m, { weight: wt, correlation: wt ? pearson(amount, shown) : null, ...KEEPS[m] }];
    }));
    let cover = 0, mean = 0, shift = 0; for (let i = 0; i < amount.length; i++) { mean += amount[i]; if (amount[i] > 0.05) cover++; shift += out.paint.sim.shift[ys[i] * w + xs[i]]; }
    const N = Math.max(1, amount.length);
    return {
      id: e.id, law: e.law, mechanism: LAWS[e.law].doc, region: e.region, bbox_sim: B,
      properties: { mean_amount: +(mean / N).toFixed(4), coverage: +(cover / N).toFixed(4), ink: e.ink, roughness: e.roughness, scale_cells: e.scale, strength: e.strength },
      weights: { given: e.weights, read_by_law: Object.keys(e.weights).filter(k => known.includes(k) || k === 'steps'), unread: Object.keys(e.weights).filter(k => !known.includes(k) && k !== 'steps'), law_accepts: known },
      run: o.run, transparency_record: record,
      metamer: { mean_deltaE_D65_vs_A: +(shift / N).toFixed(3), spectrum_given: !!e.spectrum, doc: 'colour difference when the light changes from daylight (D65) to tungsten (A); inks that match in one light can split in the other' },
    };
  });
  return { schema: 'superframe.artifact.study/1', recipients: Object.keys(RECIPIENTS).concat('touch'), seed: r.seed, size: r.size, sim: r.sim, media: r.media, detail: r.detail, elements };
}

const place = g => `${g.cy < 0.38 ? 'upper ' : g.cy > 0.62 ? 'lower ' : ''}${g.cx < 0.38 ? 'left' : g.cx > 0.62 ? 'right' : 'centre'}`.trim();

export function studyText(r, S, extra = {}) {
  const L = [`# Study: ${extra.title ?? r.seed}`, '', extra.intent ? `Intent: ${extra.intent}` : '', '', `Seed "${r.seed}". ${S.elements.length} elements on a ${r.size[0]} by ${r.size[1]} frame. Every medium below is made from the same elements; each element passes into each medium by a weight.`, ''];
  for (const e of S.elements) {
    L.push(`## ${e.id}: ${e.mechanism}`, '', `In the ${place(e.region)} of the frame, in ${e.properties.ink}. It covers ${Math.round(100 * e.properties.coverage)}% of its region and ${e.run.settled ? 'had settled' : 'was still moving'} after ${e.run.steps} steps.`);
    if (e.weights.unread.length) L.push(`Weights the law did not read: ${e.weights.unread.join(', ')}.`);
    L.push('', '| Medium | Weight | Correlation | Keeps | Loses |', '|---|---|---|---|---|');
    for (const [m, t] of Object.entries(e.transparency_record)) L.push(`| ${m} | ${t.weight} | ${t.correlation ?? 'n/a'} | ${t.keeps} | ${t.loses} |`);
    L.push('', `Under tungsten light instead of daylight its colour moves by ΔE ${e.metamer.mean_deltaE_D65_vs_A} on average.`, '');
  }
  L.push('## Alt text', '', `- Paint: ${S.elements.map(e => `${e.law} in ${place(e.region)}`).join('; ')}, on paper ${r.palette.paper}, lit from the upper left.`,
    `- Type: the text set in Accession Mono across the frame; letters thicken where the elements act. The text: "${(extra.text ?? '').slice(0, 160)}"`,
    `- Lines: ${extra.levels ?? 'several'} contour levels of the elements, heavier at higher levels.`,
    '- Material: grey relief of the same elements under a raking light; glossy where the law is smooth, matte where rough.',
    `- Sound: ${r.sound.seconds} s, left to right in time, top of the frame as high pitch, ${r.sound.lo} Hz to ${r.sound.hi} Hz.`,
    '- Touch: tactile.json, a vibration pattern following the loudness over time.', '');
  return L.join('\n');
}
