// A kitchen at night: the kitchen theme (THEMES.md 3), AABA in 4/4 at 66, swung, a loop. A cool-jazz
// small band, quiet: a clean guitar with a slow tremolo carries the tune, an electric piano comps, an
// upright bass walks, fingers snap on two and four, a brush keeps time, a lush pad sits under it all. The
// harmony puts tenderness and dread in the same chord (a minor chord with a major seventh, the minor four
// under the home key). In the narrow lens the band drops away and leaves the guitar and the room. The
// lie's harmony: every fifth a semitone low, and the A sections' home chord, F, becomes D flat.
import { ev, loopDrone, hand, lies } from "./kit.mjs";
import { melody, voicings, held, comp, walking, swing } from "./arrange.mjs";
import { layout } from "../themes.mjs";

function band(harm) {
  const L = layout("kitchen", { lie: lies(harm) }), h = hand("kitchen2", 3, 0.012, 0.08), out = [];
  out.push(...melody(L, "lead", "guitar", 0.55, { legato: 0.92, opt: { ring: true, t60: 3.2 }, phraseBars: 8 }).map(h));
  out.push(...comp(voicings(L, 58, 4, harm), "ep", "ep", 0.36, [0, 1.5], { len: 1.1, opt: { decay: 0.8 } }).map(swing).map(h));
  out.push(...held(voicings(L, 50, 4, harm), "pads", "pad", 0.35, { opt: { attack: 1.4, release: 2, cutoff: 1300 } }));
  out.push(...walking(L, "bass", 0.72, 33, harm).map(h));
  for (let b = 0; b < L.bars; b++) {
    for (const t of [1, 3]) out.push(h(ev("snaps", b * 4 + t, 0.5, "snap", 0, 0.55)));
    out.push(ev("brush", b * 4, 1.9, "sweep", 0, 0.35), ev("brush", b * 4 + 2, 1.9, "sweep", 0, 0.3, { opt: { from: 5000, to: 3200 } }));
  }
  return out;
}

export default {
  id: "kitchen", title: "A kitchen at night", place: "q.furrowe_kitchen", lens: "narrow", bpm: 66, meter: 4, bars: 32, loop: true,
  harmonies: ["true", "inflated", "blamed"], target: -20, game: -10,
  stems: {
    lead: { harm: true, room: "space", send: 0.3, dry: 0.9, trem: [4.6, 0.32], echo: { time: 0.68, feedback: 0.28, mix: 0.16 }, tape: { wow: 0.0007, hiss: 0.0004, drive: 1.2 }, gain: 9 },
    ep: { harm: true, room: "kitchen", send: 0.3, autopan: [0.2, 0.45], gain: -7 },
    pads: { harm: true, room: "space", send: 0.45, width: 1.4, gain: -12 },
    bass: { harm: true, room: "kitchen", send: 0.15, gain: -16 },
    snaps: { room: "kitchen", send: 0.35, gain: 10 },
    brush: { room: "kitchen", send: 0.25, gain: -4 },
    room: { group: "amb", room: "kitchen", send: 0.3, gain: -22 },
  },
  sections: [["A", 1, 8, "the tune"], ["A2", 9, 8, "home"], ["B", 17, 8, "the bridge"], ["A3", 25, 8, "home, or not"]],
  compose({ harm }) {
    return [...band(harm), loopDrone("room", "stove", 0, this, 0.5, { fire: 0.35 }), loopDrone("room", "wind", 0, this, 0.35, { rate: 0.07, corner: 0.4 })];
  },
  adapt(s) {
    const narrow = s.lens === "narrow";
    return { lead: 0, room: 0, ep: narrow ? null : 0, pads: narrow ? null : s.hunger > 0.6 ? -6 : 0, bass: narrow ? null : 0, snaps: narrow ? null : 0, brush: narrow ? null : 0 };
  },
  listen: { passes: 2, script: [{ bar: 0, set: { lead: 0, room: 0, ep: 0, pads: 0, bass: 0, snaps: 0, brush: 0 }, bars: 0 }, { bar: 32, harm: "inflated", bars: 2 }] },
};
