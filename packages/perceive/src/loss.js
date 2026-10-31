// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/loss: what a view keeps and what it loses, in bits and in named knobs.

   For a deterministic map f from a discrete source X to an output Y = f(X), the information lost is
   H(X) - H(Y) = H(X | Y): the bits the receiver can no longer recover. An identity map loses 0; a
   projection that merges distinct inputs loses more. Entropies are measured on the sample given, so the
   number holds for that sample and its quantisation, and says nothing about finer detail. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});
  P.KNOBS = ["amplitude", "frequency", "phase", "polarisation", "direction", "time"];

  P.entropy = (codes) => {
    const c = new Map();
    for (const k of codes) c.set(k, (c.get(k) || 0) + 1);
    let h = 0;
    for (const v of c.values()) { const p = v / codes.length; h -= p * Math.log2(p); }
    return h;
  };
  const key = (v) => (Array.isArray(v) ? v.join("|") : String(v));
  P.lossBits = (xs, f) => {
    const X = xs.map(key), Y = xs.map((x) => key(f(x)));
    const hx = P.entropy(X), hy = P.entropy(Y), lost = hx - hy;
    return { bitsSource: hx, bitsKept: hy, bitsLost: Math.abs(lost) < 1e-12 ? 0 : lost };
  };
  P.knobsReport = (kept, all = P.KNOBS.slice(0, 4)) => ({ kept: kept.slice(), dropped: all.filter((k) => !kept.includes(k)) });

  /* Just-noticeable differences used to quantise a perceptual output. Wavelength discrimination is about 1 to
     4 nm across the visible band (2 nm here); pitch discrimination is about 0.2 to 0.5 percent (0.5 here). */
  P.JND = { visibleNm: 2, pitchRel: 0.005 };
  const isVisible = (dst) => dst.hi <= 1000 && dst.lo >= 300;

  /* Bits lost when the source range [lo, hi], resolved to srcRel relative steps, passes through a window bridge
     into a perceptual band quantised at its JND. Values outside the window are clipped to one code each side. */
  P.windowLoss = (src, dst, lo, hi, o = {}) => {
    const srcRel = o.srcRel || 0.001, n = o.samples || 20000, flip = !!o.flip, br = P.bridge(src, dst, flip);
    const xs = [];
    for (let i = 0; i < n; i++) {
      const x = lo * (hi / lo) ** ((i + 0.5) / n);
      xs.push(Math.round(Math.log(x) / Math.log1p(srcRel)));
    }
    let clipped = 0;
    const f = (code) => {
      const x = Math.exp(code * Math.log1p(srcRel));
      if (x < src.lo) { clipped++; return "below"; }
      if (x > src.hi) { clipped++; return "above"; }
      const y = br.map(x);
      return isVisible(dst) ? Math.round(y / P.JND.visibleNm) : Math.round(Math.log(y) / Math.log1p(P.JND.pitchRel));
    };
    const r = P.lossBits(xs, f);
    return Object.assign(r, { clippedShare: clipped / n, jnd: isVisible(dst) ? P.JND.visibleNm + " nm" : P.JND.pitchRel * 100 + "% of pitch" });
  };

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);
