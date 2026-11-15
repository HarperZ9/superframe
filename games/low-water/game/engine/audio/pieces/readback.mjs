// The read-back: near silence, by rule (QUOTA-VOICES 11.4: no room, no music, no ambience under it). This
// cue is the threshold into it and, as an option for the author, one note per hinge played in the 1.4 s
// gap before the hinge, never under a line. The coda's room fades over two bars and stops; then nothing.
// Option B's notes are the five bowls once more, low and slow, one per hinge (D F A G E): the whole
// table only exists across the whole record. Default off until the author decides.
import { ev } from "./kit.mjs";
import { n, haldane } from "../theory.mjs";

export const HINGE_BARS = [4, 7, 10, 12, 14];

export default {
  id: "readback", title: "The read-back", place: "q.readback", lens: "none", bpm: 60, meter: 4, bars: 16, loop: false,
  harmonies: ["true"], target: -26, game: -12,
  stems: {
    room: { group: "amb", room: "kitchen", send: 0.3, gain: -22 },
    hinge: { room: "space", send: 0.25, gain: 0 },
  },
  sections: [["threshold", 1, 2, "the room goes"], ["record", 3, 14, "silence; option B: a note per hinge"]],
  compose() {
    const out = [ev("room", 0, 8, "stove", 0, 0.45, { opt: { fire: 0.2 } }), ev("room", 0, 8, "wind", 0, 0.3, { opt: { rate: 0.06, corner: 0.3 } })];
    haldane(n("D3")).forEach((p, i) => out.push(ev("hinge", HINGE_BARS[i] * 4 - 1.4, 1.2, "piano", p, 0.22)));
    return out;
  },
  adapt(s) { return { room: s.readback ? null : 0, hinge: s.readbackNotes ? 0 : null }; },
  // option A (the default): the threshold, then silence
  listen: { passes: 1, script: [{ bar: 0, set: { room: 0 }, bars: 0 }, { bar: 1, set: { room: null }, bars: 2 }] },
  alts: { "readback-hinges": { script: [{ bar: 0, set: { room: 0, hinge: 0 }, bars: 0 }, { bar: 1, set: { room: null }, bars: 2 }] } },
};
