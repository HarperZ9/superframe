// Shared costume parts for the people of Gullet, built on the skeleton in the bind pose.
// Each builder takes the mesh M, the bind frames B (B[INDEX[j]].p is the joint's bind position),
// the proportions P and an options record, and adds skinned tubes. Materials are names in MATS.
import { tube, blob, limb, smooth, INDEX, add, sub, scl, norm } from "../rig/body.mjs";
import { MATS } from "../rig/materials.mjs";
import { sdfPart } from "../rig/sdfmesh.mjs";
import { sculptHead, hasHead } from "../forge/heads.mjs";

export const mid = (M) => MATS[M].id;
const J = (B, j) => B[INDEX[j]].p;
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// Torso from the hips to the base of the neck. o: { w (half width at chest), d (half depth),
// belly (extra depth at the waist, front), mat, front (mat of a front panel: shirt, vest), frontW (radians) }
// The torso's half width and half depth at height y (bind), the same numbers torso() builds from: for cloth that
// has to sit on it (an apron's band)
export function torsoAt(B, P, o, y) {
  const p0 = J(B, "pelvis"), n = J(B, "neck"), yb = p0[1] - 0.1, yt = n[1] + 0.02, t = Math.max(0, Math.min(1, (y - yb) / (yt - yb)));
  const hips = P.hip + 0.07, sh = o.w, w = t < 0.35 ? hips + (o.waist - hips) * smooth(0, 0.35, t) : t < 0.8 ? o.waist + (sh - o.waist) * smooth(0.35, 0.8, t) : sh * (1 - 0.45 * smooth(0.82, 1, t));
  return { rx: w, rz: o.d * (t > 0.85 ? 1 - 0.4 * smooth(0.85, 1, t) : 1) + (o.belly || 0) * Math.sin(Math.PI * Math.min(1, t * 1.3)) * 0.5 };
}
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
  tube(M, rings, { seg: 24, capA: true, capB: true, mat: mid(o.mat), square: o.square || 2, matfn: o.front ? (th, r, t) => (Math.abs(th - Math.PI / 2) < fw * (0.4 + t) && t > (o.frontFrom ?? 0.45) ? mid(o.front) : mid(o.mat)) : null,
    rmod: (th, i, t) => 1 + (o.chest || 0) * Math.max(0, Math.sin(th)) * smooth(0.5, 0.8, t) * (1 - smooth(0.85, 1, t)) });
}

// Coat skirt in two panels (left and right) so the front opens when the legs stride.
// o: { top (m above ground), hem (m above ground), flare, mat, inner }
export function skirt(M, B, P, o) {
  const prevPart = M.cur; M.begin(o.part || "skirt"); try { skirtBody(M, B, P, o); } finally { M.cur = prevPart; }
}
// o.fit (2026-10-22, the fidelity pass): the cloth in front of and behind a thigh follows that thigh, sooner
// and more, so a striding thigh carries the coat or dress with it instead of pushing through it; the springs
// keep a little of the hem. Shared with the apron, which lies on a dress and must move as it moves.
// fit: the top of a coat or dress comes in to the body's hips and eases out, so the waist has no shelf
const fitTop = (t) => 0.86 + 0.14 * smooth(0, 0.3, t);
function fitW(th, y, top, hem) {
  const d = (top - y) / Math.max(0.01, top - hem), g = smooth(0, 0.4, d), fr = Math.abs(Math.sin(th)), k = g * (0.6 + 0.35 * fr);
  // the thighs carry the cloth near the hips; toward the hem the springs take more of it, so the hem has weight
  // and swings after the leg rather than moving with it like a board
  const th2 = 0.92 - 0.2 * smooth(0.45, 1, d), l = Math.min(1, Math.max(0, 0.5 + 0.9 * Math.cos(th))), w = { pelvis: 1 - k };
  w.thighL = k * th2 * l; w.thighR = k * th2 * (1 - l); w.skirtL = k * (1 - th2) * l; w.skirtR = k * (1 - th2) * (1 - l); return w;
}
function skirtBody(M, B, P, o) {
  const hipY = J(B, "pelvis")[1], top = o.top ?? hipY + 0.05, hem = o.hem, N = 7, gap = o.gap ?? 0.04;
  const panel = (side) => {
    const rings = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, y = top + (hem - top) * t, r = (P.hip + 0.1 + (o.waistAdd || 0)) * (1 + (o.flare ?? 0.5) * Math.pow(t, 1.3)) * (o.fit ? fitTop(t) : 1);
      rings.push({ c: [0, y, (o.fwd || 0) * t], rx: r * (o.wide || 1), rz: r * (o.fit ? 0.92 + 0.08 * t : 0.82) * (o.deep || 1), t });   // fit: room for a striding shin toward the hem
    }
    const arc = side > 0 ? [-Math.PI / 2 - 0.05, Math.PI / 2 - gap] : [Math.PI / 2 + gap, 1.5 * Math.PI + 0.05];
    // o.folds (The Quota, 2026-10-21): vertical folds growing toward the hem, so the cloth carries planes;
    // left out (the default) the skirt is the old smooth one
    tube(M, rings, { seg: o.folds ? 24 : 14, arc, mat: mid(o.mat), ...(o.folds ? { rmod: (th, i, t) => 1 + o.folds * (0.25 + 0.75 * t) * Math.abs(Math.sin(th * 4.5)) - o.folds * 0.5 * (0.25 + 0.75 * t) } : {}),
      wfn: (th, r) => {
        // the hem follows the thighs a little and the panel's spring joint more, so a stride opens
        // the coat and the springs swing it (runtime/actor.mjs, secondary motion)
        const f = smooth(0, 1, (top - r.c[1]) / Math.max(0.01, top - hem)) * 0.95, s = Math.cos(th);
        const l = Math.min(1, Math.max(0, 0.5 + 0.9 * s)), w = { pelvis: 1 - f };
        if (o.fit) return fitW(th, r.c[1], top, hem);
        w.thighL = f * 0.45 * l; w.thighR = f * 0.45 * (1 - l); w.skirtL = f * 0.55 * l; w.skirtR = f * 0.55 * (1 - l); return w;
      } });
  };
  panel(1); panel(-1);
}

// Apron (2026-10-22, the fidelity pass): cloth that lies on the dress under it (o.under: the dress's skirt
// options), from the waistband to o.hem, across the front (o.wrap of the circle), weighted like that dress so
// it moves with the legs; soft vertical folds that deepen toward the hem, the hem dipping at each fold; a
// waistband; two ties from the back of the band hanging down behind. o: { hem, mat, under, wrap, lie }
export function apron(M, B, P, o) {
  const u = o.under || {}, hipY = J(B, "pelvis")[1], top = u.top ?? hipY + 0.05, dressHem = u.hem ?? 0.06, N = 9, lie = o.lie ?? 0.014;
  const band = hipY + 0.2, hem = o.hem, wrap = o.wrap ?? 0.33, prev = M.cur;   // under: the dress's own options, fit as the Quota's dresses are M.begin("apron");
  const dressR = (y) => { const t = Math.max(0, Math.min(1, (y - top) / (dressHem - top))); return (P.hip + 0.1 + (u.waistAdd || 0)) * (1 + (u.flare ?? 0.15) * Math.pow(t, 1.3)) * fitTop(t); }, TOPK = 1;
  const rings = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, y = band + (hem - band) * t, waist = y > top;
    if (waist) { const tb = o.torso ? torsoAt(B, P, o.torso, y) : { rx: P.hip + 0.07, rz: 0.13 }; const e = smooth(band, top, y), dr = dressR(top) * TOPK; rings.push({ c: [0, y, 0], rx: tb.rx + (dr * 1.045 - tb.rx) * e + lie, rz: tb.rz + (dr * 0.92 * 1.045 - tb.rz) * e + lie, t }); continue; }   // from the body at the band out to the dress at its top
    const r = dressR(y); rings.push({ c: [0, y, 0], rx: r * (u.wide || 1) * 1.045 + lie, rz: r * (0.92 + 0.08 * Math.max(0, Math.min(1, (y - top) / (dressHem - top)))) * (u.deep || 1) * 1.045 + lie + 0.012 * t, t });   // over the dress's folds (up to 4.5 % out)
  }
  // a grid of its own (not a tube with one arc): the cloth is gathered at the band (a narrower wrap) and opens
  // toward the hem; vertical folds deepen downward and the hem dips under each fold's crest
  const NK = 26, folds = 3.5, ids = [], mat = mid(o.mat || "apron");
  for (let i = 0; i <= N; i++) {
    const r = rings[i], t = r.t, wr = wrap * (0.72 + 0.28 * Math.min(1, t * 1.6)), row = [];
    for (let k = 0; k <= NK; k++) {
      const u2 = k / NK, th = Math.PI / 2 + (u2 - 0.5) * 2 * wr, ph = u2 * folds * 2 * Math.PI + 0.9 * Math.sin(u2 * 7.3 + 1.1);   // folds of uneven width
      const amp = 0.005 + 0.03 * t, dr = amp * (0.5 + 0.5 * Math.cos(ph)), dy = i === N ? -0.02 * (0.5 + 0.5 * Math.cos(ph)) : 0;
      const ct = Math.cos(th), st = Math.sin(th), p = [ct * (r.rx + dr), r.c[1] + dy, st * (r.rz + dr)];
      // the normal: the ellipse's, turned by the fold's slope across the cloth
      const sl = -amp * 0.5 * Math.sin(ph) * folds * 2 * Math.PI / (2 * wr * (r.rx + r.rz) / 2 + 1e-6), n0 = [ct / Math.max(1e-3, r.rx), 0, st / Math.max(1e-3, r.rz)], l0 = Math.hypot(n0[0], n0[2]);
      const tg = [-st, 0, ct], n = norm([n0[0] / l0 - tg[0] * sl, 0.08, n0[2] / l0 - tg[2] * sl]);
      row.push(M.vert(p, n, mat, fitOrBand(th, r.c[1])));
    }
    ids.push(row);
  }
  for (let i = 0; i < N; i++) for (let k = 0; k < NK; k++) { const a0 = ids[i][k], a1 = ids[i][k + 1], b0 = ids[i + 1][k], b1 = ids[i + 1][k + 1]; M.tri.push(a0, b0, b1, a0, b1, a1); }
  function fitOrBand(th, y) { if (y <= top) return fitW(th, y, top, dressHem); const k = smooth(hipY + 0.12, band, y); return { pelvis: 1 - k * 0.5, spine: k * 0.5 }; }
  // the waistband, round the body, and the ties: a knot at the back, two ends hanging
  const bw = { spine: 0.5, pelvis: 0.5 }, tb = o.torso ? torsoAt(B, P, o.torso, band) : { rx: P.hip + 0.07, rz: 0.13 }, bx = tb.rx + 0.006, bz = tb.rz + 0.006;   // the band sits on the body
  tube(M, [{ c: [0, band + 0.012, 0], rx: bx, rz: bz, w: bw }, { c: [0, band - 0.012, 0], rx: bx, rz: bz, w: bw }], { mat: mid(o.mat || "apron"), seg: 22, square: o.torso?.square || 2 });
  blob(M, [0, band, -bz - 0.006], [0.02, 0.014, 0.01], bw, mid(o.mat || "apron"), { rings: 4, seg: 8 });   // the knot
  for (const x of [-1, 1]) tube(M, [0, 0.4, 1].map((t) => ({ c: [x * (0.01 + 0.018 * t), band - 0.008 - t * 0.22, -bz - 0.01 - 0.006 * t], rx: 0.01 * (1 - 0.3 * t), rz: 0.003, w: t < 0.3 ? bw : { pelvis: 1 } })), { mat: mid(o.mat || "apron"), seg: 6 });   // the ends, hanging
  M.cur = prev;
}

// Leg: trouser tube hip to ankle, a boot. o: { r (thigh radius), mat, boot, bootTop (fraction of shin) }
export function legs(M, B, P, o) {
  M.legR = Math.max(M.legR || 0, o.r);   // the cloth collision in rig/body.mjs skin() keeps skirts outside legs of this radius
  for (const s of ["L", "R"]) {
    limb(M, B, "thigh" + s, "shin" + s, o.r, o.r * 0.78, mid(o.mat), { rings: 6, parentBlend: "pelvis", seg: 12 });
    limb(M, B, "shin" + s, "foot" + s, o.r * 0.78, o.r * 0.6, mid(o.mat), { rings: 6, seg: 12, over: 0.05 });
    // o.knees (2026-10-22): the cloth bunched at the knee, two soft rolls, so a bent leg reads as cloth over a knee
    if (o.knees) { const kn = J(B, "shin" + s), W1 = { ["thigh" + s]: 0.55, ["shin" + s]: 0.45 }, W2 = { ["shin" + s]: 0.8, ["thigh" + s]: 0.2 };
      tube(M, [{ c: add(kn, [0, 0.03, 0]), rx: o.r * 0.84, rz: o.r * 0.84, w: W1 }, { c: add(kn, [0, 0.008, 0.003]), rx: o.r * 0.93, rz: o.r * 0.96, w: W1 }, { c: add(kn, [0, -0.016, 0]), rx: o.r * 0.86, rz: o.r * 0.9, w: W2 }, { c: add(kn, [0, -0.04, 0]), rx: o.r * 0.8, rz: o.r * 0.8, w: W2 }], { mat: mid(o.mat), seg: 12 }); }
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
    if (o.hand2) { M.begin(`hand${s}.fist`); hand2(M, B, s, o.hand2, o.skin || "skin", "fist"); M.begin(`hand${s}.open`); hand2(M, B, s, o.hand2, o.skin || "skin", "open"); M.end(); continue; }
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

// A hand sized from the body (2026-10-22, the fidelity pass): h is the body's height. Length 0.108 h (palm
// 0.58 of it), breadth 0.047 h, thickness 0.018 h (adult anthropometry, from memory, moderate confidence).
// Open: a flat palm, four fingers of their own lengths, a thumb forward. Fist: a squared fist round the grip
// axis (cast/tools.mjs GRIP passes through 0.065 m below the wrist), knuckles and a thumb across.
function hand2(M, B, s, h, mat, kind) {
  const w = J(B, "hand" + s), W = { ["hand" + s]: 1 }, x = s === "L" ? 1 : -1, L = 0.108 * h, Bw = 0.047 * h, T = 0.018 * h, m = mid(mat);
  const at = (dx, dy, dz) => add(w, [dx, dy, dz]);
  if (kind === "fist") {
    const cy = -Math.min(0.065, 0.62 * L);
    blob(M, at(0, cy + 0.004, 0.006), [T * 1.25, L * 0.36, Bw * 0.55], W, m, { rings: 7, seg: 12, square: 3 });
    for (let f = 0; f < 4; f++) blob(M, at(x * T * 0.55, cy - L * 0.22, -Bw * 0.33 + f * Bw * 0.22 + 0.006), [T * 0.5, T * 0.55, Bw * 0.12], W, m, { rings: 4, seg: 8 });   // the knuckles, on the back of the hand's lower edge
    tube(M, [{ c: at(-x * T * 0.4, cy + L * 0.12, Bw * 0.5), rx: T * 0.42, rz: T * 0.42, w: W }, { c: at(-x * T * 0.9, cy - L * 0.08, Bw * 0.42), rx: T * 0.38, rz: T * 0.38, w: W }], { mat: m, seg: 8 });   // the thumb across the fingers
    return;
  }
  const pl = L * 0.58;
  tube(M, [{ c: at(0, -0.005, 0.004), rx: T * 0.45, rz: Bw * 0.4, w: W }, { c: at(0, -pl * 0.45, 0.002), rx: T * 0.5, rz: Bw * 0.5, w: W }, { c: at(0, -pl, 0), rx: T * 0.42, rz: Bw * 0.47, w: W }], { mat: m, seg: 12, square: 3 });
  const lens = [0.78, 0.95, 1, 0.92];   // little to index (back to front: knuckles forward is +z)
  for (let f = 0; f < 4; f++) {
    const z = -Bw * 0.36 + f * Bw * 0.24, fl = L * 0.42 * lens[f], r = T * (f === 0 ? 0.36 : 0.42);
    tube(M, [{ c: at(0, -pl + 0.004, z), rx: r, rz: r, w: W }, { c: at(-x * T * 0.15, -pl - fl * 0.55, z * 1.02), rx: r * 0.9, rz: r * 0.9, w: W }, { c: at(-x * T * 0.45, -pl - fl, z * 1.03), rx: r * 0.75, rz: r * 0.75, w: W }], { mat: m, seg: 7 });
  }
  tube(M, [{ c: at(-x * T * 0.25, -pl * 0.2, Bw * 0.42), rx: T * 0.48, rz: T * 0.48, w: W }, { c: at(-x * T * 0.6, -pl * 0.62, Bw * 0.62), rx: T * 0.42, rz: T * 0.42, w: W }, { c: at(-x * T * 0.85, -pl * 0.95, Bw * 0.66), rx: T * 0.34, rz: T * 0.34, w: W }], { mat: m, seg: 8 });   // the thumb, forward and toward the palm
}

// Neck and head, sculpted: signed-distance features smooth-unioned into one surface (rig/sdfmesh.mjs).
// o: { r (head radius), jaw, chin, nose: [len, r, droop, hook], hair ('cap'|'crop'|'none'), skin, brow (mat),
//      browW (ridge), jowls, lids (0 open .. 1 heavy), mouth (width), stubble, ears }
// Expressions for baked portraits: setExpression(name) before a build changes every head built after
// it (brows up or down and pinched, lids, the mouth open or pressed), then setExpression(null).
export const EXPRESSIONS = {
  neutral: {},
  wary: { browY: -0.08, browIn: -0.09, lidsAdd: 0.5, mouthW: 0.85 },
  startled: { browY: 0.16, browIn: 0.05, lidsAdd: -0.6, open: 0.13, mouthW: 0.8 },
  set: { browY: -0.05, browIn: -0.13, lidsAdd: 0.25, mouthW: 1.15, press: true },
};
let EXPR = null;
// a preset name, or an object of presets and sliders (forge/headshapes.mjs EXPR_SLIDERS), e.g.
// { brow: 0.6, corners: -0.4, jaw: 0.3 } or { ...EXPRESSIONS.wary, corners: 0.5 }
export const setExpression = (name) => { EXPR = !name ? null : typeof name === "object" ? name : EXPRESSIONS[name]; };
export const currentExpr = () => EXPR;   // the sculpted head (cast/sculpt.mjs) reads the same expression
// o.id: a person with a head sheet (forge/heads.cast.mjs) gets the sculptor's head (forge/heads.mjs),
// with its hair, beard, neck and drawn collar; the sliders below are then not used.
export const SKULL_YIELD = 0.02, WHITE_CLAIM = 0.02, IRIS_CLAIM = 0.009;   // R units, lidRange heads only: the skull yields, the eye white claims its carve
// People and class marks on the old head (The Quota, 2026-10-22; all opt-in, the old head has none):
// o.hunger 0..1, the famine winter in the temples and under the cheekbones; o.scar [x0, y0, x1, y1] in
// head units on the face's front; o.teeth a material name (seen when the mouth opens) and o.gaps, the
// count of teeth missing from the front row.
function marks(o, E, Cp, { fl, mw, op, sk }) {
  const out = [], h = o.hunger || 0;
  if (h) for (const x of [-1, 1]) out.push(E([x * 0.8, 0.36, 0.42], [0.13 * h, 0.17 * h, 0.2 * h], sk, 0.05, "sub"), E([x * 0.5, -0.24 * fl, 0.62], [0.13 * h, 0.12 * h, 0.15 * h], sk, 0.05, "sub"));
  if (o.scar) { const [x0, y0, x1, y1] = o.scar; out.push(Cp([x0, y0, 0.84], [x1, y1, 0.8], 0.012, 0.009, mid("scar"), 0.004)); }
  if (o.teeth) {
    const y = -0.52 * fl - op / 2;
    out.push(E([0, y, 0.78], [0.19 * mw, 0.045 + op * 0.3, 0.07], mid(o.teeth), 0, "hard"));
    for (let g = 0; g < (o.gaps || 0); g++) out.push(E([(g % 2 ? -1 : 1) * (0.04 + 0.05 * g) * mw, y, 0.82], [0.03, 0.05 + op * 0.3, 0.03], mid("eye"), 0, "hard", 0.004));
  }
  return out;
}
export function head(M, B, P, o) {
  const X = EXPR || {}, prevPart = M.cur;
  if (hasHead(o.id)) {
    const lod = (o.cell ?? 0.16) <= 0.05 ? "near" : (o.cell ?? 0.16) <= 0.1 ? "mid" : "far";
    sculptHead(M, B, P, o.id, { lod, expr: X }); M.cur = prevPart;
    return add(J(B, "head"), [0, o.r * 0.9, o.r * 0.05]);
  }
  M.begin("head");   // the head and neck are a named part (a forged sheet can replace it)
  const h = J(B, "head"), R = o.r, W = { head: 1 }, sk = mid(o.skin || "skin");
  limb(M, B, "neck", "head", o.neck || 0.055, (o.neck || 0.055) * 0.92, sk, { rings: 4, seg: 12, over: 0.15 });
  const c = add(h, [0, R * 0.9, R * 0.05]), at = (v) => add(c, v.map((x) => x * R)), E = (cc, r, mat = sk, k = 0.03, op, bias) => ({ t: "ell", c: at(cc), r: r.map((x) => x * R), mat, k: k * R / 0.15, op, bias });
  const Cp = (a, b, r0, r1, mat = sk, k = 0.015, op) => ({ t: "cap", a: at(a), b: at(b), r0: r0 * R, r1: r1 * R, mat, k, op });
  // o.exprGain (2026-10-21, The Quota): the expression's brow, inner brow, lids, jaw, corners and mouth width
  // multiplied, so moods read at portrait size; the presets and sliders are unchanged at 1 (the old head).
  // o.lidRange: the lid's range remapped so neutral is open with the iris showing; o.lids is then the
  // character's heaviness (0 open .. 1 heavy), which stops short of closing; expressions still close it.
  const gn = o.exprGain ?? 1, xl = ((X.lidsAdd || 0) + (X.lids || 0) * 0.5) * gn;
  const warmM = mid("cheek"), coolM = mid("jawcool"), j = o.jaw || 1, lid = Math.max(0, Math.min(1, (o.lids ?? 0.4) + xl)), mw = (o.mouth || 1) * (1 + ((X.mouthW || 1) - 1) * gn), by = ((X.browY || 0) + (X.brow || 0) * 0.1) * gn, bi = ((X.browIn || 0) + (X.browInner || 0) * 0.1) * gn, op = ((X.open || 0) + (X.jaw || 0) * 0.12) * gn, cr = (X.corners || 0) * (gn !== 1 ? 0.11 : 0.05) * gn, [nl, nr, nd, hk = 0] = o.nose || [0.07, 0.022, 0.3];
  const held = !!(o.lidRange && X.held), lift = held ? 0 : 1;   // X.held (a lie): the smile is held and the eyes don't join in: no cheek or lower-lid lift, the lids narrow a little
  const lk = o.lidRange ? Math.max(-0.3, Math.min(0.92, (o.lids ?? 0.4) * 0.55 + xl * 0.8 + (held ? 0.12 : 0))) : null, lidEdge = o.lidRange ? 0.12 + 0.14 * (1.0 - 0.85 * lk) : null;   // the upper lid's lower edge (the eye's centre is at 0.12, its top at 0.26)
  // shape options (2026-10-21, The Quota's cast; every default reproduces the old head exactly):
  //   skull [x, y, z] cranium scale; faceLen the jaw and chin's drop; eyes eye size; eyeX eye spacing;
  //   cheekR cheek size; browShape "bar" | "arch" | "none"; browT brow thickness; lines folds and
  //   forehead creases 0..1; lips lip thickness; bulb the nose tip's size
  const sk3 = o.skull || [1, 1, 1], fl = o.faceLen ?? 1, ey = o.eyes ?? 1, ex = o.eyeX ?? 1, ckr = o.cheekR ?? 1, bt = o.browT ?? 1, lp = o.lips ?? 1, bulb = o.bulb ?? 1, shape = o.browShape || "bar";
  // expressive (o.exprGain set): brows follow the forehead back as they rise, so they never stand off the
  // skin, the inner ends move twice as far, and the outer ends drop when the inner ones pinch (anger)
  const xp = gn !== 1, byc = xp ? Math.max(-0.08, Math.min(0.1, by)) : by, bz = xp ? -Math.max(0, byc) * 0.9 : 0, bi2 = xp ? Math.max(-0.1, Math.min(0.12, bi * 2)) : bi, bo = xp ? -bi2 * 0.3 : 0;
  const brows = (x) => shape === "none" ? [] : shape === "arch"
    ? [Cp([x * 0.13, 0.29 + byc + bi2, 0.895 + bz], [x * 0.3, 0.355 + byc, 0.885 + bz], 0.022 * bt, 0.026 * bt, mid(o.brow || "brow"), 0.004), Cp([x * 0.3, 0.355 + byc, 0.885 + bz], [x * 0.5, 0.3 + byc + bo, 0.8 + bz], 0.026 * bt, 0.014 * bt, mid(o.brow || "brow"), 0.004)]
    : [E([x * 0.36, 0.33 + byc + bo * 0.5, 0.82 + bz], [0.21, 0.045 * bt, 0.06], mid(o.brow || "brow"), 0.006, null, 0.01),
       E([x * 0.2, 0.33 + byc + bi2, 0.85 + bz], [0.1, 0.045 * bt, 0.05], mid(o.brow || "brow"), 0.006, null, 0.01)];   // the inner brow (pinched down or lifted)
  const ln = o.lines || 0;
  const skAt = (k) => -0.03 + 0.95 * k[2] * Math.sqrt(Math.max(0, 1 - (0.33 / (0.86 * k[0])) ** 2 - (0.1 / k[1]) ** 2)), skBack = o.skull ? Math.max(0, skAt(sk3) - skAt([1, 1, 1])) : 0;
  // the eye: carve, white, iris and upper lid; then the lid plane and the smile's lower lid.
  // o.lidRange heads take the eye last, so no later skin (a wide skull, the brow, the socket) buries it,
  // and the skull yields its colour claim (sdfmesh: a point takes the material of the primitive nearest
  // its own surface, less its bias), which painted wide or deep skulls' eyes as skin
  const eyeCore = (x) => [
      E([x * 0.33 * ex, 0.13, 0.8], [0.19 * ey, 0.14 * ey, 0.16 * ey], sk, 0.02, "sub"),
      E([x * 0.33 * ex, 0.12, 0.66 + 0.14 * (1 - ey)], [0.14 * ey, 0.14 * ey, 0.14 * ey], mid("white"), 0, "hard", o.lidRange ? WHITE_CLAIM * R : undefined),
      E([x * 0.32 * ex, 0.12, 0.79], [0.07 * ey, 0.075 * ey, 0.025], mid("eye"), 0, "hard", o.lidRange ? IRIS_CLAIM * R : 0.004),
      o.lidRange ? E([x * 0.33 * ex, lidEdge + 0.07 * ey + 0.06 * (ey - 1), 0.71], [0.18 * ey, 0.07 * ey, 0.15], sk, 0.01)
        : E([x * 0.33 * ex, 0.19 + 0.02 * lid + 0.06 * (ey - 1), 0.71], [0.18 * ey, 0.06 + 0.07 * lid, 0.15], sk, 0.01),
  ];
  // o.lidPlane: a shelf over each eye, the upper lid's plane, so the reference shows where the gaze goes;
  // o.socket: the recess under the brow that holds the eye's shadow (both off by default: the old head);
  // a smile lifts the lower lid (the expressive path only)
  const eyeExtras = (x) => [
      ...(xp && cr > 0 && lift ? [E([x * 0.33 * ex, 0.12 - 0.14 * ey * 0.75 + cr * 0.8, 0.77], [0.15 * ey, 0.03, 0.08 * ey], sk, 0.008)] : []),
      ...(o.lidPlane ? [E([x * 0.33 * ex, (o.lidRange ? lidEdge + 0.025 : 0.205 + 0.025 * lid) + 0.06 * (ey - 1), 0.755], [0.18 * ey, 0.045, 0.1 * ey], sk, 0.008)] : []),
  ];
  const nb = o.noseBend || 0, fb = o.noseFlat ? 1 : (o.bridge || 0);   // o.bridge 0..1: a lower, wider bridge (people presets)   // o.noseBend: a broken nose, the tip pushed to one side (R units)
  // o.jawCorners: the jaw's angles, so a heavy face has a jaw rather than a sphere; o.cheekbones: their ridge
  const bones = [-1, 1].flatMap((x) => [...(o.jawCorners ? [E([x * 0.5 * j, -0.5 * fl, 0.25], [0.17 * o.jawCorners, 0.15 * o.jawCorners, 0.32], coolM, 0.04)] : []),
    ...(o.cheekbones ? [E([x * 0.47, 0.0, 0.58], [0.16 * o.cheekbones, 0.075, 0.17], sk, 0.03)] : [])]);
  const NL = nl / R, NR = nr / R, prims = [
    E([0, 0.02, -0.03 - skBack], [0.86 * sk3[0], 1 * sk3[1], 0.95 * sk3[2]], sk, 0, null, o.lidRange ? -SKULL_YIELD * R : undefined),   // a wider or deeper skull grows backward: at the eyes its surface stays where the old head's is, or the eye carve no longer reaches the eyes and buries them
    E([0, -0.48 * fl, 0.2], [0.64 * j, 0.5 * fl, 0.66], coolM, 0.05),
    E([0, -0.8 * fl, 0.48], [0.28 * (o.chin || 1), 0.2, 0.24], coolM, 0.04),
    E([0, 0.33, 0.6], [0.64 * (o.browW || 1), 0.15, 0.3], sk, 0.03),
    ...[-1, 1].flatMap((x) => [
      E([x * 0.42, -0.08 + (xp ? Math.max(0, cr) * 0.9 * lift : 0), 0.55 + (xp ? Math.max(0, cr) * 0.4 * lift : 0)], [0.25 * ckr, 0.18 * ckr, 0.25 * ckr], warmM, 0.05, null, o.lidRange ? 0.002 : 0.02),   // a smile lifts the cheeks; the cheek's colour claim (0.02, wide at the old head's size) painted big cheeks over the eyes, so o.lidRange heads keep it near the cheek
      ...(o.lidRange ? [] : eyeCore(x)),
      ...brows(x),
      ...(o.lidRange ? [] : eyeExtras(x)),
      ...(o.socket ? [E([x * 0.3 * ex, 0.24, 0.86], [0.2 * ey, 0.09, 0.07], sk, 0.025 * o.socket, "sub")] : []),
      E([x * 0.9, 0.0, 0.05], [0.1, 0.27, 0.17], warmM, 0.02),
      ...(o.jowls ? [E([x * 0.46, -0.6, 0.36], [0.3 * o.jowls, 0.32 * o.jowls, 0.3], sk, 0.06)] : []),
      ...(ln ? [Cp([x * (NR + 0.12), -0.18, 0.86], [x * 0.3 * mw + x * 0.06, -0.55 * fl, 0.8], 0.012 * ln, 0.01 * ln, sk, 0.006, "sub")] : []),   // the folds from nose to mouth
    ]),
    ...(ln ? [0.48, 0.56].map((y) => Cp([-0.32, y, 0.86], [0.32, y, 0.86], 0.008 * ln, 0.008 * ln, sk, 0.004, "sub")) : []),   // forehead creases
    Cp([0, 0.22, 0.78], [0, 0.02 + hk * 0.3 * NL, 0.86 + NL * (0.45 - 0.15 * fb)], NR * (0.7 + 0.25 * fb), NR * (0.85 + 0.2 * fb)),   // o.noseFlat: a broken bridge, low and wide
    Cp([0, 0.02 + hk * 0.3 * NL, 0.86 + NL * (0.45 - 0.15 * fb)], [nb, -0.12 - nd * NL, 0.9 + NL * 0.8], NR * 0.85, NR * 1.15 * bulb, warmM),
    ...[-1, 1].map((x) => E([nb + x * NR * 1.0, -0.16 - nd * NL - NR * 0.4, 0.86 + NL * 0.7], [NR * 0.7, NR * 0.55, NR * 0.75], sk, 0.02)),
    E([0, -0.47 * fl, 0.83], [0.25 * mw, 0.06 * lp, 0.08], mid("lip"), 0.01, null, 0.003),
    E([0, -0.57 * fl - op + (xp && cr < 0 ? -cr * 0.35 : 0), 0.81 + (xp && cr < 0 ? -cr * 0.2 : 0)], [0.21 * mw, (X.press ? 0.05 : 0.07) * lp, 0.08], mid("lip"), 0.01, null, 0.003),
    // the mouth's line; the expression sliders (forge/headshapes.mjs EXPR_SLIDERS: brow, browInner, lids, jaw,
    // corners) move the old head too, mapped above, with corners lifting or dropping the line's ends
    ...(cr ? [Cp([-0.22 * mw, -0.52 * fl - op / 2 + cr, 0.9], [0, -0.52 * fl - op / 2, 0.92], 0.018 * (o.mouthCut ?? 1) + op * 0.5, 0.018 * (o.mouthCut ?? 1) + op * 0.5, sk, 0.004, "sub"), Cp([0, -0.52 * fl - op / 2, 0.92], [0.22 * mw, -0.52 * fl - op / 2 + cr, 0.9], 0.018 * (o.mouthCut ?? 1) + op * 0.5, 0.018 * (o.mouthCut ?? 1) + op * 0.5, sk, 0.004, "sub")]
      : [Cp([-0.22 * mw, -0.52 * fl - op / 2, 0.9], [0.22 * mw, -0.52 * fl - op / 2, 0.9], 0.018 * (o.mouthCut ?? 1) + op * 0.5, 0.018 * (o.mouthCut ?? 1) + op * 0.5, sk, 0.004, "sub")]),
    ...bones,
    ...marks(o, E, Cp, { fl, mw, op, sk }),
    ...(o.lidRange ? [-1, 1].flatMap((x) => [...eyeCore(x), ...eyeExtras(x)]) : []),
  ];
  sdfPart(M, prims, { weights: W, cell: R * (o.cell || 0.1) });
  // the hair follows the skull's shape option (o.skull), so a child's rounder skull keeps its hair
  if (o.hair === "cap" || o.hair === "crop") { const tx = o.hairTex || 0, vol = 1 + 0.06 * tx;   // o.hairTex 0 straight .. 1 tight curl: ridges and volume
    blob(M, add(c, [0, R * 0.16 * (o.skull ? o.skull[1] : 1), -R * 0.12]), [R * 0.91 * vol * (o.skull ? o.skull[0] : 1), R * 0.9 * vol * (o.skull ? o.skull[1] : 1), R * 0.9 * vol * (o.skull ? o.skull[2] : 1)], W, mid(o.hairMat || "hair"), { rings: tx ? 14 : 10, seg: tx ? 30 : 18, rmod: (th) => (Math.sin(th) > 0.55 ? 0.9 : 1) * (tx ? 1 + 0.035 * tx * Math.sin(th * 13) : 1) }); }
  if (o.stubble) blob(M, add(c, [0, -R * 0.62, R * 0.36]), [R * 0.66 * j, R * 0.4, R * 0.62], W, mid("hair"), { rings: 8, seg: 16 });
  M.cur = prevPart;
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
