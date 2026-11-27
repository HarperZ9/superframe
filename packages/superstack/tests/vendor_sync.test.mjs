// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUPERSTACK_DIR = resolve(HERE, "..");
const REPO_ROOT = resolve(SUPERSTACK_DIR, "..", "..");

function sha256Bytes(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function pinnedHash(name) {
  const lines = readFileSync(resolve(SUPERSTACK_DIR, "SHA256SUMS"), "utf8").trim().split(/\r?\n/);
  for (const line of lines) {
    const [hash, file] = line.trim().split(/\s+/);
    if (file === name) return hash;
  }
  throw new Error(`No SHA256SUMS pin found for ${name}`);
}

test("substrate/lib/vendor/superstack.mjs is byte-identical to packages/superstack/superstack.mjs", () => {
  const pin = pinnedHash("superstack.mjs");
  const canonical = readFileSync(resolve(SUPERSTACK_DIR, "superstack.mjs"));
  const vendored = readFileSync(resolve(REPO_ROOT, "substrate/lib/vendor/superstack.mjs"));
  const subPin = readFileSync(resolve(REPO_ROOT, "substrate/lib/vendor/SUPERSTACK.sha256"), "utf8").trim().split(/\s+/)[0];

  assert.equal(sha256Bytes(canonical), pin, "canonical superstack.mjs must match SHA256SUMS");
  assert.equal(subPin, pin, "substrate SUPERSTACK.sha256 must match packages/superstack/SHA256SUMS");
  assert.equal(sha256Bytes(vendored), pin, "substrate vendored superstack.mjs must match canonical LF bytes");
  assert.ok(canonical.equals(vendored), "substrate vendored superstack.mjs must have zero byte drift");
});

test("low-water vendored superstack.mjs and daw vendored superstack.py have zero content drift", () => {
  const mjsPin = pinnedHash("superstack.mjs");
  const lwRaw = readFileSync(resolve(REPO_ROOT, "games/low-water/game/engine/audio/vendor/superstack.mjs"));
  const lwLf = Buffer.from(lwRaw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  assert.equal(sha256Bytes(lwLf), mjsPin, "low-water vendored superstack.mjs must match canonical SHA-256");

  const pyPin = pinnedHash("superstack.py");
  const dawRaw = readFileSync(resolve(REPO_ROOT, "packages/daw/daw/superstack.py"));
  const dawLf = Buffer.from(dawRaw.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  assert.equal(sha256Bytes(dawLf), pyPin, "daw vendored superstack.py must match canonical SHA-256");
});

test("planted-drift control: 1-byte mutation breaks SHA-256 pin equality", () => {
  const pin = pinnedHash("superstack.mjs");
  const canonical = Buffer.from(readFileSync(resolve(SUPERSTACK_DIR, "superstack.mjs")));
  canonical[canonical.length - 1] ^= 0x01;
  assert.notEqual(sha256Bytes(canonical), pin);
});
