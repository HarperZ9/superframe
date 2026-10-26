import { test } from "node:test";
import assert from "node:assert/strict";
import { reflectance, filmLinear, filmRgb8, filmLut, filmStops, filmGradientSvg, hex, WAVELENGTHS } from "../thinfilm.mjs";

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("a vanishing soap film is black, and without the flip it is white", () => {
  assert.deepEqual(filmRgb8(0), [0, 0, 0]);
  assert.deepEqual(filmRgb8(0, { flip: false }), [255, 255, 255]);
});

test("first-order maximum sits at a quarter wave: d = lambda / (4 n)", () => {
  const n = 1.33, d = WAVELENGTHS.g / (4 * n);
  close(reflectance(d, WAVELENGTHS.g, { n }), 1);
  close(reflectance(2 * d, WAVELENGTHS.g, { n }), 0);
});

test("reflectance is periodic in thickness with period lambda / (2 n cos theta)", () => {
  const n = 1.4, cosTheta = 0.8, lam = 600, period = lam / (2 * n * cosTheta);
  for (const d of [37, 150, 412]) close(reflectance(d, lam, { n, cosTheta }), reflectance(d + period, lam, { n, cosTheta }));
});

test("a tilted view needs a thicker film for the same colour", () => {
  const flat = reflectance(100, 532), tilted = reflectance(100 / 0.8, 532, { cosTheta: 0.8 });
  close(flat, tilted);
});

test("as the film thickens the colour walks yellow, magenta, blue, cyan, green (n = 1.33)", () => {
  const tone = (d) => { const [r, g, b] = filmLinear(d); return { r, g, b }; };
  const yellow = tone(150), magenta = tone(200), blue = tone(250), cyan = tone(270), green = tone(300);
  assert.ok(yellow.r > yellow.g && yellow.g > yellow.b, "150 nm: red over green over blue, a warm yellow");
  assert.ok(magenta.r > 0.2 && magenta.b > 0.2 && magenta.g < 0.05, "200 nm: green suppressed, magenta");
  assert.ok(blue.b > blue.g && blue.g > blue.r, "250 nm: blue dominant");
  assert.ok(cyan.g > 0.7 && cyan.b > 0.7 && cyan.r < 0.2, "270 nm: green and blue, cyan");
  assert.ok(green.g > green.r && green.g > green.b, "300 nm: green dominant");
});

test("the lookup table matches direct evaluation at its ends and is deterministic", () => {
  const lut = filmLut({ dMin: 0, dMax: 900, steps: 64 });
  assert.equal(lut.length, 64 * 3);
  assert.deepEqual([...lut.slice(0, 3)], filmRgb8(0));
  assert.deepEqual([...lut.slice(63 * 3)], filmRgb8(900));
  assert.deepEqual(lut, filmLut({ dMin: 0, dMax: 900, steps: 64 }));
  assert.throws(() => filmLut({ steps: 1 }), /steps/);
});

test("stops and the SVG gradient are well formed", () => {
  const s = filmStops({ count: 5 });
  assert.equal(s.length, 5);
  assert.equal(s[0].offset, 0);
  assert.equal(s[4].offset, 1);
  for (const st of s) assert.match(st.color, /^#[0-9a-f]{6}$/);
  const g = filmGradientSvg("film<x>", { count: 3 });
  assert.match(g, /^<linearGradient id="filmx"/);
  assert.equal((g.match(/<stop /g) || []).length, 3);
  assert.match(filmGradientSvg("f", { line: [0, 0, 240, 150] }), /gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="150"/);
  assert.equal(hex([255, 0, 16]), "#ff0010");
  assert.throws(() => reflectance(10, 0), /above 0/);
});
