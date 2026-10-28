// knee.mjs: the knee as four inextensible cords plus an authored screw-home path, and the hip as a turn limit.
// Frame (right leg, millimetres): origin at the femoral condyle centre on the flexion axis; +x lateral, +y anterior,
// +z up. Flexion swings the tibia back about x. Axial turn is about the tibia's long axis (its local z).
// Geometry first: each femoral attachment is placed opposite its tibial attachment across the flexion axis in the
// side view (collinear rule), so every cord is at its longest at full extension and slackens as the knee bends.
// The inclined cords then block axial turn both ways at extension: the lock is a consequence, not a rule.
// Authored, labelled: attachment coordinates (near textbook positions), the eccentricities E_MM (collaterals 4.5 mm,
// cruciates 2 mm, tuned so the 90 degree range lands near 40 degrees total, outward larger than inward),
// screw-home 10 degrees over the last 30 (moderate confidence),
// hip turn limits 35 in (intake A 23) and 45 out (from memory, moderate).
export const SCREW_HOME_DEG = 10, SCREW_HOME_SPAN_DEG = 30, LOCK_GATE_DEG = 2, LOCK_FLEX_DEG = 5;
export const HIP_LIMITS = { inward: 35, outward: 45 }, FLEX_LIMITS = { min: 0, max: 140 };
export const E_MM = { collateral: 4.5, cruciate: 2 };   // cruciates nearer isometric (moderate confidence)

const TIBIAL = {
  mcl: { family: 'collateral', t: [-35, 10, -75], fx: -38 },
  lcl: { family: 'collateral', t: [40, -14, -60], fx: 38 },
  acl: { family: 'cruciate', t: [-2, 14, -22], fx: 14 },
  pcl: { family: 'cruciate', t: [2, -16, -26], fx: -14 },
};

const RAD = Math.PI / 180;
// Femoral point by the collinear rule: the side-view (y, z) position is -E along the tibial point's direction.
function femoral({ t, fx }, e) { const r = Math.hypot(t[1], t[2]); return [fx, -e * t[1] / r, -e * t[2] / r]; }

// laxMm lengthens every cord past its taut length (a lax or torn ligament): the false-accept control.
export function makeCords(e = E_MM, { laxMm = 0 } = {}) {
  return Object.entries(TIBIAL).map(([id, c]) => {
    const f = femoral(c, typeof e === 'number' ? e : e[c.family]), rest = Math.hypot(f[0] - c.t[0], f[1] - c.t[1], f[2] - c.t[2]) + laxMm;
    return { id, family: c.family, f, t: c.t, rest };
  });
}
export const CORDS = makeCords();

// Tibial point in the femur frame after axial turn v (radians, + is about +z: inward for a right leg) then flexion.
function placeTibial([x, y, z], flexRad, v) {
  const cv = Math.cos(v), sv = Math.sin(v), X = x * cv - y * sv, Y = x * sv + y * cv;
  const c = Math.cos(-flexRad), s = Math.sin(-flexRad);
  return [X, Y * c - z * s, Y * s + z * c];
}

// Stretch of each cord beyond rest (mm; positive means the pose is impossible) for flexion and outward turn (deg).
export function cordStretch(flexDeg, outwardDeg, cords = CORDS) {
  return cords.map(c => {
    const p = placeTibial(c.t, flexDeg * RAD, -outwardDeg * RAD);
    return { id: c.id, family: c.family, stretch: Math.hypot(c.f[0] - p[0], c.f[1] - p[1], c.f[2] - p[2]) - c.rest };
  });
}
const worst = (flex, out, cords) => cordStretch(flex, out, cords).reduce((a, b) => (b.stretch > a.stretch ? b : a));

// Edge of the allowed axial turn in one direction (sign +1 outward, -1 inward), by stepping then bisection.
function edge(flexDeg, sign, cords, tol = 1e-12) {
  if (worst(flexDeg, sign * 1e-7, cords).stretch > tol) return { deg: 0, cord: worst(flexDeg, sign * 1e-4, cords).id };
  let lo = 0, hi = 0.5;
  while (hi < 90 && worst(flexDeg, sign * hi, cords).stretch <= tol) { lo = hi; hi *= 1.6; }
  if (hi >= 90) return { deg: 90, cord: null };
  for (let k = 0; k < 60; k++) { const m = (lo + hi) / 2; if (worst(flexDeg, sign * m, cords).stretch <= tol) lo = m; else hi = m; }
  return { deg: lo, cord: worst(flexDeg, sign * hi, cords).id };
}

// Voluntary axial range about the screw-home path at a flexion: degrees outward and inward, and the binding cords.
export function axialRange(flexDeg, cords = CORDS) {
  const o = edge(flexDeg, 1, cords), i = edge(flexDeg, -1, cords);
  return { outward: o.deg, inward: i.deg, outwardCord: o.cord, inwardCord: i.cord, total: o.deg + i.deg };
}

// Screw-home path: outward tibial turn the knee carries at a flexion (authored smoothstep, 10 deg at 0).
export function screwHome(flexDeg) {
  const u = Math.min(1, Math.max(0, flexDeg / SCREW_HOME_SPAN_DEG));
  return SCREW_HOME_DEG * (1 - u * u * (3 - 2 * u));
}

// Foot turn against the kneecap's locked line, for a tibial outward turn `ext` taken about the path (deg).
export const footVsKneecap = (flexDeg, ext = 0) => screwHome(flexDeg) - SCREW_HOME_DEG + ext;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Route a foot-turn request (deg outward against the pelvis forward line) through knee then hip. The knee takes
// what its cords allow about the coupled path; the hip carries the rest within its limits.
export function aimFoot(targetDeg, flexDeg, { cords = CORDS, hip = HIP_LIMITS } = {}) {
  const r = axialRange(flexDeg, cords), coupled = footVsKneecap(flexDeg, 0);
  const ext = clamp(targetDeg - coupled, -r.inward, r.outward);
  const want = targetDeg - coupled - ext, hipDeg = clamp(want, -hip.inward, hip.outward);
  const reached = hipDeg + coupled + ext;
  return { hip: hipDeg, knee: coupled + ext, ext, reached, residual: targetDeg - reached, reachable: Math.abs(targetDeg - reached) < 1e-9 };
}

// Control C1: a plain hinge rig with a free twist channel; every foot turn goes through the shin.
export function aimFootHinge(targetDeg) { return { hip: 0, knee: targetDeg, ext: targetDeg, reached: targetDeg, residual: 0, reachable: true }; }

// Check a rig pose { flex, hip, foot } (deg; foot and hip measured outward against the pelvis forward line).
// Flags: lock (foot turns off the kneecap with the leg straight), cord (axial turn outside the cord range),
// hip and flex (outside their limits). dev is the foot's turn against the kneecap's locked line.
export function checkLeg(pose, { cords = CORDS, hip = HIP_LIMITS } = {}) {
  const dev = pose.foot - pose.hip, ext = dev - footVsKneecap(pose.flex, 0), r = axialRange(pose.flex, cords), flags = [];
  if (pose.flex < LOCK_FLEX_DEG && Math.abs(dev) > LOCK_GATE_DEG) flags.push('lock');
  if (ext > r.outward + 1e-6 || ext < -r.inward - 1e-6) flags.push('cord');
  if (pose.hip > hip.outward || pose.hip < -hip.inward) flags.push('hip');
  if (pose.flex < FLEX_LIMITS.min || pose.flex > FLEX_LIMITS.max) flags.push('flex');
  return { dev, ext, range: r, flags, ok: flags.length === 0 };
}

// Side-view leg for drawing (mm): hip at origin, thigh hanging at hipFlex, shin at hipFlex - knee flexion.
export const LEG_MM = { thigh: 430, shin: 410, foot: 150 };
export function legSide(hipFlexDeg, kneeFlexDeg, L = LEG_MM) {
  const a = hipFlexDeg * RAD, b = (hipFlexDeg - kneeFlexDeg) * RAD;
  const knee = [L.thigh * Math.sin(a), -L.thigh * Math.cos(a)], ankle = [knee[0] + L.shin * Math.sin(b), knee[1] - L.shin * Math.cos(b)];
  const toe = [ankle[0] + L.foot * Math.cos(b), ankle[1] + L.foot * Math.sin(b)];
  return { hip: [0, 0], knee, ankle, toe };
}
