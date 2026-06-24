// embed.test.mjs — Task 1 embed tests (node:test)
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { embedGraph } from "../embed.mjs";

describe("embedGraph", () => {
  const triangle = { nodes: [0, 1, 2], edges: [[0, 1], [1, 2], [0, 2]] };

  it("returns correct vert count = node count", () => {
    const { verts } = embedGraph(triangle, 4);
    assert.strictEqual(verts.length, 3);
  });

  it("each vert is a Float64Array of length dims", () => {
    const dims = 4;
    const { verts } = embedGraph(triangle, dims);
    for (const v of verts) {
      assert.ok(v instanceof Float64Array, "vert is Float64Array");
      assert.strictEqual(v.length, dims, "vert length === dims");
    }
  });

  it("edges are preserved exactly", () => {
    const { edges } = embedGraph(triangle, 4);
    assert.deepStrictEqual(edges, triangle.edges);
  });

  it("deterministic: two calls produce identical verts", () => {
    const r1 = embedGraph(triangle, 4);
    const r2 = embedGraph(triangle, 4);
    assert.strictEqual(r1.verts.length, r2.verts.length);
    for (let i = 0; i < r1.verts.length; i++) {
      assert.deepStrictEqual(Array.from(r1.verts[i]), Array.from(r2.verts[i]));
    }
  });

  it("default dims = 4", () => {
    const { verts } = embedGraph(triangle);
    assert.strictEqual(verts[0].length, 4);
  });

  it("larger graph: 5-node chain, dims=3", () => {
    const g = { nodes: [0, 1, 2, 3, 4], edges: [[0,1],[1,2],[2,3],[3,4]] };
    const { verts, edges } = embedGraph(g, 3);
    assert.strictEqual(verts.length, 5);
    for (const v of verts) assert.strictEqual(v.length, 3);
    assert.deepStrictEqual(edges, g.edges);
  });

  it("single node graph: no edges, dims=4", () => {
    const g = { nodes: [0], edges: [] };
    const { verts, edges } = embedGraph(g, 4);
    assert.strictEqual(verts.length, 1);
    assert.deepStrictEqual(edges, []);
    assert.strictEqual(verts[0].length, 4);
  });

  it("dims=1: all verts are scalar Float64Arrays", () => {
    const { verts } = embedGraph(triangle, 1);
    for (const v of verts) {
      assert.ok(v instanceof Float64Array);
      assert.strictEqual(v.length, 1);
    }
  });
});
