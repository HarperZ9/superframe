// The score's themes as data (design/audio/THEMES.md): a melody, its chords and its form. Bars are split
// by "|"; a token is NOTE:beats, "_" a rest; a melody note may carry a bowl ("A4~Tomas:1"), and an empty
// bowl at the table is a rest. Chords are one or more SYMBOL:beats per bar (one symbol fills the bar).
// Every theme here is original; none quotes a reference (SCORE.md, clean room).
import { n, chord } from "./theory.mjs";

export const THEMES = {
  haldane: {
    title: "The Haldane table", meter: 3, bpm: 63,
    melody: [
      "D4~Ilo:1 F4~Bet:1 A4~Tomas:1 | G4~Aaron:2 E4~Anni:1 | F4:2 D4:1 | E4:3",
      "D4~Ilo:1 F4~Bet:1 A4~Tomas:1 | C5:2 Bb4:1 | A4:2 G4:1 | A4:3",
      "D5:2 C5:1 | Bb4:2 A4:1 | G4:2 Bb4:1 | A4:3",
      "D4~Ilo:1 F4~Bet:1 A4~Tomas:1 | G4~Aaron:2 E4~Anni:1 | F4:2 E4:1 | D4:3",
    ],
    chords: ["Dm | C/E | Bbmaj7 | A7sus4:2 A7:1", "Dm | F/C | Gm7/Bb | A7", "Bbmaj7 | Gm7 | Em7b5 | A7b9", "Dm | C/E | Gm7:2 A7:1 | Dm"],
  },
  town: {
    title: "The Upper Town", meter: 4, bpm: 60,
    melody: ["A3:2 F4:2 | E4:1 D4:1 E4:1 F4:1 | G4:3 A4:1 | E4:4", "A3:2 F4:2 | E4:1 D4:1 C4:1 Bb3:1 | Bb3:1 C4:1 E4:2 | D4:4"],
    chords: ["Dm | Bb | C | A7sus4:2 A7:2", "Dm | Gm | Gm6:2 A7:2 | Dm"],
  },
  kitchen: {
    title: "The kitchen at night", meter: 4, bpm: 66, swing: true,
    melody: [
      "C5:2 A4:1 G4:1 | A4:4 | C#5:2 D5:1 E5:1 | F5:4 | E5:2 D5:1 A4:1 | Db5:4 | C5:2 A4:2 | G4:3 _:1",
      "C5:2 A4:1 G4:1 | A4:4 | C#5:2 D5:1 E5:1 | F5:4 | E5:2 D5:1 A4:1 | Db5:4 | Bb4:2 G4:1 E4:1 | F4:3 _:1",
      "D5:2 F5:2 | E5:3 C5:1 | D5:2 Bb4:2 | A4:4 | G4:1 A4:1 Bb4:1 D5:1 | C5:4 | Bb4:2 G4:2 | _:2 E4:2",
      "C5:2 A4:1 G4:1 | A4:4 | C#5:2 D5:1 E5:1 | F5:4 | E5:2 D5:1 A4:1 | Db5:4 | Bb4:2 G4:1 E4:1 | F4:3 _:1",
    ],
    chords: [
      "Fmaj7 | Em7b5:2 A7b9:2 | Dmmaj7 | Dm7 | Bbmaj7 | Bbm6 | Fmaj7/A | Gm7:2 C7sus4:2",
      "Fmaj7 | Em7b5:2 A7b9:2 | Dmmaj7 | Dm7 | Bbmaj7 | Bbm6 | Gm7:2 C7:2 | HOME",
      "Bbmaj7 | Am7 | Gm7 | Fmaj7 | Ebmaj7s11 | Dm7 | Gm7 | C7sus4:2 C7b9:2",
      "Fmaj7 | Em7b5:2 A7b9:2 | Dmmaj7 | Dm7 | Bbmaj7 | Bbm6 | Gm7:2 C7:2 | HOME",
    ],
    home: { true: "Fmaj7", lie: "Dbmaj7" },
  },
  road: {
    title: "The requisition road", meter: 4, bpm: 76,
    melody: ["D5:2 C5:1 A4:1 | Bb4:3 A4:1 | G4:2 F4:1 G4:1 | A4:4 | D5:2 C5:1 A4:1 | Bb4:2 D5:2 | E5:2 C#5:2 | D5:4",
      "F5:2 E5:1 D5:1 | C5:3 Bb4:1 | A4:2 G4:1 A4:1 | Bb4:4 | A4:2 F4:2 | G4:2 E4:2 | F4:1 E4:1 D4:1 C#4:1 | D4:4"],
    chords: ["Dm | Gm | Ebmaj7 | A7sus4:2 A7:2 | Dm | Gm | A7 | Dm", "Bb | F/A | Gm7 | Ebmaj7 | Dm/F | C/E | A7 | Dm"],
  },
  captain: {
    title: "The Requisition Captain", meter: 4, bpm: 92,
    melody: ["D4:2 D4:1 E4:1 | F4:2 E4:2 | D4:1 C4:1 D4:2 | A3:4 | D4:1 D4:1 E4:1 F4:1 | G4:2 F4:2 | E4:1 F4:1 E4:1 D4:1 | D4:4",
      "F4:2 F4:1 G4:1 | Ab4:2 G4:2 | F4:1 Eb4:1 F4:2 | C4:4 | F4:1 F4:1 G4:1 Ab4:1 | Bb4:2 Ab4:2 | G4:1 Ab4:1 G4:1 F4:1 | D4:4"],
    chords: ["Dm | Bb | Gm | A | Dm | Bb | Gm6:2 A:2 | Dm", "Fm | Db | Bbm | C | Fm | Db | Bbm6:2 A:2 | Dm"],
  },
};

// one section's text into timed events, from beat `at0`
function bars(text, meter, at0, fn) {
  text.split("|").forEach((bar, b) => {
    const toks = bar.trim().split(/\s+/), one = toks.length === 1 && !toks[0].includes(":");
    let t = at0 + b * meter;
    for (const tok of toks) { const [what, d] = tok.split(":"); const beats = one ? meter : +d; fn(what, t, beats); t += beats; }
  });
  return text.split("|").length;
}

// the theme laid out: { notes: [{ at, dur, p, bowl }], chords: [{ at, dur, sym }], bars, meter }
export function layout(name, o = {}) {
  const T = THEMES[name], notes = [], chords = [];
  let at = o.at ?? 0, count = 0;
  const sections = o.sections ?? T.melody.map((_, i) => i);
  for (const s of sections) {
    bars(T.melody[s], T.meter, at, (w, t, d) => {
      if (w === "_") return;
      const [p, bowl] = w.split("~");
      if (bowl && (o.missing || []).includes(bowl)) return;
      notes.push({ at: t, dur: d, p: n(p) + 12 * (o.octave ?? 0), bowl: bowl || null });
    });
    const len = bars(T.chords[s], T.meter, at, (w, t, d) => chords.push({ at: t, dur: d, sym: w === "HOME" ? T.home[o.lie ? "lie" : "true"] : w }));
    at += len * T.meter; count += len;
  }
  return { notes, chords, bars: count, meter: T.meter, end: at };
}
export const chordTones = (sym, centre) => chord(sym, centre).notes;
