// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/grade: what a converter keeps and what it loses, measured on the data it was given.

   Grades, strongest first:
     isomorphism   lossless both ways: g(f(x)) = x on the source sample and f(g(y)) = y on a target sample,
                   each within the declared tolerance
     embedding     lossless one way: g(f(x)) = x within tolerance; the target holds things no source maps to,
                   or the reverse direction was not tested
     homomorphism  information is lost, and a declared structure is kept (the converter says which, and the
                   check runs)
     none          information is lost and no declared structure survived the check

   The measurable state is the round-trip loss H(x | g(f(x))). For numbers it is estimated as the entropy
   of the residual x - g(f(x)) coded at the tolerance grain (zero when every residual is within tolerance).
   That bounds H(x | x') from above at that grain, on this sample only, and it is capped by H(x) at the same
   grain, since nothing can lose more than the source held. For symbols it is H(X, X') - H(X')
   from joint counts. Entropies come from tools/perceive (loss.js), which is passed in, never copied. */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});
  F.GRADES = ["isomorphism", "embedding", "homomorphism", "none"];
  F.gradeRank = (gr) => F.GRADES.indexOf(gr);
  const P = () => g.Perceive || (typeof require === "function" ? require("../../perceive/src/index.js") : null);

  /* float32 bit patterns ordered as integers, so the difference counts representable values (ULPs). */
  const f32 = new Float32Array(1), i32 = new Int32Array(f32.buffer);
  F.ordered32 = (x) => { f32[0] = x; const b = i32[0]; return b < 0 ? -2147483648 - b : b; };
  F.ulpDiff32 = (a, b) => F.ordered32(b) - F.ordered32(a);

  F.RESIDUALS = {
    abs: (x, y) => y - x,
    ulp32: (x, y) => F.ulpDiff32(x, y),
    symbol: (x, y) => (x === y ? 0 : 1),
  };

  const code = (r, tol) => (Math.abs(r) <= tol ? 0 : tol > 0 ? Math.round(r / tol) : r);

  /* x: source values, y: values after the round trip. Returns the loss in bits and the error counts. */
  F.roundTripLoss = (x, y, opt = {}) => {
    const kind = typeof opt.residual === "function" ? "custom" : opt.residual || "abs", tol = opt.tol || 0;
    const res = typeof opt.residual === "function" ? opt.residual : F.RESIDUALS[kind];
    if (!res) throw new F.FieldError("unknown residual " + kind);
    if (x.length !== y.length) return { n: x.length, nBad: x.length, maxErr: Infinity, bitsPerValue: null, bitsLost: null, lengthChanged: true };
    let nBad = 0, maxErr = 0;
    const codes = new Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const r = res(x[i], y[i]), a = Math.abs(r);
      if (!(a <= tol)) nBad++;
      if (!(a <= maxErr)) maxErr = a;
      codes[i] = kind === "symbol" ? null : code(r, tol);
    }
    let bitsPerValue;
    if (kind === "symbol") {
      const E = P().entropy, joint = x.map((v, i) => String(v) + "\u0000" + String(y[i]));
      bitsPerValue = Math.max(0, E(joint) - E(Array.from(y, String)));
    } else if (!nBad) bitsPerValue = 0;
    else {
      /* H(x | x') <= H(x): cap the residual bound by the source's own entropy at the same grain */
      const hx = kind === "abs" && tol > 0 ? P().entropy(Array.from(x, (v) => Math.round(v / tol))) : Infinity;
      bitsPerValue = Math.min(P().entropy(codes), hx);
    }
    return { n: x.length, nBad, maxErr, bitsPerValue, bitsLost: bitsPerValue * x.length, residual: kind, tol };
  };

  F.entropyOf = (codes) => P().entropy(codes);

  /* Bits an elementwise map loses with no inverse at hand: H(X) - H(f(X)) on the sample (perceive lossBits). */
  F.forwardLoss = (xs, f) => P().lossBits(Array.from(xs), f);

  /* Turn the measurements into a grade. fwd: round trip on the source; rev: on a target sample (or null);
     keeps: { name, ok, detail } from the converter's declared structure check (or null). */
  F.decideGrade = (fwd, rev, keeps) => {
    const fwdOk = fwd && fwd.nBad === 0;
    if (fwdOk && rev && rev.nBad === 0) return "isomorphism";
    if (fwdOk) return "embedding";
    if (keeps && keeps.ok) return "homomorphism";
    return "none";
  };

  F.claimHolds = (claimed, measured) => F.gradeRank(measured) <= F.gradeRank(claimed);

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
