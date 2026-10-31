// SPDX-License-Identifier: FSL-1.1-MIT
import { CONSTANTS } from "./constants.js";
import { CMF, D65 } from "./data/cie.js";
import { AIR0, SCENES } from "./scenes.js";
export const BL = [];
for (let i = 0; i < 16; i++) BL.push(340 + 24 * i);
export const lerpT = (T, start, l) => {
  const u = (l - start) / 10;
  if (u < 0 || u > T.length - 1) return null;
  const i = Math.min(T.length - 2, Math.floor(u)),
    f = u - i;
  return T[i].map ? T[i].map((v, k) => v + (T[i + 1][k] - v) * f) : T[i] + (T[i + 1] - T[i]) * f;
};
export const cmfB = BL.map((l) => lerpT(CMF, 380, l) || [0, 0, 0]);
export const ILL = {
  D65: BL.map((l) => lerpT(D65, 340, l)),
  A: BL.map(
    (l) =>
      (100 * Math.pow(560 / l, 5) * (Math.exp(CONSTANTS.illuminantAc2.value / (2848 * 560)) - 1)) /
      (Math.exp(CONSTANTS.illuminantAc2.value / (2848 * l)) - 1)
  ),
  LED: BL.map(
    (l) =>
      100 *
      (Math.exp(-(((l - 455) / 12) ** 2)) +
        0.9 * Math.exp(-(((l - 535) / 18) ** 2)) +
        1.1 * Math.exp(-(((l - 620) / 12) ** 2)))
  ),
};
export const gauss = (l, c, w) => Math.exp(-(((l - c) / w) ** 2));
// Bee peaks 344, 436, 544 nm (Peitsch et al. 1992); UV-sensitive bird 370, 445, 508, 565 nm (Hart 2001, oil droplets omitted). Widths assumed at 35 nm.
export const SENS = {
  bee: BL.map((l) => [gauss(l, 544, 35), gauss(l, 436, 35), gauss(l, 344, 35)]),
  bird: BL.map((l) => [gauss(l, 508, 35), gauss(l, 445, 35), gauss(l, 370, 35)]),
};
// Metameric black: R2 = R1 + k b, where b is a bumpy spectrum with its projection on the three observer-times-light columns removed, so XYZ cannot change under D65 (Wyszecki and Stiles, Color Science).
export function metaPair() {
  const E = ILL.D65,
    A = cmfB.map((c, i) => c.map((v) => v * E[i]));
  const R1 = BL.map((l) => 0.32 + 0.2 * gauss(l, 540, 70) + 0.18 * gauss(l, 610, 50));
  let v = BL.map((l, i) => Math.sin(i * 1.05 + 0.4) + 0.5 * Math.cos(i * 2.3));
  const G = [0, 1, 2].map((a) => [0, 1, 2].map((b) => A.reduce((s, r) => s + r[a] * r[b], 0)));
  const g = [0, 1, 2].map((a) => A.reduce((s, r, i) => s + r[a] * v[i], 0));
  const x = solve3(G, g);
  const b = v.map((vi, i) => vi - A[i][0] * x[0] - A[i][1] * x[1] - A[i][2] * x[2]);
  let k = 1e9;
  b.forEach((bi, i) => {
    if (bi > 0) k = Math.min(k, (0.96 - R1[i]) / bi);
    if (bi < 0) k = Math.min(k, (R1[i] - 0.02) / -bi);
  });
  return { R1, R2: R1.map((r, i) => r + k * b[i]), k };
}
export function solve3(M, y) {
  const a = M.map((r, i) => [...r, y[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let j = i + 1; j < 3; j++) if (Math.abs(a[j][i]) > Math.abs(a[p][i])) p = j;
    [a[i], a[p]] = [a[p], a[i]];
    for (let j = 0; j < 3; j++) {
      if (j == i) continue;
      const f = a[j][i] / a[i][i];
      for (let c = i; c < 4; c++) a[j][c] -= f * a[i][c];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}
export const MP = metaPair();
SCENES.meta = {
  name: "Metamer pair",
  lamp: "vec4(0.)",
  lc: "vec3(0.)",
  glsl:
    AIR0 +
    `
uniform float uRa[16],uRb[16];uniform vec3 uCmf[16];uniform float uEll[16];
vec3 sky(vec3 rd){return vec3(.5);}
bool hitS(vec3 ro,vec3 rd,inout float t,inout vec3 n,inout vec3 al,inout vec3 em,inout float rg){bool h=false;if(rd.z>0.){float x=(6.-ro.z)/rd.z;if(x>.001&&x<t){vec3 p=ro+rd*x;t=x;n=vec3(0,0,-1);h=true;rg=1.;al=vec3(0);float v=.5;if(abs(p.y)<1.6){if(p.x<-.05&&p.x>-2.6)v=uRa[gBand];if(p.x>.05&&p.x<2.6)v=uRb[gBand];}em=vec3(v);}}return h;}`,
};
export const labOf = (xyz, w) => {
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const a = f(xyz[0] / w[0]),
    b = f(xyz[1] / w[1]),
    c = f(xyz[2] / w[2]);
  return [116 * b - 16, 500 * (a - b), 200 * (b - c)];
};
export const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const MACH = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};
export const X2R = [
    [3.2406, -1.5372, -0.4986],
    [-0.9689, 1.8758, 0.0415],
    [0.0557, -0.204, 1.057],
  ],
  R2X = [
    [0.4124, 0.3576, 0.1805],
    [0.2126, 0.7152, 0.0722],
    [0.0193, 0.1192, 0.9505],
  ];
export const labOf0 = (v) => v;
