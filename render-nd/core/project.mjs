// project.mjs — nD→2D projection chain. Each mode collapses dimensions from the highest down to 2.

// Parity with shipped ndim.js: iterated perspective, depth = product of scale factors.
export function projectTo2D(vert, dist = 3.0) {
  const n = vert.length, coord = new Float64Array(vert);
  let depth = 1.0;
  for (let k = n - 1; k >= 2; k--) {
    const denom = dist - coord[k];
    const f = Math.abs(denom) < 1e-9 ? 1.0 : dist / denom;
    depth *= f;
    for (let j = 0; j < k; j++) coord[j] *= f;
  }
  return { x: coord[0], y: coord[1], depth };
}

export function project(vert, opts = {}) {
  const mode = opts.mode || "perspective";
  const dist = opts.dist == null ? 3.0 : opts.dist;
  const n = vert.length;
  if (n <= 2) return { x: vert[0] || 0, y: vert[1] || 0, depth: 1 };
  if (mode === "perspective") return projectTo2D(vert, dist);

  if (mode === "orthographic") {
    // Drop dims >=2; depth from the mean of collapsed coords (higher = nearer), shifted positive.
    let sum = 0; for (let k = 2; k < n; k++) sum += vert[k];
    return { x: vert[0], y: vert[1], depth: 1 + sum / (n - 2) };
  }

  if (mode === "stereographic") {
    // Conformal: collapse from the highest dim through the pole at +dist on each axis.
    const coord = new Float64Array(vert);
    let depth = 1.0;
    for (let k = n - 1; k >= 2; k--) {
      const denom = dist - coord[k];
      const f = Math.abs(denom) < 1e-9 ? 1.0 : dist / denom; // same pole formula, conformal scaling
      depth *= f;
      for (let j = 0; j < k; j++) coord[j] *= f;
    }
    return { x: coord[0], y: coord[1], depth };
  }
  throw new RangeError(`unknown projection mode: ${mode}`);
}
