// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// nuclei.mjs: cell nuclei placed by the packing law measured from real tissue. Source of the law: BBBC038 (Data
// Science Bowl 2018, CC0) ground-truth masks, measured by library/lib/tools/biolaws.py into
// measures/biolaws-bbbc038.json (233 images with 40 or more nuclei). Nuclei keep apart: the Clark-Evans ratio R (mean
// nearest-neighbour distance over its value for random placement) has median 1.26 in tissue against 1.05 for random
// points through the same pipeline, and the spread of Voronoi side counts is narrower (mu2 1.28 against 1.62).
//
// The generator is random sequential addition with a hard core: each nucleus lands at a uniform random point and is
// kept only if no earlier nucleus lies within phi / sqrt(density). PHI_TISSUE is the phi that reproduces the tissue
// median R at the measured count and frame (tools: tests/bio.test.mjs checks it). phi 0 is random placement.
//
// Known mismatch: nuclei measure 0.243 spacings in radius (equivalent-area, median of 233 images), so two of them span
// 0.49 spacings, more than the 0.365 hard core. Real nuclei sit closer than round disks of their size could; they are
// elongated and deform against neighbours. The hard-disk model reproduces the spacing statistics, not the shapes.
export const PHI_TISSUE = 0.365;
export const TISSUE = { clarkR: 1.263, clarkP10: 0.837, clarkP90: 1.447, poissonR: 1.05, mu2: 1.284, density: 0.000687, radius: 0.243, source: 'BBBC038 stage1_train, CC0; measures/biolaws-bbbc038.json' };

export function place({ w, h, n, phi = PHI_TISSUE, rng, tries = 60 }) {
  const d = phi / Math.sqrt(n / (w * h)), d2 = d * d, cs = Math.max(d, 1), gw = Math.ceil(w / cs), gh = Math.ceil(h / cs);
  const grid = new Map(), xs = [], ys = [];
  const near = (x, y) => {
    const gx = Math.floor(x / cs), gy = Math.floor(y / cs);
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) for (const k of grid.get(j * gw + i) ?? []) { const dx = xs[k] - x, dy = ys[k] - y; if (dx * dx + dy * dy < d2) return true; }
    return false;
  };
  for (let a = 0; xs.length < n && a < n * tries; a++) {
    const x = rng() * w, y = rng() * h; if (phi > 0 && near(x, y)) continue;
    const key = Math.floor(y / cs) * gw + Math.floor(x / cs); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(xs.length); xs.push(x); ys.push(y);
  }
  return { x: Float32Array.from(xs), y: Float32Array.from(ys), gw, gh };
}

// Clark-Evans R without edge correction, as biolaws.py computes it
export function clarkR(x, y, w, h) {
  const n = x.length; let s = 0;
  for (let i = 0; i < n; i++) { let b = Infinity; for (let j = 0; j < n; j++) if (i !== j) { const dx = x[i] - x[j], dy = y[i] - y[j], q = dx * dx + dy * dy; if (q < b) b = q; } s += Math.sqrt(b); }
  return (s / n) / (0.5 / Math.sqrt(n / (w * h)));
}

// nearest-nucleus labels: the Voronoi tessellation as a raster (cell index per pixel) and the distance to the nucleus
export function cells(x, y, w, h) {
  // buckets one mean spacing wide; search rings of buckets outward until the ring is farther than the best found
  const id = new Int32Array(w * h), dist = new Float32Array(w * h), n = x.length, cs = Math.max(4, Math.sqrt(w * h / Math.max(1, n)));
  const gw = Math.ceil(w / cs), gh = Math.ceil(h / cs), B = Array.from({ length: gw * gh }, () => []);
  for (let i = 0; i < n; i++) B[Math.min(gh - 1, Math.floor(y[i] / cs)) * gw + Math.min(gw - 1, Math.floor(x[i] / cs))].push(i);
  for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
    const cx = px + 0.5, cy = py + 0.5, gx = Math.floor(cx / cs), gy = Math.floor(cy / cs);
    let b = Infinity, k = -1;
    for (let ring = 0; ring <= Math.max(gw, gh); ring++) {
      if (k >= 0 && (ring - 1) * cs > Math.sqrt(b)) break;
      for (let j = gy - ring; j <= gy + ring; j++) for (let i = gx - ring; i <= gx + ring; i++) {
        if (j < 0 || i < 0 || j >= gh || i >= gw || (Math.abs(j - gy) !== ring && Math.abs(i - gx) !== ring)) continue;
        for (const q of B[j * gw + i]) { const dx = x[q] - cx, dy = y[q] - cy, d2 = dx * dx + dy * dy; if (d2 < b) { b = d2; k = q; } }
      }
    }
    id[py * w + px] = k; dist[py * w + px] = Math.sqrt(b);
  }
  return { id, dist };
}
