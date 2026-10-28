// marble.test.mjs: marbling between sources keeps provenance. The inverse is exact, each source keeps a share
// of the bath equal to its weight, another seed gives a new arrangement with the same weights, and each check has a
// control it must reject.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lay, provenance, carry, read, shares, contacts, core, render, unmarble } from '../lib/marble/bath.mjs';

const SOURCES = [{ id: 'a', weight: 3 }, { id: 'b', weight: 2 }, { id: 'c', weight: 1 }, { id: 'd', weight: 2 }];
const hash = a => createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex');
const disk = rnd => { for (;;) { const u = 2 * rnd() - 1, v = 2 * rnd() - 1; if (u * u + v * v < 0.98) return [u, v]; } };
let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('provenance inverts the marbling exactly', () => {
  const bath = lay({ size: [400, 400], sources: SOURCES, seed: 'inv', tines: 8 });
  let worst = 0;
  for (let k = 0; k < SOURCES.length; k++) for (let i = 0; i < 400; i++) {
    const [u, v] = disk(rnd), [x, y] = carry(bath, k, u, v), p = provenance(bath, x, y);
    assert.equal(p.src, k);
    worst = Math.max(worst, Math.hypot(p.u - u, p.v - v));
  }
  assert.ok(worst < 1e-6, `round trip error ${worst}`);
});

test('control: a wrong inverse (one tine misread) is caught by the round trip', () => {
  const bath = lay({ size: [400, 400], sources: SOURCES, seed: 'inv', tines: 8 });
  const wrong = { ...bath, ops: bath.ops.map((o, i) => (o.kind === 'tine' && i === bath.ops.length - 1 ? { ...o, z: o.z * 1.05 } : o)) };
  let worst = 0, lost = 0;
  for (let k = 0; k < SOURCES.length; k++) for (let i = 0; i < 400; i++) {
    const [u, v] = disk(rnd), [x, y] = carry(bath, k, u, v), p = provenance(wrong, x, y);
    if (p.src !== k) lost++; else worst = Math.max(worst, Math.hypot(p.u - u, p.v - v));
  }
  assert.ok(lost > 0 || worst > 1e-3, `the misread tine passed: lost ${lost}, worst ${worst}`);
});

const FILL = 0.2, frameShare = (w, i) => FILL * w / SOURCES.reduce((a, x) => a + x.weight, 0);

test('each source keeps a share of the bath equal to its weight', () => {
  const bath = lay({ size: [600, 600], sources: SOURCES, seed: 'area', fill: FILL, comb: 0.04 });
  const sh = shares(read(bath), SOURCES.length);
  SOURCES.forEach((x, i) => assert.ok(Math.abs(sh.sources[i] - frameShare(x.weight)) < 0.004, `${x.id}: ${sh.sources[i]} vs ${frameShare(x.weight)}`));
});

test('control: radius proportional to weight (not to its square root) breaks the shares', () => {
  const linear = (share, fill, w, h) => share * Math.sqrt(fill * w * h / Math.PI) * 1.6;
  const bath = lay({ size: [600, 600], sources: SOURCES, seed: 'area', fill: FILL, comb: 0.04, radiusOf: linear });
  const sh = shares(read(bath), SOURCES.length);
  const off = SOURCES.some((x, i) => Math.abs(sh.sources[i] - frameShare(x.weight)) >= 0.004);
  assert.ok(off, 'the area check accepted a non-area-true lay-in');
});

test('another seed: a new arrangement with the same weights', () => {
  const opts = { size: [600, 600], sources: SOURCES, fill: FILL, comb: 0.04 };
  const A = read(lay({ ...opts, seed: 'one' })), B = read(lay({ ...opts, seed: 'two' }));
  assert.notEqual(hash(A.src), hash(B.src));
  const a = shares(A, 4).sources, b = shares(B, 4).sources;
  a.forEach((x, i) => assert.ok(Math.abs(x - b[i]) < 0.006, `${i}: ${x} vs ${b[i]}`));
});

test('same seed, same bath, byte for byte', () => {
  const opts = { size: [200, 200], sources: SOURCES, seed: 'det' };
  assert.equal(hash(read(lay(opts)).src), hash(read(lay(opts)).src));
});

test('the readings agree with the map', () => {
  const bath = lay({ size: [300, 300], sources: SOURCES, seed: 'read', tines: 10 }), map = read(bath);
  const M = contacts(map, SOURCES.length);
  for (let i = 0; i < M.length; i++) { assert.equal(M[i][i], 0); for (let j = 0; j < M.length; j++) assert.equal(M[i][j], M[j][i]); }
  const runs = core(map, [0, 150], [300, 150], 300);
  assert.equal(runs.reduce((a, r) => a + r.len, 0), 300);
  const colours = [[200, 40, 40], [40, 120, 200], [230, 190, 40], [30, 30, 30]];
  const back = unmarble(map, render(map, colours), 2, 64);
  assert.ok(back.coverage > 0.5, `coverage ${back.coverage}`);
  for (let k = 0; k < back.rgba.length; k += 4) if (back.rgba[k + 3]) assert.deepEqual(Array.from(back.rgba.subarray(k, k + 3)), colours[2]);
});

// ---- concept inks
import { rings, readElements, conceptReading } from '../lib/marble/bath.mjs';
import { loadLibrary, sourcesFor, hasLibrary } from '../lib/marble/library.mjs';

const IDEAS = [
  { id: 's1', weight: 3, elements: [{ id: 'water', weight: 3 }, { id: 'turbulence', weight: 2 }, { id: 'light', weight: 1 }] },
  { id: 's2', weight: 2, elements: [{ id: 'ink', weight: 1 }, { id: 'grid', weight: 1 }] },
  { id: 's3', weight: 1, elements: [{ id: 'water', weight: 1 }, { id: 'spiral', weight: 3 }] },
];
// what each concept should cover: source share x element share x fill
const expected = () => {
  const T = IDEAS.reduce((a, s) => a + s.weight, 0), e = {};
  for (const s of IDEAS) { const t = s.elements.reduce((a, x) => a + x.weight, 0); for (const x of s.elements) e[x.id] = (e[x.id] ?? 0) + FILL * (s.weight / T) * (x.weight / t); }
  return e;
};

test('each concept keeps its weight share of the bath', () => {
  const bath = lay({ size: [600, 600], sources: IDEAS, seed: 'ideas', fill: FILL, comb: 0.04 }), map = read(bath);
  const got = conceptReading(bath, map, readElements(bath, map)).shares, want = expected();
  for (const [k, v] of Object.entries(want)) assert.ok(Math.abs(got[k] - v) < 0.003, `${k}: ${got[k]} vs ${v}`);
});

test('control: rings by radius (not by area) break the concept shares', () => {
  const byRadius = els => { const t = els.reduce((a, e) => a + e.weight, 0); let c = 0; return els.map(e => { c += e.weight / t; return c * c; }); };
  const bath = lay({ size: [600, 600], sources: IDEAS, seed: 'ideas', fill: FILL, comb: 0.04 }), map = read(bath);
  const got = conceptReading(bath, map, readElements(bath, map, byRadius)).shares, want = expected();
  assert.ok(Object.entries(want).some(([k, v]) => Math.abs((got[k] ?? 0) - v) >= 0.003), 'the share check accepted rings laid by radius');
});

test('rings: cumulative area shares end at 1 and follow the weights', () => {
  const c = rings([{ weight: 2 }, { weight: 1 }, { weight: 1 }]);
  assert.deepEqual(c.map(x => +x.toFixed(6)), [0.5, 0.75, 1]);
});

test('the reading separates a study\'s own borders from meetings the marbling made', () => {
  const bath = lay({ size: [400, 400], sources: IDEAS, seed: 'meet', tines: 10 }), map = read(bath), r = conceptReading(bath, map, readElements(bath, map));
  // sectors: neighbouring wedges, the last wrapping round to the first
  const inSource = new Set(IDEAS.flatMap(s => s.elements.map((e, i) => [e.id, s.elements[(i + 1) % s.elements.length].id].sort().join(' + '))));
  for (const x of r.within) assert.ok(inSource.has(x.pair), `within-study border ${x.pair} is not between neighbouring wedges`);
  assert.ok(r.across.length > 0, 'combing made no meetings across studies');
  const holds = id => IDEAS.map((s, i) => (s.elements.some(e => e.id === id) ? i : -1)).filter(i => i >= 0);
  for (const x of r.across) {
    const [a, b] = x.pair.split(' + ');
    assert.ok(holds(a).some(i => holds(b).some(j => j !== i)), `meeting ${x.pair} does not span two studies`);
  }
});

test('library studies load as concept inks, rarer concepts weighing more', { skip: !hasLibrary() && 'reference library not present' }, () => {
  const lib = loadLibrary(), ids = Object.keys(lib.units).filter(k => lib.units[k].concepts.length >= 4).slice(0, 3);
  const src = sourcesFor(lib, ids);
  assert.equal(src.length, 3);
  for (const s of src) {
    for (let i = 1; i < s.elements.length; i++) assert.ok(s.elements[i - 1].weight >= s.elements[i].weight);
    for (const e of s.elements) assert.ok(e.weight === Math.log(lib.n / lib.df.get(e.id)));
  }
  assert.throws(() => sourcesFor(lib, ['no-such-study']), /no study/);
});

// ---- fairness of the meetings (expected over seeds; one bath shows each drop to its neighbours on one side only)
import { exposure } from '../lib/marble/bath.mjs';
const MANY = [
  { id: 'p', weight: 1, elements: [{ id: 'a', weight: 4 }, { id: 'b', weight: 2 }, { id: 'c', weight: 1 }, { id: 'd', weight: 1 }, { id: 'e', weight: 1 }] },
  { id: 'q', weight: 1, elements: [{ id: 'f', weight: 3 }, { id: 'g', weight: 2 }, { id: 'h', weight: 1 }, { id: 'i', weight: 1 }] },
  { id: 'r', weight: 1, elements: [{ id: 'j', weight: 2 }, { id: 'k', weight: 2 }, { id: 'l', weight: 1 }] },
];
const expectedExposure = layout => {
  const agg = new Map(), K = 12;
  for (let k = 0; k < K; k++) {
    const bath = lay({ size: [256, 256], sources: MANY, seed: `fair/${k}`, fill: 0.5, comb: 0.08, tines: 8, layout }), map = read(bath);
    for (const r of exposure(bath, map, readElements(bath, map)).rows) { const a = agg.get(`${r.source}|${r.element}`) ?? { ink: 0, b: 0 }; a.ink += r.ink; a.b += r.ink * r.ratio; agg.set(`${r.source}|${r.element}`, a); }
  }
  const rows = [...agg.values()].map(a => ({ ink: a.ink, ratio: a.b / a.ink })), I = rows.reduce((s, r) => s + r.ink, 0);
  return { buried: rows.filter(r => r.ratio < 0.25).reduce((s, r) => s + r.ink, 0) / I, min: Math.min(...rows.map(r => r.ratio)) };
};

test('sectors: every idea meets the other studies, in expectation over seeds', () => {
  const e = expectedExposure('sectors');
  assert.ok(e.buried < 0.02 && e.min > 0.3, `sectors buried ${e.buried}, min ratio ${e.min}`);
});
test('control: rings bury their inner ideas', () => {
  const e = expectedExposure('rings');
  assert.ok(e.buried > 0.1 || e.min < 0.1, `rings passed the fairness check: buried ${e.buried}, min ratio ${e.min}`);
});
test('equal study weights: each study takes the same share of the bath', { skip: !hasLibrary() && 'reference library not present' }, () => {
  const lib = loadLibrary(), ids = Object.keys(lib.units).filter(k => lib.units[k].concepts.length >= 3).slice(0, 4);
  const src = sourcesFor(lib, ids), sh = shares(read(lay({ size: [400, 400], sources: src, seed: 'eq', fill: FILL, comb: 0.04 })), src.length).sources;
  for (const v of sh) assert.ok(Math.abs(v - FILL / src.length) < 0.003, `${v} vs ${FILL / src.length}`);
});
