// SPDX-License-Identifier: FSL-1.1-MIT
// G. I. Taylor's unmixing as a known answer: annular Stokes flow wound out and back. The map is exact and has no speed
// in it; a random walk stands in for diffusion. Same formula, sizes and metric as the reversal study in the working
// notes, with this package's own generator, so agreement with that study's curve is statistical and not bitwise.
import { stokesShear } from "./exact.js";

export const TAYLOR = { A: 0.4, B: 1, BLOB: 0.08, CX: 0.7 };
/** Small seeded generator: mulberry32 with Box-Muller. */
export function normalSource(seed) {
  let s = seed >>> 0, spare = null;
  const u = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    u,
    n() {
      if (spare !== null) { const x = spare; spare = null; return x; }
      const r = Math.sqrt(-2 * Math.log(1 - u())), a = 2 * Math.PI * u();
      spare = r * Math.sin(a);
      return r * Math.cos(a);
    },
  };
}
/** Fraction of the blob back inside 1.1 blob radii after turns out and back at this Peclet number. */
export function taylorCycle({ count = 4000, turns = 10, peclet = Infinity, steps = 200, seed = 1, kick = 0 } = {}) {
  const { A, B, BLOB, CX } = TAYLOR, shear = stokesShear(A, B), rnd = normalSource(seed);
  const phi = 2 * Math.PI * turns, d = phi / steps;
  const noise = Number.isFinite(peclet) ? Math.sqrt((2 * phi * A * A) / peclet / steps) : 0;
  let back = 0;
  for (let i = 0; i < count; i++) {
    const t0 = rnd.u() * 2 * Math.PI, s0 = BLOB * Math.sqrt(rnd.u());
    let x = CX + s0 * Math.cos(t0), y = s0 * Math.sin(t0);
    for (let leg = 0; leg < 2; leg++) {
      const sign = leg ? -1 : 1, dphi = d * sign;
      for (let k = 0; k < steps; k++) {
        const r = Math.hypot(x, y), a = Math.atan2(y, x) + shear(r) * dphi;
        x = r * Math.cos(a); y = r * Math.sin(a);
        if (noise) {
          x += noise * rnd.n(); y += noise * rnd.n();
          const q = Math.hypot(x, y), th = Math.atan2(y, x), m = B - Math.abs(B - (A + Math.abs(q - A)));
          x = m * Math.cos(th); y = m * Math.sin(th);
        }
      }
      if (leg === 0 && kick) { const r = Math.hypot(x, y), a = Math.atan2(y, x) + shear(r) * kick; x = r * Math.cos(a); y = r * Math.sin(a); }
    }
    if (Math.hypot(x - CX, y) <= BLOB * 1.1) back++;
  }
  return back / count;
}
