// The light model's own tests: node --test game/engine/light/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { kelvinRgb, lineRgb, warmthOf, lum } from "../kelvin.mjs";
import { SOURCES, sourceOf } from "../sources.mjs";
import { sunAt, skyAt, phasesAt, sunColour } from "../clock.mjs";
import { flicker, maxStep, PROFILES } from "../flicker.mjs";
import { decayLights, lightIndex } from "../decay.mjs";
import { tableLight, ERAS } from "../eras.mjs";
import { crowdGains } from "../crowd.mjs";
import { trainAt, trainLights } from "../train.mjs";
import { createLightModel } from "../model.mjs";

test("colour from physics: warm fires, white noon, blue sky; temperatures recovered", () => {
  const c = kelvinRgb(1850), d = kelvinRgb(6500);
  assert.ok(c[0] > c[1] && c[1] > c[2], "a candle is red over green over blue");
  assert.ok(Math.abs(d[0] - d[2]) < 0.05, `6500 K is near white: ${d}`);
  for (const K of [1300, 1900, 2700, 4100, 6500, 9000]) assert.ok(Math.abs(warmthOf(kelvinRgb(K)) - K) <= 100, `round trip ${K}`);
  const na = lineRgb(589); assert.ok(na[0] > 0.9 && na[2] < 0.05, "the sodium line is orange");
  assert.ok(SOURCES.sodium.K < SOURCES.bulb.K && SOURCES.bulb.K < SOURCES.fluorescent.K, "sodium, then the bulb, then the tube, by warmth");
});
test("legacy plate kinds map onto sources; a plate fire burns as a stove unless named", () => {
  assert.equal(sourceOf({ kind: "paraffin", group: "fire" }).kind, "stove");
  assert.equal(sourceOf({ kind: "paraffin", group: "fire", source: "brazier" }).kind, "brazier");
  assert.equal(sourceOf({ kind: "white" }).kind, "bulb");
  assert.equal(sourceOf({ kind: "paraffin", source: "carbide" }).kind, "carbide");
});
test("the clock: a short low winter day, a long summer one; phases blend and sum to 1", () => {
  const w = sunAt(12, ERAS[2].doy), s = sunAt(12, 172);
  assert.ok(w.el > 15 && w.el < 35 && s.el > 55, `noon elevations ${w.el.toFixed(1)}, ${s.el.toFixed(1)}`);
  assert.ok(sunAt(7.0, 25).el < 0 && sunAt(9, 25).el > 0, "January: dark at seven, up at nine");
  assert.ok(sunAt(8, 25).dir[0] < 0 && sunAt(8, 25).dir[2] < 0, "the morning sun is south-east (-x, -z)");
  for (let h = 0; h < 24; h += 0.25) { const p = phasesAt(sunAt(h, 58).el), t = p.day + p.golden + p.blue + p.night; assert.ok(Math.abs(t - 1) < 1e-9); }
  // continuous: no step in the sky over a minute anywhere in the day
  let worst = 0; for (let h = 0; h < 24; h += 1 / 60) { const a = skyAt(h, 58).amb, b = skyAt(h + 1 / 60, 58).amb; worst = Math.max(worst, Math.abs(lum(a) - lum(b))); }
  assert.ok(worst < 0.02, `largest minute step ${worst}`);
  assert.ok(lum(skyAt(17.6, 58).amb) > lum(skyAt(21, 58).amb) * 2, "the blue hour is lighter than the night");
  const g = skyAt(7.95, 58).sun.rgb; assert.ok(g[0] > g[2] * 2, "the low sun is warm");
  // the frost sun's colour against direct-sun measurements (from memory, moderate confidence: about 3200 K at 5
  // degrees, about 4000 K at 10, about 5000 K at 30): warm, not orange
  const cct = (el) => warmthOf(sunColour(el, ERAS[2].haze)); assert.ok(cct(5) > 3000 && cct(5) < 3700 && cct(10) > 3700 && cct(10) < 4500 && cct(30) > 4600, `${cct(5)} ${cct(10)} ${cct(30)}`);
});
test("flicker: deterministic, about 1 on average, small steps where a light rules; the strobe flashes in pairs", () => {
  for (const p of Object.keys(PROFILES)) assert.equal(flicker(p, 3, 1.234), flicker(p, 3, 1.234));
  for (const p of ["lamp", "candle", "fire", "tallow", "rush", "embers"]) {
    let m = 0, n = 0; for (let t = 0; t < 120; t += 0.05) { m += flicker(p, 7, t); n++; }
    assert.ok(Math.abs(m / n - 1) < 0.06, `${p} mean ${m / n}`); assert.ok(maxStep(p, 7) < 0.12, `${p} step ${maxStep(p, 7)}`);
  }
  let on = 0; for (let t = 0; t < 0.9; t += 0.01) if (flicker("strobe", 1, t) > 0) on++;
  assert.ok(on > 8 && on < 25, `strobe on ${on} of 90`);
});
test("decay: lamps go out one by one as the street's stock falls, fires shrink, the state's light stays", () => {
  const lamps = Array.from({ length: 20 }, (_, i) => ({ at: [i * 3, 4, 0], kind: "sodium", group: "lamp", street: "s" }));
  const on = (food) => { const r = (n) => ({ food, work: food, hunger: 1 - food, theft: 0.5 })[n]; return decayLights(lamps, r).filter((d) => d.on).length; };
  const counts = [1, 0.8, 0.6, 0.4, 0.2, 0].map(on);
  for (let i = 1; i < counts.length; i++) assert.ok(counts[i] <= counts[i - 1], `monotone: ${counts}`);
  assert.ok(counts[0] >= 18 && counts[5] <= 2, `full street lit, empty street dark: ${counts}`);
  const fire = (f) => decayLights([{ at: [0, 0, 0], kind: "paraffin", group: "fire", street: "s" }], (n) => ({ food: f, work: f })[n])[0];
  assert.ok(fire(0.1).gain < fire(0.8).gain && fire(0.1).reachK < fire(0.8).reachK, "a poor fire is smaller");
  const st = decayLights([{ at: [0, 0, 0], kind: "paraffin", source: "carbide", street: "s" }], () => 0)[0];
  assert.ok(st.on && st.gain === 1, "the requisition's lamp never goes out");
  assert.ok(Math.abs(lightIndex((n) => ({ food: 0.45, work: 0.5, hunger: 0.25, theft: 0.1 })[n], "square") - 0.57) < 0.03);
  assert.equal(tableLight(2, { portion: 1, food: 1 }).source, "tallow"); assert.equal(tableLight(2, { portion: 0.05, food: 0.05 }).source, null);
});
test("the crowd in a pool takes its light; the train crosses, stops, and goes", () => {
  const L = [{ at: [0, 4, 0], reach: 8, e0: 1 }];
  assert.equal(crowdGains(L, [])[0], 1);
  const g = crowdGains(L, Array.from({ length: 12 }, (_, i) => ({ at: [Math.cos(i) * 2, 0, Math.sin(i) * 2] })))[0];
  assert.ok(g < 0.95 && g >= 0.55, `a full pool ${g}`);
  const spec = { path: [[22, 0, 70], [22, 0, -22]], speed: 6, dwell: 25 };
  const a = trainAt(spec, 2), b = trainAt(spec, 8), c = trainAt(spec, 30);
  assert.ok(a.at[2] > b.at[2] && b.at[2] > c.at[2] - 1e-6, "it runs north along the siding");
  assert.ok(Math.abs(c.at[2] + 22) < 0.5 && !c.moving, "it stands at the dock");
  assert.equal(trainLights({ train: spec }, 45).length, 0, "and goes after the dwell");
});
test("the model: gains per light, windows by the hour, decay from the reader", () => {
  const place = { place: "t", variants: ["night"], variantInfo: { night: { hour: 22 } }, lights: { night: [{ at: [0, 3, 0], kind: "paraffin", I: 9, reach: 8, street: "s" }, { at: [5, 2, 0], kind: "paraffin", group: "window", I: 1, reach: 4, street: "s" }] } };
  const rich = createLightModel({ place, read: () => 1 }), poor = createLightModel({ place, read: () => 0 });
  assert.ok(rich.gains(0)[0] > 0.8 && poor.gains(0)[0] === 0, "the poor street's lamp is out");
  rich.setHour(13); assert.ok(rich.gains(0)[1] < 0.05, "no lit window at noon"); rich.setHour(20); assert.ok(rich.gains(0)[1] > 0.5, "lit at eight");
});

import { windowLit } from "../windows.mjs";
test("windows light and go dark one by one, not as a street-wide fade", () => {
  const seeds = Array.from({ length: 40 }, (_, i) => i * 7919 + 3); let prev = null, maxStep = 0, partial = 0;
  for (let h = 15; h < 24; h += 1 / 60) { const v = seeds.map((s) => windowLit(h, s)); partial += v.filter((x) => x > 0.05 && x < 0.95).length; const n = v.filter((x) => x > 0.5).length; if (prev !== null) maxStep = Math.max(maxStep, Math.abs(n - prev)); prev = n; }
  assert.ok(maxStep <= 3, `at most a few windows change in a minute: ${maxStep}`);
  assert.ok(partial <= 40 * 2 * 2, `a window switches in about a game minute, it does not fade: ${partial} half-lit samples over 80 switches`);
  const at = (h) => seeds.filter((s) => windowLit(h, s) > 0.5).length; assert.ok(at(13) === 0 && at(19.5) > 30 && at(23.9) < 5, `${at(13)} ${at(19.5)} ${at(23.9)}`);
});
