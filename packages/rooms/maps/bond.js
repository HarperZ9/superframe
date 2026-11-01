// SPDX-License-Identifier: FSL-1.1-MIT
// A one-junction bond graph: effort source, inertance, resistance, compliance on one common flow. Paynter's elements.
//   I df/dt = e(t) - R f - loss(f) - q/C,   dq/dt = f
// Three carriers on one layer, each with its own units. Effort times flow is power in watts in all three.

const RHO = 1000, MU = 1e-3, G = 9.81; // water near 20 C: value from memory, standard
const PIPE_L = 2, PIPE_R = 0.002; // m

export const omega0 = (s) => 1 / Math.sqrt(s.I * s.C);
export const zeta = (s) => (s.R / 2) * Math.sqrt(s.C / s.I);

/** Blasius wall friction above Re 2300, as a loss replacing the laminar term. Zero for a linear system. */
function pipeLoss(f) {
  const a = Math.PI * PIPE_R ** 2;
  const Re = (2 * RHO * Math.abs(f)) / (Math.PI * PIPE_R * MU);
  if (Re <= 2300) return null;
  return ((0.316 / Re ** 0.25) * (PIPE_L / (2 * PIPE_R)) * RHO * (f / a) ** 2 * Math.sign(f)) / 2;
}

export const pipeRe = (f) => (2 * RHO * Math.abs(f)) / (Math.PI * PIPE_R * MU);

/** Three systems with one omega0 and one zeta. Pipe wall friction fixes R, which sets zeta 0.2 at omega0 5. */
export function threeSystems() {
  const a = Math.PI * PIPE_R ** 2;
  const Ip = (RHO * PIPE_L) / a, Rp = (8 * MU * PIPE_L) / (Math.PI * PIPE_R ** 4);
  const w = 5;
  return {
    mass: { name: "Mass on a spring", I: 2, R: 2 * 0.2 * 5 * 2, C: 1 / (2 * w * w), e0: 1, effort: "force, N", flow: "velocity, m/s", store: "position, m" },
    rlc: { name: "RLC loop", I: 0.05, R: 2 * 0.2 * 5 * 0.05, C: 1 / (0.05 * w * w), e0: 1, effort: "voltage, V", flow: "current, A", store: "charge, C" },
    pipe: { name: "Pipe into a tank", I: Ip, R: Rp, C: 1 / (Ip * w * w), e0: 1000, effort: "pressure, Pa", flow: "flow, m3/s", store: "volume, m3", loss: pipeLoss },
  };
}

export function deriv(s, y, e) {
  const [q, f] = y;
  const fric = (s.loss && s.loss(f)) ?? s.R * f;
  return [f, (e - fric - q / s.C) / s.I];
}

export function rk4(s, y, e0, e1, dt) {
  const eh = (e0 + e1) / 2;
  const a = deriv(s, y, e0);
  const b = deriv(s, [y[0] + (dt / 2) * a[0], y[1] + (dt / 2) * a[1]], eh);
  const c = deriv(s, [y[0] + (dt / 2) * b[0], y[1] + (dt / 2) * b[1]], eh);
  const d = deriv(s, [y[0] + dt * c[0], y[1] + dt * c[1]], e1);
  return [y[0] + (dt / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]), y[1] + (dt / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1])];
}

/** The dimensionless store: q over C e0. Equal across the three as long as the map holds. */
export const shared = (s, y) => y[0] / (s.C * s.e0);

/** Run one disturbance u(t) through all three. Effort in each domain is u times that domain's e0 times drive. */
export function runThree(u, T, dt, drive = 1) {
  const S = threeSystems();
  const keys = Object.keys(S);
  const y = Object.fromEntries(keys.map((k) => [k, [0, 0]]));
  const n = Math.round(T / dt);
  const out = Object.fromEntries(keys.map((k) => [k, new Float64Array(n + 1)]));
  for (let i = 0; i < n; i++) {
    const t = i * dt;
    for (const k of keys) {
      const s = S[k];
      y[k] = rk4(s, y[k], u(t) * s.e0 * drive, u(t + dt) * s.e0 * drive, dt);
      out[k][i + 1] = shared(s, y[k]) / drive;
    }
  }
  return out;
}

export function nrmse(a, b) {
  let e = 0, m = 0, v = 0;
  for (const x of b) m += x;
  m /= b.length;
  for (let i = 0; i < a.length; i++) { e += (a[i] - b[i]) ** 2; v += (b[i] - m) ** 2; }
  return Math.sqrt(e / Math.max(v, 1e-300));
}
