// The district office: the returns room and the meeting room where the figure is reported. 24 bars at 72,
// a loop. The notice press is the pulse; the ledger is a muted guitar spelling the reported figure digit by
// digit (0 a rest), three eighths to a figure against four beats, so it never sits on the bar; a sub drone
// on D; iron rubbed on the fifth. Form: intro (1-4) press and sub; A (5-12) the ledger; B (13-20) four
// low piano chords on the pedal and the iron; A' (21-24) the ledger and the press alone.
import { ev, tones, loopDrone, hand, dronePartials, lies } from "./kit.mjs";
import { n, ledger } from "../theory.mjs";

// the slice's figures (content/quota/q_office.lwd): what grew, and what was written
export const FIGURES = { inspector: { true: "205", lie: "290" }, militia: { true: "40", lie: "80" } };
const B_CHORDS = ["Dm9", "Bbmaj7/D", "Gm9/D", "A7sus4"];

function ledgerLine(fig, from, to) {
  const notes = ledger(fig, n("D4"), "dorian"), out = [];
  for (let k = 0, t = from * 4; t < to * 4; k++, t += 0.5) {
    const p = notes[k % notes.length];
    if (p != null) out.push(ev("ledger", t, 0.35, "guitar", p, k % notes.length ? 0.5 : 0.62, { opt: { release: 0.04, bright: 0.3, t60: 1.4 } }));
  }
  return out;
}

export default {
  id: "office", title: "The district office", place: "q.office", lens: "near", bpm: 72, meter: 4, bars: 24, loop: true,
  harmonies: ["true", "inflated", "blamed"], target: -18, game: -8,
  stems: {
    press: { room: "office", send: 0.35, gain: -6, lp: 6000 },
    sub: { harm: true, room: "space", send: 0.2, gain: -11 },
    ledger: { harm: true, room: "office", send: 0.3, dry: 0.9, tape: { wow: 0.0006, hiss: 0.0004 }, gain: -2 },
    piano: { harm: true, room: "space", send: 0.5, dry: 0.7, board: true, sympathetic: 0.006, gain: 8 },
    metal: { harm: true, room: "space", send: 0.5, gain: -5 },
  },
  sections: [["intro", 1, 4, "press and sub"], ["A", 5, 8, "the ledger"], ["B", 13, 8, "piano and iron"], ["A'", 21, 4, "ledger and press"]],
  compose({ harm, cls = "inspector" }) {
    const fig = FIGURES[cls][lies(harm) ? "lie" : "true"], h = hand("office", 2, 0.006, 0.05), out = [];
    for (let b = 0; b < this.bars; b++) if (b < 20 || b % 2 === 0) out.push(ev("press", b * 4, 2, "press", 0, 0.7));
    out.push(loopDrone("sub", "drone", n("D1"), this, 0.9, { partials: dronePartials(harm), sub: 0.6, beat: 0.05 }));
    out.push(...ledgerLine(fig, 4, 12), ...ledgerLine(fig, 20, 24));
    B_CHORDS.forEach((sym, i) => {
      const at = (12 + i * 2) * 4, t = tones(sym, 50, harm);
      t.slice(0, 2).forEach((p, k) => out.push(h(ev("piano", at + k * 0.04, 7.5, "piano", p, 0.34, { opt: { pedal: true } }))));
      out.push(h(ev("piano", at + 4, 3.5, "piano", t[t.length - 1] + 24, 0.22, { opt: { pedal: true } })));
    });
    out.push(ev("metal", 12 * 4, 32, "metal", lies(harm) ? n("Ab1") : n("A1"), 0.5, { opt: { attack: 5, release: 6 } }));
    return out;
  },
  adapt(s) { return { press: 0, sub: 0, ledger: 0, piano: s.lens === "near" ? 0 : null, metal: s.hunger > 0.4 ? 0 : -6 }; },
  // the author hears it true, then the figure written at bar 29 (the lie lands on the bar; two bars over)
  listen: { passes: 2, script: [{ bar: 0, set: { press: 0, sub: 0, ledger: 0, piano: 0, metal: 0 }, bars: 0 }, { bar: 29, harm: "inflated", bars: 2 }] },
};
