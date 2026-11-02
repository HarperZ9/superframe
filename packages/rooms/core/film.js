// SPDX-License-Identifier: FSL-1.1-MIT
// Polarised surfaces and layers. Fresnel coefficients, the transfer matrix of a thin-film stack and Jones matrices
// of a twisted retarder, folded from the instrument-method and lens-geometry benches.
const C = (re, im = 0) => [re, im];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cdiv = (a, b) => {
  const d = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
const csqrt = (a) => {
  const m = Math.hypot(a[0], a[1]);
  return [Math.sqrt((m + a[0]) / 2), (a[1] < 0 ? -1 : 1) * Math.sqrt((m - a[0]) / 2)];
};
const abs2 = (a) => a[0] * a[0] + a[1] * a[1];

export function fresnel(n1, n2, theta) {
  const si = (n1 / n2) * Math.sin(theta);
  const ct = csqrt(C(1 - si * si));
  const ci = Math.cos(theta);
  const rs = cdiv(cadd(C(n1 * ci), [-n2 * ct[0], -n2 * ct[1]]), cadd(C(n1 * ci), [n2 * ct[0], n2 * ct[1]]));
  const rp = cdiv(cadd([n2 * ci, 0], [-n1 * ct[0], -n1 * ct[1]]), cadd([n2 * ci, 0], [n1 * ct[0], n1 * ct[1]]));
  return { Rs: abs2(rs), Rp: abs2(rp), rs, rp, retardance: Math.atan2(rp[1], rp[0]) - Math.atan2(rs[1], rs[0]) };
}

/** Lossless plane-wave stack. ns and ds per layer, lengths in the units of lam. Returns R and T. */
export function stackRT(ns, ds, lam, n0 = 1, nsub = 1, theta0 = 0, pol = "s") {
  const k = n0 * Math.sin(theta0);
  const adm = (n) => {
    const c = Math.sqrt(1 - (k / n) ** 2);
    return { eta: pol === "s" ? n * c : n / c, c };
  };
  let m = [C(1), C(0), C(0), C(1)];
  ns.forEach((n, i) => {
    const { eta, c } = adm(n),
      delta = (2 * Math.PI * n * ds[i] * c) / lam,
      cd = Math.cos(delta),
      sd = Math.sin(delta);
    const L = [C(cd), C(0, sd / eta), C(0, eta * sd), C(cd)];
    m = [
      cadd(cmul(m[0], L[0]), cmul(m[1], L[2])),
      cadd(cmul(m[0], L[1]), cmul(m[1], L[3])),
      cadd(cmul(m[2], L[0]), cmul(m[3], L[2])),
      cadd(cmul(m[2], L[1]), cmul(m[3], L[3])),
    ];
  });
  const e0 = adm(n0).eta,
    es = adm(nsub).eta;
  const B = cadd(m[0], [m[1][0] * es, m[1][1] * es]),
    D = cadd(m[2], [m[3][0] * es, m[3][1] * es]);
  const den = cadd([e0 * B[0], e0 * B[1]], D);
  const r = cdiv(cadd([e0 * B[0], e0 * B[1]], [-D[0], -D[1]]), den),
    t = cdiv(C(2 * e0), den);
  return { R: abs2(r), T: (abs2(t) * es) / e0 };
}

/** Linear retarder, retardance G, axis azimuth a: [m00, m01, m10, m11], each [re, im]. */
export function retarder(G, a) {
  const c = Math.cos(2 * a),
    s = Math.sin(2 * a),
    cg = Math.cos(G / 2),
    sg = Math.sin(G / 2);
  return [C(cg, -sg * c), C(0, -sg * s), C(0, -sg * s), C(cg, sg * c)];
}
const jm = (A, B) => [
  cadd(cmul(A[0], B[0]), cmul(A[1], B[2])),
  cadd(cmul(A[0], B[1]), cmul(A[1], B[3])),
  cadd(cmul(A[2], B[0]), cmul(A[3], B[2])),
  cadd(cmul(A[2], B[1]), cmul(A[3], B[3])),
];
const rot = (a) => [C(Math.cos(a)), C(-Math.sin(a)), C(Math.sin(a)), C(Math.cos(a))];
export function jonesTwisted(G, phi, a0 = 0) {
  const X = Math.sqrt(phi * phi + (G / 2) ** 2),
    sx = X ? Math.sin(X) / X : 1;
  const M = [C(Math.cos(X), -(G / 2) * sx), C(phi * sx), C(-phi * sx), C(Math.cos(X), (G / 2) * sx)];
  return jm(jm(rot(a0 + phi), M), rot(-a0));
}
export function jonesSlices(G, phi, n = 4000, a0 = 0) {
  let M = [C(1), C(0), C(0), C(1)];
  for (let k = 0; k < n; k++) M = jm(retarder(G / n, a0 + ((k + 0.5) * phi) / n), M);
  return M;
}
/** Share of circular plus input that leaves as circular minus. */
export function retarderConversion(G, a) {
  const J = retarder(G, a),
    s = Math.SQRT1_2;
  const out0 = cadd(J[0], cmul(J[1], C(0, 1))).map((v) => v * s),
    out1 = cadd(J[2], cmul(J[3], C(0, 1))).map((v) => v * s);
  const amp = cadd(out0, cmul(C(0, 1), out1)).map((v) => v * s);
  return abs2(amp);
}
