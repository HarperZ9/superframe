// Full-arc Round 3 clean-room studio compositions (Wave 30A-2, O-19 compliant).
// Uses the 6 clean-room taste instruments, Estuary-Space FX rack, and Estuary Clock-Drift.
import { rng, addAt, addStereo, clamp } from "./dsp.mjs";
import { tideRhodes, atlantisSub, coffaroStrand, lateefBreath, sakamotoChamber, sakamotoStrings } from "./inst/taste-melodic.mjs";
import { POCKET_OFFSETS, pocketKick, pocketSnare, pocketRide, pocketHat, sliceBreak } from "./inst/taste-rhythm.mjs";
import { fdnReverb, sidechainVca, estuaryMasterChain } from "./estuary-space.mjs";
import { createEstuaryClockDrift } from "./estuary-clock.mjs";

export function encodeStereoWav16(L, R, sr = 48000) {
  const n = L.length, dataBytes = n * 4, buf = new ArrayBuffer(44 + dataBytes), dv = new DataView(buf);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); dv.setUint32(4, 36 + dataBytes, true); ws(8, "WAVE"); ws(12, "fmt ");
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true);
  ws(36, "data"); dv.setUint32(40, dataBytes, true);
  let off = 44;
  for (let i = 0; i < n; i++) {
    dv.setInt16(off, Math.round(clamp(L[i], -1, 1) * 32767), true);
    dv.setInt16(off + 2, Math.round(clamp(R[i], -1, 1) * 32767), true);
    off += 4;
  }
  return new Uint8Array(buf);
}

const mkPair = (n) => [new Float32Array(n), new Float32Array(n)];
const sumInto = (dst, src, g = 1) => { for (let i = 0; i < dst[0].length; i++) { dst[0][i] += src[0][i] * g; dst[1][i] += src[1][i] * g; } };

function addChord(bus, notes, at, dur, vel, seed, fn, o = {}) {
  for (let i = 0; i < notes.length; i++) {
    const src = fn(notes[i], dur, vel * (0.9 + 0.08 * (i === 0 ? 1 : 0)), seed + i * 37, o);
    addStereo(bus[0], bus[1], src, at + Math.round(i * 0.011 * (o.sr ?? 48000)), 1 / Math.sqrt(notes.length), ((i / Math.max(1, notes.length - 1)) * 2 - 1) * 0.72);
  }
}

// 1. site-main-theme: "Estuary Current" (126 BPM, C Dorian / Harmonic Minor, 32 bars)
export function renderEstuaryCurrent(seed = 3001, sr = 48000) {
  const bpm = 126, beat = 60 / bpm, barS = beat * 4, bars = 32, total = Math.round((bars * barS + 3.5) * sr);
  const r = rng(seed), p = POCKET_OFFSETS.bluswingFusion;
  const clk = createEstuaryClockDrift({ bpm, couplingK: 5.2, masterK: 4.4, seed });
  const drums = mkPair(total), bassPad = mkPair(total), keys = mkPair(total), lead = mkPair(total);
  const kickKey = new Float32Array(total);
  const prog = [
    ...Array(4).fill({ root: 36, ch: [48, 55, 58, 62, 65], name: "Cm11" }),
    ...[0, 1].flatMap(() => [
      { root: 36, ch: [48, 55, 58, 62, 63], name: "Cm9" }, { root: 36, ch: [48, 55, 58, 62, 63], name: "Cm9" },
      { root: 41, ch: [53, 56, 60, 63, 67], name: "Fm9" }, { root: 41, ch: [53, 56, 60, 63, 67], name: "Fm9" },
      { root: 44, ch: [56, 60, 63, 67, 70], name: "Abmaj7#11" }, { root: 44, ch: [56, 60, 63, 67, 70], name: "Abmaj7#11" },
      { root: 43, ch: [55, 59, 63, 65, 68], name: "G7alt" }, { root: 43, ch: [55, 59, 63, 65, 68], name: "G7alt" },
    ]).slice(0, 8),
    ...[
      { root: 39, ch: [51, 55, 58, 62, 65], name: "Ebmaj9" }, { root: 39, ch: [51, 55, 58, 62, 65], name: "Ebmaj9" },
      { root: 44, ch: [56, 60, 63, 67, 70], name: "Abmaj9" }, { root: 44, ch: [56, 60, 63, 67, 70], name: "Abmaj9" },
      { root: 38, ch: [50, 56, 60, 65], name: "Dm7b5" }, { root: 43, ch: [55, 59, 63, 65, 68], name: "G7b13" },
      { root: 36, ch: [48, 55, 58, 62, 63], name: "Cm9" }, { root: 41, ch: [53, 57, 60, 63, 69], name: "F13" },
    ],
    { root: 41, ch: [53, 56, 60, 63, 65], name: "Fm11" }, { root: 46, ch: [53, 56, 60, 65, 67], name: "Bb13sus4" },
    { root: 39, ch: [51, 55, 58, 62, 65], name: "Ebmaj9" }, { root: 43, ch: [55, 59, 63, 66, 68], name: "G7#9b13" },
    { root: 36, ch: [48, 55, 58, 62, 63], name: "Cm9" }, { root: 41, ch: [53, 56, 60, 63, 67], name: "Fm9" },
    { root: 44, ch: [56, 60, 63, 67, 70], name: "Abmaj7#11" }, { root: 43, ch: [55, 59, 63, 65, 68], name: "G7alt" },
    { root: 36, ch: [48, 55, 58, 62, 63], name: "Cm9" }, { root: 43, ch: [53, 59, 63, 65, 68], name: "Fm9/G7alt" },
    { root: 36, ch: [48, 55, 57, 62, 63], name: "Cm6/9" }, { root: 36, ch: [48, 55, 57, 62, 63], name: "Cm6/9" },
  ];
  let prevBass = 36;
  const saxScale = [60, 62, 63, 65, 67, 68, 70, 72, 74, 75, 79];
  for (let b = 0; b < bars; b++) {
    const t0 = b * barS, st = clk.step(barS * 0.25), c = prog[b];
    const isIntro = b < 4, isBridge = b >= 20 && b < 24, isClimax = b >= 24 && b < 30, isOutro = b >= 30;
    const secGain = isIntro ? 0.34 : isOutro ? 0.30 : isBridge ? 0.72 : isClimax ? 1.18 : (b >= 12 ? 1.02 : 0.86);
    const rhVel = isIntro ? 0.40 : isBridge ? 0.86 : isClimax ? 0.88 : 0.66;
    addChord(keys, c.ch, Math.round(t0 * sr), barS * (isOutro ? 1.8 : 0.92), rhVel, seed + b * 97, tideRhodes, { sr, gain: 0.25 * secGain });
    if (!isIntro && !isOutro) {
      addChord(keys, c.ch, Math.round((t0 + beat * 2.5) * sr), beat * 1.2, rhVel * 0.82, seed + b * 101, tideRhodes, { sr, gain: 0.18 * secGain });
    }
    if (isIntro || isClimax || isOutro) {
      const padS = sakamotoStrings(c.ch.slice(0, 4), barS * 1.1, isClimax ? 0.75 : 0.35, seed + b * 131, { sr, gain: (isClimax ? 0.24 : 0.12) * secGain, baseCut: isClimax ? 1800 : 900 });
      addStereo(bassPad[0], bassPad[1], padS, Math.round(t0 * sr), 1, 0);
    }
    if (!isIntro && !isOutro) {
      const steps = [0, 1.5, 2.5, 3.5];
      for (let si = 0; si < steps.length; si++) {
        const note = si === 3 ? c.root + (r() < 0.5 ? 2 : 7) : (si === 2 ? c.root + 12 : c.root);
        const glide = (si === 1 || si === 3) && r() < 0.55;
        const sb = atlantisSub(note - 12 * (note > 42 ? 1 : 0), beat * 0.85, 0.78 * secGain, seed + b * 53 + si, {
          sr, prevMidi: glide ? prevBass : null, glideTau: 0.055, gain: 0.14 * secGain, upperMix: 0.65,
        });
        const at = Math.round((t0 + steps[si] * beat) * sr);
        addStereo(bassPad[0], bassPad[1], sb, at, 1, 0);
        prevBass = note;
      }
    }
    // Pocket-Break 16th-note groove with 12x ghost-to-accent velocity contrast
    for (let s16 = 0; s16 < 16; s16++) {
      const swingOff = (s16 & 1) ? (p.swing - 0.5) * (beat * 0.5) : 0;
      const stTime = t0 + s16 * (beat * 0.25) + swingOff + (st.offsetsMs.breaks * 0.001);
      if (isIntro && (s16 % 4 === 0 || s16 % 4 === 2)) {
        addStereo(drums[0], drums[1], pocketHat(0.18 + 0.14 * (s16 % 4 === 0 ? 1 : 0), seed + b * 29 + s16, { sr, gain: 0.22 }), Math.round((stTime + p.hatMs * 0.001) * sr), 1, 0.24);
      } else if (!isIntro && !isOutro) {
        if (!isBridge && (s16 === 0 || s16 === 6 || s16 === 10 || (isClimax && s16 === 14))) {
          const kv = s16 === 0 ? 0.96 : (s16 === 10 ? 0.88 : 0.62);
          const kBuf = pocketKick(kv * Math.min(1, secGain), seed + b * 41 + s16, { sr, tune: 50, gain: 0.44 * secGain });
          const kat = Math.round((stTime + p.kickMs * 0.001) * sr);
          addStereo(drums[0], drums[1], kBuf, kat, 1, 0);
          addAt(kickKey, kBuf, kat, 1.8);
        }
        if (s16 === 4 || s16 === 12) {
          const sv = isBridge ? 0.48 : (isClimax ? 0.96 : 0.86);
          addStereo(drums[0], drums[1], pocketSnare(sv, seed + b * 61 + s16, { sr, brush: isBridge, gain: 0.66 * secGain }), Math.round((stTime + p.snareMs * 0.001) * sr), 1, -0.14);
        } else if (!isBridge && (s16 === 7 || s16 === 9 || s16 === 15)) {
          addStereo(drums[0], drums[1], pocketSnare(0.14 + 0.06 * r(), seed + b * 71 + s16, { sr, gain: 0.58 * secGain }), Math.round((stTime + p.snareMs * 0.001) * sr), 1, -0.10);
        }
        if (s16 % 2 === 0 || isClimax) {
          const hv = (s16 % 4 === 0) ? 0.56 : (s16 % 2 === 0 ? 0.34 : 0.18);
          addStereo(drums[0], drums[1], pocketHat(hv, seed + b * 83 + s16, { sr, open: s16 === 14 && isClimax, gain: 0.32 * secGain }), Math.round((stTime + p.hatMs * 0.001) * sr), 1, 0.68);
        }
        if ((b >= 12 || isBridge) && (s16 === 0 || s16 === 4 || s16 === 7 || s16 === 10 || s16 === 12)) {
          const rv = (s16 === 0 || s16 === 12) ? 0.68 : 0.42;
          addStereo(drums[0], drums[1], pocketRide(rv, seed + b * 89 + s16, { sr, bell: isClimax && s16 === 0, len: 1.5, gain: 0.34 * secGain }), Math.round((stTime + p.rideMs * 0.001) * sr), 1, -0.68);
        }
      }
    }
    if ((b >= 12 && b < 20) || isClimax) {
      const n1 = saxScale[(b * 3) % saxScale.length] + (isClimax ? 5 : 0);
      const n2 = saxScale[(b * 3 + 2) % saxScale.length] + (isClimax ? 5 : 0);
      addStereo(lead[0], lead[1], lateefBreath(n1, beat * 1.4, isClimax ? 0.88 : 0.72, seed + b * 173, { sr, gain: 0.54 * secGain }), Math.round((t0 + 0.045) * sr), 1, 0.52);
      addStereo(lead[0], lead[1], lateefBreath(n2, beat * 1.2, isClimax ? 0.84 : 0.66, seed + b * 179, { sr, gain: 0.48 * secGain }), Math.round((t0 + beat * 2.1 + 0.045) * sr), 1, -0.48);
    }
    if (isBridge) {
      addStereo(lead[0], lead[1], coffaroStrand(c.ch[2] + 12, barS * 0.9, 0.78, seed + b * 191, { sr, swellAttack: 0.10, gain: 0.56 }), Math.round(t0 * sr), 1, -0.65);
    }
  }
  const ducked = sidechainVca(bassPad, kickKey, { sr, threshDb: -22, ratio: 3.2, attackMs: 6, releaseMs: 105, maxGrDb: 4.0 });
  const wetKeys = fdnReverb(keys, { sr, t60: 2.6, mix: 0.44, preDelayMs: 24, shimmer: 0.07 });
  const wetLead = fdnReverb(lead, { sr, t60: 3.1, mix: 0.46, preDelayMs: 28, shimmer: 0.09 });
  const mix = mkPair(total);
  sumInto(mix, drums, 0.84); sumInto(mix, ducked, 0.78); sumInto(mix, wetKeys, 1.55); sumInto(mix, wetLead, 1.35);
  return estuaryMasterChain(mix, {
    sr, targetLufs: -12.8, ceilingDb: -1.0, monoHz: 185, highWidth: 1.50,
    subShelfDb: -5.5, subShelfHz: 80, warmBodyDb: 4.5, warmBodyHz: 750, warmBodyQ: 0.65,
    presenceDb: 6.5, presenceHz: 2450, airShelfDb: -6.8, airShelfHz: 4600, topLpHz: 8600, airBlendDb: -20,
  });
}

// 2. playground-acoustic-demo: "Atlantis Glass" (172 BPM, F Phrygian Liquid DnB, 40 bars)
export function renderAtlantisGlass(seed = 3002, sr = 48000) {
  const bpm = 172, beat = 60 / bpm, barS = beat * 4, bars = 40, total = Math.round((bars * barS + 3.5) * sr);
  const r = rng(seed), p = POCKET_OFFSETS.bukemLiquid;
  const drums = mkPair(total), bassPad = mkPair(total), keys = mkPair(total), lead = mkPair(total);
  const kickKey = new Float32Array(total);
  const seq = [
    ...Array(2).fill({ root: 29, ch: [53, 56, 60, 63, 67] }), ...Array(2).fill({ root: 30, ch: [54, 58, 61, 65, 68] }),
    ...Array(2).fill({ root: 27, ch: [51, 56, 58, 63, 67] }), ...Array(2).fill({ root: 36, ch: [48, 55, 58, 62, 65] }),
    ...Array(2).fill({ root: 37, ch: [49, 53, 56, 60, 63] }), ...Array(2).fill({ root: 36, ch: [48, 53, 55, 56, 62] }),
    ...Array(2).fill({ root: 29, ch: [53, 56, 60, 63, 67] }), ...Array(2).fill({ root: 37, ch: [49, 53, 56, 60, 63] }),
    ...Array(2).fill({ root: 27, ch: [51, 56, 58, 63, 67] }), ...Array(2).fill({ root: 36, ch: [48, 55, 58, 62, 63] }),
    ...Array(2).fill({ root: 32, ch: [56, 60, 63, 67, 70] }), ...Array(2).fill({ root: 30, ch: [54, 58, 61, 65, 68] }),
    ...Array(2).fill({ root: 29, ch: [53, 56, 60, 63, 65] }), ...Array(2).fill({ root: 36, ch: [48, 52, 56, 58, 63] }),
    ...Array(2).fill({ root: 37, ch: [49, 53, 56, 60, 63] }), ...Array(2).fill({ root: 27, ch: [51, 56, 58, 63, 67] }),
    ...Array(2).fill({ root: 29, ch: [53, 56, 60, 63, 67] }), { root: 34, ch: [58, 61, 65, 68] }, { root: 36, ch: [48, 52, 56, 58, 63] },
    ...Array(4).fill({ root: 29, ch: [53, 56, 60, 63, 67] }),
  ];
  // Build a 1-bar clean-room liquid break buffer for the 16-slice jungle chopper
  const barN = Math.round(barS * sr), breakLoop = new Float32Array(barN);
  for (let s16 = 0; s16 < 16; s16++) {
    const at = Math.round(s16 * barN / 16);
    if (s16 === 0 || s16 === 10) addAt(breakLoop, pocketKick(0.92, seed + 11 + s16, { sr, tune: 52, decay: 0.12, gain: 0.52 }), at, 0.85);
    if (s16 === 4 || s16 === 12) addAt(breakLoop, pocketSnare(0.92, seed + 23 + s16, { sr, shell1: 205, shell2: 340, gain: 0.78 }), at, 0.88);
    if (s16 === 7 || s16 === 9 || s16 === 15) addAt(breakLoop, pocketSnare(0.16, seed + 37 + s16, { sr, shell1: 205, gain: 0.65 }), at, 0.65);
    addAt(breakLoop, pocketHat((s16 & 1) ? 0.32 : 0.62, seed + 47 + s16, { sr, open: s16 === 6, gain: 0.42 }), at, 0.58);
  }
  let prevBass = 29;
  const motif = [65, 68, 70, 72, 73, 77];
  for (let b = 0; b < bars; b++) {
    const t0 = b * barS, c = seq[b];
    const isIntro = b < 8, isBuild = b >= 8 && b < 12, isDropA = b >= 12 && b < 20;
    const isBreak = b >= 20 && b < 28, isDropB = b >= 28 && b < 36, isOutro = b >= 36;
    const secG = isIntro ? 0.34 : isOutro ? 0.26 : isBreak ? 0.42 : isBuild ? 0.72 : isDropB ? 1.24 : 1.04;
    if (b % 2 === 0) {
      const padS = sakamotoStrings(c.ch.slice(0, 4), barS * 2.1, isDropB ? 0.78 : 0.46, seed + b * 67, {
        sr, gain: (isIntro || isBreak ? 0.30 : 0.38) * secG, baseCut: isDropB ? 2400 : (isBreak ? 750 : 1200), sweepCut: isDropB ? 2400 : 700,
      });
      addStereo(bassPad[0], bassPad[1], padS, Math.round(t0 * sr), 1, 0);
    }
    if (isIntro || isBreak || isOutro) {
      addStereo(lead[0], lead[1], coffaroStrand(c.ch[b % c.ch.length] + 12, barS * 1.4, 0.54, seed + b * 73, { sr, swellAttack: 0.14, gain: 0.34 * secG }), Math.round(t0 * sr), 1, (b & 1) ? 0.62 : -0.62);
      if (isBreak) addChord(keys, c.ch, Math.round(t0 * sr), barS * 1.4, 0.56, seed + b * 79, sakamotoChamber, { sr, felt: 0.68, gain: 0.38 });
    }
    if (isBuild) {
      const chopPlan = Array.from({ length: 16 }, (_, idx) => ({ idx: idx % 8, retrigger: b >= 10 && idx >= 12 ? 2 : 1, hpHz: 520 + b * 180, gain: 0.72 + (b - 8) * 0.12 }));
      addStereo(drums[0], drums[1], sliceBreak(breakLoop, 16, chopPlan, seed + b, { sr }), Math.round(t0 * sr), 0.76, 0);
    }
    if (isDropA || isDropB) {
      const glide = r() < 0.24;
      const sb = atlantisSub(c.root, barS * 0.96, 0.88, seed + b * 89, { sr, prevMidi: glide ? prevBass : null, glideTau: 0.062, gain: 0.25 * secG, upperMix: 0.44 });
      addStereo(bassPad[0], bassPad[1], sb, Math.round(t0 * sr), 1, 0);
      prevBass = c.root;
      if (isDropB && (b % 2 === 1)) {
        const plan = [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 12, 12, 14, 15].map((idx, i) => ({
          idx, retrigger: i === 13 ? 2 : 1, pitchSt: i === 14 ? 2 : 0, reverse: i === 15, gain: 0.92,
        }));
        addStereo(drums[0], drums[1], sliceBreak(breakLoop, 16, plan, seed + b * 19, { sr }), Math.round(t0 * sr), 0.80 * secG, 0);
      } else {
        addStereo(drums[0], drums[1], breakLoop, Math.round(t0 * sr), 0.78 * secG, 0);
      }
      addAt(kickKey, pocketKick(0.95, seed + b * 31, { sr, tune: 50 }), Math.round(t0 * sr), 1.4);
      addAt(kickKey, pocketKick(0.90, seed + b * 37, { sr, tune: 50 }), Math.round((t0 + beat * 2.5) * sr), 1.4);
      for (let q = 0; q < 4; q++) {
        addStereo(drums[0], drums[1], pocketRide(q === 0 ? 0.72 : 0.48, seed + b * 97 + q, { sr, bell: isDropB && q === 0, len: 1.3, gain: 0.38 * secG }), Math.round((t0 + q * beat + p.rideMs * 0.001) * sr), 1, (q & 1) ? 0.68 : -0.68);
      }
      if (b % 2 === 0) addChord(keys, c.ch, Math.round((t0 + beat * 0.5) * sr), beat * 2.2, 0.84, seed + b * 107, tideRhodes, { sr, gain: 0.44 * secG });
      if (isDropB && b % 2 === 0) {
        addStereo(lead[0], lead[1], lateefBreath(motif[(b >> 1) % motif.length], barS * 1.3, 0.84, seed + b * 127, { sr, gain: 0.54 * secG }), Math.round(t0 * sr), 1, 0.48);
      }
    }
  }
  const ducked = sidechainVca(bassPad, kickKey, { sr, threshDb: -22, ratio: 3.4, attackMs: 5, releaseMs: 85, maxGrDb: 4.5 });
  const wetKeys = fdnReverb(keys, { sr, t60: 3.8, mix: 0.44, preDelayMs: 30, shimmer: 0.10 });
  const wetLead = fdnReverb(lead, { sr, t60: 4.2, mix: 0.46, preDelayMs: 34, shimmer: 0.12 });
  const mix = mkPair(total);
  sumInto(mix, drums, 0.88); sumInto(mix, ducked, 0.94); sumInto(mix, wetKeys, 1.45); sumInto(mix, wetLead, 1.30);
  return estuaryMasterChain(mix, {
    sr, targetLufs: -12.8, ceilingDb: -1.0, monoHz: 240, highWidth: 1.48,
    subShelfDb: 1.4, subShelfHz: 58, warmBodyDb: 4.0, warmBodyHz: 920, warmBodyQ: 0.65,
    presenceDb: 10.6, presenceHz: 2650, airShelfDb: -4.4, airShelfHz: 5200, topLpHz: 10200, airBlendDb: -15.5,
  });
}

// 3. explainer-bed-calm: "Coffaro Horizon" (84 BPM, D Lydian / B Dorian, 16 bars, -5 dB @ 1.8 kHz carve)
export function renderCoffaroHorizon(seed = 3003, sr = 48000) {
  const bpm = 84, beat = 60 / bpm, barS = beat * 4, bars = 16, total = Math.round((bars * barS + 3.5) * sr);
  const clk = createEstuaryClockDrift({ bpm, couplingK: 0.45, masterK: 0.95, seed });
  const prog = [
    { root: 38, ch: [50, 57, 61, 64, 68] }, { root: 38, ch: [50, 57, 61, 64, 68] },
    { root: 38, ch: [50, 57, 59, 64, 66] }, { root: 37, ch: [49, 57, 59, 64, 66] },
    { root: 35, ch: [47, 54, 57, 62, 64] }, { root: 43, ch: [55, 59, 62, 66, 68] },
    { root: 40, ch: [52, 55, 59, 62, 66] }, { root: 33, ch: [45, 52, 55, 62, 66] },
    { root: 43, ch: [55, 59, 62, 66, 68] }, { root: 42, ch: [54, 57, 61, 64, 66] },
    { root: 40, ch: [52, 55, 59, 62, 66] }, { root: 33, ch: [45, 52, 55, 62, 66] },
    { root: 35, ch: [47, 54, 57, 61, 64] }, { root: 43, ch: [55, 59, 62, 64, 66] },
    { root: 38, ch: [50, 57, 61, 64, 68] }, { root: 38, ch: [50, 57, 59, 64, 66] },
  ];
  const bass = mkPair(total), bed = mkPair(total), air = mkPair(total);
  for (let b = 0; b < bars; b++) {
    const t0 = b * barS, st = clk.step(barS * 0.25), c = prog[b];
    const isIntro = b < 2, isBloom = b >= 8 && b < 14, isOutro = b >= 14;
    const secG = isIntro ? 0.34 : isOutro ? 0.30 : isBloom ? 1.28 : 0.78;
    const offK = clamp(st.offsetsMs.keys, -28, 28) * 0.001;
    const offG = clamp(st.offsetsMs.lead, -32, 32) * 0.001;
    addStereo(bass[0], bass[1], atlantisSub(c.root - 12 * (c.root > 39 ? 1 : 0), barS * 0.96, 0.52 * secG, seed + b * 41, { sr, gain: 0.11 * secG, upperMix: 0.28 }), Math.round(t0 * sr), 1, 0);
    addChord(bed, c.ch.slice(0, 4), Math.round(Math.max(0, t0 + offK) * sr), barS * 0.96, 0.62 * Math.min(1.1, secG), seed + b * 53, sakamotoChamber, { sr, felt: isBloom ? 0.25 : 0.70, gain: 0.36 * secG });
    const padS = sakamotoStrings(c.ch.slice(0, 3), barS * 1.15, 0.54 * secG, seed + b * 67, { sr, gain: 0.22 * secG, baseCut: isBloom ? 2400 : 720, sweepCut: isBloom ? 2600 : 500 });
    addStereo(bed[0], bed[1], padS, Math.round(t0 * sr), 1, 0);
    for (let a = 0; a < 4; a++) {
      const note = c.ch[a % c.ch.length] + (isBloom && a >= 1 ? 12 : 0);
      addStereo(bed[0], bed[1], coffaroStrand(note, beat * 1.5, (isBloom ? 0.84 : 0.52) * secG, seed + b * 83 + a, { sr, swellAttack: isIntro ? 0.14 : 0.018, gain: 0.44 * secG }), Math.round(Math.max(0, t0 + a * beat + offG) * sr), 1, (a & 1) ? 0.42 : -0.42);
    }
    if (!isIntro && !isOutro) {
      for (let h = 0; h < 4; h++) {
        addStereo(air[0], air[1], pocketRide(isBloom ? 0.72 : 0.34, seed + b * 97 + h, { sr, brush: !isBloom, len: 1.5, gain: (isBloom ? 0.42 : 0.16) * secG }), Math.round((t0 + h * beat) * sr), 1, (h & 1) ? -0.45 : 0.45);
      }
      if (isBloom) {
        addStereo(bed[0], bed[1], lateefBreath(c.ch[3] + (b % 2 === 0 ? 12 : 0), beat * 2.2, 0.72, seed + b * 113, { sr, gain: 0.42 * secG }), Math.round((t0 + beat) * sr), 1, -0.35);
      }
    }
  }
  const wetBed = fdnReverb(bed, { sr, t60: 3.4, mix: 0.34, preDelayMs: 30, shimmer: 0.12 });
  const wetAir = fdnReverb(air, { sr, t60: 2.6, mix: 0.24, preDelayMs: 22, shimmer: 0.0 });
  const mix = mkPair(total);
  sumInto(mix, bass, 0.82); sumInto(mix, wetBed, 1.0); sumInto(mix, wetAir, 1.08);
  return estuaryMasterChain(mix, {
    sr, targetLufs: -17.5, ceilingDb: -1.5, monoHz: 215, highWidth: 1.08,
    subShelfDb: 1.8, subShelfHz: 60, warmBodyDb: 4.2, warmBodyHz: 960, warmBodyQ: 0.65,
    vocalCarveDb: -5.0, vocalCarveHz: 1800, vocalCarveQ: 0.9,
    presenceDb: 12.2, presenceHz: 2850, airShelfDb: -1.2, airShelfHz: 5200, topLpHz: 10400, airBlendDb: -12.5,
  });
}
