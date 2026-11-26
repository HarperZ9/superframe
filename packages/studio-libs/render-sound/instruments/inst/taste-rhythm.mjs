// Clean-room Pocket-Break drum kit (12x-15x ghost-to-accent dynamics), shimmering
// 150-mode bronze ride, procedural 16-slice jungle break-slicer, and pocket curves.
import { SR, TAU, rng, biquad, noise, fadeEdges, clamp, readFrac } from "../dsp.mjs";
import { partials } from "./modal.mjs";

export const POCKET_OFFSETS = Object.freeze({
  idrisLaidBack: Object.freeze({ kickMs: 0.0, snareMs: 11.0, hatMs: 4.5, rideMs: 3.0, swing: 0.58 }),
  bluswingFusion: Object.freeze({ kickMs: -1.0, snareMs: 6.5, hatMs: 3.0, rideMs: 1.5, swing: 0.56 }),
  bukemLiquid: Object.freeze({ kickMs: 0.0, snareMs: -1.2, hatMs: 1.2, rideMs: 0.5, swing: 0.50 }),
  frisellRubato: Object.freeze({ kickMs: 3.5, snareMs: 14.0, hatMs: 7.5, rideMs: 6.0, swing: 0.62 }),
});

// Continuous velocity v in [0.08, 1.0] mapped through v^1.6 -> ~14x dynamic range
export const pocketGain = (v) => Math.pow(clamp(v, 0.08, 1.0), 1.6);

export function pocketKick(v = 0.85, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), n = Math.round((o.len ?? 0.48) * sr);
  const out = new Float32Array(n), fEnd = o.tune ?? 49, fStart = o.startHz ?? 148;
  const vg = pocketGain(v), clickBp = biquad("bp", 3400 + 1800 * v, 1.4, 0, sr);
  const subLp = biquad("lp", 130, 0.707, 0, sr), bodyDec = o.decay ?? 0.165;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = fEnd + (fStart - fEnd) * Math.exp(-t / 0.011);
    ph += TAU * f / sr;
    const body = subLp(Math.sin(ph) * Math.exp(-t / bodyDec));
    const punch = Math.sin(ph * 2) * Math.exp(-t / 0.028) * (0.16 + 0.18 * v);
    const click = i < Math.round(0.008 * sr) ? clickBp(r.bi()) * Math.exp(-t / 0.0022) * (0.25 + 0.75 * v) : 0;
    out[i] = Math.tanh((body * 1.08 + punch + click) * (1.0 + 0.35 * v)) * vg * (o.gain ?? 0.82);
  }
  return fadeEdges(out, 0.0004, 0.03, sr);
}

export function pocketSnare(v = 0.8, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), n = Math.round((o.len ?? 0.34) * sr);
  const vg = pocketGain(v), f1 = o.shell1 ?? 185, f2 = o.shell2 ?? 312;
  const ghostOnly = v < 0.25, rimCrack = v > 0.80;
  const shell = partials([
    { f: f1, a: ghostOnly ? 0.18 : 0.72, t60: 0.14, ph: r() * TAU },
    { f: f2, a: ghostOnly ? 0.12 : 0.44, t60: 0.11, ph: r() * TAU },
    { f: f1 * 2.136, a: ghostOnly ? 0.05 : 0.22, t60: 0.08, ph: r() * TAU },
  ], n, null, sr);
  const wn = noise(n, r, "white"), wireHp = biquad("hp", 1800, 0.707, 0, sr);
  const wireLp = biquad("lp", 11500, 0.7, 0, sr), wirePk = biquad("peak", 4600, 1.0, 4.5, sr);
  const rimBp = biquad("bp", 4200, 2.2, 0, sr);
  const wireDec = o.brush ? 0.045 : (0.045 + 0.085 * v);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const wire = wirePk(wireLp(wireHp(wn[i]))) * Math.exp(-t / wireDec);
    const rim = rimCrack && i < Math.round(0.018 * sr) ? rimBp(r.bi()) * Math.exp(-t / 0.004) * 1.45 : 0;
    const shellMix = ghostOnly ? 0.22 : (o.brush ? 0.3 : 0.78);
    const wireMix = ghostOnly ? 1.15 : (0.85 + 0.35 * v);
    out[i] = Math.tanh((shell[i] * shellMix + wire * wireMix + rim) * 1.1) * vg * (o.gain ?? 0.68);
  }
  return fadeEdges(out, 0.0003, 0.035, sr);
}

export function pocketRide(v = 0.6, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed ^ 0x5eed), r2 = rng(seed);
  const T = o.crash ? 3.2 : (o.len ?? 2.6), n = Math.round(T * sr), lo = [], hi = [];
  for (let k = 0; k < 150; k++) {
    const f = 320 * Math.pow(2, 5.6 * Math.pow(r(), 0.72));
    if (f > sr * 0.46) continue;
    const p = { f, a: (0.45 + r() * 0.55) / Math.sqrt(1 + k * 0.14), t60: T * Math.pow(1200 / f, 0.28), ph: r2() * TAU };
    (f < 3200 ? lo : hi).push(p);
  }
  const L = partials(lo, n, null, sr), H = partials(hi, n, null, sr);
  const swellTau = o.crash ? 0.035 : 0.075;
  const wash = noise(n, r2, "white"), hp = biquad("hp", 3600, 0.7, 0, sr), lpTop = biquad("lp", 11500, 0.7, 0, sr);
  const stickBp = biquad("bp", 3800, 1.3, 0, sr);
  const ping = partials([
    { f: 2420, a: 0.95, t60: o.bell ? 2.4 : 1.3, ph: r2() * TAU },
    { f: 3580, a: 0.75, t60: o.bell ? 2.0 : 1.1, ph: r2() * TAU },
    { f: 5120, a: 0.55, t60: 0.9, ph: r2() * TAU },
  ], n, null, sr);
  const vg = pocketGain(v), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr, swell = 1 - Math.exp(-t / swellTau);
    const w = lpTop(hp(wash[i])) * swell * Math.exp(-t / (o.crash ? 1.05 : 0.55));
    const stick = i < 240 ? stickBp(r2.bi()) * Math.exp(-t / 0.0014) * (o.brush ? 0.25 : 0.85) : 0;
    const raw = L[i] * 0.08 + H[i] * swell * 0.055 + w * 0.14 + ping[i] * (o.bell ? 0.22 : 0.12) + stick;
    out[i] = raw * vg * (o.gain ?? 0.50);
  }
  return fadeEdges(out, 0.0003, 0.12, sr);
}

export function pocketHat(v = 0.55, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), open = Boolean(o.open);
  const n = Math.round((open ? 0.44 : 0.08) * sr), raw = noise(n, r, "white");
  const hp = biquad("hp", 4200, 0.7, 0, sr), lp = biquad("lp", 11500, 0.7, 0, sr), bp = biquad("bp", 6800, 1.1, 0, sr);
  const metal = partials([
    { f: 3120, a: 0.45, t60: open ? 0.35 : 0.05, ph: r() * TAU },
    { f: 4680, a: 0.48, t60: open ? 0.32 : 0.045, ph: r() * TAU },
    { f: 6840, a: 0.32, t60: open ? 0.26 : 0.04, ph: r() * TAU },
    { f: 9600, a: 0.18, t60: open ? 0.20 : 0.03, ph: r() * TAU },
  ], n, null, sr);
  const dec = open ? 0.14 : 0.020, vg = pocketGain(v), out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-i / (dec * sr));
    out[i] = lp((hp(raw[i]) * 0.42 + bp(raw[i]) * 0.45) * env + metal[i] * 0.34) * vg * (o.gain ?? 0.44);
  }
  return fadeEdges(out, 0.0003, 0.012, sr);
}

export function sliceBreak(buf, slices = 16, plan = [], seed = 1, o = {}) {
  const sr = o.sr ?? SR, sliceLen = Math.max(1, Math.floor(buf.length / slices));
  const steps = plan.length ? plan : Array.from({ length: slices }, (_, idx) => ({ idx }));
  const out = new Float32Array(steps.length * sliceLen);
  for (let s = 0; s < steps.length; s++) {
    const step = steps[s], idx = ((step.idx ?? s) % slices + slices) % slices;
    const start = idx * sliceLen, rate = Math.pow(2, (step.pitchSt ?? 0) / 12);
    const retrig = Math.max(1, Math.min(4, step.retrigger ?? 1)), segLen = Math.floor(sliceLen / retrig);
    const rev = Boolean(step.reverse), gain = step.gain ?? 1.0;
    const hp = step.hpHz ? biquad("hp", step.hpHz, 0.707, 0, sr) : null;
    for (let rep = 0; rep < retrig; rep++) {
      const dstBase = s * sliceLen + rep * segLen;
      for (let i = 0; i < segLen; i++) {
        const pos = rev ? (start + sliceLen - 1 - i * rate) : (start + i * rate);
        let smp = readFrac(buf, clamp(pos, start, start + sliceLen - 1));
        if (hp) smp = hp(smp);
        const fade = i < 32 ? i / 32 : (segLen - 1 - i < 48 ? (segLen - 1 - i) / 48 : 1);
        out[dstBase + i] = smp * gain * fade;
      }
    }
  }
  return out;
}
