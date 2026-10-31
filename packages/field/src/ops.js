// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* field/ops: operators shared by every field, so a motif spectrum and an image spectrum are one call.
   fft / ifft work on sequences and on 2D grids (radix-2; padding to a power of two is a converter, an
   embedding, never done silently). The butterfly is tools/perceive's (signal.js), passed in, not copied.
   Complex values are stored interleaved [re, im] with components = 2. The DFT is unscaled, so the unit
   stays the input's; the axis becomes frequency with spacing 1 / (n * step) in the inverse unit.
   Uncertainty: for independent noise of standard deviation s on each input value, each complex bin carries
   rms noise s * sqrt(n); a convolution carries s * sqrt(sum k^2). Graphs and meshes have no regular
   spectrum here: their Fourier basis needs the Laplacian's eigenvectors, which this package does not build. */
(function (g) {
  "use strict";
  const F = (g.Field = g.Field || {});
  const P = () => g.Perceive || require("../../perceive/src/index.js");
  const pow2 = (n) => n > 0 && (n & (n - 1)) === 0;
  const rmsSigma = (f) => (f.sigma === null ? null : typeof f.sigma === "number" ? f.sigma : Math.sqrt(f.sigma.reduce((a, s) => a + s * s, 0) / f.sigma.length));

  const split = (f) => {
    const n = f.values.length / f.components, re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) { re[i] = f.values[i * f.components]; im[i] = f.components === 2 ? f.values[i * 2 + 1] : 0; }
    return { re, im };
  };
  const join = (re, im) => { const v = new Float64Array(re.length * 2); for (let i = 0; i < re.length; i++) { v[2 * i] = re[i]; v[2 * i + 1] = im[i]; } return v; };

  const fft1 = (re, im, inverse) => {
    if (inverse) for (let i = 0; i < im.length; i++) im[i] = -im[i];
    P().fft(re, im);
    if (inverse) for (let i = 0; i < im.length; i++) { re[i] /= re.length; im[i] = -im[i] / re.length; }
  };

  /* Row and column passes over an h x w grid stored row-major. */
  const fft2 = (re, im, h, w, inverse) => {
    const r = new Float64Array(w), c = new Float64Array(w);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) { r[x] = re[y * w + x]; c[x] = im[y * w + x]; }
      fft1(r, c, inverse);
      for (let x = 0; x < w; x++) { re[y * w + x] = r[x]; im[y * w + x] = c[x]; }
    }
    const r2 = new Float64Array(h), c2 = new Float64Array(h);
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) { r2[y] = re[y * w + x]; c2[y] = im[y * w + x]; }
      fft1(r2, c2, inverse);
      for (let y = 0; y < h; y++) { re[y * w + x] = r2[y]; im[y * w + x] = c2[y]; }
    }
  };

  const freqDomain = (dom, inverse) => {
    const sp = (dom.spacing || dom.shape.map(() => ({ step: 1, unit: "1" }))).map((s, k) => {
      const n = dom.shape[k], u = F.unit(s.unit);
      return { step: 1 / (n * s.step), unit: F.unitInverse(u).name };
    });
    return Object.assign({}, dom, { spacing: sp, axis: inverse ? "position" : "frequency" });
  };

  const transform = (f, inverse) => {
    const dom = f.domain;
    if (!["sequence", "grid"].includes(dom.kind) || (dom.kind === "grid" && dom.shape.length !== 2))
      throw new F.FieldError(`fft needs a sequence or a 2D grid, got ${dom.kind}${dom.shape ? " " + dom.shape.join("x") : ""}`);
    if (!dom.shape.every(pow2)) throw new F.FieldError("fft needs power-of-two sides; pad with the pad converter first");
    if (f.symbolic) throw new F.FieldError("symbols have no spectrum; map them to numbers with a converter first");
    const { re, im } = split(f), n = re.length;
    if (dom.kind === "sequence") fft1(re, im, inverse); else fft2(re, im, dom.shape[0], dom.shape[1], inverse);
    const s = rmsSigma(f);
    return F.make({ name: (inverse ? "ifft " : "fft ") + f.name, domain: freqDomain(dom, inverse), values: join(re, im), components: 2,
      unit: f.unit, sigma: s === null ? null : inverse ? s / Math.sqrt(n) : s * Math.sqrt(n),
      prov: F.combineProv([f.prov], inverse ? "ifft" : "fft"), rep: { kind: "digital", encoding: "float64 complex" }, ledger: f.ledger });
  };
  F.fft = (f) => transform(f, false);
  F.ifft = (f) => transform(f, true);

  /* |X|^2 per bin, or |X| with root = true. */
  F.power = (f, root) => {
    if (f.components !== 2) throw new F.FieldError("power needs a complex field");
    const n = f.values.length / 2, v = new Float64Array(n);
    for (let i = 0; i < n; i++) { const p = f.values[2 * i] ** 2 + f.values[2 * i + 1] ** 2; v[i] = root ? Math.sqrt(p) : p; }
    return F.make({ name: "|" + f.name + (root ? "|" : "|^2"), domain: f.domain, values: v, unit: root ? f.unit : F.unitMul(f.unit, f.unit),
      sigma: null, prov: F.combineProv([f.prov], root ? "magnitude" : "power"), rep: f.rep, ledger: f.ledger });
  };

  /* Direct convolution on a sequence, same length (zero outside). kernel: plain numbers with a unit. */
  F.convolve = (f, kernel, kunit = "1") => {
    if (f.domain.kind !== "sequence" || f.components !== 1) throw new F.FieldError("convolve takes a real sequence");
    const n = f.values.length, m = kernel.length, h = Math.floor(m / 2), v = new Float64Array(n);
    for (let i = 0; i < n; i++) { let a = 0; for (let k = 0; k < m; k++) { const j = i + k - h; if (j >= 0 && j < n) a += f.values[j] * kernel[m - 1 - k]; } v[i] = a; }
    const s = rmsSigma(f), k2 = Math.sqrt(kernel.reduce((a, k) => a + k * k, 0));
    return F.make({ name: "conv " + f.name, domain: f.domain, values: v, unit: F.unitMul(f.unit, kunit), sigma: s === null ? null : s * k2,
      prov: F.combineProv([f.prov], "convolve"), rep: f.rep, ledger: f.ledger });
  };

  /* Compression ratio and density: the values coded at their grain (or the given one) and deflated (zlib,
     level 9, Node). Symbols are coded as UTF-8 JSON. density = packed bits per value. */
  F.compression = (f, grain) => {
    const zlib = require("zlib");
    let raw;
    if (f.symbolic) raw = Buffer.from(JSON.stringify(Array.from(f.values)), "utf8");
    else {
      const q = grain || (f.rep && f.rep.grain) || null;
      raw = q ? Buffer.from(Int32Array.from(f.values, (x) => Math.round(x / q)).buffer) : Buffer.from(Float64Array.from(f.values).buffer);
    }
    const packed = zlib.deflateSync(raw, { level: 9 });
    return { bytesRaw: raw.length, bytesPacked: packed.length, ratio: raw.length / packed.length, density: (8 * packed.length) / f.values.length };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = F;
})(typeof globalThis !== "undefined" ? globalThis : this);
