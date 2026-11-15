// One table from an event's instrument name to the function that renders it, so a score names
// instruments and never imports synthesis code. An event: { inst, p (MIDI), dur (s), v, seed, opt }.
// Returns mono samples. opt.reverse, opt.rate (varispeed) and opt.crush apply to any instrument.
import { mtof } from "./lib/dsp.mjs";
import { pluck } from "./lib/inst/pluck.mjs";
import { vessel } from "./lib/inst/modal.mjs";
import { piano } from "./lib/inst/piano.mjs";
import { wind } from "./lib/inst/wind.mjs";
import { sweep, tap, kick, ride, hat, crate, snap, tom } from "./lib/inst/drums.mjs";
import { pad, strings, choir } from "./lib/inst/synth.mjs";
import { ep } from "./lib/inst/ep.mjs";
import { organ } from "./lib/inst/organ.mjs";
import { drone, metal, breath, hum } from "./lib/inst/pad.mjs";
import { reverse, varispeed, crush } from "./lib/fx.mjs";
import { SFX } from "./sfx/index.mjs";

const plucked = (preset) => (e) => pluck(mtof(e.p), e.dur, e.v, preset, e.seed, e.opt);
const blown = (preset) => (e) => wind(mtof(e.p), e.dur, e.v, preset, e.seed, e.opt);
const struck = (kind) => (e) => vessel(kind, mtof(e.p), e.v, e.seed, e.opt);

export const VOICES = {
  harp: plucked("harp"), guitar: plucked("guitar"), mandolin: plucked("mandolin"), bass: plucked("bass"),
  piano: (e) => piano(e.p, e.dur, e.v, e.seed, e.opt),
  flute: blown("flute"), breathy: blown("breathy"), reed: blown("reed"),
  churchbell: struck("churchbell"), handbell: struck("handbell"), bowl: struck("bowl"), woodbowl: struck("woodbowl"),
  waterglass: struck("waterglass"), iron: struck("iron"),
  organ: (e) => organ(e.p, e.dur, e.v, e.seed, e.opt),
  drone: (e) => drone(mtof(e.p), e.dur, e.v, e.seed, e.opt),
  metal: (e) => metal(mtof(e.p), e.dur, e.v, e.seed, e.opt),
  hum: (e) => hum(mtof(e.p), e.dur, e.v, e.seed, e.opt),
  breath: (e) => breath(e.dur, e.v, e.seed, e.opt),
  sweep: (e) => sweep(e.dur, e.v, e.seed, e.opt), tap: (e) => tap(e.v, e.seed, e.opt), kick: (e) => kick(e.v, e.seed, e.opt),
  ride: (e) => ride(e.v, e.seed, e.opt), snap: (e) => snap(e.v, e.seed), tom: (e) => tom(e.v, e.seed, e.opt),
  ep: (e) => ep(e.p, e.dur, e.v, e.seed, e.opt), pad: (e) => pad(e.p, e.dur, e.v, e.seed, e.opt),
  strings: (e) => strings(e.p, e.dur, e.v, e.seed, e.opt), choir: (e) => choir(e.p, e.dur, e.v, e.seed, e.opt), hat: (e) => hat(e.v, e.seed, e.opt), crate: (e) => crate(e.v, e.seed, e.opt),
};

export function voice(e) {
  const fn = VOICES[e.inst] || (SFX[e.inst] && ((x) => SFX[x.inst](x.dur, x.v, x.seed, x.opt || {}, x.p)));
  if (!fn) throw new Error(`no instrument: ${e.inst}`);
  let buf = fn({ ...e, opt: e.opt || {} });
  const o = e.opt || {};
  const each = (f) => (buf = Array.isArray(buf) ? buf.map(f) : f(buf));
  if (o.crush) each((c) => crush(c, o.crush[0], o.crush[1]));
  if (o.rate) each((c) => varispeed(c, o.rate));
  if (o.reverse) each(reverse);
  return buf;
}
