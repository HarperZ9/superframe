// The opening film's sound (design/CINEMATICS.md section 3.2), one cue laid to the film's seconds: 60 bpm, so a
// beat is a second. Built from the slice's own sound design and the dawn cue's instruments; nothing new is
// synthesised here. Cinematics lead, 2026-10-22.
//   0-4 the tower air alone; 4-20 a far bell, the drone comes in; 20-36 the queue and the harp; 36-50 sacks on
//   boards and the bowls motif; 50-56 the music stops dead (an authored near-silence: wind and the engine idling);
//   64-76 the bell for the new rows, three strokes; 76-92 the train pulls out, and under it an old man humming the
//   prayer for the water (the `hum` voice, wordless), close by 88; 92-100 the hum's last phrase, left unfinished.
import { ev, colour, hand } from "./kit.mjs";
import { n, haldane } from "../theory.mjs";

const DUR = 100;
function bed() {
  return [ev("wind", 0, DUR, "wind", 0, 0.75, { opt: { rate: 0.09, whistle: 1250, attack: 2, release: 3 } }), ev("wind", 0, DUR, "frost", 0, 0.45, { opt: { rate: 2 } }),
    ev("queue", 20, 30, "queue", 0, 0.6, { opt: { length: 0.8, sick: 0.6, attack: 2, release: 3 } }),
    ev("queue", 22.5, 1, "cough", 0, 0.45), ev("queue", 27.2, 1, "cough", 0, 0.4), ev("queue", 33.8, 1, "cough", 0, 0.35)];
}
function bells() {
  return [ev("bell", 10, 8, "churchbell", n("A3"), 0.22), ...[65, 68.5, 72].map((t) => ev("bell", t, 8, "churchbell", n("A3"), 0.4))];
}
// the drone in, out dead at the blow, back for the new rows, gone under the hum
function drone() {
  return [ev("drone", 12, 38.2, "drone", n("D2"), 0.8, { opt: { attack: 6, release: 0.08 } }), ev("drone", 62, 26, "drone", n("D2"), 0.7, { opt: { attack: 4, release: 5 } })];
}
function harp(harm) {
  const out = [], fig = [[0, "D4"], [1, "A4"], [2, "E5"], [3, "F5"]];
  for (let b = 0; b < 4; b++) for (const [t, p] of fig) out.push(ev("harp", 20 + b * 4 + t, 3, "harp", colour(n(p), harm), 0.38 - (t ? 0.06 : 0)));
  return out;
}
// sacks thrown down on boards, every three seconds while the men load (the loaders' path, cine/opening.mjs)
function sacks() { const out = []; for (let t = 24; t < 50; t += 3) out.push(ev("sacks", t + 0.1, 0.4, "stamp", 0, 0.5 + 0.1 * ((t * 7) % 3))); return out; }
function bowls(harm) {
  const out = []; haldane(n("D5")).forEach((p, i) => out.push(ev("piano", 38 + i * 2, 3, "piano", colour(p, harm), 0.32, { opt: { pedal: true } })));
  return out;
}
function train() {
  return [ev("train", 30, 46, "train", 0, 0.6, { opt: { mode: "idle" } }), ev("train", 76, 18, "train", 0, 0.85, { opt: { mode: "depart", top: 5 } }),
    ev("metal", 77, 11, "metal", n("Eb2"), 0.4, { opt: { attack: 4, release: 4, grit: 0.5 } })];
}
// the prayer, wordless: the Hesh line of the dawn cue an octave down in an old man's voice, twice; the second time
// it stops before its last note (the end Tomas is never taught, content/quota/q_cells.lwd)
function prayer(harm) {
  const line = [["A3", 2], ["B3", 1], ["A3", 1], ["G3", 2], ["E3", 2], ["G3", 3]], out = [];
  const say = (t0, v, last) => { let t = t0; line.slice(0, last).forEach(([p, d], k) => { out.push(ev("hum", t, d * 0.95, "hum", colour(n(p), harm), v * (k % 2 ? 0.9 : 1), { opt: { vowel: k === 4 ? "ah" : "mm", attack: 0.3, release: 0.5 } })); t += d; }); return t; };
  const t1 = say(80, 0.35, line.length);
  say(Math.max(t1 + 1, 90), 0.6, line.length - 1);
  return out;
}

export default {
  id: "opening", title: "The opening film", place: "q.tower", lens: "wide", bpm: 60, meter: 4, bars: DUR / 4, loop: false,
  harmonies: ["true"], target: -18, game: -6,
  stems: {
    wind: { group: "amb", room: "tower", send: 0.2, gain: -9 },
    queue: { group: "amb", room: "square", send: 0.5, dry: 0.5, lp: 3000, gain: -2 },
    sacks: { group: "amb", room: "square", send: 0.6, dry: 0.4, lp: 1800, gain: -10 },
    train: { group: "amb", room: "square", send: 0.6, dry: 0.5, lp: 5000, gain: -8 },
    bell: { room: "tower", send: 0.8, dry: 0.3, lp: 3500, gain: -8 },
    drone: { harm: true, room: "space", send: 0.35, tape: { wow: 0.0008, hiss: 0.0006 }, gain: -6 },
    harp: { harm: true, room: "space", send: 0.45, dry: 0.8, gain: -2 },
    piano: { harm: true, room: "space", send: 0.7, dry: 0.55, lp: 7000, gain: 4, tape: { wow: 0.0015, flutter: 0.0003, hiss: 0.0008 } },
    metal: { room: "space", send: 0.6, gain: -8 },
    // under the grating: through iron and stone, the highs gone, a small hard room
    hum: { room: "square", send: 0.35, dry: 0.8, lp: 1600, gain: -4 },
  },
  compose({ harm }) {
    const h = hand("opening");
    return [...bed(), ...bells(), ...drone(), ...harp(harm), ...sacks(), ...bowls(harm), ...train(), ...prayer(harm)].map((e) => (["harp", "piano", "hum"].includes(e.stem) ? h(e) : e));
  },
  adapt: () => ({ wind: 0, queue: 0, sacks: 0, train: 0, bell: 0, drone: 0, harp: 0, piano: 0, metal: 0, hum: 0 }),
  listen: { passes: 1, script: [{ bar: 0, set: { wind: 0, queue: 0, sacks: 0, train: 0, bell: 0, drone: 0, harp: 0, piano: 0, metal: 0, hum: 0 }, bars: 0 }] },
};
