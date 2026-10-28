// prereg.mjs: the checks registered in README.md (2026-10-28), as functions. Each returns its numbers and a held
// flag computed against the registered threshold; nothing here is tuned to make a check pass.
import { detectLines } from './lines.mjs';
import { mainVP, findVP, shuffleDirections } from './vp.mjs';
import { wideAngle } from './wide.mjs';
import { compositionAxis, contrastMap, grid } from './axis.mjs';
import { cafeWall, lineAngles } from './cafewall.mjs';
import { vpSet, lensSet, axisScene } from './plant.mjs';
import { rng, twoSigma } from './stats.mjs';

const r4 = v => (v === null || v === undefined ? null : Math.round(v * 1e4) / 1e4);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function p1({ w = 1280, h = 720, n = 12 } = {}) {
  const rows = vpSet({ w, h, n }).map(({ id, make }) => {
    const sc = make(), segs = detectLines(sc.rgba, sc.w, sc.h), { main } = mainVP(segs, sc.w, sc.h);
    const sh = findVP(shuffleDirections(segs, `p1-shuffle/${id}`));
    return { id, segments: segs.length, err: main ? r4(dist(main.vp, sc.truth.vp) / sc.w) : null, p: main?.p ?? 1, shuffledSignificant: sh.significant, shuffledP: sh.p };
  });
  const errs = rows.map(r => r.err ?? Infinity);
  return { rows, maxErr: Math.max(...errs), held: errs.every(e => e <= 0.01), controlHeld: rows.every(r => !r.shuffledSignificant) };
}

export function p2p3({ w = 1280, h = 720 } = {}) {
  const rows = lensSet({ w, h }).map(({ id, make }) => {
    const sc = make(), segs = detectLines(sc.rgba, sc.w, sc.h), r = wideAngle(segs, sc.w, sc.h);
    return { id, vpErr: r.vp ? r4(dist(r.vp, sc.truth.vp) / sc.w) : null, lines: r.lines.length, edgeScore: r4(r.edgeScore), meanReach: r4(r.meanReach),
      depthRatio: r4(r.depthRatio), depthRatioTrue: r4(sc.truth.depthRatio), depthErr: r4(Math.abs(r.depthRatio / sc.truth.depthRatio - 1)) };
  });
  const [a, b, z] = rows;
  return { rows,
    P2: { held: a.edgeScore === 1, controlHeld: b.edgeScore < 0.5 && b.vpErr <= 0.01, probeHeld: z.edgeScore >= 0.9 },
    P3: { held: rows.every(r => r.depthErr <= 0.15), expectedHeld: a.depthRatio >= 10 && z.depthRatio <= 2.5 } };
}

function axisRow(k, sc) {
  const segs = detectLines(sc.rgba, sc.w, sc.h), G = grid(sc.w, sc.h), C = contrastMap(sc.rgba, sc.w, sc.h, G);
  const real = compositionAxis(sc.rgba, sc.w, sc.h, segs, { contrast: C }), shuf = compositionAxis(sc.rgba, sc.w, sc.h, shuffleDirections(segs, `p4-shuffle/${k}`), { contrast: C });
  const d = p => dist(p, sc.truth.subject) / sc.w, r = rng(`p4-uniform/${k}`), u = [r() * sc.w, r() * sc.h];
  return { k, focal: sc.cam.focalMm, subjectToVP: r4(dist(sc.truth.subject, sc.truth.vp) / sc.w), anchor: r4(d(real.anchor)), anchorToVP: r4(dist(real.anchor, sc.truth.vp) / sc.w),
    shuffled: r4(d(shuf.anchor)), contrastOnly: r4(d(real.contrastOnly)), lineOnly: r4(d(real.lineOnly)), uniform: r4(d(u)) };
}

export function p4({ w = 1280, h = 720, n = 40, hit = 0.1 } = {}) {
  const rows = [], failed = [];
  for (let k = 0; k < n; k++) { const sc = axisScene(k, { w, h }); if (!sc) { failed.push(k); continue; } rows.push(axisRow(k, sc)); }
  const rate = key => rows.filter(r => r[key] <= hit).length / rows.length, N = rows.length;
  const out = { n: N, placementFailures: failed, anchor: rate('anchor'), shuffled: rate('shuffled'), contrastOnly: rate('contrastOnly'), lineOnly: rate('lineOnly'), uniform: rate('uniform'), rows };
  out.twoSigmaAt20 = r4(twoSigma(0.2, N));
  out.held = out.anchor >= 0.9; out.controlHeld = out.shuffled <= 0.3;
  return out;
}

export function p5({ w = 1600, h = 480 } = {}) {
  const read = a => { const s = cafeWall(w, h, { angleDeg: a }), L = lineAngles(detectLines(s.rgba, s.w, s.h)); return { planted: a, pooled: r4(L.angle), lines: L.lines.length, worstLine: r4(Math.max(...L.lines.map(l => Math.abs(l.angle - a)))) }; };
  const flat = read(0), tilt = read(1);
  const r = rng('p5-noise'), noise = new Uint8ClampedArray(w * h * 4), grey = new Uint8ClampedArray(w * h * 4).fill(128);
  for (let i = 0; i < w * h; i++) { const v = r() * 255; noise[4 * i] = noise[4 * i + 1] = noise[4 * i + 2] = v; noise[4 * i + 3] = 255; }
  const ns = detectLines(noise, w, h), us = detectLines(grey, w, h);
  return { flat, tilt, noise: { segments: ns.length, angle: lineAngles(ns).angle }, uniform: { segments: us.length, angle: lineAngles(us).angle },
    held: Math.abs(flat.pooled) <= 0.05 && flat.worstLine <= 0.05 && Math.abs(tilt.pooled - 1) <= 0.05 && tilt.worstLine <= 0.05,
    controlHeld: ns.length === 0 && us.length === 0 };
}

export function noiseFloor({ w = 1280, h = 720 } = {}) {
  const r = rng('floor-noise'), noise = new Uint8ClampedArray(w * h * 4), grey = new Uint8ClampedArray(w * h * 4).fill(128);
  for (let i = 0; i < w * h; i++) { const v = r() * 255; noise[4 * i] = noise[4 * i + 1] = noise[4 * i + 2] = v; noise[4 * i + 3] = 255; }
  const ns = detectLines(noise, w, h), us = detectLines(grey, w, h);
  const vn = mainVP(ns, w, h).main, vu = mainVP(us, w, h).main;
  return { noiseSegments: ns.length, uniformSegments: us.length, noiseVP: !!vn, uniformVP: !!vu, held: !ns.length && !us.length && !vn && !vu };
}
