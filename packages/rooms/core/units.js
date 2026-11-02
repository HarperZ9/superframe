// SPDX-License-Identifier: FSL-1.1-MIT
// A unit is a scale to SI plus a dimension vector, the same model as packages/field/src/units.js. The field
// package is not on main yet; once it is, tests/units-field.test.mjs compares the two tables.
const BASE = ["m", "kg", "s", "A", "K", "mol", "cd", "bit"];
const d = (o = {}) => BASE.map((b) => o[b] || 0);
const TABLE = {
  1: [1, d()],
  rad: [1, d()],
  deg: [Math.PI / 180, d()],
  sr: [1, d()],
  m: [1, d({ m: 1 })],
  cm: [1e-2, d({ m: 1 })],
  mm: [1e-3, d({ m: 1 })],
  um: [1e-6, d({ m: 1 })],
  nm: [1e-9, d({ m: 1 })],
  s: [1, d({ s: 1 })],
  ms: [1e-3, d({ s: 1 })],
  ns: [1e-9, d({ s: 1 })],
  Hz: [1, d({ s: -1 })],
  kg: [1, d({ kg: 1 })],
  g: [1e-3, d({ kg: 1 })],
  A: [1, d({ A: 1 })],
  K: [1, d({ K: 1 })],
  N: [1, d({ kg: 1, m: 1, s: -2 })],
  Pa: [1, d({ kg: 1, m: -1, s: -2 })],
  J: [1, d({ kg: 1, m: 2, s: -2 })],
  W: [1, d({ kg: 1, m: 2, s: -3 })],
  C: [1, d({ A: 1, s: 1 })],
  V: [1, d({ kg: 1, m: 2, s: -3, A: -1 })],
  F: [1, d({ kg: -1, m: -2, s: 4, A: 2 })],
  H: [1, d({ kg: 1, m: 2, s: -2, A: -2 })],
  ohm: [1, d({ kg: 1, m: 2, s: -3, A: -2 })],
  S: [1, d({ kg: -1, m: -2, s: 3, A: 2 })],
  bit: [1, d({ bit: 1 })],
};
export class UnitError extends Error {
  constructor(m) {
    super(m);
    this.name = "UnitError";
  }
}
function one(tok) {
  const m = /^([A-Za-z]+|1)(?:\^(-?\d+))?$/.exec(tok.trim());
  if (!m || !TABLE[m[1]]) throw new UnitError(`unknown unit '${tok}'`);
  const e = m[2] ? +m[2] : 1;
  return { scale: TABLE[m[1]][0] ** e, dim: TABLE[m[1]][1].map((x) => x * e) };
}
/** "V/um", "N/m", "kg/s^2", "m*K". Division binds to the next factor. */
export function unit(s = "1") {
  let scale = 1,
    dim = d(),
    sign = 1;
  for (const p of String(s).split(/([*/])/)) {
    if (p === "*" || p === "/") {
      sign = p === "*" ? 1 : -1;
      continue;
    }
    const q = one(p);
    scale *= q.scale ** sign;
    dim = dim.map((x, i) => x + sign * q.dim[i]);
  }
  return { name: String(s), scale, dim };
}
export const sameDim = (a, b) => unit(a).dim.every((x, i) => x === unit(b).dim[i]);
export function convert(v, from, to) {
  if (!sameDim(from, to)) throw new UnitError(`cannot convert ${from} to ${to}`);
  return (v * unit(from).scale) / unit(to).scale;
}
