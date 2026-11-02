// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Published impedance formulas
export function hammerstad(w, h, er) {
  const u = w / h;
  if (u <= 1) {
    const e =
      (er + 1) / 2 + ((er - 1) / 2) * (Math.pow(1 + 12 / u, -0.5) + 0.04 * (1 - u) * (1 - u));
    return { z: (60 / Math.sqrt(e)) * Math.log(8 / u + u / 4), e };
  }
  const e = (er + 1) / 2 + ((er - 1) / 2) * Math.pow(1 + 12 / u, -0.5);
  return { z: (120 * Math.PI) / (Math.sqrt(e) * (u + 1.393 + 0.667 * Math.log(u + 1.444))), e };
}
export function ipc2141(w, h, t, er) {
  return (87 / Math.sqrt(er + 1.41)) * Math.log((5.98 * h) / (0.8 * w + t));
}
