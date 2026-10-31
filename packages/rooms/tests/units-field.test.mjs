// packages/field is arriving in a separate pull request and holds the fuller unit type. When it is present the two tables
// must agree, so this layer can give way to it without a change in any number.
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { assert, near } from "./h.mjs";
import { unit } from "../core/units.js";

const p = new URL("../../field/src/units.js", import.meta.url);
test("rooms units agree with packages/field", { skip: existsSync(p) ? false : "packages/field is not on this branch" }, () => {
  const ctx = {};
  ctx.globalThis = ctx;
  vm.runInNewContext(readFileSync(p, "utf8").replace(/\}\)\(typeof[\s\S]*$/, "})(globalThis);"), ctx);
  for (const u of ["m", "nm", "um", "V", "N/m", "J/bit", "W", "Hz", "ohm"]) {
    const a = unit(u),
      b = ctx.Field.unit(u);
    near(a.scale, b.scale, Math.abs(b.scale) * 1e-12, u);
    assert.deepEqual([...a.dim], [...b.dim], u);
  }
});
