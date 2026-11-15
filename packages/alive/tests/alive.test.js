// Origin: the alive workspace tests/alive.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A minimal page for the governor: no DOM, just the globals Rhythm and Alive read.
let rafQ = [];
globalThis.requestAnimationFrame = (f) => { rafQ.push(f); return rafQ.length; };
globalThis.cancelAnimationFrame = () => { rafQ = []; };
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.innerWidth = 1440;
globalThis.document = { hidden: false, documentElement: { dataset: { aliveAuto: 'off' }, classList: { contains: () => false, toggle() {} } } };
const { Rhythm, Alive, BAR, CONFIG } = await import('../src/alive.js');

const fake = (name, { area = 100, ms = 1, key = (t) => Math.floor(t * 10), page = false } = {}) => ({ kind: name, el: {}, visible: true, area, ms, lastKey: null, dwell: 0, page, renders: 0, key, render() { this.renders++; }, rest() {} });
const make = () => { const a = new Alive({}); a.lastInput = performance.now(); return a; };

test('rhythm: phases on the bar, dt clamped at 100 ms, a failing subscriber is removed', () => {
  const r = new Rhythm(); r.t = 3.2; assert.equal(r.phase(BAR), 0.5); assert.equal(r.bar(), 0); r.t = 13; assert.equal(r.bar(), 2);
  const r2 = new Rhythm(); const seen = []; const err = console.error; console.error = () => {};
  r2.subscribe((t, dt) => seen.push(dt)); r2.subscribe(() => { throw new Error('boom'); });
  rafQ.shift()(1000); rafQ.shift()(1500); console.error = err;
  assert.deepEqual(seen, [0, 0.1]); assert.equal(r2.subs.size, 1);
});

test('governor: at most maxActive lives move; the rest take turns one bar each', () => {
  const a = make(); a.lives = [...Array(6)].map((_, i) => fake('l' + i, { area: 600 - i * 10 }));
  a.rhythm.t = 0.05; a.frame(0.05, 0.016);
  assert.deepEqual(a.lives.map((l) => l.renders), [1, 1, 1, 1, 0, 0]);
  a.rhythm.t = BAR + 0.05; a.frame(BAR + 0.05, 0.016);
  assert.deepEqual(a.lives.map((l) => l.renders), [1, 2, 2, 2, 1, 0]);
});

test('governor: a life redraws only when its own clock moves', () => {
  const a = make(), l = fake('wiggle', { key: (t) => Math.floor(t / 0.1) }); a.lives = [l];
  for (let f = 0; f < 60; f++) { a.rhythm.t = f / 60; a.frame(f / 60, 1 / 60); }
  assert.equal(l.renders, 10, 'a 10 Hz life drew 10 times in one second at 60 fps');
});

test('governor: a frame over budget makes the expensive life wait, never the first draw', () => {
  const a = make(), cheap = fake('cheap', { area: 900, ms: 5 }), dear = fake('dear', { area: 100, ms: 9 }); a.lives = [cheap, dear];
  a.frame(0.0, 0.016); assert.equal(dear.renders, 1, 'first draw always happens');
  cheap.ms = 5; dear.ms = 9; a.frame(0.2, 0.016); assert.equal(dear.renders, 1, 'second draw waits: 5 + 9 > ' + CONFIG.budgetMs);
});

test('rest: after the idle threshold the motion level eases toward the rest level', () => {
  const a = make(); a.lives = []; a.lastInput = performance.now() - (CONFIG.restAfterS + 5) * 1000;
  for (let i = 0; i < 1800; i++) a.frame(i / 60, 1 / 60);
  assert.ok(Math.abs(a.level - CONFIG.restLevel) < 0.05, `level ${a.level.toFixed(3)}`);
  a.lastInput = performance.now(); for (let i = 0; i < 360; i++) a.frame(30 + i / 60, 1 / 60);
  assert.ok(a.level > 0.95, `woke to ${a.level.toFixed(3)}`);
});

test('the page grain keeps living when no slot is in view', () => {
  const a = make(), g = fake('grain', { page: true, key: (t) => Math.floor(t * 12) }), s = fake('still'); s.visible = false; a.lives = [g, s];
  for (let f = 0; f < 60; f++) a.frame(f / 60, 1 / 60);
  assert.equal(g.renders, 12); assert.equal(s.renders, 0);
});
