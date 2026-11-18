// The walker's body on the island: where it stands, how fast it goes, which way it faces. Plain
// state and one step function, so any host (the browser walk, the native engine, a test) moves the
// body the same way.
//   const body = makeBody({ x, z, face }); body.step(dt, intent, place)
//   intent: { move: [x, z] on the map, length 0..1 (the stick or keys, already turned by the camera),
//             run: bool, face: radians | null (first person turns the body with the view) }
//   place:  { ground(x, z), water(x, z) (the surface, or below -500 for none), solids (play/solids.mjs) }
// Speeds are a walk and a run in a long coat. Slopes slow the body by Tobler's hiking rule (the
// same rule the roads were laid with); water above the knee slows it to a wade and water above
// the chest turns it back. Walls and trunks push it out; it never stands inside a house.
import { clamp, damp, dampAngle, wrap, heading } from "./math.mjs";

export const BODY = { radius: 0.32, height: 1.86, walk: 1.45, run: 4.6, wadeFrom: 0.28, wadeFull: 0.85, tooDeep: 1.3, steepest: 0.9 };

export function makeBody({ x = 0, z = 0, face = 0, y = 0 } = {}) {
  const st = { x, y, z, face, vx: 0, vz: 0, speed: 0, want: 0, grade: 0, wade: 0, depth: 0, turnRate: 0, moved: 0, blocked: false, ax: 0, az: 0 };
  // Tobler: 6 exp(-3.5 |grade + 0.05|) km/h, as a share of the flat-ground speed
  const tobler = (g) => Math.max(0.35, Math.exp(-3.5 * Math.abs(g + 0.05)) / Math.exp(-3.5 * 0.05));   // a stair or a bank is climbed slowly, never at a crawl
  function step(dt, intent, place) {
    if (!(dt > 0)) return st;
    const mv = intent.move || [0, 0], amt = clamp(Math.hypot(mv[0], mv[1]), 0, 1), dir = amt > 1e-3 ? [mv[0] / amt, mv[1] / amt] : [Math.sin(st.face), -Math.cos(st.face)];
    const g0 = place.ground(st.x, st.z);
    // the grade along the way the body wants to go, over a stride
    const grade = (place.ground(st.x + dir[0] * 0.8, st.z + dir[1] * 0.8) - g0) / 0.8;
    const surface = place.water ? place.water(st.x, st.z) : -1e9, depth = surface > -500 ? Math.max(0, surface - g0) : 0;
    const wade = clamp((depth - BODY.wadeFrom) / (BODY.wadeFull - BODY.wadeFrom), 0, 1);
    let top = (intent.run ? BODY.run : BODY.walk) * amt * tobler(clamp(grade, -1.2, 1.2)) * (1 - 0.6 * wade);
    if (wade > 0) top = Math.min(top, 1.1);
    const vx0 = st.vx, vz0 = st.vz, tx = dir[0] * top, tz = dir[1] * top;
    // pick up speed over about a quarter second, lose it a little faster
    const half = top > st.speed ? 0.11 : 0.08;
    st.vx = damp(st.vx, tx, half, dt); st.vz = damp(st.vz, tz, half, dt);
    let nx = st.x + st.vx * dt, nz = st.z + st.vz * dt;
    // ground too steep to climb, and water too deep to wade, turn the body back as a wall does
    const g1 = place.ground(nx, nz), w1 = place.water ? place.water(nx, nz) : -1e9, d1 = w1 > -500 ? Math.max(0, w1 - g1) : 0, rise = (g1 - g0) / Math.max(1e-3, Math.hypot(nx - st.x, nz - st.z));
    st.blocked = false;
    if ((rise > BODY.steepest && g1 > g0) || (d1 > BODY.tooDeep && d1 > depth)) { nx = st.x; nz = st.z; st.vx *= 0.2; st.vz *= 0.2; st.blocked = true; }
    if (place.solids) {
      const yb = place.ground(nx, nz), [px, pz, hit] = place.solids.pushOut(nx, nz, BODY.radius, yb + 0.25, yb + BODY.height);
      if (hit) { st.blocked = true; nx = px; nz = pz; }
    }
    const mx = nx - st.x, mz = nz - st.z;
    st.moved = Math.hypot(mx, mz); st.x = nx; st.z = nz;
    // the speed the body really made, after walls: the animation's feet follow this, not the wish
    const vx = mx / dt, vz = mz / dt;
    st.ax = (vx - vx0) / dt; st.az = (vz - vz0) / dt;
    st.vx = vx; st.vz = vz; st.speed = Math.hypot(vx, vz); st.want = top;
    const gy = place.ground(st.x, st.z);
    // small steps in the ground are taken by the knees, not the camera: the body's height eases
    st.y = Math.abs(gy - st.y) > 1.5 ? gy : damp(st.y, gy, 0.045, dt);
    st.grade = grade; st.depth = depth; st.wade = wade;
    // facing: toward where the body goes, quicker at a walk than a run; or as the view says
    const f0 = st.face;
    if (intent.face != null) st.face = intent.face;
    else if (amt > 0.05 && st.speed > 0.05) st.face = dampAngle(st.face, heading(st.vx, st.vz), st.speed > 3 ? 0.09 : 0.06, dt);
    else if (amt > 0.05) st.face = dampAngle(st.face, heading(dir[0], dir[1]), 0.1, dt);
    st.turnRate = wrap(st.face - f0) / dt;
    return st;
  }
  function place(x, z, y, face) { Object.assign(st, { x, z, y, vx: 0, vz: 0, speed: 0 }); if (face != null) st.face = face; }
  return { state: st, step, place };
}
