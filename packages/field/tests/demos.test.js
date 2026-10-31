// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo tests: each cross-layer converter grades as its physics says, against known answers and controls.
   node tests/demos.test.js [--json out.json] [--no-python]   (--no-python skips the room meter bridge) */
"use strict";
const F = require("../src/index.js");
const { check, planted, throws, finish } = require("./harness.js");
const T = require("../demos/text.js"), CAD = require("../demos/cad.js"), FL = require("../demos/float.js");

/* An independent float32 rounding of the exact value a x + y, in BigInt, round half to even. */
const exact32 = (a, x, y) => {
  const dec = (v) => { const b = new DataView(new ArrayBuffer(8)); b.setFloat64(0, v); const hi = b.getUint32(0), lo = b.getUint32(4), e = (hi >>> 20) & 0x7ff;
    const m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo); return e ? [m | (1n << 52n), e - 1075] : [m, -1074]; };
  const [ma, ea] = dec(a), [mx, ex] = dec(x), [my, ey] = dec(y), ep = ea + ex, e0 = Math.min(ep, ey);
  let M = ((ma * mx) << BigInt(ep - e0)) + (my << BigInt(ey - e0)), E = e0;
  if (M === 0n) return 0;
  const bits = M.toString(2).length, shift = bits - 24;
  if (shift > 0) {
    const q = M >> BigInt(shift), r = M - (q << BigInt(shift)), half = 1n << BigInt(shift - 1);
    M = r > half || (r === half && (q & 1n)) ? q + 1n : q; E += shift;
  }
  return Number(M) * 2 ** E;
};

function float() {
  const f = FL.inputs(20000, 7);
  let agree = 0;
  for (let i = 0; i < 20000; i++) if (FL.fma32(f.values[3 * i], f.values[3 * i + 1], f.values[3 * i + 2]) === exact32(f.values[3 * i], f.values[3 * i + 1], f.values[3 * i + 2])) agree++;
  check("fused saxpy equals an independent BigInt rounding on 20,000 values", agree === 20000, agree);
  const t = Math.fround(1 + 2 ** -24);
  check("tie case: 1 + 2^-24 + tiny rounds up once", FL.fma32(1, 1, 2 ** -24 + 2 ** -60) === exact32(1, 1, 2 ** -24 + 2 ** -60) && t === 1);
  const big = FL.inputs(1 << 18);
  const v = (k) => F.apply(FL.C[k], big, { strict: false }).verdict;
  const fused = v("fused"), un = v("unfused"), un1 = v("unfused1"), one = v("plantedOne");
  check("fused lowering grades isomorphism (0 ULP)", fused.measured === "isomorphism" && fused.maxErr === 0);
  check("unfused grades not isomorphic, max loss 1 ULP", un.measured === "homomorphism" && un.maxErr === 1 && un.nBad > 0, `${un.nBad} of ${un.n}`);
  check("unfused mismatch rate near F122's 15.6 %", Math.abs(un.nBad / un.n - 0.1563) < 0.005, (un.nBad / un.n).toFixed(4));
  check("unfused at a 1 ULP budget grades isomorphism within the bound", un1.measured === "isomorphism");
  check("the rounding class is recorded", un.rounding === "two roundings (mul, add)" && fused.rounding === "one rounding (fused)");
  check("one planted ULP is reported as exactly one mismatch", one.nBad === 1 && one.maxErr === 1, one.nBad);
  planted("unfused passed as isomorphism at 0 ULP", !!throws(() => F.apply(FL.C.unfused, big), "ClaimError") === false);
}

function text() {
  const s = "Isomorphic values, variables and measurable states.  Twice:\nagain!";
  const chars = F.make({ name: "t", domain: { kind: "sequence", shape: [Array.from(s).length] }, values: Array.from(s), unit: "char", sigma: 0, prov: { status: "defined" }, rep: { kind: "digital", encoding: "utf8" } });
  const tok = F.apply(T.C.tokens, chars);
  check("tokens grade isomorphism both ways", tok.verdict.measured === "isomorphism" && tok.verdict.reverse.nBad === 0);
  const words = F.apply(T.C.words, tok);
  check("lower-cased words grade homomorphism, counts kept", words.verdict.measured === "homomorphism" && words.verdict.keeps.ok);
  const lower = F.converter({ id: "lowercase claiming isomorphism", claims: "isomorphism", residual: "symbol", forward: (f) => ({ values: f.values.map((c) => c.toLowerCase()) }), inverse: (o) => o.values });
  planted("lower-casing passed as isomorphism", !throws(() => F.apply(lower, chars), "ClaimError"));
  const sym = F.measure(lower, chars).verdict;
  check("lower-casing loses measured bits (H(X|X') > 0)", sym.bitsLost > 0, sym.bitsLost);
  const r = T.run();
  check("planted refrain: fundamental lag 37 words", r.planted.fundamental_lag_words === 37, r.planted.fundamental_lag_words);
  check("planted refrain beats 200 shuffles (z > 10)", r.planted.z > 10, r.planted.z.toFixed(1));
  check("shuffled refrain: no peak above the shuffles (z < 3)", r.planted_shuffled.z < 3, r.planted_shuffled.z.toFixed(2));
  check("a long text's motif result recorded with its z", Number.isFinite(r.long_text.z), r.long_text.z.toFixed(2));
}

function cad() {
  const dims = CAD.sourceDims(), r = F.rng(31), stress = CAD.field(dims.map((d) => d.value + r() * 0.999999), "stress");
  check("16 dimensions read from the three instruments", dims.length === 16, dims.length);
  const model = F.apply(CAD.dxfConv("model", 1), stress);
  check("model-space DXF grades isomorphism within 1e-6 mm", model.verdict.measured === "isomorphism" && model.verdict.maxErr <= 5e-7 + 1e-12, model.verdict.maxErr);
  const text = F.apply(CAD.dxfConv("text", 1, { text: true, claims: "embedding" }), stress);
  check("as text, DXF is an embedding (hand-written zeros differ)", text.verdict.measured === "embedding");
  const sheet = F.measure(CAD.dxfConv("sheet 1:50", 0.02), stress).verdict;
  check("sheet DXF at 1:50 is not isomorphic at 1e-6 model mm", sheet.measured !== "isomorphism" && sheet.maxErr > 1e-6, sheet.maxErr);
  check("its loss stays inside 5e-7 / scale", sheet.maxErr <= 0.5e-6 / 0.02 + 1e-12);
  const three = CAD.dxfConv("DXF at 3 decimals", 1, { writer: (v, s) => CAD.dxfOf(v.map((a) => Math.round(a * 1e3) / 1e3), s) });
  planted("3-decimal DXF passed as isomorphic at 1e-6", !throws(() => F.apply(three, stress), "ClaimError"));
}

function room() {
  const R = require("../demos/room.js"), m = R.measureRoom(2), o = F.apply(R.modesConv(m.meta), m.field, { strict: false });
  check("room seed 2: all six planted modes kept (homomorphism)", o.verdict.measured === "homomorphism", o.verdict.keeps.detail);
  check("room modes: bits lost measured against the 16-bit grain", o.verdict.bitsLost > 0 && o.verdict.bitsPerValue < 16, o.verdict.bitsPerValue);
  check("room record crossed the Python boundary into the ledger", o.ledger.length === 1 && /Python/.test(o.ledger[0].converter));
  const lie = Object.assign({}, R.modesConv(m.meta), { claims: "isomorphism" });
  planted("modal record passed as isomorphism", !throws(() => F.apply(lie, m.field), "ClaimError"));
}

float(); text(); cad();
if (!process.argv.includes("--no-python")) room();
finish("field demos");
