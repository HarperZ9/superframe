// Pitch names, modes, chords and the score's own material: the ledger's digits, the Haldane bowls, the
// Hesh and Vell idioms (both invented; SCORE.md section 4). Pitches are MIDI numbers.
const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// "D4", "Bb3", "F#5" -> MIDI
export function n(name) {
  const m = String(name).match(/^([A-G])(b|#)?(-?\d)$/);
  if (!m) throw new Error(`not a note: ${name}`);
  return 12 * (+m[3] + 1) + NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}
export const ns = (s) => s.trim().split(/\s+/).map((x) => (x === "_" ? null : n(x)));

export const MODES = {
  dorian: [0, 2, 3, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10], ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10],
  hesh: [0, 2, 3, 5, 7, 9],                // dorian without its seventh: the Hesh avoid the leading colour
  vell: [0, 2, 4, 6, 7],                   // a narrow lydian: chant inside a fifth, the raised fourth its colour
};
// degree (1-based, may pass 7) in a mode on a tonic
export function deg(tonic, mode, d) {
  const sc = MODES[mode], i = d - 1, oct = Math.floor(i / sc.length);
  return tonic + sc[((i % sc.length) + sc.length) % sc.length] + 12 * oct;
}

// chord symbols to pitch sets, voiced near a centre: "Dm9", "Bbmaj7/D", "A7sus4b9", "Gm(add9)"
const QUAL = {
  "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], m9: [0, 3, 7, 10, 14],
  maj9: [0, 4, 7, 11, 14], "9": [0, 4, 7, 10, 14], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], sus4: [0, 5, 7], "7sus4": [0, 5, 7, 10],
  "7sus4b9": [0, 5, 7, 10, 13], m6: [0, 3, 7, 9], "6": [0, 4, 7, 9], dim: [0, 3, 6], m7b5: [0, 3, 6, 10], mb6: [0, 3, 8],
  "5": [0, 7], mmaj7: [0, 3, 7, 11], maj7s11: [0, 4, 7, 11, 18], m11: [0, 3, 7, 10, 14, 17], "13": [0, 4, 10, 14, 21], "7b9": [0, 4, 7, 10, 13],
};
export function chord(sym, centre = 60) {
  const m = sym.match(/^([A-G](?:b|#)?)(.*?)(?:\/([A-G](?:b|#)?))?$/);
  if (!m || !(m[2] in QUAL)) throw new Error(`not a chord: ${sym}`);
  const root = n(m[1] + "4") % 12, ivs = QUAL[m[2]];
  let base = centre - ((centre - root) % 12 + 12) % 12;      // the root at or below the centre
  if (centre - base > 6) base += 12;
  const notes = ivs.map((iv) => base + iv);
  const bass = m[3] ? n(m[3] + "2") % 12 : root;
  return { root, bass, notes, sym };
}
// a bass note for a chord in a register (the lowest of that pitch class at or above `low`)
export const bassOf = (c, low = 36) => low + ((c.bass - low) % 12 + 12) % 12;

// open "Americana" voicing: root and fifth low, then the colour tones spread over an octave and a half
export function openVoicing(c, low = 43) {
  const r = bassOf(c, low), set = new Set(c.notes.map((x) => x % 12));
  const out = [r, r + 7];
  for (const iv of [14, 16, 15, 17, 21, 22, 23, 19, 24]) if (set.has((r + iv) % 12) && !out.includes(r + iv)) out.push(r + iv);
  return out.slice(0, 5);
}

// The ledger: a reported figure spelled as notes. Digits are degrees of the mode (1 the tonic, 9 the
// ninth above it); 0 is a rest. "190" true; "310" the clerk's overwrite; "340" Krall's.
export function ledger(figure, tonic = 62, mode = "dorian") {
  return String(figure).split("").map((ch) => (ch === "0" ? null : deg(tonic, mode, +ch)));
}

// The Haldane table: five bowls, five notes (Ilo, Bet, Tomas, Aaron, Anni). An empty bowl is a rest.
export const BOWLS = ["Ilo", "Bet", "Tomas", "Aaron", "Anni"];
export function haldane(tonic = 62, missing = []) {
  const line = [tonic, tonic + 3, tonic + 7, tonic + 5, tonic + 2];        // D F A G E: up to the summit, down, open
  return line.map((p, i) => (missing.includes(BOWLS[i]) ? null : p));
}

// The Hesh rain: three quick falling grace notes into a held note, from the mode above it
export function rain(target, tonic = 62) {
  const sc = MODES.hesh, up = [];
  for (let p = target + 1; up.length < 3 && p < target + 12; p++) if (sc.includes(((p - tonic) % 12 + 12) % 12)) up.push(p);
  return up.reverse();                                                     // highest first: falling
}
