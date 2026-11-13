/* transducers/space: one Laplacian eigenbasis for heat, sound and fog light, distance from a heat kernel, signed
   distance and sampling lattices. This is the JavaScript form of the 2026-10-31 modal study: small domains, no
   dependency. The study's Python basis stays the reference and a test compares the two through the adapter. */
(function (g) {
  "use strict";
  const T = (g.Transducers = g.Transducers || {});
  const F = () => T.Field();

  /* Cyclic Jacobi for a symmetric matrix A (n x n, row-major, destroyed). Returns ascending values and columns. */
  T.jacobiEig = (A, n) => {
    const V = new Float64Array(n * n);
    for (let i = 0; i < n; i++) V[i * n + i] = 1;
    for (let sweep = 0; sweep < 30; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] ** 2;
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const th = (A[q * n + q] - A[p * n + p]) / (2 * apq), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const a = A[k * n + p], b = A[k * n + q]; A[k * n + p] = c * a - s * b; A[k * n + q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = A[p * n + k], b = A[q * n + k]; A[p * n + k] = c * a - s * b; A[q * n + k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k * n + p], b = V[k * n + q]; V[k * n + p] = c * a - s * b; V[k * n + q] = s * a + c * b; }
      }
    }
    const ord = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[a * n + a] - A[b * n + b]);
    const lam = Float64Array.from(ord, (i) => A[i * n + i]), vec = new Float64Array(n * n);
    ord.forEach((c, j) => { for (let k = 0; k < n; k++) vec[k * n + j] = V[k * n + c]; });
    return { lam, vec };
  };
  /* A mask's Neumann Laplacian with cell size h: each edge between live cells adds 1 / h^2. */
  T.maskLaplacian = (mask, H, W, h = 1) => {
    const id = new Int32Array(H * W).fill(-1); let n = 0;
    for (let i = 0; i < H * W; i++) if (mask[i]) id[i] = n++;
    const A = new Float64Array(n * n), c = 1 / (h * h);
    const link = (a, b) => { if (a >= 0 && b >= 0) { A[a * n + a] += c; A[b * n + b] += c; A[a * n + b] -= c; A[b * n + a] -= c; } };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = id[y * W + x]; if (x + 1 < W) link(a, id[y * W + x + 1]); if (y + 1 < H) link(a, id[(y + 1) * W + x]); }
    return { A, n, id };
  };
  T.modes = (mask, H, W, h = 1) => {
    const L = T.maskLaplacian(mask, H, W, h), d = L.A.slice(), e = T.jacobiEig(d, L.n);
    return Object.assign(e, { n: L.n, id: L.id, H, W, h, A: L.A });
  };
  T.lShape = (N) => { const m = new Uint8Array(N * N).fill(1); for (let y = 0; y < N / 2; y++) for (let x = N / 2; x < N; x++) m[y * N + x] = 0; return m; };
  T.neumannSquare = (p, q, N, h = 1) => (2 - 2 * Math.cos((Math.PI * p) / N) + 2 - 2 * Math.cos((Math.PI * q) / N)) / (h * h);

  const toNodes = (M, f) => { const v = new Float64Array(M.n); for (let i = 0; i < M.id.length; i++) if (M.id[i] >= 0) v[M.id[i]] = f[i]; return v; };
  const fromNodes = (M, v) => { const o = new Float64Array(M.H * M.W); for (let i = 0; i < M.id.length; i++) if (M.id[i] >= 0) o[i] = v[M.id[i]]; return o; };
  const project = (M, v, K) => { const c = new Float64Array(K); for (let j = 0; j < K; j++) { let s = 0; for (let i = 0; i < M.n; i++) s += M.vec[i * M.n + j] * v[i]; c[j] = s; } return c; };
  const rebuild = (M, c) => { const v = new Float64Array(M.n); for (let j = 0; j < c.length; j++) for (let i = 0; i < M.n; i++) v[i] += M.vec[i * M.n + j] * c[j]; return v; };
  T.dMax = (M, K, t) => 2 * t * Math.sqrt(M.lam[K - 1]);
  T.weylCount = (area, lambda) => (area * lambda) / (4 * Math.PI);

  /* Field to K modal coefficients. Full rank is an embedding; a truncated basis keeps the lowest-order structure. */
  T.modal = (M, K) => T.kernel({
    id: `space.modal K=${K}/${M.n}`, group: "space", axes: ["space"], claims: K === M.n ? "embedding" : "homomorphism", tol: K === M.n ? 1e-8 : 1 / 64, from: { domain: "grid" }, to: { domain: "sequence" },
    forward: (f) => ({ values: project(M, toNodes(M, f.values), K), domain: { kind: "sequence", shape: [K], lambda: M.lam[K - 1], weyl: T.weylCount(M.n * M.h * M.h, M.lam[K - 1]) }, sigma: null }),
    inverse: (y) => fromNodes(M, rebuild(M, y.values)),
    keeps: { name: "mean kept through the constant mode", check: (s, y) => {
      const a = toNodes(M, s.values).reduce((p, x) => p + x, 0) / M.n, c0 = Math.sign(M.vec[0]) * y.values[0] / Math.sqrt(M.n);
      return { ok: Math.abs(a - c0) < 1e-8, detail: `mean ${a.toFixed(5)}, from mode 0 ${c0.toFixed(5)}` };
    } },
  });
  /* The physics is one filter on the eigenvalue. */
  T.FILTERS = {
    heat: (t) => (l) => Math.exp(-l * t),
    fog: (sigma2) => (l) => sigma2 / (l + sigma2),
    sound: (k2, damp) => (l) => { const d = l - k2; return d / (d * d + damp * damp); },
  };
  T.modalFilter = (M, name, fn, K = M.n, o = {}) => T.kernel({
    id: `space.${name}`, group: "space", axes: o.axes || ["space", "time"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "grid" },
    forward: (f) => { const c = project(M, toNodes(M, f.values), K); for (let j = 0; j < K; j++) c[j] *= fn(M.lam[j]); return { values: fromNodes(M, rebuild(M, c)), sigma: null }; },
    keeps: { name: o.keepName || "stays finite", check: (s, y) => ({ ok: y.values.every(Number.isFinite), detail: "finite" }) },
    loss: (s, y) => T.condLoss(s, y, o.gx || 1 / 256, o.gy || 1 / 256),
  });
  /* Full-rank direct references for the tests: dense (L + s I) x = b. */
  T.denseSolve = (A0, n, b0, shift) => {
    const A = A0.slice(), b = Float64Array.from(b0);
    for (let i = 0; i < n; i++) A[i * n + i] += shift;
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]) > Math.abs(A[p * n + c])) p = r;
      if (p !== c) { for (let k = 0; k < n; k++) { const t = A[c * n + k]; A[c * n + k] = A[p * n + k]; A[p * n + k] = t; } const t = b[c]; b[c] = b[p]; b[p] = t; }
      for (let r = c + 1; r < n; r++) { const m = A[r * n + c] / A[c * n + c]; if (!m) continue; for (let k = c; k < n; k++) A[r * n + k] -= m * A[c * n + k]; b[r] -= m * b[c]; }
    }
    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r * n + k] * x[k]; x[r] = s / A[r * n + r]; }
    return x;
  };
  T.nodeToGrid = fromNodes; T.gridToNode = toNodes;

  /* Varadhan: d = sqrt(-4 t ln(4 pi t k_t)). The truncated kernel holds out to d_max = 2 t sqrt(lambda_K). */
  T.varadhan = (M, srcCell, t, K = M.n) => T.kernel({
    id: `space.varadhan t=${t} K=${K}`, group: "space", axes: ["space", "time"], claims: "homomorphism", from: { domain: "grid" }, to: { domain: "grid", unit: "m" },
    forward: () => {
      const s = M.id[srcCell], o = new Float64Array(M.n), h2 = M.h * M.h;
      for (let i = 0; i < M.n; i++) {
        let k = 0; for (let j = 0; j < K; j++) k += Math.exp(-M.lam[j] * t) * M.vec[i * M.n + j] * M.vec[s * M.n + j];
        o[i] = Math.sqrt(Math.max(0, -4 * t * Math.log(Math.max(1e-300, (4 * Math.PI * t * k) / h2))));
      }
      return { values: fromNodes(M, o), unit: "m", sigma: null, rep: { kind: "digital", bits: 64, encoding: "float64", dMax: T.dMax(M, K, t) } };
    },
    keeps: { name: "nearest at the source", check: (s, y) => { const v = toNodes(M, y.values), a = v[M.id[srcCell]], m = Math.min(...v); return { ok: a <= m + 1e-9, detail: `at source ${a.toFixed(3)}, least ${m.toFixed(3)}` }; } },
    loss: (s, y) => T.budgetLoss(s, y, 1 / 256, 1 / 16),
  });

  /* The study's spherical-harmonic maths, reused through the adapter, as one kernel on the Fibonacci sphere. */
  T.shIrradiance = (L, N = 4096, M2 = 512) => {
    const S = require(T.rootPath("field/demos/sh_math.js")), LMAX = Math.max(L, 2), dirs = S.fibonacci(N), nor = S.fibonacci(M2, 0.37);
    const bmD = S.basisMatrix(LMAX, dirs), bmN = S.basisMatrix(LMAX, nor), W = S.bandWeights(S.KERNELS.lambert, LMAX), dO = (4 * Math.PI) / N;
    return { dirs, normals: nor, kernel: T.kernel({
      id: `sphere.sh-irradiance L=${L}`, group: "space", axes: ["light", "space"], claims: "homomorphism", from: { domain: "sequence" }, to: { domain: "sequence" },
      forward: (f) => { const v = S.evaluate(bmN, S.project(bmD, f.values, dO, LMAX), L, W); return { values: v, domain: { kind: "sequence", shape: [M2] }, sigma: null }; },
      keeps: { name: "non-negative mean", check: (s, y) => { const m = y.values.reduce((a, b) => a + b, 0); return { ok: m >= 0, detail: "mean sign" }; } },
      loss: (s, y) => T.budgetLoss(s, y, 1 / 64, 1 / 64),
    }) };
  };

  /* Exact squared distance transform: Felzenszwalb and Huttenlocher's lower envelope, one row then one column. */
  const edt1 = (f, n) => {
    const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s;
      for (;;) { s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s > z[k] || k === 0) break; k--; }
      k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
    return d;
  };
  T.edt2 = (seed, H, W) => {
    const BIG = 1e20, g2 = Float64Array.from(seed, (x) => (x ? 0 : BIG));
    const col = new Float64Array(H), row = new Float64Array(W);
    for (let x = 0; x < W; x++) { for (let y = 0; y < H; y++) col[y] = g2[y * W + x]; const d = edt1(col, H); for (let y = 0; y < H; y++) g2[y * W + x] = d[y]; }
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) row[x] = g2[y * W + x]; g2.set(edt1(row, W), y * W); }
    return g2;
  };
  /* Mask to signed distance. Negative inside; the sign alone returns the mask, so nothing is lost. */
  T.sdf = () => T.kernel({
    id: "space.sdf", group: "space", axes: ["space"], claims: "embedding", from: { domain: "grid" }, to: { domain: "grid", unit: "px" },
    forward: (f) => {
      const { h, w } = T.gridOf(f), inv = Float64Array.from(f.values, (x) => (x ? 0 : 1)), a = T.edt2(inv, h, w), b = T.edt2(f.values, h, w), v = new Float64Array(h * w);
      for (let i = 0; i < v.length; i++) v[i] = f.values[i] ? -Math.sqrt(a[i]) + 0.5 : Math.sqrt(b[i]) - 0.5;
      return { values: v, unit: "px", sigma: null };
    },
    inverse: (y) => Float64Array.from(y.values, (d) => (d < 0 ? 1 : 0)),
  });

  /* Sampling a grid on a lattice at a stated density, and rebuilding by normalised Gaussian interpolation. */
  T.latticePoints = (kind, n, N, seed = 1) => {
    const s = Math.sqrt((N * N) / n), pts = [], r = T.rng(seed, "lattice-" + kind);
    if (kind === "hex") { const a = s * Math.sqrt(2 / Math.sqrt(3)), b = (a * Math.sqrt(3)) / 2; let row = 0; for (let y = 0; y < N; y += b, row++) for (let x = row % 2 ? a / 2 : 0; x < N; x += a) pts.push(x, y); }
    else if (kind === "white") for (let i = 0; i < n; i++) pts.push(r() * N, r() * N);
    else for (let y = 0; y < N; y += s) for (let x = 0; x < N; x += s) pts.push((x + (kind === "jitter" ? r() * s : 0)) % N, (y + (kind === "jitter" ? r() * s : 0)) % N);
    return Float64Array.from(pts);
  };
  const bilinear = (v, N, x, y) => {
    const a = Math.floor(x), b = Math.floor(y), u = x - a, t = y - b, at = (p, q) => v[((q + N) % N) * N + (p + N) % N];
    return at(a, b) * (1 - u) * (1 - t) + at(a + 1, b) * u * (1 - t) + at(a, b + 1) * (1 - u) * t + at(a + 1, b + 1) * u * t;
  };
  T.rebuildFromPoints = (pts, N, density) => {
    const s = 0.75 / Math.sqrt(density), r2 = Math.ceil(3 * s), acc = new Float64Array(N * N), wt = new Float64Array(N * N);
    for (let i = 0; i < pts.length; i += 3) {
      const X = Math.round(pts[i]), Y = Math.round(pts[i + 1]);
      for (let a = -r2; a <= r2; a++) for (let b = -r2; b <= r2; b++) {
        const x = (X + b + N) % N, y = (Y + a + N) % N, dx = X + b - pts[i], dy = Y + a - pts[i + 1], w = Math.exp(-(dx * dx + dy * dy) / (2 * s * s));
        acc[y * N + x] += w * pts[i + 2]; wt[y * N + x] += w;
      }
    }
    return acc.map((x, i) => x / Math.max(wt[i], 1e-12));
  };
  T.lattice = (kind, n, o = {}) => {
    let N = 0;
    return T.kernel({
      id: `space.lattice ${kind} n=${n}`, group: "space", axes: ["space"], claims: "homomorphism", tol: o.tol || 1 / 64, from: { domain: "grid" }, to: { domain: "sequence" },
      forward: (f) => {
        N = f.domain.shape[0];
        const p = T.latticePoints(kind, n, N, o.seed || 1), m = p.length / 2, v = new Float64Array(3 * m);
        for (let i = 0; i < m; i++) { v[3 * i] = p[2 * i]; v[3 * i + 1] = p[2 * i + 1]; v[3 * i + 2] = bilinear(f.values, N, p[2 * i], p[2 * i + 1]); }
        return { values: v, domain: { kind: "sequence", shape: [m] }, components: 3, sigma: null };
      },
      inverse: (y) => (o.kmax ? T.rebuildBand(y.values, N, o.kmax) : T.rebuildFromPoints(y.values, N, y.values.length / 3 / (N * N))),
      keeps: { name: "density as stated within twenty percent", check: (s, y) => { const m = y.values.length / 3; return { ok: Math.abs(m - n) < 0.2 * n, detail: `${m} points for ${n}` }; } },
    });
  };
  /* Least-squares rebuild with the field's own band as the basis: every mode with |k| at most kmax. */
  T.bandBasis = (kmax) => { const b = []; for (let a = -kmax; a <= kmax; a++) for (let c = 0; c <= kmax; c++) if ((c > 0 || a >= 0) && a * a + c * c <= kmax * kmax) { b.push([a, c, 0]); if (a || c) b.push([a, c, 1]); } return b; };
  const basisAt = (B, N, x, y) => Float64Array.from(B, ([a, c, s]) => { const p = (2 * Math.PI * (a * x + c * y)) / N; return s ? Math.sin(p) : Math.cos(p); });
  T.rebuildBand = (pts, N, kmax, ridge = 1e-8) => {
    const B = T.bandBasis(kmax), m = B.length, A = new Float64Array(m * m), r = new Float64Array(m);
    for (let i = 0; i < pts.length; i += 3) { const u = basisAt(B, N, pts[i], pts[i + 1]); for (let p = 0; p < m; p++) { r[p] += u[p] * pts[i + 2]; for (let q = 0; q < m; q++) A[p * m + q] += u[p] * u[q]; } }
    const c = T.denseSolve(A, m, r, ridge), o = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = basisAt(B, N, x, y); let s = 0; for (let p = 0; p < m; p++) s += u[p] * c[p]; o[y * N + x] = s; }
    return o;
  };
  /* Isotropic band-limited noise with |k| at most kmax, the field the lattices are compared on. */
  T.bandNoise = (N, kmax, seed = 1) => {
    const r = T.rng(seed, "band"), re = new Float64Array(N * N), im = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = x < N / 2 ? x : x - N, b = y < N / 2 ? y : y - N; if (a * a + b * b <= kmax * kmax) { re[y * N + x] = T.gauss(r); im[y * N + x] = T.gauss(r); } }
    T.fft2c(re, im, N, N, true);
    const sc = 1 / Math.sqrt(T.varOf(re));
    return re.map((x) => x * sc);
  };
  if (typeof module !== "undefined" && module.exports) module.exports = T;
})(globalThis);
