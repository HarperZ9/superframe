// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo: the room-meter audio to its modes.
   The audio is the room meter's own measurement path (the private study 2026-10-30-hardware-pipeline):
   a planted room of six modes (two of them 1 Hz apart) through the laptop speaker, air and mic twin,
   deconvolved, band-limited to 40 to 150 Hz. The transducer is the meter's matrix pencil, called through
   py/room_bridge.py (Python, numpy), so the field core crosses a language boundary here, and the ledger
   records the crossing like any other conversion.
   room.modes claims homomorphism: it keeps the planted modes (each within 0.2 Hz, decay within 15
   percent, the room study's own R1 gate). Its record (frequencies, decays, fitted amplitudes) is played
   back as the inverse, and the residual is coded at the 16-bit LSB, so the bits lost are measured. */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");
const F = require("../src/index.js");

const BRIDGE = path.join(__dirname, "..", "py", "room_bridge.py");
const py = (args, input) => JSON.parse(execFileSync("python", ["-I", BRIDGE, ...args], { input: input ? JSON.stringify(input) : undefined, maxBuffer: 1 << 28 }).toString());
const LSB = 1 / 32768;

const measureRoom = (seed) => {
  const m = py(["measure", String(seed)]);
  const f = F.make({ name: "room IR, seed " + seed, domain: { kind: "sequence", shape: [m.n], spacing: [{ step: 1 / m.fs, unit: "s" }] },
    values: Float64Array.from(m.h), unit: "1", sigma: null,
    prov: { status: "derived", source: "room twin: " + m.source + ", seed " + seed, method: "simulated measurement chain (twin), not a recording" },
    rep: { kind: "digital", rate: { value: m.fs, unit: "Hz" }, bits: 16, grain: LSB, encoding: "deconvolved float64 from a 16-bit ADC" } });
  return { field: f, meta: m };
};

const matchPlanted = (planted, fm, dm) => planted.map((p) => {
  if (!fm.length) return { f: p.f, found: null, ok: false };
  let i = 0;
  for (let k = 1; k < fm.length; k++) if (Math.abs(fm[k] - p.f) < Math.abs(fm[i] - p.f)) i = k;
  const df = fm[i] - p.f, de = dm[i] / p.decay_per_s - 1;
  return { f: p.f, found: fm[i], df, decay_err: de, ok: Math.abs(df) <= 0.2 && Math.abs(de) <= 0.15 };
});

const modesConv = (meta) => {
  let last = null;
  return F.converter({ id: "room.modes (matrix pencil, Python)", claims: "homomorphism", tol: LSB / 2,
    from: { domain: "sequence", unit: "1" }, to: { unit: "Hz" },
    forward: (f) => {
      last = py(["modes"], { h: Array.from(f.values), fs: meta.fs, band_hz: meta.band_hz, t60: meta.t60_nominal });
      return { values: Float64Array.from(last.modes_hz), domain: { kind: "sequence", shape: [last.modes_hz.length], record: last }, unit: "Hz", sigma: null,
        rep: { kind: "digital", encoding: "float64 mode list (f, decay, complex amplitude)" } };
    },
    inverse: (out) => Float64Array.from(out.domain.record.synth),
    keeps: { name: "planted modes within 0.2 Hz, decay within 15 %", check: (src, out) => {
      const rows = matchPlanted(meta.planted, out.domain.record.modes_hz, out.domain.record.decay_per_s);
      const spurious = out.values.length - new Set(rows.filter((r) => r.ok).map((r) => r.found)).size;
      return { ok: rows.every((r) => r.ok), detail: `${rows.filter((r) => r.ok).length} of ${rows.length} planted modes, ${spurious} other poles`, rows };
    } },
  });
};

const run = (seed = 20261031, sweep = [1, 2, 3, 4, 5, 20261030, 20261031]) => {
  const { field, meta } = measureRoom(seed);
  const out = F.apply(modesConv(meta), field, { strict: false });
  const hx = F.entropyOf(Array.from(field.values, (v) => Math.round(v / (LSB / 2)))) * field.values.length;
  const rows = sweep.map((s) => {
    const m = measureRoom(s), o = F.apply(modesConv(m.meta), m.field, { strict: false });
    return { seed: s, measured: o.verdict.measured, holds: o.verdict.holds, keeps: o.verdict.keeps.detail, bitsLostPerSample: o.verdict.bitsPerValue };
  });
  return { seed, n: field.values.length, fs: meta.fs, sourceBits: hx, verdict: out.verdict, modes_hz: Array.from(out.values),
    planted: meta.planted.map((p) => p.f), sweep: rows, all_six_rate: rows.filter((r) => r.holds).length + " of " + rows.length, field: out };
};

module.exports = { run, measureRoom, modesConv, matchPlanted };
