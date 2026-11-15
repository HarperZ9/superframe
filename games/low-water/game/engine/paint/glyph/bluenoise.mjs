// Blue noise by void and cluster (Ulichney's method, written here from its description): a tile of rank
// values whose thresholds at any level spread as evenly as they can, so a dither by it shows no clumps and
// no grid. Built once (64 x 64, a few tens of milliseconds) and tiled by WORLD cell, not by screen cell: the
// glyph grid's cells are the plate's own (glyph/cells.mjs), so the pattern stays on the surfaces while the
// camera moves (after the dithering references: Obra Dinn's world-anchored dither). Original code.
//   const B = blueNoise(64); B.at(I, J) -> 0..1
export function blueNoise(N = 64, sigma = 1.5) {
  const n = N * N, bits = new Uint8Array(n), rank = new Float32Array(n), E = new Float32Array(n);
  // the energy of a pixel: a Gaussian of the toroidal distance to every set pixel (kept incrementally)
  const R = Math.ceil(sigma * 3), K = []; for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) K.push([dx, dy, Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))]);
  const add = (i, s) => { const x = i % N, y = (i / N) | 0; for (const [dx, dy, w] of K) E[((y + dy + N) % N) * N + ((x + dx + N) % N)] += s * w; };
  let seed = 0x9e3779b9; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  const tightest = () => { let b = -1, v = -Infinity; for (let i = 0; i < n; i++) if (bits[i] && E[i] > v) { v = E[i]; b = i; } return b; };
  const largestVoid = () => { let b = -1, v = Infinity; for (let i = 0; i < n; i++) if (!bits[i] && E[i] < v) { v = E[i]; b = i; } return b; };
  // 1. an initial pattern of a tenth of the pixels, relaxed until the tightest cluster and the largest void meet
  const ones = Math.floor(n / 10);
  for (let k = 0; k < ones;) { const i = Math.floor(rnd() * n); if (!bits[i]) { bits[i] = 1; add(i, 1); k++; } }
  for (let guard = 0; guard < n * 4; guard++) { const c = tightest(); bits[c] = 0; add(c, -1); const v = largestVoid(); if (v === c) { bits[c] = 1; add(c, 1); break; } bits[v] = 1; add(v, 1); }
  const proto = bits.slice(), protoE = E.slice();
  // 2. ranks below: take the tightest cluster away, one by one
  for (let r = ones - 1; r >= 0; r--) { const c = tightest(); bits[c] = 0; add(c, -1); rank[c] = r; }
  // 3. ranks above: from the prototype, fill the largest void, one by one
  bits.set(proto); E.set(protoE);
  for (let r = ones; r < n; r++) { const v = largestVoid(); bits[v] = 1; add(v, 1); rank[v] = r; }
  for (let i = 0; i < n; i++) rank[i] = (rank[i] + 0.5) / n;
  return { N, rank, at: (I, J) => rank[(((J % N) + N) % N) * N + (((I % N) + N) % N)] };
}
