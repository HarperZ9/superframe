// Origin: HarperZ9.github.io system/fractal-color.test.mjs at commit c8866cc4, carried with the module on 2026-11-14; imports repointed.
// Carried: the five tests that need fractal-color.js alone. Left on the site: the ten palette, ramp and shader-text tests,
// which need fractal.js (PALETTES), fractal-gl.js and fractal-glsl.js (not in this package yet).
// fractal-color.test.mjs — the colour recipe the Studio's two fractal renderers share.
//
// fractal.js runs these functions directly; fractal-gl.js compiles the same formulas as GLSL from
// fractal-glsl-lib.js. Nothing here needs a GL context, so the arithmetic contracts are checked on
// the CPU twin and the shader is checked as SOURCE TEXT: every block the GPU pastes has to be the
// one this file just exercised, and both precision variants have to paste the same one.
//
// Run: node --test system/fractal-color.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  srgbToLinear, srgbEncode, linearToOklab, oklabToLinear,
  relief, trapWeight, holdGamut, TRAP_GAMMA,
} from "../src/fractal-color.js";

// ── The ramp ──────────────────────────────────────────────────────────────────────────────────

test("oklabToLinear inverts linearToOklab and never returns negative radiance", () => {
  const out = [0, 0, 0];
  for (const c of [[0, 0, 0], [1, 1, 1], [0.21, 0.04, 0.6], [0.9, 0.35, 0.02]]) {
    const [L, a, b] = linearToOklab(c[0], c[1], c[2]);
    oklabToLinear(L, a, b, out);
    // The two matrices are published to ten digits and are not exact inverses at that width, so
    // the pair leaves about 3e-7 of residual at the bright end: a fifteenth of one code value.
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(out[k] - c[k]) < 1e-6, "round trip");
  }
  // A spline through OKLab can leave the sRGB gamut; downstream has no meaning for negative light.
  oklabToLinear(0.5, 0.9, -0.9, out);
  for (let k = 0; k < 3; k++) assert.ok(out[k] >= 0, "clipped at zero");
});

// ── The trap glow ─────────────────────────────────────────────────────────────────────────────

test("the trap opacity authored at 0.30 still reads as 0.30 after the move to linear light", () => {
  // The glow was drawn as a 30% veil in DISPLAY code values. Compositing that same number against
  // radiance lands at roughly twice the weight: 0.30 of the radiance encodes to 0.58 of a code
  // value, and since the tint is each palette's lightest stop, every frame drifted toward it.
  assert.equal(TRAP_GAMMA, 2.2);
  assert.ok(Math.abs(srgbEncode(trapWeight(0.30)) - 0.30) < 0.01,
    `weighted glow encodes back to the authored opacity (got ${srgbEncode(trapWeight(0.30)).toFixed(4)})`);
  assert.ok(srgbEncode(0.30) > 0.55, "the unweighted number really is about twice as strong");
  assert.equal(trapWeight(0), 0, "no trap, no glow");
  assert.equal(trapWeight(1), 1, "full trap still reaches the tint");
});

// ── Relief ────────────────────────────────────────────────────────────────────────────────────

test("relief is a multiplier centred on 1, bounded by its own depth constant", () => {
  // Shading must not re-grade the image. The term is centred on 1 and spans 1 +/- RELIEF (0.42), so
  // mean exposure across a frame is unchanged and only local contrast is added.
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const s = relief(Math.cos(a), Math.sin(a), 1, 0);
    assert.ok(Number.isFinite(s));
    lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  assert.ok(lo >= 0.58 - 1e-9 && hi <= 1.42 + 1e-9, `relief stayed in [0.58, 1.42], got [${lo}, ${hi}]`);
  assert.ok(hi - lo > 0.3, "and it actually varies with direction, rather than sitting flat");
});

test("relief degrades to flat, never to a black pixel", () => {
  // Every rejection path returns 1 exactly. The comparisons are negated so NaN takes them too:
  // any comparison against NaN is false.
  assert.equal(relief(1, 0, 0, 0), 1, "zero derivative");
  assert.equal(relief(1, 0, 1e30, 1e30), 1, "derivative out of range");
  assert.equal(relief(1, 0, NaN, 0), 1, "NaN derivative");
  assert.equal(relief(0, 0, 1, 0), 1, "zero orbit point");
});

// ── Highlight hold ────────────────────────────────────────────────────────────────────────────

test("holdGamut spends highlight headroom instead of saturation", () => {
  // relief multiplies by up to 1.42, which pushes the bright end of a palette past 1. Clipping each
  // channel on its own drains the colour, so the filaments the shading was added to light up were
  // the ones losing their hue. Dividing the triple by its own maximum walks it back to the gamut
  // boundary along the SAME hue.
  const c = holdGamut([2.0, 1.0, 0.5]);
  assert.ok(Math.abs(c[0] - 1) < 1e-12, "the maximum lands exactly on the boundary");
  assert.ok(Math.abs(c[1] / c[0] - 0.5) < 1e-12, "channel ratios, and so the hue, are unchanged");
  assert.ok(Math.abs(c[2] / c[0] - 0.25) < 1e-12);
  // Per-channel clipping is what this replaces: it would have returned [1, 1, 0.5], a colour with
  // a different hue and much less of it.
  const untouched = holdGamut([0.8, 0.4, 0.1]);
  assert.deepEqual(untouched, [0.8, 0.4, 0.1], "nothing in gamut is touched");
});

// ── The GPU pastes the recipe this file just checked ───────────────────────────────────────────
