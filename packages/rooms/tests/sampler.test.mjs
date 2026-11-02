import test from "node:test";
import { assert, near } from "./h.mjs";
import { Pcg, pcgStep } from "../core/sampler.js";

test("the step matches the shader's integer maths", () => {
  // st=st*747796405u+2891336453u; w=((st>>((st>>28u)+4u))^st)*277803737u; float((w>>22u)^w)/2^32
  const a = pcgStep(0);
  assert.equal(a.state, 2891336453);
  const st = a.state,
    w = Math.imul(((st >>> ((st >>> 28) + 4)) ^ st) >>> 0, 277803737) >>> 0;
  near(a.value, (((w >>> 22) ^ w) >>> 0) / 4294967296, 0, "output");
});
test("uniform: mean, and chi square across 64 bins", () => {
  const r = new Pcg(12345),
    N = 200000,
    b = new Float64Array(64);
  let m = 0;
  for (let i = 0; i < N; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
    m += v;
    b[(v * 64) | 0]++;
  }
  near(m / N, 0.5, 0.003, "mean");
  const e = N / 64;
  let chi = 0;
  for (const x of b) chi += (x - e) ** 2 / e;
  assert.ok(chi < 110, `chi square ${chi}`);
});
test("same seed, same stream; a different seed diverges", () => {
  const a = new Pcg(9),
    b = new Pcg(9),
    c = new Pcg(10);
  const A = [a.next(), a.next()];
  assert.deepEqual(A, [b.next(), b.next()]);
  assert.notEqual(A[0], c.next());
});
