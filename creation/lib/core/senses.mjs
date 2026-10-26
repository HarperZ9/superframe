// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// senses.mjs: readouts are the senses (CORE.md). One observer per sense, each a readout law with a weight, and for
// each sense one constructed metamer pair (same readout, different source), one isomer pair (same parts, different
// arrangement) and the light change that splits the metamer. Each pair is checked against a control that reads only
// the summary. Models are labelled: these are engineering approximations of the senses, not physiology claims.
//   sight     the CIE 1931 projection of a 16-band spectrum (spectral.mjs); light change: illuminant A
//   hearing   critical-band energies (Bark, after Zwicker 1961; Traunmuller 1990 formula) with an A-weighting curve
//             as the equal-loudness stand-in (IEC 61672 A-weighting; inferred stand-in for ISO 226 contours)
//   touch     vibration through four mechanoreceptor tunings, labelled a model: Pacinian (peak near 250 Hz),
//             Meissner (near 30 Hz), Merkel (below 5 Hz), Ruffini (static stretch); tuning curves are gaussians in
//             log frequency (shape inferred)
//   body      joint position and acceleration (motion.mjs): the keyframe readout and its metamers
//   smell, taste  receptor vectors: five basic tastes; compounds map to vectors (a model with made-up compounds,
//             stated as such). The engine can represent and map them; it cannot emit them.
import { toXYZ, metamericBlack } from '../../../superframe/lib/medium/spectral.mjs';
import { specOfHex, deltaE, spectrumRGB } from './spectral.mjs';
import { motionLayer } from './motion.mjs';
import { motionMetamerTest } from './motion.mjs';

const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const bark = f => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);
export const aWeight = f => { const f2 = f * f, r = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2)); return r / 0.7943; };
export const RECEPTORS = { pacinian: 250, meissner: 30, merkel: 3, ruffini: 0.5 };

export const SENSES = {
  sight: { readout: (R, illum = 'D65') => toXYZ(R, illum), weight: 1, model: 'CIE 1931 observer (standard)' },
  hearing: { readout: partials => { const bands = new Array(24).fill(0); for (const { f, a } of partials) { const b = Math.min(23, Math.floor(bark(f))); bands[b] += a * a * aWeight(f); } return bands; }, weight: 1, model: 'critical bands with A-weighting (stand-in)' },
  touch: { readout: comps => Object.entries(RECEPTORS).map(([, fc]) => comps.reduce((s, { f, a }) => s + a * a * Math.exp(-((Math.log2(Math.max(0.01, f) / fc)) ** 2) / 2), 0)), weight: 1, model: 'four mechanoreceptor tunings, gaussian in log frequency (inferred shapes)' },
  taste: { readout: mix => ['sweet', 'sour', 'salty', 'bitter', 'umami'].map(k => mix.reduce((s, c) => s + c.amount * (c.vec[k] ?? 0), 0)), weight: 1, model: 'five basic tastes, compounds as made-up vectors (a model, not chemistry)' },
};

// per sense: metamer pair, light change, isomer pair, summary control. Returns numbers; tests/senses.test.mjs checks them.
export function senseChecks() {
  const out = {};
  // sight
  const R = specOfHex('#8a6a4a'), blk = metamericBlack(R, 'D65', { seed: 5 }), R2 = R.map((v, i) => v + blk[i]);
  out.sight = { metamer: { unit: 'CIE76 delta E', readout: deltaE(spectrumRGB(R), spectrumRGB(R2)), lightChange: 'illuminant A', split: deltaE(spectrumRGB(R, 'A'), spectrumRGB(R2, 'A')), control: 0 },
    isomer: (() => { const a = specOfHex('#c04020'), b = specOfHex('#2040c0'), left = (x, y) => toXYZ(x).map((v, i) => 0.8 * v + 0.2 * toXYZ(y)[i]); return { readout: 'centre-weighted gaze on the left of two patches', split: dist(left(a, b), left(b, a)), control: dist(toXYZ(a).map((v, i) => (v + toXYZ(b)[i]) / 2), toXYZ(b).map((v, i) => (v + toXYZ(a)[i]) / 2)) }; })() };
  // hearing: same pitch and loudness, different overtones; the light change is a chord (a third tone whose partials
  // fall in the bands the overtones occupy)
  const pitchLoud = P => [P[0].f, P.reduce((s, p) => s + p.a * p.a, 0)];
  const toneA = [{ f: 220, a: 0.8 }, { f: 440, a: 0.5 }, { f: 660, a: 0.33 }], toneB = [{ f: 220, a: 0.8 }, { f: 440, a: 0.0 }, { f: 660, a: Math.sqrt(0.5 ** 2 + 0.33 ** 2) }];
  const third = [{ f: 330, a: 0.6 }, { f: 660, a: 0.5 }], H = SENSES.hearing.readout;
  out.hearing = { metamer: { readout: dist(pitchLoud(toneA), pitchLoud(toneB)), lightChange: 'a chord with a third tone, read in critical bands', split: dist(H([...toneA, ...third]), H([...toneB, ...third])) / Math.max(...H(toneA)), control: dist(pitchLoud([...toneA, ...third]), pitchLoud([...toneB, ...third])) },
    isomer: (() => { const notes = [220, 277, 330], chord = [notes.map(f => ({ f, a: 0.5 }))], melody = notes.map(f => [{ f, a: 0.5 }]), seq = frames => frames.map(H), summary = frames => H(frames.flat()); return { readout: 'band energies per time step (onsets kept)', split: dist(seq(chord).flat().concat(new Array(48).fill(0)), seq(melody).flat()), control: dist(summary(chord), summary(melody)) }; })() };
  // touch: same Pacinian activation from 200 Hz against two components either side; Meissner splits them
  const Tt = SENSES.touch.readout, vA = [{ f: 250, a: 1 }];
  const fitB = (() => { let best = null; for (let a = 0.05; a < 2; a += 0.005) { const v = [{ f: 30, a: 0.3 }, { f: 420, a }]; const d = Math.abs(Tt(v)[0] - Tt(vA)[0]); if (!best || d < best.d) best = { d, v }; } return best.v; })();
  out.touch = { metamer: { readout: Math.abs(Tt(vA)[0] - Tt(fitB)[0]), lightChange: 'the Meissner channel (a different receptor reads the same skin)', split: Math.abs(Tt(vA)[1] - Tt(fitB)[1]), control: Math.abs(Tt(vA)[0] - Tt(fitB)[0]) }, isomer: { readout: 'which fingertip feels which band (left 250 Hz, right 30 Hz, or swapped)', split: 2 * Math.abs(Tt([{ f: 250, a: 1 }])[0] - Tt([{ f: 30, a: 1 }])[0]), control: 0 } };
  // body
  const m = motionMetamerTest('linear', 'easeInOut');
  out.body = { metamer: { readout: m.real.readout, lightChange: 'collision at 25% of the flight (momentum)', split: m.real.collision, control: m.control.collision }, isomer: (() => { const f = motionLayer('easeIn'), p = f.ticks.pos, rev = p.map((_, i) => p[0] + p.at(-1) - p[p.length - 1 - i]), v = (q, u) => { const i = Math.round(u * (q.length - 1)); return (q[i + 1] - q[i - 1]) / (2 * f.ticks.dt); }; return { readout: 'velocity at 25% of the flight: an ease-in and its retrograde (the same positions, reversed in time and mirrored)', split: Math.abs(v(p, 0.25) - v(rev, 0.25)), control: Math.abs(p[0] - rev[0]) + Math.abs(p.at(-1) - rev.at(-1)), controlReads: 'the keyframe readout (start, end; duration is shared)' }; })() };
  // taste (model)
  const C = { s1: { sweet: 1, bitter: 0.2 }, s2: { sweet: 0.5, bitter: 0.1, sour: 0.3 }, ac: { sour: 1 }, blocker: { bitter: -0.8 } }, Q = SENSES.taste.readout;
  // two mixtures with one basic-taste vector: s2 + acid against s1 + a little acid; a bitter blocker acts on the
  // compounds' bitter share, so it splits them only if their bitter components differ (here both carry bitter 0.2, so it cannot)
  const mixA = [{ vec: C.s1, amount: 1 }, { vec: C.ac, amount: 0.6 }], mixB = [{ vec: C.s2, amount: 2 }];
  const blocked = mix => Q([...mix, { vec: C.blocker, amount: 0.2 }]);
  out.taste = { model: true, metamer: { readout: dist(Q(mixA), Q(mixB)), lightChange: 'a bitter blocker, which in this linear model shifts both by the same vector', split: dist(blocked(mixA), blocked(mixB)), control: 0, verdict: 'unverifiable', why: 'a linear receptor model has no light change that splits an exact vector metamer; real taste mixtures are not linear (suppression), which this model does not carry' }, note: 'smell and taste are represented and mapped only; the engine cannot emit them' };
  return out;
}

// cross-sense transpile of any scalar series: to sight (a grey field), hearing (value -> pitch), touch (value ->
// Pacinian amplitude); each returns what it loses
export function transpileSeries(y) {
  const lo = Math.min(...y), hi = Math.max(...y), u = y.map(v => (v - lo) / ((hi - lo) || 1));
  return {
    sight: { pixels: u, loses: 'nothing at 8 bits beyond quantisation (256 levels)' },
    hearing: { partials: u.map(v => ({ f: 220 * 2 ** (2 * v), a: 0.5 })), loses: 'values closer than one critical band merge for the ear' },
    touch: { vib: u.map(v => ({ f: 250, a: v })), loses: 'resolution: about 4 to 5 distinguishable amplitude steps (inferred)' },
  };
}
