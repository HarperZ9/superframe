import { test } from "node:test";
import assert from "node:assert/strict";
import { game, testSources } from "./helpers.mjs";
import { createGame, loadContent } from "../game.mjs";
import { findPath, groundAt, walkable, nearestOpen, camBasis, depthOf, geoAt, depthAt, fightFromScene } from "../world/plateworld.mjs";
import { projectPlate } from "../world/camera.mjs";

// A 10 x 6 grid of 1 m cells from (0, 0), open but for a wall at x = 4 with a gap at z = 5, and
// one low cell (h -1) at (8, 1).
function arena() {
  const w = 10, h = 6, cells = new Array(w * h).fill(null).map(() => ({ h: 0, surface: "stone" }));
  for (let r = 0; r < 5; r++) cells[r * w + 4] = null;
  cells[1 * w + 8] = { h: -1, surface: "mud" };
  return { cell: 1, origin: [0, 0], grid: { w, h, cells } };
}

test("plate ground: heights, solid cells, water over the knee, nearest open cell", () => {
  const A = arena();
  assert.equal(groundAt(A, 1.5, 1.5), 0);
  assert.equal(groundAt(A, 4.5, 1.5), null);
  assert.equal(groundAt(A, -1, 0), null);
  assert.ok(walkable(A, 8.5, 1.5) && walkable(A, 8.5, 1.5, -0.6) && !walkable(A, 8.5, 1.5, -0.5), "knee water (0.45 m) is the limit");
  assert.deepEqual(nearestOpen(A, 4.5, 1.5), [3, 1]);
  assert.equal(nearestOpen(A, 40, 40), null);
});

test("plate paths go round walls through the gap, end on the goal, and refuse the sealed", () => {
  const A = arena(), p = findPath(A, [1.5, 1.5], [7.5, 1.5]);
  assert.ok(p && p.length >= 2);
  assert.deepEqual(p[p.length - 1], [7.5, 1.5]);
  assert.ok(p.some(([, z]) => z > 5), "through the gap at z = 5");
  for (const [x, z] of p) assert.ok(walkable(A, x, z), `waypoint ${x}, ${z} is open`);
  A.grid.cells[5 * 10 + 4] = null; // close the gap
  assert.equal(findPath(A, [1.5, 1.5], [7.5, 1.5]), null);
});

test("plate depth and the world point under a plate pixel follow the bake camera", () => {
  const cam = { yawDeg: 26, elevDeg: 30, target: [0, 0, 0], dist: 70, ortho: true, scale: 4 };
  const B = camBasis(cam), near = [0, 0, 5], far = [0, 0, -5];
  assert.ok(depthOf(cam, near, B) < depthOf(cam, far, B), "toward the camera is nearer");
  assert.ok(Math.abs(Math.hypot(...B.f) - 1) < 1e-9);
  // a 4 x 2 plate whose geo buffer (scale 0.5) holds one point per 2 x 2 pixels
  const place = { width: 4, height: 2, geoScale: 0.5, camera: cam }, pos = new Float32Array([1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...geoAt(place, pos, 3.5, 1)], [4, 5, 6]);
  assert.equal(geoAt(place, pos, 9, 9), null);
  assert.equal(depthAt(place, pos, 9, 9), Infinity);
  const [px, py] = projectPlate(cam, 1920, 1080, near), [qx, qy] = projectPlate(cam, 1920, 1080, [0, 1, 5]);
  assert.ok(qy < py && Math.abs(qx - px) < 1e-6, "up is up the screen");
});

test("a fight from a scene starts where it stands: Lamb on the spot Lamb stood on, figures on theirs, marks moved", () => {
  const G = {
    state: { pos: [10, 0, 2] },
    world: { figures: () => [{ id: "keel", at: [12, 0, 3] }, { id: "other", at: [0, 0, 0] }] },
    ext: { combat: { defs: { e: { area: "quay", foes: [{ id: "f.keel", rec: { kv: [{ key: "char", value: "keel" }] }, n: 1 }, { id: "f.other", rec: { kv: [] }, n: 1 }] } } } },
  };
  const pj = { marks: { fight: { lamb: [1, 1], foes: [[3, 1], [5, 1]], anchors: { cut: [[0, 0]] } } } };
  const S = fightFromScene(G, pj, "e");
  assert.deepEqual(S.taken, ["keel"]);
  assert.deepEqual(S.aliases, { "f.keel#0": "keel" }, "the fighter that was keel keeps keel's actor");
  assert.deepEqual(S.fight.lamb, [10, 2]);
  assert.deepEqual(S.fight.foes, [[12, 3], [12, 2]], "keel on his own spot; the other foe on the first mark, moved by Lamb's offset");
  assert.deepEqual(S.fight.anchors, { cut: [[0, 0]] }, "anchors stay on their marks");
  assert.equal(fightFromScene(G, pj, "nope"), null);
});

test("the world follows the script: a place an area shows makes that area current", () => {
  const G = game();
  G.world.enter("t.quay");
  G.setPlace("t.bar");
  assert.equal(G.state.area, "t.bar");
  assert.deepEqual(G.state.pos, [4.6, 0, 1.3]);
  G.state.pos = [1, 0, 1]; G.setPlace("t.bar");
  assert.deepEqual(G.state.pos, [1, 0, 1], "an area already showing the place stays as it is");
  G.setPlace("nowhere.in.particular");
  assert.equal(G.state.area, "t.bar", "a place no area shows leaves the area alone");
});

test("^hub with no hub visited goes to the hub of the place Lamb is in", () => {
  const extra = { file: "ph.lwd", text: [
    "@node t.ph.hub", "hub: yes", "place: t.quay", "line: SPEAKER: The place's hub.", "exit: walk", "",
    "@node t.ph.away", "line: SPEAKER: Away from the hub.", "go: ^hub", "",
  ].join("\n") };
  const C = loadContent([...testSources(), extra]);
  assert.ok(C.ok, JSON.stringify(C.errors.filter((e) => e.level !== "warn").slice(0, 3)));
  const G = createGame({ content: C, seed: 7 });
  G.setPlace("t.quay");
  const talk = G.talk("t.ph.away");
  assert.ok(talk.beat.lines.some((l) => /The place's hub/.test(l.text)));
});
