// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Shared check harness, the same shape as tools/perceive's known-answer tests: every check counts, and a
   planted wrong value or converter must be rejected, so a check that accepts anything fails the suite. */
"use strict";
const out = { pass: 0, fail: 0, planted_rejected: 0, planted_accepted: 0, rows: [] };
const check = (name, ok, detail) => {
  out[ok ? "pass" : "fail"]++;
  out.rows.push({ name, ok: !!ok, detail });
  if (!ok) console.error("FAIL", name, detail || "");
};
const planted = (name, accepted, detail) => {
  out[accepted ? "planted_accepted" : "planted_rejected"]++;
  out.rows.push({ name: "planted: " + name, ok: !accepted, detail });
  if (accepted) console.error("PLANTED ACCEPTED", name, detail || "");
};
const throws = (fn, type) => { try { fn(); return null; } catch (e) { return !type || e.name === type ? e : null; } };
const finish = (label) => {
  console.log(`${label}: ${out.pass} pass, ${out.fail} fail; planted ${out.planted_rejected} rejected, ${out.planted_accepted} accepted`);
  const i = process.argv.indexOf("--json");
  if (i > 0) require("fs").writeFileSync(process.argv[i + 1], JSON.stringify(out, null, 1));
  process.exit(out.fail || out.planted_accepted ? 1 : 0);
};
module.exports = { out, check, planted, throws, finish };
