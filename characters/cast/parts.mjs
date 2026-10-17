// Shared costume parts for the people of Gullet, built on the skeleton in the bind pose.
// Each builder takes the mesh M, the bind frames B (B[INDEX[j]].p is the joint's bind position),
// the proportions P and an options record, and adds skinned tubes. Materials are names in MATS.
import { tube, blob, limb, smooth, INDEX, add, sub, scl, norm } from "../rig/body.mjs";
import { MATS } from "../rig/materials.mjs";
import { sdfPart } from "../rig/sdfmesh.mjs";

export const mid = (M) => MATS[M].id;
const J = (B, j) => B[INDEX[j]].p;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Torso from the hips to the base of the neck. o: { w (half width at chest), d (half depth),
// belly (extra depth at the waist, front), mat, front (mat of a front panel: shirt, vest), frontW (radians) }
export function torso(M, B, P, o) {
  const p0 = J(B, "pelvis"), c = J(B, "chest"), n = J(B, "neck"), rings = [], N = 9;
  const yb = p0[1] - 0.1, yt = n[1] + 0.02;
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = yb + (yt - yb) * t;
    const wp = 1 - smooth(0.1, 0.45, t), wc = smooth(0.4, 0.75, t), ws = Math.max(0, 1 - wp - wc);
    const hips = P.hip + 0.07, sh = o.w, w = t < 0.35 ? hips + (o.waist - hips) * smooth(0, 0.35, t) : t < 0.8 ? o.waist + (sh - o.waist) * smooth(0.35, 0.8, t) : sh * (1 - 0.45 * smooth(0.82, 1, t));
    const d = o.d * (t > 0.85 ? 1 - 0.4 * smooth(0.85, 1, t) : 1);
    rings.push({ c: [0, y, (o.belly || 0) * Math.sin(Math.PI * Math.min(1, t * 1.4)) * 0.5 + 0.0], rx: w, rz: d + (o.belly || 0) * Math.sin(Math.PI * Math.min(1, t * 1.3)) * 0.5, w: { pelvis: wp, spine: ws, chest: wc } });
  }
  const fw = o.frontW || 0.45;
  tube(M, rings, { seg: 24, capA: true, capB: true, mat: mid(o.mat), matfn: o.front ? (th, r, t) => (Math.abs(th - Math.PI / 2) < fw * (0.4 + t) && t > (o.frontFrom ?? 0.45) ? mid(o.front) : mid(o.mat)) : null,
    rmod: (th, i, t) => 1 + (o.chest || 0) * Math.max(0, Math.sin(th)) * smooth(0.5, 0.8, t) * (1 - smooth(0.85, 1, t)) });
}

// Coat skirt in two panels (left and right) so the front opens when the legs stride.
// o: { top (m above ground), hem (m above ground), flare, mat, inner }
export function skirt(M, B, P, o) {
  const hipY = J(B, "pelvis")[1], top = o.top ?? hipY + 0.05, hem = o.hem, N = 7, gap = o.gap ?? 0.04;
  const panel = (side) => {
    const rings = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = top + (hem - top) * t, r = (P.hip + 0.1 + (o.waistAdd || 0)) * (1 + (o.flare ?? 0.5) * Math.pow(t, 1.3));
      rings.push({ c: [0, y, (o.fwd || 0) * t], rx: r * (o.wide || 1), rz: r * 0.82 * (o.deep || 1), t });
    }
    const arc = side > 0 ? [-Math.PI / 2 - 0.05, Math.PI / 2 - gap] : [Math.PI / 2 + gap, 1.5 * Math.PI + 0.05];
    tube(M, rings, { seg: 14, arc, mat: mid(o.mat),
      wfn: (th, r) => {
        // the hem follows the thighs a little and the panel's spring joint more, so a stride opens
        // the coat and the springs swing it (runtime/actor.mjs, secondary motion)
        const f = smooth(0, 1, (top - r.c[1]) / Math.max(0.01, top - hem)) * 0.95, s = Math.cos(th);
        const l = Math.min(1, Math.max(0, 0.5 + 0.9 * s)), w = { pelvis: 1 - f };
        w.thighL = f * 0.45 * l; w.thighR = f * 0.45 * (1 - l); w.skirtL = f * 0.55 * l; w.skirtR = f * 0.55 * (1 - l); return w;
      } });
  };
  panel(1); panel(-1);
}

// Leg: trouser tube hip to ankle, a boot. o: { r (thigh radius), mat, boot, bootTop (fraction of shin) }
export function legs(M, B, P, o) {
  for (const s of ["L", "R"]) {
    limb(M, B, "thigh" + s, "shin" + s, o.r, o.r * 0.78, mid(o.mat), { rings: 6, parentBlend: "pelvis", seg: 12 });
    limb(M, B, "shin" + s, "foot" + s, o.r * 0.78, o.r * 0.6, mid(o.mat), { rings: 6, seg: 12, over: 0.05 });
    const a = J(B, "foot" + s), k = J(B, "shin" + s), bt = o.bootTop ?? 0.35;
    // boot shaft
    const top = lerp3(a, k, bt), br = o.r * 0.68 * (o.bootWide || 1);
    tube(M, [{ c: top, rx: br * 1.05, rz: br * 1.05, w: { ["shin" + s]: 1 } }, { c: lerp3(a, top, 0.4), rx: br, rz: br, w: { ["shin" + s]: 0.85, ["foot" + s]: 0.15 } }, { c: [a[0], a[1] - 0.02, a[2]], rx: br, rz: br * 1.05, w: { ["foot" + s]: 1 } }], { mat: mid(o.boot), seg: 12 });
    // foot, pointing forward, the sole on the ground
    const g = 0.035, len = o.foot || 0.26;
    tube(M, [{ c: [a[0], g + 0.03, a[2] - 0.05], rx: br * 0.95, rz: 0.055, w: { ["foot" + s]: 1 } }, { c: [a[0], g + 0.02, a[2] + len * 0.45], rx: br * 1.0, rz: 0.05, w: { ["foot" + s]: 1 } }, { c: [a[0], g + 0.005, a[2] + len * 0.85], rx: br * 0.75, rz: 0.03, w: { ["foot" + s]: 1 } }], { mat: mid(o.boot), seg: 10 });
  }
}

// Arm: sleeve to the wrist (or the elbow, rolled), cuff, a hand.
// o: { r, mat, cuff, rolled (forearm mat), bell (flare at the wrist, surplice sleeves), hand ('fist'|'open') }
export function arms(M, B, P, o) {
  for (const s of ["L", "R"]) {
    const sh = J(B, "arm" + s);
    // the shoulder: the sleeve runs up into the torso and rounds over the joint, weighted half to the collarbone
    const x = s === "L" ? 1 : -1, cl = J(B, "clav" + s);
    tube(M, [{ c: add(cl, [x * 0.02, -0.03, 0]), rx: o.r * 0.7, rz: o.r * 0.9, w: { chest: 0.7, ["clav" + s]: 0.3 } }, { c: add(sh, [-x * 0.03, 0.0, 0]), rx: o.r * 1.0, rz: o.r * 1.05, w: { ["clav" + s]: 0.6, ["arm" + s]: 0.4 } }, { c: add(sh, [x * 0.01, -0.06, 0]), rx: o.r * 1.02, rz: o.r * 1.04, w: { ["clav" + s]: 0.3, ["arm" + s]: 0.7 } }, { c: add(sh, [0, -0.13, 0]), rx: o.r, rz: o.r, w: { ["arm" + s]: 1 } }], { mat: mid(o.mat), seg: 12, rmod: (th) => 1 - 0.12 * Math.max(0, -Math.cos(th) * x) });
    limb(M, B, "arm" + s, "fore" + s, o.r, o.r * 0.85, mid(o.mat), { rings: 6, seg: 12, over: 0.02 });
    const foreMat = o.rolled ? mid(o.rolled) : mid(o.mat);
    limb(M, B, "fore" + s, "hand" + s, o.r * (o.rolled ? 0.86 : 0.82), o.r * (o.rolled ? 0.62 : 0.72), foreMat, { rings: 6, seg: 12, over: 0.04 });
    if (o.rolled) { const e = J(B, "fore" + s); tube(M, [{ c: add(e, [0, 0.05, 0]), rx: o.r * 0.98, rz: o.r * 0.98, w: { ["arm" + s]: 1 } }, { c: add(e, [0, -0.04, 0]), rx: o.r * 0.95, rz: o.r * 0.95, w: { ["fore" + s]: 0.6, ["arm" + s]: 0.4 } }], { mat: mid(o.mat), seg: 12 }); }
    if (o.bell) { const w = J(B, "hand" + s); tube(M, [{ c: add(w, [0, 0.16, 0]), rx: o.r * 0.9, rz: o.r * 0.9, w: { ["fore" + s]: 1 } }, { c: add(w, [0, 0.02, 0]), rx: o.r * o.bell, rz: o.r * o.bell, w: { ["fore" + s]: 0.8, ["hand" + s]: 0.2 } }], { mat: mid(o.bellMat || o.mat), seg: 14, capA: false, capB: false }); }
    if (o.cuff) { const w = J(B, "hand" + s); tube(M, [{ c: add(w, [0, 0.05, 0]), rx: o.r * 0.78, rz: o.r * 0.78, w: { ["fore" + s]: 1 } }, { c: add(w, [0, 0.0, 0]), rx: o.r * 0.76, rz: o.r * 0.76, w: { ["fore" + s]: 1 } }], { mat: mid(o.cuff), seg: 12 }); }
    // both hand shapes, as parts; the pose picks one (pose.hands), a held prop forces the fist
    M.begin(`hand${s}.fist`); hand(M, B, s, o.handR || 0.05, o.skin || "skin", "fist");
    M.begin(`hand${s}.open`); hand(M, B, s, o.handR || 0.05, o.skin || "skin", "open"); M.end();
  }
}

// A hand at the wrist, palm toward the body, knuckles forward (+Z) when the arm hangs.
function hand(M, B, s, r, mat, kind) {
  const w = J(B, "hand" + s), W = { ["hand" + s]: 1 }, x = s === "L" ? 1 : -1;
  if (kind === "fist") {
    blob(M, add(w, [0, -0.06, 0.01]), [r * 0.8, r * 1.15, r * 1.2], W, mid(mat), { rings: 8, seg: 12 });
    blob(M, add(w, [-x * 0.012, -0.075, 0.045]), [r * 0.45, r * 0.5, r * 0.5], W, mid(mat), { rings: 6, seg: 10 });
  } else {
    blob(M, add(w, [0, -0.06, 0.0]), [r * 0.55, r * 1.3, r * 1.1], W, mid(mat), { rings: 8, seg: 12 });
    for (let f = 0; f < 4; f++) tube(M, [{ c: add(w, [0, -0.11, -0.025 + f * 0.018]), rx: 0.009, rz: 0.009, w: W }, { c: add(w, [0, -0.17 + Math.abs(f - 1.5) * 0.008, -0.03 + f * 0.02]), rx: 0.008, rz: 0.008, w: W }], { mat: mid(mat), seg: 6 });
    tube(M, [{ c: add(w, [-x * 0.01, -0.05, 0.04]), rx: 0.011, rz: 0.011, w: W }, { c: add(w, [-x * 0.014, -0.1, 0.07]), rx: 0.009, rz: 0.009, w: W }], { mat: mid(mat), seg: 6 });
  }
}

// Neck and head, sculpted: signed-distance features smooth-unioned into one surface (rig/sdfmesh.mjs).
// o: { r (head radius), jaw, chin, nose: [len, r, droop, hook], hair ('cap'|'crop'|'none'), skin, brow (mat),
//      browW (ridge), jowls, lids (0 open .. 1 heavy), mouth (width), stubble, ears }
// Expressions for baked portraits: setExpression(name) before a build changes every head built after
// it (brows up or down and pinched, lids, the mouth open or pressed), then setExpression(null).
export const EXPRESSIONS = {
  neutral: {},
  wary: { browY: -0.05, browIn: -0.05, lidsAdd: 0.35, mouthW: 0.9 },
  startled: { browY: 0.09, browIn: 0.03, lidsAdd: -0.4, open: 0.08, mouthW: 0.85 },
  set: { browY: -0.03, browIn: -0.08, lidsAdd: 0.15, mouthW: 1.1, press: true },
};
let EXPR = null;
export const setExpression = (name) => { EXPR = name ? EXPRESSIONS[name] : null; };
export function head(M, B, P, o) {
  const X = EXPR || {};
  const h = J(B, "head"), R = o.r, W = { head: 1 }, sk = mid(o.skin || "skin");
  limb(M, B, "neck", "head", o.neck || 0.055, (o.neck || 0.055) * 0.92, sk, { rings: 4, seg: 12, over: 0.15 });
  const c = add(h, [0, R * 0.9, R * 0.05]), at = (v) => add(c, v.map((x) => x * R)), E = (cc, r, mat = sk, k = 0.03, op, bias) => ({ t: "ell", c: at(cc), r: r.map((x) => x * R), mat, k: k * R / 0.15, op, bias });
  const Cp = (a, b, r0, r1, mat = sk, k = 0.015, op) => ({ t: "cap", a: at(a), b: at(b), r0: r0 * R, r1: r1 * R, mat, k, op });
  const warmM = mid("cheek"), coolM = mid("jawcool"), j = o.jaw || 1, lid = Math.max(0, Math.min(1, (o.lids ?? 0.4) + (X.lidsAdd || 0))), mw = (o.mouth || 1) * (X.mouthW || 1), by = X.browY || 0, bi = X.browIn || 0, op = X.open || 0, [nl, nr, nd, hk = 0] = o.nose || [0.07, 0.022, 0.3];
  const NL = nl / R, NR = nr / R, prims = [
    E([0, 0.02, -0.03], [0.86, 1, 0.95], sk, 0),
    E([0, -0.48, 0.2], [0.64 * j, 0.5, 0.66], coolM, 0.05),
    E([0, -0.8, 0.48], [0.28 * (o.chin || 1), 0.2, 0.24], coolM, 0.04),
    E([0, 0.33, 0.6], [0.64 * (o.browW || 1), 0.15, 0.3], sk, 0.03),
    ...[-1, 1].flatMap((x) => [
      E([x * 0.42, -0.08, 0.55], [0.25, 0.18, 0.25], warmM, 0.05, null, 0.02),
      E([x * 0.33, 0.13, 0.8], [0.19, 0.14, 0.16], sk, 0.02, "sub"),
      E([x * 0.33, 0.12, 0.66], [0.14, 0.14, 0.14], mid("white"), 0, "hard"),
      E([x * 0.32, 0.12, 0.79], [0.07, 0.075, 0.025], mid("eye"), 0, "hard", 0.004),
      E([x * 0.33, 0.19 + 0.02 * lid, 0.71], [0.18, 0.06 + 0.07 * lid, 0.15], sk, 0.01),
      E([x * 0.36, 0.33 + by, 0.82], [0.21, 0.045, 0.06], mid(o.brow || "brow"), 0.006, null, 0.01),
      E([x * 0.2, 0.33 + by + bi, 0.85], [0.1, 0.045, 0.05], mid(o.brow || "brow"), 0.006, null, 0.01),   // the inner brow (pinched down or lifted)
      E([x * 0.9, 0.0, 0.05], [0.1, 0.27, 0.17], warmM, 0.02),
      ...(o.jowls ? [E([x * 0.46, -0.6, 0.36], [0.3 * o.jowls, 0.32 * o.jowls, 0.3], sk, 0.06)] : []),
    ]),
    Cp([0, 0.22, 0.78], [0, 0.02 + hk * 0.3 * NL, 0.86 + NL * 0.45], NR * 0.7, NR * 0.85),
    Cp([0, 0.02 + hk * 0.3 * NL, 0.86 + NL * 0.45], [0, -0.12 - nd * NL, 0.9 + NL * 0.8], NR * 0.85, NR * 1.15, warmM),
    ...[-1, 1].map((x) => E([x * NR * 1.0, -0.16 - nd * NL - NR * 0.4, 0.86 + NL * 0.7], [NR * 0.7, NR * 0.55, NR * 0.75], sk, 0.02)),
    E([0, -0.47, 0.83], [0.25 * mw, 0.06, 0.08], mid("lip"), 0.01, null, 0.003),
    E([0, -0.57 - op, 0.81], [0.21 * mw, X.press ? 0.05 : 0.07, 0.08], mid("lip"), 0.01, null, 0.003),
    Cp([-0.22 * mw, -0.52 - op / 2, 0.9], [0.22 * mw, -0.52 - op / 2, 0.9], 0.018 + op * 0.5, 0.018 + op * 0.5, sk, 0.004, "sub"),
  ];
  sdfPart(M, prims, { weights: W, cell: R * (o.cell || 0.1) });
  if (o.hair === "cap" || o.hair === "crop") blob(M, add(c, [0, R * 0.16, -R * 0.12]), [R * 0.91, R * 0.9, R * 0.9], W, mid(o.hairMat || "hair"), { rings: 10, seg: 18, rmod: (th) => (Math.sin(th) > 0.55 ? 0.9 : 1) });
  if (o.stubble) blob(M, add(c, [0, -R * 0.62, R * 0.36]), [R * 0.66 * j, R * 0.4, R * 0.62], W, mid("hair"), { rings: 8, seg: 16 });
  return c;
}

// Hats on the head. kind: 'brim' (wide, tall crown), 'band' (a cloth band), 'peak'
export function hat(M, c, R, kind, o = {}) {
  const W = { head: 1 }, t = -(o.tilt || 0) * Math.PI / 180, ct = Math.cos(t), st = Math.sin(t);
  const T = (v) => { const d = [v[0] - c[0], v[1] - c[1], v[2] - c[2]]; return [c[0] + d[0], c[1] + d[1] * ct - d[2] * st, c[2] + d[1] * st + d[2] * ct]; };
  const axis = [0, ct, st];
  if (kind === "brim") {
    const y0 = c[1] + R * 0.55, cr = R * 0.92, mat = mid(o.mat || "hat");
    blob(M, T([c[0], y0 - 0.005, c[2] - 0.01]), [R * (o.brim || 2.0), 0.013, R * (o.brim || 2.0) * 0.95], W, mat, { rings: 6, seg: 28, axis, rmod: (th) => 1 + 0.06 * Math.sin(th) });
    tube(M, [[y0, 1, 0.9], [y0 + R * 0.25, 0.98, 0.88], [y0 + R * 0.32, 0.97, 0.87], [y0 + R * (o.crown || 0.95), 0.86, 0.78]].map(([y, a, b]) => ({ c: T([c[0], y, c[2] - 0.01]), rx: cr * a, rz: cr * b, w: W })),
      { mat, seg: 22, square: 2.4, matfn: (th, r, tt) => (tt > 0.2 && tt < 0.4 ? mid("strap") : mat) });
  }
  if (kind === "band") tube(M, [{ c: [c[0], c[1] + R * (o.y0 ?? 0.28), c[2] + 0.01], rx: R * 0.98, rz: R * 1.0, w: W }, { c: [c[0], c[1] + R * (o.y1 ?? 0.5), c[2] + 0.0], rx: R * 0.96, rz: R * 0.97, w: W }], { mat: mid(o.mat || "band"), seg: 20 });
}

// A prop: a chain of rings in the frame of one joint. rings: [[x, y, z, r], ...] relative to the joint.
export function prop(M, B, joint, rings, mat, opt = {}) {
  const p = J(B, joint), W = { [joint]: 1 };
  tube(M, rings.map(([x, y, z, r, rz]) => ({ c: add(p, [x, y, z]), rx: r, rz: rz ?? r, w: W, mat: opt.mats ? undefined : undefined })), { mat: mid(mat), seg: opt.seg || 10, square: opt.square, matfn: opt.matfn, capA: opt.capA, capB: opt.capB });
}
export function propBlob(M, B, joint, at, r, mat, opt = {}) { blob(M, add(J(B, joint), at), r, { [joint]: 1 }, mid(mat), opt); }

// A strap or band laid over the body: a path of points with weights.
export function strap(M, pts, r, mat) { tube(M, pts.map(([c, w]) => ({ c, rx: r, rz: r * 0.35, w })), { mat: mid(mat), seg: 6 }); }
export { J, lerp3, add, sub, scl, norm };
