// A clay preview of hero meshes for shaping (not the frame: that is native lw_frame). Software
// z-buffer, perspective, smooth normals, one key light and a rim, a flat colour per vertex.
//   clay(meshes, views, W, H) -> Uint8ClampedArray RGBA of the views side by side
//   meshes: [{ pos, nrm, tri, col? }]   views: [{ eye: [x,y,z], at: [x,y,z], fov }]
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export function clay(meshes, views, W, H) {
  const out = new Uint8ClampedArray(W * views.length * H * 4), OW = W * views.length;
  views.forEach((V, vi) => {
    const f = norm(V.at.map((a, i) => a - V.eye[i])), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), t = 1 / Math.tan((V.fov * Math.PI) / 360);
    const zb = new Float32Array(W * H).fill(1e9), key = norm(V.key || [0.6, 0.7, 0.5]);
    for (let i = 0; i < W * H; i++) { const o = (Math.floor(i / W) * OW + vi * W + (i % W)) * 4; out[o] = 52; out[o + 1] = 50; out[o + 2] = 48; out[o + 3] = 255; }
    for (const M of meshes) {
      const n = M.pos.length / 3, sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const d = [M.pos[i * 3] - V.eye[0], M.pos[i * 3 + 1] - V.eye[1], M.pos[i * 3 + 2] - V.eye[2]], z = dot(d, f);
        sz[i] = z; sx[i] = W / 2 + (dot(d, r) / z) * t * (H / 2); sy[i] = H / 2 - (dot(d, u) / z) * t * (H / 2);
      }
      for (let k = 0; k < M.tri.length; k += 3) {
        const a = M.tri[k], b = M.tri[k + 1], c = M.tri[k + 2];
        if (sz[a] < 0.02 || sz[b] < 0.02 || sz[c] < 0.02) continue;
        const x0 = Math.max(0, Math.floor(Math.min(sx[a], sx[b], sx[c]))), x1 = Math.min(W - 1, Math.ceil(Math.max(sx[a], sx[b], sx[c])));
        const y0 = Math.max(0, Math.floor(Math.min(sy[a], sy[b], sy[c]))), y1 = Math.min(H - 1, Math.ceil(Math.max(sy[a], sy[b], sy[c])));
        const area = (sx[b] - sx[a]) * (sy[c] - sy[a]) - (sx[c] - sx[a]) * (sy[b] - sy[a]);
        if (Math.abs(area) < 1e-9) continue;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((sx[b] - px) * (sy[c] - py) - (sx[c] - px) * (sy[b] - py)) / area, w1 = ((sx[c] - px) * (sy[a] - py) - (sx[a] - px) * (sy[c] - py)) / area, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = 1 / (w0 / sz[a] + w1 / sz[b] + w2 / sz[c]);
          if (z >= zb[y * W + x]) continue;
          zb[y * W + x] = z;
          let nn = [0, 1, 2].map((q) => M.nrm[a * 3 + q] * w0 + M.nrm[b * 3 + q] * w1 + M.nrm[c * 3 + q] * w2); nn = norm(nn);
          const vdir = norm([V.eye[0] - (M.pos[a * 3] * w0 + M.pos[b * 3] * w1 + M.pos[c * 3] * w2), V.eye[1] - (M.pos[a * 3 + 1] * w0 + M.pos[b * 3 + 1] * w1 + M.pos[c * 3 + 1] * w2), V.eye[2] - (M.pos[a * 3 + 2] * w0 + M.pos[b * 3 + 2] * w1 + M.pos[c * 3 + 2] * w2)]);
          if (dot(nn, vdir) < 0) nn = nn.map((q) => -q);
          const col = M.col ? [0, 1, 2].map((q) => M.col[a * 3 + q] * w0 + M.col[b * 3 + q] * w1 + M.col[c * 3 + q] * w2) : [0.75, 0.72, 0.68];
          const h = norm(key.map((q, i) => q + vdir[i])), sp = Math.pow(Math.max(0, dot(nn, h)), 40) * 0.25;
          const L = 0.12 + 0.8 * Math.max(0, dot(nn, key)) + 0.25 * Math.pow(1 - Math.max(0, dot(nn, vdir)), 3);
          const o = (y * OW + vi * W + x) * 4;
          for (let q = 0; q < 3; q++) out[o + q] = Math.round(255 * Math.pow(Math.min(1, col[q] * L + sp), 1 / 2.2));
        }
      }
    }
  });
  return out;
}
