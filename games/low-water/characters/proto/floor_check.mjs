// A held tool kept out of the floor (runtime/actor.mjs floorTool): frames with the stick under the ground over turns, a walk, a stop and a turn from a run, and the control with the fit off.
//   node proto/floor_check.mjs
import { readFileSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import * as lamb from "../cast/lamb.mjs";
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
for (const off of [false, true]) {
  const a = createCast({ timing, members: { lamb } }).actor("lamb", { tool: "stick" }); if (off) a.floorTool = () => {};
  let under = 0, worst = 0, n = 0;
  const SEQ = [[0, (x) => x.play("idle", { force: true })], [20, (x) => x.play("turn", { force: true })], [120, (x) => { x.play("walk", { force: true }); x.state.vWant = 1.4; }], [260, (x) => x.play("stop", { force: true })], [320, (x) => x.play("turn_run", { force: true })]];
  for (let f = 0; f < 400; f++) { for (const [t, fn] of SEQ) if (t === f) fn(a); a.update(1 / 60); const w = a.weapon(); const lo = Math.min(w.tip[1], w.butt[1]); n++; if (lo < 0) { under++; worst = Math.min(worst, lo); } }
  console.log(off ? "control, floor fit off:" : "floor fit on:", `${under} of ${n} frames with the stick under the floor, worst ${(worst * 100).toFixed(1)} cm`);
}
