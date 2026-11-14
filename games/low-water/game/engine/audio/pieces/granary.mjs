// The granary door: the Requisition Captain's theme (THEMES.md 5), story fight 1. 16 bars at 92, a loop in
// layers that follow the fight. The Captain fights as if at a service: a chant sung by a choir in octaves
// with a fifth under it (organum), an organ, strings driving in eighths, low drums in procession under a
// broken beat, iron and the church bell. The A half is on D; the B half a minor third up, F minor, so its
// A flat sits a tritone from the D the cue returns to. Layers: L0 organ pedal, sub and the grain chute;
// L1 drums (intensity 0.25); L2 strings and bass (0.45); L3 the choir, the organ's chords and the bell
// (0.7); phase 2 adds the chain and the choir an octave up. The talk-out: every layer falls away on the
// bar and the true figure plays on the harp over a pad. No layer marks a hit or a result.
import { ev, loopDrone, hand, dronePartials, bassNote } from "./kit.mjs";
import { melody, voicings, held, ostinato, roots } from "./arrange.mjs";
import { layout } from "../themes.mjs";
import { ledger } from "../theory.mjs";
import { FIGURES } from "./office.mjs";

function drums(b) {
  const at = b * 4, out = [];
  for (const [t, v] of [[0, 0.9], [1.75, 0.5], [2.5, 0.75]]) out.push(ev("drums", at + t, 1, "kick", 0, v, { opt: { tune: 52, decay: 0.16 } }));
  for (const t of [1, 3]) out.push(ev("drums", at + t, 1, "tap", 0, 0.8, { opt: { tune: 205 } }));
  for (const t of [0.75, 2.25, 3.75]) out.push(ev("drums", at + t, 1, "tap", 0, 0.18, { opt: { tune: 205 } }));
  for (const [t, tune] of [[0, 62], [2, 58], [3, 52]]) out.push(ev("toms", at + t, 2, "tom", 0, t ? 0.6 : 0.85, { opt: { tune } }));
  out.push(ev("drums", at + 3.5, 1, "iron", b % 2 ? 79 : 80, 0.3, { gain: -4 }));
  return out;
}

export default {
  id: "granary", title: "The granary door", place: "q.granary", lens: "near", bpm: 92, meter: 4, bars: 16, loop: true,
  harmonies: ["true", "inflated", "blamed"], target: -16, game: -5,
  stems: {
    pulse: { harm: true, room: "granary", send: 0.35, gain: -10 },
    drums: { room: "granary", send: 0.2, tape: { drive: 2, top: 10000, hiss: 0.001 }, gain: -4 },
    toms: { room: "granary", send: 0.35, gain: -6 },
    strings: { harm: true, room: "space", send: 0.35, dry: 0.85, width: 1.3, gain: -4 },
    bass: { harm: true, room: "granary", send: 0.15, tape: { drive: 2.5, top: 5000 }, gain: -4 },
    choir: { harm: true, room: "space", send: 0.5, dry: 0.6, width: 1.3, gain: -24 },
    organ: { harm: true, room: "space", send: 0.45, leslie: { fast: false }, gain: -12 },
    bell: { room: "space", send: 0.6, gain: -12 },
    chain: { room: "granary", send: 0.35, gain: 6 },
    choir2: { harm: true, room: "space", send: 0.6, dry: 0.5, width: 1.4, gain: -28 },
    talk: { room: "space", send: 0.45, gain: -4 },
  },
  sections: [["A", 1, 8, "the chant on D"], ["B", 9, 8, "a minor third up, F minor"]],
  compose({ harm, cls = "inspector" }) {
    const h = hand("captain", 5, 0.005, 0.07), L = layout("captain"), V = voicings(L, 55, 4, harm), out = [];
    out.push(loopDrone("pulse", "drone", 26, this, 1, { partials: dronePartials(harm), sub: 0.6 }), loopDrone("pulse", "chute", 0, this, 0.35, { flow: 0.5 }));
    out.push(...roots(L, "pulse", "organ", 0.7, 26, harm, { opt: { reg: "hollow", click: 0 }, legato: 1 }));
    for (let b = 0; b < 16; b++) out.push(...drums(b).map(h), ev("chain", b * 4 + 3, 1, "chain", 0, 0.6));
    out.push(...ostinato(V, "strings", "strings", 0.5, [0, 2, 1, 3, 2, 3, 1, 2], { len: 0.45, opt: { attack: 0.02, release: 0.15 } }));
    out.push(...L.chords.flatMap((c) => [0, 1.5, 2, 3].filter((t) => t < c.dur).map((t) => h(ev("bass", c.at + t, 0.45, "bass", bassNote(c.sym, 33, harm), t ? 0.7 : 0.9, { opt: { amp: 2.2, cab: 2500 } })))));
    out.push(...melody(L, "choir", "choir", 0.6, { legato: 1, opt: { vowel: "ah", attack: 0.15, release: 0.5 } }), ...melody(L, "choir", "choir", 0.45, { transpose: -7, legato: 1, opt: { vowel: "oh", attack: 0.15 } }));
    out.push(...melody(L, "choir2", "choir", 0.5, { transpose: 12, legato: 1, opt: { vowel: "ah", attack: 0.15 } }));
    out.push(...held(V, "organ", "organ", 0.6, { opt: { reg: "full", click: 0.2 } }));
    for (const b of [0, 4, 8, 12]) out.push(ev("bell", b * 4, 8, "churchbell", b === 8 ? 53 : 50, 0.5));
    const fig = ledger(FIGURES[cls].true, 62);                                   // the talk-out reads the true figure
    for (let k = 0, t = 0; t < 64; k++, t += 0.5) if (fig[k % 3] != null) out.push(ev("talk", t, 0.4, "harp", fig[k % 3], 0.45));
    out.push(...held(voicings({ ...L, chords: [{ at: 0, dur: 64, sym: "Dm" }] }, 52, 3, harm), "talk", "pad", 0.35, { opt: { attack: 2, cutoff: 1100 } }));
    return out;
  },
  adapt(s) {
    if (s.talking) return { pulse: -6, drums: null, toms: null, strings: null, bass: null, choir: null, organ: null, bell: null, chain: null, choir2: null, talk: 0 };
    const i = s.intensity ?? 0, two = (s.phase || 1) >= 2;
    return { pulse: 0, drums: i >= 0.25 ? 0 : null, toms: i >= 0.25 ? 0 : null, strings: i >= 0.45 ? 0 : null, bass: i >= 0.45 ? 0 : null,
      choir: i >= 0.7 ? 0 : null, organ: i >= 0.7 ? 0 : null, bell: i >= 0.7 ? 0 : null, chain: two ? 0 : null, choir2: two ? 0 : null, talk: null };
  },
  listen: {
    passes: 5, script: [{ bar: 0, set: { pulse: 0, drums: 0, toms: 0 }, bars: 0 }, { bar: 16, set: { strings: 0, bass: 0 }, bars: 1 }, { bar: 32, set: { choir: 0, organ: 0, bell: 0 }, bars: 1 },
      { bar: 48, set: { chain: 0, choir2: 0 }, bars: 1 }, { bar: 64, set: { pulse: -6, drums: null, toms: null, strings: null, bass: null, choir: null, organ: null, bell: null, chain: null, choir2: null, talk: 0 }, bars: 1 }],
  },
};
