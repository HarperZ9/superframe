// The traversal's level-of-detail selection, on a flat stand-in for the island.
//   node --test games/low-water/world/tests/walk.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectNodes, frustumPlanes, rangeOf, LEAF, LEVELS } from "../walk/lod.mjs";

// a flat world of 4 x 3 roots, like the island's 131 km by 98 km
function flatPyramid() {
  const out = [];
  for (let l = 0; l < LEVELS; l++) { const w = 4 * 2 ** (LEVELS - 1 - l), h = 3 * 2 ** (LEVELS - 1 - l); out.push({ w, h, lo: new Float32Array(w * h), hi: new Float32Array(w * h).fill(10) }); }
  return out;
}
const ROOT = LEAF * 2 ** (LEVELS - 1), MAP = 4 * ROOT * 3 * ROOT, APRON = (10 * 9 - 12) * ROOT * ROOT;

test("without culling the nodes tile the island and its sea apron exactly once", () => {
  const P = flatPyramid(), out = new Float32Array(4096 * 4);
  for (const cam of [[40000, 2, 50000], [100, 1.7, 100], [65000, 3000, 49000], [131000, 40000, 98000], [-5000, 500, 20000]]) {
    const n = selectNodes(P, cam, [], out, { cull: false });
    let area = 0;
    for (let i = 0; i < n; i++) area += out[i * 4 + 2] ** 2;
    assert.equal(area, MAP + APRON, `camera ${cam}: ${n} nodes cover ${area}, want ${MAP + APRON}`);
    // no two nodes overlap: every node is aligned to its own size, so equal corners would repeat
    const seen = new Set();
    for (let i = 0; i < n; i++) { const k = `${out[i * 4]},${out[i * 4 + 1]}`; assert.ok(!seen.has(k), `two nodes at ${k}`); seen.add(k); }
    assert.ok(n < 2048, `${n} nodes is more than the node buffer holds`);
  }
});

test("detail follows the walker: the finest nodes are the ones under the camera", () => {
  const P = flatPyramid(), out = new Float32Array(4096 * 4), cam = [40000, 2, 50000], n = selectNodes(P, cam, [], out, { cull: false });
  let finest = Infinity, under = null;
  for (let i = 0; i < n; i++) {
    const [x, z, s, level] = out.subarray(i * 4, i * 4 + 4);
    finest = Math.min(finest, s);
    if (cam[0] >= x && cam[0] < x + s && cam[2] >= z && cam[2] < z + s) under = { s, level };
    // a node is never finer than its distance allows: its near corner lies inside the range of its level
    const dx = Math.max(x - cam[0], 0, cam[0] - x - s), dz = Math.max(z - cam[2], 0, cam[2] - z - s);
    if (s < ROOT) assert.ok(Math.hypot(dx, dz) <= rangeOf(Math.round(Math.log2(s / LEAF)) + 1) + 1, `a ${s} m node ${Math.hypot(dx, dz).toFixed(0)} m away`);
  }
  assert.equal(under.s, LEAF); assert.equal(finest, LEAF);
  console.log(`  ${n} nodes from ${LEAF} m to ${ROOT} m; vertices ${LEAF / 32} m apart under the walker`);
});

test("culling removes what is behind the camera and nothing in front", () => {
  const P = flatPyramid(), out = new Float32Array(4096 * 4), cam = [40000, 2, 50000];
  // a view matrix looking north (toward -z), 60 degrees wide, reversed infinite depth
  const t = 1 / Math.tan(1.05 / 2), a = 16 / 9, e = cam;
  const V = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -e[0], -e[1], -e[2], 1], Pm = [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, 0, -1, 0, 0, 0.3, 0], M = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += Pm[k * 4 + r] * V[c * 4 + k]; M[c * 4 + r] = s; }
  const all = selectNodes(P, cam, [], out, { cull: false }), n = selectNodes(P, cam, frustumPlanes(M), out);
  assert.ok(n < all * 0.6, `culling kept ${n} of ${all}`);
  let ahead = false;
  for (let i = 0; i < n; i++) {
    const [x, z, s] = out.subarray(i * 4, i * 4 + 3);
    assert.ok(z < cam[2] + 1, `a node wholly behind the camera was kept (z ${z})`);
    if (x <= cam[0] && x + s > cam[0] && z + s <= cam[2] && z + s > cam[2] - 5000) ahead = true;
  }
  assert.ok(ahead, "the ground straight ahead was culled");
});
