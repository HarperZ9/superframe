// A small z-buffered triangle rasterizer for skinned figures: writes a G-buffer (material id, world
// normal, bind-space position for object-anchored brushwork, depth, a back-face flag) for one
// figure. Orthographic, in the orientation of a place camera, so sprites sit in the painted plates.
//   const view = spriteView({ yawDeg, elevDeg }, { w, h, height: metres shown, centre: [x, y, z] });
//   const g = rasterize(view, mesh, skinned, { facing: deg, at: [x, 0, z] });
const D2R = Math.PI / 180;
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// The camera basis of an iso view (matches web/shaders/paintover/camera.mjs isoCamera).
export function spriteView({ yawDeg = 36, elevDeg = 26 }, { w, h, height = 2.6, centre = [0, 1.0, 0] }) {
  const y = yawDeg * D2R, e = elevDeg * D2R, fwd = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)];
  const right = norm(cross(fwd, [0, 1, 0])), up = norm(cross(right, fwd));
  return { w, h, fwd, right, up, centre, ppm: h / height };   // pixels per metre
}
// World point to [x, y, depth] pixels.
export const toScreen = (V, p) => {
  const r = [p[0] - V.centre[0], p[1] - V.centre[1], p[2] - V.centre[2]];
  return [V.w / 2 + (r[0] * V.right[0] + r[1] * V.right[1] + r[2] * V.right[2]) * V.ppm, V.h / 2 - (r[0] * V.up[0] + r[1] * V.up[1] + r[2] * V.up[2]) * V.ppm, r[0] * V.fwd[0] + r[1] * V.fwd[1] + r[2] * V.fwd[2]];
};

// Character space to world: yaw by facing (degrees; 0 faces +Z), then translate.
export function placeFn(facing = 0, at = [0, 0, 0], scale = 1) {
  const c = Math.cos(facing * D2R), s = Math.sin(facing * D2R);
  return { p: (v) => [at[0] + scale * (c * v[0] + s * v[2]), at[1] + scale * v[1], at[2] + scale * (-s * v[0] + c * v[2])], n: (v) => [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]], c, s, at, scale };   // c, s, at, scale: for the loops that place vertices without arrays (the same arithmetic)
}

// A mesh's curvature and cavity bytes per vertex (forge/heads.mjs vertexMaps, the same arrays and cache:
// M.headMaps over the sculpted head's vertices, 128 and 0 elsewhere), for the G-buffer's curv and cav
export function vertexBytes(M) {
  if (M._maps && M._maps.n === M.pos.length / 3) return M._maps;
  const n = M.pos.length / 3, curv = new Uint8Array(n).fill(128), cav = new Uint8Array(n), h = M.headMaps;
  if (h) { curv.set(h.curv.subarray(0, Math.min(h.n, n - h.v0)), h.v0); cav.set(h.cav.subarray(0, Math.min(h.n, n - h.v0)), h.v0); }
  return (M._maps = { n, curv, cav });
}

// reuse: a G of the same size from an earlier frame, cleared and returned instead of a new one (the
// drawer keeps one per actor, so a frame allocates no G-buffer)
export function makeG(w, h, reuse = null) {
  const n = w * h;
  if (reuse && reuse.w === w && reuse.h === h) {
    const G = reuse; G.id.fill(0); G.N.fill(0); G.loc.fill(0); G.depth.fill(1e9); G.back.fill(0); G.wp.fill(0); G.col.fill(1); G.curv.fill(128); G.cav.fill(0);
    if (G.shadow) G.shadow.fill(1); delete G.pending; delete G.palette; return G;
  }
  return { w, h, id: new Uint8Array(n), N: new Float32Array(n * 3), loc: new Float32Array(n * 3), depth: new Float32Array(n).fill(1e9), back: new Uint8Array(n), wp: new Float32Array(n * 3), col: new Float32Array(n * 3).fill(1), curv: new Uint8Array(n).fill(128), cav: new Uint8Array(n) };   // curv, cav: the head sculptor's per-vertex bytes blended (design/STATE.md, 2026-10-21)
}

// Rasterize one skinned figure into G (which may already hold others: depth-tested).
// Two passes, with the same arithmetic as one: coverage and depth per triangle, keeping for each pixel
// the triangle that won it and its barycentrics; then the winners' attributes, once a pixel (each
// pixel's normal, material, bind point, world point and colour, as the last passing triangle wrote them).
const VB = new WeakMap();   // G -> visibility scratch
// rows [ya, yb): only those rows of G are written (a band of a figure drawn over several workers; the same
// pixels as a whole render gives in those rows)
export function rasterize(V, M, S, G, place = placeFn(), hidden = null, only = null, matOverride = 0, rows = null) {
  const hid = hidden && hidden.size ? new Set([...hidden].map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)) : null;
  const onl = only ? new Set(only.map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)) : null;
  const nv = M.pos.length / 3, sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv), wn = new Float32Array(nv * 3), wp = new Float32Array(nv * 3);
  const T = M.tri;
  // with only, just the vertices of the triangles that can be drawn are placed (the others are never read)
  let need = null; if (onl) { need = new Uint8Array(nv); for (let t = 0; t < T.length; t += 3) if (onl.has(M.part[T[t]]) && !(hid && hid.has(M.part[T[t]]))) need[T[t]] = need[T[t + 1]] = need[T[t + 2]] = 1; }
  if (place.c !== undefined) {   // placeFn's own transform and toScreen written out (no arrays a vertex)
    const { c, s: sn, at, scale } = place, C0 = V.centre[0], C1 = V.centre[1], C2 = V.centre[2], R0 = V.right[0], R1 = V.right[1], R2 = V.right[2], U0 = V.up[0], U1 = V.up[1], U2 = V.up[2], F0 = V.fwd[0], F1 = V.fwd[1], F2 = V.fwd[2], hw = V.w / 2, hh = V.h / 2, pp = V.ppm, P = S.pos, Nn = S.nrm;
    for (let v = 0; v < nv; v++) {
      if (need && !need[v]) continue;
      const v0 = P[v * 3], v1 = P[v * 3 + 1], v2 = P[v * 3 + 2], p0 = at[0] + scale * (c * v0 + sn * v2), p1 = at[1] + scale * v1, p2 = at[2] + scale * (-sn * v0 + c * v2);
      const r0 = p0 - C0, r1 = p1 - C1, r2 = p2 - C2, n0 = Nn[v * 3], n1 = Nn[v * 3 + 1], n2 = Nn[v * 3 + 2];
      sx[v] = hw + (r0 * R0 + r1 * R1 + r2 * R2) * pp; sy[v] = hh - (r0 * U0 + r1 * U1 + r2 * U2) * pp; sz[v] = r0 * F0 + r1 * F1 + r2 * F2;
      wn[v * 3] = c * n0 + sn * n2; wn[v * 3 + 1] = n1; wn[v * 3 + 2] = -sn * n0 + c * n2; wp[v * 3] = p0; wp[v * 3 + 1] = p1; wp[v * 3 + 2] = p2;
    }
  } else for (let v = 0; v < nv; v++) {
    if (need && !need[v]) continue;
    const p = place.p([S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]]), q = toScreen(V, p), n = place.n([S.nrm[v * 3], S.nrm[v * 3 + 1], S.nrm[v * 3 + 2]]);
    sx[v] = q[0]; sy[v] = q[1]; sz[v] = q[2]; wn.set(n, v * 3); wp.set(p, v * 3);
  }
  const { w, h } = G, view = V.fwd; G.view = V.fwd;
  const np = w * h; let vb = VB.get(G);
  if (!vb || vb.n !== np) { vb = { n: np, tri: new Int32Array(np), b0: new Float64Array(np), b1: new Float64Array(np), b2: new Float64Array(np), stamp: new Uint32Array(np), gen: 0, list: new Int32Array(np) }; VB.set(G, vb); }
  const tri = vb.tri, B0 = vb.b0, B1 = vb.b1, B2 = vb.b2, stamp = vb.stamp, list = vb.list, gen = ++vb.gen; let nl = 0;
  if (gen === 0xffffffff) { stamp.fill(0); vb.gen = 1; }
  const depth = G.depth, gid = G.id, part = M.part, mats = M.mat;
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    const x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], x2 = sx[c], y2 = sy[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(rows ? rows[0] : 0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(rows ? rows[1] - 1 : h - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;
    if (hid && hid.has(part[a])) continue;
    if (onl && !onl.has(part[a])) continue;
    const mat = matOverride || mats[a], inv = 1 / area, za = sz[a], zb = sz[b], zc = sz[c];
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5, e2 = y2 - py, e1 = y1 - py, e0 = y0 - py, row = y * w;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((x1 - px) * e2 - (x2 - px) * e1) * inv; if (w0 < 0) continue;
        const w1 = ((x2 - px) * e0 - (x0 - px) * e2) * inv; if (w1 < 0) continue;
        const w2 = 1 - w0 - w1; if (w2 < 0) continue;
        const z = w0 * za + w1 * zb + w2 * zc, i = row + x;
        if (matOverride ? gid[i] !== 0 : z >= depth[i]) continue;   // an override (a smear) only fills empty pixels
        depth[i] = z; gid[i] = mat;
        tri[i] = t; B0[i] = w0; B1[i] = w1; B2[i] = w2;
        if (stamp[i] !== gen) { stamp[i] = gen; list[nl++] = i; }
      }
    }
  }
  const N = G.N, back = G.back, col = G.col, loc = G.loc, gwp = G.wp, mc = M.col && M.col.length ? M.col : null, ml = M.loc, v0 = view[0], v1 = view[1], v2 = view[2];
  const VM = vertexBytes(M), vcu = VM.curv, vca = VM.cav, gcu = G.curv, gca = G.cav;
  for (let q = 0; q < nl; q++) {
    const i = list[q], t = tri[i], a = T[t], b = T[t + 1], c = T[t + 2], w0 = B0[i], w1 = B1[i], w2 = B2[i];
    let nx = w0 * wn[a * 3] + w1 * wn[b * 3] + w2 * wn[c * 3], ny = w0 * wn[a * 3 + 1] + w1 * wn[b * 3 + 1] + w2 * wn[c * 3 + 1], nz = w0 * wn[a * 3 + 2] + w1 * wn[b * 3 + 2] + w2 * wn[c * 3 + 2];
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const facingAway = nx * v0 + ny * v1 + nz * v2 > 0.05;
    back[i] = facingAway ? 1 : 0;
    if (facingAway) { nx = -nx; ny = -ny; nz = -nz; }
    N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz;
    gcu[i] = Math.round(w0 * vcu[a] + w1 * vcu[b] + w2 * vcu[c]); gca[i] = Math.round(w0 * vca[a] + w1 * vca[b] + w2 * vca[c]);
    for (let k = 0; k < 3; k++) { if (mc) col[i * 3 + k] = w0 * mc[a * 3 + k] + w1 * mc[b * 3 + k] + w2 * mc[c * 3 + k]; loc[i * 3 + k] = w0 * ml[a * 3 + k] + w1 * ml[b * 3 + k] + w2 * ml[c * 3 + k]; gwp[i * 3 + k] = w0 * wp[a * 3 + k] + w1 * wp[b * 3 + k] + w2 * wp[c * 3 + k]; }
  }
  return G;
}

// Self-shadowing from one light direction: rasterise the figure's depth as the light sees it, then
// test every G-buffer pixel against it. G.shadow[i] is 1 lit .. 0 in shadow (soft by a 3 x 3 vote).
export function castShadow(G, M, S, place, dir, { res = 256, size = 3.2, bias = 0.045, offset = 0.04, hidden = null, rows = null } = {}) {
  const hid = hidden && hidden.size ? new Set([...hidden].map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)) : null;
  const f = norm([-dir[0], -dir[1], -dir[2]]), up0 = Math.abs(f[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0], r = norm(cross(f, up0)), u = norm(cross(r, f));
  const nv = M.pos.length / 3, P = new Float32Array(nv * 3); let cx = 0, cy = 0, cz = 0;
  if (place.c !== undefined) { const { c: pc, s: ps, at, scale } = place, SP = S.pos; for (let v = 0; v < nv; v++) { const v0 = SP[v * 3], v1 = SP[v * 3 + 1], v2 = SP[v * 3 + 2], p0 = at[0] + scale * (pc * v0 + ps * v2), p1 = at[1] + scale * v1, p2 = at[2] + scale * (-ps * v0 + pc * v2); P[v * 3] = p0; P[v * 3 + 1] = p1; P[v * 3 + 2] = p2; cx += p0; cy += p1; cz += p2; } }
  else for (let v = 0; v < nv; v++) { const p = place.p([S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]]); P.set(p, v * 3); cx += p[0]; cy += p[1]; cz += p[2]; }
  const c = [cx / nv, cy / nv, cz / nv], ppm = res / size, L = (p) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [res / 2 + (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) * ppm, res / 2 - (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) * ppm, d[0] * f[0] + d[1] * f[1] + d[2] * f[2]]; };
  const D = new Float32Array(res * res).fill(1e9), sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
  { const C0 = c[0], C1 = c[1], C2 = c[2], hr = res / 2; for (let v = 0; v < nv; v++) { const d0 = P[v * 3] - C0, d1 = P[v * 3 + 1] - C1, d2 = P[v * 3 + 2] - C2; sx[v] = hr + (d0 * r[0] + d1 * r[1] + d2 * r[2]) * ppm; sy[v] = hr - (d0 * u[0] + d1 * u[1] + d2 * u[2]) * ppm; sz[v] = d0 * f[0] + d1 * f[1] + d2 * f[2]; } }   // L() written out
  // the pixels' places in the light's view first (the same arithmetic as the vote), so the depth map is
  // drawn only over the texels the vote reads: their box and a ring of one (a band, or a figure small in
  // the light's view, draws a part of the map; the votes are the same)
  const gid = G.id, gwp = G.wp, gN = G.N, c0 = c[0], c1 = c[1], c2 = c[2], r0 = r[0], r1 = r[1], r2 = r[2], u0 = u[0], u1 = u[1], u2 = u[2], f0 = f[0], f1 = f[1], f2 = f[2], half = res / 2;
  const i0 = rows ? rows[0] * G.w : 0, i1 = rows ? rows[1] * G.w : G.w * G.h;
  let np = 0; for (let i = i0; i < i1; i++) if (gid[i]) np++;
  const PI = new Int32Array(np), PX = new Int32Array(np), PY = new Int32Array(np), PZ = new Float64Array(np);
  let rx0 = res, rx1 = -1, ry0 = res, ry1 = -1;
  for (let i = i0, k = 0; i < i1; i++) {
    if (!gid[i]) continue;
    const d0 = gwp[i * 3] + gN[i * 3] * offset - c0, d1 = gwp[i * 3 + 1] + gN[i * 3 + 1] * offset - c1, d2 = gwp[i * 3 + 2] + gN[i * 3 + 2] * offset - c2;
    const q0 = half + (d0 * r0 + d1 * r1 + d2 * r2) * ppm, q1 = half - (d0 * u0 + d1 * u1 + d2 * u2) * ppm, q2 = d0 * f0 + d1 * f1 + d2 * f2;
    const X0 = Math.round(q0 - 0.5), Y0 = Math.round(q1 - 0.5);
    PI[k] = i; PX[k] = X0; PY[k] = Y0; PZ[k] = q2; k++;
    if (X0 < rx0) rx0 = X0; if (X0 > rx1) rx1 = X0; if (Y0 < ry0) ry0 = Y0; if (Y0 > ry1) ry1 = Y0;
  }
  const out = G.shadow || (G.shadow = new Float32Array(G.w * G.h).fill(1));
  if (!np) return;
  const cx0 = Math.max(0, rx0 - 1), cx1 = Math.min(res - 1, rx1 + 1), cy0 = Math.max(0, ry0 - 1), cy1 = Math.min(res - 1, ry1 + 1);   // the texels read
  for (let t = 0; t < M.tri.length; t += 3) {
    if (hid && hid.has(M.part[M.tri[t]])) continue;
    const a = M.tri[t], b = M.tri[t + 1], cc = M.tri[t + 2], area = (sx[b] - sx[a]) * (sy[cc] - sy[a]) - (sx[cc] - sx[a]) * (sy[b] - sy[a]); if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(cx0, Math.floor(Math.min(sx[a], sx[b], sx[cc]))), x1 = Math.min(cx1, Math.ceil(Math.max(sx[a], sx[b], sx[cc]))), y0 = Math.max(cy0, Math.floor(Math.min(sy[a], sy[b], sy[cc]))), y1 = Math.min(cy1, Math.ceil(Math.max(sy[a], sy[b], sy[cc])));
    if (x0 > x1 || y0 > y1) continue;
    const xa = sx[a], ya = sy[a], xb = sx[b], yb = sy[b], xc = sx[cc], yc = sy[cc], za = sz[a], zb = sz[b], zc = sz[cc];
    for (let y = y0; y <= y1; y++) { const py = y + 0.5, eC = yc - py, eB = yb - py, eA = ya - py;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, w0 = ((xb - px) * eC - (xc - px) * eB) / area; if (w0 < 0) continue;
        const w1 = ((xc - px) * eA - (xa - px) * eC) / area; if (w1 < 0) continue;
        const w2 = 1 - w0 - w1; if (w2 < 0) continue; const z = w0 * za + w1 * zb + w2 * zc, i = y * res + x; if (z < D[i]) D[i] = z;
      } }
  }
  // each texel's 3 x 3 nearest and farthest depth: a pixel nearer than every one is lit by all nine
  // taps, one farther than every one by none (the vote below, skipped where the answer is known)
  const qx0 = Math.max(1, rx0), qx1 = Math.min(res - 2, rx1), qy0 = Math.max(1, ry0), qy1 = Math.min(res - 2, ry1), Dmin = new Float32Array(res * res), Dmax = new Float32Array(res * res);
  for (let Y = qy0; Y <= qy1; Y++) for (let X = qx0; X <= qx1; X++) { let lo = Infinity, hi = -Infinity; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = D[(Y + dy) * res + X + dx]; if (v < lo) lo = v; if (v > hi) hi = v; } Dmin[Y * res + X] = lo; Dmax[Y * res + X] = hi; }
  for (let k = 0; k < np; k++) {
    const i = PI[k], X0 = PX[k], Y0 = PY[k], q2 = PZ[k]; let lit = 0, cnt = 0;
    if (X0 >= qx0 && Y0 >= qy0 && X0 <= qx1 && Y0 <= qy1) {
      const kk = Y0 * res + X0;
      if (q2 <= Dmin[kk] + bias) { out[i] = Math.min(out[i], 9 / 9); continue; }
      if (!(q2 <= Dmax[kk] + bias)) { out[i] = Math.min(out[i], 0 / 9); continue; }
    }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = X0 + dx, Y = Y0 + dy; if (X < 0 || Y < 0 || X >= res || Y >= res) { lit++; cnt++; continue; } lit += q2 <= D[Y * res + X] + bias ? 1 : 0; cnt++; }
    out[i] = Math.min(out[i], lit / cnt);
  }
}
