// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/units: every value carries a unit, and every unit is a dimension vector plus a scale to SI.
   The dimensions are the seven SI base quantities plus information (bit), so volts and bits are different
   kinds of thing and adding them is refused. Angles, counts and ratios are dimensionless. */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});
  const BASE = ["m", "kg", "s", "A", "K", "mol", "cd", "bit"];
  const Z = () => [0, 0, 0, 0, 0, 0, 0, 0];
  const d = (o) => { const v = Z(); for (const [k, e] of Object.entries(o)) v[BASE.indexOf(k)] = e; return v; };

  /* name: [scale to the SI (or bit) unit, dimension] */
  const TABLE = {
    "1": [1, Z()], count: [1, Z()], rad: [1, Z()], deg: [Math.PI / 180, Z()], symbol: [1, Z()], ulp: [1, Z()],
    m: [1, d({ m: 1 })], km: [1e3, d({ m: 1 })], mm: [1e-3, d({ m: 1 })], um: [1e-6, d({ m: 1 })], nm: [1e-9, d({ m: 1 })],
    s: [1, d({ s: 1 })], ms: [1e-3, d({ s: 1 })], us: [1e-6, d({ s: 1 })], ns: [1e-9, d({ s: 1 })], Hz: [1, d({ s: -1 })],
    kg: [1, d({ kg: 1 })], g: [1e-3, d({ kg: 1 })], A: [1, d({ A: 1 })], K: [1, d({ K: 1 })], mol: [1, d({ mol: 1 })], cd: [1, d({ cd: 1 })],
    N: [1, d({ kg: 1, m: 1, s: -2 })], Pa: [1, d({ kg: 1, m: -1, s: -2 })], J: [1, d({ kg: 1, m: 2, s: -2 })],
    W: [1, d({ kg: 1, m: 2, s: -3 })], C: [1, d({ A: 1, s: 1 })], V: [1, d({ kg: 1, m: 2, s: -3, A: -1 })],
    ohm: [1, d({ kg: 1, m: 2, s: -3, A: -2 })], T: [1, d({ kg: 1, s: -2, A: -1 })], pJ: [1e-12, d({ kg: 1, m: 2, s: -2 })],
    bit: [1, d({ bit: 1 })], byte: [8, d({ bit: 1 })], px: [1, Z()], char: [1, Z()], word: [1, Z()],
  };

  class UnitError extends Error { constructor(m) { super(m); this.name = "UnitError"; } }
  F.UnitError = UnitError;
  F.BASE_DIMS = BASE;

  const one = (tok) => {
    const m = /^([A-Za-z]+|1)(?:\^(-?\d+))?$/.exec(tok.trim());
    if (!m || !TABLE[m[1]]) throw new UnitError("unknown unit '" + tok + "'");
    const e = m[2] ? +m[2] : 1, [s, dim] = TABLE[m[1]];
    return { scale: s ** e, dim: dim.map((x) => x * e) };
  };

  /* "V", "mm", "bit/s", "J/bit", "m^2*kg" or an already parsed unit. Division binds to the next factor. */
  F.unit = (u) => {
    if (u && typeof u === "object" && Array.isArray(u.dim)) return u;
    const s = u === undefined || u === null || u === "" ? "1" : String(u);
    let scale = 1, dim = Z();
    const parts = s.split(/([*/])/);
    let sign = 1;
    for (const p of parts) {
      if (p === "*") { sign = 1; continue; }
      if (p === "/") { sign = -1; continue; }
      const q = one(p);
      scale *= q.scale ** sign;
      dim = dim.map((x, i) => x + sign * q.dim[i]);
    }
    return { name: s, scale, dim };
  };

  F.dimString = (dim) => {
    const t = BASE.map((b, i) => (dim[i] ? b + (dim[i] === 1 ? "" : "^" + dim[i]) : "")).filter(Boolean);
    return t.length ? t.join(" ") : "dimensionless";
  };
  F.sameDim = (a, b) => { const A = F.unit(a), B = F.unit(b); return A.dim.every((x, i) => x === B.dim[i]); };

  /* Adding or comparing needs the same dimension. Returns the factor that takes b's numbers into a's unit. */
  F.addFactor = (a, b) => {
    const A = F.unit(a), B = F.unit(b);
    if (!F.sameDim(A, B)) throw new UnitError(`cannot add ${A.name} (${F.dimString(A.dim)}) and ${B.name} (${F.dimString(B.dim)})`);
    return B.scale / A.scale;
  };
  F.convertFactor = F.addFactor;

  const combine = (a, b, sign) => {
    const A = F.unit(a), B = F.unit(b);
    const name = B.name === "1" ? A.name : A.name === "1" ? (sign > 0 ? B.name : "1/" + B.name) : B.name === "1" ? A.name : A.name + (sign > 0 ? "*" : "/") + B.name;
    return { name, scale: A.scale * B.scale ** sign, dim: A.dim.map((x, i) => x + sign * B.dim[i]) };
  };
  F.unitMul = (a, b) => combine(a, b, 1);
  F.unitDiv = (a, b) => combine(a, b, -1);
  F.unitInverse = (a) => combine("1", a, -1);

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
