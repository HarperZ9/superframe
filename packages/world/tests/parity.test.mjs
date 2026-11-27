// SPDX-License-Identifier: MIT
// Parity: every feature of every package the field touches is still there, the field reaches the ones it names, and
// the bundle the site carries is a fresh build of the sources.
//   node --test packages/world/tests/parity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { load, missing } from "../parity.mjs";
import { build } from "../bundle.mjs";
import { PROPERTIES } from "../properties.mjs";

const rows = load().rows;

test("every listed feature of the touched packages still resolves", async () => {
  assert.ok(rows.length >= 500, `${rows.length} features listed`);
  const gone = await missing(rows);
  assert.deepEqual(gone.map((g) => `${g.file} ${g.name}: ${g.why}`), []);
});

test("control: a feature that is not there is reported, for each kind of row", async () => {
  const planted = [
    { package: "rooms lens", file: "packages/rooms/core/trace.js", kind: "export", name: "notAFeature" },
    { package: "diagram cad", file: "packages/diagram/cad/load.js", kind: "umd", key: "C", name: "notAFeature" },
    { package: "lenspipe", file: "packages/lenspipe/lenspipe/trace.py", kind: "py", name: "not_a_feature" },
    { package: "rooms", file: "packages/rooms/views/no-such-view.mjs", kind: "file", name: "no-such-view.mjs" },
  ];
  assert.equal((await missing(planted)).length, planted.length);
});

test("every core a property names is a listed feature, and the parity list names it as reached", () => {
  for (const p of Object.values(PROPERTIES)) for (const name of p.core.exports) {
    const row = rows.find((r) => r.name === name && (r.file === p.core.file || r.file.endsWith("index.js") || r.file.endsWith("load.js")));
    assert.ok(row, `${p.id}: ${name} from ${p.core.file} is listed`);
    assert.ok(row.field === p.id || row.field === "all", `${p.id}: ${name} is marked reached by ${row.field}`);
  }
});

test("the bundle the site carries is a fresh build of the sources", () => {
  const have = readFileSync(fileURLToPath(new URL("../dist/world-field.mjs", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
  const sha = (t) => createHash("sha256").update(t).digest("hex");
  assert.equal(sha(have), sha(build()), "dist/world-field.mjs is stale: run node packages/world/bundle.mjs");
});
