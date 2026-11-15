// Props that sit on a sculpted face: a pipe in the mouth, spectacles on the eyes. Separate from the
// cast files, which export only cast members (the fight drawer and the roster read every export).
import { prop, propBlob, J } from "./parts.mjs";
// Face anchors from the sculpted head (forge/heads.mjs M.headAnchors), relative to the head joint, so a
// pipe sits in the mouth and spectacles on the eyes whatever the head's shape; the old offsets otherwise.
export const rel = (M, B, key, fallback) => { const hj = J(B, "head"), a = M.headAnchors?.[key]; return a ? [a[0] - hj[0], a[1] - hj[1], a[2] - hj[2]] : fallback; };
export const pipeAt = (M, B, R, mat, r = 0.006) => { const q = rel(M, B, "mouthR", [0.03, R * 0.42, R * 1.0]); prop(M, B, "head", [[q[0], q[1], q[2], r], [q[0] + 0.035, q[1] - 0.015, q[2] + 0.07, r]], mat, { seg: 6 }); propBlob(M, B, "head", [q[0] + 0.04, q[1] - 0.005, q[2] + 0.075], [0.014, 0.02, 0.014], mat, { rings: 4, seg: 8 }); };
export const specsOn = (M, B, R, mat) => { const e = rel(M, B, "eyes", [0, R * 1.03, R * 0.93]), dx = M.headAnchors?.eyeX ?? R * 0.33; for (const x of [-1, 1]) propBlob(M, B, "head", [e[0] + x * dx, e[1], e[2] + 0.006], [Math.max(0.017, dx * 0.55), Math.max(0.014, dx * 0.45), 0.004], mat, { rings: 4, seg: 10 }); };

