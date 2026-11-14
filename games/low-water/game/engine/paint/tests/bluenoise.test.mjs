// The void-and-cluster tile is a true blue noise: every rank once, and at any threshold the chosen cells stay
// apart (no two of the darkest tenth closer than two cells, toroidally) with far less low-frequency power than
// white noise of the same density.
import test from "node:test";
import assert from "node:assert/strict";
import { blueNoise } from "../glyph/bluenoise.mjs";
const B = blueNoise(32);
test("each rank once", () => { const s = new Set(Array.from(B.rank, (r) => Math.round(r * 1024 - 0.5))); assert.equal(s.size, 1024); });
test("the darkest tenth is spread: no two closer than 2 cells", () => {
  const N = 32, pts = []; for (let i = 0; i < N * N; i++) if (B.rank[i] < 0.1) pts.push([i % N, (i / N) | 0]);
  let mind = Infinity; for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) { const dx = Math.min(Math.abs(pts[a][0] - pts[b][0]), N - Math.abs(pts[a][0] - pts[b][0])), dy = Math.min(Math.abs(pts[a][1] - pts[b][1]), N - Math.abs(pts[a][1] - pts[b][1])); mind = Math.min(mind, Math.hypot(dx, dy)); }
  assert.ok(mind >= 2, `closest pair ${mind}`);
});
test("less low-frequency power than white noise", () => {
  const N = 32, low = (v) => { let p = 0; for (let ky = 0; ky <= 3; ky++) for (let kx = 0; kx <= 3; kx++) { if (!kx && !ky) continue; let re = 0, im = 0; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = (2 * Math.PI * (kx * x + ky * y)) / N, s = v[y * N + x] - 0.5; re += s * Math.cos(a); im += s * Math.sin(a); } p += re * re + im * im; } return p; };
  let seed = 7; const white = Float32Array.from({ length: N * N }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
  assert.ok(low(B.rank) < low(white) / 5, `blue ${low(B.rank).toFixed(1)} against white ${low(white).toFixed(1)}`);
});
