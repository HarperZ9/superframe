// SPDX-License-Identifier: FSL-1.1-MIT
import { MATERIAL_RECORDS } from "./constants.js";
export { MATERIAL_RECORDS };
export const DISPB = 1 / (0.465 * 0.465) - 1 / (0.63 * 0.63);
// ======================================================================= Materials
// nd is the index at 587.6 nm, V the Abbe number. Dispersion is Cauchy through nF and nC. alpha is absorption per scene unit (Beer-Lambert), with one unit read as 10 cm unless noted.
export const MAT = Object.fromEntries(
  Object.entries(MATERIAL_RECORDS).map(([id, r]) => {
    const row = {};
    for (const [k, v] of Object.entries(r)) {
      if (k === "source") row.src = v;
      else row[k] = v && v.flag !== undefined ? v.value : v;
    }
    if (id === "custom") delete row.src;
    return [id, row];
  })
);
export const MIR = {
  silver: { name: "Silvered", t: 0, r: 0, l: 0 },
  oneway: { name: "One way partial", t: 0.5, r: 0, l: 0 },
  rough: { name: "Rough", t: 0, r: 0.12, l: 0 },
  multi: { name: "Multilayer coloured", t: 0, r: 0, l: 0.14 },
};
export const dispOf = (nd, V) => {
  const dF = (nd - 1) / V,
    B = dF / (1 / (0.4861 * 0.4861) - 1 / (0.6563 * 0.6563));
  return B * DISPB;
};
