// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// wallpaper.mjs: a front end that reads which plane symmetry group an image has (the crystallography fixture).
//   1. lattice    autocorrelation peaks over shifts; the two shortest independent strong peaks are a and b. None
//                 strong: no lattice (then a five-fold rotation about the centre is tested: quasiperiodic)
//   2. operations each candidate linear part (rotations by 180, 120, 90, 60 degrees; reflections across the
//                 directions of a, b, a + b, a - b and their normals) is scored by the best correlation of f(x) with
//                 f(R x + t) over translations t in one cell
//   3. mirror or glide  a reflection holds as a mirror if it works with no shift along its axis, as a glide if it needs
//                 half a lattice period along the axis
//   4. the group  from the rotation order and the reflection pattern (the standard decision table)
// Scores are correlations; the threshold is `tau`. It reads the arrangement only, so it is an isomer readout.
const corrAt = (f, w, h, M, t, pts) => { let sa = 0, sb = 0, sab = 0, saa = 0, sbb = 0, n = 0; for (const [x, y, v] of pts) { const X = M[0] * x + M[1] * y + t[0], Y = M[2] * x + M[3] * y + t[1]; if (X < 0 || Y < 0 || X >= w - 1 || Y >= h - 1) continue; const i = X | 0, j = Y | 0, a = X - i, b = Y - j, k = j * w + i, u = (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + w] * (1 - a) + f[k + w + 1] * a) * b; sa += v; sb += u; sab += v * u; saa += v * v; sbb += u * u; n++; } if (n < 50) return -1; const ca = saa - sa * sa / n, cb = sbb - sb * sb / n; return (sab - sa * sb / n) / Math.sqrt(Math.max(1e-12, ca * cb)); };

export function lattice(f, w, h, { maxShift = Math.floor(Math.min(w, h) * 0.42), step = 2, minPeak = 0.8 } = {}) {
  const pts = []; for (let y = Math.floor(h / 4); y < 3 * h / 4; y += step) for (let x = Math.floor(w / 4); x < 3 * w / 4; x += step) pts.push([x, y, f[y * w + x]]);
  const C = new Map(), key = (dx, dy) => `${dx},${dy}`;
  for (let dy = 0; dy <= maxShift; dy++) for (let dx = -maxShift; dx <= maxShift; dx++) { if (dy === 0 && dx <= 0) continue; if (dx * dx + dy * dy < 9) continue; C.set(key(dx, dy), corrAt(f, w, h, [1, 0, 0, 1], [dx, dy], pts)); }
  const peaks = []; for (const [k, v] of C) { if (v < 0.35) continue; const [dx, dy] = k.split(',').map(Number); let top = true; for (let a = -1; a <= 1 && top; a++) for (let b = -1; b <= 1; b++) { if (!a && !b) continue; const u = C.get(key(dx + a, dy + b)); if (u !== undefined && u > v) { top = false; break; } } if (top) { // sub-pixel refinement: a rotated lattice's vectors fall between integer shifts
      let bv = [dx, dy], bc = v; for (let a = -0.5; a <= 0.5; a += 0.1) for (let b = -0.5; b <= 0.5; b += 0.1) { const c = corrAt(f, w, h, [1, 0, 0, 1], [dx + a, dy + b], pts); if (c > bc) { bc = c; bv = [dx + a, dy + b]; } }
      if (bc >= minPeak) peaks.push({ v: bv, c: bc, len: Math.hypot(...bv) }); } }
  peaks.sort((p, q) => p.len - q.len);
  const A = peaks[0]; if (!A) return null;
  const B = peaks.find(p => Math.abs(A.v[0] * p.v[1] - A.v[1] * p.v[0]) > 0.5 * A.len * p.len); if (!B) return null;
  // a lattice repeats: the correlation must hold at 2a, a + b and 2b as well (a quasiperiodic pattern has near-periods
  // that fade at multiples; this is what separates it from a wallpaper group)
  const at = v => corrAt(f, w, h, [1, 0, 0, 1], v, pts), checks = [[2 * A.v[0], 2 * A.v[1]], [A.v[0] + B.v[0], A.v[1] + B.v[1]], [2 * B.v[0], 2 * B.v[1]]].map(at);
  if (checks.some(c => c < minPeak)) return null;
  return { a: A.v, b: B.v, ca: A.c, cb: B.c, pts, checks };
}

const rot = d => { const r = d * Math.PI / 180; return [Math.cos(r), -Math.sin(r), Math.sin(r), Math.cos(r)]; };
const refl = th => [Math.cos(2 * th), Math.sin(2 * th), Math.sin(2 * th), -Math.cos(2 * th)];
function bestOver(f, w, h, M, L, pts, grid = 20) { let best = -1, bt = null; for (let s = 0; s < grid; s++) for (let r = 0; r < grid; r++) { const t0 = [s / grid * L.a[0] + r / grid * L.b[0], s / grid * L.a[1] + r / grid * L.b[1]], cx = w / 2, cy = h / 2, t = [t0[0] + cx - (M[0] * cx + M[1] * cy), t0[1] + cy - (M[2] * cx + M[3] * cy)], c = corrAt(f, w, h, M, t, pts); if (c > best) { best = c; bt = t; } } return { c: best, t: bt }; }

export function classify(f, w, h, { tau = 0.86, tauRefl = 0.8 } = {}) {
  const L = lattice(f, w, h);
  if (!L) {
    const pts = []; for (let y = Math.floor(h / 4); y < 3 * h / 4; y += 2) for (let x = Math.floor(w / 4); x < 3 * w / 4; x += 2) pts.push([x, y, f[y * w + x]]);
    const cx = w / 2, cy = h / 2, R5 = rot(72), five = corrAt(f, w, h, R5, [cx - (R5[0] * cx + R5[1] * cy), cy - (R5[2] * cx + R5[3] * cy)], pts);
    return { group: five > 0.6 ? 'aperiodic (five-fold)' : 'no group', lattice: null, fiveFold: +five.toFixed(3) };
  }
  const pts = L.pts, rots = { 2: bestOver(f, w, h, rot(180), L, pts), 3: bestOver(f, w, h, rot(120), L, pts), 4: bestOver(f, w, h, rot(90), L, pts), 6: bestOver(f, w, h, rot(60), L, pts) };
  const n = rots[6].c > tau && rots[3].c > tau ? 6 : rots[4].c > tau ? 4 : rots[3].c > tau ? 3 : rots[2].c > tau ? 2 : 1;
  // reflection axes: directions of lattice vectors and their normals
  const dirs = [L.a, L.b, [L.a[0] + L.b[0], L.a[1] + L.b[1]], [L.a[0] - L.b[0], L.a[1] - L.b[1]]], axes = [];
  dirs.forEach((v, di) => { const th = Math.atan2(v[1], v[0]); for (const t of [th, th + Math.PI / 2]) { const tt = ((t % Math.PI) + Math.PI) % Math.PI; if (!axes.some(a => Math.abs(a.th - tt) < 0.05 || Math.abs(Math.abs(a.th - tt) - Math.PI) < 0.05)) axes.push({ th: tt, lattice: t === th, side: di < 2 }); } });
  const lat = (th) => { // the shortest lattice vector along direction th (within 3 cells)
    let best = null; for (let m = -3; m <= 3; m++) for (let q = -3; q <= 3; q++) { if (!m && !q) continue; const v = [m * L.a[0] + q * L.b[0], m * L.a[1] + q * L.b[1]], len = Math.hypot(...v); if (Math.abs(Math.sin(Math.atan2(v[1], v[0]) - th)) < 0.03 && (!best || len < best)) best = len; } return best; };
  const refls = axes.map(ax => {
    const M = refl(ax.th), e = [Math.cos(ax.th), Math.sin(ax.th)], en = [-e[1], e[0]], Le = lat(ax.th), cx = w / 2, cy = h / 2; if (!Le) return { ...ax, mirror: false, glide: false };
    let m0 = -1, mh = -1; const span = Math.hypot(...L.a) + Math.hypot(...L.b);
    const score = (u, v) => corrAt(f, w, h, M, [u * en[0] + v * e[0] + cx - (M[0] * cx + M[1] * cy), u * en[1] + v * e[1] + cy - (M[2] * cx + M[3] * cy)], pts);
    for (const [v, set] of [[0, 0], [Le / 2, 1]]) { let bu = 0, bc = -1; for (let s = 0; s < 120; s++) { const u = (s / 120) * span, c = score(u, v); if (c > bc) { bc = c; bu = u; } } for (let d = -1; d <= 1; d += 0.1) bc = Math.max(bc, score(bu + d * span / 120, v)); if (set === 0) m0 = bc; else mh = bc; }
    return { ...ax, mirror: m0 > tauRefl, glide: mh > tauRefl, m0: +m0.toFixed(3), mh: +mh.toFixed(3) };
  });
  const sym = refls.filter(r => r.mirror || r.glide), mirrorAxes = sym.filter(r => r.mirror), glideOnly = sym.filter(r => !r.mirror && r.glide);
  let group;
  if (n === 1) group = !sym.length ? 'p1' : mirrorAxes.length ? (mirrorAxes.some(r => r.glide) ? 'cm' : 'pm') : 'pg';
  else if (n === 2) group = !sym.length ? 'p2' : glideOnly.length === 0 ? (mirrorAxes.some(r => r.glide) ? 'cmm' : 'pmm') : mirrorAxes.length ? 'pmg' : 'pgg';
  else if (n === 4) group = !sym.length ? 'p4' : mirrorAxes.some(r => r.side) ? 'p4m' : 'p4g';   // p4m: mirrors along the square's sides
  else if (n === 3) group = !sym.length ? 'p3' : mirrorAxes.some(r => r.lattice) ? 'p31m' : 'p3m1';
  else group = !sym.length ? 'p6' : 'p6m';
  return { group, lattice: { a: L.a, b: L.b }, rotations: Object.fromEntries(Object.entries(rots).map(([k, v]) => [k, +v.c.toFixed(3)])), reflections: refls.map(r => ({ deg: +(r.th * 180 / Math.PI).toFixed(1), lattice: r.lattice, mirror: r.mirror, glide: r.glide, m0: r.m0, mh: r.mh })) };
}
