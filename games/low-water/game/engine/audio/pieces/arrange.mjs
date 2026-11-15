// Arranging a theme (themes.mjs) for the pieces: the melody with a phrase shape, chords voiced by the
// smallest movement from the last chord (so inner voices move by step), a walking bass, a broken-chord
// ostinato, and swing. All return events for the renderer.
import { ev, tones, bassNote } from "./kit.mjs";
import { chord } from "../theory.mjs";

// the melody: louder toward each phrase's highest note, softer at its end; legato by `legato`
export function melody(L, stem, inst, v, o = {}) {
  const out = [], phrase = (o.phraseBars ?? 4) * L.meter;
  for (const x of L.notes) {
    const start = Math.floor(x.at / phrase) * phrase, inP = L.notes.filter((y) => y.at >= start && y.at < start + phrase);
    const hi = Math.max(...inP.map((y) => y.p)), lo = Math.min(...inP.map((y) => y.p));
    const shape = hi > lo ? (x.p - lo) / (hi - lo) : 0.5, end = x.at + x.dur >= start + phrase - 0.01 ? 0.85 : 1;
    out.push(ev(stem, x.at + (o.offset ?? 0), x.dur * (o.legato ?? 0.97), inst, x.p + (o.transpose ?? 0), v * (0.82 + 0.25 * shape) * end, { opt: o.opt, gain: o.gain }));
  }
  return out;
}

// voicings near `centre`, each one moving as little as it can from the one before
function nearest(prev, cands) {
  if (!prev) return cands[Math.floor(cands.length / 2)];
  const cost = (v) => v.reduce((s, p, i) => s + Math.abs(p - (prev[i] ?? prev[prev.length - 1])), 0);
  return cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
}
function candidates(sym, centre, n, harm) {
  const pcs = [...new Set(tones(sym, 60, harm).map((p) => ((p % 12) + 12) % 12))], out = [];
  for (let low = centre - 8; low <= centre + 4; low++) {
    if (!pcs.includes(((low % 12) + 12) % 12)) continue;
    const v = [low];
    for (let p = low + 1; v.length < n && p < low + 19; p++) if (pcs.includes(p % 12) && !v.some((q) => q % 12 === p % 12)) v.push(p);
    if (v.length === Math.min(n, pcs.length)) out.push(v);
  }
  return out;
}
export function voicings(L, centre = 60, n = 4, harm = "true") {
  let prev = null;
  return L.chords.map((c) => { prev = nearest(prev, candidates(c.sym, centre, n, harm)); return { ...c, notes: prev }; });
}

// chords as held pads (or any sustained instrument)
export function held(V, stem, inst, v, o = {}) {
  return V.flatMap((c) => c.notes.map((p, i) => ev(stem, c.at + (o.roll ?? 0) * i, c.dur * (o.legato ?? 1.02), inst, p + (o.transpose ?? 0), v, { opt: o.opt, gain: o.gain })));
}
// comping: the chord struck at the given beats of each chord's span
export function comp(V, stem, inst, v, beats, o = {}) {
  const out = [];
  for (const c of V) for (const b of beats) if (b < c.dur) for (const [i, p] of c.notes.entries()) out.push(ev(stem, c.at + b + (o.roll ?? 0.01) * i, o.len ?? 0.9, inst, p, v * (b ? 0.8 : 1), { opt: o.opt }));
  return out;
}
// an ostinato: the voicing broken in a fixed order, in eighths (or `step`), quiet and even
export function ostinato(V, stem, inst, v, order = [0, 2, 1, 3, 2, 1], o = {}) {
  const out = [], step = o.step ?? 0.5;
  for (const c of V) for (let t = 0, k = 0; t < c.dur - 1e-9; t += step, k++) {
    const p = c.notes[order[k % order.length] % c.notes.length];
    out.push(ev(stem, c.at + t, o.len ?? step * 1.8, inst, p + (o.transpose ?? 0), v * (k % order.length ? 0.85 : 1), { opt: o.opt }));
  }
  return out;
}

// a walking bass: the root on one, chord tones and steps, a half-step approach into the next root
export function walking(L, stem, v, low = 36, harm = "true", o = {}) {
  const out = [];
  L.chords.forEach((c, i) => {
    const next = L.chords[i + 1] || L.chords[0], r = bassNote(c.sym, low, harm), nr = bassNote(next.sym, low, harm);
    const ct = chord(c.sym, 60).notes.map((p) => low + ((p - low) % 12 + 12) % 12).sort((a, b) => a - b);
    const line = c.dur >= 4 ? [r, ct[1] ?? r + 7, ct[2] ?? r + 7, nr + (nr > r ? -1 : 1)] : c.dur >= 2 ? [r, nr + (nr > r ? -1 : 1)] : [r];
    line.forEach((p, k) => out.push(ev(stem, c.at + k * (c.dur / line.length), (c.dur / line.length) * 0.92, "bass", p, v * (k ? 0.85 : 1), { opt: o.opt })));
  });
  return out;
}
// roots, held (a pedal-like bass that still moves with the chords)
export function roots(L, stem, inst, v, low = 36, harm = "true", o = {}) {
  return L.chords.map((c) => ev(stem, c.at, c.dur * (o.legato ?? 0.95), inst, bassNote(c.sym, low, harm), v, { opt: o.opt }));
}
// swing: an eighth on the off-beat is played at two thirds of the beat
export const swing = (e) => (Math.abs((e.at % 1) - 0.5) < 1e-6 ? { ...e, at: e.at + 1 / 6 } : e);
