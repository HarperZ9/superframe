// stack-measure.mjs: every number the README's RESULTS and spec sheet quote, measured afresh and written to
// out/stack/measures.json, so the spec sheet comes from the code and not from memory.
//   node tools/stack-measure.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { expose, postBlur, midFrame } from '../lib/stack/shutter.mjs';
import { livingStill, uniqueRate, shotGrain, flatGrain, noiseSlope } from '../lib/stack/still.mjs';
import { frame } from '../lib/stack/frame.mjs';
import { bar, lineScene, streakOf, flashScene, flashGrowth, echoRun, PLANTED } from '../lib/stack/plant.mjs';

const r4 = v => Math.round(v * 1e4) / 1e4;
const streak = (sc, T) => { const s = streakOf(sc, T), f = streakOf(sc, T, { ss: 16 }); return { fwhm: r4(s.fwhm), moments: r4(s.moments), moments16: r4(f.moments) }; };

function shutterRows() {
  const rows = [];
  for (const L of [0.5, 1, 2, 4, 8, 16, 32, 64, 120, 300]) { const T = 1 / 30, s = streak(lineScene([bar(L / T)]), T); rows.push({ planted: L, ...s, errFwhm: r4(Math.abs(s.fwhm - L) / L), errMoments: r4(Math.abs(s.moments - L) / L), errMoments16: r4(Math.abs(s.moments16 - L) / L) }); }
  return rows;
}
function flashRows() {
  const T = 1 / 30, out = [];
  for (const frac of [0.001, 0.005, 0.01, 0.02, 0.05, 0.2]) {
    const sc = flashScene(frac, T);
    out.push({ fraction: frac, expected: r4(64 * frac), integral: r4(flashGrowth(expose(sc, 0, T), sc)), integral16: r4(flashGrowth(null, sc, { ss: 16, render: S => expose(S, 0, T) })), postBlur: r4(flashGrowth(postBlur(midFrame(sc, 0, T), 64), sc)) });
  }
  return out;
}
function echoRows() {
  const rows = PLANTED.map(([k, tint]) => { const c = echoRun(k, tint), j = echoRun(k, tint, 2); return { k, tint, recovered: c.rec.tint.map(r4), err255: r4(c.err), peakLag: c.peak, peakCorr: r4(c.xc[c.peak]), jitterErr255: r4(j.err), jitterPeakLag: j.peak, jitterPeakCorr: r4(Math.max(...j.xc)) }; });
  const z = echoRun(0, PLANTED[0][1]), c5 = echoRun(5, PLANTED[1][1]), j5 = echoRun(5, PLANTED[1][1], 2);
  return { rows, k0: { tint: z.rec.tint, support: z.rec.support }, lagClean: c5.xc.map(r4), lagJitter: j5.xc.map(r4) };
}
function grainRows() {
  const greys = [0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.0], N = 400;
  const v = F => { let s = 0, q = 0; for (const x of F.px) { s += x; q += x * x; } const n = F.px.length; return [s / n, q / n - (s / n) ** 2]; };
  const shot = greys.map(g => v(shotGrain(frame(128, 128, [g, g, g]), { N, seed: `p6/${g}` })));
  const flat = greys.map(g => v(flatGrain(frame(128, 128, [g, g, g]), { sigma: Math.sqrt(0.45 / N), seed: `c6/${g}` })));
  return { N, slopeTimesN: r4(noiseSlope(shot) * N), controlSlopeTimesN: r4(noiseSlope(flat) * N) };
}
function stillRows() {
  const F = frame(64, 36, [0.05, 0.06, 0.1]);
  return [1, 2, 3, 4].map(hold => ({ hold, hz: uniqueRate(livingStill(F, { hold }), 121, 30) })).concat([{ hold: 'frozen', hz: uniqueRate(livingStill(F, { grain: 0 }), 121, 30) }]);
}

mkdirSync('out/stack', { recursive: true });
const m = { date: '2026-10-28', shutter: shutterRows(), flash: flashRows(), echo: echoRows(), grain: grainRows(), still: stillRows() };
writeFileSync('out/stack/measures.json', JSON.stringify(m, null, 1));
console.log(JSON.stringify(m, null, 1));
