// Small numbers shared by the camera, the controller and the animator. No browser or GPU here:
// every module in play/ runs the same in node, in a page and in any host that can call a module.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
export const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const lerpAngle = (a, b, t) => a + wrap(b - a) * t;
// move x toward target so that half the gap is gone after `half` seconds, whatever the frame rate
export const damp = (x, target, half, dt) => (half <= 0 ? target : target + (x - target) * Math.pow(0.5, dt / half));
export const dampAngle = (x, target, half, dt) => x + wrap(target - x) * (1 - Math.pow(0.5, dt / Math.max(1e-4, half)));
// a critically damped spring on one number: s = [value, velocity]; omega is its stiffness (1/s)
export function spring(s, target, omega, dt) {
  const x = s[0] - target, e = Math.exp(-omega * dt), t = (s[1] + omega * x) * dt;
  s[0] = target + (x + t) * e; s[1] = (s[1] - omega * t) * e;
  return s[0];
}
export const v3 = { add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], scl: (a, s) => [a[0] * s, a[1] * s, a[2] * s], len: (a) => Math.hypot(a[0], a[1], a[2]), lerp: (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] };
// yaw 0 looks north (-z), 90 degrees east; pitch up is positive (walk/mat.mjs)
export const forward = (yaw, pitch = 0) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
export const heading = (dx, dz) => Math.atan2(dx, -dz);
