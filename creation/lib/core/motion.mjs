// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// motion.mjs: motion broken down to first principles, then to its metamers (BLEED section 25; CORE.md "motion:
// properties changing under laws").
// The motion IR: a motion layer stores kinematics as ticks (position, velocity, acceleration samples), its dynamics
// law (a named shape with weights: linear, ease-in-out, spring, critical damping) and its timing layer.
// The keyframe readout is (start, end, duration). Two motions with one readout and different velocity profiles are
// motion metamers. Light changes that split them: sampling mid-flight, slowing time (the profile stretched against
// a fixed-rate observer), a collision with a second body at a fixed moment (momentum transferred), and reversing
// time (the reverse of an ease-in is an ease-out: the profile is handed, an enantiomer in time).
// Control: a keyframe engine (it stores only the readout and interpolates linearly) cannot tell them apart.
export const LAWS = {
  linear: t => t,
  easeInOut: t => t * t * (3 - 2 * t),
  easeIn: t => t * t * t,
  spring: (t, { zeta = 0.35, omega = 14 } = {}) => { const wd = omega * Math.sqrt(1 - zeta * zeta); return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t)); },
  critical: (t, { omega = 9 } = {}) => 1 - Math.exp(-omega * t) * (1 + omega * t),
};

// sample a motion: position x(t) = x0 + (x1 - x0) * law(t / T) with the end pinned (the readout), as ticks
export function motionLayer(law, { x0 = 0, x1 = 1, T = 1, n = 61, params = {} } = {}) {
  const f = LAWS[law], end = f(1, params), pos = Array.from({ length: n }, (_, i) => { const u = i / (n - 1); return x0 + (x1 - x0) * (u === 1 ? 1 : f(u, params) / (law === 'spring' || law === 'critical' ? end : 1)); });
  const dt = T / (n - 1), vel = pos.map((p, i) => (i === 0 ? (pos[1] - p) / dt : i === n - 1 ? (p - pos[i - 1]) / dt : (pos[i + 1] - pos[i - 1]) / (2 * dt))), acc = vel.map((v, i) => (i === 0 ? (vel[1] - v) / dt : i === n - 1 ? (v - vel[i - 1]) / dt : (vel[i + 1] - vel[i - 1]) / (2 * dt)));
  return { law: { shape: law, params }, readout: { start: pos[0], end: pos[n - 1], duration: T }, ticks: { pos, vel, acc, dt }, timing: { curve: law, span: T } };
}
const keyframe = M => motionLayer('linear', { x0: M.readout.start, x1: M.readout.end, T: M.readout.duration, n: M.ticks.pos.length });
const at = (M, u) => { const p = M.ticks.pos, x = u * (p.length - 1), i = Math.min(p.length - 2, Math.floor(x)), f = x - i; return p[i] * (1 - f) + p[i + 1] * f; };
const vAt = (M, u) => { const v = M.ticks.vel, i = Math.round(u * (v.length - 1)); return v[i]; };

export function motionMetamerTest(a = 'linear', b = 'easeInOut', opts = {}) {
  const A = motionLayer(a, opts), B = motionLayer(b, opts), split = (P, Q) => ({
    readout: Math.abs(P.readout.start - Q.readout.start) + Math.abs(P.readout.end - Q.readout.end) + Math.abs(P.readout.duration - Q.readout.duration),
    midFlight: Math.abs(at(P, 0.5 * 0.6) - at(Q, 0.5 * 0.6)),                               // a sample taken at 30% of the flight
    slowTime: Math.max(...Array.from({ length: 21 }, (_, i) => Math.abs(at(P, i / 20) - at(Q, i / 20)))),  // the whole path seen at 1/20 steps
    collision: Math.abs(vAt(P, 0.25) - vAt(Q, 0.25)),                                        // momentum handed to a unit mass struck at 25%
    reverse: Math.abs(at(P, 0.2) - (P.readout.end - at(P, 0.8) + P.readout.start)) + Math.abs(at(Q, 0.2) - (Q.readout.end - at(Q, 0.8) + Q.readout.start)),  // asymmetry of each in time
  });
  const real = split(A, B), control = split(keyframe(A), keyframe(B));
  const lightChanges = ['midFlight', 'slowTime', 'collision'], splitAny = lightChanges.some(k => real[k] > 0.02);
  return { pair: [a, b], real, control, pass: real.readout < 1e-9 && splitAny && lightChanges.every(k => control[k] < 1e-9) };
}
