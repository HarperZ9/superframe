// Proportion rules for head sheets (2026-10-21, after the review of R2: eyes lost in sockets, stalk
// necks, lumps). A sheet must sit inside human ranges unless it names the exaggeration and its reason
// in sheet.exaggerate = { rule: "reason" }. Written before the R3 stimuli (PROTOCOL amendment 2).
//   checkRules(sheet, body?) -> { errors: [...], waived: [...] }   body: { visibleNeck } from forge/heads.mjs
import { DEFAULTS } from "./headkeys.mjs";
import { headShapes } from "./headshapes.mjs";

export const RULES = {
  neck_width: { what: "neck radius against jaw half-width", lo: 0.75, hi: 1.15 },
  eye_line: { what: "crown to eye line against crown to chin", lo: 0.36, hi: 0.56 },
  eye_size: { what: "eye radius against head height", lo: 0.042, hi: 0.07 },
  eye_open: { what: "upper lid line above lower lid line (fraction of eye radius)", lo: 0.55, hi: 2 },
  upper_lid: { what: "upper lid line (fraction of eye radius above centre)", lo: -0.1, hi: 1 },
  mouth_width: { what: "mouth half-width against jaw half-width", lo: 0.25, hi: 0.8 },
  lumps: { what: "hollow, eye bag, jowl and double chin under their limits (m)", lo: 0, hi: 1 },
  neck_length: { what: "visible neck against head height", lo: 0, hi: 0.45 },
};

export function measures(sheet) {
  const h = { ...DEFAULTS, ...sheet.head, s: 1 }, { crown, chin } = headShapes(h), H = crown - chin;
  const over = Math.max(h.hollow / 0.007, h.eye_bag / 0.004, h.jowl / 0.024, h.dbl_chin / 0.02);
  return {
    neck_width: h.neck_r / h.jaw_w, eye_line: (crown - h.eye_y) / H, eye_size: h.eye_r / H,
    eye_open: h.lid_up - h.lid_lo, upper_lid: h.lid_up, mouth_width: h.mouth_w / h.jaw_w, lumps: over,
  };
}

export function checkRules(sheet, body = null) {
  const m = measures(sheet), errors = [], waived = [];
  if (body && body.visibleNeck != null) m.neck_length = body.visibleNeck / body.headHeight;
  for (const [k, r] of Object.entries(RULES)) {
    if (m[k] == null) continue;
    if (m[k] >= r.lo - 1e-9 && m[k] <= r.hi + 1e-9) continue;
    const msg = `${k} ${m[k].toFixed(3)} outside ${r.lo} to ${r.hi} (${r.what})`;
    if (sheet.exaggerate?.[k]) waived.push(`${msg}: waived, ${sheet.exaggerate[k]}`); else errors.push(msg);
  }
  return { errors, waived, measures: m };
}
