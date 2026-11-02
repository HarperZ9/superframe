// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* The thermometer's simulated budget: filter response, Re Z, the noise budget term by term, the high-pass
   settle, and a seeded transient-noise thermometry run that reads the temperature back from the simulated
   outputs the way the instrument does (cross-spectrum of the two chains, ratio against the ice-point resistor).
   Each number sits beside the spec sheet's hand-derived value from cad/instruments/jnt.js. */
"use strict";
const { S } = require("./load.js");
const { circuit, ASSUMED } = require("./jnt.js");

const gain = (R, opt = {}) => {
  const ck = S.compile(circuit(R, Object.assign({ k1: "none", k3: true, inject: { dc: 0, ac: 1 } }, opt)));
  const fs = S.logspace(10, 1e6, 401), A = S.ac(ck, fs), mag = fs.map((_, k) => A.mag(k, "OUT_A")), magB = fs.map((_, k) => A.mag(k, "OUT_B"));
  const at = (f) => { const a = S.ac(ck, [f], { op: A.op }); return a.mag(0, "OUT_A"); };
  const peak = Math.max(...mag), lo3 = fs.find((f, k) => mag[k] >= peak / Math.SQRT2), hi3 = fs.slice().reverse().find((f, k) => mag[fs.length - 1 - k] >= peak / Math.SQRT2);
  const C1 = ck.elements.find((e) => e.name === "C1").C, RB1 = ck.elements.find((e) => e.name === "RB1").R;
  return { fs, mag, magB, peak, lo3, hi3, g1k: at(1000), g3k: at(3000), g10k: at(R.p.fHi), fHPnet: 1 / (2 * Math.PI * C1 * RB1) };
};

const reZ = (R, f, opt = {}) => {
  const els = circuit(R, Object.assign({ k1: "sense" }, opt)).concat([{ t: "I", name: "ITEST", n: ["0", "IN"], dc: 0, ac: 1 }]);
  const a = S.ac(S.compile(els), [f]), [re] = a.at(0, "IN");
  return re / R.p.R;
};

const budget = (R, opt = {}) => {
  const ck = S.compile(circuit(R, Object.assign({ k1: "sense" }, opt))), fs = S.linspace(R.inst.fixed.fLo, R.p.fHi, 181);
  const rows = S.noise(ck, fs, "OUT_A", "OUT_B").rows, I = (fn) => S.trapz(fs, rows.map(fn));
  const SR = I((r) => r.by.R1), SA = I((r) => r.SA), SB = I((r) => r.SB), X = I((r) => r.Xr), XR = I((r) => r.byX.R1);
  const terms = {};
  const corrTerms = {};
  for (const g of Object.keys(rows[0].by)) { terms[g] = I((r) => r.by[g]) / SR; corrTerms[g] = I((r) => r.byX[g] || 0) / XR; }
  const B = R.p.fHi - R.inst.fixed.fLo, SAB = I((r) => r.SA * r.SB), t = R.p.tAvg;
  return {
    a: (SA - SR) / SR, corr: (X - XR) / XR, terms, corrTerms,
    relSpecForm: (Math.sqrt(SA * SB) / X) / Math.sqrt(B * t),
    relCross: Math.sqrt((SAB + I((r) => r.Xr * r.Xr - r.Xi * r.Xi)) / (2 * t)) / X,
    outRms: Math.sqrt(S.trapz(S.linspace(10, R.inst.fixed.adcBand, 400), S.noise(ck, S.linspace(10, R.inst.fixed.adcBand, 400), "OUT_A").rows.map((r) => r.SA))),
    eRin: Math.sqrt(rows[0].by.R1 / (gain(R).g1k ** 2)),
  };
};

/* high-pass settle: a 1 uV step injected at INJ; time from the output's peak until it stays within 0.1 percent of it */
const settle = (R) => {
  const ck = S.compile(circuit(R, { k1: "none", k3: true, inject: { dc: 0, wave: { type: "step", t0: 1e-4, v0: 0, v1: 1e-6 } } }));
  const r = S.tran(ck, { tstop: 0.012, dt: 1e-6, method: "bdf2", record: ["OUT_A"] }), v = r.v.OUT_A;
  let kp = 0; for (let k = 0; k < v.length; k++) if (Math.abs(v[k]) > Math.abs(v[kp])) kp = k;
  let ks = v.length - 1; while (ks > kp && Math.abs(v[ks]) < 1e-3 * Math.abs(v[kp])) ks--;
  return { peak: v[kp], tPeak: r.t[kp], settle: r.t[ks + 1] - r.t[kp], trace: { t: Array.from(r.t.filter((_, k) => k % 40 === 0)), v: Array.from(v.filter((_, k) => k % 40 === 0)) } };
};

/* Transient-noise thermometry. Both chains are simulated with every noise source as seeded white samples; the
   cross-spectrum of OUT_A and OUT_B over the band, sense run over ice-point run, times 273.15 K, is the reading. */
const thermometry = async (R, opt = {}) => {
  const { fft } = await import("../../../sound/sound/dsp.js");
  const fsamp = opt.fs || 80000, nseg = opt.nseg || 128, L = opt.seg || 4096, dt = 1 / fsamp, F = R.inst.fixed;
  const run = (k1, seed) => S.tran(S.compile(circuit(R, { k1 })), { tstop: (nseg * L + 2000) * dt, dt, method: "bdf2", record: ["OUT_A", "OUT_B"], noise: { seed } });
  const lo = Math.ceil(F.fLo * L / fsamp), hi = Math.floor(R.p.fHi * L / fsamp);
  const csd = (r) => {
    const seg = [];
    for (let s = 0; s < nseg; s++) {
      const o = 2000 + s * L, ar = new Float64Array(L), ai = new Float64Array(L), br = new Float64Array(L), bi = new Float64Array(L);
      for (let k = 0; k < L; k++) { ar[k] = r.v.OUT_A[o + k]; br[k] = r.v.OUT_B[o + k]; }
      fft(ar, ai); fft(br, bi);
      let x = 0, pa = 0; for (let b = lo; b <= hi; b++) { x += ar[b] * br[b] + ai[b] * bi[b]; pa += ar[b] * ar[b] + ai[b] * ai[b]; }
      seg.push({ x, pa });
    }
    return seg;
  };
  const sSense = csd(run("sense", opt.seed || 11)), sRef = csd(run("ref", (opt.seed || 11) + 1000));
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length, sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
  const xs = sSense.map((s) => s.x), xr = sRef.map((s) => s.x), T = 273.15 * mean(xs) / mean(xr);
  const relSeg = sd(xs) / mean(xs), relRef = sd(xr) / mean(xr), sigmaT = T * Math.sqrt(relSeg ** 2 + relRef ** 2) / Math.sqrt(nseg);
  const Bseg = (hi - lo + 1) * fsamp / L, tseg = L / fsamp, aSeg = mean(sSense.map((s) => s.pa)) / mean(xs) - 1;
  return { T, sigmaT, Ttrue: opt.T || R.p.T, nseg, tseg, Bseg, relSeg, relSegSpecForm: (1 + aSeg) / Math.sqrt(Bseg * tseg), relSegCross: Math.sqrt(((1 + aSeg) ** 2 + 1) / (2 * Bseg * tseg)), aSeg, simSeconds: 2 * (nseg * L + 2000) * dt };
};

module.exports = { gain, reZ, budget, settle, thermometry, ASSUMED };
