// Hair for the sculpted head (cast/sculpt.mjs): a volume grown off the skin itself (an offset of the head's own
// field, so it follows the forehead, temples and crown), kept above a hairline that runs from the forehead
// down past the temples to the nape and round the ears, with more volume on the crown and clumps, not a cap
// of paint. R units about the head's centre, as cast/sculpt_face.mjs.
//   hairShapes(o, L, skinD) -> forge shapes; skinD(x, y, z) is the head's signed distance in R units
//   hairPaint(o) -> a vertex tint for hair
import { noise } from "../forge/sdf.mjs";
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function hairShapes(o, L, skinD) {
  const style = o.hair || "none"; if (style === "none" || !skinD) return [];
  const crop = style === "crop", tx = o.hairTex || 0, fem = L.fem, rec = L.man && L.old > 0 ? 0.08 * L.old + 0.04 : L.man ? 0.03 : 0;
  const t = crop ? 0.028 : fem ? 0.045 : L.kid > 0.3 ? 0.045 : 0.05, crown = crop ? 0.012 : 0.04, yh = L.yb + 0.5 + 0.03 * L.kid;
  const earY = L.earY, sx = L.sk3[0];
  const f = (x, y, z) => {
    const ax = Math.abs(x);
    // the hairline: the forehead's, falling over the temples and down to the nape; recessions at the temples
    const line = yh - 0.95 * (0.62 - z) + rec * Math.exp(-(((ax - 0.36) / 0.12) ** 2)) * sm(0.25, 0.6, z) + 0.03 * (noise(x * 14, z * 14, 3) - 0.5);
    const below = line - y;   // positive below the hairline
    const ear = 1 - Math.hypot((ax - 0.6 * sx) / 0.24, (y - earY) / 0.34, (z + 0.06) / 0.22);   // positive near the ear
    // thickness: fuller on the crown, clumped (straight hair in broad locks, curls in tight bumps)
    const th = t + crown * sm(0.3, 0.9, y) * sm(-0.6, 0.1, z) + (0.012 + 0.02 * tx) * (noise(x * (5 + 9 * tx), y * (4 + 9 * tx), z * (5 + 9 * tx)) - 0.5);
    const shell = skinD(x, y, z) - th;
    return Math.max(shell, below * 0.6, ear * 0.15);
  };
  const shapes = [{ t: "fn", f, bc: [0, 0.3, -0.15], br: 1.4, mat: o.hairMat || "hair", k: 0.006, op: "add" }];
  if (o.scarf) {   // a headscarf tied at the nape: cloth over the hair, the hair showing at the forehead
    const sl = (x, y, z) => yh + 0.07 - 0.75 * (0.62 - z) - y, sth = t + 0.05;
    shapes.push({ t: "fn", bc: [0, 0.3, -0.15], br: 1.5, mat: o.scarf, k: 0.01, op: "add", f: (x, y, z) => Math.max(skinD(x, y, z) - sth - 0.015 * (noise(x * 6, y * 6, z * 6) - 0.5), sl(x, y, z) * 0.6, (1 - Math.hypot((Math.abs(x) - 0.6 * sx) / 0.2, (y - earY) / 0.26, (z + 0.06) / 0.2)) * 0.12) });
    shapes.push({ t: "ell", c: [0, L.earY - 0.05, -0.92], r: [0.16, 0.12, 0.1], mat: o.scarf, k: 0.02, op: "add" });   // the knot
    shapes.push({ t: "cap", a: [0.03, L.earY - 0.1, -0.95], b: [0.06, L.earY - 0.45, -0.9], r: [0.07, 0.04], mat: o.scarf, k: 0.02, op: "add" }); }
  if (fem && !crop) shapes.push({ t: "cap", a: [0, 1.06, 0.45], b: [0, 1.08, -0.35], r: [0.012, 0.012], k: 0.01, op: "sub" });   // a parting, the hair drawn back
  return shapes;
}

// hair a shade lighter on the crown where the light falls and darker at the nape (painted, not shaded)
export function hairPaint() { return ([, y]) => { const k = 0.93 + 0.1 * sm(0.2, 0.9, y); return [k, k, k]; }; }
