// The hero's clothes as fields in the bind pose (hero/rig.mjs APOSE), built over a body field so a
// coat is the body grown by its ease. Each returns { d(x,y,z), mat(x,y,z), lo, hi, cell?, bones,
// sigma } for hero/figure.mjs to mesh, weight and paint. Units metres, +x the person's left, +z ahead.
//   torsoCoat, sleeve, skirt, belt, trousers, boot, glove, hat, collar, satchel
import { ellBound } from "../forge/ellipsoid.mjs";
import { smin, smax, noise, fbm } from "../forge/sdf.mjs";
import { J } from "./rig.mjs";
import { INDEX } from "../rig/skeleton.mjs";

const hyp = Math.hypot, cl = (v, a, b) => Math.max(a, Math.min(b, v)), ss = (a, b, t) => { const x = cl((t - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = hyp(...a) || 1; return a.map((v) => v / l); };
export const ell = (p, c, r) => ellBound(p[0] - c[0], p[1] - c[1], p[2] - c[2], r[0], r[1], r[2]);
// round cone from a (radius ra) to b (rb); also returns the parameter along the axis
export function cone(p, a, b, ra, rb) {
  const ab = sub(b, a), ap = sub(p, a), L2 = dot(ab, ab), t = cl(dot(ap, ab) / L2, 0, 1);
  return hyp(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t) - (ra + (rb - ra) * t);
}
const ell2 = (x, z, rx, rz) => { const k0 = hyp(x / rx, z / rz), k1 = hyp(x / (rx * rx), z / (rz * rz)); return k1 > 0 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, rz); };
const box = (q, h, r = 0) => { const a = Math.abs(q[0]) - h[0] + r, b = Math.abs(q[1]) - h[1] + r, c = Math.abs(q[2]) - h[2] + r; return hyp(Math.max(a, 0), Math.max(b, 0), Math.max(c, 0)) + Math.min(Math.max(a, b, c), 0) - r; };
const bounds = (pts, pad) => [[0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])) - pad), [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])) + pad)];

// the trunk under the clothes: pelvis, waist, ribcage, shoulder girdle, deltoids, trapezius, neck base
export function bodyField(B, P) {
  const pel = J(B, "pelvis"), sp = J(B, "spine"), ch = J(B, "chest"), nk = J(B, "neck"), aL = J(B, "armL"), aR = J(B, "armR"), w = P.build ?? 1;
  return (x, y, z) => {
    const p = [x, y, z];
    let d = ell(p, [pel[0], pel[1] + 0.03, pel[2] - 0.01], [P.hip + 0.055 * w, 0.11, 0.1 * w]);
    d = smin(d, ell(p, sp, [0.15 * w, 0.11, 0.1 * w]), 0.09);
    d = smin(d, ell(p, [ch[0], ch[1] + 0.03, ch[2] - 0.005], [0.15 * w, 0.16, 0.09 * w]), 0.09);
    d = smin(d, ell(p, [ch[0], ch[1] + 0.1, ch[2] - 0.01], [P.shoulder * 0.8, 0.065, 0.08 * w]), 0.08);
    for (const a of [aL, aR]) d = smin(d, ell(p, [a[0] * 0.95, a[1], a[2]], [0.045, 0.05, 0.048]), 0.08);
    for (const [a, s] of [[aL, 1], [aR, -1]]) d = smin(d, cone(p, [nk[0] + s * 0.04, nk[1] + 0.01, nk[2] - 0.01], [a[0], a[1] + 0.03, a[2] - 0.005], 0.042, 0.038), 0.04);
    d = smin(d, cone(p, [nk[0], nk[1] - 0.03, nk[2]], [nk[0], nk[1] + 0.09, nk[2] - 0.005], 0.06, 0.052), 0.04);
    return d;
  };
}

// The coat's body: the trunk plus its ease, quilted by wool lumps and waist folds, the left front
// panel lapped over the right with a 4 mm step, a stand collar turned up round the neck, open at
// the throat; cut below at the waist seam (the skirt and belt cover it).
export function torsoCoat(B, P, C) {
  const body = bodyField(B, P), sp = J(B, "spine"), nk = J(B, "neck"), ch = J(B, "chest"), beltY = sp[1] - 0.06, ease = C.ease ?? 0.02;
  const y0 = nk[1] - 0.04, ch0 = C.collarH ?? 0.085;
  const coatD = (x, y, z) => {
    let d = body(x, y, z) - ease;
    if (Math.abs(d) < 0.02) d -= 0.0012 * fbm(x * 14, y * 14, z * 14) + 0.0022 * Math.exp(-(((y - beltY) / 0.06) ** 2)) * Math.sin(y * 2 * Math.PI / 0.028 + 2 * noise(x * 30, z * 30, 1));
    return d;
  };
  const d = (x, y, z) => {
    let v = coatD(x, y, z);
    if (z > ch[2] && C.lap !== false) v = Math.min(v, Math.max(v - 0.004, x - (0.075 - 0.25 * (y - ch[1]) * 0.2), beltY - y));
    v = smax(v, -cone([x, y, z], [nk[0], nk[1] - 0.06, nk[2] + 0.005], [nk[0], nk[1] + 0.4, nk[2]], 0.058, 0.058), 0.012);
    // the collar: a shell flaring from 7.5 cm, open in front by a V that widens upward
    const t = (y - y0) / ch0, r = 0.074 + 0.022 * cl(t, 0, 1), rad = hyp((x - nk[0]) / 1.0, (z - nk[2] + 0.004) / 0.95);
    let col = Math.max(Math.abs(rad - r) - 0.0045, y0 - y, y - (y0 + ch0 * (1 - 0.15 * Math.max(0, (z - nk[2]) / 0.08))));
    if (z > nk[2]) col = Math.max(col, (0.012 + 0.05 * cl(t, 0, 1)) - Math.abs(x - nk[0]));
    v = smin(v, col, 0.008);
    return Math.max(v, beltY - 0.03 - y);
  };
  const [lo, hi] = bounds([J(B, "armL"), J(B, "armR"), [sp[0], beltY - 0.04, sp[2] - 0.1], [nk[0], y0 + ch0 + 0.02, nk[2] + 0.12]], 0.12);
  return { name: "coat", d, coatD, mat: () => C.mat || "wool", lo, hi, bones: ["pelvis", "spine", "chest", "neck", "clavL", "clavR", "armL", "armR"], sigma: 0.035, kind: "torso", beltY };
}

// one sleeve: two round cones shoulder to wrist plus the shoulder cap, eased; bunched at the
// elbow; a turned-back cuff of lining; hollow at the wrist; starting inside the shoulder
export function sleeve(B, s, C) {
  const S = s > 0 ? "L" : "R", a = J(B, "arm" + S), e = J(B, "fore" + S), w = J(B, "hand" + S), ew = nrm(sub(w, e)), ae = nrm(sub(e, a)), L = hyp(...sub(w, e)), ease = C.sleeveEase ?? 0.012;
  const d = (x, y, z) => {
    const p = [x, y, z];
    let v = smin(cone(p, a, e, 0.062, 0.05), cone(p, e, w, 0.05, 0.043), 0.03);
    v = smin(v, ell(p, [a[0] - s * 0.008, a[1] + 0.005, a[2]], [0.058, 0.06, 0.06]), 0.05) - ease;
    const ue = dot(sub(p, e), ew), ua = dot(sub(p, a), ae);
    if (Math.abs(v) < 0.02) {
      const be = Math.exp(-((dot(sub(p, e), ae) / 0.07) ** 2));
      v -= be * 0.0042 * Math.sin(dot(sub(p, e), ae) * 2 * Math.PI / 0.034 + 1.6 * Math.atan2(z - e[2], y - e[1]) + 2.5 * noise(x * 40, y * 40, z * 40)) + 0.001 * fbm(x * 18, y * 18, z * 18);
    }
    if (ue > L - 0.075) v -= 0.0055 * ss(L - 0.075, L - 0.065, ue);   // the cuff
    v = Math.max(v, ue - (L - 0.012));
    if (ue > L - 0.06) v = smax(v, -(cone(p, e, w, 0.034, 0.033)), 0.003);
    return Math.max(v, -(ua + 0.035));
  };
  const mat = (x, y, z) => (dot(sub([x, y, z], e), ew) > L - 0.072 ? C.cuffMat || "lining" : C.mat || "wool");
  const [lo, hi] = bounds([a, e, w], 0.1);
  return { name: "sleeve" + S, d, mat, lo, hi, bones: ["clav" + S, "arm" + S, "fore" + S, "hand" + S], sigma: 0.03, kind: "sleeve", axis: [a, e, w] };
}

// The skirt of the coat: a hollow wool tent from the waist seam to the hem, elliptical and
// flaring, draped in flutes that deepen toward the hem, split up the front (wider at the hem) and
// vented at the back, the hem's line wavering a centimetre. The inside reads as lining.
export function skirt(B, P, C) {
  const sp = J(B, "spine"), pel = J(B, "pelvis"), top = sp[1] - 0.05, hem = C.hem, H = top - hem, f = C.flare ?? 0.55, w = P.build ?? 1;
  const geo = (y) => { const t = cl((top - y) / H, 0, 1), k = Math.pow(t, 1.15); return { t, rx: (0.163 + f * 0.33 * k) * w, rz: (0.122 + f * 0.27 * k) * w, cz: pel[2] - 0.012 - 0.03 * t }; };
  const solid = (x, y, z) => { const g = geo(y); return ell2(x, z - g.cz, g.rx, g.rz); };
  const d = (x, y, z) => {
    const g = geo(y), th = Math.atan2(x, z - g.cz);
    let e = ell2(x, z - g.cz, g.rx, g.rz);
    const amp = 0.003 + 0.02 * Math.pow(g.t, 1.6) * (C.drape ?? 1);
    e -= amp * (0.8 * Math.sin(8 * th + 1.3 * Math.sin(3 * th) + 2.2 * fbm(th * 1.5, y * 3, 0)) + 0.2 * Math.sin(13 * th + 3 * fbm(th * 3, y * 4, 2)));
    let v = Math.abs(e) - 0.0036;
    const hy = hem + 0.012 * Math.sin(th * 3 + 1) + 0.006 * Math.sin(th * 7);
    v = Math.max(v, hy - y, y - top);
    if (C.slit !== false && z > g.cz) v = Math.max(v, (0.003 + 0.04 * Math.pow(g.t, 1.5)) - Math.abs(x - 0.008));
    if (C.vent !== false && z < g.cz && g.t > 0.55) v = Math.max(v, (0.003 + 0.022 * (g.t - 0.55) / 0.45) - Math.abs(x));
    return v;
  };
  const g = geo(hem);
  const mat = (x, y, z) => { const gg = geo(y), e = ell2(x, z - gg.cz, gg.rx, gg.rz); return e < -0.0005 ? C.liningMat || "lining" : C.mat || "wool"; };
  return { name: "skirt", d, mat, solid, lo: [-g.rx - 0.06, hem - 0.03, g.cz - g.rz - 0.06], hi: [g.rx + 0.06, top + 0.03, g.cz + g.rz + 0.06], kind: "skirt", top, hem, cell: C.skirtCell };
}

// the belt over the waist seam: a 4 cm leather band 3.5 mm proud of the coat, a brass buckle in front
export function belt(B, coat, sk, C) {
  const y = coat.beltY, sp = J(B, "spine");
  const ref = (x, yy, z) => Math.min(coat.coatD(x, yy, z), sk.solid(x, yy, z));
  const d = (x, yy, z) => Math.max(Math.abs(ref(x, yy, z) - 0.004) - 0.0028, Math.abs(yy - y) - 0.02);
  return { name: "belt", d, mat: () => "leather", lo: [-0.25, y - 0.04, sp[2] - 0.22], hi: [0.25, y + 0.04, sp[2] + 0.22], bones: ["pelvis", "spine"], sigma: 0.05, kind: "belt", cell: 0.003 };
}

// trousers below the coat: round cones hip to knee to ankle, tucked into the boot
export function trousers(B, s, C) {
  const S = s > 0 ? "L" : "R", t = J(B, "thigh" + S), k = J(B, "shin" + S), f = J(B, "foot" + S), top = C.hem + 0.12;
  const d = (x, y, z) => {
    const p = [x, y, z];
    let v = smin(cone(p, t, k, 0.078, 0.058), cone(p, k, [f[0], f[1] + 0.05, f[2]], 0.058, 0.047), 0.03) - 0.008;
    if (Math.abs(v) < 0.01) v -= 0.0015 * fbm(x * 25, y * 25, z * 25);
    return Math.max(v, y - top, (C.bootTop - 0.05) - y);
  };
  return { name: "trouser" + S, d, mat: () => "cloth", lo: [k[0] - 0.12, C.bootTop - 0.07, k[2] - 0.12], hi: [k[0] + 0.12, top + 0.02, k[2] + 0.12], bones: ["thigh" + S, "shin" + S, "foot" + S], sigma: 0.025, kind: "leg" };
}

// a riding boot: the shaft from the boot top to the ankle, the foot, toe box and heel, the sole
// (welted 5 mm proud), creases over the instep; the top turned in a rolled cuff
export function boot(B, s, C) {
  const S = s > 0 ? "L" : "R", k = J(B, "shin" + S), f = J(B, "foot" + S), top = C.bootTop, fx = f[0], fz = f[2];
  const d = (x, y, z) => {
    const p = [x, y, z];
    let v = cone(p, [fx, top + 0.01, fz - 0.005], [fx, 0.1, fz], 0.058, 0.05);
    v = smin(v, ell(p, [fx, 0.05, fz + 0.05], [0.045, 0.044, 0.112]), 0.035);
    v = smin(v, ell(p, [fx, 0.042, fz + 0.15], [0.043, 0.032, 0.06]), 0.02);
    v = smin(v, box(sub(p, [fx, 0.045, fz - 0.035]), [0.036, 0.04, 0.04], 0.015), 0.02);
    v = smin(v, box(sub(p, [fx, 0.012, fz + 0.06]), [0.05, 0.012, 0.135], 0.01), 0.006);
    if (Math.abs(v) < 0.01) v -= 0.0018 * Math.exp(-(((y - 0.1) / 0.03) ** 2)) * Math.sin(y * 2 * Math.PI / 0.018 + 6 * noise(x * 30, z * 30, 3)) * ss(fz - 0.01, fz + 0.05, z) + 0.0007 * fbm(x * 40, y * 40, z * 40);
    v = smin(v, Math.max(Math.abs(hyp(x - fx, z - fz + 0.005) - 0.06) - 0.004, Math.abs(y - top + 0.005) - 0.012), 0.004);
    return Math.max(v, -y, y - top - 0.01);
  };
  const mat = (x, y, z) => (y < 0.024 ? "sole" : "leather");
  return { name: "boot" + S, d, mat, lo: [fx - 0.09, -0.01, fz - 0.12], hi: [fx + 0.09, top + 0.03, fz + 0.25], bones: ["shin" + S, "foot" + S], sigma: 0.04, kind: "boot", cell: 0.003 };
}

// A gloved fist in the hand's frame (fingers down -y, forward +z, the palm toward the body):
// the back of the hand, the roll of curled fingers, the knuckle ridge, the thumb across, the cuff.
export function glove(B, s, C) {
  const S = s > 0 ? "L" : "R", h = J(B, "hand" + S), R = B[INDEX["hand" + S]].R;
  const local = (p) => { const q = sub(p, h); return [(R[0] * q[0] + R[3] * q[1] + R[6] * q[2]) * s, R[1] * q[0] + R[4] * q[1] + R[7] * q[2], R[2] * q[0] + R[5] * q[1] + R[8] * q[2]]; };
  const d = (x, y, z) => {
    const q = local([x, y, z]);
    let v = box(sub(q, [0.002, -0.045, 0.004]), [0.021, 0.04, 0.041], 0.015);
    v = smin(v, cone(q, [-0.008, -0.088, 0.04], [-0.008, -0.086, -0.034], 0.0185, 0.0165), 0.012);
    v = smin(v, cone(q, [0.009, -0.078, 0.042], [0.009, -0.076, -0.034], 0.014, 0.012), 0.01);
    v = smin(v, cone(q, [-0.018, -0.028, 0.034], [-0.024, -0.072, 0.046], 0.0115, 0.0095), 0.01);
    v = smin(v, cone(q, [0, 0.005, 0], [0, 0.06, 0], 0.031, 0.036), 0.015);
    for (let k = 0; k < 4; k++) v += 0.0011 * Math.exp(-(((q[2] - (0.032 - k * 0.022)) / 0.004) ** 2)) * ss(-0.1, -0.08, q[1]);   // the gaps between fingers
    if (Math.abs(v) < 0.006) v -= 0.0005 * fbm(q[0] * 80, q[1] * 80, q[2] * 80);
    return Math.max(v, q[1] - 0.06);
  };
  return { name: "glove" + S, d, mat: () => "glove", lo: [h[0] - 0.14, h[1] - 0.14, h[2] - 0.14], hi: [h[0] + 0.14, h[1] + 0.12, h[2] + 0.14], bones: ["fore" + S, "hand" + S], sigma: 0.02, kind: "glove", cell: 0.0022 };
}

// The linen collar at the throat, standing 5 cm, its wings turned down in front.
export function collar(B, head) {
  const o = head.origin, y0 = o[1] - 0.205, h = 0.05, cz = o[2] - 0.016;
  const d = (x, y, z) => {
    const rad = hyp(x - o[0], (z - cz) / 0.96);
    let v = Math.max(Math.abs(rad - 0.058 - 0.004 * (y - y0) / h) - 0.0018, y0 - y, y - y0 - h);
    if (z > cz) v = Math.max(v, 0.008 - Math.abs(x - o[0]));
    for (const sx of [1, -1]) v = Math.min(v, Math.max(Math.abs(rad - 0.0615) - 0.0016, Math.abs(y - y0 - h * 0.62) - 0.014, -(z - cz - 0.03), Math.abs(x - o[0] - sx * 0.018) - 0.014));
    return v;
  };
  return { name: "collar", d, mat: () => "linen", lo: [o[0] - 0.09, y0 - 0.02, cz - 0.09], hi: [o[0] + 0.09, y0 + h + 0.02, cz + 0.1], bones: ["neck", "chest"], sigma: 0.04, kind: "collar", cell: 0.0022 };
}

// A felt hat in head-local metres (head.origin at the eyes): a crown with a front-to-back pinch,
// tapered, hollow; the brim curling up at the sides and down at the front, rolled at its edge; a
// grosgrain band. kind "brim" (Lamb's), "cap" (a peaked cloth cap), "hood" (a knitted hood).
export function hat(head, H) {
  const o = head.origin, kind = H.kind || "brim", y0 = H.y0 ?? 0.056, cz = -0.016, rx = H.rx ?? 0.084, rz = H.rz ?? 0.108, tilt = (H.tilt ?? 5) * Math.PI / 180;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const toHat = (x, y, z) => { const q = [x - o[0], y - o[1] - y0, z - o[2] - cz]; return [q[0], q[1] * ct + q[2] * st, -q[1] * st + q[2] * ct]; };
  const crownH = H.crown ?? 0.12, brim = H.brim ?? 0.075;
  const d = (x, y, z) => {
    const [hx, hy, hz] = toHat(x, y, z), k = cl(hy / crownH, 0, 1), sx = rx * (1 - 0.08 * k), sz = rz * (1 - 0.08 * k);
    if (kind === "cap") {
      let v = Math.max(ellBound(hx, hy + 0.01, hz, rx + 0.004, 0.085, rz + 0.004), -hy - 0.004);
      v = Math.max(v, -(ellBound(hx, hy + 0.01, hz, rx - 0.0, 0.08, rz - 0.0)));
      const peak = Math.max(Math.abs(hy - 0.004 + 0.12 * Math.max(0, hz - rz * 0.6) * 0.0) - 0.003, ell2(hx, hz - rz * 0.75, rx * 0.85, 0.06), -(hz - rz * 0.55));
      return smin(v, peak, 0.006);
    }
    const side = ell2(hx, hz, sx, sz), top = hy - (crownH - 0.02 * Math.exp(-((hx / 0.028) ** 2)) * ss(-0.06, 0.02, hz) - 0.006 * (hx / rx) ** 2);
    const crown = smax(side, top, 0.014);
    let v = Math.max(Math.abs(crown + 0.0024) - 0.0024, -hy);
    const rbx = rx + brim, rbz = rz + brim * 1.1, q = cl((hyp(hx / rx, hz / rz) - 1) / (brim / rx), 0, 1);
    const curl = (H.curl ?? 0.016) * q * q * (Math.abs(hx) / rbx) ** 2 - 0.012 * q * q * Math.max(0, hz / rbz) ** 2;
    const thick = 0.0032 + 0.0022 * ss(0.8, 1, q);
    v = Math.min(v, Math.max(Math.abs(hy - curl) - thick, ell2(hx, hz, rbx, rbz), -side - 0.002));
    return v;
  };
  const mat = (x, y, z) => { const [hx, hy, hz] = toHat(x, y, z); return kind === "brim" && hy > 0.002 && hy < 0.03 && ell2(hx, hz, rx, rz) > -0.004 ? "band" : H.mat || "felt"; };
  const above = (x, y, z) => { const [hx, hy, hz] = toHat(x, y, z); return hy > -0.006 && ell2(hx, hz, rx + 0.004, rz + 0.004) < 0; };
  const R = rx + brim + 0.03, Z = rz + brim * 1.1 + 0.03;
  return { name: "hat", d, mat, above, lo: [o[0] - R, o[1] + y0 - 0.05, o[2] + cz - Z], hi: [o[0] + R, o[1] + y0 + crownH + 0.04, o[2] + cz + Z], bones: ["head"], sigma: 1, kind: "hat", cell: 0.0022 };
}

// the Kit case on the left hip and its strap across the chest from the right shoulder
export function satchel(B, coat) {
  const pel = J(B, "pelvis"), aR = J(B, "armR"), ch = J(B, "chest"), c = [pel[0] + 0.2, pel[1] - 0.06, pel[2] - 0.05];
  const path = [[aR[0] + 0.03, aR[1] + 0.06, aR[2] - 0.01], [ch[0] - 0.02, ch[1] + 0.02, ch[2] + 0.13], [c[0] - 0.02, c[1] + 0.12, c[2] + 0.02]];
  const d = (x, y, z) => {
    const p = [x, y, z];
    let v = box(sub(p, c), [0.032, 0.1, 0.13], 0.012);
    v = Math.min(v, Math.max(box(sub(p, [c[0] + 0.006, c[1] + 0.04, c[2]]), [0.032, 0.065, 0.133], 0.012), -(p[0] - c[0] - 0.006)));
    // the strap: a 4 cm band across the front (by its line seen from ahead), lying 4.5 mm on the coat
    if (z > ch[2] - 0.02 && y > coat.beltY - 0.02) {
      const a = path[0], b = path[2], ab = [b[0] - a[0], b[1] - a[1]], t = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])));
      const s = hyp(x - a[0] - ab[0] * t, y - a[1] - ab[1] * t) - 0.02;
      if (s < 0.01) v = Math.min(v, Math.max(s, Math.abs(coat.coatD(x, y, z) - 0.0045) - 0.0018));
    }
    return v;
  };
  const mat = (x, y, z) => (hyp(x - c[0] - 0.04, y - c[1] - 0.0, z - c[2]) < 0.013 ? "brass" : "leather");
  return { name: "satchel", d, mat, lo: [aR[0] - 0.06, c[1] - 0.14, c[2] - 0.17], hi: [c[0] + 0.07, aR[1] + 0.1, ch[2] + 0.2], bones: ["pelvis", "spine", "chest", "clavR"], sigma: 0.06, kind: "strap", cell: 0.003 };
}
