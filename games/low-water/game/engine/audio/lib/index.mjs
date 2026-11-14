// render-sound/instruments: a zero-dependency instrument library. Every instrument is a function of
// (pitch, duration, velocity, seed, options) that returns samples (mono Float32Array, or [left, right] for
// the ensemble instruments). One seed gives one render, bit for bit, in Node and in a browser worker.
export * from "./dsp.mjs";
export { fft, convolve, spectrum, nextPow2 } from "./fft.mjs";
export { pitchOf, centsOff, loudness, truePeak, clipped, seam } from "./analysis.mjs";
export { ROOMS, makeIR } from "./ir.mjs";
export { tape, echo, leslie, tremolo, autopan, width, reverse, varispeed, crush, airbed } from "./fx.mjs";
export { pluck, string, PLUCK, woodIR } from "./inst/pluck.mjs";
export { partials, vessel, VESSELS } from "./inst/modal.mjs";
export { piano, pianoB, pianoT60, soundboardIR, sympathetic } from "./inst/piano.mjs";
export { wind, WIND } from "./inst/wind.mjs";
export { sweep, tap, kick, ride, hat, crate, snap, tom } from "./inst/drums.mjs";
export { organ, REGISTRATIONS } from "./inst/organ.mjs";
export { drone, metal, breath, hum } from "./inst/pad.mjs";
export { pad, strings, choir } from "./inst/synth.mjs";
export { ep } from "./inst/ep.mjs";
