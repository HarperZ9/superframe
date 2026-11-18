// A walk along a line of points, as stick input: for captures and checks, so a scripted walk goes
// through the same body, animation and camera as a player's. pts: [[x, z], ...] metres.
import { heading } from "./math.mjs";

export function makeAutopilot(pts, { run = false, pace = 1, ahead = 2.5 } = {}) {
  let i = 0, done = false;
  function step(body) {
    if (done) return { move: [0, 0], run: false };
    // the first point more than `ahead` metres away from the body is the one to walk toward
    while (i < pts.length - 1 && Math.hypot(pts[i][0] - body.x, pts[i][1] - body.z) < ahead) i++;
    const p = pts[i], dx = p[0] - body.x, dz = p[1] - body.z, l = Math.hypot(dx, dz);
    if (i === pts.length - 1 && l < 0.6) { done = true; return { move: [0, 0], run: false }; }
    return { move: [dx / (l || 1) * pace, dz / (l || 1) * pace], run, face: null };
  }
  return { step, get done() { return done; }, get index() { return i; }, heading: () => heading(pts[Math.min(i + 1, pts.length - 1)][0] - pts[i][0], pts[Math.min(i + 1, pts.length - 1)][1] - pts[i][1]) };
}
