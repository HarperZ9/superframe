// The requisition road: the road theme (THEMES.md 4), 40 bars at 76, half-time, a loop. The requisition
// lamps hum at 100 Hz against the D minor of everything else (the diegetic signal). A doubled-course guitar
// in tremolo sings the tune; strings and a bass in the Brack drag come under it; a slow broken beat with
// iron in it; four bars of nothing but the hum and the wind where the cart is turned back; then the tune an
// octave up with the strings under it and a low choir, the cue's one release; then the hum alone.
// Form: A (1-8) tune and hum; B (9-16) the second half with beat and bass; break (17-20); A' (21-28) up an
// octave; B' (29-36) everything; outro (37-40).
import { ev, loopDrone, hand, dronePartials, bassNote } from "./kit.mjs";
import { melody, voicings, held } from "./arrange.mjs";
import { layout } from "../themes.mjs";

const sh = (L, b0) => ({ ...L, notes: L.notes.map((x) => ({ ...x, at: x.at + b0 * 4 })), chords: L.chords.map((c) => ({ ...c, at: c.at + b0 * 4 })) });

function tremolo(evs) {
  return evs.flatMap((e) => { const out = []; for (let t = 0; t < e.dur - 0.05; t += 0.125) out.push({ ...e, at: e.at + t, dur: 0.2, v: e.v * ((t * 8) % 2 ? 0.78 : 1), opt: { release: 0.03 } }); return out; });
}
function beat(b0, bars) {
  const out = [];
  for (let b = b0; b < b0 + bars; b++) {
    const at = b * 4;
    out.push(ev("drums", at, 1, "kick", 0, 0.75), ev("drums", at + 2.75, 1, "kick", 0, 0.45), ev("drums", at + 2, 1, "tap", 0, 0.6, { opt: { tune: 175 } }));
    for (const g of [1.5, 3.25, 3.75]) out.push(ev("drums", at + g, 1, "tap", 0, 0.16, { opt: { brush: true } }));
    for (let k = 0; k < 8; k++) out.push(ev("drums", at + k * 0.5, 0.5, "hat", 0, k % 2 ? 0.12 : 0.2));
    if (b % 2) out.push(ev("drums", at + 3.5, 1, "iron", 86, 0.2, { gain: -6 }));
  }
  return out;
}
// the Brack drag: the root on one, then again late and heavier on the and of three
const drag = (L, harm) => L.chords.flatMap((c) => { const p = bassNote(c.sym, 36, harm); return c.dur >= 4 ? [ev("bass", c.at, 2.3, "bass", p, 0.7), ev("bass", c.at + 2.5, 1.2, "bass", p, 0.88)] : [ev("bass", c.at, c.dur * 0.9, "bass", p, 0.75)]; });

export default {
  id: "road", title: "The requisition road", place: "q.post", lens: "near", bpm: 76, meter: 4, bars: 40, loop: true,
  harmonies: ["true", "inflated", "blamed"], target: -18, game: -7,
  stems: {
    hum: { room: "road", send: 0.3, gain: -22 },
    lament: { harm: true, room: "space", send: 0.45, dry: 0.8, tape: { wow: 0.0012, hiss: 0.0006 }, gain: 2 },
    strings: { harm: true, room: "space", send: 0.5, dry: 0.7, width: 1.3, gain: -4 },
    choir: { harm: true, room: "space", send: 0.7, dry: 0.4, width: 1.3, gain: -28 },
    drums: { room: "yard", send: 0.25, tape: { drive: 1.8, top: 9000, hiss: 0.0008 }, lp: 8000, gain: -3 },
    bass: { harm: true, room: "road", send: 0.15, gain: -1 },
    sub: { harm: true, room: "space", send: 0.2, gain: -10 },
    wind: { group: "amb", room: "road", send: 0.2, gain: -12 },
    cart: { group: "amb", room: "road", send: 0.3, gain: 5 },
  },
  sections: [["A", 1, 8, "tune and hum"], ["B", 9, 8, "beat and bass"], ["break", 17, 4, "hum and wind"], ["A'", 21, 8, "up an octave"], ["B'", 29, 8, "everything"], ["outro", 37, 4, "the hum"]],
  compose({ harm }) {
    const h = hand("road2", 4, 0.008, 0.06), out = [];
    const A = sh(layout("road", { sections: [0] }), 0), B = sh(layout("road", { sections: [1] }), 8), A2 = sh(layout("road", { sections: [0] }), 20), B2 = sh(layout("road", { sections: [1] }), 28);
    out.push(loopDrone("hum", "lamphum", 0, this, 0.7, { near: 0.6 }), loopDrone("wind", "wind", 0, this, 0.8, { rate: 0.13, whistle: 1700 }));
    out.push(loopDrone("sub", "drone", 26, this, 0.7, { partials: dronePartials(harm), sub: 0.5 }));
    for (const [L, v, tr] of [[A, 0.5, 0], [B, 0.48, 0], [A2, 0.45, 12], [B2, 0.5, 12]]) out.push(...tremolo(melody(L, "lament", "mandolin", v, { transpose: tr })).map(h));
    for (const [L, v] of [[A, 0.28], [B, 0.32], [A2, 0.4], [B2, 0.48]]) out.push(...held(voicings(L, 52, 4, harm), "strings", "strings", v, { opt: { attack: 0.9, release: 1.2 } }));
    out.push(...melody(A2, "strings", "strings", 0.42, { transpose: -12, opt: { attack: 0.3 } }), ...held(voicings(B2, 57, 3, harm), "choir", "choir", 0.5, { opt: { vowel: "oh", attack: 1 } }));
    out.push(...beat(8, 8), ...beat(20, 16), ...drag(B, harm), ...drag(A2, harm), ...drag(B2, harm));
    out.push(ev("cart", 16 * 4, 16, "cart", 0, 0.8, { opt: { speed: 0.5 } }));
    return out;
  },
  adapt(s) {
    return { hum: s.threat ? 0 : null, lament: 0, strings: s.hunger > 0.7 ? -6 : 0, choir: 0, drums: s.threat ? 0 : null, bass: s.threat ? 0 : -6, sub: 0, wind: -6 + 6 * (s.wind ?? 0.5), cart: 0 };
  },
  listen: { passes: 2, script: [{ bar: 0, set: { hum: 0, lament: 0, strings: 0, choir: 0, drums: 0, bass: 0, sub: 0, wind: 0, cart: 0 }, bars: 0 }, { bar: 48, harm: "blamed", bars: 2 }] },
};
