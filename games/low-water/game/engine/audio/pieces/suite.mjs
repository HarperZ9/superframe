// The theme suite: the five themes of THEMES.md in one listen, each in its own tempo and its own
// arrangement, about three and a half minutes. The piece's clock runs at 60, so one beat is one second;
// each section is written in its theme's own beats and scaled into place.
import { ev } from "./kit.mjs";
import { melody, voicings, held, comp, walking, swing, ostinato, roots } from "./arrange.mjs";
import { layout, THEMES } from "../themes.mjs";

const place = (evs, t0, bpm) => evs.map((e) => ({ ...e, at: t0 + e.at * 60 / bpm, dur: e.dur * 60 / bpm }));
const trem = (evs) => evs.flatMap((e) => { const o = []; for (let t = 0; t < e.dur - 0.05; t += 0.125) o.push({ ...e, at: e.at + t, dur: 0.2, v: e.v * ((t * 8) % 2 ? 0.78 : 1), opt: { release: 0.03 } }); return o; });

const SECTIONS = {
  town: () => { const L = layout("town"); return [...melody(L, "lead", "ep", 0.55, { transpose: 12 }), ...held(voicings(L, 55, 4), "strings", "strings", 0.32, { opt: { attack: 0.8 } }), ...roots(L, "bass", "pad", 0.4, 38, "true", { opt: { cutoff: 500 } })]; },
  haldane: () => { const L = layout("haldane", { missing: ["Tomas"] }), V = voicings(L, 57, 4); return [...ostinato(V, "ep", "ep", 0.26), ...melody(L, "strings", "strings", 0.5, { opt: { attack: 0.25 } }), ...held(voicings(L, 50, 4), "pads", "pad", 0.32, { opt: { attack: 1.5 } })]; },
  kitchen: () => { const L = layout("kitchen", { sections: [0, 1] }), out = [...melody(L, "lead", "guitar", 0.55, { legato: 0.92, opt: { ring: true, t60: 3.2 } }), ...comp(voicings(L, 58, 4), "ep", "ep", 0.34, [0, 1.5], { len: 1.1 }).map(swing), ...walking(L, "bass", 0.7, 33), ...held(voicings(L, 50, 4), "pads", "pad", 0.3, { opt: { cutoff: 1300 } })]; for (let b = 0; b < L.bars; b++) for (const t of [1, 3]) out.push(ev("snaps", b * 4 + t, 0.5, "snap", 0, 0.55)); return out; },
  road: () => { const L = layout("road", { sections: [0] }); return [...trem(melody(L, "lead2", "mandolin", 0.5)), ...held(voicings(L, 52, 4), "strings", "strings", 0.3, { opt: { attack: 0.9 } })]; },
  captain: () => { const L = layout("captain"), V = voicings(L, 55, 4), out = [...melody(L, "choir", "choir", 0.6, { legato: 1, opt: { vowel: "ah", attack: 0.15 } }), ...melody(L, "choir", "choir", 0.45, { transpose: -7, legato: 1, opt: { vowel: "oh", attack: 0.15 } }), ...held(V, "organ", "organ", 0.55, { opt: { reg: "full", click: 0.2 } }), ...ostinato(V, "strings", "strings", 0.45, [0, 2, 1, 3, 2, 3, 1, 2], { len: 0.45, opt: { attack: 0.02, release: 0.15 } })];
    for (let b = 0; b < 16; b++) for (const [t, tune] of [[0, 62], [2, 58], [3, 52]]) out.push(ev("drums", b * 4 + t, 2, "tom", 0, t ? 0.55 : 0.8, { opt: { tune } }));
    return out; },
};
const ORDER = ["town", "haldane", "kitchen", "road", "captain"], GAP = 2.5;
// level per section, from the first render's measurements (the kitchen came out 8 dB over the others)
const TRIM = { town: 3, haldane: 3, kitchen: 0, road: 2, captain: -1 };

export function plan() {
  let t = 1;
  return ORDER.map((id) => { const T = THEMES[id], L = layout(id, id === "kitchen" ? { sections: [0, 1] } : {}), len = L.end * 60 / T.bpm, at = t; t += len + GAP; return { id, at, len, bpm: T.bpm }; });
}

export default {
  id: "suite", title: "The theme suite", place: null, lens: "none", bpm: 60, meter: 4, bars: 61, loop: false, harmonies: ["true"], target: -18, game: 0,
  stems: {
    lead: { room: "space", send: 0.3, dry: 0.9, autopan: [0.12, 0.2], gain: 0 },
    lead2: { room: "space", send: 0.4, dry: 0.85, gain: 0 },
    ep: { room: "space", send: 0.35, dry: 0.8, autopan: [0.18, 0.35], gain: -8 },
    strings: { room: "space", send: 0.45, dry: 0.75, width: 1.3, gain: -2 },
    pads: { room: "space", send: 0.45, width: 1.4, gain: -10 },
    bass: { room: "kitchen", send: 0.15, gain: -17 },
    snaps: { room: "kitchen", send: 0.35, gain: 10 },
    choir: { room: "space", send: 0.55, dry: 0.6, width: 1.3, gain: -24 },
    organ: { room: "space", send: 0.45, leslie: { fast: false }, gain: -14 },
    drums: { room: "granary", send: 0.35, gain: -8 },
    hum: { room: "road", send: 0.3, gain: -26 },
  },
  sections: plan().map((s) => [s.id, Math.round(s.at), Math.round(s.len), `${s.bpm} bpm`]),
  compose() {
    const out = [], P = plan();
    for (const s of P) out.push(...place(SECTIONS[s.id](), s.at, s.bpm).map((e) => ({ ...e, gain: (e.gain ?? 0) + TRIM[s.id] })));
    const road = P.find((s) => s.id === "road");
    out.push(ev("hum", road.at - 1, road.len + 2, "lamphum", 0, 0.6, { opt: { near: 0.5 } }));
    return out;
  },
  adapt() { return Object.fromEntries(Object.keys(this.stems).map((k) => [k, 0])); },
  listen: { passes: 1, script: [{ bar: 0, set: { lead: 0, lead2: 0, ep: 0, strings: 0, pads: 0, bass: 0, snaps: 0, choir: 0, organ: 0, drums: 0, hum: 0 }, bars: 0 }] },
};
