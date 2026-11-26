// Estuary Clock-Drift (Kuramoto phase-pocket ensemble), Wave 29B audio_features
// emitter, and full-track 4096-pt Hann Welch PSD mastering audit harness.
import { SR, TAU, rng, clamp } from "./dsp.mjs";
import { fft } from "./fft.mjs";
import { kWeightedLufs, truePeak4x } from "./estuary-space.mjs";

export function createEstuaryClockDrift({
  lanes = ["breaks", "chops", "bass", "keys", "lead", "space"],
  bpm = 126, couplingK = 4.5, masterK = 3.5, detuneHz = 0.08, seed = 1,
} = {}) {
  const r = rng(seed), n = lanes.length, baseOmega = TAU * (bpm / 60);
  const omegas = lanes.map(() => baseOmega * (1 + (r() - 0.5) * 2 * (detuneHz / Math.max(0.5, bpm / 60))));
  const phases = lanes.map((_, i) => (i === 0 ? 0 : (r() - 0.5) * 0.25));
  let masterPhase = 0;

  function step(dtSec = 0.01) {
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let coup = 0;
      for (let j = 0; j < n; j++) coup += Math.sin(phases[j] - phases[i]);
      const dTheta = omegas[i] + (couplingK / n) * coup + masterK * Math.sin(masterPhase - phases[i]);
      next[i] = phases[i] + dTheta * dtSec;
    }
    masterPhase += baseOmega * dtSec;
    for (let i = 0; i < n; i++) phases[i] = next[i];
    return state();
  }

  function state() {
    let sx = 0, sy = 0;
    const offsetsMs = {};
    for (let i = 0; i < n; i++) {
      const diff = Math.atan2(Math.sin(phases[i] - masterPhase), Math.cos(phases[i] - masterPhase));
      sx += Math.cos(diff); sy += Math.sin(diff);
      offsetsMs[lanes[i]] = Number(((diff / baseOmega) * 1000).toFixed(3));
    }
    const orderR = Math.hypot(sx, sy) / n;
    return {
      orderR: Number(orderR.toFixed(6)),
      gridFitEstimate: Number(clamp(orderR, 0, 1).toFixed(4)),
      masterBeatPhase: Number((((masterPhase % TAU) + TAU) % TAU / TAU).toFixed(6)),
      offsetsMs,
    };
  }

  return { step, state, lanes };
}

export function extractAudioFeaturesFrame(L, R, {
  sr = SR, offset = 0, size = 1024, beatPhase = 0, onsetImpulse = 0,
  activeChord = "Cm9", seedReceipt = "sha256:0000",
} = {}) {
  const re = new Float64Array(size), im = new Float64Array(size);
  let sumSq = 0;
  for (let i = 0; i < size; i++) {
    const idx = offset + i;
    const x = idx < L.length ? 0.5 * (L[idx] + R[idx]) : 0;
    sumSq += x * x;
    re[i] = x * (0.5 - 0.5 * Math.cos(TAU * i / size));
  }
  fft(re, im);
  const rms = Math.sqrt(sumSq / Math.max(1, size));
  const half = size >> 1, edges = [20, 60, 150, 350, 800, 1800, 4000, 9000, 20000];
  const bands8 = new Array(8).fill(0);
  let num = 0, den = 0;
  for (let k = 1; k <= half; k++) {
    const f = k * sr / size, p = (re[k] * re[k] + im[k] * im[k]) * 2 / (size * size);
    num += f * p; den += p;
    for (let b = 0; b < 8; b++) if (f >= edges[b] && f < edges[b + 1]) { bands8[b] += p; break; }
  }
  const bSum = bands8.reduce((a, b) => a + b, 0) || 1e-12;
  const normBands = bands8.map((v) => Number((v / bSum).toFixed(6)));
  const lufsShort = rms > 1e-6 ? Number((-0.691 + 20 * Math.log10(rms)).toFixed(3)) : -120;
  return {
    rms: Number(rms.toFixed(6)),
    lufs_short: lufsShort,
    centroid_hz: Number((den > 1e-18 ? num / den : 0).toFixed(2)),
    bands8: normBands,
    beat_phase: Number(clamp(beatPhase, 0, 1).toFixed(6)),
    onset_impulse: Number(clamp(onsetImpulse, 0, 1).toFixed(6)),
    active_chord: String(activeChord),
    seed_receipt: String(seedReceipt),
  };
}

export function welchAuditStereo(L, R, sr = 48000, nFft = 4096) {
  const n = L.length, mono = new Float32Array(n);
  let sL = 0, sR = 0, sLR = 0, clips = 0;
  const alphaLo = (TAU * 120 / sr) / (1 + TAU * 120 / sr);
  let l1 = 0, l2 = 0, r1 = 0, r2 = 0, llLo = 0, rrLo = 0, lrLo = 0;
  for (let i = 0; i < n; i++) {
    const a = L[i], b = R[i];
    if (Math.abs(a) >= 0.999) clips++;
    if (Math.abs(b) >= 0.999) clips++;
    mono[i] = 0.5 * (a + b);
    sL += a * a; sR += b * b; sLR += a * b;
    l1 += alphaLo * (a - l1); l2 += alphaLo * (l1 - l2);
    r1 += alphaLo * (b - r1); r2 += alphaLo * (r1 - r2);
    llLo += l2 * l2; rrLo += r2 * r2; lrLo += l2 * r2;
  }
  // Skip leading/trailing digital silence (< -70 dBFS)
  let start = 0, end = n;
  while (start < n - nFft && Math.abs(mono[start]) < 3.2e-4) start++;
  while (end > start + nFft && Math.abs(mono[end - 1]) < 3.2e-4) end--;
  const hop = nFft >> 1, half = nFft >> 1;
  const win = new Float64Array(nFft);
  for (let i = 0; i < nFft; i++) win[i] = 0.5 * (1 - Math.cos(TAU * i / nFft));
  const psd = new Float64Array(half + 1), cFrames = [];
  let frames = 0;
  const re = new Float64Array(nFft), im = new Float64Array(nFft);
  for (let s = start; s + nFft <= end; s += hop) {
    for (let i = 0; i < nFft; i++) { re[i] = mono[s + i] * win[i]; im[i] = 0; }
    fft(re, im);
    let cNum = 0, cDen = 0;
    for (let k = 0; k <= half; k++) {
      const w = (k === 0 || k === half) ? 1 : 2;
      const p = (re[k] * re[k] + im[k] * im[k]) * w / (nFft * nFft);
      psd[k] += p;
      cNum += k * p; cDen += p;
    }
    if (cDen > 1e-12) cFrames.push((cNum / cDen) * (sr / nFft));
    frames++;
  }
  const inv = 1 / Math.max(1, frames), df = sr / nFft;
  let totP = 0, cNumAll = 0;
  const bandsDef = [["sub_bass", 20, 60], ["bass", 60, 250], ["low_mid", 250, 500], ["mid", 500, 2000], ["presence", 2000, 6000], ["air", 6000, 20000]];
  const bAcc = Object.fromEntries(bandsDef.map(([k]) => [k, 0]));
  const xs = [], ys = [];
  for (let k = 0; k <= half; k++) {
    const p = psd[k] * inv, f = k * df;
    totP += p; cNumAll += f * p;
    for (const [bk, lo, hi] of bandsDef) if (f >= lo && f < hi) { bAcc[bk] += p; break; }
    if (f >= 100 && f <= 8000 && p > 1e-18) { xs.push(Math.log2(f)); ys.push(10 * Math.log10(p)); }
  }
  const mx = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const my = ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);
  let tNum = 0, tDen = 0;
  for (let i = 0; i < xs.length; i++) { tNum += (xs[i] - mx) * (ys[i] - my); tDen += (xs[i] - mx) ** 2; }
  const tilt = tDen > 1e-12 ? tNum / tDen : 0;
  const perBlk = Math.max(1, Math.round(2.0 / (hop / sr))), blkC = [];
  for (let i = 0; i + perBlk <= cFrames.length; i += perBlk) {
    let sm = 0; for (let j = 0; j < perBlk; j++) sm += cFrames[i + j];
    blkC.push(sm / perBlk);
  }
  const cVals = blkC.length >= 2 ? blkC : cFrames;
  const cMean = cVals.reduce((a, b) => a + b, 0) / Math.max(1, cVals.length);
  const cStd = Math.sqrt(cVals.reduce((a, v) => a + (v - cMean) ** 2, 0) / Math.max(1, cVals.length));
  const blk1s = Math.round(sr), dbs = [];
  for (let s = start; s + blk1s <= end; s += blk1s) {
    let ss = 0; for (let i = 0; i < blk1s; i++) ss += mono[s + i] * mono[s + i];
    const r1s = Math.sqrt(ss / blk1s);
    if (r1s > 3.2e-4) dbs.push(20 * Math.log10(r1s));
  }
  dbs.sort((a, b) => a - b);
  const macroDr = dbs.length >= 2 ? dbs[Math.round(0.95 * (dbs.length - 1))] - dbs[Math.round(0.10 * (dbs.length - 1))] : 0;
  const tp = truePeak4x([L, R]), bandsPct = {};
  for (const [bk] of bandsDef) bandsPct[bk] = Number(((bAcc[bk] / Math.max(1e-18, totP)) * 100).toFixed(3));
  return {
    dur_s: Number((n / sr).toFixed(3)),
    welch_frames: frames,
    integrated_lufs: Number(kWeightedLufs([L, R], sr).toFixed(3)),
    true_peak_dbtp: Number((tp > 1e-12 ? 20 * Math.log10(tp) : -120).toFixed(3)),
    clipping_samples: clips,
    spectral_tilt_db_per_oct: Number(tilt.toFixed(3)),
    bands_pct: bandsPct,
    welch_centroid_hz: Number((cNumAll / Math.max(1e-18, totP)).toFixed(2)),
    centroid_std_hz: Number(cStd.toFixed(2)),
    macro_dynamic_range_db: Number(macroDr.toFixed(3)),
    low_end_phase_corr: Number(clamp(lrLo / Math.max(1e-12, Math.sqrt(llLo * rrLo)), -1, 1).toFixed(4)),
    full_band_phase_corr: Number(clamp(sLR / Math.max(1e-12, Math.sqrt(sL * sR)), -1, 1).toFixed(4)),
  };
}

export const ROUND3_GATES = Object.freeze({
  "site-main-theme": {
    lufs: [-15.0, -13.0], maxTp: -1.0, tilt: [-5.8, -3.5], subMin: 4.0, presMin: 5.0, airMin: 1.5,
    cent: [1000, 2400], centStdMin: 220, drMin: 6.5, lowCorrMin: 0.92, fullCorr: [0.45, 0.85],
  },
  "playground-acoustic-demo": {
    lufs: [-15.0, -13.0], maxTp: -1.0, tilt: [-5.8, -3.5], subMin: 8.0, presMin: 5.0, airMin: 2.0,
    cent: [1050, 2600], centStdMin: 250, drMin: 7.5, lowCorrMin: 0.94, fullCorr: [0.45, 0.85],
  },
  "explainer-bed-calm": {
    lufs: [-19.0, -17.0], maxTp: -1.5, tilt: [-6.8, -4.5], subMin: 2.0, presMin: 2.5, airMin: 0.7,
    cent: [700, 1500], centStdMin: 140, drMin: 5.5, lowCorrMin: 0.90, fullCorr: [0.50, 0.88],
  },
});

export function verifyRound3Gates(m, profileName) {
  const g = ROUND3_GATES[profileName];
  if (!g) throw new Error(`Unknown Round 3 gate profile: ${profileName}`);
  const errs = [];
  if (m.clipping_samples > 0) errs.push(`clipping=${m.clipping_samples}`);
  if (m.integrated_lufs < g.lufs[0] || m.integrated_lufs > g.lufs[1]) errs.push(`lufs=${m.integrated_lufs}`);
  if (m.true_peak_dbtp > g.maxTp + 0.05) errs.push(`tp=${m.true_peak_dbtp}`);
  if (m.spectral_tilt_db_per_oct < g.tilt[0] || m.spectral_tilt_db_per_oct > g.tilt[1]) errs.push(`tilt=${m.spectral_tilt_db_per_oct}`);
  if (m.bands_pct.sub_bass < g.subMin) errs.push(`sub=${m.bands_pct.sub_bass}%`);
  if (m.bands_pct.presence < g.presMin) errs.push(`presence=${m.bands_pct.presence}%`);
  if (m.bands_pct.air < g.airMin) errs.push(`air=${m.bands_pct.air}%`);
  if (m.welch_centroid_hz < g.cent[0] || m.welch_centroid_hz > g.cent[1]) errs.push(`centroid=${m.welch_centroid_hz}`);
  if (m.centroid_std_hz < g.centStdMin) errs.push(`centroid_std=${m.centroid_std_hz}`);
  if (m.macro_dynamic_range_db < g.drMin) errs.push(`macro_dr=${m.macro_dynamic_range_db}`);
  if (m.low_end_phase_corr < g.lowCorrMin) errs.push(`low_corr=${m.low_end_phase_corr}`);
  if (m.full_band_phase_corr < g.fullCorr[0] || m.full_band_phase_corr > g.fullCorr[1]) errs.push(`full_corr=${m.full_band_phase_corr}`);
  return { ok: errs.length === 0, errors: errs };
}
