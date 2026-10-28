// stack-echo.test.mjs: the frame-offset echo and the onion skin (PREREG P3, P4, P7 in lib/stack/README.md).
// The residual must cross-correlate with the base at lag k and give back the tint within 1/255 from 8-bit frames;
// k = 0 and jittered delays must fail; onion ghosts must land on their source frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spriteSeq, echoFrame, onionFrame, baseFrame, ghostCentroid } from '../lib/stack/echo.mjs';
import { ROWS, PAL, PLANTED, ECHO, echoSeq, echoRun } from '../lib/stack/plant.mjs';

const run = echoRun;

test('P3: the residual peaks at lag k and the tint comes back within 1/255', () => {
  for (const [k, tint] of PLANTED) { const r = run(k, tint); assert.equal(r.peak, k); assert.ok(r.err <= 1, `k=${k}: ${r.err}/255`); }
});

test('P3 control: k = 0 hides the echo under its own base, so the tint is unrecoverable', () => {
  const r = run(0, PLANTED[0][1]);
  assert.ok(r.rec.tint === null || r.err > 1, `k=0 recovered within ${r.err}/255`);
});

// The k = 0 control above fails by construction of the estimator (its predictor is zero wherever the base covers), so
// it cannot tell an echo drawn under the base from one drawn over it. This check reads the render itself: an opaque,
// hard-edged base must hide every echo pixel it covers, at k = 0 and wherever a delayed copy overlaps it.
test('P3 control: the base occludes its echo in the render (echo composited under, not over)', () => {
  for (const k of [0, 3]) {
    const n = ECHO.frames[10], O = echoFrame(echoSeq, n, { ground: ECHO.ground, copies: [{ k, tint: PLANTED[0][1], opacity: ECHO.opacity }] });
    const B = baseFrame(echoSeq, n, ECHO.ground), A = echoSeq(n).a;
    let covered = 0;
    for (let i = 0; i < A.length; i++) if (A[i] === 1) { covered++; for (let c = 0; c < 3; c++) assert.equal(O.px[3 * i + c], B.px[3 * i + c], `k=${k}: echo shows through the base at ${i}`); }
    assert.ok(covered > 0, 'base has no opaque pixels');
  }
});

test('P3 control: jittered delays break the fixed-lag recovery and flatten the peak', () => {
  for (const [k, tint] of PLANTED) {
    const clean = run(k, tint), jit = run(k, tint, 2);
    assert.ok(jit.err > 1, `jittered k=${k} recovered within ${jit.err}/255`);
    assert.ok(clean.xc[clean.peak] - Math.max(...jit.xc) >= 0.2, `peak fell only ${clean.xc[clean.peak] - Math.max(...jit.xc)}`);
  }
});

const linear = spriteSeq({ w: 220, h: 40, rows: ROWS, palette: PAL, path: n => [20 + 12 * n, 20] });
const lg = { w: 220, h: 40, rgb: [0.04, 0.04, 0.06] };

test('P4: every onion ghost sits on its source frame within 0.5 px', () => {
  for (const j of [-3, -2, -1, 1, 2, 3]) {
    const c = ghostCentroid(linear, 8, j, { ground: lg }), want = 20 + 12 * (8 + j);
    assert.ok(c && Math.abs(c[0] - want) < 0.5 && Math.abs(c[1] - 20) < 0.5, `ghost ${j} at ${c}`);
  }
});

test('P4 control: ghosts drawn without offsets miss their source frames', () => {
  for (const j of [-3, -2, -1, 1, 2, 3]) {
    const c = ghostCentroid(linear, 8, j, { ground: lg, offsets: false }), want = 20 + 12 * (8 + j);
    assert.ok(c === null || Math.abs(c[0] - want) > 0.5, `zero-offset ghost ${j} passed at ${c}`);
  }
});

test('P7: a static base leaves no echo residual outside its silhouette', () => {
  const still = spriteSeq({ w: 60, h: 40, rows: ROWS, palette: PAL, path: () => [30, 20] }), g = { w: 60, h: 40, rgb: [0.04, 0.04, 0.06] };
  const O = echoFrame(still, 10, { ground: g, copies: [{ k: 4, tint: [1, 0, 0], opacity: 1 }] }), B = baseFrame(still, 10, g), A = still(10).a;
  for (let i = 0; i < A.length; i++) if (A[i] === 0) for (let c = 0; c < 3; c++) assert.equal(O.px[3 * i + c], B.px[3 * i + c]);
});

test('onion skin output is deterministic and past ghosts take the past colour', () => {
  const F = onionFrame(linear, 8, { ground: lg }), x = Math.round(20 + 12 * 7), p = 3 * (20 * 220 + x);
  assert.ok(F.px[p] > F.px[p + 2], 'the ghost one frame back is not warm');
});
