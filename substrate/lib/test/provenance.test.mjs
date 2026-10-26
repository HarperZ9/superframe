import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  assetReceipt, verifyAsset, verifyLineage, licenceBasis, normaliseLicence, derivable, attribution,
  stampSvg, readSvgStamp, ASSET_SCHEMA,
} from "../provenance.mjs";

const here = new URL("../", import.meta.url);
const bytes = new TextEncoder().encode("[3,5,4,8,13]");
const base = { name: "fig-1", producer: "fw-report", content: bytes, licence: "CC-BY-4.0", creator: "Zain Dana Harper" };

test("vendored superstack matches its pinned SHA-256", () => {
  const pin = readFileSync(new URL("vendor/SUPERSTACK.sha256", here), "utf8").split(/\s+/)[0];
  const got = createHash("sha256").update(readFileSync(new URL("vendor/superstack.mjs", here))).digest("hex");
  assert.equal(got, pin);
});

test("content hash equals node:crypto SHA-256 of the bytes", () => {
  const rec = assetReceipt(base);
  assert.equal(rec.content_sha256, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(rec.schema, ASSET_SCHEMA);
  assert.equal(rec.bytes, bytes.length);
});

test("same inputs give the same receipt hash", () => {
  assert.equal(assetReceipt(base).receipt_sha256, assetReceipt({ ...base, content: "[3,5,4,8,13]" }).receipt_sha256);
});

test("a fresh receipt verifies with and without content", () => {
  const rec = assetReceipt(base);
  assert.deepEqual(verifyAsset(rec), []);
  assert.deepEqual(verifyAsset(rec, bytes), []);
});

test("changed content is caught", () => {
  const rec = assetReceipt(base);
  assert.deepEqual(verifyAsset(rec, "[3,5,4,8,14]"), ["content"]);
});

test("an edited field breaks the seal", () => {
  const rec = { ...assetReceipt(base), creator: "someone else" };
  assert.deepEqual(verifyAsset(rec), ["seal"]);
});

test("a loosened licence basis is caught even after resealing is skipped", () => {
  const parent = assetReceipt({ ...base, name: "photo", licence: "CC-BY-NC-4.0" });
  const child = assetReceipt({ ...base, name: "plate", licence: "CC0-1.0", inputs: [parent] });
  assert.equal(child.licence.basis, "CC-BY-NC-4.0");
  const forged = { ...child, licence: { ...child.licence, basis: "CC0-1.0" } };
  assert.ok(verifyAsset(forged).includes("licence:basis"));
});

test("licence names normalise and unknown stays unknown", () => {
  assert.equal(normaliseLicence("cc by-sa"), "CC-BY-SA-4.0");
  assert.equal(normaliseLicence("Public Domain"), "CC0-1.0");
  assert.equal(normaliseLicence("CC-BY"), "CC-BY-4.0");
  assert.equal(normaliseLicence("my licence"), "unknown");
  assert.equal(normaliseLicence(undefined), "unknown");
});

test("the most restrictive licence wins and unknown is strictest", () => {
  assert.equal(licenceBasis(["CC0-1.0", "CC-BY-4.0", "CC-BY-SA-4.0"]), "CC-BY-SA-4.0");
  assert.equal(licenceBasis(["CC-BY-4.0", null]), "unknown");
  assert.equal(licenceBasis([]), "unknown");
});

test("no-derivatives inputs are named as blocked", () => {
  const nd = assetReceipt({ ...base, name: "still", licence: "CC-BY-ND-4.0" });
  const child = assetReceipt({ ...base, name: "remix", inputs: [nd] });
  assert.equal(derivable("CC-BY-ND-4.0"), false);
  assert.deepEqual(child.licence.blocked_inputs, ["still"]);
  assert.equal(child.licence.derivable, false);
});

test("lineage walks two generations and finds a missing parent", () => {
  const a = assetReceipt({ ...base, name: "a" });
  const b = assetReceipt({ ...base, name: "b", content: "b", inputs: [a] });
  const c = assetReceipt({ ...base, name: "c", content: "c", inputs: [b] });
  const store = new Map([a, b, c].map((r) => [r.receipt_sha256, r]));
  assert.deepEqual(verifyLineage(c, store), { ok: true, errors: [], depth: 2 });
  store.delete(a.receipt_sha256);
  const res = verifyLineage(c, store);
  assert.equal(res.ok, false);
  assert.deepEqual(res.errors, ["b:missing-input:a"]);
});

test("lineage catches a swapped parent", () => {
  const a = assetReceipt({ ...base, name: "a" });
  const b = assetReceipt({ ...base, name: "b", content: "b", inputs: [a] });
  const impostor = assetReceipt({ ...base, name: "a", content: "other" });
  const store = { [a.receipt_sha256]: { ...impostor, receipt_sha256: a.receipt_sha256 } };
  const res = verifyLineage(b, store);
  assert.ok(res.errors.includes("b:input-content:a"));
  assert.ok(res.errors.includes("a:seal"));
});

test("attribution gives a TASL line", () => {
  const rec = assetReceipt({ ...base, title: "Pass rate", source: "harperz9.github.io" });
  assert.equal(attribution(rec), '"Pass rate", by Zain Dana Harper, from harperz9.github.io, licence CC-BY-4.0');
  assert.match(attribution(assetReceipt({ name: "x", producer: "p", content: "x" })), /creator not recorded, licence unknown/);
});

test("an SVG stamp round-trips, survives XML escaping, and replaces itself", () => {
  const rec = assetReceipt({ ...base, title: "a < b & c" });
  const svg = stampSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>', rec);
  assert.ok(!/<metadata[^>]*>[^<]*a < b/.test(svg));
  assert.deepEqual(readSvgStamp(svg), rec);
  const again = stampSvg(svg, assetReceipt({ ...base, name: "fig-2" }));
  assert.equal(again.match(/<metadata/g).length, 1);
  assert.equal(readSvgStamp(again).name, "fig-2");
  assert.equal(readSvgStamp("<svg></svg>"), null);
  assert.throws(() => stampSvg("<div></div>", rec), /not an SVG/);
});

test("missing name or producer is refused", () => {
  assert.throws(() => assetReceipt({ producer: "p", content: "x" }), /required/);
  assert.throws(() => assetReceipt({ name: "n", producer: "p", content: 5 }), /bytes or a string/);
});
