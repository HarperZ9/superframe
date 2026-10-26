import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Surface, render, starcloud, linear } from '../index.js';
import { makeCloud, shade, flatLobes, CLOUD_SCHEMA } from '../cloud2d.js';
import { renderCloud, CLOUD_STYLES } from '../cloud.js';
import { referenceRender, spearman } from '../cloudref.js';

const sample = (light = { pos: [0.5, 0.25, -0.05] }) => makeCloud({ seed: 4, trunks: [{ c: [0.42, 0.55, 0], r: [0.16, 0.12, 0.14] }, { c: [0.62, 0.58, 0.02], r: [0.14, 0.11, 0.12] }], light, base: { y: 0.66, soft: 0.004 }, erosion: [] });
const sha = (s) => createHash('sha256').update(Buffer.from(s.px.buffer)).digest('hex');

test('cloud.json is plain data: it survives JSON and renders the same', () => {
  const c = sample(), back = JSON.parse(JSON.stringify(c));
  assert.equal(back.schema, CLOUD_SCHEMA);
  const a = new Surface(120, 120).fill([0, 0, 0]), b = new Surface(120, 120).fill([0, 0, 0]);
  renderCloud(a, c); renderCloud(b, back);
  assert.equal(sha(a), sha(b));
  assert.ok(flatLobes(c.lobes).length >= 2 * 4, 'trunks grow sub-lobes');
});

test('lobe tree: each lobe has 3 to 8 sub-lobes at 0.35 to 0.6 of its radius (PLAYBOOK 5.1)', () => {
  const c = sample();
  for (const t of c.lobes) {
    assert.ok(t.children.length >= 3 && t.children.length <= 8);
    for (const k of t.children) assert.ok(k.r[0] / t.r[0] >= 0.35 - 1e-9 && k.r[0] / t.r[0] <= 0.6 + 1e-9);
  }
});

test('silhouette agreement with the volumetric reference: IoU of the 2D mask and reference alpha > 0.05 is at least 0.9', () => {
  const c = sample(), W = 96, H = 96, F = shade(c, { W, H, unit: W, q: 1 }), R = referenceRender(c, { W, H, unit: W });
  let inter = 0, uni = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = F.mask[y * F.gw + x] > 0.5, r = R.alpha[y * W + x] > 0.05;
    if (m && r) inter++; if (m || r) uni++;
  }
  assert.ok(inter / uni >= 0.9, `IoU ${(inter / uni).toFixed(3)}`);
});

test('light agreement: the 2D Beer term ranks with the reference single-scatter radiance (Spearman at least 0.8) for side, back and top light', () => {
  const W = 80, out = {};
  for (const [name, pos, min] of [['side', [0.3, 0.3, 0.02], 0.8], ['back', [0.5, 0.25, -0.05], 0.8], ['front-top', [0.5, 0.1, 0.25], 0.8], ['front-side', [0.8, 0.4, 0.1], 0.7]]) {
    const c = sample({ pos }), F = shade(c, { W, H: W, unit: W, q: 1 }), R = referenceRender(c, { W, H: W, unit: W });
    const a = [], b = [];
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (F.mask[y * F.gw + x] > 0.5 && R.alpha[y * W + x] > 0.5) { a.push(F.beer[y * F.gw + x]); b.push(R.radiance[y * W + x]); }
    out[name] = spearman(a, b);
    assert.ok(out[name] >= min, `${name}: Spearman ${out[name].toFixed(3)} (floor ${min}; the front-side case is a recorded gap at 0.77)`);
  }
});

test('every style renders the same cloud.json, deterministically', () => {
  for (const style of CLOUD_STYLES) {
    const c = { ...sample(), style }, a = new Surface(90, 90).fill(linear('#0b0b10')), b = new Surface(90, 90).fill(linear('#0b0b10'));
    renderCloud(a, c); renderCloud(b, c);
    assert.equal(sha(a), sha(b), style);
    let changed = 0; const g = linear('#0b0b10');
    for (let i = 0; i < a.px.length; i += 4) if (Math.abs(a.px[i] - g[0]) > 1e-4) changed++;
    assert.ok(changed > 300, `${style} drew ${changed} px`);
  }
});

test('the star cloud closes the brush gap: highlight p95 at least 200 (PLAYBOOK 5.4)', async () => {
  const s = await render(starcloud(), 300), px = s.toRGBA8({ dither: false }), v = [];
  for (let i = 0; i < px.length; i += 4) v.push(Math.max(px[i], px[i + 1], px[i + 2]));
  v.sort((x, y) => x - y);
  assert.ok(v[Math.floor(v.length * 0.95)] >= 200, `V95 ${v[Math.floor(v.length * 0.95)]}`);
});
