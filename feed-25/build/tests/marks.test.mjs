// Sources, HUD marks, numerals and glyphs: the marks must point at real features.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chladni, crossings, antinodes, swimmers, readPPM, plate, layer, numerals, hud, glyphs } from '../compose.mjs';

test('pure membrane mode (n, m) has (n-1)(m-1) interior crossings at k/n, j/m', () => {
  const c = crossings(3, 4, 0); assert.equal(c.length, 6);
  for (const [u, v] of c) { assert.ok(Math.abs(u * 3 - Math.round(u * 3)) < 0.02); assert.ok(Math.abs(v * 4 - Math.round(v * 4)) < 0.02); }
});

test('pure membrane mode (n, m) has n x m antinodes', () => { assert.equal(antinodes(3, 4, 0).length, 12); });

test('chladni tile records its mode and its crossings', () => {
  const L = chladni(64, 64, { n: 2, m: 3, mix: 0 }); assert.equal(L.meta.chladni.n, 2); assert.equal(L.meta.chladni.crossings.length, 2);
});

test('swimmer colony reports points inside the layer and a centre of mass', () => {
  const L = swimmers(200, 80, { steps: 60, count: 20 }), c = L.meta.colony;
  assert.equal(c.points.length, c.swimmers); for (const [x, y] of c.points) { assert.ok(x >= 0 && x <= 200); assert.ok(y >= 0 && y <= 80); }
});

test('readPPM reads a P6 file and plate() fills the box', () => {
  const bytes = new Uint8Array([...Buffer.from('P6\n2 1\n255\n'), 255, 0, 0, 0, 0, 255]), img = readPPM(bytes);
  assert.equal(img.w, 2); assert.equal(img.data[5], 255);
  const P = plate(img, 10, 6); assert.equal(P.w, 10); assert.equal(P.h, 6);
});

test('the plates on disk load and are PD or CC0', () => {
  const meta = JSON.parse(fs.readFileSync(new URL('../plates/plates.json', import.meta.url))); assert.ok(Object.keys(meta).length >= 6);
  for (const v of Object.values(meta)) assert.match(v.licence, /^(pd|cc0)$/);
});

test('numerals: every glyph is 5 x 7, glyphs are distinct, unknown characters throw', () => {
  const seen = new Map();
  for (const g of numerals.GLYPHS) {
    const b = numerals.bitmap(g); assert.equal(b.length, 7); for (const r of b) assert.equal(r.length, 5);
    const k = b.join(''); if (g !== ' ') { assert.ok(!seen.has(k), `${g} repeats ${seen.get(k)}`); seen.set(k, g); }
  }
  assert.throws(() => numerals.text(layer(50, 20), '@', 0, 0));
  assert.equal(numerals.measure('12', 2), 22);
});

test('plexus links exactly the pairs closer than the radius', () => {
  const pts = [[0, 0], [5, 0], [20, 0], [24, 3]], n = hud.plexus(layer(40, 10), pts, 6);
  assert.equal(n, 2);
});

test('hatchBox draws nothing outside its box', () => {
  const S = layer(60, 60, { fill: '#000000' }); hud.hatchBox(S, 20, 20, 20, 20, { spacing: 3, ink: '#ffffff', w: 1, frame: false });
  for (let y = 0; y < 60; y++) for (let x = 0; x < 60; x++) if (x < 18 || x > 41 || y < 18 || y > 41) assert.equal(S.px[3 * (y * 60 + x)], 0);
});

test('glyph discs sit inside the glyph body, and painting is deterministic', () => {
  const g = glyphs.design(7), a = layer(300, 300, { fill: '#e2e5df' }), b = layer(300, 300, { fill: '#e2e5df' });
  const placed = glyphs.paint(a, g, 20, 20, 260, { seed: 3 }); glyphs.paint(b, g, 20, 20, 260, { seed: 3 });
  assert.deepEqual(a.px, b.px); const D = glyphs.distance(g, 20, 20, 260, 300, 300, 10);
  for (const [x, y] of placed) assert.ok(D[y * 300 + x] < 0, 'disc centre outside the body');
});
