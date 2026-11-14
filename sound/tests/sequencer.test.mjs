// The sequencer's clock, checked without Web Audio: swing positions against hand-worked values, the time of every
// scheduled event, the hit queue the visuals read, and the stop. The engine and audio context here are stand-ins that
// record what the sequencer asks of them.
//   node --test sound/tests/sequencer.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Sequencer, swingPos } from '../sound/sequencer.js';

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} against ${b}`);
const gain = () => ({ connected: null, gain: { cancelScheduledValues() {}, setTargetAtTime() {} }, connect(d) { this.connected = d; }, disconnect() { this.connected = null; } });
const engine = (now = 0) => ({ now, hits: [], out: { name: 'master' }, ctx: { createGain: gain }, hit(time, name, vel, extra) { this.hits.push({ time, name, vel, ...extra }); } });
// a two-bar song: a kick on steps 0 and 8, a hat on every odd step, and a roll on fractional steps in bar 1
const song = (ran) => ({ bpm: 120, swing: 0.6, bars: 2, setup: (e, bus, t0) => ({ bus, t0, stopped: null, stop(t) { this.stopped = t; } }),
  events: (bar) => [0, 8].map((step) => ({ step, name: 'kick', vel: 1, run: (t) => ran.push(['kick', bar, t]) }))
    .concat([1, 3, 5, 7, 9, 11, 13, 15].map((step) => ({ step, name: 'hat', run: (t) => ran.push(['hat', bar, t]) })))
    .concat(bar === 1 ? [14.5].map((step) => ({ step, name: 'roll', vel: 0.5, run: (t) => ran.push(['roll', bar, t]) })) : []) });

test('swing 0.5 is straight, and a swung pair keeps its length', () => {
  for (const p of [0, 0.5, 1, 1.5, 2, 7, 14.5]) near(swingPos(p, 0.5), p, `position ${p} at swing 0.5`);
  near(swingPos(1, 2 / 3), 4 / 3, 'the second 16th of a pair at triplet swing');
  near(swingPos(3, 0.6), 3.2, 'the second 16th of the second pair at swing 0.6');
  near(swingPos(0.5, 0.6), 0.6, 'half way through the first 16th');
  near(swingPos(1.5, 0.6), 1.6, 'half way through the second 16th');
  for (const s of [0.5, 0.56, 0.6, 2 / 3]) for (const p of [0, 2, 4, 16]) near(swingPos(p, s), p, `even position ${p} does not move at swing ${s}`);
});

test('renderAll schedules every event at its swung time and reports it to the hit queue', () => {
  const ran = [], e = engine(), q = new Sequencer(e, song(ran)), r = q.renderAll(0.05);
  near(q.stepDur, 0.125, 'a 16th at 120 BPM'); near(q.barDur, 2, 'a bar at 120 BPM'); near(r.end, 4.05, 'the end of two bars');
  assert.equal(ran.length, 21); assert.equal(e.hits.length, 21);
  near(ran.find(([n, b]) => n === 'kick' && b === 1)[2], 2.05, 'the downbeat of bar 1');
  near(e.hits.find((h) => h.name === 'hat' && h.bar === 0 && h.step === 1).time, 0.05 + 1.2 * 0.125, 'the first swung hat');
  near(e.hits.find((h) => h.name === 'roll').time, 2.05 + (14 + 0.5 * 1.2) * 0.125, 'a fractional step inside a swung pair');
  assert.equal(e.hits.find((h) => h.name === 'roll').vel, 0.5); assert.equal(e.hits.find((h) => h.name === 'hat').vel, 1, 'velocity defaults to 1');
  assert.equal(r.state.bus.connected, e.out, 'the song bus feeds the engine output');
});

test('control: a straight song and a swung song do not schedule the off-beats at the same times', () => {
  const a = [], b = [], straight = { ...song(a), swing: 0.5 }, swung = song(b);
  new Sequencer(engine(), straight).renderAll(0); new Sequencer(engine(), swung).renderAll(0);
  const hats = (r) => r.filter(([n]) => n === 'hat').map(([, , t]) => t), kicks = (r) => r.filter(([n]) => n === 'kick').map(([, , t]) => t);
  assert.deepEqual(kicks(a), kicks(b), 'the beats stay put');
  assert.ok(hats(a).every((t, i) => hats(b)[i] - t > 0.02), 'every off-beat is later when swung');
  assert.equal(new Sequencer(engine(), { ...song([]), swing: undefined }).swing, 0.56, 'the default swing');
});

test('start schedules ahead of the clock, stops a song that does not loop, and stop clears the queue', () => {
  const ran = [], bars = [], e = engine(10), q = new Sequencer(e, song(ran), { loop: false });
  q.onbar = (bar, t) => bars.push([bar, t]);
  e.now = 20; q.start(10);          // the clock is far ahead, so both bars are due in the first tick
  assert.deepEqual(bars, [[0, 10], [1, 12]]); assert.equal(q.running, false); assert.equal(ran.length, 21);
  q.stop(0); assert.equal(q.timer, null); assert.equal(e.hits.length, 0); assert.equal(q.state.stopped, 20);
  const loop = new Sequencer(engine(0), song([]));
  loop.start(0); assert.equal(loop.running, true); assert.equal(loop.bar, 1, 'only the bar inside the 0.35 s look-ahead is scheduled');
  loop.start(0); assert.equal(loop.bar, 1, 'a second start does nothing'); loop.stop(0); assert.equal(loop.running, false);
});
