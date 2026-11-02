// SPDX-License-Identifier: FSL-1.1-MIT
// CPU reference for the known answers the shaders are held to. Double precision, no GPU, so CI can run it. It
// covers the shapes the checks use: the plate and the globe, plus index fields. It does not replace the shader.
import { Pcg } from "./sampler.js";

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const norm = (a) => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const reflect = (d, n) => add(d, n, -2 * dot(d, n));
/** Refract d through unit normal n (facing the ray), eta = n1/n2. Returns null at total internal reflection. */
export function refract(d, n, eta) {
  const c = -dot(d, n),
    k = 1 - eta * eta * (1 - c * c);
  return k < 0 ? null : norm(add([eta * d[0], eta * d[1], eta * d[2]], n, eta * c - Math.sqrt(k)));
}
export const plateSdf = (hT, rim = 1.2) => (p) => Math.max(Math.hypot(p[0], p[1]) - rim, Math.abs(p[2]) - hT);
export const globeSdf = (R = 1) => (p) => Math.hypot(...p) - R;
const grad = (f, p, e = 1e-6) =>
  norm([
    f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]),
    f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]),
    f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e]),
  ]);

/** Walk a ray inside a body until it refracts out, counting total internal reflections. */
export function traceInside(sdf, n, p0, d0, maxBounce = 200) {
  let p = p0,
    d = d0,
    bounces = 0;
  for (let i = 0; i < 200000; i++) {
    const v = sdf(p);
    if (v > -1e-9) {
      const N = grad(sdf, p);
      const out = refract(d, [-N[0], -N[1], -N[2]], n);
      if (out) return { exited: true, bounces, p, d: out };
      d = reflect(d, N);
      p = add(p, d, 1e-7);
      p = add(p, N, -2e-9);
      if (++bounces > maxBounce) break;
      continue;
    }
    p = add(p, d, Math.max(-v, 2e-9));
  }
  return { exited: false, bounces, p, d };
}
/** Largest angle from the normal that leaves a plate from its mid plane. Fan of 4096 rays, as on the page. */
export function snellWindowDeg(n) {
  const sdf = plateSdf(0.6),
    A = (Math.PI / 2) * 0.7,
    w = 4096;
  let last = 0;
  for (let k = 0; k < w; k++) {
    const a = (k / w) * A;
    if (traceInside(sdf, n, [0, 0, 0], [Math.sin(a), 0, Math.cos(a)], 0).bounces === 0) last = a;
    else break;
  }
  return (last * 180) / Math.PI;
}
export function plateRepeats(deg, c, n) {
  const hT = 0.08 + 0.52 * c,
    T = 2 * hT,
    th = (deg * Math.PI) / 180;
  const r = traceInside(plateSdf(hT), n, [0, 0, 0], [Math.sin(th), 0, Math.cos(th)], 500);
  return { measured: r.bounces, predicted: 1 + Math.floor((1.2 - hT * Math.tan(th)) / (T * Math.tan(th))) };
}
function enterGlobe(h, n) {
  const z = -Math.sqrt(1 - h * h),
    N = [h, 0, z];
  return { p: N, d: refract([0, 0, 1], N, 1 / n) };
}
/** Parallel rays into a unit globe: the highest ray that still hits a centred sphere of radius a. */
export function centreSphereEdge(n, a, w = 2048) {
  let e = 0;
  for (let k = 0; k < w; k++) {
    const h = (k + 1) / w;
    if (h >= 1) break;
    const { p, d } = enterGlobe(h, n);
    const b = dot(p, d),
      miss = Math.sqrt(Math.max(dot(p, p) - b * b, 0));
    if (miss <= a) e = h;
  }
  return e;
}
/** Axis point at radius r in a unit globe: back-project the exiting rays; compare n/s + 1/s' = (n-1)/R. */
export function apparentRadius(n, r) {
  let sum = 0,
    N = 0;
  for (let k = 8; k < 64; k++) {
    const a = (k / 64) * 0.02,
      d0 = [Math.sin(a), 0, -Math.cos(a)];
    const q = traceInside(globeSdf(1), n, [0, 0, -r], d0, 0);
    const ty = q.d[0] / q.d[2];
    if (Math.abs(ty) < 1e-5) continue;
    sum += q.p[2] - q.p[0] / ty;
    N++;
  }
  const s = 1 - r,
    sp = 1 / ((n - 1) / 1 - n / s);
  return { measured: N ? -(sum / N) : r, predicted: 1 + sp };
}

/** One RK4 step of the ray equation x'' = grad(n^2)/2 in the parameter where |x'| = n. */
export function rk4(p, v, dt, n2) {
  const g = (q) => {
    const e = 1e-5;
    return [
      (n2([q[0] + e, q[1], q[2]]) - n2([q[0] - e, q[1], q[2]])) / (4 * e),
      (n2([q[0], q[1] + e, q[2]]) - n2([q[0], q[1] - e, q[2]])) / (4 * e),
      (n2([q[0], q[1], q[2] + e]) - n2([q[0], q[1], q[2] - e])) / (4 * e),
    ];
  };
  const a1 = g(p),
    v2 = add(v, a1, dt / 2),
    a2 = g(add(p, v, dt / 2)),
    v3 = add(v, a2, dt / 2),
    a3 = g(add(p, v2, dt / 2)),
    v4 = add(v, a3, dt),
    a4 = g(add(p, v3, dt));
  return {
    p: [0, 1, 2].map((i) => p[i] + (dt / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i])),
    v: [0, 1, 2].map((i) => v[i] + (dt / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i])),
  };
}
export function luneburgExit(rays = 32, field = (p) => 2 - dot(p, p)) {
  let s = 0,
    mx = 0,
    N = 0;
  for (let k = 0; k < rays; k++) {
    const A = (k / rays) * 1.2,
      n0 = Math.sqrt(field([0, 0, -0.999]));
    let p = [0, 0, -0.999],
      v = [n0 * Math.sin(A), 0, n0 * Math.cos(A)];
    for (let i = 0; i < 20000 && Math.hypot(...p) < 1; i++) ({ p, v } = rk4(p, v, 5e-4, field));
    const N0 = norm(p);
    const out = refract(norm(v), [-N0[0], -N0[1], -N0[2]], Math.sqrt(field(p)));
    if (!out) continue;
    const an = Math.atan2(Math.hypot(out[0], out[1]), out[2]);
    s += an * an;
    mx = Math.max(mx, an);
    N++;
  }
  return { rmsDeg: (Math.sqrt(s / Math.max(N, 1)) * 180) / Math.PI, maxDeg: (mx * 180) / Math.PI, rays: N };
}
export function fisheyeAntipode(a = 1) {
  const field = (p) => 4 / (1 + dot(p, p) / (a * a)) ** 2;
  const src = [0.5 * a, 0, 0],
    anti = [-2 * a, 0, 0];
  let spread = 0;
  for (const ang of [0.5, 1, 1.5, 2, 2.5]) {
    const n0 = Math.sqrt(field(src));
    let p = src,
      v = [n0 * Math.cos(ang), n0 * Math.sin(ang), 0],
      best = 1e9;
    // Equal steps of optical path: dt shrinks where n is large. Half the great circle has optical length pi.
    for (let o = 0; o < Math.PI * 1.02 * a; o += 2e-4) {
      ({ p, v } = rk4(p, v, 2e-4 / field(p), field));
      best = Math.min(best, Math.hypot(p[0] - anti[0], p[1] - anti[1], p[2]));
    }
    spread = Math.max(spread, best);
  }
  return { spread };
}
/** Eaton lens n^2 = 2R/r - 1, R = 1. A ray enters at impact b and leaves with direction reversed. */
export function eatonTurn(b) {
  const field = (p) => {
    const r = Math.hypot(...p);
    return r < 1 ? Math.max(2 / r - 1, 1e-4) : 1;
  };
  let p = [b, 0, -1.2],
    v = [0, 0, 1];
  for (let i = 0; i < 2000000 && Math.hypot(...p) <= 1.3; i++) {
    const r = Math.hypot(...p);
    ({ p, v } = rk4(p, v, Math.max(2e-5, Math.min(2e-3, r * r * 0.002)), field));
  }
  const d = norm(v);
  return { turnDeg: (Math.atan2(Math.hypot(d[0], d[1]), d[2]) * 180) / Math.PI };
}
/** Weak gravity index n = 1 + 2 mu / r: deflection of a ray at impact b over a path from -L to +L. */
export function gravityDeflection(mu, b, L) {
  const field = (p) => (1 + (2 * mu) / Math.max(Math.hypot(...p), 1e-3)) ** 2;
  let p = [b, 0, -L],
    v = [0, 0, Math.sqrt(field(p))];
  for (let i = 0; i < 400000 && p[2] < L; i++) ({ p, v } = rk4(p, v, 0.02 + 0.02 * Math.abs(p[2]), field));
  const pred = (4 * mu) / b;
  return { measured: Math.atan2(-v[0], v[2]), predicted: pred, finitePredicted: pred * (L / Math.hypot(L, b)) };
}

/** Isotropic scattering in a slab of optical density sigma and thickness L, entered at normal incidence. */
export function slabTransport(sigma, L, rays, seed = 1) {
  const r = new Pcg(seed);
  let thru = 0,
    uns = 0;
  for (let k = 0; k < rays; k++) {
    let z = 0,
      mu = 1,
      scattered = false;
    for (let guard = 0; guard < 1e6; guard++) {
      const t = sigma > 0 ? -Math.log(1 - r.next()) / sigma : Infinity;
      z += t * mu;
      if (z >= L) {
        thru++;
        if (!scattered) uns++;
        break;
      }
      if (z <= 0) break;
      mu = 2 * r.next() - 1;
      scattered = true;
    }
  }
  return { transmitted: thru / rays, unscattered: uns / rays };
}
export function diffusionSlope(sigma, Ls, rays, seed = 1) {
  const z = 0.71 / sigma;
  const xs = Ls.map((L) => Math.log(L + 2 * z));
  const ys = Ls.map((L, i) => Math.log(Math.max(slabTransport(sigma, L, rays, seed + i).transmitted, 1e-5)));
  const mx = xs.reduce((a, b) => a + b) / xs.length,
    my = ys.reduce((a, b) => a + b) / ys.length;
  let nu = 0,
    de = 0;
  xs.forEach((x, i) => {
    nu += (x - mx) * (ys[i] - my);
    de += (x - mx) ** 2;
  });
  return { slope: nu / de };
}
export const malus = (deg) => 0.5 * Math.cos((deg * Math.PI) / 180) ** 2;
/** Two line gratings of pitch p crossed at deg: find the beat along y, as the page does on its rendered frame. */
export function moireFromGratings(deg, p) {
  const a = ((deg / 2) * Math.PI) / 180,
    pred = p / (2 * Math.sin(a)),
    h = 2048,
    w = 256,
    Y = 12 * (p / (2 * Math.sin(((3 / 2) * Math.PI) / 180))),
    prof = new Float64Array(h);
  for (let j = 0; j < h; j++) {
    const y = (j / h) * Y;
    let s = 0;
    for (let i = 0; i < w; i++) {
      const x = (i / w) * 64 * p;
      const g = (u) => 0.5 + 0.5 * Math.cos((2 * Math.PI * u) / p);
      s += g(x * Math.cos(a) + y * Math.sin(a)) * g(x * Math.cos(a) - y * Math.sin(a));
    }
    prof[j] = s / w;
  }
  const mean = prof.reduce((u, v) => u + v) / h;
  const base = p / (2 * Math.sin(((3 / 2) * Math.PI) / 180));
  let best = 0,
    bp = 0;
  for (let P = base * 0.25; P < base * 1.6; P += base * 0.002) {
    let c = 0,
      s = 0;
    for (let j = 0; j < h; j++) {
      const t = (2 * Math.PI * (j / h) * Y) / P;
      c += (prof[j] - mean) * Math.cos(t);
      s += (prof[j] - mean) * Math.sin(t);
    }
    if (c * c + s * s > best) {
      best = c * c + s * s;
      bp = P;
    }
  }
  return { measured: bp, predicted: pred };
}
/** Spinning mirror surface z = -cv r^2: a parallel ray reflects and crosses the axis at the focus. */
export function parabolaFocus(cv, h = 0.01) {
  const n = norm([2 * cv * h, 0, 1]),
    d = reflect([0, 0, 1], n);
  const z0 = -cv * h * h,
    t = -h / d[0];
  return Math.abs(z0 + t * d[2]);
}
