import test from "node:test";
import { assert, near } from "./h.mjs";
import { unit, convert, sameDim, UnitError } from "../core/units.js";
import { constant, auditConstants, FROM_MEMORY } from "../core/provenance.js";
import { CONSTANTS } from "../core/constants.js";

test("units convert and refuse a mismatch", () => {
  near(convert(589, "nm", "m"), 589e-9, 1e-20, "nm to m");
  near(convert(1, "V/um", "V/m"), 1e6, 1e-6, "field strength");
  assert.ok(sameDim("N/m", "kg/s^2"), "surface tension dimension");
  assert.throws(() => convert(1, "V", "bit"), UnitError);
  assert.throws(() => unit("furlong"), UnitError);
});

test("a constant must name a source, and an unchecked one is flagged", () => {
  assert.throws(() => constant(1, "m", {}), /source/);
  assert.throws(() => constant(1, "m", { source: "x", verified: { against: "y" } }), /result/);
  const a = constant(1, "m", { source: "a book" });
  assert.equal(a.flag, FROM_MEMORY);
  assert.equal(a.flag, "from memory, unverified");
  const b = constant(1, "m", { source: "a book", verified: { against: "a table", result: "equal" } });
  assert.equal(b.flag, null);
  assert.throws(() => {
    a.value = 2;
  }, TypeError);
});

test("every registered constant carries unit and source; the audit counts both states", () => {
  const r = auditConstants(CONSTANTS);
  assert.ok(r.total >= 30, `constants ${r.total}`);
  assert.equal(r.verified + r.unverified, r.total);
  assert.ok(r.verified >= 8, "the checks recorded in constants.js");
  assert.ok(r.unverified >= 1, "something stays flagged");
  for (const [k, q] of Object.entries(CONSTANTS)) {
    assert.ok(q.source.length > 3, k);
    unit(q.unit);
  }
});

test("rounded page constants stay within the rounding of the reference they cite", () => {
  near(CONSTANTS.standardGravity.value, 9.80665, 0, "CODATA, exact");
  near(CONSTANTS.vacuumPermittivity.value, 8.8541878188e-12, 5e-16, "CODATA, 4 figures on the page");
  near(CONSTANTS.bk7Nd.value, 1.5168, 0, "SCHOTT N-BK7 nd");
  near(CONSTANTS.bk7Vd.value, 64.17, 0, "SCHOTT N-BK7 vd");
});
