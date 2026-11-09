// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* The thermometer's simulated chain against its spec sheet.  node sim/tests/jnt.test.js [--json out.json]
   The spec sheet's numbers are hand-derived in cad/instruments/jnt.js; the simulation is built from the same
   model's netlist. Where the two must differ (finite op-amp gain, relay contact, gain-resistor noise) the test
   names the cause and checks the difference against its own closed form, so the gap is explained, not absorbed. */
"use strict";
const fs = require("fs");
const { C } = require("../../cad/load.js");
const J = require("../jnt-chain.js");
const { S } = require("../load.js");
const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, rows: [] };
const check = (name, ok, detail) => { out[ok ? "pass" : "fail"]++; out.rows.push({ name, ok: !!ok, detail: String(detail === undefined ? "" : detail) }); if (!ok) console.error("FAIL", name, detail || ""); };
const planted = (name, accepted, detail) => { out[accepted ? "planted_accepted" : "planted_rejected"]++; out.rows.push({ name: "planted: " + name, ok: !accepted, detail: String(detail || "") }); if (accepted) console.error("PLANTED ACCEPTED", name); };
const rel = (a, b) => Math.abs(a - b) / Math.abs(b);

(async () => {
  const R = C.resolve(C.REG.jnt), v = R.phys.v, F = R.inst.fixed, Ron = J.ASSUMED.ron.value;
  const G = J.gain(R);
  check(`mid-band gain ${G.peak.toFixed(1)} within 0.5 percent of the stocked parts' ${v.Gbuilt.toFixed(1)} (finite A0 and GBW)`, rel(G.peak, v.Gbuilt) < 5e-3, G.peak);
  check(`stocked E96 values move the gain ${((v.Gbuilt / v.G - 1) * 100).toFixed(2)} percent from the design ${v.G}: under 0.2 percent, and stated on the spec sheet`, rel(v.Gbuilt, v.G) < 2e-3 && rel(v.Gbuilt, 1997.94) < 1e-6, v.Gbuilt);
  check(`high-pass -3 dB at ${G.lo3.toFixed(1)} Hz within 3 percent of the stocked parts' ${v.fHPbuilt.toFixed(1)} Hz`, rel(G.lo3, v.fHPbuilt) < 0.03, G.lo3);
  check("the netlist's 56 nF and 9.53 kOhm put the corner at 298.2 Hz, 0.6 percent below the design 300 Hz", rel(G.fHPnet, 298.2217) < 1e-5 && rel(G.fHPnet, v.fHPbuilt) < 1e-9 && rel(G.fHPnet, F.fHP) < 0.01, G.fHPnet);
  planted("the unsnapped 53.1 nF and 10 kOhm corner (299.7 Hz) passes as the netlist's corner", rel(299.73, G.fHPnet) < 1e-3);
  const Z = 1 - J.reZ(R, R.p.fHi), x = 2 * Math.PI * R.p.fHi * (R.p.R + Ron) * R.p.Cin * 1e-12, Zc = 1 - ((R.p.R + Ron) / R.p.R) / (1 + x * x);
  check("Re Z droop at 10 kHz equals (R + R_contact) || C_in to 1e-7 (the open relays' 1 TOhm paths add about 2e-8)", Math.abs(Z - Zc) < 1e-7, `${Z} vs ${Zc}`);
  check("Re Z droop within 10 percent of the spec's 1.58e-4; the 0.1 Ohm relay contact explains the rest", rel(Z, v.droop) < 0.1, `${Z} vs ${v.droop}`);
  const Bu = J.budget(R), kT4R = 4 * S.kB * R.p.T * R.p.R;
  check("input-referred resistor noise 12.87 nV/rtHz, as the spec", rel(Bu.eRin, v.eR) < 2e-3, Bu.eRin);
  check("the op-amp's own term (e_n and i_n R over 4kTR) equals the spec's a = 0.157 to 1e-3", rel(Bu.terms.U1A, v.a) < 1e-3, Bu.terms.U1A);
  const par = 1 / (1 / 100 + 1 / 3920);
  check("the gain resistor RG1 adds 4kT (RG || RF) / 4kTR = 0.95 percent, a term the hand budget omits", rel(Bu.terms.RG1, par / R.p.R) < 0.05, Bu.terms.RG1);
  check(`total a from simulation ${Bu.a.toFixed(4)} exceeds the spec's ${v.a.toFixed(4)} by the omitted terms (within 1e-3)`, Math.abs(Bu.a - v.a - (Bu.terms.RG1 + Bu.terms.RF1 + Bu.terms.K1 + Bu.terms.U1B + Bu.terms.RG2 + Bu.terms.RB1 + Bu.terms.U2A + Bu.terms.K2)) < 1e-3, Bu.a);
  const corrWant = Ron / R.p.R + 2 * (F.inA * R.p.R) ** 2 / kT4R;
  check("correlated excess equals R_contact / R plus both amplifiers' (i_n R)^2 (spec counts one amplifier: 6.0e-7)", rel(Bu.corr, corrWant) < 0.05, `${Bu.corr} vs ${corrWant}`);
  check(`statistical uncertainty at 60 s: ${(Bu.relSpecForm * 100).toFixed(4)} percent by the spec's form, within 2 percent of the spec's ${(v.rel * 100).toFixed(4)}`, rel(Bu.relSpecForm, v.rel) < 0.02, Bu.relSpecForm);
  const St = J.settle(R);
  check(`high-pass settle to 0.1 percent: ${(St.settle * 1e3).toFixed(3)} ms within 0.5 percent of the stocked parts' ${(v.settleBuilt * 1e3).toFixed(3)} ms (design ${(v.settle * 1e3).toFixed(3)} ms)`, rel(St.settle, v.settleBuilt) < 0.005, St.settle);
  planted("a settle measured at 5 ms passes the comparison", rel(5e-3, v.settleBuilt) < 0.005);
  const Th = await J.thermometry(R, { nseg: 64 });
  check(`transient-noise thermometry reads ${Th.T.toFixed(2)} K +- ${Th.sigmaT.toFixed(2)} for a 300 K resistor (within 3 sigma)`, Math.abs(Th.T - 300) < 3 * Th.sigmaT, Th.T);
  check("its per-segment scatter lies between 0.6 and 1.4 times the cross-spectrum prediction", Th.relSeg / Th.relSegCross > 0.6 && Th.relSeg / Th.relSegCross < 1.4, `${Th.relSeg} vs ${Th.relSegCross}`);
  planted("the same reading passes for a 310 K resistor", Math.abs(Th.T - 310) < 3 * Th.sigmaT);
  console.log(`jnt chain: ${out.pass} pass, ${out.fail} fail, planted ${out.planted_rejected} rejected, ${out.planted_accepted} accepted`);
  const j = process.argv.indexOf("--json");
  if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(Object.assign({ date: new Date().toISOString().slice(0, 10) }, out), null, 1));
  process.exit(out.fail || out.planted_accepted ? 1 : 0);
})();
