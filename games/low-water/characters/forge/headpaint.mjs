// Paint on the sculpted head, per vertex (it multiplies the material colour in the shading):
// warm cheeks and nose, a cooler jaw, stubble or a beard shadow, freckles, blotches, soot with
// pale rings round the eyes, broken veins. Head-local metres, s applied (P is the merged record).
//   headPaint(P, paint) -> (p) => [r, g, b]
import { fbm, noise } from "./sdf.mjs";

const sm = (a, b, t) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
export function headPaint(P, o = {}) {
  const s = P.s, ck = P.cheek.map((v) => v * s), nt = P.nose_tip.map((v) => v * s), my = P.mouth_y * s, ex = P.eye_x * s, ey = P.eye_y * s, ez = P.eye_z * s, er = P.eye_r * s;
  const warm = o.warm ?? 0.5, cool = o.cool ?? 0.4, stub = o.stubble || 0, blotch = o.blotch || 0, freck = o.freckles || 0, rings = o.eyeRings || 0, veins = o.veins || 0, tone = o.tone || [1, 1, 1];
  return (p) => {
    const [x, y, z] = p; let c = [tone[0], tone[1], tone[2]];
    const mul = (col, a) => { if (a <= 0) return; a = Math.min(1, a); c = c.map((v, k) => v * (1 - a + col[k] * a)); };
    const front = sm(-0.01 * s, 0.04 * s, z);
    // warm on the cheekbones and the nose tip, cool below the mouth (the painter's zones)
    const dc = Math.min(Math.hypot(x - ck[0], y - ck[1], z - ck[2]), Math.hypot(x + ck[0], y - ck[1], z - ck[2]));
    mul([1.06, 0.92, 0.88], warm * 0.45 * (1 - sm(0.0, 0.07 * s, dc)) * front);
    mul([1.08, 0.88, 0.85], warm * 0.5 * (1 - sm(0.0, 0.03 * s, Math.hypot(x, y - nt[0], z - nt[1]))));
    mul([0.9, 0.95, 1.02], cool * sm(my + 0.005 * s, my - 0.03 * s, y) * front);
    // stubble or a beard shadow over the jaw and the upper lip
    if (stub > 0) { const jaw = sm(ck[1] - 0.012 * s, ck[1] - 0.035 * s, y) * front * (0.75 + 0.25 * noise(x * 900 / s, y * 900 / s, z * 900 / s)); mul([0.55, 0.53, 0.55], stub * jaw); }
    if (blotch > 0) mul([1.15, 0.78, 0.74], blotch * Math.max(0, fbm(x / (0.02 * s), y / (0.02 * s), z / (0.02 * s), 2) * 3));
    if (freck > 0) { const n = noise(x / (0.0045 * s) + 11, y / (0.0045 * s), z / (0.0045 * s)); if (n > 0.78) mul([0.72, 0.55, 0.45], freck * (n - 0.78) / 0.22 * 2 * front * sm(-0.06 * s, 0, y)); }
    if (veins > 0) { const n = noise(x / (0.003 * s) + 5, y / (0.003 * s), z / (0.003 * s)); if (n > 0.8 && dc < 0.03 * s) mul([1.2, 0.6, 0.6], veins); }
    if (rings > 0) for (const sx of [-1, 1]) { const d = Math.hypot((x - sx * ex) / 1.25, y - ey, z - ez); c = c.map((v) => v * (1 + rings * (1 - sm(er * 1.2, er * 2.6, d)))); }
    return c;
  };
}
