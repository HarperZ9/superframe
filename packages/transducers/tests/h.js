/* Shared test helpers. Data-dependent tests skip with the reason when the measured tables are not bound, so public CI
   states what it did not check. */
"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../src/index.js");
const needs = (...keys) => { const m = keys.filter((k) => !T.hasData(k)); return m.length ? `no measured data bound: ${m.join(", ")}` : false; };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || "near"}: ${a} vs ${b} (tol ${tol})`);
const refuses = (fn, name, msg) => assert.throws(fn, (e) => e.name === name, msg);
const whiteGrid = (n, seed = 1, amp = 1) => { const r = T.rng(seed, "white"); return T.grid("white", n, n, Float64Array.from({ length: n * n }, () => amp * T.gauss(r))); };
const tone = (f, n, a = 1, c = 0) => Float64Array.from({ length: n }, (_, i) => c + a * Math.sin(2 * Math.PI * f * i));
module.exports = { test, assert, T, needs, near, refuses, whiteGrid, tone, F: T.Field() };
