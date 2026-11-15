// Offline mixdown for the author's listening renders: the piece's stems through the runtime mixer (so a
// render plays the same crossfades the game would), then loudness normalisation to a target, a look-ahead
// peak limiter at -1 dBTP, TPDF dither, and a 16-bit WAV.
import { SR, dbToGain, rng } from "./lib/dsp.mjs";
import { createMixer } from "./mixer.mjs";
import { loudness, truePeak } from "./lib/analysis.mjs";

// script: [{ bar, set: { stem: dB|null }, harm, bars }]; passes: how many times a loop is played
export function mixdown(piece, rendered, script = [], passes = 1) {
  const { stems, n } = rendered, total = n * passes + (piece.loop ? 0 : (stems[Object.keys(stems)[0]] || [[]])[0].length - n);
  const M = createMixer({ bpm: piece.bpm, meter: piece.meter });
  const hs = piece.harmonies || ["true"];
  for (const id of Object.keys(stems)) if (!id.includes("~")) M.layer(id, { db: null, group: (piece.stems[id.split("@")[0]] || {}).group || "music" });
  for (const base of Object.keys(piece.stems)) if (piece.stems[base].harm) M.variants(base, Object.fromEntries(hs.map((h, i) => [h, i ? `${base}@${h}` : base])));
  const bar = M.barSec;
  for (const s of script) {
    const t = s.bar * bar - M.barSec * 0.5;                   // asked half a bar early: the change lands on the bar
    if (s.harm) M.harmony(s.harm, t, s.bars ?? 2);
    for (const [id, db] of Object.entries(s.set || {})) M.set(id, db, t, s.bars ?? 1);
    for (const d of s.duck || []) M.duck(d[0] * bar, d[1] * bar, { depth: d[2] ?? -9 });
  }
  const L = new Float32Array(total), R = new Float32Array(total), B = 128;
  for (const [id, [sl, sr]] of Object.entries(stems)) {
    const len = sl.length;
    for (let b = 0; b < total; b += B) {
      const gid = id.split("~")[0], g0 = M.gainAt(gid, b / SR), g1 = M.gainAt(gid, Math.min(total, b + B) / SR);
      if (g0 === 0 && g1 === 0) continue;
      for (let i = b; i < Math.min(total, b + B); i++) {
        const j = piece.loop ? i % n : i; if (j >= len) break;
        const g = g0 + (g1 - g0) * (i - b) / B; L[i] += sl[j] * g; R[i] += sr[j] * g;
      }
    }
  }
  return { pair: [L, R], mixer: M };
}

export function normalise(pair, targetLufs = -18, ceilingDb = -1) {
  const before = loudness(pair).integrated;
  const g = Number.isFinite(before) ? dbToGain(targetLufs - before) : 1;
  for (const c of pair) for (let i = 0; i < c.length; i++) c[i] *= g;
  limit(pair, dbToGain(ceilingDb - 0.3));
  // the limiter sees samples; a true peak between them can still pass the ceiling, so trim what is left
  const tp = truePeak(pair), trim = tp > ceilingDb ? dbToGain(ceilingDb - tp - 0.05) : 1;
  if (trim < 1) for (const c of pair) for (let i = 0; i < c.length; i++) c[i] *= trim;
  return { gainDb: 20 * Math.log10(g * trim), before };
}

// a look-ahead limiter: the gain follows the coming 5 ms peak down at once and recovers over 120 ms
export function limit(pair, ceiling) {
  const n = pair[0].length, ahead = Math.round(0.005 * SR), rel = Math.exp(-1 / (0.12 * SR));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = Math.max(Math.abs(pair[0][i]), Math.abs(pair[1][i])); need[i] = p > ceiling ? ceiling / p : 1; }
  // running minimum over the look-ahead window, then smoothed release
  const gmin = new Float32Array(n); const dq = [];
  for (let i = n - 1; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop();
    dq.push(i); while (dq[0] > i + ahead) dq.shift();
    gmin[i] = need[dq[0]];
  }
  let g = 1;
  for (let i = 0; i < n; i++) { g = gmin[i] < g ? gmin[i] : gmin[i] + (g - gmin[i]) * rel; pair[0][i] *= g; pair[1][i] *= g; }
  return pair;
}

export function wav16(pair, seed = 1) {
  const n = pair[0].length, buf = Buffer.alloc(44 + n * 4), r = rng(seed);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) {
    const d = (r() - r()) / 32768, s = Math.max(-1, Math.min(1, pair[c][i] + d));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 4 + c * 2);
  }
  return buf;
}
export const report = (pair) => ({ ...loudness(pair), truePeak: truePeak(pair) });
