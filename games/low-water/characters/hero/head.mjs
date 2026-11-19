// The hero head: a realistic adult skull and soft tissue as signed distance shapes (forge/sdf.mjs
// records combined by forge/mesher.mjs prepare), for the native ray-traced frame at portrait range.
// Head-local metres: +x the person's left, +y up, +z forward; y = 0 at the eye centres. Built from
// landmark proportions (eye line at mid head, nose base a third down, mouth a third of the way from
// nose to chin, ear between the brow and nose base), then pushed by a face record:
//   { s, jaw, chin, cheek, gaunt, nose: { len, w, hook, tip }, brow, lip, ear, neck, age, adam }
// The eyes, lids' openings, lashes and brows are separate meshes (hero/eyes.mjs, hero/hair.mjs),
// placed from eyeCentres(face).
import { smin } from "../forge/sdf.mjs";

const len = Math.hypot;
export const EYE_R = 0.0121;
export function faceDefaults(f = {}) {
  return { s: 1, jaw: 1, chin: 1, cheek: 1, gaunt: 0.4, brow: 1, lip: 1, ear: 1, neck: 1, age: 0.5, adam: 1, ...f,
    nose: { len: 1, w: 1, hook: 0.2, tip: 1, ...(f.nose || {}) } };
}
export function eyeCentres(f) {
  const s = f.s;
  return [[0.0315 * s, 0, 0.066 * s], [-0.0315 * s, 0, 0.066 * s]];
}
// the lid opening of one eye in its own angles (elevation a, azimuth z from the gaze): the upper
// and lower lid lines and whether a point at (a, z) is covered
export function lidLines(f, az) {
  const azMax = 0.98, k = Math.max(0, 1 - (az / azMax) ** 2), sh = Math.sqrt(k), canth = -0.06 + 0.1 * az;   // lateral canthus a little higher
  const up = canth + (0.24 - 0.08 * f.age - canth) * Math.pow(k, 0.35), lo = canth + (-0.44 - canth) * Math.pow(sh, 0.8);
  return { up, lo, open: k > 0 };
}

// shapes in head-local metres; ops as forge/mesher.mjs prepare reads them
export function headShapes(face) {
  const f = faceDefaults(face), s = f.s, S = (v) => v.map((x) => x * s), out = [];
  const add = (sh, k = 0.012) => out.push({ op: "add", k: k * s, mat: "skin", ...sh });
  const sub = (sh, k = 0.006) => out.push({ op: "sub", k: k * s, ...sh });
  const ell = (c, r, rot) => ({ t: "ell", c: S(c), r: S(r), ...(rot ? { rot } : {}) });
  const cap = (a, b, r) => ({ t: "cap", a: S(a), b: S(b), r: Array.isArray(r) ? r.map((x) => x * s) : r * s });
  const N = f.nose, g = f.gaunt;
  // the vault: cranium, forehead, occiput, the flat temporal planes
  add(ell([0, 0.035, -0.02], [0.069, 0.092, 0.097], null), 0.02);
  add(ell([0, 0.03, 0.035], [0.06, 0.058, 0.052]), 0.03);
  add(ell([0, 0.0, -0.075], [0.058, 0.07, 0.05]), 0.03);
  sub(ell([0.08, 0.02, 0.02], [0.008, 0.026, 0.026]), 0.025); sub(ell([-0.08, 0.02, 0.02], [0.008, 0.026, 0.026]), 0.025);
  // brow ridge (frontal bone over the orbits) and the glabella between
  for (const x of [1, -1]) add(cap([x * 0.012, 0.019 * f.brow, 0.083], [x * 0.047, 0.016 * f.brow, 0.068], [0.0105, 0.008]), 0.012);
  add(ell([0, 0.014, 0.084], [0.012, 0.012, 0.01]), 0.01);
  // the face block: maxilla and zygomatic arches; cheekbones; the cheeks under them (hollowed by gaunt)
  add(ell([0, -0.038, 0.046], [0.041, 0.052, 0.042]), 0.03);
  for (const x of [1, -1]) {
    add(ell([x * 0.049, -0.008, 0.05], [0.019 * f.cheek, 0.012, 0.019]), 0.018);
    add(ell([x * 0.034, -0.048, 0.05], [0.024 * (1 - 0.35 * g), 0.024, 0.023 * (1 - 0.3 * g)]), 0.03);
    sub(ell([x * 0.05, -0.036, 0.04], [0.007, 0.012, 0.01]), 0.024 + 0.01 * g);
  }
  // the mandible: rami up to the ears, the jaw line to the chin; the chin and its mental protuberance
  for (const x of [1, -1]) {
    add(cap([x * 0.053 * f.jaw, -0.03, -0.014], [x * 0.048 * f.jaw, -0.072, -0.008], [0.0095, 0.0105]), 0.024);
    add(cap([x * 0.048 * f.jaw, -0.072, -0.008], [x * 0.015, -0.1 * f.chin, 0.06], [0.0105, 0.0095]), 0.022);
  }
  add(ell([0, -0.097 * f.chin, 0.062], [0.016, 0.012, 0.014]), 0.022);
  add(ell([0, -0.094 * f.chin, 0.074], [0.012, 0.01, 0.008]), 0.012);
  // the orbits, carved under the brow; the eyeballs sit in them (separate meshes)
  for (const x of [1, -1]) sub(ell([x * 0.032, 0.002, 0.076], [0.017, 0.013, 0.014]), 0.008);
  // the eyelids: shells over the eyeballs, covering everything outside the opening
  for (const [ex, ey, ez] of eyeCentres({ s: 1 })) {
    const sx = Math.sign(ex);
    out.push({ op: "add", k: 0.0042 * s, mat: "skin", t: "fn", bc: S([ex, ey, ez]), br: 0.022 * s, f: lidField(f, S([ex, ey, ez]), sx) });
  }
  // the nose: nasal bones, the dorsum to the tip, the tip lobule, the alar wings, the columella; then
  // the nostrils carved up into the wings
  const nl = N.len, nw = N.w;
  add(cap([0, 0.006, 0.084], [0, -0.028 * nl, 0.103 + 0.006 * nl], [0.0072 * nw, 0.0085 * nw]), 0.006);
  add(ell([0, -0.012 * nl, 0.093 + 0.005 * nl + 0.004 * N.hook], [0.006 * nw, 0.012, 0.006]), 0.006);
  add(ell([0, -0.034 * nl, 0.107 + 0.006 * nl], [0.0105 * nw * N.tip, 0.0092, 0.0098]), 0.006);
  for (const x of [1, -1]) add(ell([x * 0.0112 * nw, -0.038 * nl, 0.095 + 0.004 * nl], [0.0075 * nw, 0.0066, 0.0072], [0, x * 20, 0]), 0.0075);
  add(cap([0, -0.04 * nl, 0.104 + 0.004 * nl], [0, -0.045, 0.094], 0.0042), 0.004);
  for (const x of [1, -1]) sub(ell([x * 0.0072 * nw, -0.0435 * nl, 0.099 + 0.004 * nl], [0.0032 * nw, 0.0021, 0.0048], [-10, x * 15, 0]), 0.0018);
  // mouth: the philtrum column, the upper lip with its cupid's bow, the lower lip, and the slit between
  const L = f.lip;
  add(ell([0, -0.052, 0.088], [0.008, 0.007, 0.005]), 0.009);
  add(ell([0, -0.0585, 0.0885], [0.022, 0.0047 * L, 0.0048]), 0.01);
  for (const x of [1, -1]) add(ell([x * 0.007, -0.0578, 0.0895], [0.0075, 0.0038 * L, 0.0042]), 0.006);
  add(ell([0, -0.0672, 0.0865], [0.019, 0.0052 * L, 0.0052]), 0.01);
  sub({ t: "box", c: S([0, -0.0625, 0.098]), r: S([0.0232, 0.0007, 0.012]), round: 0.0006 * s }, 0.0016);
  for (const x of [1, -1]) sub(ell([x * 0.0245, -0.0625, 0.087], [0.0035, 0.0028, 0.005]), 0.004);
  // mentolabial sulcus under the lower lip
  sub(ell([0, -0.079, 0.092], [0.014, 0.004, 0.006]), 0.008);
  // ears: the pinna as a plate set back and tilted, its helix rim, the concha carved, the lobe
  for (const x of [1, -1]) {
    const E = f.ear, cx = x * 0.074, rot = [0, x * -12, x * 4];
    add(ell([cx, -0.012, -0.012], [0.0085, 0.029 * E, 0.018 * E], rot), 0.008);
    add({ t: "tor", c: S([cx + x * 0.004, -0.008, -0.014]), R: 0.019 * E * s, r: 0.0032 * s, rot: [0, 0, 90 * x] }, 0.004);
    sub(ell([cx + x * 0.009, -0.016, -0.008], [0.006, 0.011 * E, 0.008 * E], rot), 0.004);
    sub(ell([cx + x * 0.0085, 0.002, -0.016], [0.005, 0.008 * E, 0.0065 * E], rot), 0.003);
    add(ell([cx + x * 0.002, -0.041 * E, -0.008], [0.005, 0.0075, 0.0065]), 0.006);
  }
  // neck: the column, the sternocleidomastoids from behind the ears to the notch, the larynx, the nape
  const nr = 0.052 * f.neck;
  add(cap([0, -0.06, -0.03], [0, -0.26, -0.016], [nr, nr * 1.08]), 0.03);
  for (const x of [1, -1]) add(cap([x * 0.058, -0.035, -0.03], [x * 0.012, -0.235, 0.04], [0.013, 0.011]), 0.016);
  add(ell([0, -0.14, 0.024], [0.009 * f.adam, 0.012, 0.008 * f.adam]), 0.014);
  add(ell([0, -0.085, -0.055], [0.04, 0.05, 0.03]), 0.03);
  return out;
}

// One eyelid pair as a field: a skin shell of 1.7 mm over a sphere 0.9 mm off the eyeball, present
// where the lid lines say the eye is covered, its margin rounded; the lids' fold (the supratarsal
// crease) is a shallow groove above the upper margin.
function lidField(f, e, sx) {
  const R = EYE_R * f.s + 0.0009 * f.s, th = 0.0017 * f.s;
  return (x, y, z) => {
    const px = x - e[0], py = y - e[1], pz = z - e[2], l = len(px, py, pz);
    const shell = Math.abs(l - R - th) - th;
    if (pz < -0.004 * f.s) return Math.max(shell, -pz - 0.004 * f.s);
    const az = Math.atan2(px * sx, pz), a = Math.atan2(py, len(px, pz));
    const { up, lo, open } = lidLines(f, az);
    let cover = open ? Math.max(lo - a, a - up) : 0.3;   // radians outside the opening
    const crease = open ? Math.exp(-(((a - up - 0.32) / 0.06) ** 2)) * 0.0005 * f.s : 0;
    return Math.max(shell, -cover * R * 0.8) + crease;
  };
}
// the skin's displacement: fine wrinkles at the eye corners and forehead by age, and pores
export function headDisp(face) {
  const f = faceDefaults(face);
  return (x, y, z) => {
    let d = 0;
    if (z > 0.03 && y > 0.03 && y < 0.07) d += 0.00006 * f.age * Math.sin(y * 2 * Math.PI / 0.0075 + 0.4 * Math.sin(x * 60));
    for (const ex of [0.05, -0.05]) { const r = len(x - ex, y + 0.004, z - 0.052); if (r < 0.016) d += 0.00016 * f.age * (1 - r / 0.016) * Math.sin(Math.atan2(y + 0.004, x - ex) * 9); }
    return d;
  };
}
export { smin };
