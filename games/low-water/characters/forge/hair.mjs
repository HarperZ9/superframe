// Hair and beards as sculpted volume (not a blob laid over the skull): a shell grown off the cranium
// and kept above a hairline, styled; beards grown off the jaw and kept below the cheekbones.
// hairShapes(P, hair, beard, skinField) -> shapes in head-local metres (P is the merged head record,
// s applied). hair: { style, vol, line, back, noise, top, ... }; beard: { style, vol, top, ... }.
// Styles: bald, crop, wild, bun, roll, fringe (a ring round a bald top), under (a full head under a cap),
// tied (a tail at the back), swept (a fringe falling forward). Beards: short, full, moustache,
// sideburns, walrus. Stubble and soot are paint (forge/headpaint.mjs).
import { ellBound } from "./ellipsoid.mjs";
import { fbm, smin, smax } from "./sdf.mjs";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function hairShapes(P, hair = {}, beard = {}, skinField = null) {
  const s = P.s, cc = P.cran_c.map((v) => v * s), cr = P.cran.map((v) => v * s), out = [], style = hair.style || "bald";
  const fn = (f, c, r, mat = "hair", k = 0.002 * s) => out.push({ t: "fn", f, bc: c, br: r, mat, k, op: "add" });
  if (style !== "bald") {
    const vol = (hair.vol ?? 0.006) * s, line = (hair.line ?? 0.065) * s, back = (hair.back ?? -0.045) * s, nz = (hair.noise ?? 0.0015) * s;
    const top = hair.top != null ? hair.top * s : null, under = style === "fringe";   // "under" (a cap over it) is a full head of hair: the cap hides the crown, the rest shows
    const zf = cc[2] + cr[2], zb = cc[2] - cr[2], R = [cr[0] + vol, cr[1] + vol, cr[2] + vol];
    const box = P.cran_box || 0;
    const shell = (x, y, z) => {
      let d = ellBound(x - cc[0], y - cc[1], z - cc[2], R[0], R[1] * (1 + 0.05 * (P.cran_egg || 0)), R[2]);
      if (box > 0) { const qx = Math.abs(x - cc[0]) - R[0] * 0.95, qy = Math.abs(y - cc[1]) - R[1] * 0.9, qz = Math.abs(z - cc[2]) - R[2] * 0.93; d = d * (1 - box * 0.5) + box * 0.5 * (Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)); }
      if (P.cran_egg > 0) d = smin(d, ellBound(x - cc[0], y - cc[1] - cr[1] * 0.42, z - cc[2] + 0.004 * s, cr[0] * (1 - 0.32 * P.cran_egg) + vol, cr[1] * 0.7 + vol, cr[2] * (1 - 0.2 * P.cran_egg) + vol), 0.024 * s);
      return d;
    };
    const lineY = (x, z) => { const t = clamp((z - zb) / (0.8 * (zf - zb)), 0, 1); return back + (line - back) * t * t + Math.abs(x) * (hair.temple ?? 0.25); };
    const f = (x, y, z) => {
      let d = shell(x, y, z);
      d = smax(d, lineY(x, z) - y, 0.006 * s);                                    // the hairline
      if (under && top != null) d = smax(d, y - top + Math.max(0, z - cc[2]) * 0.3, 0.006 * s);   // nothing above the cap band, or a bald crown
      if (nz) d += nz * fbm(x / (0.012 * s), y / (0.012 * s), z / (0.012 * s), 2) * 2;   // uneven, cut with a knife
      return d;
    };
    fn(f, cc, Math.max(...R) + 0.02 * s);
    if (style === "wild") fn((x, y, z) => ellBound(x - cc[0], y - cc[1] - 0.03 * s, z - cc[2] + 0.02 * s, R[0] + 0.01 * s, R[1] * 0.75, R[2] + 0.008 * s) + 0.004 * s * fbm(x / (0.02 * s), y / (0.02 * s), z / (0.02 * s), 2) * 4, cc, Math.max(...R) + 0.03 * s);
    if (style === "bun") { const b = hair.bun || [0, 0.075, -0.075, 0.034]; fn((x, y, z) => ellBound(x - b[0] * s, y - b[1] * s, z - b[2] * s, b[3] * s * 1.1, b[3] * s * 0.85, b[3] * s), b.slice(0, 3).map((v) => v * s), b[3] * s * 1.3); }
    if (style === "roll") fn((x, y, z) => ellBound(x, y - 0.01 * s, z - (cc[2] - cr[2] * 0.82), cr[0] * 0.8, 0.026 * s, 0.03 * s), [0, 0.01 * s, cc[2] - cr[2]], cr[0]);
    if (style === "tied") { const a = [0, 0.02 * s, cc[2] - cr[2] - 0.004 * s], b = [0, -0.06 * s, cc[2] - cr[2] - 0.03 * s]; fn((x, y, z) => capD(x, y, z, a, b, 0.016 * s, 0.008 * s) + 0.002 * s * fbm(x * 80 / s, y * 80 / s, z * 80 / s), a, 0.1 * s); }
    if (style === "swept") fn((x, y, z) => ellBound(x - 0.012 * s, y - (line - 0.004 * s), z - (zf - 0.012 * s), 0.052 * s, 0.017 * s, 0.026 * s) + 0.002 * s * fbm(x * 90 / s, y * 90 / s, z * 90 / s), [0, line, zf], 0.07 * s);
    if (hair.gather) { const g = hair.gather; fn((x, y, z) => ellBound(x, y - g[0] * s, z - g[1] * s, g[2] * s, g[2] * s * 0.7, g[2] * s * 0.8) + 0.003 * s * fbm(x * 70 / s, y * 70 / s, z * 70 / s), [0, g[0] * s, g[1] * s], g[2] * s * 1.3); }
  }
  const bs = beard.style;
  if (bs && bs !== "none") {
    const vol = (beard.vol ?? 0.006) * s, my = P.mouth_y * s, mz = P.mouth_z * s, mw = P.mouth_w * s, nt = P.nose_tip.map((v) => v * s);
    if ((bs === "short" || bs === "full") && skinField) {
      const yTop = (beard.top ?? (P.mouth_y + 0.016)) * s;   // from the upper lip down, so the nose and cheeks stay bare
      fn((x, y, z) => {
        let d = skinField(x, y, z) - vol;
        d = smax(d, y - yTop - Math.max(0, Math.abs(x) - mw) * 0.5, 0.005 * s);   // rising a little up the cheeks
        d = smax(d, -0.04 * s - z, 0.006 * s);                                    // not round the back of the neck
        d = smax(d, -(Math.hypot(x / (mw * 1.45), (y - my + 0.002 * s) / (0.016 * s)) - 1) * 0.014 * s, 0.003 * s);   // the mouth stays clear
        return d + 0.0015 * s * fbm(x * 120 / s, y * 120 / s, z * 120 / s) * 2;
      }, [0, my - 0.02 * s, mz - 0.03 * s], 0.11 * s);
    }
    if (bs === "moustache" || bs === "walrus" || bs === "full") {
      const droop = bs === "walrus" ? 0.014 * s : 0.004 * s, r = (beard.mvol ?? (bs === "walrus" ? 0.009 : 0.006)) * s;
      for (const x of [-1, 1]) { const a = [x * 0.004 * s, nt[0] - 0.008 * s, nt[1] - 0.012 * s], b = [x * (mw + 0.004 * s), my - droop, mz - 0.002 * s]; fn((px, py, pz) => capD(px, py, pz, a, b, r, r * 0.6), a, 0.06 * s); }
    }
    if (bs === "sideburns" || beard.sideburns) for (const x of [-1, 1]) {
      const a = [x * (cr[0] - 0.006 * s), 0.02 * s, cc[2] + 0.02 * s], b = [x * (P.jaw_w * s * 1.02), (P.jaw_y - 0.01) * s, 0.008 * s];
      fn((px, py, pz) => capD(px, py, pz, a, b, 0.012 * s, 0.01 * s), a, 0.1 * s);
    }
  }
  return out;
}
function capD(x, y, z, a, b, r0, r1) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2], px = x - a[0], py = y - a[1], pz = z - a[2], h = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz), 0, 1);
  return Math.hypot(px - bx * h, py - by * h, pz - bz * h) - (r0 + (r1 - r0) * h);
}
