// Moffatt's helicity on linked tubes, with the sign, the mirror and the unlinked baseline.
import test from "node:test";
import { assert, near } from "./h.mjs";
import { tubes, hopf, gaussLink } from "../solvers/fluid/tubes.js";

const V = (2 * Math.PI) ** 3;
test("Gauss linking reads +1, -1 and 0; helicity follows it", () => {
  const L = hopf("linked"), M = hopf("mirror"), U = hopf("unlinked");
  near(gaussLink(...L), 1, 1e-3, "linked");
  near(gaussLink(...M), -1, 1e-3, "mirror");
  near(gaussLink(...U), 0, 1e-6, "unlinked");
  const h = (c) => (tubes(c, 32, { a: 0.3 }).helicity() * V) / 2;
  near(h(L), 1, 0.03, "H / 2 Gamma^2, linked");
  near(h(M), -1, 0.03, "mirror");
  near(h(U), 0, 0.03, "unlinked, with its periodic images");
  assert.ok(Math.abs(h(U) - 1) > 0.5, "the unlinked case does not pass as linked");
  near(tubes(L, 32, { a: 0.3 }).maxDivergence(), 0, 1e-12, "closed curves give a solenoidal field");
});
