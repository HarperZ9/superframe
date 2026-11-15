// P1: the move data lives in data/moves.json; the generator expands the tool settings into strikes.
// The C++ port checks the same golden (tests/moves-expanded.golden.json) with its own generator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE } from "./helpers.mjs";
import { expandAll, GOLDEN } from "../tools/export-data.mjs";

test("moves.json is versioned and holds the tables and the tool settings, no strikes", () => {
  const d = JSON.parse(readFileSync(join(HERE, "..", "data", "moves.json"), "utf8"));
  assert.equal(d.format, "lw-moves"); assert.equal(d.version, 1); assert.equal(d.fps, 60);
  for (const k of ["common", "body", "bodyMoveset", "toolClasses", "tools", "foeSpecials", "bossSpecials", "arenaSpecials"]) assert.ok(d[k] && typeof d[k] === "object", k);
  assert.ok(!Object.keys(d.common).some((k) => /light_|heavy/.test(k)), "no generated strike stored");
});

test("the generator's expansion of every table and tool equals the golden exactly", () => {
  const got = JSON.stringify(expandAll()) + "\n", want = readFileSync(GOLDEN, "utf8");
  assert.equal(got, want);
  assert.equal(Object.keys(JSON.parse(want).base).length, 104);
});
