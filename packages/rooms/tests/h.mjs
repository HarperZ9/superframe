import assert from "node:assert/strict";
/** near: |a-b| <= tol, with the numbers in the failure text. */
export function near(a, b, tol, what = "") {
  assert.ok(Number.isFinite(a), `${what}: got ${a}`);
  assert.ok(Math.abs(a - b) <= tol, `${what}: got ${a}, want ${b} within ${tol}`);
}
export { assert };
