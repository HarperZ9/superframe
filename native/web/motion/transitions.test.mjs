// node --test web/motion/transitions.test.mjs
// Each named transition is a pure function of progress: closed at 0, whole at 1, the same answer for the same
// u, and the same contours and point counts at every u so frames interpolate point for point. walk() leaves
// by running the arrival backwards. The drivers' pure half (keyframes, the clip polygon, view progress) and the
// clock and scroll drivers on a stub window are checked here too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { transitions, walk, shown, inside, IDENTITY } from "./transitions.mjs";
import { clipPath, styleOf, keyframes, viewProgress, bind } from "./scroll.mjs";

const near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b} (+/- ${e})`);
const counts = (fr) => fr.clip.map((c) => c.pts.length).join(",");
const flat = (fr) => [fr.opacity, ...fr.matrix, ...fr.clip.flatMap((c) => [...c.pts])];
// what a viewer sees of the piece at u: the clip's share of the box times its opacity
const same = (a, b, what) => { assert.equal(a.length, b.length, what); a.forEach((v, i) => near(v, b[i], 1e-5)); };
const seen = (fr) => shown(fr) * fr.opacity;

for (const [name, make] of Object.entries(transitions)) {
  test(`${name}: away at 0, whole at 1`, () => {
    const f = make(), a = f(0), b = f(1);
    assert.ok(seen(a) < 0.02, `${name} shows ${seen(a)} of the piece at 0`);
    near(shown(b, 40), 1); near(b.opacity, 1);
    for (const [x, y] of [[0.001, 0.001], [0.999, 0.001], [0.001, 0.999], [0.999, 0.999]]) assert.ok(inside(b, x, y), `${name} leaves the corner ${x},${y} cut at 1`);
    b.matrix.forEach((v, i) => near(v, IDENTITY[i]));
  });
  test(`${name}: reversible, repeatable, and point for point`, () => {
    const f = make(), us = [0, 0.13, 0.37, 0.5, 0.81, 1];
    for (const u of us) {
      assert.deepEqual(flat(f(u)), flat(f(u)), `${name} gave two answers at ${u}`);          // pure in u
      assert.equal(counts(f(u)), counts(f(0)), `${name} changed its points at ${u}`);          // interpolates point for point
      for (const v of flat(f(u))) assert.ok(Number.isFinite(v), `${name} gave a non-number at ${u}`);
    }
    // going up the page undoes going down: the leaving is the arrival backwards, frame for frame
    const w = walk(f, { enter: [0, 0.4], exit: [0.6, 1] });
    for (const k of [0, 0.25, 0.5, 0.9, 1]) same(flat(w(0.4 * k)), flat(w(1 - 0.4 * k)), name);
    same(flat(w(0.5)), flat(f(1)), name);
    // more of the piece shows as u rises (the film gate and the press move the whole piece; their opacity rises)
    let last = -1; for (let i = 0; i <= 10; i++) { const s = seen(f(i / 10)); assert.ok(s >= last - 0.02, `${name} shows less at ${i / 10}`); last = s; }
  });
}

test("the same seed gives the same tiles and the same blot; another seed gives others", () => {
  assert.deepEqual(flat(transitions.tiles({ seed: 7 })(0.4)), flat(transitions.tiles({ seed: 7 })(0.4)));
  assert.notDeepEqual(flat(transitions.tiles({ seed: 7 })(0.4)), flat(transitions.tiles({ seed: 8 })(0.4)));
  assert.notDeepEqual(flat(transitions.inkBleed({ seed: 3 })(0.4)), flat(transitions.inkBleed({ seed: 4 })(0.4)));
});

test("clipPath writes one polygon with bridges, styleOf writes compositor properties", () => {
  const f = transitions.strata({ layers: 2 });
  const css = clipPath(f(1).clip);
  assert.match(css, /^polygon\(nonzero, /);
  assert.equal(css.split(",").length - 1, 2 * 5 + 1);                 // two closed boxes and one bridge
  assert.equal(clipPath([]), "none");
  const s = styleOf(transitions.filmGate()(0));
  assert.deepEqual(Object.keys(s).sort(), ["clipPath", "opacity", "transform"]);
  assert.match(s.transform, /^translate\(0%, 50%\) matrix\(1, 0, 0, 1, 0, 0\)$/);
});

test("keyframes sample 0..1 evenly; view progress runs 0 to 1 across the viewport", () => {
  const k = keyframes(transitions.curtain(), 8);
  assert.equal(k.length, 9); assert.equal(k[0].offset, 0); assert.equal(k[8].offset, 1);
  assert.equal(new Set(k.map((x) => x.clipPath.split(",").length)).size, 1);
  near(viewProgress(900, 400, 900), 0); near(viewProgress(-400, 400, 900), 1); near(viewProgress(250, 400, 900), 0.5);
  near(viewProgress(5000, 400, 900), 0); near(viewProgress(-5000, 400, 900), 1);
});

// a stub window: frames run when the test says so
function stubWindow({ reduced = false, view = false } = {}) {
  const q = []; let now = 0;
  const win = { innerHeight: 900, performance: { now: () => now }, requestAnimationFrame: (fn) => q.push(fn), cancelAnimationFrame: () => {},
    matchMedia: () => ({ matches: reduced }), listeners: {}, addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }, removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter((x) => x !== fn); } };
  if (view) win.ViewTimeline = function ViewTimeline(o) { this.o = o; };
  return { win, run: (ms) => { now += ms; const fns = q.splice(0); fns.forEach((fn) => fn(now)); } };
}
const element = (top = 900) => ({ style: {}, rect: { top, height: 400 }, getBoundingClientRect() { return this.rect; } });

test("the clock driver plays 0 to 1 once and leaves the element as it stands", () => {
  const { win, run } = stubWindow(), el = element();
  bind(el, transitions.curtain(), { driver: "clock", duration: 100, win });
  run(50); assert.match(el.style.clipPath, /^polygon/);
  run(60); assert.equal(el.style.clipPath, "");
});

test("the scroll driver follows the element both ways, by script where there are no view timelines", () => {
  const { win, run } = stubWindow(), el = element(900), f = walk(transitions.curtain());
  const stop = bind(el, f, { win });
  run(16); const away = el.style.clipPath;
  el.rect.top = 250; win.listeners.scroll[0](); run(16); const whole = el.style.clipPath;
  assert.notEqual(away, whole); assert.equal(whole, clipPath(f(0.5).clip));
  el.rect.top = 900; win.listeners.scroll[0](); run(16); assert.equal(el.style.clipPath, away);   // back up: the same frame
  stop(); assert.equal(el.style.clipPath, ""); assert.equal(win.listeners.scroll.length, 0);
});

test("with view timelines the browser gets keyframes and no scroll listener; reduced motion binds nothing", () => {
  const { win } = stubWindow({ view: true }), el = element(); let got = null;
  el.animate = (k, o) => { got = { k, o }; return { cancel() {} }; };
  bind(el, walk(transitions.aperture()), { win, samples: 16 });
  assert.equal(got.k.length, 17); assert.equal(got.o.rangeStart, "cover 0%"); assert.equal(got.o.fill, "both"); assert.equal(win.listeners.scroll, undefined);
  const r = stubWindow({ reduced: true, view: true }), el2 = element(); el2.animate = () => { throw new Error("bound under reduced motion"); };
  bind(el2, walk(transitions.aperture()), { win: r.win });
  assert.equal(el2.style.clipPath, "");
});
