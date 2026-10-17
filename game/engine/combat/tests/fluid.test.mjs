// Fluidity (author, 2026-10-17): input-to-action latency in frames, presses held to the next
// window, no dead frame between moves, movement carried into attacks, and feedback hooks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, run, press } from "./helpers.mjs";

const startFrame = (ev, id = "lamb") => ev.find((e) => e.type === "move" && e.id === id);

test("input to action: a press when free starts its move on the same frame (0 frames)", () => {
  for (const a of ["light", "heavy", "roll", "step", "catch", "shove"]) {
    const W = makeWorld({ brains: false, foes: [] }), t0 = W.tick + 1;
    const e = startFrame(W.step(press(a, { mx: 1, mz: 0 })));
    assert.ok(e && e.t === t0, `${a}: started on frame ${e && e.t} for a press on ${t0}`);
  }
});

test("a press in an attack's recovery is held until the window opens, then starts on that frame", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb();
  const t1 = startFrame(W.step(press("light"))).t, m = W.moves[L.act.id];
  while (L.act && L.act.f < m.startup + m.active) W.step();
  run(W, 1, press("roll", { mx: 1, mz: 0 }));
  let at = null;
  for (let i = 0; i < 60 && !at; i++) at = W.step().find((e) => e.type === "move" && e.move === "lamb:roll");
  assert.ok(at, "the held roll came out (a 10-frame buffer would have dropped it)");
  assert.equal(at.t, t1 + m.cancel.roll[0], "on the first frame of the window, not later");
});

test("no dead frame: a move that ends lets a buffered press start on that frame", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb();
  run(W, 1, press("step", { mx: 1, mz: 0 }));
  const m = W.moves[L.act.id];
  while (L.act && L.act.f < m.total - 3) W.step();
  run(W, 1, press("light"));
  let gap = 0;
  for (let i = 0; i < 20; i++) { W.step(); if (!L.act) gap++; if (L.act && L.act.id === "lamb:light_1") break; }
  assert.equal(gap, 0, "never a frame with no move between the step and the strike");
});

test("movement hands into an attack: walking speed carries into its first steps", () => {
  const still = makeWorld({ brains: false, foes: [] }), moving = makeWorld({ brains: false, foes: [] });
  run(moving, 30, { lamb: { mx: 1, mz: 0 } });
  const x0 = moving.lamb().x, s0 = still.lamb().x;
  run(moving, 1, press("light", { mx: 1, mz: 0 })); run(still, 1, press("light", { mx: 1, mz: 0 }));
  run(moving, 8); run(still, 8);
  assert.ok(moving.lamb().x - x0 > still.lamb().x - s0 + 0.15);
});

test("a hit sends a directional spring shake and a rumble for the presentation layer", () => {
  const W = makeWorld({ brains: false, foes: [["holder", [6.5, 5.5]]] });
  const ev = run(W, 1, press("light")).concat(run(W, 40));
  const s = ev.find((e) => e.type === "shake" && e.spring), r = ev.find((e) => e.type === "rumble");
  assert.ok(s && Array.isArray(s.dir) && s.spring.k > 0);
  assert.ok(r && r.low > 0 && r.frames > 0);
});
