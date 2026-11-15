// Shared writing tools for the pieces: events, chords through the harmony rules, the Hesh colour,
// looped drones that crossfade into themselves, and a seeded hand (small timing and velocity drift).
import { chord } from "../theory.mjs";
import { rng, seedOf } from "../lib/dsp.mjs";

export const ev = (stem, at, dur, inst, p, v = 0.6, extra = {}) => ({ stem, at, dur, inst, p, v, ...extra });

// The record's harmony rules (SCORE.md section 6), the same in every cue. The figure the player reports
// sets the harmony for the rest of the day, and it never comes back:
//   true      the score as written
//   inflated  every chord's fifth (and the drone's) a semitone low: the open interval hollowed; and where
//             a cue cadences home, the home chord is replaced by the chord a major third below it
//   blamed    everything inflated does (the figure is the same lie), and the Hesh colour (the raised sixth
//             over D, B natural) flattened to B flat everywhere; the Hesh layer of a cue goes silent
export const HESH_COLOUR = 11, TONIC = 2;
export const lies = (harm) => harm === "inflated" || harm === "blamed";
export function colour(p, harm) {
  if (p == null || harm !== "blamed") return p;
  return ((p % 12) + 12) % 12 === HESH_COLOUR ? p - 1 : p;
}
export function tones(sym, centre, harm) {
  const c = chord(sym, centre), fifth = (c.root + 7) % 12;
  return c.notes.map((p) => colour(lies(harm) && ((p % 12) + 12) % 12 === fifth ? p - 1 : p, harm));
}
export function bassNote(sym, low, harm) {
  const c = chord(sym, 60), p = low + ((c.bass - low) % 12 + 12) % 12;
  return colour(lies(harm) && (p % 12) === (c.root + 7) % 12 ? p - 1 : p, harm);
}
// the cadence rule: a chord symbol for the home chord, under a lie, becomes the chord a major third below
export const home = (sym, harm, lieSym) => (lies(harm) ? lieSym : sym);
// a drone's partials: the open fifth, or under a lie the fifth a semitone low
export const dronePartials = (harm) => (lies(harm) ? [[1, 1], [Math.pow(2, 6 / 12), 0.5], [2, 0.3], [3, 0.1]] : [[1, 1], [1.5, 0.55], [2, 0.3], [3, 0.12]]);

// a bed that loops (a drone, the wind, the queue): it runs `x` seconds past the end with equal-power edges,
// so the renderer's fold puts its fade-out under its fade-in
export function loopDrone(stem, inst, p, piece, v, opt = {}, x = 3) {
  const beat = 60 / piece.bpm, beats = piece.bars * piece.meter;
  return ev(stem, 0, beats + x / beat, inst, p, v, { xfade: x, opt: { attack: 0.05, release: 0.05, ...opt } });
}

// a hand: per-note timing drift in seconds and a velocity wobble, both seeded
export function hand(name, seed = 1, timing = 0.012, vel = 0.08) {
  const r = rng(seedOf(name, seed));
  return (e) => ({ ...e, jitter: timing, v: Math.max(0.05, Math.min(1, e.v * (1 + r.bi() * vel))) });
}

// spread a list of pitches over beats (an arpeggio or a roll); returns events
export function roll(stem, at, pitches, step, dur, inst, v, extra = {}) {
  return pitches.filter((p) => p != null).map((p, i) => ev(stem, at + i * step, dur, inst, p, v * (1 - i * 0.04), extra));
}
