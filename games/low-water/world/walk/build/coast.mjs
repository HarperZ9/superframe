// The storm coast at ground level: sea stacks as rock, not cones, and the shore round them.
// The reference is B12.371: split, leaning stacks of dark rock, smaller teeth round their feet,
// broken black rock in the foreground, and the sea pulled into white streaks round every rock by
// a long exposure. A stack is a column of rings whose radius is cut by joints and strata; the
// rubble at its foot and the boulders on the nearest shore are the same rule, short and wide.
// Round each rock lies a sheet of surf: streaks of foam that flow round it (built.wgsl, 32).
import { rng } from "../flora/grow.mjs";
import { baseGround, waterAt } from "../data.mjs";

export const owns = (m) => m.kind === "seastack";
const sea = (world, x, z) => { const w = waterAt(world, x, z); return w > -500 ? w : 0; };

// group the stacks into clusters a walk apart; each cluster is one site
export function plans(world) {
  const marks = world.json.marks.filter(owns).map((m) => ({ ...m, wx: (m.x + 0.5) * world.cell, wz: (m.y + 0.5) * world.cell })), out = [];
  for (const m of marks) { const c = out.find((q) => Math.hypot(q.cx - m.wx, q.cz - m.wz) < 2600); if (c) c.marks.push(m); else out.push({ cx: m.wx, cz: m.wz, marks: [m] }); }
  for (const c of out) { c.cx = c.marks.reduce((a, m) => a + m.wx, 0) / c.marks.length; c.cz = c.marks.reduce((a, m) => a + m.wz, 0) / c.marks.length; c.reach = Math.max(...c.marks.map((m) => Math.hypot(m.wx - c.cx, m.wz - c.cz))) + 1400; }
  return out;
}

// A rock: rings up a column, each ring a loop of points whose radius is cut by vertical joints
// (a few deep notches round it), stepped by strata, leaning and narrowing as it rises.
function rock(K, R, x, y0, z, rad, tall, o = {}) {
  const S = o.sides || 22, N = o.rings || 18, lean = [(R() - 0.5) * 0.35, (R() - 0.5) * 0.35], ph = R() * 9, joints = [];
  for (let j = 0; j < 3 + Math.floor(R() * 4); j++) joints.push([R() * 6.283, 0.15 + 0.25 * R(), 0.12 + 0.2 * R()]);
  const split = R() < (o.split ?? 0.5) ? R() * 6.283 : null, P = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, h = y0 + t * tall, stratum = 1 - 0.07 * (Math.floor(t * 7 + ph) % 2), taper = o.squat ? 0.4 + 0.65 * Math.sqrt(Math.max(0, 1 - t * t)) : (1 - 0.55 * t ** 1.4) * (t > 0.85 ? 1 - (t - 0.85) * 4.5 : 1), ring = [];
    for (let k = 0; k <= S; k++) {
      const a = k / S * 6.283;
      let r = rad * taper * stratum * (1 + 0.12 * Math.sin(a * 3 + ph + t * 2) + 0.08 * Math.sin(a * 7 + ph * 2 - t * 5));
      for (const [ja, jw, jd] of joints) { const d = Math.abs(((a - ja + 9.42) % 6.283) - 3.14); if (d < jw) r *= 1 - jd * (1 - d / jw); }
      if (split !== null) { const d = Math.abs(((a - split + 9.42) % 6.283) - 3.14); if (d < 0.25) r *= 0.45 + 0.55 * d / 0.25; }
      r *= 0.9 + 0.2 * R();
      ring.push([x + Math.cos(a) * r + lean[0] * t * tall, h + (i === N ? -0.2 * rad * R() : 0), z + Math.sin(a) * r + lean[1] * t * tall]);
    }
    P.push(ring);
  }
  const top = [x + lean[0] * tall, y0 + tall, z + lean[1] * tall];
  const nrm = (i, k) => { const a = P[Math.min(N, i + 1)][k], b = P[Math.max(0, i - 1)][k], c = P[i][(k + 1) % S], d = P[i][(k - 1 + S) % S], u = [a[0] - b[0], a[1] - b[1], a[2] - b[2]], w = [c[0] - d[0], c[1] - d[1], c[2] - d[2]], n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
  const m = [31, R(), 0, 0];
  for (let i = 0; i < N; i++) for (let k = 0; k < S; k++) for (const [ii, kk] of [[i, k], [i + 1, k], [i + 1, k + 1], [i, k], [i + 1, k + 1], [i, k + 1]]) K.v(P[ii][kk], nrm(ii, kk % S), kk / S * rad * 6.28, P[ii][kk][1], m);
  for (let k = 0; k < S; k++) { K.v(P[N][k], [0, 1, 0], 0, 0, m); K.v(top, [0, 1, 0], 0, 0, m); K.v(P[N][k + 1], [0, 1, 0], 0, 0, m); }
}

// a sheet of surf round a rock: foam flowing past it, thick at the rock and torn into streaks away from it
function surf(K, x, y, z, r0, r1, flow) {
  const S = 28, N = 5;
  for (let i = 0; i < N; i++) for (let k = 0; k < S; k++) {
    const q = (ii, kk) => { const a = kk / S * 6.283, t = ii / N, r = r0 + (r1 - r0) * t, st = 1 + 0.6 * t * Math.max(0, Math.cos(a - flow)); return [x + Math.cos(a) * r * st, y, z + Math.sin(a) * r * st]; };
    const quad = [[i, k], [i + 1, k], [i + 1, k + 1], [i, k], [i + 1, k + 1], [i, k + 1]];
    for (const [ii, kk] of quad) K.v(q(ii, kk), [0, 1, 0], kk / S, ii / N, [32, flow, r0, 0]);
  }
}

export function mesh(world, P, K, O) {
  const R = rng(world.json.seed + 4404 + Math.floor(P.cx)), flow = R() * 6.283;
  for (const m of P.marks) {
    const x = m.wx - O[0], z = m.wz - O[2], w = sea(world, m.wx, m.wz), y0 = Math.min(w, baseGround(world, m.wx, m.wz)) - 6, rad = m.size_m * 0.42;
    // the stack, sometimes two leaning apart, and the teeth round its foot
    rock(K, R, x, y0, z, rad, m.tall_m + 6, { split: 0.6 });
    if (R() < 0.5) { const a = R() * 6.28; rock(K, R, x + Math.cos(a) * rad * 1.5, y0, z + Math.sin(a) * rad * 1.5, rad * 0.6, m.tall_m * (0.5 + 0.3 * R()) + 6); }
    for (let i = 0; i < 14 + Math.floor(R() * 10); i++) { const a = R() * 6.28, d = rad * (1.2 + 6 * R() * R()), rr = 1.5 + 6 * R() * R(); rock(K, R, x + Math.cos(a) * d, y0 + 2, z + Math.sin(a) * d, rr, 1.5 + rr * (0.4 + 0.8 * R()) + (w - y0 - 2), { squat: true, sides: 14, rings: 8 }); surf(K, x + Math.cos(a) * d, w + 0.4, z + Math.sin(a) * d, rr * 0.8, rr * 2.6 + 4, flow); }
    surf(K, x, w + 0.4, z, rad * 0.7, rad * 2.4 + 10, flow);
  }
  // the nearest shore: black rock in the wash, where the land meets the sea within reach of the stacks
  for (let n = 0, tries = 0; n < 40 * P.marks.length && tries < 3000 * P.marks.length; tries++) {
    const m = P.marks[tries % P.marks.length], a = R() * 6.283, d = 120 + R() * 900, wx = m.wx + Math.cos(a) * d, wz = m.wz + Math.sin(a) * d, g = baseGround(world, wx, wz), w = sea(world, wx, wz);
    if (Math.abs(g - w) > 1.6) continue;
    n++;
    for (let i = 0; i < 6; i++) { const bx = wx + (R() - 0.5) * 40, bz = wz + (R() - 0.5) * 40, ww = sea(world, bx, bz), rr = 1.2 + 4 * R() * R(); rock(K, R, bx - O[0], Math.min(ww, baseGround(world, bx, bz)) - 1.5, bz - O[2], rr, rr * (0.8 + 1.0 * R()) + 1.5, { squat: true, sides: 12, rings: 7 }); if (R() < 0.6) surf(K, bx - O[0], ww + 0.4, bz - O[2], rr * 0.9, rr * 3 + 3, flow); }
  }
}
