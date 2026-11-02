// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Core tests: units, the field contract, uncertainty, provenance, the ledger, grades and planted claims.
   node tests/core.test.js [--json out.json] */
"use strict";
const F = require("../src/index.js");
const { check, planted, throws, finish } = require("./harness.js");

const seq = (vals, unit, o = {}) => F.make(Object.assign({ name: o.name || "x", domain: { kind: "sequence", shape: [vals.length], spacing: [{ step: 1e-3, unit: "s" }] },
  values: Float64Array.from(vals), unit, sigma: 0.01, prov: { status: "measured", source: "test bench" }, rep: { kind: "digital", bits: 16 } }, o));

function units() {
  const v = seq([1, 2, 3], "V"), b = seq([1, 0, 1], "bit");
  const e = throws(() => F.add(v, b), "UnitError");
  check("volts plus bits is refused", !!e, e && e.message);
  planted("volts plus bits accepted", !e);
  check("volts minus bits is refused", !!throws(() => F.sub(v, b), "UnitError"));
  const mm = F.add(seq([1000], "mm"), seq([1], "m"));
  check("1000 mm + 1 m = 2000 mm", Math.abs(mm.values[0] - 2000) < 1e-9, mm.values[0]);
  check("V * A has the dimension of W", F.sameDim(F.mul(seq([2], "V"), seq([3], "A")).unit, "W"));
  check("J/bit parses with bit^-1", F.unit("J/bit").dim[7] === -1);
  check("an unknown unit is refused", !!throws(() => F.unit("furlong"), "UnitError"));
  check("bit and byte share a dimension, factor 8", F.addFactor("bit", "byte") === 8);
  const conv = F.converter({ id: "volts only", claims: "homomorphism", from: { unit: "V" }, forward: (f) => ({ values: f.values }) });
  check("a converter refuses a field of the wrong dimension", !!throws(() => F.apply(conv, b), "UnitError"));
}

function contract() {
  const base = { name: "f", domain: { kind: "sequence", shape: [2] }, values: Float64Array.from([1, 2]), unit: "V", prov: { status: "defined" }, rep: { kind: "digital", bits: 8 } };
  check("uncertainty must be stated (sigma missing)", !!throws(() => F.make(base), "FieldError"));
  check("sigma: null (unknown) is accepted", !!F.make(Object.assign({}, base, { sigma: null })));
  check("measured without a source is refused", !!throws(() => F.make(Object.assign({}, base, { sigma: 0, prov: { status: "measured" } })), "FieldError"));
  check("digital without encoding, bits or grain is refused", !!throws(() => F.make(Object.assign({}, base, { sigma: 0, rep: { kind: "digital" } })), "FieldError"));
  check("values must fill the domain", !!throws(() => F.make(Object.assign({}, base, { sigma: 0, domain: { kind: "sequence", shape: [3] } })), "FieldError"));
  check("a graph domain needs edges", !!throws(() => F.make(Object.assign({}, base, { sigma: 0, domain: { kind: "graph", nodes: 2 } })), "FieldError"));
  const g = F.make(Object.assign({}, base, { sigma: 0, domain: { kind: "graph", nodes: 2, edges: [[0, 1]] } }));
  check("a graph field is a field", g.domain.kind === "graph");
  check("fft on a graph says it is not built", !!throws(() => F.fft(g), "FieldError"));
  const st = F.make(Object.assign({}, base, { sigma: 0, values: new Float64Array(6), domain: { kind: "spacetime", shape: [3, 2] } }));
  check("a spacetime field holds space x time values", st.values.length === 6);
}

function uncertainty() {
  const a = seq([1, 2], "V", { sigma: 0.3 }), b = seq([1, 2], "V", { sigma: 0.4 });
  check("sigmas add in quadrature (0.3, 0.4 -> 0.5)", Math.abs(F.add(a, b).sigma[0] - 0.5) < 1e-12);
  const u = seq([1, 2], "V", { sigma: null });
  check("unknown sigma stays unknown", F.add(a, u).sigma === null);
  planted("unknown sigma became a number", F.add(a, u).sigma !== null);
  const p = F.mul(seq([2], "V", { sigma: 0.2 }), seq([3], "A", { sigma: 0.3 }));
  check("product: relative 10 % and 10 % -> 14.14 %", Math.abs(p.sigma[0] / p.values[0] - Math.SQRT2 * 0.1) < 1e-12);
  const s = F.fft(seq([1, 0, 0, 0], "V", { sigma: 0.1 }));
  check("fft: per-bin rms noise s sqrt(n)", Math.abs(s.sigma - 0.2) < 1e-12);
  const c = F.convolve(seq([0, 1, 0, 0], "V", { sigma: 0.1 }), [0.5, 0.5]);
  check("convolution: s sqrt(sum k^2)", Math.abs(c.sigma - 0.1 * Math.SQRT1_2) < 1e-12);
}

function provenance() {
  const m = seq([1, 2], "V"), mem = seq([1, 1], "V", { prov: { status: "from_memory", source: "datasheet recalled" } });
  const s = F.add(m, mem);
  check("measured + from_memory is from_memory", s.prov.status === "from_memory");
  planted("weakest input hidden", s.prov.status === "measured" || s.prov.status === "derived");
  check("measured + measured is derived", F.add(m, m).prov.status === "derived");
  check("sources are carried", /test bench/.test(s.prov.source) && /datasheet/.test(s.prov.source));
  const chain = F.chain(mem, [F.C.pad(), F.C.spectrum()]);
  check("from_memory survives two conversions", chain.prov.status === "from_memory");
  check("ledger has one entry per conversion", chain.ledger.length === 2);
  check("ledger verifies", F.verifyLedger(chain.ledger).ok);
  const tampered = chain.ledger.map((e) => Object.assign({}, e));
  tampered[0].bitsLost = 0.5;
  planted("an edited ledger entry verifies", F.verifyLedger(tampered).ok);
  planted("a dropped ledger entry verifies", F.verifyLedger(chain.ledger.slice(1)).ok);
  check("the ledger records input and output hashes", chain.ledger[1].in === chain.ledger[0].out);
  check("hash depends on encoding", F.hashValues(seq([1], "V")) !== F.hashValues(F.make(Object.assign({}, seq([1], "V"), { values: Float32Array.from([1]) }))));
}

function grades() {
  const x = seq(Array.from({ length: 64 }, (_, i) => Math.sin(i / 3) * 1.234567), "V");
  const q = F.apply(F.C.quantize(0.001), x);
  check("quantize at 1e-3 grades embedding within 5e-4", q.verdict.measured === "embedding" && q.verdict.bitsLost === 0);
  const tight = F.measure(F.C.quantize(0.001, 1e-6), x).verdict;
  check("quantize below its grain is not lossless", tight.measured === "none" && tight.bitsLost > 0, tight.bitsLost);
  const p = F.apply(F.C.pad(), x.values.length === 64 ? seq(x.values.slice(0, 50), "V") : x);
  check("pad grades embedding (reverse test fails on random tails)", p.verdict.measured === "embedding" && p.verdict.reverse.nBad > 0);
  const s = F.apply(F.C.spectrum(), x);
  check("spectrum grades isomorphism both ways", s.verdict.measured === "isomorphism" && s.verdict.reverse.nBad === 0);
  const m = F.apply(F.C.magnitude(0.01), s);
  check("magnitude grades homomorphism, energy kept", m.verdict.measured === "homomorphism" && m.verdict.keeps.ok);
  check("magnitude loses measured bits", m.verdict.bitsLost > 0, m.verdict.bitsLost);
  const k = new Float64Array(64); k[5] = 1;
  const X = F.power(F.fft(seq(Array.from({ length: 64 }, (_, i) => Math.cos((2 * Math.PI * 5 * i) / 64)), "V"))).values;
  check("fft of a 5-cycle cosine peaks at bin 5", X.indexOf(Math.max(...X.slice(0, 32))) === 5);
  const flat = F.compression(seq(new Array(4096).fill(1), "V"), 1e-3), noise = F.compression(seq(Array.from({ length: 4096 }, (_, i) => Math.sin(i * i)), "V"), 1e-3);
  check("compression: a constant packs far better than noise", flat.ratio > 50 && noise.ratio < 3, `${flat.ratio.toFixed(1)} vs ${noise.ratio.toFixed(2)}`);
}

/* Planted lossy converters that claim isomorphism: each must be caught. */
function plantedClaims() {
  const x = seq(Array.from({ length: 200 }, (_, i) => Math.PI * i / 7), "V");
  const lie = (id, fwd, inv, extra = {}) => F.converter(Object.assign({ id, claims: "isomorphism", tol: 1e-12, forward: (f) => ({ values: fwd(f.values) }), inverse: (o) => inv(o.values) }, extra));
  const cases = [
    lie("float32 cast", (v) => Float32Array.from(v), (v) => Float64Array.from(v)),
    lie("round to 1e-3", (v) => v.map((a) => Math.round(a * 1e3) / 1e3), (v) => v),
    lie("shifted inverse (lossless but wrong)", (v) => v.map((a) => a + 1), (v) => v),
    lie("drops the last value", (v) => v.slice(0, -1), (v) => v, { forward: (f) => ({ values: f.values.slice(0, -1), domain: { kind: "sequence", shape: [f.values.length - 1] }, sigma: null }) }),
  ];
  for (const c of cases) {
    const e = throws(() => F.apply(c, x), "ClaimError");
    planted(c.id + " passed as isomorphism", !e, e && e.message);
  }
  const padLie = Object.assign({}, F.C.pad(), { id: "pad claiming isomorphism", claims: "isomorphism" });
  planted("pad passed as isomorphism", !throws(() => F.apply(padLie, seq(x.values.slice(0, 100), "V")), "ClaimError"));
  check("the honest spectrum is not refused", !throws(() => F.apply(F.C.spectrum(), seq(x.values.slice(0, 128), "V"))));
  check("a lossless claim with no inverse is refused at definition", !!throws(() => F.converter({ id: "bare", claims: "isomorphism", forward: (f) => f }), "FieldError"));
}

function render() {
  const f = F.apply(F.C.spectrum(), seq(Array.from({ length: 64 }, (_, i) => Math.sin(i)), "V"));
  const svg = F.svg(f, { half: true }), panel = F.panel(f, { half: true });
  check("svg comes from diagram's writer", svg.startsWith("<svg") && svg.includes("cad-sheet"));
  check("svg caption carries unit, status and grade", svg.includes("[V]") && svg.includes("spectrum: isomorphism"));
  check("panel has the drawPanels shape", panel.series[0].x.length === panel.series[0].y.length && panel.title.includes("derived"));
}

units(); contract(); uncertainty(); provenance(); grades(); plantedClaims(); render();
finish("field core");
