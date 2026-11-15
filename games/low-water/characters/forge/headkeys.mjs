// The head sculptor's sliders (ART-DIRECTION 7.1): every key of design/art/heads.json plus the keys
// the sculptor adds, each with a natural range (a plausible adult) and a slider range that reaches
// well past it, because the principals sit at the edges. Metres in head-local space at s = 1
// (y up, z forward, the cranium near the origin), as anatomy.py and heads.json.
// validateHead(rec) checks a record; pastNatural(rec) lists the keys pushed beyond natural.
import { HEAD_DEFAULT } from "./anatomy.mjs";

// [key, natural lo, natural hi, slider lo, slider hi]; "cran.1" is component 1 of cran
const K = [
  ["s", 0.9, 1.1, 0.5, 2.0],
  ["cran.0", 0.075, 0.09, 0.05, 0.14], ["cran.1", 0.095, 0.11, 0.07, 0.16], ["cran.2", 0.095, 0.105, 0.07, 0.15],
  ["cran_box", 0, 0.2, 0, 1], ["cran_egg", 0, 0.15, -0.6, 1],
  ["face.0", 0.058, 0.07, 0.04, 0.11], ["face.1", 0.07, 0.085, 0.05, 0.13], ["face.2", 0.062, 0.072, 0.045, 0.1],
  ["face_box", 0, 0.2, 0, 1],
  ["jaw_w", 0.05, 0.065, 0.03, 0.1], ["jaw_y", -0.065, -0.05, -0.09, -0.03], ["jaw_len", 0.115, 0.135, 0.08, 0.21],
  ["jaw_r", 0.018, 0.026, 0.01, 0.04], ["jaw_square", 0, 0.3, 0, 1.5],
  ["chin_z", 0.065, 0.08, 0.04, 0.11], ["chin_r", 0.022, 0.028, 0.012, 0.045], ["chin_w", 0.9, 1.15, 0.5, 2.2],
  ["cheek.0", 0.043, 0.05, 0.03, 0.07], ["cheek.1", -0.02, -0.005, -0.04, 0.01], ["cheek.2", 0.06, 0.07, 0.045, 0.085], ["cheek.3", 0.017, 0.026, 0.008, 0.04],
  ["hollow", 0, 0.004, 0, 0.014],
  ["brow.0", 0.038, 0.046, 0.025, 0.06], ["brow.1", 0.03, 0.04, 0.02, 0.055], ["brow.2", 0.078, 0.085, 0.07, 0.095], ["brow.3", 0.009, 0.015, 0.005, 0.024],
  ["brow_hair", 0.5, 1.2, 0, 2.5], ["brow_lift", -0.003, 0.003, -0.008, 0.014], ["brow_tilt", -0.2, 0.2, -0.8, 0.8],
  ["eye_x", 0.03, 0.036, 0.024, 0.045], ["eye_y", 0.008, 0.018, 0, 0.026], ["eye_z", 0.074, 0.082, 0.066, 0.088],
  ["eye_r", 0.011, 0.013, 0.007, 0.018], ["iris", 0.42, 0.55, 0.3, 0.75],
  ["lid_up", -0.1, 0.3, -0.5, 0.75], ["lid_lo", -0.65, -0.35, -0.85, 0], ["lid_tilt", -0.25, 0.25, -0.7, 0.7], ["eye_bag", 0, 0.002, 0, 0.007],
  ["nose_bridge.0", 0.015, 0.03, 0, 0.045], ["nose_bridge.1", 0.085, 0.095, 0.075, 0.105],
  ["nose_tip.0", -0.045, -0.03, -0.07, -0.015], ["nose_tip.1", 0.11, 0.125, 0.098, 0.165],
  ["nose_r.0", 0.007, 0.01, 0.004, 0.016], ["nose_r.1", 0.009, 0.014, 0.005, 0.024],
  ["hook", 0, 0.004, -0.004, 0.02], ["nose_wing", 0.01, 0.014, 0.006, 0.024], ["wing_r", 0.008, 0.011, 0.005, 0.017],
  ["mouth_y", -0.075, -0.06, -0.125, -0.045], ["mouth_z", 0.082, 0.092, 0.07, 0.1], ["mouth_w", 0.02, 0.028, 0.01, 0.06],
  ["lip_t", 0.004, 0.007, 0.002, 0.01], ["lip_full", 0.8, 1.2, 0.3, 1.8], ["smile", -0.4, 0.4, -1.2, 2.0],
  ["muzzle", 0, 0.004, -0.008, 0.014], ["nasolabial", 0, 0.002, 0, 0.006], ["toothless", 0, 0, 0, 1],
  ["ear.0", 0.023, 0.03, 0, 0.042], ["ear.1", -0.003, 0.003, -0.01, 0.012], ["ear_out", 5, 20, 0, 50],
  ["jowl", 0, 0.012, 0, 0.03], ["dbl_chin", 0, 0.008, 0, 0.025],
  ["neck_len", 0.1, 0.16, 0, 0.26], ["neck_r", 0.04, 0.055, 0.03, 0.075], ["adam", 0, 0.006, 0, 0.018],
];
export const KEYS = Object.fromEntries(K.map(([k, nl, nh, sl, sh]) => [k, { natural: [nl, nh], slider: [sl, sh] }]));
export const SCULPT_DEFAULT = { cran_box: 0, cran_egg: 0, face_box: 0, jaw_square: 0, chin_w: 1, hollow: 0, brow_hair: 1, brow_lift: 0, brow_tilt: 0, eye_bag: 0, muzzle: 0, nasolabial: 0, toothless: 0, ear_out: 12, dbl_chin: 0, adam: 0 };
export const DEFAULTS = { ...HEAD_DEFAULT, ...SCULPT_DEFAULT };

const get = (rec, key) => { const [k, i] = key.split("."); const v = rec[k] ?? DEFAULTS[k]; return i == null ? v : v?.[+i]; };
// Errors: unknown keys, values outside the slider range. Neck and collar must be given (a head
// without its collar is not a valid sheet).
export function validateHead(sheet) {
  const err = [], h = sheet.head || {};
  for (const k of Object.keys(h)) if (!(k in DEFAULTS) && !["nose_hump", "gaze"].includes(k)) err.push(`unknown key ${k}`);
  for (const [key, { slider: [lo, hi] }] of Object.entries(KEYS)) { const v = get(h, key); if (typeof v !== "number" || !(v >= lo - 1e-9 && v <= hi + 1e-9)) err.push(`${key}=${v} outside the slider ${lo}..${hi}`); }
  if (!sheet.neck || typeof sheet.neck.visible_m !== "number") err.push("no neck record (neck.visible_m)");
  if (!sheet.collar || !sheet.collar.kind) err.push("no collar record (collar.kind)");
  if (!sheet.idea) err.push("no idea (one idea per head, ART-DIRECTION 4 rule 2)");
  return err;
}
export function pastNatural(h) {
  const out = [];
  for (const [key, { natural: [lo, hi] }] of Object.entries(KEYS)) { const v = get(h, key); if (v < lo - 1e-9 || v > hi + 1e-9) out.push(key); }
  return out;
}
