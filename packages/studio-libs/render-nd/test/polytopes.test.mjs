import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nCubeVertices, nCubeEdges, nSimplexVertices, nSimplexEdges,
  nOrthoplexVertices, nOrthoplexEdges, cell24Vertices, cell24Edges, polytope,
} from "../core/polytopes.mjs";

const dist = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

test("cube: 2^n verts, n·2^(n-1) edges, coords in {-1,1}", () => {
  for (let n = 1; n <= 6; n++) {
    assert.equal(nCubeVertices(n).length, 2 ** n);
    assert.equal(nCubeEdges(n).length, n * 2 ** (n - 1));
    for (const v of nCubeVertices(n)) for (const c of v) assert.ok(c === 1 || c === -1);
  }
});

test("simplex: n+1 verts in R^n, complete graph, regular (all edges equal length)", () => {
  for (let n = 1; n <= 6; n++) {
    const V = nSimplexVertices(n);
    assert.equal(V.length, n + 1);
    for (const v of V) assert.equal(v.length, n);
    assert.equal(nSimplexEdges(n).length, ((n + 1) * n) / 2);
    const L = dist(V[0], V[1]);
    for (const [i, j] of nSimplexEdges(n)) assert.ok(Math.abs(dist(V[i], V[j]) - L) < 1e-9);
  }
});

test("orthoplex: 2n verts (±e_i), edges = all non-antipodal pairs = 2n(n-1)", () => {
  for (let n = 2; n <= 6; n++) {
    assert.equal(nOrthoplexVertices(n).length, 2 * n);
    assert.equal(nOrthoplexEdges(n).length, 2 * n * (n - 1));
  }
});

test("orthoplex: the one-dimensional case is the segment between its two vertices", () => {
  assert.deepEqual(nOrthoplexEdges(1), [[0, 1]]);
});

test("24-cell: 24 verts, 96 edges, all permutations of (±1,±1,0,0)", () => {
  assert.equal(cell24Vertices().length, 24);
  assert.equal(cell24Edges().length, 96);
  for (const v of cell24Vertices()) {
    assert.equal(v.length, 4);
    const nz = [...v].filter((x) => x !== 0);
    assert.equal(nz.length, 2);
    for (const x of nz) assert.ok(x === 1 || x === -1);
  }
});

test("polytope() dispatches kind→{verts,edges}", () => {
  const p = polytope("orthoplex", 3);
  assert.equal(p.kind, "orthoplex");
  assert.equal(p.verts.length, 6);
  assert.equal(p.edges.length, 12);
});
