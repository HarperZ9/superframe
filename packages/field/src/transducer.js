// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/transducer: converters are typed transducers. Each one declares
     id, claims (the grade it promises), tol and residual (how a round trip is compared),
     from / to ({ domain kind, unit }) checked on entry,
     forward(field) -> output spec (values, rep, and anything that changes: domain, unit, sigma, name),
   and as many of these as it can honestly offer:
     inverse(outField) -> source values            (round trip g(f(x)))
     targets(src, out) -> a target-space field      (reverse test f(g(y)) on things f did not make)
     reference(src) -> values the output must equal (a lowering checked against the spec's semantics)
     keeps: { name, check(src, out) -> { ok, detail } }  (the structure a lossy map promises to keep)
     forwardLoss(x) -> key                           (elementwise map, for H(X) - H(f(X)) with no inverse)
     lossEstimate(src, out) -> { bits, method }     (any other honest estimate, named, when there is no inverse)
     rounding: the rounding class of a float lowering.
   apply() measures the grade on the data in hand, appends a chain-ledger entry and refuses a converter whose
   claim the measurement does not support (strict, the default). */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});

  class ClaimError extends Error { constructor(m, v) { super(m); this.name = "ClaimError"; this.verdict = v; } }
  F.ClaimError = ClaimError;

  F.converter = (spec) => {
    for (const k of ["id", "claims", "forward"]) if (!spec[k]) throw new F.FieldError("converter needs " + k);
    if (!F.GRADES.includes(spec.claims)) throw new F.FieldError("claims must be one of " + F.GRADES.join(", "));
    if (spec.claims !== "none" && spec.claims !== "homomorphism" && !spec.inverse && !spec.reference)
      throw new F.FieldError(spec.id + ": a lossless claim needs an inverse or a reference to test it against");
    return Object.assign({ tol: 0, residual: "abs", from: {}, to: {} }, spec);
  };

  const checkPort = (port, f, where) => {
    if (port.domain && port.domain !== f.domain.kind) throw new F.FieldError(`${where}: expects a ${port.domain} domain, got ${f.domain.kind}`);
    if (port.unit !== undefined && !F.sameDim(port.unit, f.unit))
      throw new F.UnitError(`${where}: expects ${F.dimString(F.unit(port.unit).dim)}, got ${f.unit.name} (${F.dimString(f.unit.dim)})`);
  };

  const build = (conv, src, spec) => F.make({
    name: spec.name || conv.id + "(" + src.name + ")", domain: spec.domain || src.domain, values: spec.values,
    components: spec.components || (spec.domain ? 1 : src.components), unit: spec.unit !== undefined ? spec.unit : src.unit,
    sigma: spec.sigma !== undefined ? spec.sigma : spec.domain || spec.unit !== undefined ? null : src.sigma,
    prov: F.combineProv([src.prov], "convert:" + conv.id), rep: spec.rep || src.rep, ledger: src.ledger,
  });

  const reverseTest = (conv, src, out) => {
    if (!conv.targets || !conv.inverse) return null;
    const T = conv.targets(src, out), back = conv.inverse(T);
    const resized = back.length !== src.values.length && src.domain.kind === "sequence"
      ? { domain: Object.assign({}, src.domain, { shape: [back.length / src.components] }), sigma: typeof src.sigma === "number" ? src.sigma : null } : {};
    const again = conv.forward(F.derive(src, Object.assign({ values: back, method: "reverse test" }, resized)));
    return F.roundTripLoss(T.values, again.values, { residual: conv.targetResidual || conv.residual, tol: conv.targetTol !== undefined ? conv.targetTol : conv.tol });
  };

  /* Measure one converter on one field. Returns the verdict and the output field (without the ledger entry). */
  F.measure = (conv, src) => {
    checkPort(conv.from, src, conv.id + " input");
    const out = build(conv, src, conv.forward(src));
    checkPort(conv.to, out, conv.id + " output");
    const opt = { residual: conv.residual, tol: conv.tol };
    let fwd = null, rev = null, fl = null;
    if (conv.reference) { fwd = F.roundTripLoss(conv.reference(src), out.values, opt); rev = fwd; }
    else if (conv.inverse) { fwd = F.roundTripLoss(src.values, conv.inverse(out), opt); rev = reverseTest(conv, src, out); }
    if (conv.forwardLoss) fl = F.forwardLoss(src.values, conv.forwardLoss);
    const keeps = conv.keeps ? Object.assign({ name: conv.keeps.name }, conv.keeps.check(src, out)) : null;
    const measured = F.decideGrade(fwd, rev, keeps);
    const est = !fwd && !fl && conv.lossEstimate ? conv.lossEstimate(src, out) : null;
    const bits = fwd ? fwd.bitsLost : fl ? fl.bitsLost * src.values.length : est ? est.bits : null;
    const verdict = {
      converter: conv.id, claimed: conv.claims, measured, holds: F.claimHolds(conv.claims, measured),
      bitsLost: bits, bitsPerValue: fwd ? fwd.bitsPerValue : fl ? fl.bitsLost : null,
      n: fwd ? fwd.n : src.values.length, nBad: fwd ? fwd.nBad : null, maxErr: fwd ? fwd.maxErr : null, tol: conv.tol, residual: typeof conv.residual === "function" ? "custom" : conv.residual,
      reverse: rev && rev !== fwd ? { n: rev.n, nBad: rev.nBad, maxErr: rev.maxErr } : rev === fwd && fwd ? "same as reference" : null,
      keeps, rounding: conv.rounding || null,
      method: conv.reference ? "reference" : conv.inverse ? "round trip" : fl ? "forward H(X) - H(f(X))" : est ? est.method : "forward only, bits unmeasured",
    };
    return { verdict, out };
  };

  F.apply = (conv, src, opt = {}) => {
    const strict = opt.strict !== false, { verdict, out } = F.measure(conv, src);
    const repOf = (f) => Object.assign({}, f.rep, { unit: f.unit.name, domain: f.domain.kind, n: f.values.length });
    out.ledger = F.appendEntry(src.ledger, Object.assign({ op: "convert", in: F.hashValues(src), out: F.hashValues(out),
      from: repOf(src), to: repOf(out), status: out.prov.status }, verdict));
    out.verdict = verdict;
    if (!verdict.holds && strict)
      throw new ClaimError(`${conv.id} claims ${conv.claims} but measures ${verdict.measured} (${verdict.nBad} of ${verdict.n} outside tol ${conv.tol}, ${fmtBits(verdict.bitsLost)} lost)`, verdict);
    return out;
  };
  const fmtBits = (b) => (b === null ? "unmeasured bits" : b.toPrecision(4) + " bits");

  F.chain = (src, convs, opt) => convs.reduce((f, c) => F.apply(c, f, opt), src);

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
