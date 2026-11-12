// The art director's parametric head (design/art/tools/anatomy.py, HEAD_DEFAULT and head()) ported to
// the forge, with the same parameter names, so one character sheet drives both the director's frames
// and the game (coordinator, 2026-10-17). Units are metres in head-local space as in anatomy.py; `s`
// scales the whole head (the game's grotesque heads are larger than natural). The port keeps the
// structure: cranium and face, jaw cones, chin, brow, nose cone and wings, lips, cheeks, ears, jowls,
// eyelid shells, eye sockets, the mouth slit, eyeballs, irises and pupils along the gaze.
// Not ported: the per-head displacement function (a sheet uses `disp` instead).
export const HEAD_DEFAULT = {
  s: 1.0,
  cran: [0.085, 0.105, 0.100], cran_c: [0.0, 0.025, -0.012],
  face: [0.066, 0.075, 0.07], face_c: [0.0, -0.045, 0.035],
  jaw_w: 0.060, jaw_y: -0.055, jaw_len: 0.125, chin_z: 0.072, chin_r: 0.026, jaw_r: 0.024,
  cheek: [0.047, -0.012, 0.068, 0.024],
  brow: [0.043, 0.036, 0.083, 0.014],
  eye_x: 0.034, eye_y: 0.014, eye_z: 0.080, eye_r: 0.0125, iris: 0.48,
  lid_up: 0.15, lid_lo: -0.55, lid_tilt: 0.0, lid_t: 0.0022,
  nose_bridge: [0.020, 0.090], nose_tip: [-0.035, 0.118], nose_r: [0.009, 0.012],
  hook: 0.0, nose_wing: 0.012, wing_r: 0.0105,
  mouth_y: -0.066, mouth_z: 0.086, mouth_w: 0.024, lip_t: 0.006, smile: 0.0, lip_full: 1.0,
  ear: [0.026, 0.0], jowl: 0.0, neck_len: 0.14, neck_r: 0.045,
  gaze: [0.0, 0.0, 1.0],
};
// Materials: skin (and its warm and cool zones), eye white, iris, pupil, lip.
const M = { skin: "skin", warm: "cheek", cool: "jawcool", white: "white", iris: "eye", pupil: "eye", lip: "lip" };

// head(prm, { neckTo }) -> { shapes, origin }: shapes in head-local space scaled by s; origin is the
// point (top of the neck) that sits on the rig's head joint. neckTo (m, rig space below the joint)
// extends the neck down into the collar so the head never stands on a stalk.
export function headShapes(prm = {}, { neckTo = null, mats = {} } = {}) {
  const P = { ...HEAD_DEFAULT, ...prm }, m = { ...M, ...mats }, s = P.s;
  const S = (v) => v.map((x) => x * s), sh = [];
  const ell = (c, r, mat, extra = {}) => sh.push({ t: "ell", c: S(c), r: S(r), mat, ...extra });
  const cone = (a, b, r0, r1, mat, extra = {}) => sh.push({ t: "cap", a: S(a), b: S(b), r: [r0 * s, r1 * s], mat, ...extra });
  const sph = (c, r, mat, extra = {}) => ell(c, [r, r, r], mat, extra);
  const [jw, jy, jl, cz] = [P.jaw_w, P.jaw_y, P.jaw_len, P.chin_z], [ex, ey, ez, er] = [P.eye_x, P.eye_y, P.eye_z, P.eye_r];
  const [, by, bz] = P.brow, nb = P.nose_bridge, nt = P.nose_tip, [my, mz, mw] = [P.mouth_y, P.mouth_z, P.mouth_w];
  const gl = Math.hypot(...P.gaze), gaze = P.gaze.map((v) => v / gl), eyes = [-1, 1].map((sx) => [sx * ex, ey, ez - er * 0.45]);
  const k = 0.012 * s;
  ell(P.cran_c, P.cran, m.skin, { k });
  ell(P.face_c, P.face, m.skin, { k });
  cone([-jw, jy, -0.012], [-0.012, -jl, cz - 0.004], P.jaw_r, P.chin_r * 0.8, m.cool, { k });
  cone([jw, jy, -0.012], [0.012, -jl, cz - 0.004], P.jaw_r, P.chin_r * 0.8, m.cool, { k });
  sph([0, -jl, cz], P.chin_r, m.cool, { k });
  sh.push({ t: "cap", a: S([-P.brow[0], by, bz]), b: S([P.brow[0], by, bz]), r: P.brow[3] * s, mat: m.skin, k });
  cone([0, nb[0], nb[1]], [0, nt[0], nt[1]], P.nose_r[0], P.nose_r[1], m.warm, { k });
  ell([0, my + 0.0065, mz], [mw, P.lip_t * P.lip_full, 0.015], m.lip, { k });
  ell([0, my - 0.0075, mz - 0.002], [mw * 0.86, P.lip_t * 1.25 * P.lip_full, 0.015], m.lip, { k });
  // the neck: from under the skull down to the rig's neck joint and on into the collar
  const neckTop = [0, -0.07, -0.03], neckLen = neckTo != null ? neckTo / s : P.neck_len;
  cone(neckTop, [0, -0.07 - neckLen, -0.035], P.neck_r, P.neck_r * 1.12, m.skin, { k });
  const ck = P.cheek;
  for (const sx of [-1, 1]) {
    ell([sx * ck[0], ck[1], ck[2]], [ck[3] * 1.15, ck[3] * 0.85, ck[3]], m.warm, { k });
    sph([sx * P.nose_wing, nt[0] + 0.005, nt[1] - 0.013], P.wing_r, m.warm, { k });
    if (P.ear[0] > 0) ell([sx * (P.cran[0] - 0.004 + P.ear[1]), -0.008, -0.012], [0.011, P.ear[0] * 1.35, P.ear[0] * 0.9], m.warm, { k });
    if (P.jowl > 0) sph([sx * jw * 0.9, -0.092, 0.028], P.jowl, m.skin, { k });
  }
  if (P.hook) { const mid = [nb[0] * 0.45 + nt[0] * 0.55, nb[1] * 0.45 + nt[1] * 0.55]; sph([0, mid[0], mid[1] + P.hook * 0.6], P.nose_r[0] * 1.15, m.warm, { k }); }
  eyes.forEach((ec, i) => {
    const sx = i ? 1 : -1;
    sh.push({ t: "lid", c: S(ec), R: (er + P.lid_t * 1.2) * s, th: P.lid_t * s, h: er * P.lid_up * s, tilt: P.lid_tilt, sx, up: true, mat: m.skin, k: 0.002 * s });
    sh.push({ t: "lid", c: S(ec), R: (er + P.lid_t) * s, th: P.lid_t * 0.8 * s, h: er * P.lid_lo * s, tilt: 0, sx, up: false, mat: m.skin, k: 0.002 * s });
  });
  // carves: the eye sockets, the mouth slit, the nostrils
  for (const ec of eyes) sh.push({ t: "ell", c: S([ec[0], ec[1], ec[2] + 0.004]), r: S([er * 1.55, er * 1.12, er * 1.15]), op: "sub", k: 0.005 * s });
  sh.push({ t: "slit", c: S([0, my, mz + 0.01]), w: mw * s, smile: P.smile * s, op: "sub", k: 0.005 * s });
  for (const sx of [-1, 1]) sph([sx * P.nose_wing * 0.55, nt[0] - 0.006, nt[1] - 0.006], 0.0042, null, { op: "sub", k: 0.005 * s });
  // eyeballs, irises, pupils (hard unions: their own materials, no blending into the skin)
  for (const ec of eyes) {
    sph(ec, er, m.white, { k: 0 });
    sh.push({ t: "scap", c: S(ec), R: (er + 0.0004) * s, n: gaze, h: er * Math.cos(P.iris) * s, mat: m.iris, k: 0, bias: 0.002 });
    sh.push({ t: "scap", c: S(ec), R: (er + 0.0007) * s, n: gaze, h: er * Math.cos(P.iris * 0.45) * s, mat: m.pupil, k: 0, bias: 0.003 });
  }
  return { shapes: sh, origin: S(neckTop) };
}
