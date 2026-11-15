import { test } from "node:test";
import assert from "node:assert/strict";
import { seatOf } from "../world/plateworld.mjs";

// plate samples as a flat [x, y, z ...] list: a filled box top and a brick ring (a fire pit's rim)
const fill = (out, x0, x1, z0, z1, y, step = 0.02) => { for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) out.push(x, y, z); return out; };
function ring(out, cx, cz, r0, r1, y, step = 0.02) { for (let x = cx - r1; x <= cx + r1; x += step) for (let z = cz - r1; z <= cz + r1; z += step) { const d = Math.hypot(x - cx, z - cz); if (d >= r0 && d <= r1) out.push(x, y, z); } return out; }

test("the seat finder takes the fish box, not the fire pit's rim beside it (the smokehouse, 2026-10-21)", () => {
  const pos = [];
  fill(pos, 0.6, 1.2, -1.1, -0.7, 0.26);       // the fish box, 0.26 m high
  ring(pos, -0.2, 0, 0.48, 0.6, 0.3);          // the pit's brick rim, 0.3 m high, open in the middle
  fill(pos, -0.6, 0.2, -0.4, 0.4, 0.1, 0.04);  // the embers, low in the pit
  const s = seatOf({}, Float32Array.from(pos), [0.9, 0, -0.5]);
  assert.ok(s, "a seat is found");
  assert.ok(Math.hypot(s.at[0] - 0.9, s.at[2] + 0.9) < 0.1, `on the box, not at ${s.at.map((v) => v.toFixed(2))}`);
});

test("a rim alone is no seat; a bollard top and a long bench by the mark are", () => {
  const rim = ring([], 0, 0, 0.48, 0.6, 0.3);
  assert.equal(seatOf({}, Float32Array.from(rim), [0.6, 0, 0.3]), null, "the pit rim alone");
  const bollard = fill([], -0.15, 0.15, -0.12, 0.12, 0.45);
  assert.ok(seatOf({}, Float32Array.from(bollard), [0, 0, 0]), "a bollard's top");
  const bench = fill([], -1.5, 1.5, -0.2, 0.2, 0.45);
  const b = seatOf({}, Float32Array.from(bench), [0.8, 0, 0]);
  assert.ok(b && Math.abs(b.at[0] - 0.8) < 0.45, "a long bench, sat on near the mark");
});
