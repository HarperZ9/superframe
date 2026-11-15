// The banded build equals the one-piece build, and no band runs long. node --test game/engine/light/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildScene } from "../scene.mjs";
import { buildSteps, runSteps } from "../steps.mjs";

const dir = new URL("../../../capture/light/plates/q_granary/", import.meta.url);
test("the banded build gives the same light as the one-piece build, in short steps", { skip: !existsSync(new URL("place.json", dir)) && "no proof plate" }, () => {
  const pj = JSON.parse(readFileSync(new URL("place.json", dir), "utf8")), b = readFileSync(new URL("geo-pos.f32", dir));
  const geo = { pos: new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), ids: new Uint8Array(readFileSync(new URL("geo-id.u8", dir))) };
  const ta = performance.now(), A = buildScene({ pj, geo, hour: 23 }), whole = performance.now() - ta, job = buildSteps({ pj, geo, hour: 23 });
  let S = null, longest = 0, steps = 0; const times = []; while (!S) { const t0 = performance.now(); S = runSteps(job, 0); const d = performance.now() - t0; times.push(d); longest = Math.max(longest, d); steps++; }
  times.sort((a, b) => a - b); const p99 = times[Math.floor(times.length * 0.99)];
  for (const k of ["e0", "e1", "rest", "occ", "N"]) assert.deepEqual(S.F[k], A.F[k], k);
  for (const k of ["wet", "frost", "fog", "shadow"]) assert.deepEqual(S.F.rec[k], A.F.rec[k], k);
  assert.deepEqual(S.compose({ t: 1 }), A.compose({ t: 1 }));
  // relative to the one-piece build in the same run, so a loaded machine does not fail it: 99% of steps under a tenth of
  // it (a lone collector pause or the first step's allocation can stand out; the stages themselves are banded)
  assert.ok(steps > 20, `${steps} steps`); assert.ok(p99 < whole * 0.1, `99th percentile step ${p99.toFixed(1)} ms of a ${whole.toFixed(0)} ms build (longest ${longest.toFixed(1)})`);
});
