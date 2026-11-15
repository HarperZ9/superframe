// Lamp pools that answer the crowd: people standing in a lamp's pool take its light off the ground (the
// pool reads broken and darker when the relief queue fills it), and each body lays a soft shadow away from
// the lamp. The gain is for the pool's ground light, not for the lamp itself (the lamp's head and the
// people in it stay lit). Original code.
//   crowdGains(lights, figs)        -> Float32Array, per light: 1 with nobody in its pool, down to 0.55 packed
//   crowdShadows(lights, figs, opt) -> [{ at, dir:[x,z], len, k }] one per body and ruling lamp, for both styles
const BODY = 0.28;   // a body's footprint radius, metres

export function crowdGains(lights, figs) {
  const out = new Float32Array(lights.length).fill(1);
  for (let i = 0; i < lights.length; i++) {
    // the pool's light-weighted area: the integral of (1 - d/r)^2 over the disc is pi r^2 / 6
    const L = lights[i], r = Math.max(0.5, L.reach * 0.6), area = (Math.PI * r * r) / 6; let cover = 0;
    for (const f of figs) {
      const dx = f.at[0] - L.at[0], dz = f.at[2] - L.at[2], d = Math.hypot(dx, dz); if (d > r) continue;
      // a body's shadow is longer the further it stands from under the lamp, and weighs by the pool's falloff there
      const len = Math.min(3, (1.6 * d) / Math.max(0.6, L.at[1] - 1.6)) + BODY, w = (1 - d / r) ** 2;
      cover += (2 * BODY * len * w) / area;
    }
    out[i] = Math.max(0.55, 1 - 0.9 * cover);
  }
  return out;
}
export function crowdShadows(lights, figs, { gains = null, min = 0.05 } = {}) {
  const out = [];
  for (const f of figs) {
    let best = null, bw = 0;
    for (let i = 0; i < lights.length; i++) {
      const L = lights[i], dx = f.at[0] - L.at[0], dz = f.at[2] - L.at[2], d = Math.hypot(dx, dz); if (d >= L.reach) continue;
      const w = L.e0 * (1 - d / L.reach) ** 2 * (gains ? gains[i] : 1); if (w > bw) { bw = w; best = { L, dx, dz, d }; }
    }
    if (!best || bw < min) continue;
    const { L, dx, dz, d } = best, l = d || 1, len = Math.min(4, (1.7 * d) / Math.max(0.5, L.at[1] - 1.7) + 0.3);
    out.push({ at: f.at, dir: [dx / l, dz / l], len, k: Math.min(1, bw * 2.5) });
  }
  return out;
}
