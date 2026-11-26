// Clean-room melodic & harmonic taste instruments (Wave 30A-2, O-19 compliant).
// Zero commercial samples; deterministic by seed; supports 44.1 kHz and 48 kHz.
import { SR, TAU, rng, biquad, dcblock, fadeEdges, clamp, mtof, noise } from "../dsp.mjs";
import { partials } from "./modal.mjs";

export function tideRhodes(m, dur, v = 0.65, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), f = mtof(m);
  const t60 = Math.max(1.1, 5.2 * Math.pow(2, -(m - 48) / 18)) * (o.decay ?? 1);
  const rel = o.release ?? 0.22, nd = Math.round(dur * sr), len = nd + Math.round(rel * sr);
  const mono = new Float32Array(len);
  const k = Math.exp(-6.9078 / (t60 * sr)), kr = Math.exp(-6.9078 / (rel * sr));
  const barkG = 1.0 + 2.8 * Math.pow(Math.max(0, v - 0.55), 2) * (o.bark ?? 1);
  const fmIdx = (0.35 + 2.1 * v * v) * (o.bark ?? 1);
  const tineLvl = (0.14 + 0.36 * v) * (o.tine ?? 1) * clamp(950 / f, 0.35, 1.35);
  const p0 = r() * TAU, p1 = r() * TAU, p2 = r() * TAU, detHz = (r() - 0.5) * 2.4;
  const feltN = noise(Math.min(len, Math.round(0.016 * sr)), r, "white");
  const feltBp = biquad("bp", 5200, 1.1, 0, sr), pres = biquad("highshelf", 3800, 0.7, 3.0, sr);
  let a = 1;
  for (let i = 0; i < len; i++) {
    const t = i / sr, att = Math.min(1, i / (0.0012 * sr));
    const i1 = fmIdx * Math.exp(-t / 0.32) + 0.14;
    const body = 0.62 * Math.sin(TAU * f * t + p0 + i1 * Math.sin(TAU * f * t))
      + 0.38 * Math.sin(TAU * (2 * f + detHz) * t + p1) * Math.exp(-t / 0.65);
    const t7 = Math.sin(TAU * 7 * f * t + p2) * Math.exp(-t / 0.085);
    const t14 = Math.sin(TAU * 14 * f * t + p1) * Math.exp(-t / 0.038);
    const felt = i < feltN.length ? feltBp(feltN[i]) * Math.exp(-t / 0.0045) * (0.18 + 0.45 * v) : 0;
    const raw = (body * 0.78 + (t7 * 0.6 + t14 * 0.4) * tineLvl + felt) * att;
    mono[i] = pres(Math.tanh(barkG * (raw + 0.18 * raw * raw))) * a;
    a *= i < nd ? k : kr;
  }
  dcblock(mono);
  const g = (o.gain ?? 0.26) * (0.28 + 0.72 * Math.pow(v, 1.15));
  const L = new Float32Array(len), R = new Float32Array(len);
  const tremHz = o.tremHz ?? (3.8 + r() * 1.6), tremDepth = o.tremDepth ?? 0.42, tp = r() * TAU;
  for (let i = 0; i < len; i++) {
    const pan = tremDepth * Math.sin(TAU * tremHz * (i / sr) + tp);
    const ang = (clamp(pan, -0.9, 0.9) + 1) * Math.PI * 0.25;
    L[i] = mono[i] * g * Math.cos(ang) * 1.38;
    R[i] = mono[i] * g * Math.sin(ang) * 1.38;
  }
  fadeEdges(L, 0.001, 0.025, sr); fadeEdges(R, 0.001, 0.025, sr);
  return [L, R];
}

export function atlantisSub(m, dur, v = 0.82, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), fTarget = mtof(m);
  const fPrev = o.prevMidi != null ? mtof(o.prevMidi) : fTarget;
  const tau = o.glideTau ?? 0.058, rel = o.release ?? 0.08;
  const nd = Math.round(dur * sr), len = nd + Math.round(rel * sr), out = new Float32Array(len);
  const hpUp = biquad("hp", 120, 0.707, 0, sr), lpUp = biquad("lp", o.upperLp ?? 1450, 0.85, 0, sr);
  const lpSub = biquad("lp", 115, 0.707, 0, sr);
  const upperMix = o.upperMix ?? 0.36, crank = Boolean(o.crank808);
  let ph = 0, ph2 = 0, env = 1;
  const kr = Math.exp(-6.9078 / (rel * sr)), kd = Math.exp(-1 / ((o.decay ?? 2.4) * sr));
  for (let i = 0; i < len; i++) {
    const t = i / sr, att = Math.min(1, i / (0.003 * sr));
    let f = fPrev !== fTarget ? fTarget * Math.pow(fPrev / fTarget, Math.exp(-t / tau)) : fTarget;
    if (crank && t < 0.04) f *= Math.pow(2, 2.0 * Math.exp(-t / 0.006));
    ph += TAU * f / sr; ph2 += TAU * (2 * f) / sr;
    const tri2 = (2 / Math.PI) * Math.asin(Math.sin(ph2));
    const sub = lpSub(Math.sin(ph) + 0.2 * tri2);
    const saw = 2 * ((ph / TAU) - Math.floor(ph / TAU + 0.5));
    const fold = Math.tanh((saw + 0.35 * Math.sin(ph * 3)) * (1.4 + 1.1 * v));
    const upper = lpUp(hpUp(fold)) * Math.exp(-t / 0.45);
    out[i] = (sub * 0.92 + upper * upperMix) * att * env;
    env *= i < nd ? kd : kr;
  }
  dcblock(out);
  const g = (o.gain ?? 0.46) * (0.4 + 0.6 * v);
  for (let i = 0; i < len; i++) out[i] *= g;
  return fadeEdges(out, 0.002, 0.018, sr);
}

export function coffaroStrand(m, dur, v = 0.62, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), f0 = mtof(m);
  const n = Math.round((dur + (o.release ?? 0.55)) * sr), out = new Float32Array(n);
  const maxD = Math.max(8, Math.ceil(sr / Math.max(40, f0 * 0.92)) + 6);
  const line = new Float32Array(maxD);
  const pickPos = clamp(o.pickPos ?? 0.21, 0.08, 0.45), combD = Math.max(1, Math.round(sr / f0 * pickPos));
  const excLen = Math.min(maxD - 4, Math.round(sr / f0));
  const exc = noise(excLen + combD, r, "pink"), nailBp = biquad("bp", 4800, 1.3, 0, sr);
  for (let i = 0; i < excLen; i++) {
    const raw = exc[i + combD] - exc[i] * 0.72;
    line[i] = (raw * 0.75 + nailBp(r.bi()) * 0.28 * v) * (0.45 + 0.55 * v);
  }
  const b1 = biquad("bp", 108, 4.8, 0, sr), b2 = biquad("bp", 218, 5.5, 0, sr), b3 = biquad("bp", 470, 6.2, 0, sr);
  const airSh = biquad("highshelf", 3400, 0.7, 2.2, sr);
  const damp = clamp(o.damp ?? (0.9965 - 0.0012 * (1 - v)), 0.985, 0.9985);
  const scoopCents = o.scoopCents ?? -18, swellS = o.swellAttack ?? 0.012, driftPh = r() * TAU;
  let w = 0, lpPrev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const cents = scoopCents * Math.exp(-t / 0.065) + 4.0 * Math.sin(TAU * 0.45 * t + driftPh);
    const delay = clamp(sr / (f0 * Math.pow(2, cents / 1200)), 2.5, maxD - 3);
    const rp = (w - delay + maxD * 4) % maxD, i0 = Math.floor(rp), fr = rp - i0;
    const s0 = line[(i0 - 1 + maxD) % maxD], s1 = line[i0], s2 = line[(i0 + 1) % maxD], s3 = line[(i0 + 2) % maxD];
    const y = s1 + 0.5 * fr * (s2 - s0 + fr * (2 * s0 - 5 * s1 + 4 * s2 - s3 + fr * (3 * (s1 - s2) + s3 - s0)));
    const filt = (0.58 * y + 0.42 * lpPrev) * damp;
    lpPrev = filt;
    line[w] = filt;
    w = (w + 1) % maxD;
    const body = b1(y) * 0.34 + b2(y) * 0.26 + b3(y) * 0.18;
    const swell = Math.min(1, t / Math.max(0.002, swellS));
    out[i] = airSh(y * 0.72 + body) * swell;
  }
  dcblock(out);
  const g = (o.gain ?? 0.34) * (0.32 + 0.68 * v);
  for (let i = 0; i < n; i++) out[i] *= g;
  return fadeEdges(out, 0.002, 0.045, sr);
}

export function lateefBreath(m, dur, v = 0.68, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), f0 = mtof(m);
  const rel = o.release ?? 0.16, nd = Math.round(dur * sr), len = nd + Math.round(rel * sr);
  const out = new Float32Array(len), maxD = Math.max(16, Math.ceil(sr / Math.max(70, f0 * 0.85)) + 6);
  const bore = new Float32Array(maxD);
  const f1 = biquad("bp", 600 + clamp((f0 - 220) * 0.35, -120, 260), 2.8, 0, sr);
  const f2 = biquad("bp", 1450 + clamp((f0 - 220) * 0.6, -200, 480), 3.2, 0, sr);
  const f3 = biquad("bp", 2800 + clamp((f0 - 220) * 0.9, -300, 900), 3.6, 0, sr);
  const brBp = biquad("bp", 5400, 0.85, 0, sr), lpBell = biquad("lp", 3600 + 2800 * v, 0.7, 0, sr);
  const vibHz = o.vibHz ?? (4.8 + r() * 0.6), vibPh = r() * TAU;
  let w = 0, reflPrev = 0, env = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const target = i < nd ? (0.42 + 0.52 * v) : 0;
    env += (target - env) * (i < nd ? 0.0018 : 0.0006);
    const vibDepth = 0.009 * clamp((t - 0.12) / 0.35, 0, 1);
    const f = f0 * (1 + vibDepth * Math.sin(TAU * vibHz * t + vibPh));
    const d = clamp(sr / f - 1.0, 2.0, maxD - 3);
    const rp = (w - d + maxD * 4) % maxD, i0 = Math.floor(rp), fr = rp - i0;
    const returning = bore[i0] * (1 - fr) + bore[(i0 + 1) % maxD] * fr;
    const bell = lpBell(-0.88 * (0.65 * returning + 0.35 * reflPrev));
    reflPrev = returning;
    const breath = brBp(r.bi()) * (0.14 + 0.24 * v) * env;
    const dp = bell - env;
    const reedR = clamp(-0.75 * dp + 0.45, -1, 1);
    const pIn = env + dp * reedR + breath * 0.35;
    bore[w] = clamp(pIn, -1.2, 1.2);
    w = (w + 1) % maxD;
    const sig = 0.55 * returning + 0.55 * f1(returning) + 0.42 * f2(returning) + 0.35 * f3(returning) + breath * 0.48;
    out[i] = Math.tanh(sig * 1.15);
  }
  dcblock(out);
  const g = (o.gain ?? 0.28) * (0.35 + 0.65 * v);
  for (let i = 0; i < len; i++) out[i] *= g;
  return fadeEdges(out, 0.008, 0.04, sr);
}

export function sakamotoChamber(m, dur, v = 0.55, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), f0 = mtof(m);
  const B = clamp(0.00016 * Math.pow(2, (m - 48) / 14), 0.00015, 0.0038);
  const t60Base = clamp(7.2 * Math.pow(2, -(m - 48) / 22), 1.4, 9.5) * (o.decay ?? 1);
  const rel = o.release ?? 0.35, nd = Math.round(dur * sr), len = nd + Math.round(rel * sr);
  const felt = clamp(o.felt ?? 0.65, 0, 1);
  const modes = [];
  for (let k = 1; k <= 12; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > sr * 0.44) break;
    const bright = Math.pow(k, -(1.15 + felt * (1 - v) * 0.85));
    for (let u = 0; u < (k <= 4 ? 3 : 1); u++) {
      const det = u === 0 ? 0 : (u === 1 ? -0.35 : 0.42) * (1 + k * 0.12);
      modes.push({ f: fk + det, a: bright / (k <= 4 ? 2.4 : 1), t60: t60Base / Math.pow(k, 0.55), ph: r() * TAU });
    }
  }
  const body = partials(modes, len, null, sr);
  const symp = partials([{ f: f0 * 2, a: 0.07, t60: t60Base * 1.1, ph: r() * TAU }, { f: f0 * 3, a: 0.035, t60: t60Base * 0.7, ph: r() * TAU }], len, null, sr);
  const thumpLp = biquad("lp", 160, 0.8, 0, sr), feltBp = biquad("bp", 7200, 1.1, 0, sr);
  const out = new Float32Array(len), kr = Math.exp(-6.9078 / (rel * sr));
  let env = 1;
  for (let i = 0; i < len; i++) {
    const t = i / sr, att = Math.min(1, i / (0.004 * sr));
    const thump = i < 900 ? thumpLp(r.bi()) * Math.exp(-t / 0.009) * 0.38 : 0;
    const mech = i < 1200 ? feltBp(r.bi()) * Math.exp(-t / 0.011) * (0.24 + 0.35 * felt) : 0;
    out[i] = (body[i] + symp[i] + thump + mech) * att * env;
    if (i >= nd) env *= kr;
  }
  dcblock(out);
  const g = (o.gain ?? 0.34) * (0.26 + 0.74 * Math.pow(v, 1.25));
  for (let i = 0; i < len; i++) out[i] *= g;
  return fadeEdges(out, 0.002, 0.04, sr);
}

export function sakamotoStrings(midis, dur, v = 0.5, seed = 1, o = {}) {
  const sr = o.sr ?? SR, r = rng(seed), rel = o.release ?? 1.2;
  const nd = Math.round(dur * sr), len = nd + Math.round(rel * sr);
  const L = new Float32Array(len), R = new Float32Array(len);
  const notes = Array.isArray(midis) ? midis : [midis];
  for (let ni = 0; ni < notes.length; ni++) {
    const f0 = mtof(notes[ni]), voices = 6;
    for (let vi = 0; vi < voices; vi++) {
      const det = (vi - (voices - 1) * 0.5) * 3.8 + (r() - 0.5) * 1.6;
      const fv = f0 * Math.pow(2, det / 1200), pan = ((vi / (voices - 1)) * 2 - 1) * 0.78;
      const gl = Math.cos((pan + 1) * Math.PI * 0.25), gr = Math.sin((pan + 1) * Math.PI * 0.25);
      const lp = biquad("lp", 1600, 0.7, 0, sr), ph0 = r() * TAU, lfoPh = r() * TAU;
      let ph = ph0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        if ((i & 255) === 0) {
          const cut = clamp((o.baseCut ?? 1400) + (o.sweepCut ?? 2200) * (0.5 + 0.5 * Math.sin(TAU * 0.14 * t + lfoPh)), 400, 7500);
          lp.set(cut, 0.75);
        }
        const att = Math.min(1, t / (o.attack ?? 0.55));
        const dec = i < nd ? 1 : Math.exp(-(i - nd) / (rel * 0.42 * sr));
        ph += TAU * fv * (1 + 0.0028 * Math.sin(TAU * (4.7 + vi * 0.23) * t + lfoPh)) / sr;
        const saw = 2 * ((ph / TAU) - Math.floor(ph / TAU + 0.5));
        const tri = (2 / Math.PI) * Math.asin(Math.sin(ph));
        const s = lp(saw * 0.68 + tri * 0.32) * att * dec;
        L[i] += s * gl; R[i] += s * gr;
      }
    }
  }
  const scaleG = (o.gain ?? 0.16) * (0.35 + 0.65 * v) / Math.max(1, Math.sqrt(notes.length * 6));
  for (let i = 0; i < len; i++) { L[i] *= scaleG; R[i] *= scaleG; }
  fadeEdges(L, 0.015, 0.08, sr); fadeEdges(R, 0.015, 0.08, sr);
  return [L, R];
}
