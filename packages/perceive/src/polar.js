// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/polar: polarisation as Jones vectors, Stokes parameters and points on the Poincare sphere.
   Jones vector (Ex, Ey) with complex entries given as [re, im]. Stokes:
     S0 = |Ex|^2 + |Ey|^2,  S1 = |Ex|^2 - |Ey|^2,  S2 = 2 Re(conj(Ex) Ey),  S3 = 2 Im(conj(Ex) Ey).
   With this sign, (1, i)/sqrt2 has S3 = +1 (the north pole). Optics texts disagree on whether that is called
   right or left circular, so the page names the pole by S3 sign and says which way the field turns. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});

  P.jonesToStokes = (ex, ey) => {
    const ax = ex[0] ** 2 + ex[1] ** 2, ay = ey[0] ** 2 + ey[1] ** 2;
    const re = ex[0] * ey[0] + ex[1] * ey[1], im = ex[0] * ey[1] - ex[1] * ey[0]; // conj(Ex) * Ey
    return [ax + ay, ax - ay, 2 * re, 2 * im];
  };
  /* Unit point on the sphere; inside it for partly polarised light (degree of polarisation below 1). */
  P.poincare = (S) => [S[1] / S[0], S[2] / S[0], S[3] / S[0]];
  P.degreeOfPolarisation = (S) => Math.hypot(S[1], S[2], S[3]) / S[0];
  /* Orientation psi in (-pi/2, pi/2] and ellipticity angle chi in [-pi/4, pi/4]. */
  P.stokesToEllipse = (S) => {
    const p = Math.hypot(S[1], S[2], S[3]) || 1;
    return { psi: 0.5 * Math.atan2(S[2], S[1]), chi: 0.5 * Math.asin(Math.max(-1, Math.min(1, S[3] / p))) };
  };
  P.ellipseToStokes = (psi, chi, dop = 1) => [1, dop * Math.cos(2 * chi) * Math.cos(2 * psi), dop * Math.cos(2 * chi) * Math.sin(2 * psi), dop * Math.sin(2 * chi)];
  /* Back to a Jones vector with Ex real and non-negative. The absolute phase is not in the Stokes vector,
     so this inverse fixes it; that one knob is what the sphere drops (with the unpolarised share). */
  P.stokesToJones = (S) => {
    const p = Math.hypot(S[1], S[2], S[3]), a = Math.sqrt(Math.max(0, (p + S[1]) / 2)), b = Math.sqrt(Math.max(0, (p - S[1]) / 2));
    const d = Math.atan2(S[3], S[2]);
    return [[a, 0], [b * Math.cos(d), b * Math.sin(d)]];
  };
  /* The tip of the field vector over one cycle, for drawing the ellipse: E(t) = Re(J e^{-i w t}). */
  P.ellipsePoints = (S, n = 96) => {
    const [ex, ey] = P.stokesToJones(S), out = [];
    for (let i = 0; i <= n; i++) {
      const t = (2 * Math.PI * i) / n, c = Math.cos(t), s = Math.sin(t);
      out.push([ex[0] * c + ex[1] * s, ey[0] * c + ey[1] * s]);
    }
    return out;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);
