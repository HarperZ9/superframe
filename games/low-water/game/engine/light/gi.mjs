// Bounce light by radiance cascades on the plate's floor plan (the author's section 11 reference, moderate confidence that
// the clip shows a radiance-cascades-style 2D GI; the method here is written from the published idea, original code).
// The plate's surfaces are laid on a top-down grid (x, z): a cell emits what its surfaces reflect (their direct light times
// their colour), a cell with a wall in it blocks. Cascade 0 has a probe in every cell with 4 rays over a short interval;
// each cascade above has probes twice as far apart, four times the rays, and an interval four times as long. The
// cascades merge from the top down (a ray that reaches its interval's end unblocked takes the light the next cascade sees
// past it), and cascade 0's average is the light arriving in each cell. Per sample that is the bounce: the light off the
// lamp pool that reaches the wall across the street, the stove's glow carried round the kitchen. Precomputed per plate
// state; a debug view draws the field.
//   bounceField(F, M, { albedo, cell = 0.15, levels = 4 }) -> { g (grid), fluence (Float32 rgb per cell), bounce (Float32 rgb per sample) }
//   albedoFrom(plateRgba, W, H, F, Ebake) -> Float32 rgb per sample (the plate's colour over the light it was baked under)
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

export function albedoFrom(rgba, W, H, F, Ebake) {
  const A = new Float32Array(F.n * 3).fill(0.3), sx = W / F.w, sy = H / F.h;
  for (let i = 0; i < F.n; i++) {
    if (!Number.isFinite(F.N[i * 3])) continue; const x = Math.floor((i % F.w) * sx), y = Math.floor(Math.floor(i / F.w) * sy), q = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) A[i * 3 + c] = Math.min(0.9, LIN[rgba[q + c]] / Math.max(0.05, Ebake[i * 3 + c] * 1.6));
  }
  return A;
}
// the light that bounces: what the lamps, fires and sun put on each sample (not the sky's ambient, which is everywhere
// already and would only grey the plan)
export function directLight(F, M, gains = M.gains(0)) {
  const D = new Float32Array(F.n * 3), S = M.sky;
  for (let i = 0; i < F.n; i++) {
    if (!Number.isFinite(F.N[i * 3])) continue;
    for (const [id, e] of [[F.id0[i], F.e0[i]], [F.id1[i], F.e1[i]]]) { if (id === 255) continue; const L = M.lights[id]; for (let k = 0; k < 3; k++) D[i * 3 + k] += L.rgb[k] * e * gains[id]; }
    for (let k = 0; k < 3; k++) D[i * 3 + k] += F.rest[i * 3 + k];
    if (F.sunVis[i] && S.sun.E > 0) { const nl = Math.max(0, F.N[i * 3] * S.sun.dir[0] + F.N[i * 3 + 1] * S.sun.dir[1] + F.N[i * 3 + 2] * S.sun.dir[2]) * S.sun.E; for (let k = 0; k < 3; k++) D[i * 3 + k] += S.sun.rgb[k] * nl; }
  }
  return D;
}
// the floor plan: per cell, the light its surfaces send out (rgb) and whether a wall stands in it
function plan(F, A, cell, Ed) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, gy = Infinity;
  for (let i = 0; i < F.n; i++) { if (!Number.isFinite(F.N[i * 3]) || F.pos[i * 3 + 1] > 500) continue; x0 = Math.min(x0, F.pos[i * 3]); x1 = Math.max(x1, F.pos[i * 3]); z0 = Math.min(z0, F.pos[i * 3 + 2]); z1 = Math.max(z1, F.pos[i * 3 + 2]); gy = Math.min(gy, F.pos[i * 3 + 1]); }
  const w = Math.ceil((x1 - x0) / cell) + 1, h = Math.ceil((z1 - z0) / cell) + 1, emit = new Float32Array(w * h * 3), cnt = new Uint16Array(w * h), wall = new Uint8Array(w * h);
  for (let i = 0; i < F.n; i++) {
    if (!Number.isFinite(F.N[i * 3]) || F.pos[i * 3 + 1] > 500) continue; const cx = Math.floor((F.pos[i * 3] - x0) / cell), cz = Math.floor((F.pos[i * 3 + 2] - z0) / cell), c = cz * w + cx;
    if (F.pos[i * 3 + 1] - gy > 1.0 && Math.abs(F.N[i * 3 + 1]) < 0.3) wall[c] = 1;
    for (let k = 0; k < 3; k++) emit[c * 3 + k] += Ed[i * 3 + k] * A[i * 3 + k]; cnt[c]++;
  }
  for (let c = 0; c < w * h; c++) if (cnt[c]) for (let k = 0; k < 3; k++) emit[c * 3 + k] /= cnt[c];
  return { x0, z0, w, h, cell, emit, wall };
}
// one ray of one cascade: march its interval, add what it passes over (emitters attenuated by distance), stop at a wall
function march(g, px, pz, dx, dz, a, b) {
  const out = [0, 0, 0]; let open = 1;   // distances in cells
  for (let s = a; s < b; s += 1) {
    const x = Math.floor(px + dx * s), z = Math.floor(pz + dz * s); if (x < 0 || z < 0 || x >= g.w || z >= g.h) { open = 1; break; }
    const c = z * g.w + x, f = 1 / (1 + s * 0.15); for (let k = 0; k < 3; k++) out[k] += g.emit[c * 3 + k] * f * 0.25;
    if (g.wall[c]) { open = 0; break; }
  }
  return { rgb: out, open };
}
export function bounceField(F, M, { albedo, cell = null, levels = 4, gains = null } = {}) {
  // cells fine enough for a kitchen, coarser for the wide lens (about 120 across the plate)
  if (!cell) { let x0 = Infinity, x1 = -Infinity; for (let i = 0; i < F.n; i += 11) if (Number.isFinite(F.N[i * 3])) { x0 = Math.min(x0, F.pos[i * 3]); x1 = Math.max(x1, F.pos[i * 3]); } cell = Math.max(0.15, (x1 - x0) / 120); }
  const g = plan(F, albedo, cell, directLight(F, M, gains || M.gains(0))), C = [];
  for (let L = 0; L < levels; L++) {
    const sp = 1 << L, rays = 4 << (2 * L), a = L === 0 ? 0 : 2 * 4 ** (L - 1) * 1, b = 2 * 4 ** L, pw = Math.ceil(g.w / sp), ph = Math.ceil(g.h / sp), R = new Float32Array(pw * ph * rays * 4);
    for (let pz = 0; pz < ph; pz++) for (let px = 0; px < pw; px++) for (let r = 0; r < rays; r++) {
      const ang = ((r + 0.5) / rays) * Math.PI * 2, m = march(g, px * sp + sp / 2, pz * sp + sp / 2, Math.cos(ang), Math.sin(ang), a, b), o = ((pz * pw + px) * rays + r) * 4;
      R[o] = m.rgb[0]; R[o + 1] = m.rgb[1]; R[o + 2] = m.rgb[2]; R[o + 3] = m.open;
    }
    C.push({ sp, rays, pw, ph, R });
  }
  // merge from the top: each open ray of cascade L takes the mean of its 4 child directions in cascade L + 1, at the nearest probe
  for (let L = levels - 2; L >= 0; L--) {
    const A = C[L], B = C[L + 1];
    for (let pz = 0; pz < A.ph; pz++) for (let px = 0; px < A.pw; px++) for (let r = 0; r < A.rays; r++) {
      const o = ((pz * A.pw + px) * A.rays + r) * 4; if (!A.R[o + 3]) continue;
      const qx = Math.min(B.pw - 1, Math.floor(px / 2)), qz = Math.min(B.ph - 1, Math.floor(pz / 2));
      for (let j = 0; j < 4; j++) { const ob = ((qz * B.pw + qx) * B.rays + r * 4 + j) * 4; for (let k = 0; k < 3; k++) A.R[o + k] += B.R[ob + k] * 0.25; }
    }
  }
  const c0 = C[0], fluence = new Float32Array(g.w * g.h * 3);
  for (let c = 0; c < g.w * g.h; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) fluence[c * 3 + k] += c0.R[(c * 4 + r) * 4 + k] / 4;
  const bounce = new Float32Array(F.n * 3);
  for (let i = 0; i < F.n; i++) {
    if (!Number.isFinite(F.N[i * 3])) continue; const cx = Math.floor((F.pos[i * 3] - g.x0) / cell), cz = Math.floor((F.pos[i * 3 + 2] - g.z0) / cell); if (cx < 0 || cz < 0 || cx >= g.w || cz >= g.h) continue;
    const c = cz * g.w + cx; for (let k = 0; k < 3; k++) bounce[i * 3 + k] = fluence[c * 3 + k];
  }
  return { g, fluence, bounce, cascades: C.map((c) => ({ sp: c.sp, rays: c.rays })) };
}
