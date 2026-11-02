// SPDX-License-Identifier: FSL-1.1-MIT
// CPU reference for the room's wave step: the same second-order update as the step shader, on any grid. Walls are
// rigid mirrors: a wall neighbour contributes the cell's own pressure, as in the shader.
export class WaveField {
  constructor(nx, ny, { cfl = 0.5, damp = 0, wall = () => false } = {}) {
    Object.assign(this, { nx, ny, k: cfl, damp });
    this.p = new Float64Array(nx * ny);
    this.q = new Float64Array(nx * ny);
    this.w = new Uint8Array(nx * ny);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) this.w[y * nx + x] = wall(x + 0.5, y + 0.5) ? 1 : 0;
  }
  step(src = null, amp = 0) {
    const { nx, ny, p, q, w, k, damp } = this;
    const next = new Float64Array(nx * ny);
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        const i = y * nx + x;
        if (w[i]) continue;
        const c = p[i];
        let s = 0;
        for (const j of [i + 1, i - 1, i + nx, i - nx]) s += w[j] ? c : p[j];
        next[i] = (2 - damp) * c - (1 - damp) * q[i] + k * k * (s - 4 * c);
      }
    if (src) {
      const R = 6;
      for (let y = Math.max(1, src[1] - R | 0); y < Math.min(ny - 1, src[1] + R); y++)
        for (let x = Math.max(1, src[0] - R | 0); x < Math.min(nx - 1, src[0] + R); x++) {
          const r2 = (x + 0.5 - src[0]) ** 2 + (y + 0.5 - src[1]) ** 2;
          next[y * nx + x] += amp * Math.exp(-r2 / 4);
        }
    }
    this.q = p;
    this.p = next;
  }
  at(x, y) {
    return this.p[Math.round(y) * this.nx + Math.round(x)];
  }
}
/** The page's click: a second-derivative pulse centred on step 20. */
export const click = (i, amp = 0.2) => {
  const u = (i - 20) / 6;
  return i < 60 ? amp * (1 - 2 * u * u) * Math.exp(-u * u) : 0;
};
/** Windowed single-frequency amplitude of a recording; the page's mode reader. */
export function amplitudeAt(s, f, dt) {
  let a = 0,
    b = 0;
  const n = s.length,
    w = 2 * Math.PI * f * dt;
  for (let i = 0; i < n; i++) {
    const h = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
    a += s[i] * h * Math.cos(w * i);
    b += s[i] * h * Math.sin(w * i);
  }
  return Math.hypot(a, b);
}
/** Rectangular room modes, c/2 * hypot(m/Lx, q/Ly). */
export const roomMode = (c, Lx, Ly, m, q) => (c / 2) * Math.hypot(m / Lx, q / Ly);
