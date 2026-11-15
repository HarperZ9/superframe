// The sculpted head's shapes (cast/sculpt.mjs), in R units about the head's centre, +z forward. The order is
// the construction: the cranium, the forehead block and the cuts that make the side and temple planes, then
// the brow ridge, the orbits, cheekbones and arches, the muzzle, the mandible (ramus, angle, body, chin), the
// soft masses, the nose's planes, the mouth, the ears, the neck, and last the eyes (hard, so nothing blends
// into them) with lids that have thickness and an almond aperture.
// Expression: the old head's sliders, mapped the same way (brow, inner brow, lids, jaw, corners, mouth width,
// press, held), with exprGain.
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const len = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
// a half-space carve as a forge "fn" shape: keeps n.(p - p0) <= 0 (sub removes where f < 0)
const half = (n, p0, k, bc = p0, br = 3) => { const l = len(...n), m = n.map((v) => v / l); return { t: "fn", f: (x, y, z) => -(m[0] * (x - p0[0]) + m[1] * (y - p0[1]) + m[2] * (z - p0[2])), bc, br, op: "sub", k }; };

// The portrait painter's push: a trait's distance from the cast's centre is drawn larger than measured (the
// people ranges are narrow, and two Tarn women of an age came out as one face), clamped below.
const CENTRE = { faceLen: [1.06, 1.3], cheekbones: [0.45, 1.4], jaw: [1.0, 1.8], chin: [1.05, 1.8], cheekR: [1.0, 1.6], lips: [0.9, 1.6], eyes: [1.0, 1.4], mouth: [0.92, 1.6], browW: [1.0, 1.6], jawCorners: [0.45, 1.5] };
const push = (o) => { const q = { ...o }; for (const [k, [c, g]] of Object.entries(CENTRE)) if (typeof o[k] === "number") q[k] = c + (o[k] - c) * g;
  if (o.skull) q.skull = o.skull.map((v, i) => [0.97, 1.03, 0.98][i] + (v - [0.97, 1.03, 0.98][i]) * 1.5); if (o.nose) q.nose = [0.062 + (o.nose[0] - 0.062) * 1.6, ...o.nose.slice(1)]; return q; };
export function faceShapes(o0, X, { neckY = -2, neckR = 0.36 } = {}) {
  const o = (o0.age ?? 40) >= 16 ? push(o0) : o0;   // children keep their age record's own proportions
  const age = o.age ?? 40, kid = clamp((16 - age) / 10, 0, 1), old = clamp((age - 50) / 25, 0, 1), fem = o.sex === "f";
  const man = !fem && age >= 16, sk3 = (o.skull || [1, 1, 1]).map((v, i) => 1 + (v - 1) * (i ? 0.9 : 0.6)), sx = sk3[0], sy = sk3[1], sz = sk3[2];   // the old records' skull values were set for a ball: half of them
  // the face below the brow, scaled by faceLen (a child's face is small under a large cranium)
  const lf = clamp(1 + ((o.faceLen ?? 1) - 1) * 1.1, 0.7, 1.25) * (1 - 0.05 * kid) * (fem ? 0.96 : 1);
  const yb = 0.16 - 0.12 * kid, F = (y) => yb + (y - 0.16) * lf;
  const fw = 1 - 0.14 * clamp((16 - age) / 10, 0, 1), j = clamp(o.jaw ?? 1, 0.7, 1.35), jc = clamp(Math.max(age >= 16 ? 0.4 : 0.15, o.jawCorners ?? 0.3), 0, 1.2), chin = clamp(o.chin ?? 1, 0.7, 1.5), cb = clamp(o.cheekbones ?? 0.3, 0, 1.2);
  const ckr = clamp(o.cheekR ?? 1, 0.7, 1.6), hun = clamp(o.hunger ?? 0, 0, 1), soc = clamp(o.socket ?? 1, 0.4, 2);
  const es = 1 + ((o.eyes ?? 1) - 1) * 0.3, ex = 0.27 * (o.eyeX ?? 1) * (1 + 0.04 * kid), er = 0.105 * es, ir = er * 0.49;
  const [nl0, nw0, nd0 = 0.3, hk0 = 0] = o.nose || [0.064, 0.021, 0.3, 0], nl = clamp(nl0 / 0.064, 0.4, 1.3), nw = clamp(nw0 / 0.021, 0.6, 1.4), bridge = o.noseFlat ? 1 : clamp(o.bridge ?? 0, 0, 1);
  const ridge = (man ? 1 : fem ? 0.35 : 0.6) * (1 - 0.6 * kid) * clamp(o.browW ?? 1, 0.8, 1.2), fat = clamp(0.5 + 0.8 * (ckr - 1) / 0.5 + 0.5 * kid + (fem ? 0.3 : 0) - hun * 0.5, 0.3, 1.5);
  // expression (as cast/parts.mjs head(): the same sliders, the same gain)
  const gn = o.exprGain ?? 1, xl = ((X.lidsAdd || 0) + (X.lids || 0) * 0.5) * gn, held = !!X.held, lift = held ? 0 : 1;
  const mw = (o.mouth || 1) * (1 + ((X.mouthW || 1) - 1) * gn), by = clamp(((X.browY || 0) + (X.brow || 0) * 0.1) * gn, -0.08, 0.1);
  const bi = clamp(((X.browIn || 0) + (X.browInner || 0) * 0.1) * gn * 2, -0.1, 0.12), op = Math.max(0, ((X.open || 0) + (X.jaw || 0) * 0.12) * gn) * 0.5;   // the jaw drops as a hinge, half the old head's slit
  const cr = (X.corners || 0) * 0.11 * gn, smile = Math.max(0, cr) * lift, lp = (o.lips ?? 1) * (X.press ? 0.72 : 1) * (1 - 0.25 * old) * (fem ? 1.15 : 1);
  const lk = clamp(Math.max(0.16, (o.lids ?? 0.4) * 0.55) + xl * 0.8 + (held ? 0.12 : 0), -0.35, 0.95);   // at rest the upper lid always crosses the iris
  const eyeY = yb - 0.165 * (1 - 0.15 * kid), eyeZ = 0.69 - 0.02 * soc + 0.02, noseY = F(-0.42), mouthY = F(-0.62) - op * 0.3, chinY = F(-0.88) - op * 0.8, mentonY = F(-1.0) - op * 0.8;
  const S = [], add = (s) => S.push({ op: "add", ...s }), cut = (s) => S.push({ op: "sub", ...s }), E = (c, r, mat = "skin", k = 0.03, x = {}) => add({ t: "ell", c, r, mat, k, ...x }), C = (a, b, r0, r1, mat = "skin", k = 0.03, x = {}) => add({ t: "cap", a, b, r: [r0, r1], mat, k, ...x });
  const both = (f) => { f(-1); f(1); };

  // ---- the cranium: Loomis's ball, with a flat forehead block in front and its sides cut flat ----
  const cc = [0, 0.22 + 0.02 * kid, -0.12 - 0.04 * (sz - 1)], cr3 = [0.76 * sx * (1 - 0.07 * kid), 0.84 * sy, 0.84 * sz * (1 - 0.08 * kid)];
  E(cc, cr3, "skin", 0, { exact: true });
  add({ t: "box", c: [0, 0.4 + 0.02 * kid, 0.5], r: [0.42 * sx, 0.36, 0.22], round: 0.16 + (fem ? 0.04 : 0), rot: [-14 + (fem ? 5 : 0) + 6 * kid, 0, 0], mat: "skin", k: 0.14 });   // the forehead's front plane, leaning back
  both((s) => cut({ t: "ell", c: [s * (0.6 * sx + 0.55), -0.12, -0.08], r: [0.55, 0.62, 0.66], k: 0.12 }));   // Loomis's side plane: a round flat where the ear sits, under the parietal's width
  both((s) => S.push(half([s, 0, 0.78], [s * 0.45 * sx, 0.3, 0.56], 0.1)));   // the temple planes turning the forehead into the sides
  both((s) => S.push(half([s * 0.25, 1, 0.6], [s * 0.3, 0.92 * sy + 0.2, 0.45], 0.1)));   // the top's front corners: the forehead turns into the crown
  // ---- the brow ridge over the orbits (a man's heavier, a child's barely there) ----
  both((s) => { C([0, yb, 0.8 - 0.02 * (1 - ridge)], [s * 0.2, yb + 0.03, 0.79 - 0.03 * (1 - ridge)], 0.055 * ridge + 0.02, 0.05 * ridge + 0.02, "skin", 0.05);
    C([s * 0.2, yb + 0.03, 0.79 - 0.03 * (1 - ridge)], [s * 0.45 * sx, yb + 0.0, 0.6], 0.05 * ridge + 0.02, 0.035, "skin", 0.05); });
  // ---- cheekbones and the zygomatic arches back to the ear ----
  both((s) => { E([s * (0.42 + 0.09 * cb) * fw, eyeY - 0.17, 0.5 + 0.06 * cb], [0.13 + 0.04 * cb, 0.075 + 0.015 * cb, 0.17], "skin", 0.12, { rot: [0, s * 28, s * -12] });
    C([s * (0.48 + 0.02 * cb), eyeY - 0.17, 0.34], [s * 0.58 * sx, eyeY - 0.14, 0.02], 0.035 + 0.01 * cb, 0.03, "skin", 0.07); });
  // ---- the muzzle (maxilla and teeth under the lips) ----
  E([0, F(-0.52), 0.5 + 0.05 * kid], [0.33 * Math.min(1.1, mw) * fw, 0.27 * lf, 0.34], "skin", 0.1);
  // ---- the mandible: ramus up to the ear, the angle, the body to the chin; the jaw drops as one piece ----
  const gon = (s) => [s * (0.43 + 0.3 * (j - 1) + 0.06 * jc) * sx * fw, F(-0.7) - op * 0.4, -0.08], cond = (s) => [s * 0.48 * sx, eyeY - 0.2, -0.12];
  const chinSide = (s) => [s * 0.15 * chin * (fem ? 0.85 : 1), chinY - 0.04, 0.58 + 0.18 * (chin - 1) + 0.07 * kid];
  both((s) => { C(cond(s), gon(s), 0.055, 0.065 + 0.012 * jc, "skin", 0.08); C(gon(s), chinSide(s), 0.065 + 0.012 * jc, 0.052, "skin", 0.045 - 0.012 * jc); });
  E([0, chinY, 0.6 + 0.2 * (chin - 1) + 0.09 * clamp((16 - age) / 10, 0, 1)], [0.14 * chin * (fem ? 0.85 : 1), 0.13 * lf, 0.17], "skin", 0.05);   // the chin's mound
  // ---- the masseter: the plane from the arch down to the jaw's angle (no hollow in front of the ear) ----
  both((s) => E([s * 0.47 * sx * fw, F(-0.5), 0.08], [0.08, 0.2 * lf, 0.15], "skin", 0.08));
  // ---- soft masses: the cheek over the teeth, the fat under the eye; hunger takes them ----
  both((s) => { E([s * 0.34 * fw, F(-0.5), 0.42 - 0.05 * kid], [(0.15 + 0.06 * fat) * fw, 0.2 * lf, 0.22], "skin", 0.12);
    E([s * 0.28, eyeY - 0.2 + smile * 0.9, 0.6 + smile * 0.2], [0.12, 0.09 + 0.02 * fat, 0.1 + 0.03 * fat], "skin", 0.08);
    if (o.jowls) E([s * 0.36, F(-0.86), 0.42], [0.12 * o.jowls, 0.11 * o.jowls, 0.15], "skin", 0.08); });
  if (hun > 0.3 && age >= 16) both((s) => cut({ t: "ell", c: [s * (0.5 * sx + 0.1), yb + 0.08, 0.36], r: [0.08, 0.18, 0.2], k: 0.08 }));   // hunger hollows the temples; the cheeks lose their fat (above)
  // ---- the outer orbital rim: the eye is hidden from the side (it sits back in the skull, not in a slot) ----
  both((s) => E([s * (ex + 0.16), eyeY - 0.01, 0.7], [0.09, 0.14, 0.12], "skin", 0.06));
  // ---- the orbits: carved under the ridge so the eye sits back in its socket ----
  both((s) => cut({ t: "ell", c: [s * (ex - 0.03), eyeY + 0.015, 0.83], r: [0.12 * es, 0.1 * es, 0.12], k: 0.03 + 0.015 * soc }));
  // ---- the nose: bridge from the nasion, its side planes, the tip, the wings and the nostrils ----
  const nb = o.noseBend || 0, droop = nd0 * 0.05 + 0.02 * old, tipZ = 0.83 + 0.22 * Math.pow(nl, 0.6) * (1 - 0.15 * bridge) * (fem ? 0.92 : 1), tipY = F(-0.38 + 0.1 * (1 - nl)) - droop;
  const nas = [0, eyeY + 0.07, 0.775 - 0.02 * bridge - 0.02 * kid], bulb = clamp(o.bulb ?? 1, 0.7, 1.3);
  add({ t: "box", c: [nb * 0.4, (nas[1] + tipY) / 2 + 0.02, (nas[2] + tipZ) / 2 - 0.05], r: [0.035 * nw * (1 + 0.4 * bridge), (nas[1] - tipY) / 2 + 0.01, 0.055], round: 0.03, rot: [-Math.atan2(tipZ - nas[2], nas[1] - tipY) * 57.3, 0, -nb * 60], mat: "skin", k: 0.04 });   // the bridge's front and side planes
  if (hk0 > 0.02) E([0, (nas[1] + tipY) / 2 + 0.03, (nas[2] + tipZ) / 2 + 0.01], [0.03 * nw, 0.05, 0.025 + hk0 * 0.25], "skin", 0.03);   // a high bridge
  E([nb, tipY, tipZ - 0.055 * bulb], [0.058 * nw * bulb, 0.055 * bulb, 0.06 * bulb], "skin", 0.035);   // the tip
  both((s) => E([nb * 0.6 + s * 0.08 * nw, noseY + 0.02, tipZ - 0.13], [0.05 * nw, 0.045, 0.06], "skin", 0.025, { rot: [0, s * 25, 0] }));   // the wings
  C([nb * 0.7, tipY - 0.03, tipZ - 0.06], [0, noseY, tipZ - 0.14], 0.03, 0.03, "skin", 0.02);   // the columella down to subnasale
  both((s) => cut({ t: "ell", c: [nb * 0.6 + s * 0.045 * nw, noseY - 0.008, tipZ - 0.1], r: [0.026 * nw, 0.014, 0.032], k: 0.012 }));   // the nostrils
  // ---- the mouth: philtrum, lips with their corners, the line between, the fold under the lower lip ----
  const lipZ = 0.83 + 0.02 * (lp - 1) - 0.045 * clamp((16 - age) / 10, 0, 1), ul = [0, mouthY + 0.045, lipZ], ll = [0, mouthY - 0.05 - op * 0.7 + (cr < 0 ? -cr * 0.3 : 0), lipZ - 0.015 + (cr < 0 ? -cr * 0.15 : 0)];
  E(ul, [0.18 * mw * fw, 0.045 * lp, 0.055], "skin", 0.025, { rot: [-18, 0, 0] });   // lips are flesh; their colour is painted (cast/sculpt.mjs skinTint), so no islands of another material
  E(ll, [0.155 * mw * fw, 0.05 * lp, 0.055], "skin", 0.025, { rot: [14, 0, 0] });
  both((s) => C([s * 0.028, noseY - 0.02, 0.86], [s * 0.03, mouthY + 0.1, lipZ + 0.035], 0.012, 0.01, "skin", 0.02));   // the philtrum's ridges
  const corner = (s) => [s * 0.19 * mw * fw, mouthY + cr * 0.9, lipZ - 0.04], mc = (o.mouthCut ?? 1) * 0.011 + op * 0.45;
  // the line between the lips: two flat ellipsoids from the middle to each corner, tilted by the corners' lift (no
  // round ends, which left pits at the middle and the corners), and a soft dimple at each corner
  both((s) => { const hw = 0.19 * mw * fw, lift = cr * 0.9; cut({ t: "ell", c: [s * hw * 0.5, mouthY - op * 0.3 + lift * 0.5, lipZ + 0.02], r: [hw * 0.56, mc, 0.075], rot: [0, 0, s * Math.atan2(lift, hw) * 57.3], k: 0.006 });
    cut({ t: "ell", c: [s * hw * 1.02, mouthY + lift, lipZ - 0.05], r: [0.03, 0.025, 0.035], k: 0.03 }); });
  if (cr > 0 || o.lines) both((s) => cut({ t: "cap", a: [s * 0.1 * nw + s * 0.02, noseY + 0.03, 0.78], b: [s * (0.22 * mw + 0.03), mouthY - 0.06 + cr * 0.5, 0.74], r: [0.01 + 0.012 * ((o.lines || 0) + smile * 4), 0.008], k: 0.02 }));   // the folds from nose to mouth
  cut({ t: "cap", a: [-0.1, ll[1] - 0.075, lipZ + 0.03], b: [0.1, ll[1] - 0.075, lipZ + 0.03], r: [0.022, 0.022], k: 0.03 });   // the fold over the chin
  if (op > 0.02 && o.teeth) add({ t: "ell", c: [0, mouthY - op * 0.3 + 0.01, lipZ - 0.05], r: [0.11 * mw, 0.035 + op * 0.2, 0.05], mat: o.teeth, op: "hard" });
  // ---- the ears: on the side plane, top at the brow and lobe at the nose's base, behind the jaw's hinge ----
  const earY = (yb + noseY) / 2 - 0.03, el = clamp(0.2 * (1 + 0.1 * old) / lf, 0.16, 0.26) * lf, eo = o.earOut || 0;
  both((s) => { const ec = [s * (0.6 * sx + 0.075 + 0.07 * eo), earY, -0.1 - 0.03 * eo], rot = [-14, s * (12 + 45 * eo), 0];   // earOut: the ear stands off the head, turned forward
    const em = o.earMat || "skin", eb = o.earMat ? { bias: -0.02 } : {}; E(ec, [0.035, el, 0.13], em, 0.02, { rot, ...eb });
    cut({ t: "ell", c: [ec[0] + s * 0.035, earY - 0.02, -0.08], r: [0.03, el * 0.45, 0.07], k: 0.015, rot });   // the bowl of the ear
    E([ec[0] + s * 0.005, earY - el * 0.85, -0.06], [0.03, 0.06, 0.05], em, 0.02, eb);   // the lobe
    E([s * (0.6 * sx + 0.04), earY - 0.04, 0.02], [0.03, 0.04, 0.03], "skin", 0.02); });   // the tragus
  // ---- the neck going up into the skull, with the muscles from behind the ear to the throat ----
  const nr = neckR * (1 - 0.25 * kid) * (fem ? 0.9 : 1);
  C([0, F(-0.78), -0.26], [0, neckY, -0.14], nr * 0.92, nr, "skin", 0.1);
  both((s) => C([s * 0.34, earY - 0.24, -0.3], [s * 0.07, Math.max(neckY + 0.1, F(-1.5)), 0.06], 0.07 * (1 - 0.3 * kid), 0.055, "skin", 0.08));
  if (man) E([0, F(-1.2), 0.1], [0.05, 0.07, 0.06], "skin", 0.05);   // the larynx
  // ---- marks: the scar, forehead creases, the inner brows' knot in anger ----
  // the scar is painted into the skin (cast/sculpt.mjs skinTint): a raised cap read as a blob on the forehead
  const lines = (o.lines || 0) + Math.max(0, by) * 6;
  if (lines > 0.2) for (const y of [0.42, 0.52]) cut({ t: "cap", a: [-0.28, yb + y - 0.16, 0.86], b: [0.28, yb + y - 0.16, 0.86], r: [0.007 * Math.min(1.4, lines), 0.007 * Math.min(1.4, lines)], k: 0.006 });
  if (bi < -0.03) { E([0, yb + 0.01, 0.84], [0.07, 0.035, 0.03], "skin", 0.02); both((s) => cut({ t: "cap", a: [s * 0.04, yb - 0.02, 0.88], b: [s * 0.035, yb + 0.08, 0.86], r: [0.008, 0.006], k: 0.006 })); }
  // ---- the eyes: lids with thickness over an almond aperture, the eyeball, the iris under a cornea, the pupil ----
  const lidUp = ir * (0.95 - 1.5 * lk), lidLo = -ir * (0.84 - smile * 2.8) - 0.002 * old, tilt = o.eyeTilt ?? 0.012, w = er * 1.02;
  const eyes = [], gaze = held ? [-0.16, -0.09, 1] : [0, 0, 1], gl = len(...gaze), gn3 = gaze.map((v) => v / gl);
  both((s) => {
    const e = [s * ex, eyeY, eyeZ], edge = (x, h) => { const u = clamp(Math.abs(x) / w, 0, 1), inner = s * x < 0 ? 1 : 0, yc = inner ? -0.004 : tilt; return yc + (h - yc) * Math.pow(1 - u * u, 0.7); };
    for (const up of [1, 0]) add({ t: "fn", bc: e, br: er + 0.06, mat: "skin", k: 0.012, f: (x, y, z) => { const qx = x - e[0], qy = y - e[1], qz = z - e[2], l = len(qx, qy, qz), shell = Math.abs(l - er * 1.04) - (up ? 0.017 : 0.014);
      const h = edge(qx, up ? lidUp : lidLo); return Math.max(shell, up ? h - qy : qy - h, -qz - 0.06); } });
    if (up_fold(lk)) add({ t: "fn", bc: e, br: er + 0.08, mat: "skin", k: 0.01, f: (x, y, z) => { const qx = x - e[0], qy = y - e[1], qz = z - e[2], l = len(qx, qy, qz); return Math.max(Math.abs(l - er * 1.2) - 0.012, (lidUp + 0.06 - 0.25 * qx * qx / er) - qy, -qz); } });   // the fold above the lid
    eyes.push({ e, er, ir, n: gn3, bulge: 0.014 });   // the eyeball, iris and pupil are meshed exactly (cast/sculpt.mjs eyeMesh), not polygonised
  });
  // ---- the brows: hair laid on the ridge, inner ends pinched or lifted ----
  const bt = clamp(o.browT ?? 1, 0.4, 1.4) * (fem ? 0.75 : 1) * (1 - 0.3 * kid), arch = (o.browShape === "arch" || fem) ? 0.035 : 0.012;
  if (o.browShape !== "none") both((s) => { const bz = -Math.max(0, by) * 1.2, p0 = [s * 0.09, yb + 0.03 + by + bi, 0.865 + bz], p1 = [s * 0.27, yb + 0.06 + by + arch, 0.835 + bz], p2 = [s * 0.44 * sx, yb + 0.02 + by - bi * 0.3, 0.66 + bz];
    C(p0, p1, 0.024 * bt, 0.02 * bt, "brow", 0.008, { bias: 0.006 }); C(p1, p2, 0.02 * bt, 0.01 * bt, "brow", 0.008, { bias: 0.006 }); });
  if (o.moustache) { const [mw2 = 0.03, mt = 0.006] = o.moustache, wR = mw2 / 0.14 * 1.1, tR = mt / 0.14 * 1.1;   // on the upper lip, from under the nose to past the corners
    both((s) => C([0, mouthY + 0.075, lipZ + 0.05], [s * wR, mouthY + 0.0 + cr * 0.6, lipZ - 0.04], tR, tR * 0.6, o.hairMat || "hair", 0.006, { bias: 0.006 })); }
  const L = { lips: { y: mouthY - op * 0.3, w: 0.18 * mw * fw, h: 0.06 * lp + op * 0.4 }, scar: o.scar ? o.scar.map((v, i) => (i % 2 ? yb + v - 0.2 : v)) : null, yb, eyeX: ex, eyeY, noseY, mouthY, earY, chinY, mentonY, cran: { c: cc, r: cr3 }, sk3, eyes, kid, old, fem, man };
  return { shapes: S, L };
}
const up_fold = (lk) => lk < 0.7;
