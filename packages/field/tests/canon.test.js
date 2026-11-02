// SPDX-License-Identifier: FSL-1.1-MIT
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
/* field's ledger canonical form (src/ledger.js canonJSON) against the shared canonical-record/1 vectors
   (packages/_vectors/canonical_vectors.json, RFC 8785 JCS).
     node --test packages/field/tests/canon.test.js
   Valid cases: the bytes and their sha256 must equal the vector. Invalid cases: canonJSON does not follow the
   spec there, and these tests pin what it does today, so a change shows up as a failing test rather than as a
   silent change of ledger hashes. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const F = require("../src/index.js");

const V = require(path.join(__dirname, "..", "..", "_vectors", "canonical_vectors.json"));
const sha = (s) => crypto.createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

test("the vector file is the canonical-record/1 set", () => {
  assert.equal(V.schema, "canonical-record.vectors/1");
  assert.ok(V.cases.length >= 30, `${V.cases.length} cases`);
});

for (const c of V.cases) {
  test(`valid ${c.group}/${c.id}: JCS bytes and sha256`, () => {
    const got = F.canonJSON(JSON.parse(c.input));
    assert.equal(got, c.canonical);
    assert.equal(sha(got), c.sha256);
    assert.equal(c.implementations.field_ledger, "agrees", "the vector file records field_ledger agreeing");
  });
}

/* Invalid inputs. The spec refuses all four. canonJSON's actual behaviour, pinned: */
const byId = Object.fromEntries(V.invalid.map((c) => [c.id, c]));

test("invalid nan: the text is refused by the parser; the JS value NaN is written as null (spec refuses)", () => {
  assert.throws(() => JSON.parse(byId.nan.input), SyntaxError);
  assert.equal(F.canonJSON(NaN), "null");
  assert.equal(F.canonJSON({ e: NaN }), F.canonJSON({ e: null }), "NaN and null hash the same");
});

test("invalid infinity: the text is refused by the parser; Infinity and -Infinity are written as null (spec refuses)", () => {
  assert.throws(() => JSON.parse(byId.infinity.input), SyntaxError);
  assert.equal(F.canonJSON(Infinity), "null");
  assert.equal(F.canonJSON(-Infinity), "null");
});

test("invalid unsafe-int: 2^53 is accepted and written as 9007199254740992 (spec refuses)", () => {
  assert.equal(F.canonJSON(JSON.parse(byId["unsafe-int"].input)), "9007199254740992");
  assert.equal(byId["unsafe-int"].implementations.field_ledger, "accepts: 9007199254740992");
});

test("invalid lone-surrogate: accepted and written as an escape (spec refuses)", () => {
  const got = F.canonJSON(JSON.parse(byId["lone-surrogate"].input));
  assert.equal(got, '"\\ud800"');
  assert.equal(byId["lone-surrogate"].implementations.field_ledger, "accepts: " + got);
});

test("undefined: dropped as an object member, null inside an array", () => {
  assert.equal(F.canonJSON({ a: 1, b: undefined }), '{"a":1}');
  assert.equal(F.canonJSON([1, undefined]), "[1,null]");
});

test("planted: a sorted-keys form with spaces (json.dumps default) is not the canonical bytes", () => {
  const c = V.cases.find((x) => x.id === "nested");
  const pythonDefault = JSON.stringify(JSON.parse(c.canonical), null, 0).replace(/,/g, ", ").replace(/:/g, ": ");
  assert.notEqual(pythonDefault, F.canonJSON(JSON.parse(c.input)));
});
