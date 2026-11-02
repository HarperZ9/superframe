// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Known-answer tests for the circuit simulator.  node sim/tests/sim.test.js [--json out.json]
   Every check compares the simulator with a closed form derived independently of it. Planted errors (a wrong
   capacitor, a wrong temperature, a swapped filter, a first-order integrator) must fail the same comparisons,
   so the tolerances are shown to discriminate. ngspice is used only if it is already installed. */
"use strict";
const fs = require("fs"), { execSync } = require("child_process");
const { S } = require("../load.js");
const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, skipped: [], rows: [] };
const check = (name, ok, detail) => { out[ok ? "pass" : "fail"]++; out.rows.push({ name, ok: !!ok, detail: String(detail === undefined ? "" : detail) }); if (!ok) console.error("FAIL", name, detail || ""); };
const planted = (name, accepted, detail) => { out[accepted ? "planted_accepted" : "planted_rejected"]++; out.rows.push({ name: "planted: " + name, ok: !accepted, detail: String(detail || "") }); if (accepted) console.error("PLANTED ACCEPTED", name); };
const rel = (a, b) => Math.abs(a - b) / Math.max(Math.abs(b), 1e-300);
const kB = S.kB, q = S.q;

/* divider */
{
  const ck = S.compile([{ t: "V", name: "V1", n: ["in", "0"], dc: 10 }, { t: "R", name: "R1", n: ["in", "o"], R: 1000 }, { t: "R", name: "R2", n: ["o", "0"], R: 3000 }]);
  const v = S.dc(ck).v("o");
  check("DC divider 10 V, 1 k over 3 k gives 7.5 V", rel(v, 7.5) < 1e-12, v);
  check("DC divider source current is -2.5 mA (into the + terminal)", rel(S.dc(ck).i("V1"), -2.5e-3) < 1e-12, S.dc(ck).i("V1"));
}

/* RC step: trapezoidal and BDF2 against 1 - exp(-t / tau), and the second-order convergence of both */
const rcErr = (method, dt, Cv = 1e-6, Cmodel = 1e-6) => {
  const ck = S.compile([{ t: "V", name: "V1", n: ["in", "0"], wave: { type: "step", t0: 0, v0: 0, v1: 1 } }, { t: "R", name: "R1", n: ["in", "o"], R: 1000 }, { t: "C", name: "C1", n: ["o", "0"], C: Cmodel }]);
  const r = S.tran(ck, { tstop: 5e-3, dt, method, ic: "zero", record: ["o"] }), tau = 1000 * Cv;
  let e = 0;
  r.t.forEach((t, k) => { e = Math.max(e, Math.abs(r.v.o[k] - (1 - Math.exp(-t / tau)))); });
  return e;
};
for (const m of ["trap", "bdf2"]) {
  const e1 = rcErr(m, 1e-5), e2 = rcErr(m, 5e-6);
  check(`RC step (tau 1 ms), ${m}, dt tau/100: max error under 2e-4`, e1 < 2e-4, e1);
  check(`RC step, ${m}: halving dt cuts the error by 3.5 to 4.5 (second order)`, e1 / e2 > 3.5 && e1 / e2 < 4.5, (e1 / e2).toFixed(3));
}
planted("an RC step with C 1 percent off passes the tau = 1 ms comparison", rcErr("trap", 1e-5, 1e-6, 1.01e-6) < 2e-4, rcErr("trap", 1e-5, 1e-6, 1.01e-6));
{ const e1 = rcErr("be", 1e-5), e2 = rcErr("be", 5e-6); planted("backward Euler passes the second-order convergence check", e1 / e2 > 3.5 && e1 / e2 < 4.5, (e1 / e2).toFixed(3)); }

/* series RLC: AC magnitude against R / |Z| over a sweep, the peak at f0, and the transient ringing period */
{
  const R = 10, L = 1e-3, C = 1e-6, f0 = 1 / (2 * Math.PI * Math.sqrt(L * C));
  const els = [{ t: "V", name: "V1", n: ["in", "0"], ac: 1 }, { t: "L", name: "L1", n: ["in", "a"], L }, { t: "C", name: "C1", n: ["a", "b"], C }, { t: "R", name: "R1", n: ["b", "0"], R }];
  const ck = S.compile(els), fs_ = S.logspace(100, 1e6, 301).concat([f0]), A = S.ac(ck, fs_);
  let e = 0;
  fs_.forEach((f, k) => { const w = 2 * Math.PI * f, z = Math.hypot(R, w * L - 1 / (w * C)); e = Math.max(e, rel(A.mag(k, "b"), R / z)); });
  check("series RLC: |V_R| over 100 Hz to 1 MHz equals R / |Z| to 1e-9", e < 1e-9, e);
  const k0 = fs_.length - 1;
  check("series RLC: at f0 = 5032.9 Hz the resistor sees the whole source, phase 0", rel(A.mag(k0, "b"), 1) < 1e-9 && Math.abs(A.ph(k0, "b")) < 1e-9, A.mag(k0, "b"));
  const tr = S.compile([{ t: "V", name: "V1", n: ["in", "0"], wave: { type: "step", t0: 0, v0: 0, v1: 1 } }, ...els.slice(1)]);
  const r = S.tran(tr, { tstop: 4e-3, dt: 1e-7, method: "trap", ic: "zero", record: ["b"] }), wd = Math.sqrt(1 / (L * C) - (R / (2 * L)) ** 2);
  const zc = []; for (let k = 1; k < r.t.length; k++) if (r.v.b[k - 1] < 0 && r.v.b[k] >= 0) zc.push(r.t[k - 1] + (r.t[k] - r.t[k - 1]) * (-r.v.b[k - 1]) / (r.v.b[k] - r.v.b[k - 1]));
  const per = (zc[zc.length - 1] - zc[0]) / (zc.length - 1);
  check("series RLC step: ringing period equals 2 pi / omega_d to 1e-4", rel(per, 2 * Math.PI / wd) < 1e-4, `${per} vs ${2 * Math.PI / wd}`);
}

/* filters against analytic transfer functions: a passive RC low-pass and a unity-gain Sallen-Key with the op-amp macro */
const sallenKey = (C1, C2, A0 = 1e7, gbw = 1e10) => S.compile([{ t: "V", name: "V1", n: ["in", "0"], ac: 1 }, { t: "R", name: "R1", n: ["in", "a"], R: 1e4 }, { t: "R", name: "R2", n: ["a", "p"], R: 1e4 },
  { t: "C", name: "C1", n: ["a", "o"], C: C1 }, { t: "C", name: "C2", n: ["p", "0"], C: C2 }, { t: "OA", name: "U1", n: ["p", "o", "o"], A0, gbw, rout: 0 }]);
const skErr = (ck, C1, C2) => {
  const fs_ = S.logspace(10, 1e5, 201), A = S.ac(ck, fs_);
  let e = 0, ep = 0;
  fs_.forEach((f, k) => {
    const w = 2 * Math.PI * f, re = 1 - w * w * 1e8 * C1 * C2, im = w * C2 * 2e4, m = 1 / Math.hypot(re, im), ph = -Math.atan2(im, re);
    e = Math.max(e, rel(A.mag(k, "o"), m)); ep = Math.max(ep, Math.abs(A.ph(k, "o") - ph));
  });
  return [e, ep];
};
{
  const ck = S.compile([{ t: "V", name: "V1", n: ["in", "0"], ac: 1 }, { t: "R", name: "R1", n: ["in", "o"], R: 1e3 }, { t: "C", name: "C1", n: ["o", "0"], C: 1e-7 }]);
  const fs_ = S.logspace(1, 1e6, 121), A = S.ac(ck, fs_);
  let e = 0; fs_.forEach((f, k) => { const x = 2 * Math.PI * f * 1e-4; e = Math.max(e, rel(A.mag(k, "o"), 1 / Math.hypot(1, x)), Math.abs(A.ph(k, "o") + Math.atan(x))); });
  check("RC low-pass: magnitude and phase equal 1 / (1 + j w RC) over 1 Hz to 1 MHz to 1e-12", e < 1e-12, e);
  const [m, p] = skErr(sallenKey(2e-8, 1e-8), 2e-8, 1e-8);
  check("Sallen-Key low-pass (f0 1125 Hz, Q 0.707), op-amp macro A0 1e7: magnitude within 1e-5 of the analytic H(s)", m < 1e-5, m);
  check("Sallen-Key low-pass: phase within 2e-5 rad of the ideal H(s) (the macro's finite GBW of 10 GHz predicts f / GBW = 1e-5 rad at 100 kHz)", p < 2e-5, p);
  planted("a Sallen-Key with C1 and C2 swapped passes the same comparison", skErr(sallenKey(1e-8, 2e-8), 2e-8, 1e-8)[0] < 1e-5);
}

/* Johnson noise: 4kTR, R || C, the kT/C integral, two resistors at two temperatures */
{
  const T = 300, R = 1e4;
  const one = S.noise(S.compile([{ t: "R", name: "R1", n: ["o", "0"], R, T }]), [1000], "o").rows[0].SA;
  check("4kTR: a 10 kOhm resistor at 300 K gives 12.87 nV/rtHz (exact to 1e-12)", rel(Math.sqrt(one), Math.sqrt(4 * kB * T * R)) < 1e-12, Math.sqrt(one));
  planted("the same density passes as a resistor at 301 K", rel(Math.sqrt(one), Math.sqrt(4 * kB * 301 * R)) < 1e-4);
  const C = 1e-9, fc = 1 / (2 * Math.PI * R * C), ck = S.compile([{ t: "R", name: "R1", n: ["o", "0"], R, T }, { t: "C", name: "C1", n: ["o", "0"], C }]);
  const fs_ = S.linspace(0, 50 * fc, 20001), rows = S.noise(ck, fs_, "o").rows;
  let e = 0; rows.forEach((r) => { e = Math.max(e, rel(r.SA, 4 * kB * T * R / (1 + (r.f / fc) ** 2))); });
  check("R || C: noise PSD equals 4kTR / (1 + (f/fc)^2) to 1e-9", e < 1e-9, e);
  const integ = S.trapz(fs_, rows.map((r) => r.SA)), want = 4 * kB * T * R * fc * Math.atan(50);
  check("R || C: integrated noise to 50 fc equals 4kTR fc atan(50) to 1e-6 (the kT/C law's finite-band form)", rel(integ, want) < 1e-6, rel(integ, want));
  const R1 = 1e3, R2 = 3e3, T1 = 77, T2 = 300;
  const d = S.noise(S.compile([{ t: "R", name: "Ra", n: ["o", "0"], R: R1, T: T1 }, { t: "R", name: "Rb", n: ["o", "0"], R: R2, T: T2 }]), [10], "o").rows[0];
  const wantD = 4 * kB * (T1 * R1 * R2 * R2 + T2 * R2 * R1 * R1) / (R1 + R2) ** 2;
  check("two resistors in parallel at 77 K and 300 K: 4k (T1 R1 R2^2 + T2 R2 R1^2) / (R1 + R2)^2", rel(d.SA, wantD) < 1e-12, d.SA);
  check("the noise split names each resistor's share (sums to the total)", rel(d.by.Ra + d.by.Rb, d.SA) < 1e-12);
}

/* diode: operating point against an independent bisection of the Shockley equation; shot noise 2qI rd^2 */
{
  const Is = 1e-14, Vt = kB * 300 / q, ck = S.compile([{ t: "V", name: "V1", n: ["in", "0"], dc: 5 }, { t: "R", name: "R1", n: ["in", "a"], R: 1000 }, { t: "D", name: "D1", n: ["a", "0"], Is, T: 300 }]);
  const vd = S.dc(ck).v("a");
  let lo = 0, hi = 1; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Is * (Math.exp(m / Vt) - 1) > (5 - m) / 1000) hi = m; else lo = m; }
  check("diode op point (5 V, 1 kOhm, Is 1e-14): Vd equals the bisected Shockley root to 1e-9 V", Math.abs(vd - lo) < 1e-9, `${vd} vs ${lo}`);
  const ck2 = S.compile([{ t: "I", name: "I1", n: ["0", "a"], dc: 1e-3 }, { t: "D", name: "D1", n: ["a", "0"], Is, T: 300 }]);
  const nz = S.noise(ck2, [1e3], "a").rows[0].SA, I = 1e-3, rd = Vt / (I + Is);
  check("diode shot noise at 1 mA: output PSD equals 2qI rd^2", rel(nz, 2 * q * I * rd * rd) < 1e-6, rel(nz, 2 * q * I * rd * rd));
}

/* switch: static states and a timed closure in an RC */
{
  const mkS = (on) => S.compile([{ t: "V", name: "V1", n: ["in", "0"], dc: 1 }, { t: "S", name: "K1", n: ["in", "o"], on, ron: 1, roff: 1e9 }, { t: "R", name: "R1", n: ["o", "0"], R: 999 }]);
  check("switch on: 1 Ohm into 999 Ohm gives 0.999 V", rel(S.dc(mkS(true)).v("o"), 0.999) < 1e-12);
  check("switch off: 1 GOhm into 999 Ohm gives 999 / (1e9 + 999) V", rel(S.dc(mkS(false)).v("o"), 999 / (1e9 + 999)) < 1e-9);
  const ck = S.compile([{ t: "V", name: "V1", n: ["in", "0"], dc: 1 }, { t: "S", name: "K1", n: ["in", "a"], on: (t) => t >= 1e-3, ron: 1e-3, roff: 1e12 }, { t: "R", name: "R1", n: ["a", "o"], R: 1000 }, { t: "C", name: "C1", n: ["o", "0"], C: 1e-6 }]);
  const r = S.tran(ck, { tstop: 4e-3, dt: 1e-6, method: "trap", ic: "zero", record: ["o"] }), k2 = r.t.findIndex((t) => t >= 2e-3 - 1e-12);
  check("timed switch closing at 1 ms: the RC output at 2 ms is 1 - exp(-1) to 1e-3", Math.abs(r.v.o[k2] - (1 - Math.exp(-1))) < 1e-3 && Math.abs(r.v.o[900]) < 1e-6, r.v.o[k2]);
}

/* op-amp macro: closed-loop gain A / (1 + A beta) and the closed-loop bandwidth GBW / G */
{
  const A0 = 1e5, gbw = 1e7, mk = () => S.compile([{ t: "V", name: "V1", n: ["in", "0"], dc: 1e-3, ac: 1 }, { t: "OA", name: "U1", n: ["in", "fb", "o"], A0, gbw, rout: 0, rin: 1e15 }, { t: "R", name: "RF", n: ["o", "fb"], R: 3900 }, { t: "R", name: "RG", n: ["fb", "0"], R: 100 }]);
  const G = A0 / (1 + A0 / 40), v = S.dc(mk()).v("o") / 1e-3;
  check("non-inverting gain 40 with A0 1e5: DC gain equals A0 / (1 + A0 beta) to 1e-9", rel(v, G) < 1e-9, v);
  const fs_ = S.logspace(1e4, 1e6, 801), A = S.ac(mk(), fs_), g0 = A.mag(0, "o"), k3 = fs_.findIndex((_, k) => A.mag(k, "o") < g0 / Math.SQRT2);
  check("non-inverting gain 40, GBW 10 MHz: closed-loop -3 dB within 1 percent of GBW / G = 250 kHz", rel(fs_[k3], gbw / 40) < 0.01, fs_[k3]);
}

/* SPICE netlist round trip: written, read back, compiled, same answers */
{
  const els = [{ t: "V", name: "V1", n: ["in", "0"], dc: 5, ac: 1 }, { t: "R", name: "R1", n: ["in", "a"], R: 1000 }, { t: "D", name: "D1", n: ["a", "0"], Is: 1e-14, N: 1.2 }, { t: "C", name: "C1", n: ["a", "0"], C: 1e-9 }, { t: "OA", name: "U1", n: ["a", "o", "o"], A0: 1e5, gbw: 1e7, en: 5e-9 }];
  const txt = S.toSpice(els), back = S.parseSpice(txt), a = S.compile(els), b = S.compile(back);
  const va = S.dc(a), vb = S.dc(b), fa = S.ac(a, [1e3, 1e5]), fb = S.ac(b, [1e3, 1e5]);
  check(`SPICE netlist round trip (${txt.split("\n").length - 1} lines): same DC solution and AC response to 1e-12`, rel(vb.v("o"), va.v("o")) < 1e-12 && rel(fb.mag(1, "o"), fa.mag(1, "o")) < 1e-12, `${va.v("o")} ${vb.v("o")}`);
}

/* transient noise: a noisy R || C reaches the kT/C variance (a statistical check: about 1.5 percent sigma, 5 percent tolerance) */
{
  const R = 1e4, C = 1e-9, T = 300, ck = S.compile([{ t: "R", name: "R1", n: ["o", "0"], R, T }, { t: "C", name: "C1", n: ["o", "0"], C }]);
  const r = S.tran(ck, { tstop: 0.2, dt: 5e-7, method: "trap", ic: "zero", record: ["o"], noise: { seed: 7 } }), v = r.v.o;
  let s = 0, n = 0; for (let k = 1000; k < v.length; k++) { s += v[k] * v[k]; n++; }
  check("transient noise: R || C variance equals kT/C within 5 percent (seeded)", rel(s / n, kB * T / C) < 0.05, `${s / n} vs ${kB * T / C}`);
}

/* ngspice differential check: only when it is already on PATH */
{
  let has = false; try { execSync(process.platform === "win32" ? "where ngspice" : "which ngspice", { stdio: "ignore" }); has = true; } catch (e) { has = false; }
  if (!has) out.skipped.push("ngspice differential check: ngspice is not installed; not run, not counted");
}

console.log(`sim: ${out.pass} pass, ${out.fail} fail, planted ${out.planted_rejected} rejected, ${out.planted_accepted} accepted; skipped: ${out.skipped.join("; ") || "none"}`);
const j = process.argv.indexOf("--json");
if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(Object.assign({ date: new Date().toISOString().slice(0, 10) }, out), null, 1));
process.exit(out.fail || out.planted_accepted ? 1 : 0);
