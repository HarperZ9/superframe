// Pose to skeleton for a built figure: forward kinematics, then the two-handed grip (the left hand
// put on the shaft by IK) when the figure's tool needs it. pose.ik (0..1) fades the grip in and out
// (a clip can let go with the left hand); pose.hide lists parts not drawn (a set-down jar).
import { solve, INDEX, apply } from "./skeleton.mjs";
import { ikArm, ikLeg } from "./ik.mjs";
import { gripAt } from "../cast/tools.mjs";
// locks { L: [x,y,z], R } (character space): planted feet held there by leg IK (runtime foot locking).
export function solveFigure(C, built, pose, locks = null) {
  const S = solve(C.P, pose), T = built.tool, w = pose.ik?.w ?? 1;
  if (locks) for (const s of ["L", "R"]) if (locks[s]) ikLeg(S, s, locks[s].p, locks[s].w ?? 1);
  if (T && T.twoHand != null && w > 0) {
    const h = S[INDEX.handR], g = apply(h.R, gripAt(T.twoHand)), on = [h.p[0] + g[0], h.p[1] + g[1], h.p[2] + g[2]];
    const sh = S[INDEX.armL].p, d = [sh[0] - on[0], sh[1] - on[1], sh[2] - on[2]], l = Math.hypot(...d) || 1;
    ikArm(S, "L", [on[0] + (d[0] / l) * 0.07, on[1] + (d[1] / l) * 0.07, on[2] + (d[2] / l) * 0.07], w);
  }
  return S;
}
// Hidden parts: what the pose hides, and the hand shape not shown. A hand holding something stays a
// fist (built.grips); otherwise the pose's hands [L, R] ("open" or "fist") or the built default.
export function hiddenOf(pose, built = {}) {
  const out = new Set(pose.hide || []);
  for (const s of ["L", "R"]) {
    const held = built.grips?.[s] && !(pose.hide || []).some((h) => (s === "L" ? ["lantern", "case"] : ["tool"]).includes(h));
    const shape = held ? "fist" : pose.hands?.[s === "L" ? 0 : 1] || built.hands?.[s] || "fist";
    out.add(`hand${s}.${shape === "fist" ? "open" : "fist"}`);
  }
  return out;
}
