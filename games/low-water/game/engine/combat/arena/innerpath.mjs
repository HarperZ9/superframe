// A way round solid ground for the inner arena's grounds (the maze's stacks, the closing bowl): a breadth-first
// search over the arena's cells, then the furthest cell on the path in a clear straight line (string pulling).
// The world's own steering (combat/sim/paths.mjs go) slides along a wall but cannot find an aisle behind a
// stack; this is used only where the straight line is blocked.
//   steer(W, F, x, z) -> { mx, mz } | null (null: the straight line is clear, or there is no way)
//   pathed(W, brain, { target }) a brain whose walking is routed round stacks when its line is blocked
export function steer(W, F, x, z) {
  const f = W.field; if (f.lineClear(F.x, F.z, x, z)) return null;
  const A = f.arena, R = A.rows.length, C = A.rows[0].length, c0 = (px, pz) => [Math.floor(px - A.origin[0]), Math.floor(pz - A.origin[1])];
  const [sx, sz] = c0(F.x, F.z), [tx, tz] = c0(x, z), key = (cx, cz) => cz * C + cx, open = (cx, cz) => cx >= 0 && cz >= 0 && cx < C && cz < R && !f.solid(A.origin[0] + cx + 0.5, A.origin[1] + cz + 0.5);
  const prev = new Map([[key(sx, sz), -1]]), q = [[sx, sz]];
  let found = false;
  for (let h = 0; h < q.length && !found; h++) {
    const [cx, cz] = q[h];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, nz = cz + dz, k = key(nx, nz); if (prev.has(k) || !open(nx, nz)) continue;
      prev.set(k, key(cx, cz)); q.push([nx, nz]); if (nx === tx && nz === tz) { found = true; break; }
    }
  }
  if (!found) return null;
  const path = []; for (let k = key(tx, tz); k !== -1 && k !== undefined; k = prev.get(k)) path.unshift([k % C, Math.floor(k / C)]);
  // the furthest cell along the path still in a clear straight line from the body
  let aim = path[Math.min(1, path.length - 1)];
  for (let i = path.length - 1; i >= 1; i--) { const [cx, cz] = path[i]; if (f.lineClear(F.x, F.z, A.origin[0] + cx + 0.5, A.origin[1] + cz + 0.5)) { aim = path[i]; break; } }
  const ax = A.origin[0] + aim[0] + 0.5 - F.x, az = A.origin[1] + aim[1] + 0.5 - F.z, d = Math.hypot(ax, az) || 1;
  return { mx: ax / d, mz: az / d };
}

// Wrap a brain: when it walks (no press) toward its target and the straight line is blocked, take the path instead
export function pathed(brain, target) {
  return (W, F) => {
    const out = brain(W, F) || {}; if ((out.press || []).length || (!out.mx && !out.mz)) return out;
    const T = target(W, F); if (!T) return out;
    // only a walk toward the target is routed (a boss backing off for room to charge keeps its own line)
    const tx = T.x - F.x, tz = T.z - F.z, d = Math.hypot(tx, tz) || 1, m = Math.hypot(out.mx || 0, out.mz || 0) || 1;
    if (((out.mx || 0) * tx + (out.mz || 0) * tz) / (d * m) < 0.3) return out;
    const s = steer(W, F, T.x, T.z); return s ? { ...out, mx: s.mx * m, mz: s.mz * m } : out;
  };
}
