// The motif sheet: each leitmotif of SCORE.md section 4 played once, four bars each, for the author to
// learn by ear before the pieces. Linear, 40 bars at 60.
//   1-4 the Haldane bowls, five    5-8 four (Tomas's rest)    9-12 the ledger, 205 then 290
//   13-16 the Hesh: rain, heterophony, the rising end         17-20 the Vell: narrow chant, trills, fourths
//   21-24 the Furrowe fourth: era 1 major and dotted, era 2 minor and even      25-28 the Brack drag
//   29-32 the requisition lamps against D                     33-36 a dream: the bowls reversed, half speed
//   37-40 a premonition of era 5: sodium buzz and the bowls through a crushed sampler
import { ev } from "./kit.mjs";
import { n, haldane, ledger, rain, deg } from "../theory.mjs";

const P = { pedal: true };
const at = (bar, beat = 0) => bar * 4 + beat;

function bowls(out) {
  haldane(n("D5")).forEach((p, i) => out.push(ev("lead", at(0, i * 2.4), 2.8, "piano", p, 0.42, { opt: P })));
  haldane(n("D5"), ["Tomas"]).forEach((p, i) => p != null && out.push(ev("lead", at(4, i * 2.4), 2.8, "piano", p, 0.42, { opt: P })));
  for (const b of [0, 4]) out.push(ev("lead", at(b), 14, "piano", n("D3"), 0.25, { opt: P }), ev("lead", at(b, 0.05), 14, "piano", n("A3"), 0.2, { opt: P }));
}
function ledgers(out) {
  for (const [fig, b0] of [["205", 8], ["290", 10]]) {
    const notes = ledger(fig, n("D4"));
    for (let k = 0, t = 0; t < 8; k++, t += 0.5) if (notes[k % 3] != null) out.push(ev("lead", at(b0) + t, 0.35, "guitar", notes[k % 3], 0.55, { opt: { release: 0.04, bright: 0.3, t60: 1.4 } }));
  }
}
function hesh(out) {
  out.push(ev("lead", at(12), 6, "waterglass", n("A5"), 0.35));
  rain(n("A4")).forEach((p, i) => out.push(ev("lead", at(12, 1.6 + i * 0.12), 0.2, "harp", p, 0.3)));
  let t = at(12, 2);
  for (const [p, d] of [["A4", 2], ["B4", 1], ["A4", 1], ["G4", 2], ["E4", 2], ["F4", 1], ["G4", 4]]) {
    out.push(ev("lead", t, d * 0.95, "breathy", n(p), 0.5), ev("lead", t + 0.22, d * 0.8, "flute", n(p) + 12, 0.25, { gain: -8 }));
    t += d;
  }
}
function vell(out) {
  const L = (d) => deg(n("D4"), "vell", d);
  const line = [[1, 2], [2, 0.5], [3, 0.5], [4, 1], [3, 2], [2, 0.5], [1, 0.5], [2, 1], [4, 2], [3, 0.5], [4, 0.5], [3, 3]];
  let t = at(16);
  for (const [d, len] of line) {
    if (len >= 2) out.push(ev("lead", t, 0.12, "reed", L(d) + 2, 0.5), ev("lead", t + 0.12, 0.12, "reed", L(d), 0.5));   // the upper-neighbour turn
    out.push(ev("lead", t + (len >= 2 ? 0.24 : 0), len - (len >= 2 ? 0.24 : 0), "reed", L(d), 0.6));
    t += len;
  }
  for (const b of [16, 18]) out.push(ev("bed", at(b), 7.5, "organ", n("D3"), 0.5, { opt: { reg: "flute" } }), ev("bed", at(b), 7.5, "organ", n("G3"), 0.5, { opt: { reg: "flute" } }));
  out.push(ev("lead", at(19, 3), 2, "waterglass", n("F#6"), 0.25));
}
function furrowe(out) {
  const era1 = [["A3", 0, 1.5], ["D4", 1.5, 0.5], ["E4", 2, 1], ["F#4", 3, 1], ["A4", 4, 4]];
  const era2 = [["A3", 0, 1], ["D4", 1, 1], ["E4", 2, 1], ["F4", 3, 1], ["D4", 4, 4]];
  for (const [p, t, d] of era1) out.push(ev("lead", at(20) + t, d, "guitar", n(p), 0.55));
  for (const [p, t, d] of era2) out.push(ev("lead", at(22) + t, d, "guitar", n(p), 0.5));
}
function brack(out) {
  for (let b = 24; b < 28; b++) out.push(ev("lead", at(b), 2.3, "bass", n("G1"), 0.7), ev("lead", at(b, 2.5), 1.2, "bass", n("G1"), 0.9), ev("lead", at(b, 2.5), 3, "piano", n("D3"), 0.2, { opt: P }));
}
function lamps(out) { out.push(ev("bed", at(28), 16, "drone", n("D2"), 0.8, { opt: { attack: 1, release: 2 } }), ev("fx", at(28, 1), 15, "lamphum", 0, 0.6, { opt: { near: 0.7 } })); }
function dream(out) {
  haldane(n("D5")).forEach((p, i) => out.push(ev("fx", at(32, i * 1.4), 3, "piano", p, 0.4, { opt: { ...P, reverse: true, rate: 0.5 } })));
}
function sodium(out) {
  out.push(ev("fx", at(36), 16, "lamphum", 0, 0.5, { opt: { near: 1, hz: 100 } }));
  haldane(n("D5"), ["Tomas", "Aaron"]).forEach((p, i) => p != null && out.push(ev("fx", at(36, 1 + i * 2.5), 2, "piano", p, 0.5, { opt: { crush: [6, 7] } })));
}

export default {
  id: "motifs", title: "The motif sheet", place: null, lens: "none", bpm: 60, meter: 4, bars: 40, loop: false, harmonies: ["true"], target: -18, game: 0,
  stems: { lead: { room: "space", send: 0.35, dry: 0.9 }, bed: { room: "space", send: 0.4, gain: -6 }, fx: { room: "space", send: 0.6, dry: 0.6, gain: -2 }, sub: { room: "space", send: 0.2, gain: -12 } },
  compose() {
    const out = [ev("sub", at(8), 16, "drone", n("D1"), 0.8, { opt: { sub: 0.5, attack: 1, release: 2 } })];
    for (const f of [bowls, ledgers, hesh, vell, furrowe, brack, lamps, dream, sodium]) f(out);
    return out;
  },
  adapt() { return { lead: 0, bed: 0, fx: 0, sub: 0 }; },
  listen: { passes: 1, script: [{ bar: 0, set: { lead: 0, bed: 0, fx: 0, sub: 0 }, bars: 0 }] },
};
