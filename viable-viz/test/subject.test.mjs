// subject.test.mjs — Task 1 subject tests (node:test)
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { polytopeSubject, graphSubject, ecosystemSubject } from "../subject.mjs";

describe("polytopeSubject", () => {
  it("cube-4: criterion has 16 vertices and 32 edges", () => {
    const s = polytopeSubject("cube", 4);
    assert.strictEqual(s.kind, "polytope");
    assert.strictEqual(s.criterion.vertices, 16);
    assert.strictEqual(s.criterion.edges, 32);
    assert.strictEqual(s.criterion.polytopeKind, "cube");
    assert.deepStrictEqual(s.structure, { kind: "cube", n: 4 });
  });

  it("simplex-3: criterion has 4 vertices and 6 edges", () => {
    const s = polytopeSubject("simplex", 3);
    assert.strictEqual(s.criterion.vertices, 4);
    assert.strictEqual(s.criterion.edges, 6);
  });
});

describe("graphSubject", () => {
  it("3-node path graph: correct criterion", () => {
    // nodes [0,1,2], edges [[0,1],[1,2]] — path 0-1-2
    const g = { nodes: [0, 1, 2], edges: [[0, 1], [1, 2]] };
    const s = graphSubject(g);
    assert.strictEqual(s.kind, "graph");
    assert.strictEqual(s.criterion.nodeCount, 3);
    assert.strictEqual(s.criterion.edgeCount, 2);
    assert.strictEqual(s.criterion.components, 1);
    assert.deepStrictEqual(s.criterion.degreeSeq, [1, 1, 2]);
  });

  it("disconnected graph: 2 components", () => {
    const g = { nodes: [0, 1, 2, 3], edges: [[0, 1], [2, 3]] };
    const s = graphSubject(g);
    assert.strictEqual(s.criterion.components, 2);
    assert.deepStrictEqual(s.criterion.degreeSeq, [1, 1, 1, 1]);
  });

  it("single node: 1 component, 0 edges, degreeSeq [0]", () => {
    const g = { nodes: ["a"], edges: [] };
    const s = graphSubject(g);
    assert.strictEqual(s.criterion.nodeCount, 1);
    assert.strictEqual(s.criterion.edgeCount, 0);
    assert.strictEqual(s.criterion.components, 1);
    assert.deepStrictEqual(s.criterion.degreeSeq, [0]);
  });
});

describe("ecosystemSubject", () => {
  it("never throws", async () => {
    // default path (real ecosystem file)
    let err = null;
    let result;
    try {
      result = await ecosystemSubject();
    } catch (e) {
      err = e;
    }
    assert.strictEqual(err, null, `ecosystemSubject threw: ${err}`);
    assert.ok(result, "returned a value");
  });

  it("returns a graph subject with >=1 node", async () => {
    const s = await ecosystemSubject();
    assert.strictEqual(s.kind, "graph");
    assert.ok(s.criterion.nodeCount >= 1, "nodeCount >= 1");
  });

  it("has a .source field", async () => {
    const s = await ecosystemSubject();
    assert.ok(
      s.source === "ecosystem-map" || s.source === "synthetic-fallback",
      `unexpected source: ${s.source}`
    );
  });

  it("falls back gracefully on a missing file without throwing", async () => {
    const s = await ecosystemSubject("/nonexistent/path/ecosystem.json");
    assert.strictEqual(s.source, "synthetic-fallback");
    assert.ok(s.criterion.nodeCount >= 1);
  });
});
