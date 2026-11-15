// Sun glints on water (the author's section 13): where the sun's (or the moon's, or a lamp's) reflection crosses rippled
// water, a field of sparkling speculars. Each wet sample's surface is tilted by a small travelling ripple; a glint shows
// where the camera's ray, reflected about that tilted surface, points within a hair of the light. The river, the flooded
// ruts, the thaw ring round a fire. Twinkles off with flicker off (the glints then hold still). Original code.
import { registerEffect, hash } from "./core.mjs";
import { camBasis } from "../world/plateworld.mjs";

function wetSamples(ctx) {
  if (ctx.mem.wetS) return ctx.mem.wetS; const F = ctx.F, out = [], s = ctx.pj.width / F.w;
  for (let i = 0; i < F.n; i += 2) if (F.rec.wet[i] > 140 && F.up[i] > 235) out.push({ i, x: ((i % F.w) + 0.5) * s, y: (Math.floor(i / F.w) + 0.5) * s, p: [F.pos[i * 3], F.pos[i * 3 + 1], F.pos[i * 3 + 2]] });
  return (ctx.mem.wetS = out);
}
registerEffect({ id: "glints", group: "water", story: "wet and flooded ground under the sun, the moon or a lamp", cost: { low: 0.2, high: 0.6 },
  step(ctx, out, set) {
    const F = ctx.F; if (!F) return; const W = wetSamples(ctx); if (!W.length) return; const B = camBasis(ctx.pj.camera), f = B.f, S = ctx.sky;
    const lights = []; if (S.sun.E > 0.02) lights.push({ d: S.sun.dir, rgb: S.sun.rgb, k: Math.min(1, S.sun.E * 5) }); if (S.moon.E > 0.002) lights.push({ d: S.moon.dir, rgb: S.moon.rgb, k: 0.5 });
    const t = set.flicker === "off" ? 0 : ctx.t, cap = set.quality === "low" ? 150 : 500; let n = 0;
    // a chop's facets: the share of the surface tilted to send the light into the eye goes as a Beckmann-like lobe about the
    // half vector, wider with the wind; each wet sample sparkles in its own moments, so the field twinkles
    const sg = 0.12 + 0.28 * Math.min(1.2, ctx.wind), slot = Math.floor(t * 6);
    for (const L of lights) {
      const h = [L.d[0] - f[0], L.d[1] - f[1], L.d[2] - f[2]], hl = Math.hypot(...h), tn = Math.hypot(h[0], h[2]) / Math.max(1e-3, h[1]), prob = Math.exp(-(tn * tn) / (sg * sg)) * 0.6;
      if (prob < 1e-4) continue;
      for (const w of W) {
        const u = hash(w.i, slot, 31); if (u > prob) continue; const k = (1 - u / prob) * L.k;
        out.push({ k: "glint", x: w.x, y: w.y, d: ctx.depth(w.p), r: 0.6 + 1.4 * k, a: Math.min(1, 0.35 + k), rgb: L.rgb.map((v) => Math.min(1, 0.55 + v)), glow: true, ang: 0, len: 0 });
        if (++n >= cap) return;
      }
    }
  } });
export const WATER = true;
