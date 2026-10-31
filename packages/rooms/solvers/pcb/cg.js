// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Sparse conjugate gradient shared by the copper and heat solvers
export function pcg(n, ea, eb, eg, diag, rhs, tol, maxit) {
  const D = new Float64Array(n);
  for (let i = 0; i < n; i++) D[i] = diag ? diag[i] : 0;
  const m = ea.length;
  for (let e = 0; e < m; e++) {
    D[ea[e]] += eg[e];
    D[eb[e]] += eg[e];
  }
  const x = new Float64Array(n),
    r = Float64Array.from(rhs),
    z = new Float64Array(n),
    p = new Float64Array(n),
    q = new Float64Array(n);
  let rz = 0,
    bn = 0;
  for (let i = 0; i < n; i++) {
    z[i] = D[i] > 0 ? r[i] / D[i] : 0;
    p[i] = z[i];
    rz += r[i] * z[i];
    bn += r[i] * r[i];
  }
  bn = Math.sqrt(bn) || 1;
  let it = 0,
    rn = bn;
  for (; it < maxit; it++) {
    q.fill(0);
    if (diag) for (let i = 0; i < n; i++) q[i] = diag[i] * p[i];
    for (let e = 0; e < m; e++) {
      const a = ea[e],
        b = eb[e],
        g = eg[e] * (p[a] - p[b]);
      q[a] += g;
      q[b] -= g;
    }
    let pq = 0;
    for (let i = 0; i < n; i++) pq += p[i] * q[i];
    if (!(pq > 0)) break;
    const al = rz / pq;
    let s = 0;
    for (let i = 0; i < n; i++) {
      x[i] += al * p[i];
      r[i] -= al * q[i];
      s += r[i] * r[i];
    }
    rn = Math.sqrt(s);
    if (rn < tol * bn) {
      it++;
      break;
    }
    let nz = 0;
    for (let i = 0; i < n; i++) {
      z[i] = D[i] > 0 ? r[i] / D[i] : 0;
      nz += r[i] * z[i];
    }
    const be = nz / rz;
    rz = nz;
    for (let i = 0; i < n; i++) p[i] = z[i] + be * p[i];
  }
  return { x, it, res: rn / bn };
}
