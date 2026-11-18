// The walker, its animation and its camera, on made-up ground where the answer is known.
//   node --test games/low-water/world/tests/play.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { library } from "../../characters/anim/library.mjs";
import { P as LAMB } from "../../characters/cast/lamb.mjs";
import { INDEX } from "../../characters/rig/skeleton.mjs";
import { makeSolids, houseSolids, sdf } from "../play/solids.mjs";
import { makeBody, BODY } from "../play/controller.mjs";
import { makeAnimator, toWorld } from "../play/animator.mjs";
import { makeCamera } from "../play/camera.mjs";
import { readIntent, mapMove } from "../play/input.mjs";
import { makeAutopilot } from "../play/autopilot.mjs";
import { makeTriangleGrid } from "../play/geocheck.mjs";

const lib = library({}, { lamb: LAMB }), DT = 1 / 60;

test("play/ has no browser or GPU inside it, so the native host can run the same modules", () => {
  const dir = new URL("../play/", import.meta.url), bad = /\b(window|document|navigator|requestAnimationFrame|GPU[A-Z]\w*|localStorage|fetch|addEventListener)\b/;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".mjs"))) {
    const code = readFileSync(new URL(f, dir), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.ok(!bad.test(code), `${f} uses ${code.match(bad)?.[0]}`);
  }
});

// a street of eight houses along z, fronts to the lane, ground rising gently to the north
function street(ground = (x, z) => -z * 0.02) {
  const S = makeSolids({ ground }), houses = [];
  for (let i = 0; i < 4; i++) for (const side of [-1, 1]) houses.push({ x: side * 6.5, z: -i * 9, W: 8, D: 7, turn: side > 0 ? -Math.PI / 2 : Math.PI / 2, y: ground(side * 6.5, -i * 9), hw: 3.2, pitch: 0.7 });
  const all = houses.flatMap(houseSolids);
  S.sources.push((x0, z0, x1, z1, emit) => { for (const s of all) emit(s); });
  return { S, houses, all, ground };
}

test("the body is pushed out of a house it walks into and never stands inside one", () => {
  const { S, all, ground } = street(), body = makeBody({ x: 0, z: 2, face: 0 });
  let inside = 0;
  for (let i = 0; i < 900; i++) {
    // into the house on the east side, then along its wall
    body.step(DT, { move: i < 450 ? [1, -0.25] : [0.3, -1], run: i % 200 < 80 }, { ground, solids: S });
    const p = body.state, worst = Math.min(...all.filter((s) => s.kind === "box").map((s) => sdf(s, [p.x, ground(p.x, p.z) + 1, p.z])));
    if (worst < BODY.radius - 0.02) inside++;
  }
  assert.equal(inside, 0, `${inside} frames with the body's circle inside a wall`);
  assert.ok(body.state.blocked || body.state.x < 3, "the walk should have met the wall");
});

test("water above the chest turns the body back; water at the knee slows it to a wade", () => {
  const ground = (x, z) => -Math.max(0, -z - 10) * 0.08, water = (x, z) => (z < -10 ? 0 : -1e9), body = makeBody({ x: 0, z: 0, face: 0 });
  let slowest = 9, deepest = 0;
  for (let i = 0; i < 1800; i++) { body.step(DT, { move: [0, -1], run: true }, { ground, water }); if (body.state.wade > 0.5) slowest = Math.min(slowest, body.state.speed); deepest = Math.max(deepest, body.state.depth); }
  assert.ok(deepest <= BODY.tooDeep + 0.1, `walked into ${deepest.toFixed(2)} m of water`);
  assert.ok(slowest < 1.2, `wading at ${slowest.toFixed(2)} m/s`);
});

// A walk with turns, starts, a run and a stop over some ground; returns foot slide and contact numbers.
function walkFeet(ground, { lock = true, turn = 0, frames = 480 } = {}) {
  const body = makeBody({ x: 0, z: 0, face: 0, y: ground(0, 0) }), A = makeAnimator({ lib, P: LAMB });
  const place = { ground, water: () => -1e9 }, slide = [], pen = [];
  let prev = null;
  for (let i = 0; i < frames; i++) {
    const a = turn * i * DT, run = i > 220 && i < 330, stop = i > 400;
    body.step(DT, { move: stop ? [0, 0] : [Math.sin(a), -Math.cos(a)], run }, place);
    const o = A.step(DT, body.state, { ground, lock }), fe = {};
    for (const s of ["L", "R"]) {
      fe[s] = toWorld(o.root, o.S[INDEX["foot" + s]].p);
      // the sole: the ankle less its height, and a toe 14 cm ahead along the foot
      const R = o.S[INDEX["foot" + s]].R, toe = toWorld(o.root, [o.S[INDEX["foot" + s]].p[0] + R[2] * 0.14, o.S[INDEX["foot" + s]].p[1] + R[5] * 0.14 - 0.03, o.S[INDEX["foot" + s]].p[2] + R[8] * 0.14]);
      if (o.planted[s]) pen.push(Math.max(ground(fe[s][0], fe[s][2]) - (fe[s][1] - 0.03), ground(toe[0], toe[2]) - toe[1]));
    }
    if (prev && i > 20) for (const s of ["L", "R"]) if (o.planted[s] && prev.planted[s]) slide.push(Math.hypot(fe[s][0] - prev.fe[s][0], fe[s][2] - prev.fe[s][2]) / DT);
    prev = { fe, planted: o.planted };
  }
  slide.sort((a, b) => a - b); pen.sort((a, b) => a - b);
  const q = (l, f) => l[Math.min(l.length - 1, Math.floor(l.length * f))];
  return { n: slide.length, mean: slide.reduce((a, b) => a + b, 0) / slide.length, p95: q(slide, 0.95), max: slide[slide.length - 1], pen95: q(pen, 0.95), penMax: pen[pen.length - 1] };
}
const GROUNDS = { flat: () => 0, slope: (x, z) => -z * 0.25, "cross-slope": (x, z) => x * 0.3, stairs: (x, z) => Math.max(0, Math.floor(-z / 0.32)) * 0.17, bumps: (x, z) => 0.18 * Math.sin(x * 1.3) * Math.sin(z * 0.9) };

test("feet: a planted foot holds its place (target under 1 cm/s mean, 4 cm/s at the 95th centile)", () => {
  const rows = [];
  for (const [name, g] of Object.entries(GROUNDS)) for (const turn of [0, 0.7]) {
    const on = walkFeet(g, { turn }), off = walkFeet(g, { turn, lock: false });
    rows.push(`${name.padEnd(11)} turn ${turn}: locked mean ${(on.mean * 100).toFixed(2)} p95 ${(on.p95 * 100).toFixed(2)} max ${(on.max * 100).toFixed(1)} cm/s | gait alone mean ${(off.mean * 100).toFixed(1)} p95 ${(off.p95 * 100).toFixed(1)} cm/s`);
    assert.ok(on.mean < 0.01 && on.p95 < 0.04, `${name} turn ${turn}: slide mean ${(on.mean * 100).toFixed(2)} cm/s, p95 ${(on.p95 * 100).toFixed(2)}`);
    // the check can fail: without the lock the same walk slides
    if (turn) assert.ok(off.mean > on.mean * 3, `${name}: the gait alone should slide more than the locked feet`);
  }
  console.log("  " + rows.join("\n  "));
});

test("feet: a planted sole stays out of the ground on slopes, stairs and bumps (95 % within 2 cm)", () => {
  const rows = [];
  for (const [name, g] of Object.entries(GROUNDS)) {
    const r = walkFeet(g);
    rows.push(`${name.padEnd(11)} sole below ground: 95th centile ${(r.pen95 * 100).toFixed(1)} cm, worst ${(r.penMax * 100).toFixed(1)} cm`);
    assert.ok(r.pen95 < 0.02, `${name}: ${(r.pen95 * 100).toFixed(1)} cm into the ground`);
  }
  console.log("  " + rows.join("\n  "));
});

// the follow camera down the street, swung hard toward the houses every few seconds
function followWalk({ collide = true, plant = false } = {}) {
  const { S, all, ground } = street(), body = makeBody({ x: 0, z: 4, face: 0 }), A = makeAnimator({ lib, P: LAMB }), C = makeCamera({ solids: S, ground, mode: "follow" });
  C.state.collide = collide;
  // a wall planted across the lane just behind the walker's start: the camera must give way to it
  const wall = plant ? S.plant({ kind: "box", x: 0, z: 7.5, turn: 0, hu: 3, hv: 0.15, y0: -1, y1: 4 }) : null;
  const grid0 = makeTriangleGrid(), grid = { add(a, b, c) { const cx = (a[0] + b[0] + c[0]) / 3, cz = (a[2] + b[2] + c[2]) / 3, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const out = n[0] * (cx - grid.c[0]) + n[1] * ((a[1] + b[1] + c[1]) / 3 - grid.c[1]) + n[2] * (cz - grid.c[2]) >= 0; out ? grid0.add(a, b, c) : grid0.add(a, c, b); }, probe: (...q) => grid0.probe(...q), c: [0, 0, 0] }, boxTris = (s) => { grid.c = [s.x, (s.y0 + s.y1) / 2, s.z]; const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => { const u = a * s.hu, v = b * s.hv, co = Math.cos(s.turn), sn = Math.sin(s.turn); return [s.x + u * co + v * sn, s.z - u * sn + v * co]; }); for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4]; grid.add([p[0], s.y0, p[1]], [q[0], s.y0, q[1]], [q[0], s.y1, q[1]]); grid.add([p[0], s.y0, p[1]], [q[0], s.y1, q[1]], [p[0], s.y1, p[1]]); } grid.add([c[0][0], s.y1, c[0][1]], [c[1][0], s.y1, c[1][1]], [c[2][0], s.y1, c[2][1]]); grid.add([c[0][0], s.y1, c[0][1]], [c[2][0], s.y1, c[2][1]], [c[3][0], s.y1, c[3][1]]); };
  for (const s of all) if (s.kind === "box") boxTris(s);
  if (wall) boxTris(wall);
  let bad = 0, frames = 0;
  const pilot = makeAutopilot([[0, 4], [0, -10], [0, -28], [0, -30]]);
  for (let i = 0; i < 1500 && !pilot.done; i++) {
    const swing = (i % 240 < 60 ? 1 : 0) * (i % 480 < 240 ? 1 : -1) * 0.03;
    body.step(DT, pilot.step(body.state), { ground, solids: S });
    const a = A.step(DT, body.state, { ground });
    const v = C.update(DT, { look: [swing, i % 300 < 30 ? -0.01 : 0], move: [0, 0] }, body.state, { ...a, neck: toWorld(a.root, a.S[INDEX.neck].p) });
    const pr = grid.probe(v.eye, 0.18); frames++;
    if (pr.clipped || pr.enclosed || v.eye[1] < ground(v.eye[0], v.eye[2]) + 0.1) bad++;
  }
  return { bad, frames };
}

test("the follow camera never ends up inside a wall; with collision off the same walk does, and a planted wall is found", () => {
  const on = followWalk(), off = followWalk({ collide: false }), planted = followWalk({ plant: true }), plantedOff = followWalk({ plant: true, collide: false });
  console.log(`  collision on: ${on.bad} of ${on.frames} frames in geometry; off: ${off.bad}; planted wall on: ${planted.bad}; planted wall off: ${plantedOff.bad}`);
  assert.equal(on.bad, 0); assert.equal(planted.bad, 0);
  assert.ok(off.bad > 0, "the check found nothing with collision off: it cannot fail");
  assert.ok(plantedOff.bad > off.bad, "the planted wall was not found by the check");
});

// where a point lands in a pose's picture: x and y from -1 to 1 across a 16:9 frame
function onScreen(v, p) {
  const cp = Math.cos(v.pitch), f = [Math.sin(v.yaw) * cp, Math.sin(v.pitch), -Math.cos(v.yaw) * cp], r = [Math.cos(v.yaw), 0, Math.sin(v.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const d = [p[0] - v.eye[0], p[1] - v.eye[1], p[2] - v.eye[2]], z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2], x = d[0] * r[0] + d[2] * r[2], y = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  const half = v.ortho || z * Math.tan(v.fov * Math.PI / 360);
  return [x / (half * 16 / 9), y / half, f];
}
test("switching cameras never cuts: the walker and the view direction move smoothly on screen", () => {
  const { S, ground } = street(), body = makeBody({ x: 0, z: 0, face: 0 }), A = makeAnimator({ lib, P: LAMB }), C = makeCamera({ solids: S, ground, mode: "follow" });
  let last = null, worstMove = 0, worstTurn = 0; const order = ["first", "iso", "nav", "follow", "iso", "first", "follow", "nav", "iso"];
  for (let i = 0; i < 1500; i++) {
    if (i % 150 === 75 && order.length) C.setMode(order.shift());
    body.step(DT, { move: C.state.mode === "nav" ? [0, 0] : [0, -0.6] }, { ground, solids: S });
    const a = A.step(DT, body.state, { ground }), v = C.update(DT, { look: [0, 0], move: [0, 0] }, body.state, { ...a, neck: toWorld(a.root, a.S[INDEX.neck].p) });
    // the walker's chest; in first person the eye is the walker, so only the turn counts there
    const [x, y, f] = onScreen(v, [body.state.x, body.state.y + 1.2, body.state.z]);
    if (last) {
      worstTurn = Math.max(worstTurn, Math.acos(Math.min(1, f[0] * last.f[0] + f[1] * last.f[1] + f[2] * last.f[2])) * 180 / Math.PI);
      if (v.mode !== "first" && last.mode !== "first" && Math.abs(x) < 1.5 && Math.abs(last.x) < 1.5) worstMove = Math.max(worstMove, Math.hypot(x - last.x, y - last.y));
    }
    last = { x, y, f, mode: C.state.from ? "first" : v.mode };
  }
  console.log(`  between cameras, the most in one frame: the walker moved ${(worstMove * 50).toFixed(1)} % of the picture's height, the view turned ${worstTurn.toFixed(2)} degrees`);
  assert.ok(worstMove < 0.04, `the walker jumped ${(worstMove * 50).toFixed(1)} % of the picture in a frame`);
  assert.ok(worstTurn < 2.5, `the view turned ${worstTurn.toFixed(1)} degrees in a frame`);
});

test("input: keys, a gamepad and touch give the same intent", () => {
  const k = readIntent({ keys: new Set(["KeyW", "ShiftLeft"]), pressed: new Set(["KeyV"]) }, DT), p = readIntent({ pad: { axes: [0, -1, 0, 0], buttons: Array(17).fill(false).map((_, i) => i === 10), pressed: new Set([3]) } }, DT), t = readIntent({ touch: { move: [0, -1], look: [0, 0] } }, DT);
  for (const r of [k, p, t]) { assert.deepEqual(r.move.map((v) => Math.round(v * 100) / 100), [0, -1]); assert.ok(r.run); }
  assert.ok(k.cycle && p.cycle);
  const m = mapMove([0, -1], Math.PI / 2); assert.ok(Math.abs(m[0] - 1) < 1e-9 && Math.abs(m[1]) < 1e-9, "forward with the camera looking east is east");
});
