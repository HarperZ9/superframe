/* transducers/lens: lens and mirror are the two ends of one transfer function H(fx, fy). A mirror has a flat H,
   its reflectance; a lens has H = the optical transfer function of its pupil. An absorber is the same flat H.
   Glass comes from measured Sellmeier rows through the adapter; n and k of metals from the materials records. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();
  const LAMBDA = { F: 486.1327, d: 587.5618, C: 656.2725 };
  T.LINES = LAMBDA;

  T.sellmeier = (r, nm) => {
    const l2 = (nm / 1000) ** 2;
    return Math.sqrt(1 + (r.B1 * l2) / (l2 - r.C1) + (r.B2 * l2) / (l2 - r.C2) + (r.B3 * l2) / (l2 - r.C3));
  };
  T.abbe = (r) => (T.sellmeier(r, LAMBDA.d) - 1) / (T.sellmeier(r, LAMBDA.F) - T.sellmeier(r, LAMBDA.C));
  /* A thin lens made for f at the d line has its focus at f (nd - 1) / (n - 1) at other wavelengths. */
  T.focalAt = (r, fd, nm) => (fd * (T.sellmeier(r, LAMBDA.d) - 1)) / (T.sellmeier(r, nm) - 1);
  T.fresnelNormal = (n, k = 0, n0 = 1) => ((n - n0) ** 2 + k * k) / ((n + n0) ** 2 + k * k);

  /* In-place complex 2D transform through the field type's FFT, so no second FFT lives here. */
  T.fft2c = (re, im, h, w, inv) => {
    const Fd = F(), vals = new Float64Array(2 * re.length);
    for (let i = 0; i < re.length; i++) { vals[2 * i] = re[i]; vals[2 * i + 1] = im[i]; }
    const f = Fd.make({ name: "c", domain: { kind: "grid", shape: [h, w] }, values: vals, components: 2, unit: "1", sigma: null, prov: { status: "defined" }, rep: { kind: "digital", bits: 64 } });
    const o = (inv ? Fd.ifft : Fd.fft)(f).values;
    for (let i = 0; i < re.length; i++) { re[i] = o[2 * i]; im[i] = o[2 * i + 1]; }
  };

  /* Pupil phase in waves at normalised radius rho: W020 rho^2 (defocus) + W040 rho^4 (spherical). */
  const pupil = (N, rad, w020, w040) => {
    const re = new Float64Array(N * N), im = new Float64Array(N * N), r2 = rad * rad;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const a = ((x + N / 2) % N) - N / 2, b = ((y + N / 2) % N) - N / 2, d = (a * a + b * b) / r2;
      if (d > 1) continue;
      const ph = 2 * Math.PI * (w020 * d + w040 * d * d);
      re[y * N + x] = Math.cos(ph); im[y * N + x] = Math.sin(ph);
    }
    return { re, im };
  };
  /* Incoherent PSF on an N x N grid, origin at index 0, sum 1, sampled at dxUm per sample. */
  T.psfMono = (o) => {
    const N = o.N, rad = ((o.apertureMm * 1e-3) / 2) * ((N * o.dxUm * 1e-6) / (o.nm * 1e-9 * o.fMm * 1e-3));
    if (rad > N / 4) throw new (F().FieldError)(`psf: pupil radius ${rad.toFixed(1)} samples undersamples the grid; refine dx or enlarge N`);
    const P = pupil(N, rad, o.w020 || 0, o.w040 || 0);
    T.fft2c(P.re, P.im, N, N, false);
    const v = new Float64Array(N * N); let s = 0;
    for (let i = 0; i < v.length; i++) { v[i] = P.re[i] ** 2 + P.im[i] ** 2; s += v[i]; }
    for (let i = 0; i < v.length; i++) v[i] /= s;
    return v;
  };
  /* Defocus in waves from a focus shift dz (mm) at f-number N: W020 = -dz / (8 N^2 lambda). */
  T.defocusWaves = (dzMm, fnum, nm) => (-dzMm * 1e-3) / (8 * fnum * fnum * nm * 1e-9);
  /* The polychromatic PSF of a singlet focused at d: each wavelength gets its own pupil scale and defocus. */
  T.psfGlass = (o) => {
    const fnum = o.fMm / o.apertureMm, v = new Float64Array(o.N * o.N), nms = o.nms || [LAMBDA.F, LAMBDA.d, LAMBDA.C];
    for (const nm of nms) {
      const dz = T.focalAt(o.glass, o.fMm, nm) - o.fMm - (o.focusShiftMm || 0);
      const p = T.psfMono({ N: o.N, dxUm: o.dxUm, apertureMm: o.apertureMm, fMm: o.fMm, nm, w020: T.defocusWaves(dz, fnum, nm), w040: o.w040 || 0 });
      for (let i = 0; i < v.length; i++) v[i] += p[i] / nms.length;
    }
    return v;
  };
  const circularConvolve = (x, psf, h, w) => {
    const ar = Float64Array.from(x), ai = new Float64Array(x.length), br = Float64Array.from(psf), bi = new Float64Array(x.length);
    T.fft2c(ar, ai, h, w, false); T.fft2c(br, bi, h, w, false);
    for (let i = 0; i < x.length; i++) { const r = ar[i] * br[i] - ai[i] * bi[i]; ai[i] = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; }
    T.fft2c(ar, ai, h, w, true);
    return ar;
  };
  T.centroid = (v, h, w) => {
    let sx = 0, sy = 0, s = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = x < w / 2 ? x : x - w, b = y < h / 2 ? y : y - h, p = v[y * w + x];
      sx += a * p; sy += b * p; s += p;
    }
    return [sx / s, sy / s];
  };
  /* Convolution with a stated PSF. The keeps check refuses a PSF that moves the image or does not conserve flux. */
  T.convolvePsf = (psf, o = {}) => {
    const noise = o.noise || 1e-6, id = o.id || "lens.psf";
    return T.kernel({
      id, group: "lens", axes: ["light", "space"], claims: "homomorphism", physics: o.physics || [],
      from: { domain: "grid", rep: "digital" }, to: { domain: "grid", rep: "digital" },
      forward: (f) => {
        const { h, w } = T.gridOf(f);
        if (psf.length !== f.values.length) throw new (F().FieldError)(`${id}: PSF of ${psf.length} on a grid of ${f.values.length}`);
        const s = typeof f.sigma === "number" ? f.sigma * Math.sqrt(psf.reduce((a, k) => a + k * k, 0)) : null;
        return { values: circularConvolve(f.values, psf, h, w), sigma: s };
      },
      keeps: { name: "flux and centroid", check: (s) => {
        const { h, w } = T.gridOf(s), c = T.centroid(psf, h, w), sum = psf.reduce((a, b) => a + b, 0);
        return { ok: Math.hypot(c[0], c[1]) < 0.5 && Math.abs(sum - 1) < 1e-9, detail: `centroid ${c[0].toFixed(3)}, ${c[1].toFixed(3)} px, PSF sum ${sum}` };
      } },
      loss: (s, out) => T.capacityLoss(s, out, o.noiseOf ? o.noiseOf(s) : noise),
      budgetMap: (b) => Object.assign({}, b, { dx: b.dx * Math.max(1, o.blurPx || 1) }),
    });
  };
  T.thinLens = (o) => T.convolvePsf(T.psfGlass(o), { id: `lens.thin ${o.glass.glass} f/${(o.fMm / o.apertureMm).toFixed(1)}`, noise: o.noise, noiseOf: o.noiseOf, physics: [o.glass.prov] });

  /* A flat transfer function: a mirror at reflectance R, an absorber at transmittance t. The round trip divides it
     back out. The float round trip loses nothing; the noise floor is what takes the bits. */
  T.attenuator = (R, o = {}) => T.kernel({
    id: o.id || "mirror", group: o.group || "lens", axes: o.axes || ["light"], claims: o.claims || "isomorphism", tol: o.tol === undefined ? (R === 1 ? 0 : 1e-9) : o.tol, physics: o.physics || [],
    from: { rep: "digital" }, to: { rep: "digital" },
    forward: (f) => ({ values: R === 1 ? f.values.slice() : Float64Array.from(f.values, (x) => x * R), sigma: typeof f.sigma === "number" ? f.sigma * R : f.sigma }),
    inverse: (y) => (R === 1 ? y.values.slice() : Float64Array.from(y.values, (x) => x / R)),
    targets: (s, y) => F().derive(y, { values: Float64Array.from(y.values, (x, i) => x * (1 + 1e-3 * Math.sin(i))), method: "target" }),
    loss: o.noise || o.noiseOf ? (s, y) => T.capacityLoss(s, y, o.noiseOf ? o.noiseOf(s) : o.noise) : undefined,
  });
  T.mirror = (R = 1, o = {}) => T.attenuator(R, Object.assign({ id: "mirror R=" + R.toFixed(4), group: "lens", axes: ["light"] }, o));
  T.metalMirror = (id, nm, o = {}) => {
    const q = T.nk(id, nm), R = T.fresnelNormal(q.n, q.k);
    return T.mirror(R, Object.assign({ id: `mirror.${id}@${nm}nm`, physics: [{ status: "measured", source: q.source }] }, o));
  };

  /* Metamer lens: a spectrum to the three numbers a standard observer keeps. The check adds a metameric black,
     a spectrum in the null space of the matching functions, and demands no response to it. */
  T.xyzOf = (spec, nm0, dnm) => {
    const C = T.cmf(), o = [0, 0, 0];
    for (let i = 0; i < spec.length; i++) {
      const a = Math.floor((nm0 + i * dnm - C.start) / C.step);
      if (a < 0 || a >= C.xyz.length) continue;
      for (let c = 0; c < 3; c++) o[c] += spec[i] * C.xyz[a][c] * dnm;
    }
    return o;
  };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const orthogonalise = (v, B) => { for (const b of B) { const k = dot(v, b) / dot(b, b); for (let i = 0; i < v.length; i++) v[i] -= k * b[i]; } };
  T.metamericBlack = (n, nm0, dnm, seed = 1) => {
    const r = T.rng(seed, "black"), C = T.cmf(), v = Float64Array.from({ length: n }, () => T.gauss(r)), B = [];
    for (let c = 0; c < 3; c++) {
      const b = Float64Array.from({ length: n }, (_, i) => { const a = Math.floor((nm0 + i * dnm - C.start) / C.step); return a >= 0 && a < C.xyz.length ? C.xyz[a][c] : 0; });
      orthogonalise(b, B); B.push(b);
    }
    orthogonalise(v, B); orthogonalise(v, B);
    return v;
  };
  T.metamerLens = (nm0 = 380, dnm = 5, grain = 1e-3) => T.kernel({
    id: "lens.metamer", group: "lens", axes: ["light"], claims: "homomorphism",
    physics: [{ status: "measured", source: "CIE 018:2019 via perceive" }], from: { domain: "sequence", rep: "digital" }, to: { domain: "sequence", rep: "digital" },
    forward: (f) => {
      const c = f.components, n = f.values.length / c;
      if (c === 1) return { values: Float64Array.from(T.xyzOf(f.values, nm0, dnm)), domain: { kind: "sequence", shape: [3] } };
      const o = new Float64Array(3 * n);
      for (let i = 0; i < n; i++) o.set(T.xyzOf(f.values.subarray(i * c, (i + 1) * c), nm0, dnm), 3 * i);
      return { values: o, domain: { kind: "sequence", shape: [n] }, components: 3 };
    },
    keeps: { name: "metameric blacks vanish", check: (s) => {
      const K = s.components === 1 ? s.values.length : s.components, a = T.xyzOf(T.metamericBlack(K, nm0, dnm), nm0, dnm), m = Math.max(...a.map(Math.abs));
      return { ok: m < 1e-9, detail: `observer response to a metameric black ${m.toExponential(2)}` };
    } },
    loss: (s, o) => T.budgetLoss(s, o, grain, grain),
  });
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
