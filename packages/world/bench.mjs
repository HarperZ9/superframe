// SPDX-License-Identifier: MIT
// bench.mjs: the frame budget of the scene's own work, without drawing. One frame is one step (flow, dye, sound, the
// field again) and one trace of 17 rays, as the page does it. Prints the median and the 95th percentile over 300
// frames after 60 to warm up, on this machine's CPU, in Node.   node packages/world/bench.mjs
import { createScene } from "./scene.mjs";

const s = createScene(), times = [];
for (let i = 0; i < 360; i++) {
  const t0 = performance.now();
  s.step(); s.trace(17);
  if (i >= 60) times.push(performance.now() - t0);
}
times.sort((a, b) => a - b);
const q = (p) => times[Math.min(times.length - 1, Math.floor(p * times.length))].toFixed(2);
console.log(JSON.stringify({ frames: times.length, grid: `${s.size.nx}x${s.size.ny}`, rays: 17, medianMs: +q(0.5), p95Ms: +q(0.95), maxMs: +q(1), node: process.version }));
