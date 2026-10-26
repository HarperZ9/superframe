import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EASE, DURATION, cssEase, bezier, ease, spring, springCss, tokensCss, auditMotion,
  backOut, backOutFor, expoOut, curveFromSamples, MEASURED, cascade,
} from "../motion.mjs";

test("backOut with s = 0 is a cubic ease-out, and the classic s overshoots about 10%", () => {
  for (const t of [0.2, 0.5, 0.8]) assert.ok(Math.abs(backOut(0)(t) - (1 - (1 - t) ** 3)) < 1e-12);
  let peak = 0;
  for (let i = 0; i <= 1000; i++) peak = Math.max(peak, backOut()(i / 1000));
  assert.ok(Math.abs(peak - 1.1) < 0.002, `peak ${peak}`);
});

test("backOutFor finds the s that gives the measured 2% overshoot", () => {
  const s = backOutFor(0.018);
  let peak = 0;
  for (let i = 0; i <= 2000; i++) peak = Math.max(peak, backOut(s)(i / 2000));
  assert.ok(Math.abs(peak - 1.018) < 0.0005, `peak ${peak}`);
  assert.ok(backOutFor(0) < 1e-9);
  assert.throws(() => backOutFor(1), /overshoot/);
});

test("expoOut reaches 1 at t = 1 and is front-loaded", () => {
  const f = expoOut(6);
  assert.equal(f(1), 1);
  assert.equal(f(0), 0);
  assert.ok(f(0.25) > 0.7);
});

test("curveFromSamples passes through the measured glyph cascade points", () => {
  const c = curveFromSamples(MEASURED.glyphCascade);
  for (const [t, v] of MEASURED.glyphCascade) assert.ok(Math.abs(c.fn(t) - v) < 1e-12);
  assert.ok(Math.abs(c.fn(0.83) - 0.3) < 1e-9, "midway between 0.53 s and 1.13 s");
  assert.equal(c.durationMs, 1800);
  assert.match(c.easing, /^linear\(0 0%, 0\.1 29\.44%, 0\.5 62\.78%, 0\.9 77\.78%, 1\.018 83\.33%, 1 100%\)$/);
  assert.throws(() => curveFromSamples([[0.1, 0], [1, 1]]), /t = 0/);
  assert.throws(() => curveFromSamples([[0, 0], [1, 1], [1, 1]]), /increase/);
});

test("the measured engraving reveal is 90% done by 0.62 s", () => {
  const c = curveFromSamples(MEASURED.engravingReveal);
  assert.ok(Math.abs(c.fn(0.62) - 0.9) < 1e-12);
  assert.equal(c.fn(0.1), 0);
});

test("cascade staggers by rank and adds group delay", () => {
  assert.deepEqual(cascade([2, 0, 1, 0], { stagger: 0.1 }).map((v) => +v.toFixed(6)), [0.2, 0, 0.1, 0]);
  assert.deepEqual(cascade([0, 0], { stagger: 0.1, groupOf: (i) => i }), [0, 0.5]);
});

test("cssEase renders tokens and refuses unknown names", () => {
  assert.equal(cssEase("standard"), "cubic-bezier(0.2, 0, 0, 1)");
  assert.throws(() => cssEase("bouncy"), /unknown/);
});

test("bezier hits its end points and is monotone for every token", () => {
  for (const name of Object.keys(EASE)) {
    const f = ease(name);
    assert.equal(f(0), 0);
    assert.equal(f(1), 1);
    let prev = 0;
    for (let i = 1; i <= 100; i++) { const v = f(i / 100); assert.ok(v >= prev - 1e-9, `${name} not monotone at ${i}`); prev = v; }
  }
});

test("linear bezier is the identity and the film curve is symmetric", () => {
  const lin = bezier(0, 0, 1, 1);
  for (const x of [0.1, 0.37, 0.5, 0.9]) assert.ok(Math.abs(lin(x) - x) < 1e-6);
  const film = ease("film");
  for (const x of [0.1, 0.25, 0.4]) assert.ok(Math.abs(film(x) + film(1 - x) - 1) < 1e-6);
  assert.ok(Math.abs(film(0.5) - 0.5) < 1e-6);
});

test("a known point: standard easing at x = 0.5 matches an independent bisection", () => {
  const [x1, y1, x2, y2] = EASE.standard;
  const B = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (B(m, x1, x2) < 0.5) lo = m; else hi = m; }
  assert.ok(Math.abs(ease("standard")(0.5) - B(lo, y1, y2)) < 1e-6);
  assert.throws(() => bezier(-0.1, 0, 1, 1), /0\.\.1/);
});

test("springs start at 0, settle at 1, and damping changes the regime", () => {
  const under = spring({ stiffness: 170, damping: 10 });
  const crit = spring({ stiffness: 100, damping: 20 });
  const over = spring({ stiffness: 100, damping: 40 });
  for (const s of [under, crit, over]) {
    assert.ok(Math.abs(s.position(0)) < 1e-9);
    assert.ok(Math.abs(s.position(s.settle + 0.5) - 1) < 0.001);
  }
  assert.ok(under.zeta < 1 && crit.zeta === 1 && over.zeta > 1);
  let peak = 0;
  for (let t = 0; t < 2; t += 0.01) peak = Math.max(peak, under.position(t));
  assert.ok(peak > 1, "an underdamped spring overshoots");
  for (let t = 0; t < 3; t += 0.01) assert.ok(over.position(t) <= 1 + 1e-9, "an overdamped spring never overshoots");
  assert.throws(() => spring({ stiffness: 0 }), /stiffness/);
});

test("springCss gives a linear() curve that ends at 1 and a duration", () => {
  const s = springCss({ stiffness: 170, damping: 26 }, 8);
  assert.match(s.easing, /^linear\(0, [\d., -]+, 1\)$/);
  assert.equal(s.easing.split(",").length, 9);
  assert.ok(s.durationMs > 100 && s.durationMs < 2000, `duration ${s.durationMs}`);
});

test("tokensCss zeroes every duration under reduced motion", () => {
  const css = tokensCss();
  assert.match(css, /--ease-standard:cubic-bezier\(0\.2, 0, 0, 1\);/);
  assert.match(css, /--dur-base:200ms;/);
  const reduced = css.split("@media (prefers-reduced-motion: reduce)")[1];
  for (const k of Object.keys(DURATION).filter((k) => k !== "ceiling")) assert.match(reduced, new RegExp(`--dur-${k}:0ms;`));
  assert.ok(!css.includes("--dur-ceiling"));
});

test("audit: clean CSS with a reduced-motion rule scores 100", () => {
  const css = ".card{transition:transform 200ms var(--ease-standard),opacity 200ms}\n@media (prefers-reduced-motion: reduce){.card{transition:none}}";
  const r = auditMotion(css);
  assert.equal(r.score, 100);
  assert.deepEqual(r.findings, []);
  assert.equal(r.animates, true);
});

test("audit: each rule fires once with its line", () => {
  const css = [
    ".a{transition:all 200ms}",                     // M4 + M1 (file level)
    ".b{animation:spin 2s linear infinite}",       // M2 + M3
    ".c{transition:width 150ms}",                   // M5
    "@keyframes grow{from{height:0}to{height:10px}}", // M5 keyframes
  ].join("\n");
  const r = auditMotion(css);
  const rules = r.findings.map((f) => `${f.rule}@${f.line}`);
  assert.deepEqual(rules.sort(), [
    "M1-no-reduced-motion@1", "M2-infinite-loop@2", "M3-long-duration@2", "M4-transition-all@1",
    "M5-layout-property@3", "M5-layout-property@4",
  ].sort());
  assert.equal(r.score, 100 - 30 - 15 - 8 - 8 - 8 - 8);
});

test("audit: art scope keeps findings but scores only accessibility", () => {
  const css = ".orb{animation:drift 12s ease-in-out infinite}@media (prefers-reduced-motion: reduce){.orb{animation:none}}";
  const r = auditMotion(css, { scope: "art" });
  assert.equal(r.score, 100);
  assert.ok(r.findings.some((f) => f.rule === "M2-infinite-loop"));
  assert.equal(auditMotion(".orb{animation:drift 12s infinite}", { scope: "art" }).score, 70);
});

test("audit: comments and static CSS raise nothing", () => {
  assert.deepEqual(auditMotion("/* transition: all 9s infinite */ .x{color:red}").findings, []);
  assert.equal(auditMotion(".x{transition:none}").animates, false);
});
