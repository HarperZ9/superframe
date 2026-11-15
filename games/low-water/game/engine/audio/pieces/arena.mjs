// The bread fights behind the Orme mill, at night (eras 2 and 3). 32 bars at 100, a loop, built from the
// yard: the mill's stones still turning (Orme sells at night), a hand on a crate, the crowd's stamps and
// claps, iron from the hoist, an upright bass vamp, and a reed calling and answering itself. Layers follow
// the fight's intensity; between bouts the yard keeps only the stones, the crate and the crowd. There is no
// layer for a win: when a wave clears, the next bar line drops layers, the same as when it began.
// Form: A (1-16) the vamp on Dm7, eight bars, then G7 and back; B (17-32) Bbmaj7 to A7sus4, then the vamp.
import { ev, hand, loopDrone } from "./kit.mjs";
import { n } from "../theory.mjs";

const VAMP = [["D2", 0], ["D2", 1], ["A2", 1.5], ["C3", 2], ["D2", 4], ["F2", 5.5], ["G2", 6], ["A2", 7]];
const ROOTS = [...Array(8).fill(0), ...Array(4).fill(5), ...Array(4).fill(0), ...Array(4).fill(-4), ...Array(4).fill(-5), ...Array(8).fill(0)];
const CALL = [["D4", 0, 0.5], ["F4", 0.5, 0.5], ["G4", 1, 0.5], ["A4", 1.5, 2.5], ["C5", 4, 0.75], ["A4", 4.75, 0.75], ["G4", 5.5, 0.5], ["F4", 6, 2]];
const ANSWER = [["A4", 0, 1], ["G4", 1, 0.5], ["F4", 1.5, 0.5], ["D4", 2, 2], ["F4", 4.5, 0.5], ["E4", 5, 0.5], ["D4", 5.5, 2.5]];

function yard(b) {
  const at = b * 4, out = [];
  for (const [t, v] of [[0, 0.8], [0.75, 0.35], [2, 0.6], [2.5, 0.45], [3.5, 0.4]]) out.push(ev("crate", at + t, 1, "crate", 0, v, { opt: { tune: 105 } }));
  out.push(ev("stamps", at + 1, 1, "stamp", 0, 0.6), ev("stamps", at + 3, 1, "stamp", 0, 0.7));
  if (b % 2) out.push(ev("iron", at + 3.5, 2, "iron", n(b % 4 === 1 ? "C5" : "Bb4"), 0.35));
  return out;
}

export default {
  id: "arena", title: "The bread fights", place: "arena.bread", lens: "near", bpm: 100, meter: 4, bars: 32, loop: true,
  harmonies: ["true"], target: -16, game: -6,
  stems: {
    stones: { group: "amb", room: "yard", send: 0.3, gain: -20 },
    crate: { room: "yard", send: 0.25, gain: 8 },
    stamps: { room: "yard", send: 0.3, gain: 0 },
    bass: { room: "yard", send: 0.15, gain: -2 },
    claps: { room: "yard", send: 0.35, gain: 22 },
    iron: { room: "yard", send: 0.45, gain: 9 },
    reed: { room: "yard", send: 0.35, dry: 0.9, tape: { drive: 1.6, hiss: 0.0006 }, gain: -5 },
    crowd: { group: "amb", room: "yard", send: 0.5, lp: 2500, gain: -10 },
  },
  sections: [["A", 1, 16, "the vamp"], ["B", 17, 16, "B flat to A, then the vamp"]],
  compose() {
    const h = hand("arena", 7, 0.01, 0.1), out = [];
    out.push(loopDrone("stones", "millgrind", 0, this, 0.8, { rpm: 90 }), loopDrone("crowd", "murmur", 0, this, 0.7, { count: 16 }));
    out.push(loopDrone("crowd", "brazier", 0, this, 0.4));
    for (let b = 0; b < 32; b++) out.push(...yard(b).map(h));
    for (let b = 0; b < 32; b += 2) for (const [p, t] of VAMP) out.push(h(ev("bass", b * 4 + t, t % 1 ? 0.45 : 0.9, "bass", n(p) + ROOTS[b], 0.75)));
    out.push(ev("claps", 0, 32 * 4, "claps", 0, 0.7, { opt: { bpm: 100, pattern: [0, 1, 0, 1, 0, 1, 1, 1], hands: 10 } }));
    for (const b0 of [0, 8, 24]) {
      for (const [p, t, d] of CALL) out.push(h(ev("reed", b0 * 4 + t, d, "reed", n(p), 0.7)));
      for (const [p, t, d] of ANSWER) out.push(h(ev("reed", (b0 + 4) * 4 + t, d, "reed", n(p), 0.62)));
    }
    return out;
  },
  adapt(s) {
    const i = s.intensity ?? 0, between = !s.inBout;
    return { stones: 0, crate: 0, crowd: s.crowd ?? 0, stamps: !between && i >= 0.3 ? 0 : null, bass: !between && i >= 0.3 ? 0 : null,
      claps: !between && i >= 0.55 ? 0 : null, iron: !between && i >= 0.55 ? 0 : null, reed: !between && i >= 0.75 ? 0 : null };
  },
  listen: { passes: 2, script: [{ bar: 0, set: { stones: 0, crate: 0, crowd: 0 }, bars: 0 }, { bar: 4, set: { stamps: 0, bass: 0 } }, { bar: 16, set: { claps: 0, iron: 0 } },
    { bar: 24, set: { reed: 0 } }, { bar: 48, set: { reed: null, claps: null, iron: null, stamps: null, bass: null }, bars: 1 }, { bar: 56, set: { stamps: 0, bass: 0 } }] },
};
