// Scene to cells: the place's 3D data (a world point and a surface kind for every plate sample, from
// the geo buffers) gathered into the character grid, once per place and zoom. Cells are pw x ph plate
// pixels (cw x ch screen pixels at the zoom), numbered from the plate's corner. Per cell:
//   k1, k2      the two surface kinds covering most of it, and k1's share (0..255)
//   P, N        the cell's world point (the main kind's samples, averaged) and its normal
//   depth       the nearest sample's distance along the camera's forward
//   thin        a thin thing crossing the cell (a pole, a rail, a rope: the second kind, 10 to 45 percent
//               of the cell, its samples along a line): its direction on screen, 0 | 1 / 2 - 3 \, or -1
//   step        the cell's edge: a height break to a lower neighbour of 0.45 m or more, its direction, or -1
// Original code.
import { camBasis } from "../../world/plateworld.mjs";
import { SHAPE_COLS, SHAPE_ROWS, SHAPE_N } from "./atlas.mjs";

export function sceneCells({ pj, pos, ids, cw, ch, zoom }) {
  const pw = cw / zoom, ph = ch / zoom, nI = Math.ceil(pj.width / pw), nJ = Math.ceil(pj.height / ph), n = nI * nJ;
  const s = pj.geoScale || 1, gw = Math.round(pj.width * s), gh = Math.round(pj.height * s);
  const idFull = ids.length === pj.width * pj.height, idW = idFull ? pj.width : gw;   // some places keep kinds at the plate's own size
  const B = camBasis(pj.camera), f = B.f, cp = B.pos;
  const k1 = new Uint8Array(n), k2 = new Uint8Array(n), share = new Uint8Array(n), P = new Float32Array(n * 3).fill(NaN), N = new Float32Array(n * 3), depth = new Float32Array(n).fill(Infinity), thin = new Int8Array(n).fill(-1), step = new Int8Array(n).fill(-1);
  const cnt = new Map();
  for (let J = 0; J < nJ; J++) for (let I = 0; I < nI; I++) {
    const c = J * nI + I, gx0 = Math.floor(I * pw * s), gx1 = Math.min(gw, Math.max(gx0 + 1, Math.floor((I + 1) * pw * s))), gy0 = Math.floor(J * ph * s), gy1 = Math.min(gh, Math.max(gy0 + 1, Math.floor((J + 1) * ph * s)));
    cnt.clear(); let tot = 0;
    for (let gy = gy0; gy < gy1; gy++) for (let gx = gx0; gx < gx1; gx++) {
      const g = gy * gw + gx, x = pos[g * 3], y = pos[g * 3 + 1], z = pos[g * 3 + 2]; if (!Number.isFinite(y) || (x === 0 && y === 0 && z === 0)) continue;
      const id = idFull ? ids[Math.min(pj.height - 1, Math.floor(gy / s)) * idW + Math.min(pj.width - 1, Math.floor(gx / s))] : ids[g];
      let e = cnt.get(id); if (!e) cnt.set(id, (e = { n: 0, x: 0, y: 0, z: 0, sx: 0, sy: 0, sxx: 0, syy: 0, sxy: 0 }));
      e.n++; e.x += x; e.y += y; e.z += z; e.sx += gx; e.sy += gy; e.sxx += gx * gx; e.syy += gy * gy; e.sxy += gx * gy; tot++;
      const dd = (x - cp[0]) * f[0] + (y - cp[1]) * f[1] + (z - cp[2]) * f[2]; if (dd < depth[c]) depth[c] = dd;
    }
    if (!tot) continue;
    const ord = [...cnt.entries()].sort((a, b) => b[1].n - a[1].n), [id1, e1] = ord[0];
    k1[c] = id1; share[c] = Math.round((255 * e1.n) / tot); P[c * 3] = e1.x / e1.n; P[c * 3 + 1] = e1.y / e1.n; P[c * 3 + 2] = e1.z / e1.n;
    if (ord[1]) {
      const [id2, e2] = ord[1]; k2[c] = id2; const fr = e2.n / tot;
      if (fr >= 0.1 && fr <= 0.45 && e2.n >= 3) {   // a thin thing: its samples along a line (the covariance's eigen ratio)
        const mx = e2.sx / e2.n, my = e2.sy / e2.n, a = e2.sxx / e2.n - mx * mx, b = e2.sxy / e2.n - mx * my, d = e2.syy / e2.n - my * my;
        const tr = a + d, det = a * d - b * b, disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det)), l1 = tr / 2 + disc, l2 = Math.max(1e-6, tr / 2 - disc);
        if (l1 / l2 >= 3) { const ang = 0.5 * Math.atan2(2 * b, a - d); thin[c] = Math.round(((ang + Math.PI * 2.5) % Math.PI) / (Math.PI / 4)) % 4; }   // the line's own direction (angle 0 lies along x: a dash)
      }
    }
  }
  // the cell's shape (glyph/shape.mjs): at the centre of each part of a 3 x 4 grid of the cell, is the sample the
  // cell's own surface (its main kind, within 0.6 m of the cell's point)? 255 yes, 0 no (another surface, or nothing)
  const occ = new Uint8Array(n * SHAPE_N);
  for (let J = 0; J < nJ; J++) for (let I = 0; I < nI; I++) {
    const c = J * nI + I; if (!Number.isFinite(P[c * 3 + 1])) continue;
    for (let r = 0; r < SHAPE_N; r++) {
      const sx = (I + ((r % SHAPE_COLS) + 0.5) / SHAPE_COLS) * pw, sy = (J + (Math.floor(r / SHAPE_COLS) + 0.5) / SHAPE_ROWS) * ph;
      const gx = Math.min(gw - 1, Math.floor(sx * s)), gy = Math.min(gh - 1, Math.floor(sy * s)), g = gy * gw + gx, x = pos[g * 3], y = pos[g * 3 + 1], z = pos[g * 3 + 2];
      if (!Number.isFinite(y) || (x === 0 && y === 0 && z === 0)) continue;
      const id = idFull ? ids[Math.min(pj.height - 1, Math.floor(sy)) * idW + Math.min(pj.width - 1, Math.floor(sx))] : ids[g];
      if (id === k1[c] && (x - P[c * 3]) ** 2 + (y - P[c * 3 + 1]) ** 2 + (z - P[c * 3 + 2]) ** 2 < 0.36) occ[c * SHAPE_N + r] = 255;
    }
  }
  // normals from neighbouring cells' points; a break where a neighbour stands 0.45 m lower
  for (let J = 1; J < nJ - 1; J++) for (let I = 1; I < nI - 1; I++) {
    const c = J * nI + I; if (!Number.isFinite(P[c * 3 + 1])) continue;
    const q = (dI, dJ) => { const k = (J + dJ) * nI + I + dI; return Number.isFinite(P[k * 3 + 1]) ? k : c; };
    const a = q(1, 0), b = q(-1, 0), u = q(0, 1), d = q(0, -1);
    const ux = P[a * 3] - P[b * 3], uy = P[a * 3 + 1] - P[b * 3 + 1], uz = P[a * 3 + 2] - P[b * 3 + 2], vx = P[u * 3] - P[d * 3], vy = P[u * 3 + 1] - P[d * 3 + 1], vz = P[u * 3 + 2] - P[d * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const l = Math.hypot(nx, ny, nz) || 1; N[c * 3] = nx / l; N[c * 3 + 1] = ny / l; N[c * 3 + 2] = nz / l;
    const y = P[c * 3 + 1], drop = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dI, dJ]) => y - P[q(dI, dJ) * 3 + 1]);
    const best = drop.indexOf(Math.max(...drop));
    if (drop[best] >= 0.45) step[c] = best < 2 ? 0 : 2;   // a drop to the side draws an upright, a drop below a dash
  }
  return { pw, ph, nI, nJ, k1, k2, share, P, N, depth, thin, step, occ, camPos: cp, fwd: f };
}
