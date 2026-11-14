// The dawn tower: Exchange Square from the bell tower, day 41, wide lens. A loop of 32 bars at 54 bpm.
// Form: A (1-8) the drone and the harp, the Hesh rain in it; B (9-16) the piano far off with the Haldane
// bowls, over four chords on the D pedal; C (17-24) the export train leaves: iron a semitone over the
// drone, low piano clusters, the church bell for the new rows; A' (25-32) thinner, a breathy flute and the
// Hesh cup in heterophony, back to the drone alone for the loop. SCORE.md, "Pieces".
import { ev, tones, colour, loopDrone, hand, roll, dronePartials } from "./kit.mjs";
import { n, haldane, rain } from "../theory.mjs";

const B_CHORDS = ["Bbadd9/D", "Gm9/D", "Fadd9/C", "A7sus4"];

function harpA(stem, bar0, bars, harm, thin) {
  const out = [], fig = [[0, "D4"], [1, "A4"], [2, "E5"], [3, "F5"]];
  for (let b = 0; b < bars; b++) {
    const at = (bar0 + b) * 4;
    if (thin && b % 2) continue;
    const alt = b % 4 === 3 ? [[0, "D4"], [1.5, "A4"], [2, "B4"], [3, "E5"]] : fig;    // B: the Hesh colour
    for (const [t, p] of alt) out.push(ev(stem, at + t, 3, "harp", colour(n(p), harm), 0.42 - (t ? 0.06 : 0)));
    if (b % 4 === 1) rain(n("E5")).forEach((p, i) => out.push(ev(stem, at + 1.75 + i * 0.08, 0.3, "harp", colour(p, harm), 0.22)));
  }
  return out;
}
function harp2(bar0, bars, harm) {
  const out = [];
  for (let b = 0; b < bars; b++) out.push(ev("harp2", (bar0 + b) * 4 + 2.5, 4, "harp", colour(n(b % 2 ? "A5" : "G5"), harm), 0.25));
  return out;
}
function pianoB(harm) {
  const out = [], motif = haldane(n("D5"));
  B_CHORDS.forEach((sym, i) => {
    const at = (8 + i * 2) * 4;
    out.push(...roll("piano", at, tones(sym, 55, harm).slice(0, 3), 0.18, 7, "piano", 0.32, { opt: { pedal: true } }));
  });
  motif.forEach((p, i) => out.push(ev("piano", 33 + i * 3 + (i > 2 ? 1 : 0), 3, "piano", colour(p, harm), 0.4, { opt: { pedal: true } })));
  // the answer: the bowls again an octave down, slower, the last one left out of the bar
  [n("A4"), n("G4"), n("E4")].forEach((p, i) => out.push(ev("piano", 50 + i * 4, 4, "piano", colour(p, harm), 0.3, { opt: { pedal: true } })));
  return out;
}
function sectionC(harm) {
  const out = [ev("train", 16 * 4, 8 * 4, "train", 0, 0.8, { opt: { mode: "depart", top: 5 } }),
    ev("metal", 16 * 4 + 1, 8 * 4, "metal", n("Eb2"), 0.55, { opt: { attack: 6, release: 8, grit: 0.5 } })];
  for (let b = 16; b < 24; b += 2) {
    out.push(ev("bell", b * 4, 8, "churchbell", n("A3"), 0.42));
    out.push(ev("piano", b * 4 + 1, 6, "piano", n("D2"), 0.3, { opt: { pedal: true } }), ev("piano", b * 4 + 1.06, 6, "piano", n("Eb2"), 0.26, { opt: { pedal: true } }));
  }
  out.push(...[n("D6"), n("A5")].map((p, i) => ev("piano", 22 * 4 + i * 6, 6, "piano", colour(p, harm), 0.2, { opt: { pedal: true } })));
  return out;
}
function heshA(harm) {
  // the cup rung once, then the flute's phrase and its shadow a little late: heterophony, the end rising
  const line = [["A4", 2], ["B4", 1], ["A4", 1], ["G4", 2], ["E4", 2], ["G4", 4]];
  const out = [ev("hesh", 24 * 4, 6, "waterglass", n("A5"), 0.35)];
  let t = 24 * 4 + 2;
  for (const [p, d] of line) {
    out.push(ev("hesh", t, d * 0.95, "breathy", colour(n(p), harm), 0.5));
    out.push(ev("hesh", t + 0.22, d * 0.8, "flute", colour(n(p) - 12, harm), 0.3, { gain: -7 }));
    t += d;
  }
  out.push(ev("hesh", t + 2, 6, "waterglass", n("D6"), 0.25));
  return out;
}

export default {
  id: "dawn", title: "The dawn tower", place: "q.tower", lens: "wide", bpm: 54, meter: 4, bars: 32, loop: true,
  harmonies: ["true", "inflated", "blamed"], target: -18, game: -6,
  stems: {
    drone: { harm: true, room: "space", send: 0.35, tape: { wow: 0.0008, hiss: 0.0006 }, gain: -4 },
    harp: { harm: true, room: "space", send: 0.45, dry: 0.8 },
    harp2: { harm: true, room: "space", send: 0.6, dry: 0.6, gain: -3 },
    piano: { harm: true, room: "space", send: 0.7, dry: 0.55, lp: 7000, board: true, sympathetic: 0.006, gain: 7, tape: { wow: 0.0015, flutter: 0.0003, hiss: 0.0008 } },
    bell: { room: "tower", send: 0.8, dry: 0.3, lp: 3500, gain: -8 },
    train: { group: "music", room: "square", send: 0.6, dry: 0.5, lp: 5000, gain: -6 },
    metal: { room: "space", send: 0.6, gain: -4 },
    hesh: { harm: true, room: "space", send: 0.55, dry: 0.7, gain: -13 },
    wind: { group: "amb", room: "tower", send: 0.2, gain: -10 },
    queue: { group: "amb", room: "square", send: 0.5, dry: 0.5, lp: 3000, gain: 2 },
  },
  sections: [["A", 1, 8, "drone and harp"], ["B", 9, 8, "piano, the bowls"], ["C", 17, 8, "the export train"], ["A'", 25, 8, "the Hesh cup, then the drone"]],
  compose({ harm }) {
    const h = hand("dawn");
    const evs = [
      loopDrone("drone", "drone", n("D2"), this, 0.85, { partials: dronePartials(harm), sub: 0.25, beat: 0.09 }),
      ...harpA("harp", 0, 8, harm), ...harpA("harp", 24, 8, harm, true), ...harp2(0, 8, harm), ...harp2(8, 8, harm),
      ...pianoB(harm), ...sectionC(harm), ...heshA(harm),
      loopDrone("wind", "wind", 0, this, 0.7, { rate: 0.09, whistle: 1250 }),
      loopDrone("queue", "queue", 0, this, 0.6, { length: 0.8, sick: 0.5 }),
    ];
    return evs.map((e) => (["harp", "harp2", "piano", "hesh"].includes(e.stem) ? h(e) : e));
  },
  // the community model to layers (SCORE.md section 6): dB per stem, null for silent
  adapt(s) {
    return {
      drone: 0, harp: 0, harp2: s.hunger > 0.5 ? null : -2, piano: s.food > 0.3 ? 0 : -6,
      bell: s.deaths > 0 ? 0 : null, train: s.export ? 0 : null, metal: s.export ? -2 : null,
      hesh: s.standing.hesh > -0.35 && s.harm !== "blamed" ? 0 : null,
      wind: -8 + 6 * (s.wind ?? 0.5), queue: -18 + 18 * Math.min(1, s.hunger + 0.2),
    };
  },
  // what the author hears: two passes; the second after an inflated report, the harmony changed at bar 41
  listen: { passes: 2, script: [{ bar: 0, set: { drone: 0, harp: 0, harp2: -2, piano: 0, bell: 0, train: 0, metal: -2, hesh: 0, wind: -2, queue: -6 }, bars: 0 },
    { bar: 36, set: { harp2: null, queue: 0 }, bars: 2 }, { bar: 40, harm: "inflated", bars: 2 }, { bar: 56, set: { hesh: null }, bars: 4 }] },
};
