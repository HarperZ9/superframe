// SPDX-License-Identifier: FSL-1.1-MIT
// Polarisation on the Poincare sphere. A waveplate of retardance G at azimuth a rotates the sphere by G about the equatorial
// axis (cos 2a, sin 2a, 0). A path of waypoints compiles to one plate per leg, and the result is checked by Jones matrices.
import { retarder } from "../core/film.js";
import { MATERIAL_RECORDS } from "../core/constants.js";
import { instrument, propertyObject } from "./model.js";

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const POLARISATION = propertyObject({
  id: "polarisation",
  name: "Polarisation state",
  stateSpace: {
    name: "Pure polarisation states",
    shape: "unit sphere",
    coordinates: { chosen: true, name: "Stokes S1, S2, S3", note: "One chart of the states. The sphere is a drawing of the algebra and no sphere exists in the beam." },
  },
  operations: [{ id: "plate", name: "Rotate about an equatorial axis", element: "linear retarder (waveplate)" }],
  fabrication: {
    route: "Polished crystal quartz plates, cut with the optic axis in the face, stacked in a mount with set azimuths",
    limits: ["Thickness is set by retardance at one wavelength; other wavelengths miss", "Azimuth and thickness tolerance", "Surface reflection is not modelled"],
  },
});

/** Jones vector [[re,im],[re,im]] to Stokes, with S3 = 2 Im(conj(Ex) Ey). */
export function stokes([x, y]) {
  const n = x[0] ** 2 + x[1] ** 2 + y[0] ** 2 + y[1] ** 2;
  const re = x[0] * y[0] + x[1] * y[1],
    im = x[0] * y[1] - x[1] * y[0];
  return [(x[0] ** 2 + x[1] ** 2 - y[0] ** 2 - y[1] ** 2) / n, (2 * re) / n, (2 * im) / n];
}
/** A Jones vector for a point on the sphere. */
export function jonesOf([s1, s2, s3]) {
  const t = Math.acos(Math.max(-1, Math.min(1, s1))) / 2,
    f = Math.atan2(s3, s2);
  return [
    [Math.cos(t), 0],
    [Math.sin(t) * Math.cos(f), Math.sin(t) * Math.sin(f)],
  ];
}
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export function applyJones(J, [x, y]) {
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  return [add(cmul(J[0], x), cmul(J[1], y)), add(cmul(J[2], x), cmul(J[3], y))];
}
/** The sphere rotation of a plate, used to draw the arc. */
export function rotateOnSphere(s, G, a) {
  const n = [Math.cos(2 * a), Math.sin(2 * a), 0],
    c = Math.cos(G),
    z = Math.sin(G),
    k = dot(n, s) * (1 - c),
    x = cross(n, s);
  return [0, 1, 2].map((i) => s[i] * c + x[i] * z + n[i] * k);
}
/** The one plate that carries s0 to s1: its axis lies on the equator and is equidistant from both. */
export function plateFor(s0, s1) {
  const v = [s1[0] - s0[0], s1[1] - s0[1], s1[2] - s0[2]];
  let n = Math.hypot(v[0], v[1]) > 1e-12 ? [-v[1], v[0], 0] : Math.hypot(s0[0], s0[1]) > 1e-12 ? [-s0[1], s0[0], 0] : [1, 0, 0];
  const L = Math.hypot(n[0], n[1]);
  n = [n[0] / L, n[1] / L, 0];
  const p0 = s0.map((v0, i) => v0 - dot(n, s0) * n[i]),
    p1 = s1.map((v1, i) => v1 - dot(n, s1) * n[i]);
  const G = Math.atan2(dot(n, cross(p0, p1)), dot(p0, p1));
  return { retardance: G, azimuth: Math.atan2(n[1], n[0]) / 2 };
}
const toPositive = (p) =>
  p.retardance < 0 ? { retardance: -p.retardance, azimuth: p.azimuth + Math.PI / 2 } : p;

/** Thickness in nm of a quartz plate: zero order if it is thick enough to handle, else add whole waves. */
export function quartzThickness(G, lam, minNm = 5e4) {
  const dn = MATERIAL_RECORDS.quartz.dne.value;
  let order = 0,
    d = (G * lam) / (2 * Math.PI * dn);
  while (d < minNm) d = ((G + 2 * Math.PI * ++order) * lam) / (2 * Math.PI * dn);
  return { thickness: d, order };
}
function fidelity(a, b) {
  return (1 + dot(a, b)) / 2;
}
/** Compile a path of sphere points to a plate stack; verdict from a Jones product at the design wavelength and off it. */
export function compilePath(path, { lam = 550, tolerance = 1e-9 } = {}) {
  const plates = [];
  for (let i = 1; i < path.length; i++) {
    const p = toPositive(plateFor(path[i - 1], path[i]));
    plates.push({ ...p, ...quartzThickness(p.retardance, lam), material: "quartz" });
  }
  const dn = MATERIAL_RECORDS.quartz.dne.value;
  const through = (l) => {
    let E = jonesOf(path[0]);
    for (const p of plates) E = applyJones(retarder((2 * Math.PI * dn * p.thickness) / l, p.azimuth), E);
    return stokes(E);
  };
  const end = path[path.length - 1];
  const got = through(lam);
  const F = fidelity(got, end);
  return instrument({
    property: POLARISATION.id,
    elements: plates,
    path,
    verdict: { check: "Jones product of the stack against the path's end point", got, want: end, fidelity: F, pass: 1 - F < tolerance },
    limits: [{ what: "Fidelity at 10 nm from the design wavelength", value: fidelity(through(lam + 10), end) }],
    unmodelled: ["Surface reflections", "Quartz dispersion and optical activity", "Plate wedge and azimuth error"],
  });
}
