// ciede.mjs: CIEDE2000 colour difference (CIE 142-2001, as written out by Sharma, Wu and Dalal 2005), with kL = kC =
// kH = 1, and CIE76 for the control. Written here because lib/study/cmath.mjs carries CIE76 only.
import { lin8, linToXYZ, xyzToLab } from '../study/cmath.mjs';

const RAD = Math.PI / 180, P25_7 = 25 ** 7;

const hueDeg = (b, a) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) / RAD; return h < 0 ? h + 360 : h; };

// Mean hue and hue difference with the 180 degree wrap rules of Sharma et al. eqs 10 and 14.
function hueTerms(h1, h2, C1, C2) {
  if (C1 * C2 === 0) return { dh: 0, hbar: h1 + h2 };
  let dh = h2 - h1;
  if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const s = h1 + h2, d = Math.abs(h1 - h2);
  const hbar = d <= 180 ? s / 2 : s < 360 ? (s + 360) / 2 : (s - 360) / 2;
  return { dh, hbar };
}

export function dE00([L1, a1, b1], [L2, a2, b2]) {
  const Cab = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, C7 = Cab ** 7;
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + P25_7)));
  const ap1 = (1 + G) * a1, ap2 = (1 + G) * a2;
  const C1 = Math.hypot(ap1, b1), C2 = Math.hypot(ap2, b2);
  const h1 = hueDeg(b1, ap1), h2 = hueDeg(b2, ap2);
  const { dh, hbar } = hueTerms(h1, h2, C1, C2);
  const dL = L2 - L1, dC = C2 - C1, dH = 2 * Math.sqrt(C1 * C2) * Math.sin(dh / 2 * RAD);
  const Lbar = (L1 + L2) / 2, Cbar = (C1 + C2) / 2;
  const T = 1 - 0.17 * Math.cos((hbar - 30) * RAD) + 0.24 * Math.cos(2 * hbar * RAD) + 0.32 * Math.cos((3 * hbar + 6) * RAD) - 0.20 * Math.cos((4 * hbar - 63) * RAD);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const Cb7 = Cbar ** 7, RC = 2 * Math.sqrt(Cb7 / (Cb7 + P25_7));
  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2), SC = 1 + 0.045 * Cbar, SH = 1 + 0.015 * Cbar * T;
  const RT = -Math.sin(2 * dTheta * RAD) * RC;
  const l = dL / SL, c = dC / SC, h = dH / SH;
  return Math.sqrt(l * l + c * c + h * h + RT * c * h);
}

export const dE76 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

// Linear RGB triple (any real values, clipped at 0 for the cube root) to CIELAB D65.
export const linToLab = rgb => xyzToLab(linToXYZ(rgb.map(v => Math.max(0, v))));

// 8-bit RGBA image to a Float32Array of linear RGB, 3 per pixel.
export function toLinear({ w, h, rgba }) {
  const out = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) out[3 * i + c] = lin8(rgba[4 * i + c]);
  return out;
}
