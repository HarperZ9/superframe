// story.test.mjs: two beats of a story are never readable at once, and generated motion stays under the WCAG 2.3.1
// flash threshold.
//
// Overlap measure: every frame between beat a's last frame (A) and beat b's first frame (B) is cut into tessera-sized
// cells, and each cell is fitted as F = G + alpha (A - G) + beta (B - G) by least squares, where G is the plain
// ground. alpha and beta say how much of each beat's ink is in that cell; a cell's overlap is min(alpha, beta), and a
// frame's overlap is its worst cell with enough ink to measure. Cells match the flip's cells, so a wave that turns
// whole tiles is measured as it is seen: each tile one beat or the other.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { analyseFlashes, guardFlashes } from '../lib/flash.mjs';

async function story(transition) {
  const r = { seed: 'beats', size: [160, 90], nodes: [{ id: 's', node: 'story.mosaic', params: { text: 'I like the sea. Do you?', framesPerBeat: 2, transition, fadeFrames: 2 } }], out: { motion: 's' } };
  return (await evaluate(r, registry)).outputs.motion;
}
function overlaps(M) {
  const G = M.ground, out = [], cell = Math.max(4, Math.round(M.w / 24));
  for (let b = 1; b < M.captions.length; b++) {
    const A = M.frames[M.captions[b - 1].to], B = M.frames[M.captions[b].from];
    for (let f = M.captions[b - 1].to; f <= M.captions[b].from; f++) {
      const F = M.frames[f]; let worst = { overlap: 0, alpha: 0, beta: 0 };
      for (let y0 = 0; y0 < M.h; y0 += cell) for (let x0 = 0; x0 < M.w; x0 += cell) {
        let aa = 0, bb = 0, ab = 0, fa = 0, fb = 0, n = 0;
        for (let y = y0; y < Math.min(M.h, y0 + cell); y++) for (let x = x0; x < Math.min(M.w, x0 + cell); x++) for (let ch = 0; ch < 3; ch++) {
          const i = 4 * (y * M.w + x) + ch, g = G[ch], p = A[i] - g, q = B[i] - g, z = F[i] - g; aa += p * p; bb += q * q; ab += p * q; fa += z * p; fb += z * q; n++;
        }
        const det = aa * bb - ab * ab;
        if (aa / n < 1e-3 || bb / n < 1e-3 || det < 0.05 * aa * bb) continue; // too little ink of one beat, or the two beats look alike here
        const alpha = (fa * bb - fb * ab) / det, beta = (fb * aa - fa * ab) / det, o = Math.max(0, Math.min(alpha, beta));
        if (o > worst.overlap) worst = { overlap: o, alpha, beta };
      }
      out.push({ frame: f, ...worst });
    }
  }
  return out;
}

for (const t of ['ground', 'cut']) {
  test(`transition "${t}": no frame shows two beats at once`, async () => {
    const o = overlaps(await story(t)), worst = Math.max(...o.map(x => x.overlap));
    assert.ok(worst <= 0.05, `worst overlap ${worst.toFixed(3)} at frame ${o.find(x => x.overlap === worst).frame}`);
  });
}
// Letter-atomic check for the flip. Every pixel of a transition frame must be a fold of the ground toward the old
// beat (G + k (A - G)), toward the new one, or toward the plain field (the mosaic laid with no words); inside a glyph region, every pixel follows the same k, so a letter is
// whole or gone. A glyph region counts as present when its mean k is above 0.02; then none of its pixels may show
// the other beat, and when it is absent none may show its own ink or glow.
function segment(F, A, G, o) {
  let num = 0, den = 0; for (let c = 0; c < 3; c++) { const d = A[o + c] - G[c]; num += (F[o + c] - G[c]) * d; den += d * d; }
  const k = den > 1e-9 ? Math.max(0, Math.min(1, num / den)) : 0; let e = 0;
  for (let c = 0; c < 3; c++) { const v = G[c] + k * (A[o + c] - G[c]) - F[o + c]; e += v * v; }
  return { k, d: Math.sqrt(e), spread: Math.sqrt(den) };
}
function glyphFaults(M) {
  const faults = [], G = M.ground;
  for (const tr of M.transitions) {
    const A = M.frames[tr.from - 1], B = M.frames[tr.to + 1], [ra, rb] = tr.regions;
    for (let f = tr.from; f <= tr.to; f++) {
      const F = M.frames[f], ks = { a: new Map(), b: new Map() };
      for (let i = 0; i < M.w * M.h; i++) {
        const o = 4 * i, la = ra.label[i], lb = rb.label[i], sa = segment(F, A, G, o), sb = segment(F, B, G, o), sp = segment(F, M.field, G, o), fits = Math.min(sa.d, sb.d, sp.d) <= 0.03;
        if (!fits) { faults.push(`frame ${f}: pixel ${i} is no fold of either beat`); break; }
        // pixels where a beat's frame and the plain field agree (the field ring inside a glyph's region) carry no
        // ownership and are skipped
        const near = (X, Y) => Math.abs(X[o] - Y[o]) + Math.abs(X[o + 1] - Y[o + 1]) + Math.abs(X[o + 2] - Y[o + 2]) < 0.05;
        if (la && !lb && sa.spread > 0.1 && !near(A, M.field)) { if (!ks.a.has(la)) ks.a.set(la, []); ks.a.get(la).push(sa.d <= 0.03 && sa.d <= Math.min(sp.d, sb.d) ? sa.k : -1); }
        if (lb && !la && sb.spread > 0.1 && !near(B, M.field)) { if (!ks.b.has(lb)) ks.b.set(lb, []); ks.b.get(lb).push(sb.d <= 0.03 && sb.d <= Math.min(sp.d, sa.d) ? sb.k : -1); }
      }
      for (const [side, map] of Object.entries(ks)) for (const [id, list] of map) {
        const own = list.filter(k => k >= 0), mean = own.length ? own.reduce((p, q) => p + q, 0) / own.length : 0;
        if (mean > 0.02) { if (list.some(k => k < 0) || Math.max(...own) - Math.min(...own) > 0.1) faults.push(`frame ${f}: ${side} glyph ${id} is split`); }
        else if (own.some(k => k > 0.05)) faults.push(`frame ${f}: ${side} glyph ${id} is gone but its ink or glow remains`);
      }
    }
  }
  return faults;
}
test('flip: every letter is whole or gone, never split between beats, and no glow outlives its glyph', async () => {
  const faults = glyphFaults(await story('flip'));
  assert.equal(faults.length, 0, faults.slice(0, 5).join('; '));
});
test('the glyph check catches a split letter (control)', async () => {
  const M = await story('flip'), tr = M.transitions[0], F = M.frames[tr.from], A = M.frames[tr.from - 1], B = M.frames[tr.to + 1], la = tr.regions[0].label;
  const id = tr.regions[0].order.at(-1); let n = 0; // the last letter in reading order is still in place on the first frame
  for (let i = 0; i < M.w * M.h; i++) if (la[i] === id && !tr.regions[1].label[i] && n++ % 2) for (let c = 0; c < 3; c++) F[4 * i + c] = M.ground[c]; // half the glyph's pixels to ground
  assert.ok(glyphFaults(M).some(x => /split/.test(x)));
});
test('the glyph check catches a glow left behind (control)', async () => {
  const M = await story('flip'), tr = M.transitions[0], f = Math.round((tr.from + tr.to) / 2), F = M.frames[f], A = M.frames[tr.from - 1], id = tr.regions[0].order[0];
  // a glow residue: the outer edge of the letter's region (its keyline and glow) left at 30%, the letter itself gone
  const L = tr.regions[0].label, edge = i => { const x = i % M.w, y = (i / M.w) | 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= M.w || Y >= M.h || L[Y * M.w + X] !== id) return true; } return false; };
  for (let i = 0; i < M.w * M.h; i++) if (L[i] === id && !tr.regions[1].label[i] && edge(i)) for (let c = 0; c < 3; c++) F[4 * i + c] = M.ground[c] + 0.3 * (A[4 * i + c] - M.ground[c]);
  assert.ok(glyphFaults(M).some(x => /split|remains/.test(x)));
});
test('the flip wave really turns tiles: frames mid-wave show the old beat in some cells and the new in others', async () => {
  const M = await story('flip'), t = M.transitions[0], mid = M.frames[Math.round((t.from + t.to) / 2)], A = M.frames[t.from - 1], B = M.frames[t.to + 1];
  let nearA = 0, nearB = 0; for (let i = 0; i < mid.length; i += 4) { const da = Math.abs(mid[i] - A[i]), db = Math.abs(mid[i] - B[i]); if (Math.abs(A[i] - B[i]) > 0.1) { if (da < 0.01) nearA++; if (db < 0.01) nearB++; } }
  assert.ok(nearA > 50 && nearB > 50, `old-beat pixels ${nearA}, new-beat pixels ${nearB}`);
});
test('the overlap measure catches a 50/50 crossfade (control)', async () => {
  const M = await story('cut'), A = M.frames[M.captions[0].to], B = M.frames[M.captions[1].from];
  M.frames.splice(M.captions[1].from, 0, Float32Array.from(A, (v, i) => 0.5 * v + 0.5 * B[i]));
  M.captions = M.captions.map((c, k) => (k === 0 ? c : { ...c, from: c.from + 1, to: c.to + 1 }));
  assert.ok(Math.max(...overlaps(M).map(x => x.overlap)) > 0.3);
});

test('flash guard: a 10 per second black and white flicker is caught and slowed under three per second', () => {
  const w = 32, h = 32, frames = Array.from({ length: 20 }, (_, k) => new Float32Array(w * h * 4).fill(k % 2 ? 1 : 0).map((v, i) => ((i & 3) === 3 ? 1 : v)));
  const M = { w, h, fps: 10, frames };
  assert.equal(analyseFlashes(M).pass, false);
  const g = guardFlashes(M);
  assert.equal(g.flash.pass, true); assert.ok(g.fps < 10 && analyseFlashes(g).flashesPerSecond <= 3, `fps ${g.fps}`);
  assert.equal(g.frames.length, M.frames.length, 'the guard never blends pictures');
});
test('a red flicker counts as a flash too', () => {
  const w = 16, h = 16, frames = Array.from({ length: 12 }, (_, k) => { const f = new Float32Array(w * h * 4); for (let i = 0; i < w * h; i++) f.set(k % 2 ? [0.9, 0.02, 0.02, 1] : [0.3, 0.3, 0.3, 1], 4 * i); return f; });
  assert.equal(analyseFlashes({ w, h, fps: 8, frames }).pass, false);
});
test('stories from the room pass the flash check at every intensity', async () => {
  for (const t of ['ground', 'cut', 'flip']) { const M = await story(t); assert.equal(analyseFlashes(M).pass, true, t); }
});
