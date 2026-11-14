// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// floaters.mjs: the "squigglies". Muscae volitantes are clumps of collagen fibres and cells in the vitreous gel. They
// float in front of the retina and cast shadows on it, so they are seen as transparent strings, beads on a string and
// dots, and only against bright, even light: a lit sky, a blurred streetlight. They sit on the retina's map of the
// world, so they move with the gaze; the gel is viscoelastic, so after each eye movement they lag, swing past and
// settle, and between movements they sink slowly.
//
// Shadow contrast depends on the pupil: a wide pupil lights the floater from a wide cone and blurs its shadow; a
// squint narrows the cone, so the shadow sharpens and darkens. Contrast here scales as reference pupil over
// effective aperture (a geometric-optics penumbra argument; the scale constant is authored).
// A floater is a refracting strand as well as an absorber: its edges darken and its axis can show a faint bright line.
//
//   createFloaters(rng, w, h, { strings, dots })   shapes in pixels, relative to the gaze point
//   stepFloaters(S, dt, gaze)                       damped spring toward the gaze, plus a slow sink
//   applyFloaters(F, S, { contrast })              multiplies the frame by each floater's shadow profile
export function createFloaters(rng, w, h, { strings = 3, dots = 5 } = {}) {
  const items = [];
  for (let i = 0; i < strings; i++) {
    const n = 5 + ((rng() * 3) | 0), pts = [], len = (0.08 + rng() * 0.12) * w;
    let x = 0, y = 0, a = rng() * Math.PI * 2;
    for (let k = 0; k < n; k++) { pts.push([x, y]); a += (rng() - 0.5) * 1.6; x += Math.cos(a) * len / n; y += Math.sin(a) * len / n; }
    const beads = Array.from({ length: 1 + ((rng() * 3) | 0) }, () => rng());
    items.push({ kind: 'string', pts, width: 1.2 + rng() * 1.3, beads, home: [(rng() - 0.5) * w * 0.8, (rng() - 0.5) * h * 0.8] });
  }
  for (let i = 0; i < dots; i++) items.push({ kind: 'dot', r: 0.8 + rng() * 1.6, home: [(rng() - 0.5) * w * 0.9, (rng() - 0.5) * h * 0.9] });
  for (const it of items) { it.pos = [...it.home]; it.vel = [0, 0]; it.k = 6 + rng() * 6; it.z = 0.6 + rng() * 0.5; }
  return { w, h, items, gaze: [w / 2, h / 2] };
}

// gaze: the screen point the eye looks at. Each floater is a damped spring (natural frequency sqrt(k), damping ratio
// about 0.35, so it overshoots once) pulled toward gaze + home, sinking at a few pixels a second.
export function stepFloaters(S, dt, gaze) {
  const steps = Math.max(1, Math.ceil(dt / 0.01)), h = dt / steps;
  for (let s = 0; s < steps; s++) for (const it of S.items) {
    const tx = gaze[0] + it.home[0], ty = gaze[1] + it.home[1], om = Math.sqrt(it.k), c = 2 * 0.35 * om;
    for (let a = 0; a < 2; a++) { const target = a ? ty : tx, acc = -it.k * (it.pos[a] - target) - c * it.vel[a] + (a ? 2.5 * it.z : 0); it.vel[a] += acc * h; }
    it.pos[0] += it.vel[0] * h; it.pos[1] += it.vel[1] * h;
  }
  for (const it of S.items) { it.home[1] += 0.6 * dt * it.z; if (it.home[1] > S.h * 0.55) it.home[1] -= S.h * 1.1; }
  S.gaze = gaze; return S;
}

// shadow profile across a strand at distance d from its axis, half-width r: dark edges, faint bright core
const profile = (d, r) => { const u = d / r; if (u >= 1.4) return 0; if (u > 1) return -0.25 * (1.4 - u) / 0.4; return u < 0.35 ? -0.15 : -0.85 - 0.15 * (1 - u); };

export function applyFloaters(F, S, { contrast = 0.22 } = {}) {
  const M = new Float32Array(F.w * F.h);
  for (const it of S.items) {
    const ox = it.pos[0], oy = it.pos[1];
    if (it.kind === 'dot') stamp(M, F.w, F.h, ox, oy, it.r, (x, y) => Math.hypot(x - ox, y - oy));
    else for (let k = 0; k + 1 < it.pts.length; k++) {
      const [ax, ay] = it.pts[k], [bx, by] = it.pts[k + 1], A = [ax + ox, ay + oy], B = [bx + ox, by + oy];
      stampSeg(M, F.w, F.h, A, B, it.width / 2);
    }
    if (it.kind === 'string') for (const b of it.beads) { const p = along(it.pts, b); stamp(M, F.w, F.h, p[0] + ox, p[1] + oy, it.width * 0.9, (x, y) => Math.hypot(x - p[0] - ox, y - p[1] - oy)); }
  }
  for (let i = 0; i < M.length; i++) if (M[i]) { const f = Math.max(0.2, 1 + contrast * M[i]); F.d[3 * i] *= f; F.d[3 * i + 1] *= f; F.d[3 * i + 2] *= f; }
  return F;
}
const stamp = (M, w, h, cx, cy, r, dist) => stampBox(M, w, h, [cx - 1.4 * r, cy - 1.4 * r, cx + 1.4 * r, cy + 1.4 * r], dist, r);
function stampSeg(M, w, h, A, B, r) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1;
  const box = [Math.min(A[0], B[0]) - 2 * r, Math.min(A[1], B[1]) - 2 * r, Math.max(A[0], B[0]) + 2 * r, Math.max(A[1], B[1]) + 2 * r];
  stampBox(M, w, h, box, (x, y) => { const t = Math.max(0, Math.min(1, ((x - A[0]) * dx + (y - A[1]) * dy) / L2)); return Math.hypot(x - A[0] - t * dx, y - A[1] - t * dy); }, r);
}
function stampBox(M, w, h, [x0, y0, x1, y1], dist, r) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const v = profile(dist(x + 0.5, y + 0.5), r), i = y * w + x; if (v < M[i] || (v > 0 && !M[i])) M[i] = v;
  }
}
function along(pts, t) { const s = t * (pts.length - 1), k = Math.min(pts.length - 2, Math.floor(s)), f = s - k; return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f]; }
