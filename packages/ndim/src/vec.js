// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* ndim/vec: n-vectors, matrices and rotations in coordinate planes. No dependencies.
   Loads as a classic script (window.NDim) or with require (module.exports is the same object). */
(function (g) {
  "use strict";
  const N = (g.NDim = g.NDim || {});

  N.zeros = (n) => new Array(n).fill(0);
  N.add = (a, b) => a.map((x, i) => x + b[i]);
  N.sub = (a, b) => a.map((x, i) => x - b[i]);
  N.scale = (a, s) => a.map((x) => x * s);
  N.dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  N.norm = (a) => Math.sqrt(N.dot(a, a));
  N.normalize = (a) => { const r = N.norm(a); return r ? N.scale(a, 1 / r) : a.slice(); };
  N.dist = (a, b) => N.norm(N.sub(a, b));
  N.angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, N.dot(a, b) / (N.norm(a) * N.norm(b)))));
  N.mean = (pts) => N.scale(pts.reduce((s, p) => N.add(s, p), N.zeros(pts[0].length)), 1 / pts.length);

  N.identity = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => +(i === j)));
  N.transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  N.matVec = (A, v) => A.map((r) => N.dot(r, v));
  N.matMul = (A, B) => { const Bt = N.transpose(B); return A.map((r) => Bt.map((c) => N.dot(r, c))); };

  /* The n(n-1)/2 coordinate planes, in the order (0,1), (0,2), ... (n-2,n-1). */
  N.planes = (n) => { const p = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) p.push([i, j]); return p; };
  N.planeName = (i, j) => "xyzwvutsrq"[i] + "xyzwvutsrq"[j];

  /* Rotation by theta in the plane of axes i and j; every other axis is fixed. */
  N.rotation = (n, i, j, theta) => {
    const R = N.identity(n), c = Math.cos(theta), s = Math.sin(theta);
    R[i][i] = c; R[j][j] = c; R[i][j] = -s; R[j][i] = s;
    return R;
  };
  /* Apply a plane rotation in place to the rows (cheaper than a full product). */
  N.rotateRows = (M, i, j, theta) => {
    const c = Math.cos(theta), s = Math.sin(theta);
    for (const r of M) { const a = r[i], b = r[j]; r[i] = c * a - s * b; r[j] = s * a + c * b; }
    return M;
  };
  N.rotationFromAngles = (n, angles) => {
    let R = N.identity(n);
    N.planes(n).forEach(([i, j], k) => { if (angles[k]) R = N.matMul(N.rotation(n, i, j, angles[k]), R); });
    return R;
  };
  /* max |R^T R - I|: zero for an exact rotation. */
  N.orthogonalityError = (R) => {
    const P = N.matMul(N.transpose(R), R);
    let e = 0;
    P.forEach((r, i) => r.forEach((x, j) => { e = Math.max(e, Math.abs(x - (i === j ? 1 : 0))); }));
    return e;
  };

  /* Modified Gram-Schmidt; returns the orthonormal vectors that survive the tolerance. */
  N.gramSchmidt = (vs, tol = 1e-9) => {
    const out = [];
    for (const v0 of vs) {
      let v = v0.slice();
      for (const q of out) v = N.sub(v, N.scale(q, N.dot(v, q)));
      const r = N.norm(v);
      if (r > tol) out.push(N.scale(v, 1 / r));
    }
    return out;
  };
  N.affineRank = (pts, tol = 1e-7) => (pts.length < 2 ? 0 : N.gramSchmidt(pts.slice(1).map((p) => N.sub(p, pts[0])), tol).length);
  /* A unit vector orthogonal to every row, or null when the rows span the space. */
  N.nullVector = (rows, n, tol = 1e-9) => {
    const Q = N.gramSchmidt(rows, tol);
    if (Q.length >= n) return null;
    let best = null, bestR = 0;
    for (let k = 0; k < n; k++) {
      let v = N.zeros(n); v[k] = 1;
      for (const q of Q) v = N.sub(v, N.scale(q, N.dot(v, q)));
      const r = N.norm(v);
      if (r > bestR) { bestR = r; best = N.scale(v, 1 / r); }
    }
    return best;
  };
  /* An orthonormal basis of the hyperplane orthogonal to unit vector nrm. */
  N.complementBasis = (nrm) => {
    const n = nrm.length, vs = [nrm];
    for (let k = 0; k < n; k++) { const e = N.zeros(n); e[k] = 1; vs.push(e); }
    return N.gramSchmidt(vs).slice(1, n);
  };

  /* Seeds follow superframe's rule xmur3-mulberry32/1 (superframe/lib/seed.mjs, substrate/lib/vendor/superstack.mjs):
     the seed as a string is hashed by xmur3 over its UTF-16 code units, and mulberry32 runs from that hash. A tag
     selects an independent substream, seed + "/" + tag, so adding a draw in one place never shifts another.
     N.rng(7) is superframe's rngFrom(7); N.rng(7, "rotations") is nodeSeed(7, "rotations").rng. A classic script
     cannot import the ES module, so the rule is restated here and tests/seed.test.mjs holds it to superframe's. */
  N.SEED_RULE = "xmur3-mulberry32/1";
  N.xmur3 = (s) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff) { const d = s.charCodeAt(i + 1); if (!(d >= 0xdc00 && d <= 0xdfff)) throw new RangeError("lone surrogate"); i++; }
      else if (c >= 0xdc00 && c <= 0xdfff) throw new RangeError("lone surrogate");
    }
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  N.mulberry32 = (u32) => {
    let a = u32 >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  N.substream = (seed, tag) => String(seed) + "/" + tag;
  N.rng = (seed, tag) => N.mulberry32(N.xmur3(tag === undefined ? String(seed) : N.substream(seed, tag)));

  if (typeof module !== "undefined" && module.exports) module.exports = N;
})(typeof globalThis !== "undefined" ? globalThis : this);
