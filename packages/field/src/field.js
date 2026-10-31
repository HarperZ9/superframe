// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/field: the core type. A field is values over a domain. The domain is a sequence, a grid, a mesh,
   a graph, space plus time, or a point. Every field carries its unit and dimension, its uncertainty, its
   provenance, its representation (analog or digital, with sample rate, grain or bit depth, and the
   rounding class for floats) and a chain ledger of every conversion that produced it.

   Provenance statuses follow tools/measured (PROVENANCE.json): defined, measured, derived, fitted,
   from_memory, missing. A computed result is never stronger than "derived" and never stronger than its
   weakest input, so one value held from memory marks everything computed from it. */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});
  F.DOMAINS = ["point", "sequence", "grid", "mesh", "graph", "spacetime"];
  F.STATUSES = ["defined", "measured", "derived", "fitted", "from_memory", "missing"];
  F.REPS = ["analog", "digital"];

  class FieldError extends Error { constructor(m) { super(m); this.name = "FieldError"; } }
  F.FieldError = FieldError;

  const size = (dom) => {
    if (dom.kind === "point") return 1;
    if (dom.kind === "mesh" || dom.kind === "graph") return dom.nodes;
    return dom.shape.reduce((a, b) => a * b, 1);
  };
  F.domainSize = size;

  const checkDomain = (dom) => {
    if (!dom || !F.DOMAINS.includes(dom.kind)) throw new FieldError("domain.kind must be one of " + F.DOMAINS.join(", "));
    if ((dom.kind === "mesh" || dom.kind === "graph") && !(dom.nodes >= 1 && Array.isArray(dom.edges || dom.faces)))
      throw new FieldError(dom.kind + " domain needs nodes and " + (dom.kind === "mesh" ? "faces" : "edges"));
    if (["sequence", "grid", "spacetime"].includes(dom.kind) && !(Array.isArray(dom.shape) && dom.shape.length))
      throw new FieldError(dom.kind + " domain needs a shape");
    if (dom.kind === "sequence" && dom.shape.length !== 1) throw new FieldError("sequence domain is one-dimensional");
    if (dom.kind === "spacetime" && dom.shape.length < 2) throw new FieldError("spacetime domain needs space and time axes");
  };

  const checkRep = (rep) => {
    if (!rep || !F.REPS.includes(rep.kind)) throw new FieldError("representation.kind must be analog or digital");
    if (rep.kind === "digital" && !(rep.encoding || rep.bits || rep.grain))
      throw new FieldError("a digital representation states its encoding, bit depth or grain");
  };

  const checkProv = (p) => {
    if (!p || !F.STATUSES.includes(p.status)) throw new FieldError("provenance.status must be one of " + F.STATUSES.join(", "));
    if (p.status === "measured" && !p.source) throw new FieldError("a measured value names its source");
  };

  /* spec: { name, domain, values, components?, unit, sigma (number | array | null for unknown), prov, rep, ledger? } */
  F.make = (spec) => {
    checkDomain(spec.domain);
    checkRep(spec.rep);
    checkProv(spec.prov);
    const comps = spec.components || 1, n = size(spec.domain) * comps;
    if (!spec.values || spec.values.length !== n) throw new FieldError(`${spec.name || "field"}: ${spec.values ? spec.values.length : 0} values for a domain of ${n}`);
    if (spec.sigma === undefined) throw new FieldError("uncertainty must be stated; pass sigma: null when it is unknown");
    if (spec.sigma && typeof spec.sigma !== "number" && spec.sigma.length !== n) throw new FieldError("per-value sigma must match the values");
    return {
      kind: "field", name: spec.name || "field", domain: spec.domain, values: spec.values, components: comps,
      unit: F.unit(spec.unit), sigma: spec.sigma, prov: spec.prov, rep: spec.rep, ledger: (spec.ledger || []).slice(),
      symbolic: !(spec.values instanceof Float64Array || spec.values instanceof Float32Array || typeof spec.values[0] === "number"),
    };
  };

  /* A derived field: copies everything the caller does not override, and the provenance becomes derived. */
  F.derive = (base, over) => F.make(Object.assign({
    name: base.name, domain: base.domain, values: base.values, components: base.components, unit: base.unit,
    sigma: base.sigma, rep: base.rep, ledger: base.ledger,
    prov: F.combineProv([base.prov], over && over.method ? over.method : "derived"),
  }, over));

  F.weakest = (statuses) => statuses.reduce((w, s) => (F.STATUSES.indexOf(s) > F.STATUSES.indexOf(w) ? s : w), "defined");
  F.combineProv = (provs, method) => ({
    status: F.weakest(provs.map((p) => p.status).concat(["derived"])),
    method, from: provs.map((p) => ({ status: p.status, source: p.source || null, method: p.method || null })),
    source: provs.map((p) => p.source).filter(Boolean).join(" + ") || null,
  });

  const sig = (f, i) => (f.sigma === null ? null : typeof f.sigma === "number" ? f.sigma : f.sigma[i]);
  const sameDomain = (a, b) => {
    if (a.domain.kind !== b.domain.kind || F.domainSize(a.domain) !== F.domainSize(b.domain) || a.components !== b.components)
      throw new FieldError(`domains differ: ${a.name} is ${a.domain.kind} of ${a.values.length}, ${b.name} is ${b.domain.kind} of ${b.values.length}`);
  };
  const mergeLedger = (a, b) => a.ledger.concat(b.ledger.filter((e) => !a.ledger.some((x) => x.hash === e.hash)));

  /* a + b and a - b: same dimension or a UnitError; b is rescaled into a's unit; sigmas add in quadrature
     (inputs taken as uncorrelated); unknown sigma stays unknown. */
  const addLike = (a, b, sign) => {
    const k = F.addFactor(a.unit, b.unit);
    sameDomain(a, b);
    if (a.symbolic || b.symbolic) throw new FieldError("symbols have no sum");
    const n = a.values.length, v = new Float64Array(n), unknown = a.sigma === null || b.sigma === null;
    const s = unknown ? null : new Float64Array(n);
    for (let i = 0; i < n; i++) {
      v[i] = a.values[i] + sign * k * b.values[i];
      if (s) s[i] = Math.hypot(sig(a, i), k * sig(b, i));
    }
    return F.make({ name: `${a.name} ${sign > 0 ? "+" : "-"} ${b.name}`, domain: a.domain, values: v, components: a.components,
      unit: a.unit, sigma: s, prov: F.combineProv([a.prov, b.prov], sign > 0 ? "add" : "subtract"), rep: a.rep, ledger: mergeLedger(a, b) });
  };
  F.add = (a, b) => addLike(a, b, 1);
  F.sub = (a, b) => addLike(a, b, -1);

  /* a * b: units multiply; relative uncertainties add in quadrature (first order). */
  F.mul = (a, b) => {
    sameDomain(a, b);
    const n = a.values.length, v = new Float64Array(n), unknown = a.sigma === null || b.sigma === null;
    const s = unknown ? null : new Float64Array(n);
    for (let i = 0; i < n; i++) {
      v[i] = a.values[i] * b.values[i];
      if (s) s[i] = Math.hypot(sig(a, i) * b.values[i], sig(b, i) * a.values[i]);
    }
    return F.make({ name: `${a.name} * ${b.name}`, domain: a.domain, values: v, components: a.components, unit: F.unitMul(a.unit, b.unit),
      sigma: s, prov: F.combineProv([a.prov, b.prov], "multiply"), rep: a.rep, ledger: mergeLedger(a, b) });
  };

  /* Express a field in another unit of the same dimension. */
  F.to = (a, unit) => {
    const k = F.convertFactor(unit, a.unit), v = Float64Array.from(a.values, (x) => x * k);
    const s = a.sigma === null ? null : typeof a.sigma === "number" ? a.sigma * k : Float64Array.from(a.sigma, (x) => x * k);
    return F.derive(a, { values: v, sigma: s, unit, method: "unit " + a.unit.name + " to " + F.unit(unit).name });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
