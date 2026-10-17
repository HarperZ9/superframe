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
  return { p: (v) => [at[0] + scale * (c * v[0] + s * v[2]), at[1] + scale * v[1], at[2] + scale * (-s * v[0] + c * v[2])], n: (v) => [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]] };
}

export function makeG(w, h) {
  const n = w * h;
  return { w, h, id: new Uint8Array(n), N: new Float32Array(n * 3), loc: new Float32Array(n * 3), depth: new Float32Array(n).fill(1e9), back: new Uint8Array(n), wp: new Float32Array(n * 3) };
}

// Rasterize one skinned figure into G (which may already hold others: depth-tested).
export function rasterize(V, M, S, G, place = placeFn(), hidden = null) {
  const hid = hidden && hidden.size ? new Set([...hidden].map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)) : null;
  const nv = M.pos.length / 3, sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv), wn = new Float32Array(nv * 3), wp = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) {
    const p = place.p([S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]]), q = toScreen(V, p), n = place.n([S.nrm[v * 3], S.nrm[v * 3 + 1], S.nrm[v * 3 + 2]]);
    sx[v] = q[0]; sy[v] = q[1]; sz[v] = q[2]; wn.set(n, v * 3); wp.set(p, v * 3);
  }
  const { w, h } = G, T = M.tri, view = V.fwd; G.view = V.fwd;
  for (let t = 0; t < T.length; t += 3) {
    const a = T[t], b = T[t + 1], c = T[t + 2];
    const x0 = sx[a], y0 = sy[a], x1 = sx[b], y1 = sy[b], x2 = sx[c], y2 = sy[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(area) < 1e-9) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(w - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(h - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;
    if (hid && hid.has(M.part[a])) continue;
    const mat = M.mat[a], inv = 1 / area;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[c], i = y * w + x;
        if (z >= G.depth[i]) continue;
        G.depth[i] = z; G.id[i] = mat;
        let nx = w0 * wn[a * 3] + w1 * wn[b * 3] + w2 * wn[c * 3], ny = w0 * wn[a * 3 + 1] + w1 * wn[b * 3 + 1] + w2 * wn[c * 3 + 1], nz = w0 * wn[a * 3 + 2] + w1 * wn[b * 3 + 2] + w2 * wn[c * 3 + 2];
        const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
        const facingAway = nx * view[0] + ny * view[1] + nz * view[2] > 0.05;
        G.back[i] = facingAway ? 1 : 0;
        if (facingAway) { nx = -nx; ny = -ny; nz = -nz; }
        G.N[i * 3] = nx; G.N[i * 3 + 1] = ny; G.N[i * 3 + 2] = nz;
        for (let k = 0; k < 3; k++) { G.loc[i * 3 + k] = w0 * M.loc[a * 3 + k] + w1 * M.loc[b * 3 + k] + w2 * M.loc[c * 3 + k]; G.wp[i * 3 + k] = w0 * wp[a * 3 + k] + w1 * wp[b * 3 + k] + w2 * wp[c * 3 + k]; }
      }
    }
  }
  return G;
}

// Self-shadowing from one light direction: rasterise the figure's depth as the light sees it, then
// test every G-buffer pixel against it. G.shadow[i] is 1 lit .. 0 in shadow (soft by a 3 x 3 vote).
export function castShadow(G, M, S, place, dir, { res = 256, size = 3.2, bias = 0.045, offset = 0.04, hidden = null } = {}) {
  const hid = hidden && hidden.size ? new Set([...hidden].map((n) => M.parts.indexOf(n)).filter((i) => i >= 0)) : null;
  const f = norm([-dir[0], -dir[1], -dir[2]]), up0 = Math.abs(f[1]) > 0.95 ? [0, 0, 1] : [0, 1, 0], r = norm(cross(f, up0)), u = norm(cross(r, f));
  const nv = M.pos.length / 3, P = new Float32Array(nv * 3); let cx = 0, cy = 0, cz = 0;
  for (let v = 0; v < nv; v++) { const p = place.p([S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]]); P.set(p, v * 3); cx += p[0]; cy += p[1]; cz += p[2]; }
  const c = [cx / nv, cy / nv, cz / nv], ppm = res / size, L = (p) => { const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]; return [res / 2 + (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) * ppm, res / 2 - (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) * ppm, d[0] * f[0] + d[1] * f[1] + d[2] * f[2]]; };
  const D = new Float32Array(res * res).fill(1e9), sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
  for (let v = 0; v < nv; v++) { const q = L([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]]); sx[v] = q[0]; sy[v] = q[1]; sz[v] = q[2]; }
  for (let t = 0; t < M.tri.length; t += 3) {
    if (hid && hid.has(M.part[M.tri[t]])) continue;
    const a = M.tri[t], b = M.tri[t + 1], cc = M.tri[t + 2], area = (sx[b] - sx[a]) * (sy[cc] - sy[a]) - (sx[cc] - sx[a]) * (sy[b] - sy[a]); if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[cc]))), x1 = Math.min(res - 1, Math.ceil(Math.max(sx[a], sx[b], sx[cc]))), y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[cc]))), y1 = Math.min(res - 1, Math.ceil(Math.max(sy[a], sy[b], sy[cc])));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5, w0 = ((sx[b] - px) * (sy[cc] - py) - (sx[cc] - px) * (sy[b] - py)) / area, w1 = ((sx[cc] - px) * (sy[a] - py) - (sx[a] - px) * (sy[cc] - py)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue; const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[cc], i = y * res + x; if (z < D[i]) D[i] = z;
    }
  }
  const out = G.shadow || (G.shadow = new Float32Array(G.w * G.h).fill(1));
  for (let i = 0; i < G.w * G.h; i++) {
    if (!G.id[i]) continue; const q = L([G.wp[i * 3] + G.N[i * 3] * offset, G.wp[i * 3 + 1] + G.N[i * 3 + 1] * offset, G.wp[i * 3 + 2] + G.N[i * 3 + 2] * offset]); let lit = 0, cnt = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = Math.round(q[0] - 0.5) + dx, Y = Math.round(q[1] - 0.5) + dy; if (X < 0 || Y < 0 || X >= res || Y >= res) { lit++; cnt++; continue; } lit += q[2] <= D[Y * res + X] + bias ? 1 : 0; cnt++; }
    out[i] = Math.min(out[i], lit / cnt);
  }
}
