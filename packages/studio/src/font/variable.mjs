// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// variable.mjs: a minted family shipped as ONE variable font with a weight axis. A port of Flywheel's
// harness/typeface_variable.py and the mint_variable_family half of typeface_family.py
// (HarperZ9/flywheel@681810fe).
//
// The family mints one seed at several weights, so every master shares its skeleton bones. The writer checks
// that the masters can interpolate (same glyph set, same point count and contour split per glyph) and refuses
// by name when they cannot. The median weight is the default master and the base glyf; every other master
// adds gvar deltas (the per-point offsets a font renderer applies along the axis), and fvar names one
// instance per master.
//
//   const out = mintVariableFamily({}, { seed: 58 });      // { refused, refusals, ttf, masters, refusedInstances }
import { mint, DEFAULTS } from '../../../../typeface/forge/lib/forge.mjs';
import { pack, concat, Bytes } from './struct.mjs';
import { pyRound } from '../../../../typeface/forge/lib/pyround.mjs';
import { glyfEntry, cmap, name, sfnt, pad4, round, sortedKeys, glyphContours, tableHead, tableHhea, tableMaxp, tablePost, tableHmtx } from './ttf.mjs';

const EPOCH = 3849984000n;   // fixed timestamp, so the same masters hash the same font

// The default line: four weights that stay inside the counter rules (the source's INSTANCES).
export const INSTANCES = Object.freeze([['Light', 0.058], ['Regular', 0.085], ['Medium', 0.112], ['Bold', 0.145]]);

// Exact point list per glyph in glyf order, plus the advance; mirrors glyfEntry so deltas line up.
function glyphPoints(face, order) {
  const out = {};
  for (const g of order) {
    if (g === '.notdef' || g === 'space') { out[g] = { points: [], ends: [], advance: g === '.notdef' ? 600 : 250 }; continue; }
    const points = [], ends = [];
    for (const ctr of glyphContours(face.glyphs[g])) { points.push(...ctr); ends.push(points.length - 1); }
    out[g] = { points, ends, advance: round(face.glyphs[g].advance) };
  }
  return out;
}

// Why these masters cannot interpolate, or null when they can.
function incompatible(masters) {
  const { order, pts: base } = masters[0];
  for (const m of masters.slice(1)) {
    if (JSON.stringify(m.order) !== JSON.stringify(order)) return 'masters carry different glyph sets';
    for (const g of order) {
      if (m.pts[g].points.length !== base[g].points.length) return `glyph '${g}' has a different point count across weights`;
      if (JSON.stringify(m.pts[g].ends) !== JSON.stringify(base[g].ends)) return `glyph '${g}' has a different contour split across weights`;
    }
  }
  return null;
}

const f2dot14 = v => Math.max(-0x8000, Math.min(0x7fff, pyRound(v * 16384)));
const fix = v => Math.max(-0x80000000, Math.min(0x7fffffff, pyRound(v * 65536)));
const small = v => v >= -128 && v <= 127;

// gvar packed deltas: runs of zeros, bytes or words, at most 64 per run.
export function packDeltas(vals) {
  const out = new Bytes(), n = vals.length;
  let i = 0;
  while (i < n) {
    let j = i;
    if (vals[i] === 0) {
      while (j < n && vals[j] === 0 && j - i < 64) j++;
      out.push(Uint8Array.of(0x80 | (j - i - 1)));
    } else if (small(vals[i])) {
      while (j < n && small(vals[j]) && vals[j] !== 0 && j - i < 64) j++;
      out.push(Uint8Array.of(j - i - 1), pack(`>${j - i}b`, ...vals.slice(i, j)));
    } else {
      while (j < n && !small(vals[j]) && j - i < 64) j++;
      out.push(Uint8Array.of(0x40 | (j - i - 1)), pack(`>${j - i}h`, ...vals.slice(i, j)));
    }
    i = j;
  }
  return out.bytes();
}

// One glyph's variation data across every non-default master; points include the 4 phantom points.
function glyphVariation(basePts, masterPts, peaks, inters) {
  const headers = new Bytes(), datas = new Bytes();
  masterPts.forEach((mp, k) => {
    const dx = basePts.map((b, i) => mp[i][0] - b[0]), dy = basePts.map((b, i) => mp[i][1] - b[1]);
    const body = concat(Uint8Array.of(0), packDeltas(dx), packDeltas(dy));   // 0x00 = all points
    // embedded peak + intermediate region + private point numbers (all points)
    headers.push(pack('>HHhhh', body.length, 0x8000 | 0x4000 | 0x2000, f2dot14(peaks[k]), f2dot14(inters[k][0]), f2dot14(inters[k][1])));
    datas.push(body);
  });
  return concat(pack('>HH', masterPts.length, 4 + headers.length), headers.bytes(), datas.bytes());
}

const withPhantoms = g => [...g.points, [0, 0], [g.advance, 0], [0, 0], [0, 0]];

function buildGvar(order, base, otherPts, peaks, inters) {
  const data = new Bytes(), offsets = [0];
  for (const g of order) {
    if (base[g].points.length) data.push(pad4(glyphVariation(withPhantoms(base[g]), otherPts.map(op => withPhantoms(op[g])), peaks, inters)));
    offsets.push(data.length);
  }
  const n = order.length;
  return concat(pack('>HHHHLHHL', 1, 0, 1, 0, 0, n, 0x0001, 20 + 4 * (n + 1)), pack(`>${offsets.length}L`, ...offsets), data.bytes());
}

// Peak and region per non-default master: each peaks at its own coordinate and its region runs to the
// neighbouring master (or to 0 toward the default), so masters do not bleed into each other.
function regions(coords) {
  const negs = coords.filter(c => c < 0).sort((a, b) => a - b), poss = coords.filter(c => c > 0).sort((a, b) => a - b);
  return coords.map(c => {
    if (c < 0) { const below = negs.filter(x => x < c); return [below.length ? Math.max(...below) : -1.0, 0.0]; }
    const above = poss.filter(x => x > c);
    return [0.0, above.length ? Math.min(...above) : 1.0];
  });
}

// masters: [{ weight, face, style }]. Returns { ttf: Uint8Array } or { error }.
export function toVariableTtf(masters, family = 'Zain Mint') {
  if (masters.length < 2) return { error: 'a variable font needs at least two masters' };
  const order = ['.notdef', 'space', ...sortedKeys([...masters].sort((a, b) => a.weight - b.weight)[0].face.glyphs)];
  const ms = [...masters].sort((a, b) => a.weight - b.weight).map(m => ({ ...m, order, pts: glyphPoints(m.face, order) }));
  const why = incompatible(ms);
  if (why) return { error: why };

  const lo = ms[0].weight, hi = ms.at(-1).weight, dflt = ms[Math.floor(ms.length / 2)], dw = dflt.weight;
  const norm = w => (w === dw ? 0.0 : w > dw ? (w - dw) / (hi - dw) : (w - dw) / (dw - lo));
  const others = ms.filter(m => m !== dflt), peaks = others.map(m => norm(m.weight)), inters = regions(peaks);

  const glyf = new Bytes(), loca = [0], hmtx = [];
  let gxmin = 32767, gymin = 32767, gxmax = -32768, gymax = -32768, maxPts = 0, maxCtrs = 0;
  for (const g of order) {
    const gp = dflt.pts[g];
    if (!gp.points.length) { hmtx.push([gp.advance, 0]); loca.push(glyf.length); continue; }
    const contours = [];
    let k = 0;
    for (const end of gp.ends) { contours.push(gp.points.slice(k, end + 1)); k = end + 1; }
    const [entry, [x0, y0, x1, y1], npts, nctr] = glyfEntry(contours);
    glyf.push(pad4(entry));
    loca.push(glyf.length);
    hmtx.push([gp.advance, x0]);
    gxmin = Math.min(gxmin, x0); gymin = Math.min(gymin, y0); gxmax = Math.max(gxmax, x1); gymax = Math.max(gymax, y1);
    maxPts = Math.max(maxPts, npts); maxCtrs = Math.max(maxCtrs, nctr);
  }

  const n = order.length, ascent = Math.max(gymax + 60, 900), descent = Math.min(gymin - 40, -180);
  // fvar: one wght axis in OS/2 weight-class units, then a named instance per master (subfamily name ids 256+).
  const uweight = w => Math.max(1, Math.min(1000, pyRound(w * 4706)));
  const fvar = new Bytes().push(pack('>HHHHHHHH', 1, 0, 16, 2, 1, 20, ms.length, 8))
    .push(pack('>4slllHH', 'wght', fix(uweight(lo)), fix(uweight(dw)), fix(uweight(hi)), 0, 1));
  const nameExtra = [];
  ms.forEach((m, i) => { fvar.push(pack('>HHl', 256 + i, 0, fix(uweight(m.weight)))); nameExtra.push([256 + i, m.style]); });

  const cmapMap = new Map([[32, 1]]);
  sortedKeys(ms[0].face.glyphs).forEach((c, i) => cmapMap.set(c.codePointAt(0), 2 + i));
  const tables = {
    cmap: cmap(cmapMap), glyf: glyf.bytes(), head: tableHead(gxmin, gymin, gxmax, gymax, EPOCH, 1), hhea: tableHhea(ascent, descent, hmtx, gxmax, n),
    hmtx: tableHmtx(hmtx), loca: pack(`>${loca.length}L`, ...loca), maxp: tableMaxp(n, maxPts + 4, maxCtrs),
    name: name(family, 'Regular', nameExtra), post: tablePost(), fvar: fvar.bytes(),
    gvar: buildGvar(order, dflt.pts, others.map(m => m.pts), peaks, inters),
  };
  return { ttf: sfnt(tables) };
}

// Mint each named weight from one seed and ship the survivors as one variable font. Instances the
// legibility rules refuse are listed by name, never dropped silently.
export function mintVariableFamily(params = {}, { seed = 58, family = 'Zain Mint', instances = INSTANCES } = {}) {
  const base = { ...DEFAULTS, ...params };
  delete base.weight;
  const masters = [], refusedInstances = [];
  for (const [style, weight] of instances) {
    const face = mint({ ...base, weight: Number(weight) }, seed);
    if (face.refused) refusedInstances.push({ style: String(style), weight: Number(weight), refusals: face.refusals });
    else masters.push({ style: String(style), weight: Number(weight), face });
  }
  if (masters.length < 2) return { refused: true, refusals: ['a variable font needs at least two surviving masters'], refusedInstances };
  const out = toVariableTtf(masters, family);
  if (out.error) return { refused: true, refusals: [out.error], refusedInstances };
  return { refused: false, refusals: [], ttf: out.ttf, masters: masters.map(({ style, weight }) => ({ style, weight })), refusedInstances };
}
