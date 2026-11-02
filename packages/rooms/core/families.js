// SPDX-License-Identifier: FSL-1.1-MIT
// Spherical-harmonic deformed globes as a registered shape family, r = 1 + c*a*Y(l,m). The GLSL is flat: the Legendre
// recurrence is written out as statements for the chosen l and m, so no program holds a loop or a table.
import { registerShape, shape } from "./registry.js";

const fact = (n) => (n < 2 ? 1 : n * fact(n - 1));
/** Orthonormal real spherical harmonic on the CPU. m > 0 is cosine, m < 0 sine. */
export function shY(l, m, theta, phi) {
  const a = Math.abs(m);
  const ct = Math.cos(theta),
    st = Math.sin(theta);
  let pmm = 1;
  for (let i = 1; i <= a; i++) pmm *= -(2 * i - 1) * st;
  let P = pmm;
  if (l > a) {
    let p0 = pmm,
      p1 = ct * (2 * a + 1) * pmm;
    for (let k = a + 2; k <= l; k++) [p0, p1] = [p1, (ct * (2 * k - 1) * p1 - (k + a - 1) * p0) / (k - a)];
    P = p1;
  }
  const K = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - a) / fact(l + a)));
  if (m === 0) return K * P;
  return Math.SQRT2 * K * P * (m > 0 ? Math.cos(a * phi) : Math.sin(a * phi));
}
const num = (v) => (Object.is(v, -0) || v === 0 ? "0." : v < 0 ? `(-${Math.abs(v).toFixed(8)})` : v.toFixed(8));
/** The surface-function body for one (l, m), in the shape registry's form. */
export function shBody(l, m, amp = 0.35) {
  const a = Math.abs(m);
  const lines = ["float ct=clamp(p.z/max(r,1e-3),-1.,1.),st=sqrt(max(1.-ct*ct,0.)),ph=atan(p.y,p.x);"];
  let pmm = "float pm=1.;";
  for (let i = 1; i <= a; i++) pmm += `pm*=${num(-(2 * i - 1))}*st;`;
  lines.push(pmm);
  let P = "pm";
  if (l > a) {
    lines.push(`float p0=pm,p1=ct*${num(2 * a + 1)}*pm,p2=p1;`);
    for (let k = a + 2; k <= l; k++) lines.push(`p2=(ct*${num(2 * k - 1)}*p1-${num(k + a - 1)}*p0)/${num(k - a)};p0=p1;p1=p2;`);
    P = "p1";
  }
  const K = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - a) / fact(l + a))) * (m ? Math.SQRT2 : 1);
  const ang = m === 0 ? "1." : m > 0 ? `cos(${num(a)}*ph)` : `sin(${num(a)}*ph)`;
  lines.push(`return r-(1.+c*${num(amp)}*${num(K)}*${P}*${ang});`);
  return lines.join("");
}
/** Registers Y(l,m) for l up to lmax under one group. Opt-in, so a view's menu changes only when it asks. */
export function registerSphericalHarmonics(lmax = 4, group = "Spherical harmonics") {
  const ids = [];
  for (let l = 1; l <= lmax; l++)
    for (let m = -l; m <= l; m++) {
      const id = `sh${l}_${m}`;
      if (!shape(id)) registerShape(id, `Harmonic l ${l}, m ${m}`, shBody(l, m), group);
      ids.push(id);
    }
  return ids;
}
