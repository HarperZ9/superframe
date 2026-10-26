// transfer.test.mjs: items as ticks (ticks.mjs), timing layers (timing.mjs), the reaction term (reaction.mjs), tracers
// and currents. The checks are BLEED section 13's: a transfer by the element's automaton runs as a front (high spread
// mid-change) and settles; the crossfade control has no spread; without neighbours the transfer stalls.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Medium } from '../lib/medium/index.mjs';
import { placeItem, measure } from '../lib/medium/ticks.mjs';
import { CURVES, timing, progress } from '../lib/medium/timing.mjs';
import { loopTank } from '../lib/medium/loops.mjs';

const patch = (m, law) => placeItem(m, { inside: (x, y) => (Math.hypot(x - 32, y - 20) < 8 ? 1 - 0.7 * (Math.hypot(x - 32, y - 20) / 8) ** 4 : 0), box: [24, 12, 40, 28], spacing: 0.5, elements: [{ name: 'A', look: () => ({}) }, { name: 'B', law, look: () => ({}) }] });

function runPatch(law, seconds = 10) {
  const m = new Medium({ nx: 64, ny: 40, seed: 'tick' }), it = patch(m, law); let peak = 0;
  for (let t = 0; t < seconds * 10; t++) { m.run(0.1); peak = Math.max(peak, measure(it).spread); }
  return { peak, end: measure(it), it };
}

test('the automaton runs the change as a front and settles; the crossfade control has no spread; without neighbours it stalls', () => {
  const law = { mode: 'lenia', radius: 1.5, threshold: 0.36, softness: 0.05, rate: 1.5, drive: { thin: 0.6 } };
  const front = runPatch(law), fade = runPatch({ ...law, mode: 'global', rate: 1 / 4 }), alone = runPatch({ ...law, neighbours: false });
  assert.ok(front.peak > 0.3, `front spread ${front.peak.toFixed(2)}`);
  assert.ok(front.end.mean > 0.99 && front.end.spread < 0.05, 'the front settles with every tick changed');
  assert.ok(fade.peak < 0.01, `crossfade spread ${fade.peak.toFixed(3)} (control)`);
  assert.ok(alone.end.mean < 0.9, `without neighbours the change stalls at ${alone.end.mean.toFixed(2)}`);
  for (const t of front.it.ticks) assert.ok(Math.abs(t.w[0] + t.w[1] - 1) < 1e-5, 'weights stay a partition of 1');
});

test('life mode flips ticks outright and holds them', () => {
  const r = runPatch({ mode: 'life', radius: 1.5, threshold: 0.36, drive: { thin: 0.6 } });
  for (const t of r.it.ticks) assert.ok(t.w[1] === 0 || t.w[1] === 1);
  assert.ok(r.end.mean > 0.9);
});

test('timing layers: named curves rise from 0 to 1, combine by weight, and refuse an unknown name', () => {
  for (const [name, f] of Object.entries(CURVES)) { assert.ok(f(0) <= 0.05, name); assert.ok(f(1e6) >= 0.999, name); assert.ok(f(3) >= f(1) - 1e-9, `${name} does not fall`); }
  const mix = [timing('exp', 1, { tau: 1 }), timing('linear', 3, { tau: 8 })], t = 2;
  assert.ok(Math.abs(progress(mix, t) - (CURVES.exp(t, { tau: 1 }) + 3 * CURVES.linear(t, { tau: 8 })) / 4) < 1e-9);
  assert.throws(() => timing('swing'), /no curve/);
});

test('the reaction term stays finite and forms structure; a tracer is carried and conserved; a current moves water', () => {
  const m = new Medium({ nx: 64, ny: 40, seed: 'gs' });
  m.add('reaction', { x: 0.5, y: 0.6, r: 0.08 }, 1, { F: 0.037, k: 0.06, at: 0 });
  m.add('tracer', { x: 0.3, y: 0.5, r: 0.05 }, 2, { name: 'dye', at: 0 });
  m.add('current', { x: 0.5, y: 0.5, w: 0.4, h: 0.1 }, 0.4, { at: 0, for: 10 });
  m.run(0.1); const mass0 = m.tracers.dye.f.reduce((a, b) => a + b, 0); m.run(2);
  const V = m.reaction.V; let lo = Infinity, hi = -Infinity; for (const v of V) { assert.ok(Number.isFinite(v)); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(hi - lo > 0.05, 'V varies across the water');
  const mass1 = m.tracers.dye.f.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(mass1 - mass0) / mass0 < 0.01, `tracer mass kept (${mass0.toFixed(3)} then ${mass1.toFixed(3)})`);
  const k = Math.round(0.5 * 40) * 64 + 32; assert.ok(m.u[k] > 0.1, `the current runs (${m.u[k].toFixed(2)})`);
});

test('the claim loop: at the real reach ratio no claim tick is corrected; with equal reach and push most are', () => {
  const share = name => { const m = loopTank(name); m.run(6); const it = m.items[0]; return it.ticks.reduce((a, t) => a + t.w[1], 0) / it.ticks.length; };
  assert.ok(share('claim') < 0.01);
  assert.ok(share('claim-equal-both') > 0.5);
});
