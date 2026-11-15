// The coda: the Haldane table a week later. The Haldane theme (THEMES.md 1) in 3/4 at 63, 50 bars, linear.
// The theme's head is the five bowls (Ilo, Bet, Tomas, Aaron, Anni: D F A G E), and an empty bowl is a
// rest, so with Tomas gone every statement climbs to a note that is not there.
// Form, after the restrained ostinato-and-slow-build idea (THEMES.md, colour): intro (1-4) the ostinato
// alone; S1 (5-20) the theme on top; S2 (21-36) the theme an octave down in the strings, the pads opening,
// a wordless choir coming in at the end; release (37-40) the bridge with everything, the one time the cue
// is loud; a'' (41-44) back to the electric piano alone with the hole; outro (45-50) the ostinato thinning
// to an open E. Two voicings: "ep" (electric piano, pads, strings, choir) and "piano" (solo piano).
import { ev } from "./kit.mjs";
import { melody, voicings, held, ostinato, roots } from "./arrange.mjs";
import { layout } from "../themes.mjs";
import { BOWLS } from "../theory.mjs";

const at = (bar) => bar * 3;
const shifted = (L, b0) => ({ ...L, notes: L.notes.map((x) => ({ ...x, at: x.at + at(b0) })), chords: L.chords.map((c) => ({ ...c, at: c.at + at(b0) })) });
const fixed = (syms, b0) => ({ meter: 3, notes: [], chords: syms.map((s, i) => ({ at: at(b0 + i), dur: 3, sym: s })) });

function arrangement(missing, ep) {
  const lead = ep ? "ep" : "piano", P = ep ? { decay: 1.1 } : { pedal: true }, out = [], LS = ep ? "lead" : "plead", OS = ep ? "osti" : "posti";
  const S1 = shifted(layout("haldane", { missing }), 4), S2 = shifted(layout("haldane", { missing }), 20);
  const R = shifted(layout("haldane", { missing, sections: [2] }), 36), A3 = shifted(layout("haldane", { missing, sections: [3] }), 40);
  const intro = fixed(["Dm", "Dm", "Bbmaj7", "A7sus4"], 0), outro = fixed(["Dm", "Dm", "Bbmaj7", "Bbmaj7", "Dm", "Dm"], 44);
  for (const L of [intro, S1, S2, R, A3, outro]) out.push(...ostinato(voicings(L, 57, 4), OS, lead, L === R ? 0.36 : 0.26, [0, 2, 1, 3, 2, 1], { opt: P }));
  out.push(...melody(S1, LS, lead, 0.5, { transpose: 12, opt: P }), ...melody(A3, LS, lead, 0.42, { transpose: 12, opt: P }));
  out.push(ev(LS, at(49), 6, lead, 76, 0.32, { opt: P }));                       // the open E, left to the room
  if (!ep) { out.push(...melody(S2, LS, "piano", 0.46, { opt: P }), ...melody(R, LS, "piano", 0.6, { transpose: 12, opt: P })); return out; }
  out.push(...melody(S2, "strings", "strings", 0.5, { opt: { attack: 0.25 } }), ...melody(R, "lead", "ep", 0.62, { transpose: 12 }), ...melody(R, "strings", "strings", 0.62, { opt: { attack: 0.2 } }));
  for (const [L, v] of [[S1, 0.3], [S2, 0.42], [R, 0.6]]) out.push(...held(voicings(L, 52, 4), "pads", "pad", v, { opt: { attack: 1.6, release: 2.5, cutoff: L === R ? 2600 : 1500 } }));
  for (const L of [S2, R]) out.push(...roots(L, "low", "pad", L === R ? 0.5 : 0.35, 38, "true", { opt: { cutoff: 500, attack: 0.8 } }));
  const late = { ...S2, chords: S2.chords.filter((c) => c.at >= at(28)) };
  for (const L of [late, R]) out.push(...held(voicings(L, 64, 3), "choir", "choir", L === R ? 0.55 : 0.35, { opt: { vowel: "oo", attack: 1.2, release: 1.5 } }));
  return out;
}

export default {
  id: "coda", title: "The coda at the Haldane table", place: "q.haldane", lens: "narrow", bpm: 63, meter: 3, bars: 50, loop: false,
  harmonies: ["true"], target: -20, game: -9,
  stems: {
    lead: { room: "kitchen", send: 0.25, dry: 0.9, autopan: [0.11, 0.2], tape: { wow: 0.0006, flutter: 0.0001, hiss: 0.0003, drive: 1.1 }, gain: 4 },
    osti: { room: "space", send: 0.35, dry: 0.75, autopan: [0.17, 0.35], gain: -11 },
    plead: { room: "kitchen", send: 0.3, dry: 0.9, board: true, sympathetic: 0.006, tape: { wow: 0.0005, flutter: 0.0001, hiss: 0.0003, drive: 1.1 }, gain: 4 },
    posti: { room: "kitchen", send: 0.3, dry: 0.85, board: true, sympathetic: 0.006, gain: -9 },
    strings: { room: "space", send: 0.45, dry: 0.75, width: 1.2, gain: 1 },
    pads: { room: "space", send: 0.4, dry: 0.8, width: 1.4, gain: -9 },
    low: { room: "space", send: 0.2, gain: -3 },
    choir: { room: "space", send: 0.7, dry: 0.4, width: 1.3, gain: -26 },
    room: { group: "amb", room: "kitchen", send: 0.3, gain: -24 },
  },
  sections: [["intro", 1, 4, "the ostinato"], ["S1", 5, 16, "the theme"], ["S2", 21, 16, "lower, strings, pads open"], ["release", 37, 4, "the bridge, once loud"], ["a''", 41, 4, "the hole, alone"], ["outro", 45, 6, "to an open E"]],
  compose({ missing = ["Tomas"], voice = "ep" }) {
    const out = [ev("room", 0, 51 * 3, "stove", 0, 0.45, { opt: { fire: 0.2 } }), ev("room", 0, 51 * 3, "wind", 0, 0.3, { opt: { rate: 0.06, corner: 0.3 } })];
    BOWLS.filter((b) => !missing.includes(b)).forEach((b, i) => out.push(ev("room", 0.4 + i * 0.9, 2, "bowlset", 86 + [0, 3, 7, 5, 2][BOWLS.indexOf(b)], 0.5, { gain: 12 })));
    return [...out, ...arrangement(missing, voice === "ep")];
  },
  adapt() { return { lead: 0, osti: 0, plead: 0, posti: 0, strings: 0, pads: 0, low: 0, choir: 0, room: 0 }; },
  listen: { passes: 1, script: [{ bar: 0, set: { lead: 0, osti: 0, plead: 0, posti: 0, strings: 0, pads: 0, low: 0, choir: 0, room: 0 }, bars: 0 }] },
  alts: { "coda-piano": { opts: { voice: "piano" } }, "coda-3bowls": { opts: { missing: ["Tomas", "Aaron"] } } },
};
