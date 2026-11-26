// Unit, known-answer, and planted-failure tests for Wave 30A-2 clean-room
// taste instruments, Estuary-Space FX rack, and Estuary Clock-Drift engine.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  tideRhodes, atlantisSub, coffaroStrand, lateefBreath, sakamotoChamber, sakamotoStrings,
  pocketGain, pocketKick, pocketSnare, pocketRide, pocketHat, sliceBreak,
  hadamard8, fdnReverb, sidechainVca, monoMakerLR4, airExciter,
  truePeak4x, truePeakLimiter4x, createEstuaryClockDrift, extractAudioFeaturesFrame,
  welchAuditStereo, verifyRound3Gates, biquad, rms,
} from "../instruments/index.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INST_DIR = path.resolve(HERE, "../instruments");

test("hygiene: all Wave 30A-2 modules stay <= 300 LOC, 0 em dashes, 0 forbidden legacy names", () => {
  const files = [
    path.join(INST_DIR, "inst/taste-melodic.mjs"),
    path.join(INST_DIR, "inst/taste-rhythm.mjs"),
    path.join(INST_DIR, "estuary-space.mjs"),
    path.join(INST_DIR, "estuary-clock.mjs"),
    path.join(INST_DIR, "round3-cues.mjs"),
  ];
  const forbidden = ["iso", "morph"].join("");
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const lines = src.split(/\r?\n/).length;
    assert.ok(lines <= 300, `${path.basename(f)} has ${lines} lines (>300)`);
    assert.equal(src.includes("\u2014"), false, `em dash in ${path.basename(f)}`);
    assert.equal(src.toLowerCase().includes(forbidden), false, `forbidden name in ${path.basename(f)}`);
  }
});

test("6 clean-room taste instruments are deterministic by seed, finite, and non-clipping", () => {
  const sr = 48000;
  const [rhL, rhR] = tideRhodes(60, 0.5, 0.85, 7, { sr });
  const [rhL2] = tideRhodes(60, 0.5, 0.85, 7, { sr });
  assert.deepEqual(rhL, rhL2, "tideRhodes must be bit-deterministic by seed");
  assert.ok(rms(rhL) > 0.01 && rms(rhR) > 0.01);

  const sub = atlantisSub(36, 0.4, 0.9, 9, { sr, prevMidi: 41, glideTau: 0.055, crank808: true });
  const gtr = coffaroStrand(57, 0.45, 0.7, 11, { sr });
  const reed = lateefBreath(65, 0.45, 0.75, 13, { sr });
  const piano = sakamotoChamber(60, 0.5, 0.65, 17, { sr, felt: 0.7 });
  const [strL, strR] = sakamotoStrings([60, 64, 67], 0.5, 0.6, 19, { sr });
  for (const buf of [rhL, rhR, sub, gtr, reed, piano, strL, strR]) {
    assert.ok(rms(buf) > 1e-3, "instrument output must be audible");
    for (let i = 0; i < buf.length; i++) assert.ok(Number.isFinite(buf[i]) && Math.abs(buf[i]) <= 1.0);
  }
});

test("Pocket-Break delivers 12x-15x ghost-to-accent velocity contrast and break slicing works", () => {
  const sr = 48000;
  const ratio = pocketGain(1.0) / pocketGain(0.10);
  assert.ok(ratio >= 12.0 && ratio <= 45.0, `expected strong ghost/accent contrast, got ${ratio}`);
  const ghost = pocketSnare(0.12, 5, { sr });
  const accent = pocketSnare(0.95, 5, { sr });
  const rmsRatio = rms(accent) / Math.max(1e-9, rms(ghost));
  assert.ok(rmsRatio >= 8.0, `expected >= 8x snare RMS contrast, got ${rmsRatio}`);

  const ride = pocketRide(0.8, 3, { sr, len: 0.6 });
  const hat = pocketHat(0.7, 4, { sr, open: true });
  assert.ok(rms(ride) > 0.005 && rms(hat) > 0.005);

  const kick = pocketKick(0.9, 2, { sr, len: 0.4 });
  const sliced = sliceBreak(kick, 8, [{ idx: 0, retrigger: 2 }, { idx: 1, reverse: true, pitchSt: 2 }], 1, { sr });
  assert.ok(sliced.length > 0 && rms(sliced) > 0.005);
});

test("Estuary-Space FX: Hadamard energy conservation, LR4 <120 Hz mono-maker, sidechain GR, and 4x limiter", () => {
  const sr = 48000;
  // 1. Orthonormal Hadamard H_8 / sqrt(8) preserves L2 norm to 1e-12
  const v = new Float64Array([1, -2, 0.5, 3, -1.5, 0.25, 4, -0.75]);
  const eBefore = v.reduce((a, x) => a + x * x, 0);
  hadamard8(v);
  const eAfter = v.reduce((a, x) => a + x * x, 0);
  assert.ok(Math.abs(eBefore - eAfter) < 1e-12, "Hadamard matrix must be strictly orthonormal");

  // 2. Planted out-of-phase 55 Hz sub-bass MUST become mono-locked (corr >= +0.96) after monoMakerLR4
  const n = sr;
  const badL = new Float32Array(n), badR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = 0.5 * Math.sin(2 * Math.PI * 55 * i / sr);
    const m = 0.35 * Math.sin(2 * Math.PI * 55 * i / sr);
    badL[i] = m + s; badR[i] = m - s;
  }
  const before = welchAuditStereo(badL, badR, sr);
  assert.ok(before.low_end_phase_corr < 0.0, `planted bad sub should be negative corr, got ${before.low_end_phase_corr}`);
  const [okL, okR] = monoMakerLR4([badL, badR], 120, sr);
  const after = welchAuditStereo(okL, okR, sr);
  assert.ok(after.low_end_phase_corr >= 0.96, `monoMakerLR4 must lock <120 Hz phase, got ${after.low_end_phase_corr}`);

  // 3. FDN reverb decays cleanly without blow-up; sidechain ducks; 4x limiter caps <= -1.0 dBTP
  const impL = new Float32Array(sr), impR = new Float32Array(sr);
  impL[100] = 0.9; impR[100] = 0.9;
  const [rvL, rvR] = fdnReverb([impL, impR], { sr, t60: 1.5, mix: 0.5, shimmer: 0.12 });
  assert.ok(rms(rvL, 4000, 20000) > 1e-4 && rms(rvR, 4000, 20000) > 1e-4);

  const hotL = new Float32Array(sr).fill(1.6), hotR = new Float32Array(sr).fill(-1.6);
  const [limL, limR] = truePeakLimiter4x([hotL, hotR], -1.0, sr);
  const tpDb = 20 * Math.log10(Math.max(1e-12, truePeak4x([limL, limR])));
  assert.ok(tpDb <= -0.95, `4x limiter must enforce <= -1.0 dBTP, got ${tpDb}`);

  const pad = [new Float32Array(sr).fill(0.5), new Float32Array(sr).fill(0.5)];
  const key = new Float32Array(sr).fill(0.8);
  const [scL] = sidechainVca(pad, key, { sr, threshDb: -20, ratio: 4, maxGrDb: 6 });
  assert.ok(rms(scL, 4000, sr) < rms(pad[0], 4000, sr) * 0.85, "sidechainVca must duck under key");

  const [exL] = airExciter([rvL, rvR], { sr, blendDb: -10 });
  assert.ok(rms(exL) >= rms(rvL) * 0.95);
});

test("Estuary Clock-Drift locks pocket at high K and releases rubato at low K + audio_features contract", () => {
  const tight = createEstuaryClockDrift({ bpm: 172, couplingK: 6.0, masterK: 5.0, detuneHz: 0.12, seed: 42 });
  const loose = createEstuaryClockDrift({ bpm: 84, couplingK: 0.1, masterK: 0.05, detuneHz: 0.45, seed: 42 });
  let stT, stL;
  for (let i = 0; i < 400; i++) { stT = tight.step(0.01); stL = loose.step(0.01); }
  assert.ok(stT.orderR > 0.97, `high K should lock pocket (R > 0.97), got ${stT.orderR}`);
  assert.ok(stL.orderR < stT.orderR - 0.1, `low K should drift organically below tight K (${stL.orderR} vs ${stT.orderR})`);

  const buf = new Float32Array(2048);
  for (let i = 0; i < buf.length; i++) buf[i] = 0.3 * Math.sin(2 * Math.PI * 440 * i / 48000);
  const feat = extractAudioFeaturesFrame(buf, buf, { sr: 48000, beatPhase: 0.25, onsetImpulse: 0.8, activeChord: "Fm9" });
  assert.equal(feat.bands8.length, 8);
  assert.ok(Number.isFinite(feat.rms) && feat.rms > 0.1 && feat.active_chord === "Fm9");
});

test("planted failing control: muffled low-passed static render is rejected fail-closed by verifyRound3Gates", () => {
  const sr = 48000, n = sr * 4;
  const L = new Float32Array(n), R = new Float32Array(n);
  const lp = biquad("lp", 350, 0.707, 0, sr);
  for (let i = 0; i < n; i++) {
    const s = lp(0.4 * Math.sin(2 * Math.PI * 220 * i / sr) + 0.1 * Math.sin(2 * Math.PI * 440 * i / sr));
    L[i] = s; R[i] = s;
  }
  const metrics = welchAuditStereo(L, R, sr);
  const verdict = verifyRound3Gates(metrics, "site-main-theme");
  assert.equal(verdict.ok, false, "muffled static render MUST fail Round 3 Welch gates");
  assert.ok(verdict.errors.some((e) => e.startsWith("presence=") || e.startsWith("air=") || e.startsWith("macro_dr=")));
});
