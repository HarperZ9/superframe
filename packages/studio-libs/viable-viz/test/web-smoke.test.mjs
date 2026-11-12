// web-smoke.test.mjs — Task 5 smoke test.
// Confirms app.mjs parses and exports init + run without executing any DOM calls
// at import time. Real rendering verified by Playwright in Task 6.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Dynamically import so we can catch any module-level crash cleanly.
const mod = await import("../web/app.mjs");

describe("web/app.mjs smoke", () => {
  it("exports init as a function", () => {
    assert.equal(typeof mod.init, "function");
  });

  it("exports run as a function", () => {
    assert.equal(typeof mod.run, "function");
  });
});
