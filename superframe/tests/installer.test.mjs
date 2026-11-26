// Verifies Superframe 1-command installers (install.ps1 and install.sh):
// fail-closed SHA256SUMS verification, valid install, planted 1-byte tamper refusal,
// and release-binaries workflow presence.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");

test("install.ps1, install.sh, and release-binaries.yml pass hygiene and SHA256SUMS checks", () => {
  for (const name of ["install.ps1", "install.sh", ".github/workflows/release-binaries.yml"]) {
    const text = readFileSync(join(root, name), "utf8");
    assert.ok(text.split(/\r?\n/).length <= 300, `${name} stays under 300 lines`);
    assert.ok(!/[\u2013\u2014]/.test(text), `${name} has zero em/en dashes`);
    assert.match(text, /SHA256SUMS/, `${name} references SHA256SUMS`);
  }
});

test("platform 1-command installer passes offline --self-test (valid install + planted 1-byte tamper refusal)", () => {
  if (process.platform === "win32") {
    const out = execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(root, "install.ps1"), "-SelfTest"], { encoding: "utf8" });
    assert.match(out, /SELFTEST PASS/);
  } else {
    const out = execFileSync("sh", [join(root, "install.sh"), "--self-test"], { encoding: "utf8" });
    assert.match(out, /SELFTEST PASS/);
  }
});
