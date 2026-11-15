// The sculptor's head: the director's parametric head (forge/anatomy.mjs, anatomy.py) widened with
// the keys in forge/headkeys.mjs: a boxed or egged cranium and face, squared jaw corners, a chin of
// its own width, hollow cheeks, a two-segment nose, a muzzle, nasolabial folds, eye bags, sculpted
// brows, ears that stand out, a double chin, an Adam's apple, a toothless collapse. Expressions move
// the brows, lids and mouth. Skin is one material; warm and cool zones are paint (forge/headpaint.mjs),
// so no ink line runs across a cheek.
//   headShapes(prm, expr, { neckTo }) -> { shapes, origin, crown }   metres, head-local, scaled by s
import { DEFAULTS } from "./headkeys.mjs";

// Expression sliders (2026-10-21), each -1..1 unless noted, on top of a preset (cast/parts.mjs
// EXPRESSIONS: browY, browIn, lidsAdd, open, mouthW, press, in the old head's units):
//   brow     both brows down (-1) or up (1), about 12 mm
//   browInner the inner ends pinched down (-1) or lifted (1), about 9 mm (browIn is the preset key)
//   lids     upper lids wide (-1) to shut (1)
//   corners  mouth corners down (-1) or up (1)
//   jaw      0 closed .. 1 open, about 22 mm at the chin
export const EXPR_SLIDERS = { brow: [-1, 1], browInner: [-1, 1], lids: [-1, 1], corners: [-1, 1], jaw: [0, 1] };
export function exprDelta(X = {}) {
  const c = (k) => Math.max(EXPR_SLIDERS[k][0], Math.min(EXPR_SLIDERS[k][1], X[k] || 0));
  return { brow: (X.browY || 0) * 0.08 + c("brow") * 0.012, browIn: (X.browIn || 0) * 0.08 + c("browInner") * 0.009, lid: -(X.lidsAdd || 0) * 0.45 - c("lids") * 0.6,
    open: (X.open || 0) * 0.085 + c("jaw") * 0.022, mouthW: X.mouthW || 1, press: !!X.press, corners: c("corners") * 1.4 };
}

export function headShapes(prm = {}, X = {}, { neckTo = null } = {}) {
  const P = { ...DEFAULTS, ...prm }, s = P.s, D = exprDelta(X), sh = [];
  const S = (v) => v.map((x) => x * s), k = 0.012 * s, push = (o) => (sh.push(o), o);
  const ell = (c, r, mat, extra = {}) => push({ t: "ell", c: S(c), r: S(r), mat, k, exact: true, ...extra });
  const cone = (a, b, r0, r1, mat, extra = {}) => push({ t: "cap", a: S(a), b: S(b), r: [r0 * s, r1 * s], mat, k, ...extra });
  const box = (c, r, round, mat, extra = {}) => push({ t: "box", c: S(c), r: S(r), round: round * s, mat, k, ...extra });
  const sph = (c, r, mat, extra = {}) => ell(c, [r, r, r], mat, extra);
  const skin = "skin";
  const [jw, jy, cz] = [P.jaw_w, P.jaw_y, P.chin_z], open = D.open, jl = P.jaw_len + open * 0.6;
  const [ex, ey, ez, er] = [P.eye_x, P.eye_y, P.eye_z, P.eye_r];
  const nb = P.nose_bridge, nt = P.nose_tip, nh = P.nose_hump;
  const mw = P.mouth_w * D.mouthW, my = P.mouth_y - open * 0.35, mz = P.mouth_z - P.toothless * 0.012 + P.muzzle * 0.5;
  const lipF = P.lip_full * (D.press ? 0.55 : 1) * (1 - 0.6 * P.toothless);

  // the cranium: an ellipsoid, made boxy (a loaf) or drawn up into an egg
  const cr = P.cran, cc = P.cran_c;
  ell(cc, cr, skin, P.cran_tilt ? { rot: [P.cran_tilt, 0, 0] } : {});
  if (P.cran_box > 0) box(cc, [cr[0] * 0.93, cr[1] * 0.86, cr[2] * 0.9], Math.min(...cr) * (1 - 0.55 * P.cran_box), skin, { k: k * 1.5 });
  if (P.cran_egg > 0) ell([cc[0], cc[1] + cr[1] * 0.42, cc[2] - 0.004], [cr[0] * (1 - 0.32 * P.cran_egg), cr[1] * 0.7, cr[2] * (1 - 0.2 * P.cran_egg)], skin, { k: k * 2 });
  if (P.cran_egg < 0) ell([cc[0], cc[1] + cr[1] * 0.2, cc[2]], [cr[0] * (1 - 0.25 * P.cran_egg), cr[1] * 0.62, cr[2] * 0.96], skin, { k: k * 2 });   // a wide flat top
  // the face mass, boxed for a square face
  ell(P.face_c, P.face, skin);
  if (P.face_box > 0) box([P.face_c[0], P.face_c[1] - 0.006, P.face_c[2] - 0.006], [P.face[0] * 0.9, P.face[1] * 0.85, P.face[2] * 0.82], Math.min(...P.face) * (1 - 0.6 * P.face_box), skin, { k: k * 1.5 });
  // the jaw: two cones from the angles to the chin, the angles squared, the chin of its own width
  for (const x of [-1, 1]) {
    cone([x * jw, jy, -0.012], [x * 0.012 * P.chin_w, -jl, cz - 0.004 + P.toothless * 0.01], P.jaw_r, P.chin_r * 0.8, skin);
    if (P.jaw_square > 0) box([x * jw * 0.9, jy - 0.016 - 0.008 * P.jaw_square, -0.014], [P.jaw_r * (0.55 + 0.2 * P.jaw_square), P.jaw_r * (0.7 + 0.4 * P.jaw_square), P.jaw_r * (0.9 + 0.3 * P.jaw_square)], P.jaw_r * 0.45, skin, { k: k * 1.6 });   // the corner of the jaw, squared
  }
  ell([0, -jl + P.toothless * 0.012, cz + P.toothless * 0.012], [P.chin_r * P.chin_w, P.chin_r, P.chin_r], skin);
  if (P.dbl_chin > 0) ell([0, -jl - 0.004, cz - 0.03], [P.chin_r * 1.6 + P.dbl_chin, P.dbl_chin * 1.1, P.dbl_chin * 1.5 + 0.01], skin, { k: k * 1.6 });
  // the brow ridge, and the brows as hair on it
  const [bw, by0, bz, brr] = P.brow;
  push({ t: "cap", a: S([-bw, by0, bz]), b: S([bw, by0, bz]), r: brr * s, mat: skin, k });
  // the nose: bridge to hump to tip (two segments when a hump is given), the hook, the wings
  const tipR = P.nose_r[1];
  if (nh) { cone([0, nb[0], nb[1]], [0, nh[0], nh[1]], P.nose_r[0], (P.nose_r[0] + tipR) * 0.55, skin); cone([0, nh[0], nh[1]], [0, nt[0], nt[1]], (P.nose_r[0] + tipR) * 0.55, tipR, skin); }
  else cone([0, nb[0], nb[1]], [0, nt[0], nt[1]], P.nose_r[0], tipR, skin);
  if (P.hook) { const mid = nh || [nb[0] * 0.45 + nt[0] * 0.55, nb[1] * 0.45 + nt[1] * 0.55]; sph([0, mid[0], mid[1] + P.hook * 0.6], P.nose_r[0] * 1.15, skin); }
  // the muzzle under the nose (a forward mouth), the lips
  if (P.muzzle > 0) ell([0, my + 0.008, mz - 0.012], [mw * 1.25, 0.018, 0.02 + P.muzzle], skin, { k: k * 1.5 });
  // lips: flat ellipses lying on the face, not balls standing off it (2026-10-21 review: "mouths as blobs")
  ell([0, my + 0.0055, mz - 0.003], [mw, P.lip_t * lipF * 0.9, 0.009], "lip", { k: k * 0.6 });
  ell([0, my - 0.0065 - open * 0.4, mz - 0.004], [mw * 0.86, P.lip_t * 1.1 * lipF, 0.009], "lip", { k: k * 0.6 });
  // the neck: from under the skull down to the collar; an Adam's apple
  const neckTop = [0, -0.07, -0.03], neckLen = neckTo != null ? neckTo / s : P.neck_len;
  cone(neckTop, [0, -0.07 - neckLen, -0.035], P.neck_r, P.neck_r * 1.12, skin);
  if (P.adam > 0) ell([0, -0.1, -0.03 + P.neck_r * 0.95], [P.adam * 0.9, P.adam * 1.4, P.adam], skin, { k: k * 0.5 });
  const ck = P.cheek;
  for (const x of [-1, 1]) {
    ell([x * ck[0], ck[1], ck[2]], [ck[3] * 1.15, ck[3] * 0.85, ck[3]], skin, { k: k * 1.3 });   // blended a little wider: a plane, not a ball
    sph([x * P.nose_wing, nt[0] + 0.005, nt[1] - 0.013], P.wing_r, skin);
    if (P.ear[0] > 0) ell([x * (P.cran[0] - 0.004 + P.ear[1]), -0.008, -0.012], [0.011, P.ear[0] * 1.35, P.ear[0] * 0.9], skin, { rot: [0, x * P.ear_out, 0] });
    if (P.jowl > 0) sph([x * jw * 0.9, -0.092, 0.028], P.jowl, skin, { k: k * 2 });
    if (P.eye_bag > 0) ell([x * ex, ey - er * 1.25, ez - er * 0.25], [er * 1.1, P.eye_bag * 1.3 + 0.002, er * 0.7], skin, { k: k * 0.4 });
  }
  const gl = Math.hypot(...P.gaze), gaze = P.gaze.map((v) => v / gl), eyes = [-1, 1].map((x) => [x * ex, ey, ez - er * 0.15]);   // forward enough that the white and the iris show
  const lidUp = P.lid_up + D.lid;
  eyes.forEach((ec, i) => {
    const x = i ? 1 : -1;
    push({ t: "lid", c: S(ec), R: (er + P.lid_t * 1.2) * s, th: P.lid_t * s, h: er * lidUp * s, tilt: P.lid_tilt, sx: x, up: true, mat: skin, k: 0.002 * s });
    push({ t: "lid", c: S(ec), R: (er + P.lid_t) * s, th: P.lid_t * 0.8 * s, h: er * P.lid_lo * s, tilt: 0, sx: x, up: false, mat: skin, k: 0.002 * s });
  });
  // carves: the sockets, the hollows under the cheekbones, the nasolabial folds, the mouth, the nostrils
  // the sockets: a shallow carve round the front of the eye, so the socket shades and is not a black pit
  // and the opening: everything in front of the eyeball between the lid lines is cleared, so a cheek
  // or a brow blended over the eye cannot bury it (the eyeballs are added after, whole)
  const opn = Math.max(0.3, (lidUp - P.lid_lo) / 2), mid = (lidUp + P.lid_lo) / 2;
  for (const ec of eyes) {
    push({ t: "ell", c: S([ec[0], ec[1] + er * 0.05, ec[2] + er * 0.35]), r: S([er * 1.3, er * 0.95, er * 0.75]), op: "sub", k: 0.006 * s });
    push({ t: "ell", c: S([ec[0], ec[1] + er * mid, ec[2] + er * 1.05]), r: S([er * 1.15, er * opn, er * 1.1]), op: "sub", k: 0.003 * s, exact: true });
  }
  if (P.hollow > 0) for (const x of [-1, 1]) push({ t: "ell", c: S([x * (ck[0] + 0.004), ck[1] - 0.032, ck[2] - 0.004 + 0.02]), r: S([0.016, 0.02, 0.012 + P.hollow]), op: "sub", k: 0.012 * s, exact: true });
  if (P.nasolabial > 0) for (const x of [-1, 1]) push({ t: "cap", a: S([x * (P.nose_wing + P.wing_r * 0.9), nt[0] + 0.002, nt[1] - 0.018]), b: S([x * (mw + 0.006), my - 0.006, mz - 0.006]), r: P.nasolabial * s, op: "sub", k: 0.004 * s });
  push({ t: "slit", c: S([0, my - open * 0.2, mz + 0.01]), w: mw * s, smile: (P.smile + D.corners) * s, op: "sub", k: 0.005 * s, open: open * s });
  const nr = Math.min(0.0042, P.wing_r * 0.45);   // nostrils sized to the nose, so a small nose is not carved away
  for (const x of [-1, 1]) sph([x * P.nose_wing * 0.55, nt[0] - 0.006, nt[1] - 0.006], nr, null, { op: "sub", k: 0.004 * s });
  // the brows (hair on the ridge): inner, middle and outer points, lifted, tilted, pinched by expression
  if (P.brow_hair > 0) for (const x of [-1, 1]) {
    const t = P.brow_hair * 0.0032, lift = P.brow_lift + D.brow, y0 = by0 + 0.004 + lift, tilt = P.brow_tilt * 0.012;
    const pts = [[x * 0.012, y0 + D.browIn - tilt * 0.5, bz + brr * 0.95 + t * 0.4], [x * bw * 0.6, y0 + 0.003 + tilt * 0.2, bz + brr * 0.8 + t * 0.4], [x * bw * 1.02, y0 - 0.002 + tilt, bz + brr * 0.2 - 0.008]];
    cone(pts[0], pts[1], t * 1.1, t, "brow", { k: 0.002 * s, bias: 0.002 }); cone(pts[1], pts[2], t, t * 0.6, "brow", { k: 0.002 * s, bias: 0.002 });
  }
  // eyeballs, irises, pupils (hard unions: their own materials)
  for (const ec of eyes) {
    sph(ec, er, "white", { k: 0, op: "hard", exact: false });
    push({ t: "scap", c: S(ec), R: (er + 0.0004) * s, n: gaze, h: er * Math.cos(P.iris) * s, mat: "eye", k: 0, op: "hard", bias: 0.002 });
    push({ t: "scap", c: S(ec), R: (er + 0.0007) * s, n: gaze, h: er * Math.cos(P.iris * 0.45) * s, mat: "hat", k: 0, op: "hard", bias: 0.003 });
    // a catch-light where the portrait's key light (from the viewer's left, above) meets the cornea
    const kd = [-0.42, 0.42, 0.8], kl = Math.hypot(...kd), cl = kd.map((v, i) => ec[i] + (v / kl) * er * 0.97);
    sph(cl, er * 0.17, "band", { k: 0, op: "hard", exact: false, bias: 0.004 });
  }
  const crown = (cc[1] + cr[1] + (P.cran_egg > 0 ? cr[1] * 0.12 * P.cran_egg : 0)) * s;
  return { shapes: sh, origin: S(neckTop), crown, chin: (-jl - P.chin_r) * s, P };
}
