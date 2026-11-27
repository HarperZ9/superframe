// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const SHADERS_DIR = resolve(REPO_ROOT, "native/src/renderer/gpu/shaders");
const STYLE_WGSL = resolve(SHADERS_DIR, "style.wgsl");
const PARTS_DIR = resolve(SHADERS_DIR, "style");

function readLf(path) {
  return Buffer.from(readFileSync(path, "utf8").replace(/\r\n/g, "\n"), "utf8");
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

test("modular style/*.wgsl parts assemble byte-for-byte into style.wgsl", () => {
  const names = readdirSync(PARTS_DIR).filter((n) => n.endsWith(".wgsl")).sort();
  assert.equal(names.length, 8, `expected 8 modular style WGSL parts, got ${names.length}`);
  const parts = names.map((n) => readLf(resolve(PARTS_DIR, n)));
  const assembled = Buffer.concat(parts);
  const monolith = readLf(STYLE_WGSL);

  assert.equal(assembled.length, monolith.length, "assembled byte length must match style.wgsl");
  assert.equal(sha256(assembled), sha256(monolith), "assembled SHA-256 must match style.wgsl byte-for-byte");

  // Every modular part stays well below 1000 LOC
  for (let i = 0; i < names.length; i++) {
    const loc = parts[i].toString("utf8").split("\n").length - 1;
    assert.ok(loc > 100 && loc <= 800, `${names[i]} has unexpected line count ${loc}`);
  }
});

test("planted-drift control: 1-byte mutation in a style part breaks assembly parity", () => {
  const names = readdirSync(PARTS_DIR).filter((n) => n.endsWith(".wgsl")).sort();
  const parts = names.map((n) => Buffer.from(readLf(resolve(PARTS_DIR, n))));
  const monolithHash = sha256(readLf(STYLE_WGSL));
  // Mutate 1 byte in the first part
  parts[0][0] ^= 0x01;
  assert.notEqual(sha256(Buffer.concat(parts)), monolithHash);
});
