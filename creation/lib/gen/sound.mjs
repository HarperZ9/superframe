// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// sound: the visualizer's sound-to-water node (visualizer/lib/flow.mjs, superframe vis.flow), adapted,
// not reimplemented. pourFeatures() is called on a shim that stands in for the tank (all water, no surface), and
// its per-step forcing writes into the shim's surface speed and vertical velocity, exactly as it does in the tank:
//   vibration  each bar drives one standing mode cos(pi m x / W) cos(pi n y / D) at the beat rate; the mode is
//              picked from the set of (m, n) pairs that share the bar's tone eigenvalue (modesFor: Kac's question,
//              a spectrum suggests a shape and does not fix it; Gordon, Webb and Wolpert 1992)
//   pressure   each onset dents the surface at its place in the bar, in proportion to its spectral flux
// Generators here:
//   sound      amount = |displacement|, the integrated vertical velocity with a slow leak (where the water moves,
//              the nodal lines stay still: Chladni's figures in a tank); vel = the forcing's velocity, lendable
//   soundclock a timing layer from the same features: progress = beat phase, rate = loudness times onset pulses,
//              so any generator can keep time with the music (data as timing and rate)
// Features come from data/sound-features.json (tools/build_sound_features.mjs runs the visualizer's analysis).
import { pourFeatures, modesFor } from '../../../visualizer/lib/flow.mjs';
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, hexLin } from '../core/layer.mjs';

export { modesFor };

function shim(w, h) {
  const n = w * h;
  return { nx: w, ny: h, n, waterLevel: 0, time: 0, emitters: [], add() { return 0; }, hv: F32(w), v: F32(n), u: F32(n), phase: new Uint8Array(n).fill(1), solid: new Uint8Array(n), surfaceY: () => 0 };
}

// the features as the flow code expects them (typed series and helpers it reads)
export function asFeatures(J) { return { ...J, series: Object.fromEntries(Object.entries(J.series).map(([k, v]) => [k, Float32Array.from(v)])) }; }

export const sound = defineGen({
  id: 'sound',
  law: { shape: 'absorb', params: { beer: true } },
  weights: { vib: 'vibration strength (flow.mjs FLOW.vib)', press: 'pressure strength', leak: 'displacement leak per second', gain: 'display gain' },
  inputs: {},
  mechanism: 'flow.mjs forcing on an all-water shim: v += 0.006 cos(pi m x/W) cos(pi n y/D) sin(2 pi f_beat t) loud; onsets dent; amount = |integral v dt| with leak',
  credits: ['visualizer/lib/flow.mjs (vis.flow), adapted', 'Kac 1966, Can one hear the shape of a drum?; Gordon, Webb and Wolpert 1992', 'Chladni 1787 (nodal figures)'],
  create({ w = 160, h = 100, features, vib = 0.55, press = 1, leak = 1.2, gain = 9, ink = '#22304a' } = {}) {
    const m = shim(w, h), F = asFeatures(features), { forcing, modes } = pourFeatures(m, F, { vib, press });
    const L = makeLayer('sound', { w, h, law: { shape: 'absorb', params: { strength: 2 } }, weights: { vib, press, leak, gain }, ink: hexLin(ink), fields: { vel: F32(2 * w * h) }, state: { m, forcing, modes, disp: F32(w * h), mode: null } });
    return L;
  },
  step(L, dt) {
    const S = L.state, m = S.m; m.v.fill(0); m.hv.fill(0);
    S.forcing(m); m.time += dt;
    S.mode = [...S.modes].reverse().find(M => M.t0 <= m.time) ?? S.modes[0];
    const D = S.disp, A = L.fields.amount, V = L.fields.vel, keep = Math.exp(-L.weights.leak * dt);
    for (let k = 0; k < L.n; k++) { const i = k % L.w; D[k] = D[k] * keep + (m.v[k] * 30 + (k < L.w * 4 ? m.hv[i] : 0)) * dt; A[k] = clamp(Math.abs(D[k]) * L.weights.gain, 0, 1); V[2 * k + 1] = m.v[k] * 6; }
  },
});

export const soundclock = defineGen({
  id: 'soundclock',
  kind: 'clock',
  law: { shape: 'clock', params: {} },
  weights: { swing: 'how much onsets speed the clock', floor: 'rate between onsets' },
  mechanism: 'progress = fraction of the current beat; rate = floor + swing * loudness * exp(-(t - last onset) / 0.12)',
  credits: ['visualizer/lib/features.mjs (beats, onsets, loudness), via data/sound-features.json'],
  create({ features, swing = 2.2, floor = 0.35, w = 64 } = {}) {
    return makeLayer('soundclock', { w, h: 1, law: { shape: 'clock', params: {} }, weights: { swing, floor }, state: { F: features, progress: 0, rate: 1, clock: 0 } });
  },
  step(L, dt, ctx, rawDt) {
    const S = L.state, F = S.F; S.clock += rawDt; const t = S.clock % Math.max(1, F.duration);
    let b = 0; while (b + 1 < F.beats.length && F.beats[b + 1] <= t) b++;
    const b0 = F.beats[b] ?? 0, b1 = F.beats[b + 1] ?? b0 + 0.5; S.progress = clamp((t - b0) / Math.max(1e-3, b1 - b0), 0, 1);
    let o = -1; for (const x of F.onsets) { if (x <= t) o = x; else break; }
    const loud = F.series.lufsS?.length ? clamp((F.series.lufsS[Math.min(F.series.lufsS.length - 1, Math.round(t * F.fps))] + 40) / 32, 0, 1) : 0.6;
    S.rate = L.weights.floor + L.weights.swing * loud * (o >= 0 ? Math.exp(-(t - o) / 0.12) : 0);
    L.fields.amount[Math.min(L.w - 1, Math.floor(t / F.duration * L.w))] = S.rate / 3;
    L.t = S.clock - dt;
  },
});
