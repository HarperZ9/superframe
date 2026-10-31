// SPDX-License-Identifier: FSL-1.1-MIT
// ======================================================================= Field solver: finite volume Laplace on a graded grid
export function graded(pts, lo, hi, fine, ratio) {
  const set = [...pts].sort((a, b) => a - b);
  const out = new Set();
  const walk = (a, b) => {
    let x = a,
      st = fine;
    const s = Math.sign(b - a);
    while (s * (b - x) > st * 1.2) {
      x += s * st;
      out.add(+x.toFixed(6));
      st *= ratio;
    }
  };
  for (const p of set) {
    out.add(+p.toFixed(6));
  }
  for (const p of set) {
    walk(p, lo);
    walk(p, hi);
  }
  out.add(lo);
  out.add(hi);
  const a = [...out].sort((u, v) => u - v);
  const b = [a[0]];
  for (let i = 1; i < a.length; i++)
    if (a[i] - b[b.length - 1] > fine * 0.45 || pts.some((p) => Math.abs(p - a[i]) < 1e-6))
      b.push(a[i]);
  return b;
}
export function laplace(xs, zs, epsAt, fixedAt, sweeps, zeroEdges) {
  const nx = xs.length,
    nz = zs.length,
    N = nx * nz,
    V = new Float64Array(N),
    F = new Int8Array(N),
    gE = new Float64Array(N),
    gN = new Float64Array(N);
  for (let k = 0; k < nz; k++)
    for (let i = 0; i < nx; i++) {
      const a = k * nx + i,
        v = fixedAt(xs[i], zs[k]);
      if (v !== null) {
        F[a] = 1;
        V[a] = v;
      } else if (zeroEdges && (k === 0 || k === nz - 1)) {
        F[a] = 1;
        V[a] = 0;
      }
      const dx = i < nx - 1 ? xs[i + 1] - xs[i] : 1,
        dz = k < nz - 1 ? zs[k + 1] - zs[k] : 1,
        dzm = k > 0 ? zs[k] - zs[k - 1] : 0,
        dxm = i > 0 ? xs[i] - xs[i - 1] : 0;
      if (i < nx - 1) {
        const xm = (xs[i] + xs[i + 1]) / 2;
        gE[a] =
          (epsAt(xm, zs[k] + (k < nz - 1 ? dz / 4 : 0)) * (k < nz - 1 ? dz / 2 : 0) +
            (epsAt(xm, zs[k] - (k > 0 ? dzm / 4 : 0)) * dzm) / 2) /
          dx;
      }
      if (k < nz - 1) {
        const zm = (zs[k] + zs[k + 1]) / 2;
        gN[a] =
          (epsAt(xs[i] + (i < nx - 1 ? dx / 4 : 0), zm) * (i < nx - 1 ? dx / 2 : 0) +
            (epsAt(xs[i] - (i > 0 ? dxm / 4 : 0), zm) * dxm) / 2) /
          dz;
      }
    }
  const w = 2 - ((2 * Math.PI) / Math.max(nx, nz)) * 0.6;
  for (let s = 0; s < sweeps; s++) {
    for (let k = 0; k < nz; k++)
      for (let i = 0; i < nx; i++) {
        const a = k * nx + i;
        if (F[a]) continue;
        let n = 0,
          d = 0;
        if (i < nx - 1) {
          n += gE[a] * V[a + 1];
          d += gE[a];
        }
        if (i > 0) {
          n += gE[a - 1] * V[a - 1];
          d += gE[a - 1];
        }
        if (k < nz - 1) {
          n += gN[a] * V[a + nx];
          d += gN[a];
        }
        if (k > 0) {
          n += gN[a - nx] * V[a - nx];
          d += gN[a - nx];
        }
        if (d > 0) V[a] += w * (n / d - V[a]);
      }
  }
  let E = 0;
  for (let k = 0; k < nz; k++)
    for (let i = 0; i < nx; i++) {
      const a = k * nx + i;
      if (i < nx - 1) {
        const q = V[a + 1] - V[a];
        E += gE[a] * q * q;
      }
      if (k < nz - 1) {
        const q = V[a + nx] - V[a];
        E += gN[a] * q * q;
      }
    }
  return { V, E, nx, nz, xs, zs };
}
export const Z0_CACHE = new Map();
export function fieldZ0(w, h, t, er, fine) {
  const key = [w, h, t, er, fine || 0].join();
  if (Z0_CACHE.has(key)) return Z0_CACHE.get(key);
  const f = ((fine || 1) * Math.min(w, h, 1)) / 10,
    Lx = Math.max(14 * h, 8 * w) + w / 2,
    Lz = Math.max(14 * h, 8 * w);
  const xs = graded([0, w / 2], 0, Lx, f, 1.22),
    zs = graded([0, h, h + t], 0, h + t + Lz, f, 1.22);
  const fix = (x, z) =>
      z <= 1e-9 ? 0 : z >= h - 1e-9 && z <= h + t + 1e-9 && x <= w / 2 + 1e-9 ? 1 : null,
    swp = Math.round(1300 / (fine || 1));
  const a = laplace(xs, zs, () => 1, fix, swp, true),
    b = laplace(xs, zs, (x, z) => (z < h ? er : 1), fix, swp, true);
  const c = 2 * 8.854e-12 * b.E,
    c0 = 2 * 8.854e-12 * a.E;
  const z = 1 / (299792458 * Math.sqrt(c * c0));
  const r = { z, e: c / c0, v: 299792458 / Math.sqrt(c / c0), cells: xs.length * zs.length };
  Z0_CACHE.set(key, r);
  return r;
}
