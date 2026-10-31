// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* perceive/spectral: the window operator, blackbody and line spectra, and wavelength to colour.

   One operator for every spectrum: pick a window [lo, hi] on the source axis and a target window (the
   visible band in nm, or the audible band in Hz), each with a scale (linear, log, mel, or cie: equal steps
   of CIE 1976 u'v' distance along the spectral locus). The bridge maps through the unit interval, so it is
   invertible inside the window; outside it the value is clipped and the loss reporter counts it. */
(function (g) {
  "use strict";
  const P = (g.Perceive = g.Perceive || {});
  /* Constants come from packages/measured/generated/constants.js (CODATA 2022), never a hand copy. In a page,
     load that file before this one (it sets MeasuredConstants). In Node, require it. constants.js is CommonJS,
     but it sits in the root "type": "module" package, so require can return an empty namespace; the JSON
     written by the same generator carries the same values and is the fallback until measured declares its type. */
  const measured = () => {
    if (g.MeasuredConstants) return g.MeasuredConstants;
    if (typeof require !== "function") throw new Error("perceive: load packages/measured/generated/constants.js first");
    const m = require("../../measured/generated/constants.js");
    if (m && typeof m.c === "number") return m;
    if (g.MeasuredConstants) return g.MeasuredConstants;
    const j = require("../../measured/generated/constants.json").constants;
    return Object.fromEntries(Object.keys(j).map((k) => [k, j[k].value]));
  };
  const MC = measured();
  P.C = Object.freeze({ c: MC.c, h: MC.h, kB: MC.kB, wienB: MC.wienB, mu0: MC.mu0, ke: MC.ke, source: "CODATA 2022 via packages/measured" });
  P.VISIBLE = [380, 750];
  P.AUDIBLE = [20, 20000];

  /* Colour-matching functions by linear interpolation of the 5 nm table; zero outside 380 to 780 nm. */
  P.cmf = (nm) => {
    const t = P.CMF, x = (nm - t.start) / t.step, i = Math.floor(x);
    if (i < 0 || i >= t.xyz.length - 1) return [0, 0, 0];
    const a = t.xyz[i], b = t.xyz[i + 1], f = x - i;
    return [0, 1, 2].map((k) => a[k] + f * (b[k] - a[k]));
  };

  /* Equal-perceptual-step coordinate along the spectral locus: cumulative u'v' distance, 380 to 780 nm. */
  let CIE_TABLE = null;
  function cieTable() {
    if (CIE_TABLE) return CIE_TABLE;
    const nm = [], s = [];
    let acc = 0, prev = null;
    for (let w = 380; w <= 780; w += 0.5) {
      const [X, Y, Z] = P.cmf(w), d = X + 15 * Y + 3 * Z || 1e-12, uv = [4 * X / d, 9 * Y / d];
      if (prev) acc += Math.hypot(uv[0] - prev[0], uv[1] - prev[1]) + 1e-5; // floor keeps it strictly monotone
      prev = uv; nm.push(w); s.push(acc);
    }
    return (CIE_TABLE = { nm, s });
  }
  function interp(xs, ys, x) {
    let lo = 0, hi = xs.length - 1;
    if (x <= xs[0]) return ys[0] + (x - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0]);
    if (x >= xs[hi]) return ys[hi] + (x - xs[hi]) * (ys[hi] - ys[hi - 1]) / (xs[hi] - xs[hi - 1]);
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    return ys[lo] + (x - xs[lo]) * (ys[hi] - ys[lo]) / (xs[hi] - xs[lo]);
  }
  const SCALES = {
    linear: { f: (x) => x, i: (y) => y },
    log: { f: Math.log, i: Math.exp },
    mel: { f: (x) => 2595 * Math.log10(1 + x / 700), i: (m) => 700 * (10 ** (m / 2595) - 1) },
    cie: { f: (x) => interp(cieTable().nm, cieTable().s, x), i: (y) => interp(cieTable().s, cieTable().nm, y) },
  };
  P.SCALE_NAMES = { linear: "linear", log: "logarithmic", mel: "mel (equal pitch steps, Stevens, Volkmann and Newman 1937)", cie: "CIE 1976 u'v' equal steps along the spectral locus" };

  P.window = (lo, hi, scale = "linear") => {
    const S = SCALES[scale];
    if (!S) throw new Error("unknown scale " + scale);
    const a = S.f(lo), b = S.f(hi);
    return { lo, hi, scale, u: (x) => (S.f(x) - a) / (b - a), x: (u) => S.i(a + u * (b - a)), contains: (x) => x >= lo && x <= hi };
  };
  /* Bridge a source window into a target window. flip reverses order (for example wavelength into pitch). */
  P.bridge = (src, dst, flip = false) => ({
    src, dst, flip,
    contains: src.contains,
    map: (x) => dst.x(flip ? 1 - src.u(x) : src.u(x)),
    inverse: (y) => src.x(flip ? 1 - dst.u(y) : dst.u(y)),
  });

  /* Planck spectral radiance per unit wavelength, W sr^-1 m^-3. */
  P.planck = (lam, T) => {
    const { h, c, kB } = P.C;
    return (2 * h * c * c) / lam ** 5 / Math.expm1((h * c) / (lam * kB * T));
  };
  /* Argmax of the Planck curve by a log-spaced scan and golden-section refinement (no use of Wien's constant). */
  P.wienPeak = (T) => {
    let best = 0, bx = 0;
    for (let e = -9; e <= -1; e += 0.01) { const v = P.planck(10 ** e, T); if (v > best) { best = v; bx = e; } }
    let a = bx - 0.01, b = bx + 0.01;
    const gr = (Math.sqrt(5) - 1) / 2, f = (e) => -P.planck(10 ** e, T);
    for (let k = 0; k < 80; k++) {
      const c1 = b - gr * (b - a), c2 = a + gr * (b - a);
      if (f(c1) < f(c2)) b = c2; else a = c1;
    }
    return 10 ** ((a + b) / 2);
  };

  /* Line spectra, wavelengths in nm (NIST Atomic Spectra Database values, air wavelengths in the visible). */
  P.LINES = {
    hydrogen: { name: "Hydrogen", lines: [[121.567, 1, "Lyman alpha (ultraviolet)"], [102.572, 0.3, "Lyman beta"], [656.28, 1, "H-alpha"], [486.13, 0.5, "H-beta"], [434.05, 0.3, "H-gamma"], [410.17, 0.2, "H-delta"], [1875.1, 0.4, "Paschen alpha (infrared)"], [1281.8, 0.2, "Paschen beta"]] },
    sodium: { name: "Sodium lamp", lines: [[588.995, 1, "D2"], [589.592, 0.5, "D1"], [818.3, 0.15, "near infrared"], [819.5, 0.15, "near infrared"]] },
    aurora: { name: "Aurora", lines: [[557.73, 1, "oxygen green"], [630.03, 0.4, "oxygen red"], [636.38, 0.15, "oxygen red"], [427.81, 0.3, "N2+ blue"], [391.44, 0.35, "N2+ violet-ultraviolet"], [777.4, 0.1, "oxygen near infrared"]] },
  };

  /* XYZ to linear sRGB (D65). Out-of-gamut colours are desaturated toward white until no channel is negative;
     the reported loss is the white amount added, as a share of the result. */
  P.xyzToRgb = (X, Y, Z) => {
    let r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z;
    let gg = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z;
    let b = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
    const m = Math.min(r, gg, b), w = m < 0 ? -m : 0;
    r += w; gg += w; b += w;
    const mx = Math.max(r, gg, b, 1e-12);
    return { linear: [r, gg, b], white: w / mx, outOfGamut: w > 0 };
  };
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  P.encode = (lin) => lin.map((v) => Math.max(0, Math.min(1, enc(Math.max(0, v)))));
  /* A single wavelength as a display colour, normalised to its brightest channel. */
  P.spectralRgb = (nm, intensity = 1) => {
    const [X, Y, Z] = P.cmf(nm), c = P.xyzToRgb(X, Y, Z), mx = Math.max(...c.linear, 1e-12);
    return { rgb: P.encode(c.linear.map((v) => (v / mx) * intensity)), white: c.white, outOfGamut: c.outOfGamut, Y };
  };
  /* A sampled spectrum (nm, power) as one display colour. */
  P.spectrumRgb = (pairs) => {
    let X = 0, Y = 0, Z = 0;
    for (const [nm, p] of pairs) { const c = P.cmf(nm); X += c[0] * p; Y += c[1] * p; Z += c[2] * p; }
    const c = P.xyzToRgb(X, Y, Z), mx = Math.max(...c.linear, 1e-12);
    return { rgb: P.encode(c.linear.map((v) => v / mx)), white: c.white, Y };
  };
  P.css = (rgb) => "rgb(" + rgb.map((v) => Math.round(v * 255)).join(",") + ")";
  P.hueAngle = ([r, gg, b]) => {
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
    if (d < 1e-9) return 0;
    let h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
    h *= 60;
    return h < 0 ? h + 360 : h;
  };
  P.hueName = (h) => {
    const names = [[15, "red"], [40, "orange"], [62, "yellow"], [100, "yellow-green"], [150, "green"], [190, "cyan"], [250, "blue"], [290, "violet"], [330, "magenta"], [360, "red"]];
    return names.find(([lim]) => h < lim)[1];
  };

  /* Band names along the electromagnetic and acoustic axes. EM in metres of wavelength, sound in hertz. */
  P.EM_BANDS = [[1e-15, 1e-11, "gamma rays"], [1e-11, 1e-8, "X-rays"], [1e-8, 380e-9, "ultraviolet"], [380e-9, 750e-9, "visible light"],
    [750e-9, 1e-3, "infrared"], [1e-3, 1, "microwaves"], [1, 1e5, "radio"]];
  P.SOUND_BANDS = [[1e-3, 20, "infrasound"], [20, 20000, "hearing"], [20000, 1e7, "ultrasound"]];
  P.bandOf = (bands, x) => (bands.find(([a, b]) => x >= a && x < b) || [0, 0, "beyond the chart"])[2];

  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof globalThis !== "undefined" ? globalThis : this);
