// Modal synthesis: a struck object is a sum of decaying partials, each a rotating phasor with its own
// frequency, amplitude and decay. The piano (piano.mjs) builds on it with stiff-string inharmonicity,
// a felt hammer's spectrum that brightens with velocity, a strike point that notches the 7th to 8th
// partial, two or three unison strings slightly apart (the beating and the two-stage decay), a hammer
// knock, and dampers. Bells and bowls use measured-style partial tables.
import { SR, TAU, rng, biquad, fadeEdges } from "../dsp.mjs";

// render a set of partials: [{ f, a, t60, t60b (optional second, slower decay), mix (share of the slow) }]
export function partials(list, n, damp = null, sr = SR) {
  const out = new Float32Array(n);
  for (const p of list) {
    if (p.f >= sr * 0.45 || p.a < 1e-5) continue;
    const w = TAU * p.f / sr, cw = Math.cos(w), sw = Math.sin(w);
    const k1 = Math.exp(-6.9078 / (p.t60 * sr)), k2 = Math.exp(-6.9078 / ((p.t60b || p.t60) * sr));
    const kd = damp ? Math.exp(-6.9078 / (damp.t60 * sr)) : 1;
    let c = Math.cos(p.ph || 0), s = Math.sin(p.ph || 0), e1 = p.a * (1 - (p.mix || 0)), e2 = p.a * (p.mix || 0);
    for (let i = 0; i < n; i++) {
      out[i] += s * (e1 + e2);
      const nc = c * cw - s * sw; s = c * sw + s * cw; c = nc;
      e1 *= k1; e2 *= k2;
      if (damp && i >= damp.at) { e1 *= kd; e2 *= kd; }
      if ((i & 255) === 0 && e1 + e2 < 1e-5 * p.a + 1e-7) break;
    }
  }
  return out;
}

// bells and struck vessels: tables of [ratio, amplitude, t60 in seconds at f0 = 440]
export const VESSELS = {
  churchbell: [[0.5, 0.6, 22], [1, 0.8, 14], [1.183, 0.7, 9], [1.506, 0.35, 6], [2, 1, 6], [2.514, 0.3, 3.5], [2.662, 0.45, 3], [3.011, 0.25, 2.2], [4.166, 0.2, 1.4], [5.433, 0.12, 0.9]],
  handbell: [[1, 1, 3.5], [2.01, 0.25, 1.8], [2.76, 0.5, 1.4], [5.4, 0.25, 0.6], [8.93, 0.12, 0.3]],
  bowl: [[1, 1, 0.9], [2.71, 0.45, 0.5], [5.15, 0.25, 0.25], [8.4, 0.12, 0.12]],             // a glazed earthenware bowl
  woodbowl: [[1, 1, 0.09], [2.3, 0.5, 0.05], [3.9, 0.3, 0.03]],
  waterglass: [[1, 1, 2.6], [2.32, 0.35, 1.3], [4.25, 0.18, 0.6]],                             // a rung water glass
  iron: [[1, 1, 1.6], [2.76, 0.6, 1.1], [5.4, 0.5, 0.7], [8.9, 0.35, 0.45], [13.3, 0.25, 0.3], [17.6, 0.2, 0.2]],
};
export function vessel(kind, f0, v = 0.7, seed = 1, o = {}) {
  const r = rng(seed), table = VESSELS[kind], span = o.span || 1;
  const list = table.map(([ratio, a, t]) => ({
    f: f0 * ratio * (1 + (r() - 0.5) * 0.004), a: a * (0.5 + 0.5 * Math.pow(v, 1 + ratio * 0.2)),
    t60: t * span * Math.pow(440 / f0, 0.35), ph: r() * TAU,
  }));
  const n = Math.round(Math.max(...list.map((p) => p.t60)) * SR * 0.8) + 64;
  const out = partials(list, n);
  const g = (o.gain || 0.25) * v;
  for (let i = 0; i < n; i++) out[i] *= g;
  return fadeEdges(out, 0.0004, 0.05);
}
