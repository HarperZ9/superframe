// Estuary-Space Master & Spatial FX Rack (Wave 30A-2, clean-room DSP).
// 8x8 Hadamard FDN reverb with detune-retune shimmer, kick-keyed sidechain VCA,
// LR4 <120 Hz mono-maker, parallel >3.2 kHz air exciter, master glue VCA,
// and 4x oversampled -1.0 dBTP true-peak limiter.
import { SR, TAU, biquad, clamp, dbToGain, readFrac } from "./dsp.mjs";

const FDN_MS = [29.3, 34.7, 41.9, 47.3, 53.9, 61.7, 71.1, 82.3];
const FDN_LFO_HZ = [0.27, 0.31, 0.37, 0.41, 0.47, 0.53, 0.59, 0.63];

// Fast orthonormal 8x8 Walsh-Hadamard transform (H_8 / sqrt(8)) in-place
export function hadamard8(v) {
  let a, b;
  for (let i = 0; i < 8; i += 2) { a = v[i]; b = v[i + 1]; v[i] = a + b; v[i + 1] = a - b; }
  for (let i = 0; i < 8; i += 4) {
    a = v[i]; b = v[i + 2]; v[i] = a + b; v[i + 2] = a - b;
    a = v[i + 1]; b = v[i + 3]; v[i + 1] = a + b; v[i + 3] = a - b;
  }
  for (let i = 0; i < 4; i++) { a = v[i]; b = v[i + 4]; v[i] = (a + b) * 0.35355339059327373; v[i + 4] = (a - b) * 0.35355339059327373; }
  return v;
}

export function fdnReverb(pair, o = {}) {
  const sr = o.sr ?? SR, n = pair[0].length, mix = clamp(o.mix ?? 0.24, 0, 1);
  const t60 = clamp(o.t60 ?? 2.8, 0.4, 8.0), preD = Math.max(1, Math.round((o.preDelayMs ?? 24) * 0.001 * sr));
  const dampHz = o.dampHz ?? 5400, shimmer = clamp(o.shimmer ?? 0.0, 0, 0.3);
  const modDepth = (o.modMs ?? 0.35) * 0.001 * sr;
  const maxD = FDN_MS.map((ms) => Math.ceil((ms * 0.001) * sr) + Math.ceil(modDepth) + 8);
  const bufs = maxD.map((len) => new Float32Array(len));
  const baseD = FDN_MS.map((ms) => ms * 0.001 * sr);
  const gains = FDN_MS.map((ms) => Math.pow(10, (-3 * ms * 0.001) / t60));
  const lpA = Math.exp(-TAU * dampHz / sr), lpState = new Float64Array(8);
  const wp = new Int32Array(8), vec = new Float64Array(8);
  const preL = new Float32Array(preD), preR = new Float32Array(preD);
  const shBuf = new Float32Array(2048);
  let preI = 0, shW = 0, shR1 = 0, shR2 = 1024;
  const outL = new Float32Array(n), outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const inL = preL[preI], inR = preR[preI];
    preL[preI] = pair[0][i]; preR[preI] = pair[1][i];
    preI = (preI + 1) % preD;
    const t = i / sr;
    for (let k = 0; k < 8; k++) {
      const mlen = maxD[k], d = baseD[k] + modDepth * Math.sin(TAU * FDN_LFO_HZ[k] * t + k * 0.9);
      const rp = (wp[k] - d + mlen * 4) % mlen, i0 = Math.floor(rp), fr = rp - i0;
      const s = bufs[k][i0] * (1 - fr) + bufs[k][(i0 + 1) % mlen] * fr;
      lpState[k] = s * (1 - lpA) + lpState[k] * lpA;
      vec[k] = lpState[k] * gains[k];
    }
    let shOut = 0;
    if (shimmer > 0) {
      const sumS = (vec[0] + vec[2] + vec[4] + vec[6]) * 0.25;
      shBuf[shW] = sumS;
      const g1 = readFrac(shBuf, shR1) * (0.5 - 0.5 * Math.cos(TAU * (shR1 / 2048)));
      const g2 = readFrac(shBuf, shR2) * (0.5 - 0.5 * Math.cos(TAU * (shR2 / 2048)));
      shOut = (g1 + g2) * shimmer;
      shW = (shW + 1) & 2047;
      shR1 = (shR1 + 2.008) % 2048; // +12 st +7 cents
      shR2 = (shR2 + 1.992) % 2048; // +12 st -7 cents
    }
    hadamard8(vec);
    let wetL = 0, wetR = 0;
    for (let k = 0; k < 8; k++) {
      const inj = ((k & 1) === 0 ? inL : inR) * 0.35 + (k === 1 || k === 5 ? shOut : 0);
      bufs[k][wp[k]] = vec[k] + inj;
      wp[k] = (wp[k] + 1) % maxD[k];
      if ((k & 1) === 0) wetL += vec[k] * (k < 4 ? 1 : -1);
      else wetR += vec[k] * (k < 4 ? 1 : -1);
    }
    outL[i] = pair[0][i] * (1 - mix * 0.35) + wetL * mix * 0.45;
    outR[i] = pair[1][i] * (1 - mix * 0.35) + wetR * mix * 0.45;
  }
  return [outL, outR];
}

export function sidechainVca(pair, keyMono, o = {}) {
  const sr = o.sr ?? SR, n = pair[0].length;
  const thresh = dbToGain(o.threshDb ?? -22), ratio = o.ratio ?? 3.2;
  const att = Math.exp(-1 / (Math.max(0.001, (o.attackMs ?? 6) * 0.001) * sr));
  const rel = Math.exp(-1 / (Math.max(0.01, (o.releaseMs ?? 95) * 0.001) * sr));
  const maxGr = dbToGain(-(o.maxGrDb ?? 4.5));
  const outL = new Float32Array(n), outR = new Float32Array(n);
  let env = 0;
  for (let i = 0; i < n; i++) {
    const k = Math.abs(keyMono[i] ?? 0);
    env = k > env ? att * env + (1 - att) * k : rel * env + (1 - rel) * k;
    let gr = 1;
    if (env > thresh) {
      const over = env / thresh;
      gr = Math.max(maxGr, Math.pow(over, (1 / ratio) - 1));
    }
    outL[i] = pair[0][i] * gr;
    outR[i] = pair[1][i] * gr;
  }
  return [outL, outR];
}

export function masterGlueVca(pair, o = {}) {
  const sr = o.sr ?? SR, n = pair[0].length;
  const thresh = dbToGain(o.threshDb ?? -14), ratio = o.ratio ?? 2.0;
  const att = Math.exp(-1 / (Math.max(0.005, (o.attackMs ?? 30) * 0.001) * sr));
  const rel = Math.exp(-1 / (Math.max(0.02, (o.releaseMs ?? 100) * 0.001) * sr));
  const makeup = dbToGain(o.makeupDb ?? 1.2);
  const outL = new Float32Array(n), outR = new Float32Array(n);
  let env = 0;
  for (let i = 0; i < n; i++) {
    const det = Math.max(Math.abs(pair[0][i]), Math.abs(pair[1][i]));
    env = det > env ? att * env + (1 - att) * det : rel * env + (1 - rel) * det;
    const gr = env > thresh ? Math.pow(env / thresh, (1 / ratio) - 1) : 1;
    outL[i] = pair[0][i] * gr * makeup;
    outR[i] = pair[1][i] * gr * makeup;
  }
  return [outL, outR];
}

// Linkwitz-Riley 4th-order <cutoffHz mono-maker: zeroes side channel below cutoffHz
export function monoMakerLR4(pair, cutoffHz = 120, sr = SR, highWidth = 1.0) {
  const n = pair[0].length, outL = new Float32Array(n), outR = new Float32Array(n);
  const hp1 = biquad("hp", cutoffHz, 0.70710678, 0, sr);
  const hp2 = biquad("hp", cutoffHz, 0.70710678, 0, sr);
  for (let i = 0; i < n; i++) {
    const m = 0.5 * (pair[0][i] + pair[1][i]);
    const s = hp2(hp1(0.5 * (pair[0][i] - pair[1][i]))) * highWidth;
    outL[i] = m + s;
    outR[i] = m - s;
  }
  return [outL, outR];
}

export function airExciter(pair, o = {}) {
  const sr = o.sr ?? SR, n = pair[0].length, hpHz = o.hpHz ?? 3200;
  const blend = dbToGain(o.blendDb ?? -11), shelfDb = o.shelfDb ?? 2.8, drive = o.drive ?? 1.8;
  return pair.map((x) => {
    const hp = biquad("hp", hpHz, 0.707, 0, sr), hs = biquad("highshelf", 8000, 0.7, shelfDb, sr);
    const y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const h = hp(x[i]);
      const sat = Math.tanh(drive * h) - 0.12 * h * h;
      y[i] = x[i] + hs(sat) * blend;
    }
    return y;
  });
}

// 4x oversampled Catmull-Rom inter-sample true-peak detector & lookahead limiter
export function truePeak4x(pair) {
  let tp = 0;
  for (const x of pair) {
    const n = x.length;
    for (let i = 1; i < n - 2; i++) {
      const y0 = x[i - 1], y1 = x[i], y2 = x[i + 1], y3 = x[i + 2];
      const a1 = Math.abs(y1);
      if (a1 > tp) tp = a1;
      for (let q = 1; q <= 3; q++) {
        const t = q * 0.25;
        const v = y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0)));
        const av = Math.abs(v);
        if (av > tp) tp = av;
      }
    }
  }
  return tp;
}

export function truePeakLimiter4x(pair, ceilingDb = -1.0, sr = SR) {
  const n = pair[0].length, ceil = dbToGain(ceilingDb), look = Math.round(0.005 * sr);
  const rel = Math.exp(-1 / (0.065 * sr)), att = Math.exp(-1 / (0.0015 * sr));
  const peakEnv = new Float32Array(n);
  for (let i = 1; i < n - 2; i++) {
    let localP = Math.max(Math.abs(pair[0][i]), Math.abs(pair[1][i]));
    for (let ch = 0; ch < 2; ch++) {
      const x = pair[ch], y0 = x[i - 1], y1 = x[i], y2 = x[i + 1], y3 = x[i + 2];
      for (let q = 1; q <= 3; q++) {
        const t = q * 0.25;
        const v = Math.abs(y1 + 0.5 * t * (y2 - y0 + t * (2 * y0 - 5 * y1 + 4 * y2 - y3 + t * (3 * (y1 - y2) + y3 - y0))));
        if (v > localP) localP = v;
      }
    }
    peakEnv[i] = localP;
  }
  const outL = new Float32Array(n), outR = new Float32Array(n);
  let gr = 1;
  for (let i = 0; i < n; i++) {
    let winP = 0;
    const end = Math.min(n, i + look);
    for (let j = i; j < end; j += 2) if (peakEnv[j] > winP) winP = peakEnv[j];
    const target = winP > ceil ? ceil / winP : 1;
    gr = target < gr ? att * gr + (1 - att) * target : rel * gr + (1 - rel) * target;
    const sc = ceil * 0.992;
    outL[i] = sc * Math.tanh((pair[0][i] * gr) / sc);
    outR[i] = sc * Math.tanh((pair[1][i] * gr) / sc);
  }
  const postTp = truePeak4x([outL, outR]);
  if (postTp > ceil) {
    const trim = (ceil * 0.996) / postTp;
    for (let i = 0; i < n; i++) { outL[i] *= trim; outR[i] *= trim; }
  }
  return [outL, outR];
}

export function kWeightedLufs(pair, sr = SR) {
  const n = pair[0].length;
  if (!n) return -120;
  const rc = 1 / (TAU * 60), a = rc / (rc + 1 / sr);
  let yHp = 0, prevX = 0, sumSq = 0;
  for (let i = 0; i < n; i++) {
    const x = 0.5 * (pair[0][i] + pair[1][i]);
    yHp = a * (yHp + x - prevX);
    const shelf = yHp + 0.35 * (x - prevX);
    prevX = x;
    sumSq += shelf * shelf;
  }
  const ms = sumSq / n;
  return ms > 1e-12 ? -0.691 + 10 * Math.log10(ms) : -120;
}

export function estuaryMasterChain(pair, o = {}) {
  const sr = o.sr ?? SR;
  let bus = monoMakerLR4(pair, o.monoHz ?? 120, sr, o.highWidth ?? 1.0);
  if (o.subShelfDb) {
    const sL = biquad("lowshelf", o.subShelfHz ?? 85, 0.7, o.subShelfDb, sr);
    const sR = biquad("lowshelf", o.subShelfHz ?? 85, 0.7, o.subShelfDb, sr);
    sL.run(bus[0]); sR.run(bus[1]);
  }
  if (o.warmBodyDb) {
    const wL = biquad("peak", o.warmBodyHz ?? 320, o.warmBodyQ ?? 0.7, o.warmBodyDb, sr);
    const wR = biquad("peak", o.warmBodyHz ?? 320, o.warmBodyQ ?? 0.7, o.warmBodyDb, sr);
    wL.run(bus[0]); wR.run(bus[1]);
  }
  if (o.vocalCarveDb) {
    const dipL = biquad("peak", o.vocalCarveHz ?? 1800, o.vocalCarveQ ?? 0.9, o.vocalCarveDb, sr);
    const dipR = biquad("peak", o.vocalCarveHz ?? 1800, o.vocalCarveQ ?? 0.9, o.vocalCarveDb, sr);
    dipL.run(bus[0]); dipR.run(bus[1]);
  }
  if (o.presenceDb) {
    const pL = biquad("peak", o.presenceHz ?? 3400, 0.9, o.presenceDb, sr);
    const pR = biquad("peak", o.presenceHz ?? 3400, 0.9, o.presenceDb, sr);
    pL.run(bus[0]); pR.run(bus[1]);
  }
  if (o.airShelfDb !== undefined && o.airShelfDb !== 0) {
    const aL = biquad("highshelf", o.airShelfHz ?? 7200, 0.7, o.airShelfDb, sr);
    const aR = biquad("highshelf", o.airShelfHz ?? 7200, 0.7, o.airShelfDb, sr);
    aL.run(bus[0]); aR.run(bus[1]);
  }
  if (o.topLpHz) {
    const lpL = biquad("lp", o.topLpHz, 0.707, 0, sr), lpR = biquad("lp", o.topLpHz, 0.707, 0, sr);
    lpL.run(bus[0]); lpR.run(bus[1]);
  }
  bus = airExciter(bus, { sr, blendDb: o.airBlendDb ?? -18, shelfDb: o.exciterShelfDb ?? 1.5 });
  bus = masterGlueVca(bus, { sr, threshDb: o.glueThreshDb ?? -14, ratio: o.glueRatio ?? 2.2, makeupDb: o.glueMakeupDb ?? 1.5 });
  const targetLufs = o.targetLufs ?? -14.0, ceilingDb = o.ceilingDb ?? -1.0;
  for (let pass = 0; pass < 2; pass++) {
    const curLufs = kWeightedLufs(bus, sr);
    const trim = dbToGain(clamp(targetLufs - curLufs, -18, 18));
    for (let i = 0; i < bus[0].length; i++) { bus[0][i] *= trim; bus[1][i] *= trim; }
    bus = truePeakLimiter4x(bus, ceilingDb, sr);
  }
  return bus;
}
