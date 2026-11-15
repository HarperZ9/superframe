import { test } from "node:test";
import assert from "node:assert/strict";
import { findPath } from "../world/plateworld.mjs";
import { findPathVG, visGraph, lineOpen, pathLength } from "../world/visgraph.mjs";

// A 20 x 12 floor of 0.5 m cells with a wall across the middle and a gap at the top.
function room() {
  const w = 20, h = 12, cells = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push(c === 10 && r > 2 ? null : { h: 0 });
  return { cell: 0.5, origin: [0, 0], grid: { w, h, cells } };
}

test("the visibility graph goes round the wall, as short as grid A* and with far fewer expansions", () => {
  const A = room(), a = [1.25, 5.25], b = [8.75, 5.25], sg = {}, sv = {};
  const pg = findPath(A, a, b, { stats: sg }), pv = findPathVG(A, a, b, { stats: sv, fallback: false });
  assert.ok(pg && pv, "both find a way through the gap");
  assert.ok(pathLength(a, pv) <= pathLength(a, pg) * 1.001, `graph ${pathLength(a, pv).toFixed(2)} m, grid ${pathLength(a, pg).toFixed(2)} m`);
  assert.ok(sv.expanded * 5 < sg.expanded, `expansions: graph ${sv.expanded}, grid ${sg.expanded}`);
  for (let i = 0; i < pv.length; i++) assert.ok(lineOpen(A, i ? pv[i - 1] : a, pv[i]), "every leg is walkable");
  assert.deepEqual(pv[pv.length - 1], b, "the path ends on the goal");
});

test("a straight walk needs no graph, and a wall is never crossed or squeezed past at a corner", () => {
  const A = room();
  assert.deepEqual(findPathVG(A, [1.25, 1.25], [4.25, 1.25], { fallback: false }), [[4.25, 1.25]]);
  assert.equal(lineOpen(A, [1.25, 5.25], [8.75, 5.25]), false, "through the wall");
  const B = { cell: 1, origin: [0, 0], grid: { w: 2, h: 2, cells: [{ h: 0 }, null, null, { h: 0 }] } };
  assert.equal(lineOpen(B, [0.5, 0.5], [1.5, 1.5]), false, "between two blocked diagonal cells");
  assert.ok(visGraph(A).nodes.length > 0, "the wall's top corners are nodes");
});

test("no way through is no path, and the grid is asked when the graph has none", () => {
  const A = room(); for (let r = 0; r < 3; r++) A.grid.cells[r * 20 + 10] = null; // close the gap
  assert.equal(findPathVG(A, [1.25, 5.25], [8.75, 5.25], { fallback: false }), null);
  assert.equal(findPathVG(A, [1.25, 5.25], [8.75, 5.25]), null, "grid A* agrees there is none");
});
