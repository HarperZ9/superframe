// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// Unified WebGPU + Native DX12 Scene-Graph Certificate Parity (superframe.cross-api-parity/v1).
import { createHash } from "node:crypto";

export const SCHEMA_ID = "superframe.cross-api-parity/v1";
export const CPP_STILL_LIFE_PIN = "0x8e70a9159d2007bf";
export const MAX_ABS_LIN_BOUND = 2 ** -10;
export const MIN_PSNR_DB_BOUND = 60.0;
export const MAX_P99_OKLAB_DELTA_E_BOUND = 0.002;
const FNV_START = 1469598103934665603n;
const FNV_PRIME = 1099511628211n;
const MASK64 = (1n << 64n) - 1n;

const f32 = Math.fround;

function sqrtF32(v) {
  const vf = f32(v);
  if (vf <= 0.0) return f32(0.0);
  let g = f32(f32(vf * 0.5) + 0.5);
  for (let k = 0; k < 8; k++) {
    g = f32(0.5 * f32(g + f32(vf / g)));
  }
  return g;
}

export function advanceProbeState100Hz(ticks) {
  let px = 0.35;
  let vx = 0.0;
  for (let k = 0; k < ticks; k++) {
    const ax = -4.0 * px - 0.35 * vx;
    vx = vx + ax * 0.01;
    px = px + vx * 0.01;
  }
  const py = 1.15 + 0.12 * px;
  const pz = -0.25 * vx;
  const th = 0.25 * px;
  const qn = Math.sqrt(1.0 + th * th);
  const pose = [px, py, pz, th / qn, 0.0, 0.0, 1.0 / qn];
  const s0 = f32(-0.45);
  const s1 = f32(0.78);
  const s2 = f32(0.42);
  const slen = sqrtF32(f32(f32(f32(s0 * s0) + f32(s1 * s1)) + f32(s2 * s2)));
  return {
    poses: [pose],
    stateVec: [f32(px), f32(py), f32(pz), f32(s0 / slen), f32(s1 / slen), f32(s2 / slen)],
  };
}

export function quantizeSceneStateHash(poses) {
  const buf = Buffer.alloc(poses.length * 28);
  let off = 0;
  for (const [px, py, pz, qx, qy, qz, qw] of poses) {
    const vals = [
      Math.floor(px * 65536.0 + 0.5),
      Math.floor(py * 65536.0 + 0.5),
      Math.floor(pz * 65536.0 + 0.5),
      Math.floor(qx * 32768.0 + 0.5),
      Math.floor(qy * 32768.0 + 0.5),
      Math.floor(qz * 32768.0 + 0.5),
      Math.floor(qw * 32768.0 + 0.5),
    ];
    for (const v of vals) {
      buf.writeInt32LE(v, off);
      off += 4;
    }
  }
  return "sha256:" + createHash("sha256").update(buf).digest("hex");
}

export function fnv1aF32Hex(arr) {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let h = FNV_START;
  for (let i = 0; i < bytes.length; i++) {
    h = ((h ^ BigInt(bytes[i])) * FNV_PRIME) & MASK64;
  }
  return h.toString(16).padStart(16, "0");
}

export function renderSceneParityProbe64x64(stateVec, { w = 64, h = 64, fault = null } = {}) {
  const sx = f32(stateVec[0]), sy = f32(stateVec[1]), sz = f32(stateVec[2]);
  const sunX = f32(stateVec[3]), sunY = f32(stateVec[4]), sunZ = f32(stateVec[5]);
  const out = new Float32Array(w * h * 4);
  const ox = f32(0.0), oy = f32(1.4), oz = f32(4.2);
  const wf = f32(w), hf = f32(h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = f32(f32(f32(f32(x + 0.5) / wf) * 2.0) - 1.0);
      const v = f32(1.0 - f32(f32(f32(y + 0.5) / hf) * 2.0));
      const rdx = f32(u * f32(0.72));
      const rdy = f32(f32(v * f32(0.72)) - f32(0.095));
      const rdz = f32(-1.0);
      const rlen = sqrtF32(f32(f32(f32(rdx * rdx) + f32(rdy * rdy)) + f32(rdz * rdz)));
      const dx = f32(rdx / rlen), dy = f32(rdy / rlen), dz = f32(rdz / rlen);

      let skyT = f32(f32(dy * f32(1.6)) + f32(0.25));
      if (skyT < 0.0) skyT = f32(0.0);
      if (skyT > 1.0) skyT = f32(1.0);
      let cr = f32(f32(0.78) + f32(f32(f32(0.34) - f32(0.78)) * skyT));
      let cg = f32(f32(0.81) + f32(f32(f32(0.50) - f32(0.81)) * skyT));
      let cb = f32(f32(0.86) + f32(f32(f32(0.78) - f32(0.86)) * skyT));
      let bestT = f32(1000000.0);

      if (dy < f32(-0.0001)) {
        const tg = f32(-oy / dy);
        if (tg > f32(0.001) && tg < bestT) {
          const gx = f32(ox + f32(tg * dx));
          const gz = f32(oz + f32(tg * dz));
          if (gx > f32(-12.0) && gx < f32(12.0) && gz > f32(-12.0) && gz < f32(12.0)) {
            bestT = tg;
            const nlg = sunY < 0.0 ? f32(0.0) : sunY;
            cr = f32(f32(0.34) * f32(f32(f32(1.85) * nlg) + f32(0.35)));
            cg = f32(f32(0.32) * f32(f32(f32(1.72) * nlg) + f32(0.35)));
            cb = f32(f32(0.27) * f32(f32(f32(1.55) * nlg) + f32(0.35)));
          }
        }
      }

      const qx = f32(ox - sx), qy = f32(oy - sy), qz = f32(oz - sz);
      const b = f32(f32(f32(qx * dx) + f32(qy * dy)) + f32(qz * dz));
      const c = f32(f32(f32(f32(qx * qx) + f32(qy * qy)) + f32(qz * qz)) - f32(0.7225));
      const disc = f32(f32(b * b) - c);
      if (disc >= 0.0) {
        const ts = f32(-b - sqrtF32(disc));
        if (ts > f32(0.001) && ts < bestT) {
          const nx = f32(f32(qx + f32(ts * dx)) / f32(0.85));
          const ny = f32(f32(qy + f32(ts * dy)) / f32(0.85));
          const nz = f32(f32(qz + f32(ts * dz)) / f32(0.85));
          let nl = f32(f32(f32(nx * sunX) + f32(ny * sunY)) + f32(nz * sunZ));
          if (nl < 0.0) nl = f32(0.0);
          const ambT = f32(0.5 + f32(0.5 * ny));
          const ar = f32(f32(0.22) + f32(f32(f32(0.42) - f32(0.22)) * ambT));
          const ag = f32(f32(0.20) + f32(f32(f32(0.55) - f32(0.20)) * ambT));
          const ab = f32(f32(0.18) + f32(f32(f32(0.80) - f32(0.18)) * ambT));
          cr = f32(f32(0.84) * f32(f32(f32(2.10) * nl) + ar));
          cg = f32(f32(0.42) * f32(f32(f32(1.95) * nl) + ag));
          cb = f32(f32(0.28) * f32(f32(f32(1.75) * nl) + ab));
        }
      }

      const idx = (y * w + x) * 4;
      if (fault === "gamma_curve") {
        out[idx] = f32(Math.pow(Math.max(0, Math.min(1, cr)), 1.0 / 2.2));
        out[idx + 1] = f32(Math.pow(Math.max(0, Math.min(1, cg)), 1.0 / 2.2));
        out[idx + 2] = f32(Math.pow(Math.max(0, Math.min(1, cb)), 1.0 / 2.2));
      } else if (fault === "rb_channel_swap") {
        out[idx] = cb;
        out[idx + 1] = cg;
        out[idx + 2] = cr;
      } else {
        out[idx] = cr;
        out[idx + 1] = cg;
        out[idx + 2] = cb;
      }
      out[idx + 3] = f32(1.0);
    }
  }
  return out;
}

function acesFilmic(x) {
  const v = Math.max(0.0, x);
  const num = v * (2.51 * v + 0.03);
  const den = v * (2.43 * v + 0.59) + 0.14;
  return Math.max(0.0, Math.min(1.0, num / den));
}

function linearSrgbToOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function computeRadiometricParity(imgWgpu, imgDx12) {
  const nPx = imgWgpu.length / 4;
  let maxAbsLin = 0.0;
  let sqSum = 0.0;
  const des = new Float64Array(nPx);
  for (let i = 0; i < nPx; i++) {
    const k = i * 4;
    const ar = imgWgpu[k], ag = imgWgpu[k + 1], ab = imgWgpu[k + 2];
    const br = imgDx12[k], bg = imgDx12[k + 1], bb = imgDx12[k + 2];
    maxAbsLin = Math.max(maxAbsLin, Math.abs(ar - br), Math.abs(ag - bg), Math.abs(ab - bb));
    const ta = [acesFilmic(ar), acesFilmic(ag), acesFilmic(ab)];
    const tb = [acesFilmic(br), acesFilmic(bg), acesFilmic(bb)];
    sqSum += (ta[0] - tb[0]) ** 2 + (ta[1] - tb[1]) ** 2 + (ta[2] - tb[2]) ** 2;
    const la = linearSrgbToOklab(ta[0], ta[1], ta[2]);
    const lb = linearSrgbToOklab(tb[0], tb[1], tb[2]);
    des[i] = Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
  }
  des.sort();
  const mse = sqSum / (nPx * 3);
  const psnrDb = mse <= 1e-18 ? 999.0 : 10.0 * Math.log10(1.0 / mse);
  const idx99 = 0.99 * (nPx - 1);
  const lo = Math.floor(idx99), hi = Math.min(nPx - 1, lo + 1);
  const p99 = des[lo] + (des[hi] - des[lo]) * (idx99 - lo);
  return { maxAbsLin, psnrDb, p99OklabDeltaE: p99, maxOklabDeltaE: des[nPx - 1] };
}
