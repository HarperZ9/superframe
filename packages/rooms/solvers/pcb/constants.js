// SPDX-License-Identifier: FSL-1.1-MIT
import { CONSTANTS } from "../../core/constants.js";
// ======================================================================= Constants, sourced where noted
export const RHO_CU = CONSTANTS.copperResistivity.value;
// ohm mm, annealed copper standard (IACS)
export const K_CU = CONSTANTS.copperConductivity.value,
  K_FR4 = CONSTANTS.fr4Conductivity.value;
// W/mK. Typical handbook values, from memory; FR4 in-plane is often higher
export const STACKS = {
  2: { cu: [0.03556, 0.03556], diel: [1.529], er: 4.5, mat: "FR4 KB6167F", plating: 0.025 },
  4: {
    cu: [0.04318, 0.01727, 0.01727, 0.04318],
    diel: [0.1999, 0.9906, 0.1999],
    er: 3.61,
    mat: "FR408-HR",
    plating: 0.025,
  },
};
export const RULES = {
  2: {
    name: "OSH Park 2 layer",
    trace: 0.1524,
    space: 0.1524,
    drill: 0.254,
    ring: 0.127,
    edge: 0.381,
    web: 0.1016,
    source: "docs.oshpark.com/services/two-layer",
  },
  4: {
    name: "OSH Park 4 layer",
    trace: 0.127,
    space: 0.127,
    drill: 0.254,
    ring: 0.1016,
    edge: 0.381,
    web: 0.1016,
    source: "docs.oshpark.com/services/four-layer",
  },
};
export const DES = {
  w: 0.2,
  clr: 0.2,
  via: 0.3,
  viaPad: 0.6,
  pourClr: 0.25,
  antipad: 0.3,
  planeInset: 0.5,
  maskGrow: 0.05,
  g: 0.2,
};
export const UNBUILT =
  "UNBUILT. No board has been made from this file. A fabricator CAM check is required before any order.";
export function rng32(s) {
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function layerZ(layers) {
  const st = STACKS[layers],
    z = [];
  let top = 0;
  for (const c of st.cu) top += c;
  for (const t of st.diel) top += t;
  let y = top / 2;
  for (let i = 0; i < layers; i++) {
    z.push({ top: y, bot: y - st.cu[i] });
    y -= st.cu[i] + (st.diel[i] || 0);
  }
  return { z, total: top };
}
