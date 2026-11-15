// The painter's own tests: node --test game/engine/paint/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { mix, glaze, ks, rOf, toByte, toLin } from "../km.mjs";
import { paletteAt, SLOTS } from "../palette.mjs";
import { strokeAt, hash4 } from "../strokes.mjs";
import { planeValue } from "../planes.mjs";
import { makePainter } from "../painter.mjs";
import { tables } from "../install.mjs";
import { figure } from "./fixture.mjs";

const chroma = (c) => Math.max(...c) - Math.min(...c);
const MATS = { coat: { id: 1 }, skin: { id: 4 }, hat: { id: 6 }, cheek: { id: 29 }, jawcool: { id: 39 }, eye: { id: 15 } };

test("Kubelka-Munk: endpoints, the inverse, paint-like mixing, and glazes keep value (T6)", () => {
  for (const R of [0.01, 0.2, 0.5, 0.9]) assert.ok(Math.abs(rOf(ks(R)) - R) < 1e-6);
  assert.deepEqual(mix([0.2, 0.3, 0.4], [0.9, 0.1, 0.1], 0), [0.2, 0.3, 0.4]);
  // blue and yellow paint make green; an RGB average makes grey
  const blue = [0.05, 0.12, 0.55], yellow = [0.85, 0.75, 0.05], km = mix(blue, yellow, 0.5), rgb = blue.map((v, i) => (v + yellow[i]) / 2);
  assert.ok(km[1] > km[0] && km[1] > km[2], `KM mix is green: ${km.map((v) => v.toFixed(3))}`);
  assert.ok(km[1] - Math.max(km[0], km[2]) > rgb[1] - Math.max(rgb[0], rgb[2]), "greener than the RGB average");
  // complementary paints go to a dark warm neutral (lower than either source), as on a palette
  const violet = [0.12, 0.06, 0.3], sodium = [0.6, 0.25, 0.05], d = mix(violet, sodium, 0.5), y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  assert.ok(y(d) < y(violet.map((v, i) => (v + sodium[i]) / 2)), "the pigment mix is darker than the light mix");
  assert.ok(d[0] > d[2], "and leans warm");
  const g = glaze([0.1, 0.1, 0.1], [1, 0.5, 0.1], 0.6);
  assert.ok(Math.abs(y(g) - 0.1) < 1e-3, "a glaze keeps the base value");
});

test("sRGB encode table agrees with the formula", () => {
  for (let b = 0; b < 256; b += 5) assert.ok(Math.abs(toByte(toLin(b)) - b) <= 1, `byte ${b}`);
});

test("palettes blend continuously round the clock: under 1 delta (linear, x100) per game minute (T5)", () => {
  for (const place of ["quay", "brine", "floor", "gut"]) {
    let worst = 0, prev = paletteAt(place, 0);
    for (let m = 1; m <= 1440; m++) {
      const p = paletteAt(place, m / 60);
      for (const k of ["shadowA", "shadowB", "light", "haze"]) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(p[k][c] - prev[k][c]) * 100);
      prev = p;
    }
    assert.ok(worst < 1, `${place}: ${worst.toFixed(3)}`);
  }
  assert.equal(SLOTS.length, 8);
});

test("value planes keep order (a lighter stroke never paints darker)", () => {
  const P = paletteAt("quay", 23).planes; let last = 0;
  for (let L = 0.001; L < 1; L *= 1.05) { const v = planeValue(L, P); assert.ok(v >= last - 1e-9, `at ${L}`); last = v; }
});

test("strokes are a function of the bind point: the same point gets the same stroke", () => {
  const a = strokeAt(0.11, 1.2, 0.05, 0.05, 0, 1, 0.5, true), k = a.key;
  const b = strokeAt(0.11, 1.2, 0.05, 0.05, 0, 1, 0.5, true);
  assert.equal(b.key, k);
  assert.notEqual(hash4(1, 2, 3, 4), hash4(1, 2, 3, 5));
});

test("a full layer covers every point; a partial one leaves gaps", () => {
  let missFull = 0, missPart = 0;
  for (let i = 0; i < 2000; i++) { const p = [Math.sin(i) * 0.3, 1 + Math.cos(i * 1.3) * 0.4, Math.sin(i * 0.7) * 0.2]; if (!strokeAt(p[0], p[1], p[2], 0.04, 0, 1, 0.3, true)) missFull++; if (!strokeAt(p[0], p[1], p[2], 0.04, 1, 1, 0.3, false)) missPart++; }
  assert.equal(missFull, 0); assert.ok(missPart > 0);
});

test("the painter repaints only figure pixels and keeps alpha", () => {
  const P = makePainter({ ...tables(MATS) }), F = figure({ w: 120, h: 250, ppm: 87 }), before = Uint8ClampedArray.from(F.rgba);
  P.paint(F.rgba, F.w, F.h, F.G, 1, { key: "t", ppm: 87, yawDeg: 26, palette: paletteAt("quay", 23), haze: 0 });
  let changed = 0, outside = 0;
  for (let i = 0; i < F.w * F.h; i++) { assert.equal(F.rgba[i * 4 + 3], before[i * 4 + 3]); const d = Math.abs(F.rgba[i * 4] - before[i * 4]) + Math.abs(F.rgba[i * 4 + 1] - before[i * 4 + 1]); if (d) { if (before[i * 4 + 3]) changed++; else outside++; } }
  assert.ok(changed > 1000); assert.equal(outside, 0);
});

test("walking and turning figure: bind-anchored strokes stay on the body, screen-anchored ones slide (T2 in miniature)", () => {
  const run = (anchor) => {
    const P = makePainter({ ...tables(MATS), imageFlow: 0 }); globalThis.__lwPaintTrace = { who: "t", frames: [] };
    for (let f = 0; f < 6; f++) { const F = figure({ w: 120, h: 250, ppm: 87, yaw: f * 0.01, dx: f * 0.023 }); P.paint(F.rgba, F.w, F.h, F.G, 1, { key: "t", ppm: 87, yawDeg: 26, palette: paletteAt("quay", 23), haze: 0, anchor }); }
    const T = globalThis.__lwPaintTrace.frames; globalThis.__lwPaintTrace = null;
    let same = 0, n = 0;
    for (let f = 1; f < T.length; f++) {
      const A = T[f - 1], B = T[f], m = new Map();
      for (let q = 0; q < B.idx.length; q++) m.set(`${Math.round(B.loc[q * 3] * 400)},${Math.round(B.loc[q * 3 + 1] * 400)},${Math.round(B.loc[q * 3 + 2] * 400)}`, B.key[q]);
      for (let q = 0; q < A.idx.length; q++) { const k = m.get(`${Math.round(A.loc[q * 3] * 400)},${Math.round(A.loc[q * 3 + 1] * 400)},${Math.round(A.loc[q * 3 + 2] * 400)}`); if (k === undefined) continue; n++; if (k === A.key[q]) same++; }
    }
    return same / n;
  };
  const bind = run("bind"), screen = run("screen");
  assert.ok(bind > 0.9, `bind kept ${bind}`); assert.ok(screen < bind - 0.1, `screen kept ${screen} against bind ${bind}`);
});
