// Show a baked head's maps (forge/bakeheads.mjs): the .lwmesh drawn flat from the front and from
// three-quarters, coloured by curvature (blue concave, red convex), thickness (dark thin, pale thick)
// and cavity (dark enclosed), beside a plain shaded view. A z-buffered triangle fill of our own.
//   node proto/heads_maps.mjs <who> <lod> <out.png>
import { readFileSync } from "node:fs";
import { unpackMesh } from "../forge/meshio.mjs";
import { writePng } from "../render/io.mjs";

const [who = "penhallow", lod = "near", out = "out/heads-maps.png"] = process.argv.slice(2);
const buf = readFileSync(new URL(`../forged/heads/${who}-${lod}.lwmesh`, import.meta.url)), { M, maps } = unpackMesh(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), null);
const S = 360, panels = 4, img = new Uint8Array(S * panels * S * 2 * 4).fill(0); for (let i = 3; i < img.length; i += 4) img[i] = 255;
const nv = M.pos.length / 3, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], M.pos[v * 3 + k]); hi[k] = Math.max(hi[k], M.pos[v * 3 + k]); }
const ctr = lo.map((v, k) => (v + hi[k]) / 2), span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 1.1;
const q = (a, p) => { const s = Float32Array.from(a).sort(); return s[Math.floor(s.length * p)]; };
const cLo = q(maps.curvature, 0.05), cHi = q(maps.curvature, 0.95), tHi = q(maps.thickness, 0.9);
const colour = [
  (v) => { const l = Math.max(0.1, M.nrm[v * 3 + 2] * 0.6 + M.nrm[v * 3 + 1] * 0.3 + 0.3); return [l, l * 0.95, l * 0.9]; },
  (v) => { const t = Math.max(-1, Math.min(1, maps.curvature[v] > 0 ? maps.curvature[v] / cHi : -maps.curvature[v] / cLo)); return t > 0 ? [0.5 + 0.5 * t, 0.5 - 0.3 * t, 0.5 - 0.3 * t] : [0.5 + 0.3 * t, 0.5 + 0.3 * t, 0.5 - 0.5 * t]; },
  (v) => { const t = Math.min(1, maps.thickness[v] / tHi); return [t, t, t]; },
  (v) => { const t = 1 - maps.cavity[v]; return [t, t, t]; },
];
for (const [row, yaw] of [[0, 0], [1, 34]]) {
  const c = Math.cos(yaw * Math.PI / 180), s = Math.sin(yaw * Math.PI / 180);
  const P = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) { const x = M.pos[v * 3] - ctr[0], y = M.pos[v * 3 + 1] - ctr[1], z = M.pos[v * 3 + 2] - ctr[2]; P[v * 3] = (c * x + s * z) / span * S + S / 2; P[v * 3 + 1] = S / 2 - y / span * S; P[v * 3 + 2] = -s * x + c * z; }
  for (let pnl = 0; pnl < panels; pnl++) {
    const Z = new Float32Array(S * S).fill(-1e9), col = colour[pnl];
    for (let t = 0; t < M.tri.length; t += 3) {
      const [a, b, d] = [M.tri[t], M.tri[t + 1], M.tri[t + 2]], ax = P[a * 3], ay = P[a * 3 + 1], bx = P[b * 3], by = P[b * 3 + 1], dx = P[d * 3], dy = P[d * 3 + 1];
      const area = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax); if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, dx))), x1 = Math.min(S - 1, Math.ceil(Math.max(ax, bx, dx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, dy))), y1 = Math.min(S - 1, Math.ceil(Math.max(ay, by, dy)));
      const ca = col(a), cb = col(b), cd = col(d);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const w1 = ((x + 0.5 - ax) * (dy - ay) - (y + 0.5 - ay) * (dx - ax)) / area, w2 = ((bx - ax) * (y + 0.5 - ay) - (by - ay) * (x + 0.5 - ax)) / area, w0 = 1 - w1 - w2;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * P[a * 3 + 2] + w1 * P[b * 3 + 2] + w2 * P[d * 3 + 2]; if (z <= Z[y * S + x]) continue; Z[y * S + x] = z;
        const o = ((row * S + y) * S * panels + pnl * S + x) * 4; for (let k = 0; k < 3; k++) img[o + k] = Math.round(255 * Math.max(0, Math.min(1, w0 * ca[k] + w1 * cb[k] + w2 * cd[k])));
      }
    }
  }
}
writePng(out, { width: S * panels, height: S * 2, data: img });
console.log("maps", who, lod, nv, "vertices ->", out);
