// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* The Johnson-noise thermometer as a circuit: built from the instrument's own netlist (cad/instruments/jnt.js),
   so the simulation, the schematic, the board and the fab files share one source. Values are read back from the
   netlist's value strings, the same numbers the schematic prints. What the netlist does not hold is named here and
   marked: the input capacitance comes from the model's parameter Cin; the op-amp's open-loop gain and GBW and the
   reed relays' contact resistance are from memory, unverified. */
"use strict";
const { S } = require("./load.js");

const ASSUMED = {
  A0: { value: 1e6, note: "OPA1642 open-loop gain, about 120 dB, from memory, unverified" },
  gbw: { value: 11e6, note: "OPA1642 gain-bandwidth, about 11 MHz, from memory, unverified" },
  ron: { value: 0.1, note: "reed relay contact resistance, from memory, unverified" },
  roff: { value: 1e12, note: "reed relay open resistance, assumed" },
  Tref: { value: 273.15, note: "R2 sits at the ice point (the model's own description)" },
};
const UNITS = { OPA2: [["3", "2", "1"], ["5", "6", "7"]] };
const GROUND = "GND_A";

const val = (s) => S.spiceNum(String(s).replace(/\s+/g, "").replace(/Ohm$/i, ""));
const node = (n) => (n === GROUND ? "0" : n);

/* opt: { k1: "sense" | "ref", k2, k3: booleans, inject: element fields for a source at INJ, traceR: { net: ohms }, T } */
const circuit = (R, opt = {}) => {
  const p = R.p, F = R.inst.fixed, k1 = opt.k1 || "sense", els = [], A = Object.assign({}, ...Object.entries(ASSUMED).map(([k, v]) => ({ [k]: v.value })), opt.assumed || {});
  for (const c of R.B.netlist.components) {
    const pin = (k) => node(c.pins[k]);
    if (c.sym === "R") {
      const T = c.ref === "R1" ? (opt.T || p.T) : c.ref === "R2" ? A.Tref : 300;
      els.push({ t: "R", name: c.ref, n: [pin("1"), pin("2")], R: val(c.value), T });
    } else if (c.sym === "C") els.push({ t: "C", name: c.ref, n: [pin("1"), pin("2")], C: val(c.value) });
    else if (c.sym === "OPA2") UNITS.OPA2.forEach(([a, b, o], u) => els.push({ t: "OA", name: c.ref + (u ? "B" : "A"), n: [pin(a), pin(b), pin(o)], A0: A.A0, gbw: A.gbw, en: p.en * 1e-9, in: F.inA, rout: 10 }));
    else if (c.sym === "SW2") {
      els.push({ t: "S", name: c.ref + ".a", n: [pin("1"), pin("2")], on: k1 === "sense", ron: A.ron, roff: A.roff, group: c.ref });
      els.push({ t: "S", name: c.ref + ".b", n: [pin("1"), pin("3")], on: k1 === "ref", ron: A.ron, roff: A.roff, group: c.ref });
    } else if (c.sym === "SW1") els.push({ t: "S", name: c.ref, n: [pin("1"), pin("2")], on: !!opt[c.ref.toLowerCase()], ron: A.ron, roff: A.roff });
    else if (c.sym === "BAT3") { els.push({ t: "V", name: c.ref + "+", n: [pin("1"), pin("2")], dc: 9 }, { t: "V", name: c.ref + "-", n: [pin("3"), pin("2")], dc: -9 }); }
    else if (c.sym === "NT") els.push({ t: "V", name: c.ref, n: [pin("1"), pin("2")], dc: 0 });
    /* CONN2 and JACK3 are wires to the outside: no element */
  }
  els.push({ t: "C", name: "Cin", n: ["IN", "0"], C: p.Cin * 1e-12, group: "Cin" });
  if (opt.inject) els.push(Object.assign({ t: "V", name: "VINJ", n: ["INJ", "0"] }, opt.inject));
  /* board back-annotation: a trace's copper resistance in series, split into the net at its pin on the amplifier */
  for (const [net, ohms] of Object.entries(opt.traceR || {})) {
    for (const e of els) e.n = e.n.map((n) => (n === net && /^U\d/.test(e.name) ? net + ".pin" : n));
    els.push({ t: "R", name: "trace." + net, n: [net, net + ".pin"], R: Math.max(ohms, 1e-9), T: 300 });
  }
  return els;
};

module.exports = { circuit, ASSUMED, val };
