// quantize-plate.mjs: the era quantizer's demo. Two plates at 3840 px wide into out/quantize/:
//   plate-compare.png  both renders through every preset, each tile labelled with its measured mean CIEDE2000 at
//                      the preset's viewing distance and its metamer distance (lowest ppd under dE00 3);
//   plate-detail.png   8x nearest-neighbour crops, so dither and screen structure can be read.
// Also writes out/quantize/plate.json with every number printed on the plates.
//   node tools/quantize-plate.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderPlate, pngOf } from '../lib/study/render.mjs';
import { PRESETS, measure, metamerDistance } from '../lib/quantize/index.mjs';
import { loadRender, reduce } from '../lib/quantize/planted.mjs';

const OUT = new URL('../out/quantize/', import.meta.url);
const INK = { ground: '#101114', text: '#ece8df', muted: '#9a968d', rule: '#2c2d33' };
const W = 3840, M = 60, COLS = 6, GAP = 30, TW = 594, TH = 334, NATIVE = 2;

function upscale({ w, h, rgba }, k) {
  const out = new Uint8ClampedArray(w * k * h * k * 4);
  for (let y = 0; y < h * k; y++) for (let x = 0; x < w * k; x++) { const s = 4 * (Math.floor(y / k) * w + Math.floor(x / k)); out.set(rgba.subarray(s, s + 4), 4 * (y * w * k + x)); }
  return { w: w * k, h: h * k, rgba: out };
}
function crop({ w, rgba }, x0, y0, cw, ch) {
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) out.set(rgba.subarray(4 * ((y0 + y) * w + x0), 4 * ((y0 + y) * w + x0 + cw)), 4 * y * cw);
  return { w: cw, h: ch, rgba: out };
}
// Area resample to an exact size (box filter with fractional weights; source at least as large as the target).
function fit({ w, h, rgba }, tw, th) {
  const out = new Uint8ClampedArray(tw * th * 4), sx = w / tw, sy = h / th;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const acc = [0, 0, 0]; let n = 0;
    for (let j = Math.floor(y * sy); j < Math.min(h, Math.ceil((y + 1) * sy)); j++) { const wy = Math.min((y + 1) * sy, j + 1) - Math.max(y * sy, j);
      for (let i = Math.floor(x * sx); i < Math.min(w, Math.ceil((x + 1) * sx)); i++) { const wt = wy * (Math.min((x + 1) * sx, i + 1) - Math.max(x * sx, i)), p = 4 * (j * w + i);
        acc[0] += wt * rgba[p]; acc[1] += wt * rgba[p + 1]; acc[2] += wt * rgba[p + 2]; n += wt; } }
    out.set([...acc.map(v => Math.round(v / n)), 255], 4 * (y * tw + x));
  }
  return { w: tw, h: th, rgba: out };
}

const f2 = v => v.toFixed(2);
function runTile(src, p) {
  const native = p.scale === 'pixel' ? fit(src, TW / NATIVE, Math.floor(TH / NATIVE)) : fit(src, TW, TH);
  const out = p.run(native), de = measure(native, out, p.ppd), md = metamerDistance(native, out);
  const shown = p.scale === 'pixel' ? upscale(out, NATIVE) : out;
  return { img: shown, stats: { id: p.id, ppd: +p.ppd.toFixed(1), mean: +f2(de.mean), p95: +f2(de.p95), meanDL: +f2(de.meanDL), metamerPPD: md, axis: p.axis ?? 'colour' } };
}

function label(ops, x, y, title, line2, line3) {
  ops.push({ op: 'text', x, y, text: title, size: 30, style: 'display', weight: 500, color: INK.text });
  ops.push({ op: 'text', x, y: y + 34, text: line2, size: 21, style: 'mono', color: INK.muted });
  if (line3) ops.push({ op: 'text', x, y: y + 62, text: line3, size: 21, style: 'mono', color: INK.muted });
}

function comparePlate(sources) {
  const ops = [], images = {}, numbers = {}; let y = M + 70;
  ops.push({ op: 'text', x: M, y, text: 'Era quantizer', size: 72, style: 'display', weight: 500, color: INK.text });
  ops.push({ op: 'text', x: W - M, y, text: 'mean CIEDE2000 through a reduced S-CIELAB eye, at each preset\'s viewing distance', size: 26, style: 'mono', color: INK.muted, align: 'right' });
  y += 50;
  for (const [name, src] of Object.entries(sources)) {
    ops.push({ op: 'rect', x: M, y, w: W - 2 * M, h: 2, fill: INK.rule }); y += 56;
    ops.push({ op: 'text', x: M, y, text: name === 'bow' ? 'Rainbow render (out/refraction)' : 'Newton\'s rings render (out/rings)', size: 36, style: 'display', weight: 500, color: INK.text }); y += 28;
    const tiles = [{ title: 'Source', img: fit(src, TW, TH), lines: ['24-bit sRGB, area-reduced', null] }];
    numbers[name] = [];
    for (const p of PRESETS) {
      const t = runTile(src, p); numbers[name].push(t.stats);
      const S = t.stats, at = `at ${S.ppd.toFixed(0)} ppd`, px = p.scale === 'pixel' ? ', shown 2x' : '';
      const l1 = p.axis ? `dL* ${f2(S.meanDL)} ${at} (one-axis ink)` : `dE00 ${f2(S.mean)} ${at}`;
      const l2 = p.axis ? `dE00 ${f2(S.mean)}: chroma not held${px}` : S.metamerPPD ? `metamer from ${S.metamerPPD} ppd${px}` : `no metamer up to 360 ppd${px}`;
      tiles.push({ title: p.title, img: t.img, lines: [l1, l2] });
    }
    const legend = name === 'bow'
      ? ['Each tile: the preset at its period', 'viewing distance (pixels per degree).', 'dE00: CIEDE2000 after the eye filter.', 'Metamer: lowest ppd on a ladder', '(10 to 360) with mean dE00 under 3.', 'Dither runs in linear light.']
      : ['Checks, PREREG 2026-10-28:', 'dither under 3 at 60 ppd: held', 'nearest above 6: held on bow, grey,', '  dark; missed on red-cyan (5.68)', 'two-ink overlap = P x T1 x T2: held', 'halftone area within 0.5%: held',
          'banding ratio: Bayer 4x4 missed (5.1)', 'duotone 8-bit line bound: missed'];
    legend.forEach((ln, i) => ops.push({ op: 'text', x: M + 5 * (TW + GAP), y: y + TH + 120 + 40 + i * 40, text: ln, size: 23, style: 'mono', color: i === 0 ? INK.text : INK.muted }));
    tiles.forEach((t, k) => {
      const cx = M + (k % COLS) * (TW + GAP), cy = y + Math.floor(k / COLS) * (TH + 120), key = `${name}-${k}`;
      images[key] = t.img; ops.push({ op: 'image', x: cx, y: cy, w: TW, h: TH, src: key });
      label(ops, cx, cy + TH + 40, t.title, t.lines[0], t.lines[1]);
    });
    y += 2 * (TH + 120) + 20;
  }
  return { spec: { id: 'quantize-compare', title: 'Era quantizer', w: W, h: y + M, ground: INK.ground, ops, images }, numbers };
}

// Detail: the source at 960 x 540, each preset run at that size, a 76 x 76 crop shown at 8x.
function detailPlate(sources, at) {
  const ops = [], images = {}, CS = 76, Z = 8, DT = CS * Z, DC = 6, DG = (W - 2 * M - DC * DT) / (DC - 1); let y = M + 70;
  ops.push({ op: 'text', x: M, y, text: 'Era quantizer, detail at 8x', size: 72, style: 'display', weight: 500, color: INK.text }); y += 60;
  for (const [name, src] of Object.entries(sources)) {
    const [cx0, cy0] = at[name], list = [{ title: 'Source', run: s => s }, ...PRESETS];
    list.forEach((p, k) => {
      const x = M + (k % DC) * (DT + DG), yy = y + Math.floor(k / DC) * (DT + 90), key = `${name}-d${k}`;
      images[key] = upscale(crop(p.run(src), cx0, cy0, CS, CS), Z);
      ops.push({ op: 'image', x, y: yy, w: DT, h: DT, src: key });
      ops.push({ op: 'text', x, y: yy + DT + 44, text: `${name}: ${p.title}`, size: 30, style: 'display', weight: 500, color: INK.text });
    });
    y += Math.ceil(list.length / DC) * (DT + 90) + 30;
  }
  return { id: 'quantize-detail', title: 'Era quantizer detail', w: W, h: y + M, ground: INK.ground, ops, images };
}

mkdirSync(OUT, { recursive: true });
const full = { bow: loadRender('bow', 1), rings: loadRender('rings', 1) };
const { spec, numbers } = comparePlate(full);
const A = renderPlate(spec); writeFileSync(new URL("plate-compare.png", OUT), await pngOf(A));
const mid = { bow: reduce(full.bow, 4), rings: reduce(full.rings, 4) };
const B = renderPlate(detailPlate(mid, { bow: [455, 175], rings: [610, 230] })); writeFileSync(new URL("plate-detail.png", OUT), await pngOf(B));
writeFileSync(new URL('plate.json', OUT), JSON.stringify({ made: new Date().toISOString(), compare: [A.w, A.h], detail: [B.w, B.h], numbers }, null, 2));
console.log(`plate-compare ${A.w}x${A.h}, plate-detail ${B.w}x${B.h}`);
