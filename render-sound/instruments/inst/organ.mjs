// A tonewheel organ from additive drawbars (16', 5 1/3', 8', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1'), with the
// tonewheels' slight mistuning against equal temperament, a key click, single-trigger percussion on the
// second or third harmonic, and soft foldback above the top wheel. The rotary speaker is an effect (fx.mjs).
import { SR, TAU, rng, biquad, fadeEdges } from "../dsp.mjs";

const FOOT = [0.5, 1.5, 1, 2, 3, 4, 5, 6, 8];
export const REGISTRATIONS = { gospel: "888000000", jazz: "888800000", ballad: "008800000", full: "888888888", flute: "008000000", hollow: "800000008", reed: "006802000" };

export function organ(m, dur, v = 0.7, seed = 1, o = {}) {
  const r = rng(seed), f0 = 440 * Math.pow(2, (m - 69) / 12);
  const bars = String(o.drawbars || REGISTRATIONS[o.reg || "jazz"]).split("").map(Number);
  const rel = o.release || 0.03, n = Math.round((dur + rel) * SR), out = new Float32Array(n);
  const nd = Math.round(dur * SR), nr = Math.round(rel * SR);
  for (let k = 0; k < 9; k++) {
    if (!bars[k]) continue;
    let f = f0 * FOOT[k] * (1 + (r() - 0.5) * 0.0012);
    while (f > 5900) f /= 2;                                     // foldback: the top octave of wheels repeats
    const a = Math.pow(10, (bars[k] - 8) * 3 / 20) * 0.12, w = TAU * f / SR;
    let ph = r() * TAU;
    for (let i = 0; i < n; i++) { out[i] += Math.sin(ph) * a; ph += w; }
  }
  if (o.perc) percussion(out, f0, o.perc, nd);
  for (let i = 0; i < n; i++) { const e = i < 64 ? i / 64 : i > nd ? Math.max(0, 1 - (i - nd) / nr) : 1; out[i] *= e * (0.4 + 0.6 * v); }
  click(out, r, o.click ?? 0.5);
  return fadeEdges(out, 0.0002, 0.01);
}
function percussion(buf, f0, h, nd) {
  const f = f0 * (h === 3 ? 3 : 2), w = TAU * f / SR, k = Math.exp(-6.9 / (0.5 * SR));
  let e = 0.16, ph = 0;
  for (let i = 0; i < buf.length && i < nd + 2000; i++) { buf[i] += Math.sin(ph) * e; ph += w; e *= k; }
}
function click(buf, r, amt) {
  if (!amt) return;
  const bp = biquad("bp", 2400, 0.8), n = Math.min(buf.length, 260);
  for (let i = 0; i < n; i++) buf[i] += bp(r.bi()) * amt * 0.25 * (1 - i / n);
}
