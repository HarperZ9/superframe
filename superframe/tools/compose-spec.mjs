// compose-spec.mjs: the measurements behind the spec sheet in lib/compose/README.md: resolution dependence, angle
// resolution, sensitivity of the edge score to framing, and accuracy with added sensor-like noise.
//   node tools/compose-spec.mjs [out/compose/spec.json]
import { writeFileSync } from 'node:fs';
import { detectLines } from '../lib/compose/lines.mjs';
import { wideAngle } from '../lib/compose/wide.mjs';
import { corridorScene, CORRIDOR } from '../lib/compose/scene.mjs';
import { cafeWall, lineAngles } from '../lib/compose/cafewall.mjs';
import { rng } from '../lib/compose/stats.mjs';

const OUT = process.argv[2] ?? 'out/compose/spec.json', r4 = v => (v === null ? null : Math.round(v * 1e4) / 1e4);
const vpErr = (r, sc) => r.vp ? r4(Math.hypot(r.vp[0] - sc.truth.vp[0], r.vp[1] - sc.truth.vp[1]) / sc.w) : null;

// Gaussian noise of sd code values added to every channel (Box-Muller from a seeded stream).
function noisy(rgba, sd, seed) {
  const r = rng(seed), out = new Uint8ClampedArray(rgba);
  for (let i = 0; i < out.length; i += 4) { const g = Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()) * sd; for (let c = 0; c < 3; c++) out[i + c] = rgba[i + c] + g; }
  return out;
}
const read = (sc, rgba = sc.rgba) => wideAngle(detectLines(rgba, sc.w, sc.h), sc.w, sc.h);

const spec = { resolution: [], framing: [], noise: [], angle: [] };
for (const w of [640, 960, 1280, 1920]) {
  const sc = corridorScene({ w, h: Math.round(w * 9 / 16), focalMm: 16, pos: [0, 1.6, 0], yaw: 6, pitch: -3 }), r = read(sc);
  spec.resolution.push({ w, vpErr: vpErr(r, sc), edgeScore: r4(r.edgeScore), depthRatio: r4(r.depthRatio), depthRatioTrue: r4(sc.truth.depthRatio) });
}
for (let back = 21; back <= 27.01; back += 1) {
  const sc = corridorScene({ w: 1280, h: 720, focalMm: 200, pos: [0, 1.6, CORRIDOR.z0 - back] }), r = read(sc);
  spec.framing.push({ backMetres: back, mouthShareOfW: r4(200 * 3 / back / 36), edgeScore: r4(r.edgeScore), lines: r.lines.length, vpErr: vpErr(r, sc) });
}
const base = corridorScene({ w: 1280, h: 720, focalMm: 16, pos: [0, 1.6, 0], yaw: 6, pitch: -3 });
for (const sd of [0, 4, 8, 16, 32]) {
  const r = read(base, noisy(base.rgba, sd, `spec-noise/${sd}`));
  spec.noise.push({ sdCodeValues: sd, vpErr: vpErr(r, base), edgeScore: r4(r.edgeScore), depthRatio: r4(r.depthRatio), lines: r.lines.length });
}
for (const a of [0, 0.01, 0.02, 0.05, 0.1, 1]) for (const sd of [0, 16]) {
  const s = cafeWall(1600, 480, { angleDeg: a }), L = lineAngles(detectLines(sd ? noisy(s.rgba, sd, `cafe/${a}`) : s.rgba, s.w, s.h));
  spec.angle.push({ planted: a, sdCodeValues: sd, read: r4(L.angle), error: r4(L.angle - a), lines: L.lines.length });
}
console.log(JSON.stringify(spec, null, 1));
writeFileSync(OUT, JSON.stringify(spec, null, 1));
